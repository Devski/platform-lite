import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, files, profiles, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createAuth } from "@/lib/auth";
import {
  createMemoryTransport,
  logTransport,
  setEmailTransport,
} from "@/lib/email";
import { checkHandle, handleBaseFrom } from "@/lib/handle";
import { createMemoryStorage, type FileStorage } from "@/lib/storage";
import { listWorks } from "@/lib/works";
import {
  avatarPng,
  SEED_PASSWORD,
  SEED_PROFILES,
  seedProfiles,
} from "../../scripts/seed-profiles";

// Integration suite for #17 on PGlite + the memory storage fake. The seed
// must leave behind exactly what a user leaves behind by hand: a credential
// account the app's own auth signs in (proven through auth.handler, the
// surface production mounts — plus the account-row contract from
// auth.test.ts), a profile with a name and a handle, and an avatar set that
// went through the #12 pipeline — three files rows, objects under the
// prefix, the staging copy gone.

const BASE_URL = "http://localhost:3000";
const PREFIX = "devski/";
const HANDLES = SEED_PROFILES.map((profile) => profile.handle);
// #72: every second profile carries a generated cover — three more rows and
// objects per covered profile, on top of the avatar's three.
const COVERED = SEED_PROFILES.filter((profile) => profile.cover).map(
  (profile) => profile.handle,
);
// #72 / A12: and every work photo is a set of three rows too.
const rowsOf = (profile: (typeof SEED_PROFILES)[number]) =>
  3 +
  (profile.cover ? 3 : 0) +
  profile.works.reduce((total, work) => total + work.photos * 3, 0);
const IMAGE_ROWS = SEED_PROFILES.reduce(
  (total, profile) => total + rowsOf(profile),
  0,
);
const WITH_WORKS = SEED_PROFILES.filter(
  (profile) => profile.works.length > 0,
).map((profile) => profile.handle);
const withCover = (handle: string, ...added: string[]) =>
  `resumed  ${handle}  ${[
    ...added,
    ...(COVERED.includes(handle) ? ["cover"] : []),
    ...(WITH_WORKS.includes(handle) ? ["works"] : []),
  ].join(", ")} added`;
const SCRYPT_HASH_RE = /^[0-9a-f]+:[0-9a-f]+$/;

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

async function run(storage: FileStorage | null) {
  const lines: string[] = [];
  const summary = await seedProfiles({
    db: testDb.db,
    storage,
    prefix: PREFIX,
    log: (line) => {
      lines.push(line);
    },
  });
  return { summary, lines };
}

async function rowCounts() {
  return {
    users: (await testDb.db.select().from(users)).length,
    accounts: (await testDb.db.select().from(accounts)).length,
    profiles: (await testDb.db.select().from(profiles)).length,
    files: (await testDb.db.select().from(files)).length,
  };
}

describe("SEED_PROFILES (the data)", () => {
  it("has 14 entries whose handles are the slugs of their names, valid (A5) and unique", () => {
    expect(SEED_PROFILES).toHaveLength(14);
    for (const profile of SEED_PROFILES) {
      expect(profile.handle).toBe(handleBaseFrom(profile.displayName));
      expect(checkHandle(profile.handle)).toBeNull();
      expect(profile.email).toBe(`${profile.handle}@seed.example`);
    }
    expect(new Set(HANDLES).size).toBe(SEED_PROFILES.length);
  });

  it("gives every profile the A12 sections within their limits, and varies them (#72)", () => {
    for (const profile of SEED_PROFILES) {
      expect(profile.headline.length).toBeGreaterThan(0);
      expect(profile.headline.length).toBeLessThanOrEqual(220);
      expect(profile.bio.length).toBeGreaterThan(0);
      expect(profile.bio.length).toBeLessThanOrEqual(1500);
      expect(profile.locations.length).toBeGreaterThanOrEqual(1);
      expect(profile.locations.length).toBeLessThanOrEqual(8);
    }
    // Lived-in, not stamped: single- and multi-place profiles, one- and
    // two-paragraph bios, and at least one place off the TERYT list.
    const placeCounts = new Set(SEED_PROFILES.map((p) => p.locations.length));
    expect(placeCounts.size).toBeGreaterThanOrEqual(3);
    expect(SEED_PROFILES.some((p) => p.bio.includes("\n\n"))).toBe(true);
    expect(SEED_PROFILES.some((p) => !p.bio.includes("\n"))).toBe(true);
    expect(SEED_PROFILES.some((p) => p.locations.includes("cała Polska"))).toBe(
      true,
    );
    expect(COVERED.length).toBeGreaterThan(0);
    expect(COVERED.length).toBeLessThan(SEED_PROFILES.length);
  });

  it("exercises the diacritic folding of handleBaseFrom", () => {
    // At least a few names carry Polish letters, so a slug regression in
    // handle.ts shows up here as well as in handle.test.ts.
    const withDiacritics = SEED_PROFILES.filter((profile) =>
      /[ąćęłńóśźż]/i.test(profile.displayName),
    );
    expect(withDiacritics.length).toBeGreaterThanOrEqual(3);
  });
});

