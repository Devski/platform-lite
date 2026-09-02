import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { profiles, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { HANDLE_CHANGE_COOLDOWN_DAYS, HANDLE_MAX } from "./handle";
import { updateDisplayName } from "./profile";
import {
  getHandleState,
  HandleError,
  handleAvailability,
  setHandle,
  suggestHandle,
} from "./profile-handle";

// Integration suite for #15 on PGlite (the CI service container when
// DATABASE_URL_TEST is set): the database side of a handle — the claim, the
// A6 cooldown, availability, the onboarding proposal. The pure A5/A6 rules
// are proven in handle.test.ts; here they meet the committed migration (G6).

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-02T12:00:00Z");
const daysAfterT0 = (days: number) => new Date(T0.getTime() + days * DAY_MS);

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
  // users.name mirrors sign-up: seeded from the e-mail local part (#7).
  const rows = await testDb.db
    .insert(users)
    .values([
      { name: "owner-local", email: "owner-local@example.com" },
      { name: "other-local", email: "other-local@example.com" },
    ])
    .returning({ id: users.id });
  [userId, otherUserId] = rows.map((row) => row.id);
});

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

describe("setHandle (A5, A6)", () => {
  it("the initial assignment creates the profile row, seeded from users.name, unstamped", async () => {
    await expect(
      setHandle(testDb.db, userId, " Studio-Praga ", T0),
    ).resolves.toEqual({ handle: "studio-praga" });
    expect(await profileRow()).toMatchObject({
      handle: "studio-praga",
      displayName: "owner-local",
      handleChangedAt: null,
    });
  });

  it("keeps the display name when the profile row already exists", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Pracownia Żółć");
    await setHandle(testDb.db, userId, "zolc", T0);
    expect(await profileRow()).toMatchObject({
      handle: "zolc",
      displayName: "Pracownia Żółć",
      handleChangedAt: null,
    });
    expect(await testDb.db.select().from(profiles)).toHaveLength(1);
  });

  it("setting the same handle again is a no-op, whatever the case", async () => {
    await setHandle(testDb.db, userId, "studio-praga", T0);
    await expect(
      setHandle(testDb.db, userId, "STUDIO-PRAGA", daysAfterT0(1)),
    ).resolves.toEqual({ handle: "studio-praga" });
    // No change happened, so no cooldown started either.
    expect((await profileRow()).handleChangedAt).toBeNull();
  });

  it("refuses a case-variant duplicate of another user's handle as taken", async () => {
    await setHandle(testDb.db, otherUserId, "studio-x", T0);
    const rejection = await setHandle(testDb.db, userId, "Studio-X", T0).catch(
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(HandleError);
    expect(rejection).toMatchObject({ name: "HandleError", code: "taken" });
    expect(await profileRow()).toBeUndefined();
  });

  it("rejects reserved and invalid input before touching the database", async () => {
    await expect(setHandle(testDb.db, userId, "Admin")).rejects.toMatchObject({
      code: "reserved",
    });
    await expect(setHandle(testDb.db, userId, "-x-")).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(setHandle(testDb.db, userId, "ab")).rejects.toMatchObject({
      code: "invalid",
    });
    expect(await testDb.db.select().from(profiles)).toHaveLength(0);
  });

  it("allows the first change and stamps handle_changed_at", async () => {
    await setHandle(testDb.db, userId, "first", T0);
    await expect(
      setHandle(testDb.db, userId, "second", daysAfterT0(1)),
    ).resolves.toEqual({ handle: "second" });
    expect(await profileRow()).toMatchObject({
      handle: "second",
      handleChangedAt: daysAfterT0(1),
    });
  });

  it("blocks a second change inside 30 days and names the release moment", async () => {
    await setHandle(testDb.db, userId, "first", T0);
    await setHandle(testDb.db, userId, "second", daysAfterT0(1));
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
    await setHandle(testDb.db, userId, "first", T0);
    await setHandle(testDb.db, userId, "second", daysAfterT0(1));
    const released = daysAfterT0(1 + HANDLE_CHANGE_COOLDOWN_DAYS);
    await expect(
      setHandle(testDb.db, userId, "third", released),
    ).resolves.toEqual({ handle: "third" });
    expect(await profileRow()).toMatchObject({
      handle: "third",
      handleChangedAt: released,
    });
  });

  it("lets exactly one of two concurrent claims of the same handle win", async () => {
    const results = await Promise.allSettled([
      setHandle(testDb.db, userId, "contested", T0),
      setHandle(testDb.db, otherUserId, "contested", T0),
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
    await setHandle(testDb.db, userId, "first", T0);
    const results = await Promise.allSettled([
      setHandle(testDb.db, userId, "second", T0),
      setHandle(testDb.db, userId, "third", T0),
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
    const winner = results.find(
      (result): result is PromiseFulfilledResult<{ handle: string }> =>
        result.status === "fulfilled",
    );
    expect(await profileRow()).toMatchObject({
      handle: winner?.value.handle,
      handleChangedAt: T0,
    });
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
    await setHandle(testDb.db, userId, "first", T0);
    expect(await getHandleState(testDb.db, userId, T0)).toEqual({
      handle: "first",
      changedAt: null,
      nextChangeAt: null,
    });

    await setHandle(testDb.db, userId, "second", daysAfterT0(1));
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
    await setHandle(testDb.db, otherUserId, "taken-one", T0);
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

  it("falls back to users.name (the e-mail local part) without a profile row", async () => {
    expect(await suggestHandle(testDb.db, userId)).toBe("owner-local");
  });

  it("falls back to users.name when the display name yields nothing usable", async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Admin");
    expect(await suggestHandle(testDb.db, userId)).toBe("owner-local");
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
    await setHandle(testDb.db, userId, "chosen-already", T0);
    expect(await suggestHandle(testDb.db, userId)).toBe("chosen-already");
  });

  it("appends -2 when the base is taken", async () => {
    await claimedByOthers(["owner-local"]);
    expect(await suggestHandle(testDb.db, userId)).toBe("owner-local-2");
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
    await claimedByOthers([
      "owner-local",
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `owner-local-${n}`),
    ]);
    const suggestion = await suggestHandle(testDb.db, userId);
    expect(suggestion).toMatch(/^owner-local-[0-9a-f]{4}$/);
    expect(await handleAvailability(testDb.db, suggestion)).toEqual({
      available: true,
    });
  });
});
