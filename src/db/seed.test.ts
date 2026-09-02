import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, files, profiles, users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { checkHandle, handleBaseFrom } from "@/lib/handle";
import { createMemoryStorage, type FileStorage } from "@/lib/storage";
import {
  avatarPng,
  SEED_PASSWORD,
  SEED_PROFILES,
  seedProfiles,
} from "../../scripts/seed-profiles";

// Integration suite for #17 on PGlite + the memory storage fake. The seed
// must leave behind exactly what a user leaves behind by hand: a credential
// account Better Auth can sign in (the account-row contract from
// auth.test.ts), a profile with a name and a handle, and an avatar set that
// went through the #12 pipeline — three files rows, objects under the
// prefix, the staging copy gone.

const PREFIX = "devski/";
const HANDLES = SEED_PROFILES.map((profile) => profile.handle);
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

function run(storage: FileStorage | null) {
  const lines: string[] = [];
  const summary = seedProfiles({
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
    const { summary, lines } = run(memory.storage);
    expect(await summary).toEqual({
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
    expect(fileRows).toHaveLength(14 * 3);

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

      const own = fileRows.filter((row) => row.userId === user!.id);
      expect(own.map((row) => row.kind).sort()).toEqual([
        "avatar-128",
        "avatar-512",
        "avatar-original",
      ]);
      const original = own.find((row) => row.kind === "avatar-original")!;
      expect(original.ext).toBe("png");
      expect(profile?.avatarFileId).toBe(original.id);
      // The published objects, named by the original's hash (G2).
      expect(memory.objects.has(`${PREFIX}a/${original.sha256}.png`)).toBe(
        true,
      );
      expect(memory.objects.has(`${PREFIX}a/${original.sha256}-512.webp`)).toBe(
        true,
      );
      expect(memory.objects.has(`${PREFIX}a/${original.sha256}-128.webp`)).toBe(
        true,
      );
    }

    // Nothing but the 42 published objects: every staging copy was removed
    // by the pipeline, and nothing was written outside the prefix.
    expect(memory.objects.size).toBe(14 * 3);
    for (const key of memory.objects.keys()) {
      expect(key.startsWith(`${PREFIX}a/`)).toBe(true);
    }
  }, 60_000);

  it("stores a scrypt hash of SEED_PASSWORD in an account shaped like a 1.7.2 sign-up", async () => {
    await run(null).summary;
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

  it("is idempotent: a second run skips every profile and adds no rows or objects", async () => {
    const memory = createMemoryStorage();
    await run(memory.storage).summary;
    const before = await rowCounts();

    const second = await run(memory.storage).summary;
    expect(second).toEqual({ created: [], skipped: HANDLES, photos: [] });
    expect(await rowCounts()).toEqual(before);
    expect(memory.objects.size).toBe(14 * 3);
  }, 60_000);

  it("without storage it seeds accounts, names and handles but no photos", async () => {
    const summary = await run(null).summary;
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
    const summary = await run(memory.storage).summary;
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
      files: 13 * 3,
    });
  }, 60_000);
});
