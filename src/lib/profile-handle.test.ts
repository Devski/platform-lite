import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { handleRedirects, profiles, users } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import {
  createMemoryTransport,
  logTransport,
  renderEmail,
  setEmailTransport,
} from "./email";
import { HANDLE_CHANGE_COOLDOWN_DAYS, HANDLE_MAX } from "./handle";
import { updateDisplayName } from "./profile";
import {
  getHandleState,
  HandleError,
  handleAvailability,
  notifyHandleChanged,
  resolveHandle,
  setHandle,
  suggestHandle,
} from "./profile-handle";

// Integration suite for #15/#16 on PGlite (the CI service container when
// DATABASE_URL_TEST is set): the database side of a handle — the claim, the
// A6 cooldown, availability, the onboarding proposal, the redirect rows and
// their release (§9), the A10 notice. The pure A5/A6 rules are proven in
// handle.test.ts; here they meet the committed migration (G6).

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-02T12:00:00Z");
const daysAfterT0 = (days: number) => new Date(T0.getTime() + days * DAY_MS);
// One step past the cooldown, so a chain of changes passes A6.
const PAST_COOLDOWN = HANDLE_CHANGE_COOLDOWN_DAYS + 1;

let testDb: TestDb;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  // Built the way registration builds an account (#40) — not the way it used
  // to, which is how #36's change hid from every test in this file.
  userId = await insertTestAccount(testDb.db, {
    email: "owner-local@example.com",
  });
  otherUserId = await insertTestAccount(testDb.db, {
    email: "other-local@example.com",
  });
});

// Onboarding sends the name together with the first claim (#36), so a test
// that creates a profile must too — claiming without one is a path the
// product no longer has. Later changes carry no name and must not clear it.
const DISPLAY_NAME = "Pracownia Testowa";
// suggestHandle's last resort, mirrored here so the tests name it once.
const FALLBACK_BASE_VALUE = "studio";
function claim(
  id: string,
  handle: string,
  now?: Date,
  displayName: string | undefined = DISPLAY_NAME,
) {
  return setHandle(testDb.db, id, handle, now, displayName);
}

async function profileRow(id = userId) {
  const [row] = await testDb.db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, id));
  return row;
}

/** Other accounts holding the given handles, bypassing the cooldown. */
async function claimedByOthers(handles: string[]): Promise<void> {
  const owners = await testDb.db
    .insert(users)
    .values(
      handles.map((handle, i) => ({
        name: `holder-${i}`,
        email: `holder-${i}@example.com`,
      })),
    )
    .returning({ id: users.id });
  await testDb.db.insert(profiles).values(
    handles.map((handle, i) => ({
      userId: owners[i].id,
      displayName: `Holder ${i}`,
      handle,
    })),
  );
}

async function redirectRows() {
  return testDb.db
    .select({
      oldHandle: handleRedirects.oldHandle,
      targetUserId: handleRedirects.targetUserId,
    })
    .from(handleRedirects)
    .orderBy(handleRedirects.oldHandle);
}

/**
 * The smallest history that leaves a redirect row: claim `from` at T0 and
 * change to `to` a day later (the first change is always allowed).
 */
async function claimThenChange(from: string, to: string): Promise<void> {
  await claim(userId, from, T0);
  await claim(userId, to, daysAfterT0(1));
}

/** The §9 invariant: no redirect row names a live handle. */
async function expectNoRedirectToLiveHandle(): Promise<void> {
  const live = await testDb.db
    .select({ oldHandle: handleRedirects.oldHandle })
    .from(handleRedirects)
    .innerJoin(profiles, eq(profiles.handle, handleRedirects.oldHandle));
  expect(live).toEqual([]);
}