describe("avatarPng", () => {
  it("yields a 512×512 PNG that sharp decodes, the same bytes for the same name", async () => {
    const png = await avatarPng("Pracownia Żółć");
    const { format, width, height } = await sharp(png).metadata();
    expect({ format, width, height }).toEqual({
      format: "png",
      width: 512,
      height: 512,
    });
    expect((await avatarPng("Pracownia Żółć")).equals(png)).toBe(true);
    expect((await avatarPng("Studio Praga")).equals(png)).toBe(false);
  });
});

describe("seedProfiles", () => {
  it("creates 14 verified accounts with names, handles and avatar sets through the real layers", async () => {
    const memory = createMemoryStorage();
    const { summary, lines } = await run(memory.storage);
    expect(summary).toEqual({
      created: HANDLES,
      skipped: [],
      photos: HANDLES,
    });
    expect(lines).toHaveLength(SEED_PROFILES.length);

    const userRows = await testDb.db.select().from(users);
    expect(userRows).toHaveLength(14);
    const profileRows = await testDb.db.select().from(profiles);
    expect(profileRows).toHaveLength(14);
    const fileRows = await testDb.db.select().from(files);
    expect(fileRows).toHaveLength(IMAGE_ROWS);

    for (const seed of SEED_PROFILES) {
      const user = userRows.find((row) => row.email === seed.email);
      expect(user, seed.email).toBeDefined();
      // register-form.tsx seeds Better Auth's required name from the local
      // part; the display identity is the profile's.
      expect(user!.name).toBe(seed.handle);
      expect(user!.emailVerified).toBe(true);

      const profile = profileRows.find((row) => row.userId === user!.id);
      expect(profile?.displayName).toBe(seed.displayName);
      expect(profile?.handle).toBe(seed.handle);
      // An initial assignment, not a change: the A6 cooldown stays unarmed.
      expect(profile?.handleChangedAt).toBeNull();
      // #72: the sections, written through updateProfileSections.
      expect(profile?.headline).toBe(seed.headline);
      expect(profile?.locations).toEqual(seed.locations);
      expect(profile?.bio).toBe(seed.bio);
      const own = fileRows.filter((row) => row.userId === user!.id);
      const photoSets = seed.works.reduce(
        (total, work) => total + work.photos,
        0,
      );
      expect(own.map((row) => row.kind).sort()).toEqual(
        [
          "avatar-128",
          "avatar-512",
          "avatar-original",
          ...(seed.cover ? ["cover-1600", "cover-480", "cover-original"] : []),
          ...Array(photoSets).fill("work-1600"),
          ...Array(photoSets).fill("work-480"),
          ...Array(photoSets).fill("work-original"),
        ].sort(),
      );
      // #72: the works, through createWork, photos in the given number
      // with the first as main.
      const ownWorks = await listWorks({
        db: testDb.db,
        storage: memory.storage,
        prefix: PREFIX,
        userId: user!.id,
      });
      expect(ownWorks.map((work) => [work.name, work.images.length])).toEqual(
        seed.works.map((work) => [work.name, work.photos]),
      );
      // #72: the cover, for the profiles that get one, through setCover.
      if (seed.cover) {
        const cover = own.find((row) => row.kind === "cover-original")!;
        expect(profile?.coverFileId).toBe(cover.id);
        expect(
          memory.objects.has(
            `${PREFIX}u/${user!.id}/${cover.sha256}-1600.webp`,
          ),
        ).toBe(true);
      } else {
        expect(profile?.coverFileId).toBeNull();
      }
      const original = own.find((row) => row.kind === "avatar-original")!;
      expect(original.ext).toBe("png");
      expect(profile?.avatarFileId).toBe(original.id);
      // The published objects, named by the original's hash (G2).
      expect(
        memory.objects.has(`${PREFIX}u/${user!.id}/${original.sha256}.png`),
      ).toBe(true);
      expect(
        memory.objects.has(
          `${PREFIX}u/${user!.id}/${original.sha256}-512.webp`,
        ),
      ).toBe(true);
      expect(
        memory.objects.has(
          `${PREFIX}u/${user!.id}/${original.sha256}-128.webp`,
        ),
      ).toBe(true);
    }

    // Nothing but the 42 published objects: every staging copy was removed
    // by the pipeline, and nothing was written outside the prefix.
    expect(memory.objects.size).toBe(IMAGE_ROWS);
    for (const key of memory.objects.keys()) {
      expect(key.startsWith(`${PREFIX}u/`)).toBe(true);
    }
  }, 60_000);

  it("stores a scrypt hash of SEED_PASSWORD in an account shaped like a 1.7.2 sign-up", async () => {
    await run(null);
    const accountRows = await testDb.db.select().from(accounts);
    expect(accountRows).toHaveLength(14);
    for (const account of accountRows) {
      expect(account.providerId).toBe("credential");
      expect(account.issuer).toBe("local:credential");
      expect(account.accountId).toBe(account.userId);
      expect(account.password).toMatch(SCRYPT_HASH_RE);
      expect(account.password).not.toContain(SEED_PASSWORD);
      expect(
        await verifyPassword({
          hash: account.password!,
          password: SEED_PASSWORD,
        }),
      ).toBe(true);
    }
  }, 30_000);

  it("signs a seed account in through the app's own auth with SEED_PASSWORD", async () => {
    await run(null);
    // The request shape of auth.test.ts: a JSON POST to the handler with an
    // origin and a client IP for the rate limiter. A silent transport in case
    // anything mails — a plain sign-in of a verified account sends nothing.
    const auth = createAuth({
      db: testDb.db,
      baseURL: BASE_URL,
      secret: "seed-test-secret",
    });
    const mail = createMemoryTransport();
    setEmailTransport(mail.transport);
    try {
      const response = await auth.handler(
        new Request(`${BASE_URL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: BASE_URL,
            "x-forwarded-for": "198.51.100.250",
          },
          body: JSON.stringify({
            email: SEED_PROFILES[0].email,
            password: SEED_PASSWORD,
          }),
        }),
      );
      expect(response.status).toBe(200);
      const sessionCookie = response.headers
        .getSetCookie()
        .find((line) => line.split("=")[0].endsWith("session_token"));
      expect(sessionCookie).toBeDefined();
      expect(mail.delivered).toHaveLength(0);
    } finally {
      setEmailTransport(logTransport);
    }
  }, 30_000);

  it("is idempotent: a second run skips every profile and adds no rows or objects", async () => {
    const memory = createMemoryStorage();
    await run(memory.storage);
    const before = await rowCounts();

    const { summary: second } = await run(memory.storage);
    expect(second).toEqual({ created: [], skipped: HANDLES, photos: [] });
    expect(await rowCounts()).toEqual(before);
    expect(memory.objects.size).toBe(IMAGE_ROWS);
  }, 60_000);

  it("resumes photos: a run with storage after one without adds every missing photo, once", async () => {
    await run(null);
    const memory = createMemoryStorage();

    const { summary: second, lines } = await run(memory.storage);
    expect(second).toEqual({ created: [], skipped: [], photos: HANDLES });
    expect(lines).toEqual(HANDLES.map((handle) => withCover(handle, "photo")));
    expect(await rowCounts()).toEqual({
      users: 14,
      accounts: 14,
      profiles: 14,
      files: IMAGE_ROWS,
    });
    expect(memory.objects.size).toBe(IMAGE_ROWS);
    const profileRows = await testDb.db.select().from(profiles);
    expect(profileRows.every((row) => row.avatarFileId !== null)).toBe(true);
    expect(
      profileRows
        .filter((row) => row.coverFileId !== null)
        .map((row) => row.handle)
        .sort(),
    ).toEqual([...COVERED].sort());

    // Every profile has one now: nothing left to add.
    const { summary: third } = await run(memory.storage);
    expect(third).toEqual({ created: [], skipped: HANDLES, photos: [] });
    expect(memory.objects.size).toBe(IMAGE_ROWS);
  }, 90_000);

  it("resumes sections: accounts seeded before #72 get headline, places and bio on the next run", async () => {
    await run(null);
    // What dev holds today: the fourteen accounts from 05.09, no sections.
    await testDb.db
      .update(profiles)
      .set({ headline: null, locations: [], bio: null });

    const { summary, lines } = await run(null);
    expect(summary).toEqual({ created: [], skipped: [], photos: [] });
    expect(lines).toEqual(
      HANDLES.map((handle) => `resumed  ${handle}  sections added`),
    );
    const profileRows = await testDb.db.select().from(profiles);
    for (const seed of SEED_PROFILES) {
      const row = profileRows.find((r) => r.handle === seed.handle);
      expect(row?.headline).toBe(seed.headline);
      expect(row?.locations).toEqual(seed.locations);
      expect(row?.bio).toBe(seed.bio);
    }
    expect(await rowCounts()).toEqual({
      users: 14,
      accounts: 14,
      profiles: 14,
      files: 0,
    });

    // Both missing at once — the pre-#72 dev state seen with a storage —
    // are added in one visit.
    await testDb.db.update(profiles).set({ headline: null });
    const memory = createMemoryStorage();
    const { summary: third, lines: thirdLines } = await run(memory.storage);
    expect(third).toEqual({ created: [], skipped: [], photos: HANDLES });
    expect(thirdLines).toEqual(
      HANDLES.map((handle) => withCover(handle, "sections", "photo")),
    );
    // Nothing left: the next run skips everything.
    expect((await run(memory.storage)).summary).toEqual({
      created: [],
      skipped: HANDLES,
      photos: [],
    });
  }, 90_000);

  it("leaves a real user's account on a seed address alone: skipped, no photo", async () => {
    const [first, ...rest] = SEED_PROFILES;
    const [stranger] = await testDb.db
      .insert(users)
      .values({ name: "stranger", email: first.email })
      .returning({ id: users.id });
    // A different handle marks the account as not ours, avatar or no avatar.
    await testDb.db.insert(profiles).values({
      userId: stranger.id,
      displayName: "Someone Else",
      handle: "someone-else",
    });

    const memory = createMemoryStorage();
    const { summary, lines } = await run(memory.storage);
    const restHandles = rest.map((profile) => profile.handle);
    expect(summary).toEqual({
      created: restHandles,
      skipped: [first.handle],
      photos: restHandles,
    });
    expect(lines[0]).toBe(`skipped  ${first.handle}  (e-mail exists)`);
    const strangerFiles = (await testDb.db.select().from(files)).filter(
      (row) => row.userId === stranger.id,
    );
    expect(strangerFiles).toHaveLength(0);
  }, 60_000);

  it("without storage it seeds accounts, names and handles but no photos", async () => {
    const { summary } = await run(null);
    expect(summary).toEqual({ created: HANDLES, skipped: [], photos: [] });

    const profileRows = await testDb.db.select().from(profiles);
    expect(profileRows).toHaveLength(14);
    expect(profileRows.every((row) => row.avatarFileId === null)).toBe(true);
    expect(profileRows.map((row) => row.handle).sort()).toEqual(
      [...HANDLES].sort(),
    );
    expect(await testDb.db.select().from(files)).toHaveLength(0);
  }, 30_000);

  it("skips a profile whose handle is already held by someone else, leaving no trace of it", async () => {
    const [holder] = await testDb.db
      .insert(users)
      .values({ name: "holder", email: "holder@example.com" })
      .returning({ id: users.id });
    const [first, ...rest] = SEED_PROFILES;
    await testDb.db.insert(profiles).values({
      userId: holder.id,
      displayName: "The Holder",
      handle: first.handle,
    });

    const memory = createMemoryStorage();
    const { summary } = await run(memory.storage);
    const restHandles = rest.map((profile) => profile.handle);
    expect(summary).toEqual({
      created: restHandles,
      skipped: [first.handle],
      photos: restHandles,
    });

    // The skipped profile's account was rolled back with its handle claim —
    // a rerun after the holder frees the handle can still create it.
    const ghost = await testDb.db
      .select()
      .from(users)
      .where(eq(users.email, first.email));
    expect(ghost).toHaveLength(0);
    expect(await rowCounts()).toEqual({
      users: 14,
      accounts: 13,
      profiles: 14,
      // The skipped profile leaves neither its avatar set nor its cover
      // nor its works' photos.
      files: IMAGE_ROWS - rowsOf(first),
    });
  }, 60_000);
});