describe("setHandle (A5, A6)", () => {
  it("the initial assignment creates the profile row from the name sent with it, unstamped", async () => {
    await expect(
      claim(userId, " Studio-Praga ", T0),
    ).resolves.toEqual({ handle: "studio-praga", previousHandle: null });
    expect(await profileRow()).toMatchObject({
      handle: "studio-praga",
      displayName: DISPLAY_NAME,
      handleChangedAt: null,
    });
  });

  it("refuses to create a profile with no name at all (#40)", async () => {
    // Reachable only by skipping onboarding. It used to fall through to
    // users.name — empty since #36 — and die on the database CHECK with a
    // 500. Named here instead.
    // setHandle directly: the helper defaults the name, which is the point of
    // the helper and the opposite of what this test needs.
    const rejection = await setHandle(testDb.db, userId, "bez-nazwy", T0).catch(
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(HandleError);
    expect(rejection).toMatchObject({ code: "displayNameRequired" });
  });

  it("stores the name given with the claim, in place of users.name (#36)", async () => {
    // Onboarding asks for the name and derives the address from it. Before
    // this, users.name was the e-mail local part invented at registration,
    // and it reached the public page and every shared link.
    await claim(userId, "pracownia-zolc", T0, "Pracownia Żółć");
    expect(await profileRow()).toMatchObject({
      handle: "pracownia-zolc",
      displayName: "Pracownia Żółć",
    });
  });

  it("changes the address of an account whose users.name is empty (#36)", async () => {
    // Registration leaves users.name empty now, so it is no longer a usable
    // fallback. The upsert still spelled it into the INSERT values, and
    // PostgreSQL checks constraints on the tuple being inserted BEFORE ON
    // CONFLICT turns it into an update — so the blank-name CHECK fired on a
    // change that was never going to touch the name. Every address change
    // by a post-#36 account failed with a 500.
    // Its OWN account: emptying the shared fixture's name would change what
    // the suggestion tests see.
    const [fresh] = await testDb.db
      .insert(users)
      .values({ name: "", email: "empty-name@example.test" })
      .returning({ id: users.id });
    await claim(fresh.id, "pracownia", T0, "Pracownia Żółć");
    await expect(
      claim(fresh.id, "pracownia-zolc", daysAfterT0(31)),
    ).resolves.toMatchObject({ handle: "pracownia-zolc" });
    expect(await profileRow(fresh.id)).toMatchObject({
      displayName: "Pracownia Żółć",
    });
  });

  it("keeps the display name when the profile row already exists", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Pracownia Żółć");
    await claim(userId, "zolc", T0);
    expect(await profileRow()).toMatchObject({
      handle: "zolc",
      displayName: "Pracownia Żółć",
      handleChangedAt: null,
    });
    expect(await testDb.db.select().from(profiles)).toHaveLength(1);
  });

  it("setting the same handle again is a no-op, whatever the case", async () => {
    await claim(userId, "studio-praga", T0);
    await expect(
      claim(userId, "STUDIO-PRAGA", daysAfterT0(1)),
    ).resolves.toEqual({ handle: "studio-praga", previousHandle: null });
    // No change happened, so no cooldown started either.
    expect((await profileRow()).handleChangedAt).toBeNull();
  });

  it("refuses a case-variant duplicate of another user's handle as taken", async () => {
    await claim(otherUserId, "studio-x", T0);
    const rejection = await claim(userId, "Studio-X", T0).catch(
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(HandleError);
    expect(rejection).toMatchObject({ name: "HandleError", code: "taken" });
    expect(await profileRow()).toBeUndefined();
  });

  it("rejects reserved and invalid input before touching the database", async () => {
    await expect(claim(userId, "Admin")).rejects.toMatchObject({
      code: "reserved",
    });
    await expect(claim(userId, "-x-")).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(claim(userId, "ab")).rejects.toMatchObject({
      code: "invalid",
    });
    expect(await testDb.db.select().from(profiles)).toHaveLength(0);
  });

  it("allows the first change and stamps handle_changed_at", async () => {
    await claim(userId, "first", T0);
    await expect(
      claim(userId, "second", daysAfterT0(1)),
    ).resolves.toEqual({ handle: "second", previousHandle: "first" });
    expect(await profileRow()).toMatchObject({
      handle: "second",
      handleChangedAt: daysAfterT0(1),
    });
  });

  it("blocks a second change inside 30 days and names the release moment", async () => {
    await claim(userId, "first", T0);
    await claim(userId, "second", daysAfterT0(1));
    const rejection = await setHandle(
      testDb.db,
      userId,
      "third",
      daysAfterT0(20),
    ).catch((error: unknown) => error);
    expect(rejection).toBeInstanceOf(HandleError);
    expect(rejection).toMatchObject({
      code: "cooldown",
      retryAt: daysAfterT0(1 + HANDLE_CHANGE_COOLDOWN_DAYS),
    });
    expect(await profileRow()).toMatchObject({
      handle: "second",
      handleChangedAt: daysAfterT0(1),
    });
  });

  it("allows the change again once the 30 days have passed", async () => {
    await claim(userId, "first", T0);
    await claim(userId, "second", daysAfterT0(1));
    const released = daysAfterT0(1 + HANDLE_CHANGE_COOLDOWN_DAYS);
    await expect(
      claim(userId, "third", released),
    ).resolves.toEqual({ handle: "third", previousHandle: "second" });
    expect(await profileRow()).toMatchObject({
      handle: "third",
      handleChangedAt: released,
    });
  });

  it("lets exactly one of two concurrent claims of the same handle win", async () => {
    const results = await Promise.allSettled([
      claim(userId, "contested", T0),
      claim(otherUserId, "contested", T0),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const loser = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(loser?.reason).toBeInstanceOf(HandleError);
    expect(loser?.reason).toMatchObject({ code: "taken" });
    const holders = await testDb.db
      .select()
      .from(profiles)
      .where(eq(profiles.handle, "contested"));
    expect(holders).toHaveLength(1);
  });

  it("serializes two overlapping changes by one user: one wins, the other hits the cooldown", async () => {
    // The FOR UPDATE lock is what makes the second call see the first one's
    // stamp. PGlite runs transactions one at a time anyway, so the real
    // interleaving is exercised on the CI Postgres (DATABASE_URL_TEST).
    await claim(userId, "first", T0);
    const results = await Promise.allSettled([
      claim(userId, "second", T0),
      claim(userId, "third", T0),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const loser = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(loser?.reason).toBeInstanceOf(HandleError);
    expect(loser?.reason).toMatchObject({
      code: "cooldown",
      retryAt: daysAfterT0(HANDLE_CHANGE_COOLDOWN_DAYS),
    });
    const winner = results.find((result) => result.status === "fulfilled");
    expect(await profileRow()).toMatchObject({
      handle: winner?.value.handle,
      handleChangedAt: T0,
    });
  });
});

describe("handle redirects (A6, §9)", () => {
  // Whichever way a sequence below ends, the invariant must hold afterwards.
  afterEach(expectNoRedirectToLiveHandle);

  it("the initial assignment writes no redirect row", async () => {
    await claim(userId, "first", T0);
    expect(await redirectRows()).toEqual([]);
  });

  it("a change writes the redirect row and the old address resolves to the new handle", async () => {
    await claimThenChange("first", "second");
    expect(await redirectRows()).toEqual([
      { oldHandle: "first", targetUserId: userId },
    ]);
    expect(await resolveHandle(testDb.db, "first")).toEqual({
      kind: "redirect",
      handle: "second",
    });
    expect(await resolveHandle(testDb.db, "second")).toEqual({
      kind: "profile",
      userId,
    });
  });

  it("a no-op leaves the redirect table alone and reports no previous handle", async () => {
    await claimThenChange("first", "second");
    await expect(
      claim(userId, "Second", daysAfterT0(2)),
    ).resolves.toEqual({ handle: "second", previousHandle: null });
    expect(await redirectRows()).toEqual([
      { oldHandle: "first", targetUserId: userId },
    ]);
  });

  it("a chain a → b → c resolves both old addresses to c without rewriting rows", async () => {
    await claim(userId, "chain-a", T0);
    await claim(userId, "chain-b", daysAfterT0(PAST_COOLDOWN));
    await setHandle(
      testDb.db,
      userId,
      "chain-c",
      daysAfterT0(2 * PAST_COOLDOWN),
    );
    expect(await redirectRows()).toEqual([
      { oldHandle: "chain-a", targetUserId: userId },
      { oldHandle: "chain-b", targetUserId: userId },
    ]);
    expect(await resolveHandle(testDb.db, "chain-a")).toEqual({
      kind: "redirect",
      handle: "chain-c",
    });
    expect(await resolveHandle(testDb.db, "chain-b")).toEqual({
      kind: "redirect",
      handle: "chain-c",
    });
  });

  it("another user claiming an old address deletes its redirect and takes it over", async () => {
    await claimThenChange("vacated", "moved-on");
    await expect(
      claim(otherUserId, "vacated", daysAfterT0(2)),
    ).resolves.toEqual({ handle: "vacated", previousHandle: null });
    expect(await redirectRows()).toEqual([]);
    expect(await resolveHandle(testDb.db, "vacated")).toEqual({
      kind: "profile",
      userId: otherUserId,
    });
  });

  it("moving back to your own old address deletes its row and redirects the one you leave", async () => {
    await claim(userId, "own-old", T0);
    await claim(userId, "own-new", daysAfterT0(PAST_COOLDOWN));
    await expect(
      claim(userId, "own-old", daysAfterT0(2 * PAST_COOLDOWN)),
    ).resolves.toEqual({ handle: "own-old", previousHandle: "own-new" });
    expect(await redirectRows()).toEqual([
      { oldHandle: "own-new", targetUserId: userId },
    ]);
    expect(await resolveHandle(testDb.db, "own-old")).toEqual({
      kind: "profile",
      userId,
    });
    expect(await resolveHandle(testDb.db, "own-new")).toEqual({
      kind: "redirect",
      handle: "own-old",
    });
  });

  it("a change refused as taken leaves both tables untouched", async () => {
    await claim(otherUserId, "held", T0);
    await claim(userId, "first", T0);
    await expect(
      claim(userId, "held", daysAfterT0(1)),
    ).rejects.toMatchObject({ code: "taken" });
    expect(await redirectRows()).toEqual([]);
    expect(await profileRow()).toMatchObject({
      handle: "first",
      handleChangedAt: null,
    });
  });

  it("claiming an address its holder is leaving at the same moment never leaves a redirect to a live handle", async () => {
    // Whichever order the two transactions commit in, the row for the
    // contested handle must not survive next to a profile holding it. As
    // above, the real interleaving runs on the CI Postgres; PGlite serializes.
    await claim(userId, "contested", T0);
    const [leaving, claiming] = await Promise.allSettled([
      claim(userId, "elsewhere", daysAfterT0(1)),
      claim(otherUserId, "contested", daysAfterT0(1)),
    ]);
    expect(leaving).toEqual({
      status: "fulfilled",
      value: { handle: "elsewhere", previousHandle: "contested" },
    });
    if (claiming.status === "fulfilled") {
      expect(await redirectRows()).toEqual([]);
      expect(await resolveHandle(testDb.db, "contested")).toEqual({
        kind: "profile",
        userId: otherUserId,
      });
    } else {
      expect(claiming.reason).toMatchObject({ code: "taken" });
      expect(await redirectRows()).toEqual([
        { oldHandle: "contested", targetUserId: userId },
      ]);
    }
  });
});

describe("resolveHandle (§9 order: profile → redirect → notFound)", () => {
  it("answers profile for a live handle, also on case-variant input", async () => {
    await claim(userId, "studio-x", T0);
    expect(await resolveHandle(testDb.db, "studio-x")).toEqual({
      kind: "profile",
      userId,
    });
    expect(await resolveHandle(testDb.db, " Studio-X ")).toEqual({
      kind: "profile",
      userId,
    });
  });

  it("normalizes the input before the redirect lookup too", async () => {
    await claimThenChange("old-name", "new-name");
    expect(await resolveHandle(testDb.db, "Old-Name")).toEqual({
      kind: "redirect",
      handle: "new-name",
    });
  });

  it("answers notFound for an unknown handle, a reserved word and invalid input", async () => {
    expect(await resolveHandle(testDb.db, "nobody-here")).toEqual({
      kind: "notFound",
    });
    expect(await resolveHandle(testDb.db, "admin")).toEqual({
      kind: "notFound",
    });
    expect(await resolveHandle(testDb.db, "-x-")).toEqual({ kind: "notFound" });
  });

  it("answers notFound for a redirect whose target no longer has a handle", async () => {
    await claimThenChange("gone-old", "gone-new");
    await testDb.db
      .update(profiles)
      .set({ handle: null })
      .where(eq(profiles.userId, userId));
    expect(await resolveHandle(testDb.db, "gone-old")).toEqual({
      kind: "notFound",
    });
  });
});

describe("notifyHandleChanged (A10)", () => {
  afterEach(() => {
    setEmailTransport(logTransport);
  });

  const params = {
    oldHandle: "old-studio",
    newHandle: "new-studio",
    profileUrl: "https://x.test/new-studio",
  };

  it.each(["pl", "en"] as const)(
    "delivers the rendered handleChanged message in %s to the user's address",
    async (locale) => {
      const { transport, delivered } = createMemoryTransport();
      setEmailTransport(transport);
      await notifyHandleChanged(testDb.db, { userId, locale, ...params });
      expect(delivered).toEqual([
        {
          to: "owner-local@example.com",
          ...renderEmail({ kind: "handleChanged", params }, locale),
        },
      ]);
      expect(delivered[0].body).toContain("https://x.test/new-studio");
    },
  );

  it("throws for an unknown user and delivers nothing", async () => {
    const { transport, delivered } = createMemoryTransport();
    setEmailTransport(transport);
    await expect(
      notifyHandleChanged(testDb.db, {
        userId: "00000000-0000-4000-8000-000000000000",
        locale: "pl",
        ...params,
      }),
    ).rejects.toThrow(/unknown user/);
    expect(delivered).toEqual([]);
  });
});

describe("getHandleState", () => {
  it("is empty for a fresh account", async () => {
    expect(await getHandleState(testDb.db, userId, T0)).toEqual({
      handle: null,
      changedAt: null,
      nextChangeAt: null,
    });
  });

  it("reports the cooldown after a change, and its release", async () => {
    await claim(userId, "first", T0);
    expect(await getHandleState(testDb.db, userId, T0)).toEqual({
      handle: "first",
      changedAt: null,
      nextChangeAt: null,
    });

    await claim(userId, "second", daysAfterT0(1));
    const release = daysAfterT0(1 + HANDLE_CHANGE_COOLDOWN_DAYS);
    expect(await getHandleState(testDb.db, userId, daysAfterT0(2))).toEqual({
      handle: "second",
      changedAt: daysAfterT0(1),
      nextChangeAt: release,
    });
    expect(await getHandleState(testDb.db, userId, release)).toEqual({
      handle: "second",
      changedAt: daysAfterT0(1),
      nextChangeAt: null,
    });
  });
});

describe("handleAvailability", () => {
  it("answers free, taken (case-insensitively), reserved and invalid", async () => {
    await claim(otherUserId, "taken-one", T0);
    expect(await handleAvailability(testDb.db, "Free-One")).toEqual({
      available: true,
    });
    expect(await handleAvailability(testDb.db, " TAKEN-one ")).toEqual({
      available: false,
      reason: "taken",
    });
    expect(await handleAvailability(testDb.db, "Login")).toEqual({
      available: false,
      reason: "reserved",
    });
    expect(await handleAvailability(testDb.db, "no spaces")).toEqual({
      available: false,
      reason: "invalid",
    });
  });
});

describe("suggestHandle (the onboarding proposal)", () => {
  it("derives the proposal from the display name, diacritics stripped", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Pracownia Żółć");
    expect(await suggestHandle(testDb.db, userId)).toBe("pracownia-zolc");
  });

  it("proposes the generic base for an account with no profile row yet", async () => {
    // users.name used to sit between the display name and the fallback,
    // carrying the e-mail local part — which is how an address reached the
    // proposed address (#36). That branch is gone (#40).
    expect(await suggestHandle(testDb.db, userId)).toBe(FALLBACK_BASE_VALUE);
  });

  it("proposes the generic base when the display name yields nothing usable", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Admin");
    expect(await suggestHandle(testDb.db, userId)).toBe(FALLBACK_BASE_VALUE);
  });

  it("falls back to 'studio' when neither name can be used", async () => {
    // A two-letter local part is below the A5 minimum, so nothing is left.
    const [{ id }] = await testDb.db
      .insert(users)
      .values({ name: "ab", email: "ab@example.com" })
      .returning({ id: users.id });
    await updateDisplayName({ db: testDb.db, userId: id }, "Admin");
    expect(await suggestHandle(testDb.db, id)).toBe("studio");
  });

  it("returns the current handle when one is set", async () => {
    await claim(userId, "chosen-already", T0);
    expect(await suggestHandle(testDb.db, userId)).toBe("chosen-already");
  });

  it("appends -2 when the base is taken", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Studio Praga");
    await claimedByOthers(["studio-praga"]);
    expect(await suggestHandle(testDb.db, userId)).toBe("studio-praga-2");
  });

  it("makes room for the tail inside the A5 length", async () => {
    const longest = "a".repeat(HANDLE_MAX);
    await updateDisplayName({ db: testDb.db, userId }, longest);
    await claimedByOthers([longest]);
    expect(await suggestHandle(testDb.db, userId)).toBe(
      `${"a".repeat(HANDLE_MAX - 2)}-2`,
    );
  });

  it("walks -2 … -9, then falls back to a free random 4-hex tail", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Studio Praga");
    await claimedByOthers([
      "studio-praga",
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `studio-praga-${n}`),
    ]);
    const suggestion = await suggestHandle(testDb.db, userId);
    expect(suggestion).toMatch(/^studio-praga-[0-9a-f]{4}$/);
    expect(await handleAvailability(testDb.db, suggestion)).toEqual({
      available: true,
    });
  });
});
