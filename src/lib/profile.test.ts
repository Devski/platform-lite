import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, profiles, users } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import { confirmAvatarUpload, presignAvatarUpload } from "./avatar";
import { getProfile, setAvatar, updateDisplayName } from "./profile";
import { createMemoryStorage } from "./storage";

// Integration suite for #14 on the memory fake + PGlite, driving the real #12
// pipeline where an avatar is needed — the issue's criterion end to end:
// set name + avatar -> profiles row updated, avatar (512) resolvable.

const PREFIX = "devski/";

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
  userId = await insertTestAccount(testDb.db, { email: "owner@example.com" });
  otherUserId = await insertTestAccount(testDb.db, {
    email: "other@example.com",
  });
});

function makeDeps(ownerId = userId) {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    deps: {
      db: testDb.db,
      storage: memory.storage,
      prefix: PREFIX,
      userId: ownerId,
    },
  };
}

async function uploadAvatar(
  d: ReturnType<typeof makeDeps>,
  seed: number,
  ownerId = userId,
) {
  const image = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: seed % 255, g: 120, b: 80 },
    },
  })
    .png()
    .toBuffer();
  const common = { ...d.deps, userId: ownerId };
  const { stagingKey } = await presignAvatarUpload(common, {
    sizeBytes: image.length,
    contentType: "image/png",
  });
  await d.deps.storage.putObject(stagingKey, image, "image/png");
  return confirmAvatarUpload(common, { stagingKey });
}

describe("updateDisplayName (A4)", () => {
  it("creates the profile row, trims, and updates in place", async () => {
    const d = makeDeps();
    await updateDisplayName(d.deps, "  Studio Praga  ");
    expect((await getProfile(d.deps)).displayName).toBe("Studio Praga");

    await updateDisplayName(d.deps, "Studio Wola");
    expect((await getProfile(d.deps)).displayName).toBe("Studio Wola");
    expect(await testDb.db.select().from(profiles)).toHaveLength(1);
  });

  it("rejects an empty and an over-80-character name at the edge", async () => {
    const d = makeDeps();
    await expect(updateDisplayName(d.deps, "   ")).rejects.toThrow();
    await expect(updateDisplayName(d.deps, "x".repeat(81))).rejects.toThrow();
    await expect(
      updateDisplayName(d.deps, "x".repeat(80)),
    ).resolves.toBeUndefined();
  });

  it("rejects control and invisible-format characters in the name", async () => {
    const d = makeDeps();
    // NUL would 500 at Postgres; a bidi override spoofs names once public.
    await expect(updateDisplayName(d.deps, "Studio\u0000X")).rejects.toThrow();
    await expect(updateDisplayName(d.deps, "Studio\u202EX")).rejects.toThrow();
    await expect(
      updateDisplayName(d.deps, "Pracownia Żółć & Sons"),
    ).resolves.toBeUndefined();
  });
});

describe("setAvatar + getProfile (A4, G2)", () => {
  // Anyone who can upload a photo is past onboarding: it needs a profile
  // row, and onboarding is what creates one. Set here rather than in the
  // shared fixture, because the tests above deliberately describe an
  // account that has not got there yet.
  beforeEach(async () => {
    await updateDisplayName({ db: testDb.db, userId }, "Pracownia Testowa");
    await updateDisplayName(
      { db: testDb.db, userId: otherUserId },
      "Inna Pracownia",
    );
  });

  it("attaches a photo to an account whose users.name is empty (#36)", async () => {
    // The exact sequence a real user takes now: finish onboarding (which sets
    // the display name), then upload a photo. Registration leaves users.name
    // empty since #36, and this upsert spelled it into the INSERT values —
    // PostgreSQL checks constraints on the tuple being inserted BEFORE ON
    // CONFLICT turns it into an update, so the not-blank CHECK fired on an
    // update that never touched the name. Every photo upload failed with
    // "something went wrong". Found by hand on dev, not here, because every
    // fixture account in this file still carries a name.
    await testDb.db.update(users).set({ name: "" }).where(eq(users.id, userId));
    await updateDisplayName({ db: testDb.db, userId }, "Pracownia Żółć");
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 1);

    await expect(
      setAvatar(d.deps, uploaded.original.fileId),
    ).resolves.toBeUndefined();
    const view = await getProfile(d.deps);
    expect(view.displayName).toBe("Pracownia Żółć");
    expect(view.avatar?.fileId).toBe(uploaded.original.fileId);
  });

  // #49: a PR preview shares dev's database and its bucket, and differs only
  // in S3_PREFIX. Rebuilding the address at read time made the same row point
  // at a different object per environment, so every avatar 404'd on a
  // preview. The row has to name the object the upload actually wrote.
  it("resolves to the object the upload wrote, from an environment with another prefix", async () => {
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 1);
    await setAvatar(d.deps, uploaded.original.fileId);

    const preview = { ...d.deps, prefix: "pr-49/" };
    const view = await getProfile(preview);

    expect(view.avatar?.url512).toBe(
      `memory://${PREFIX}a/${uploaded.original.sha256}-512.webp`,
    );
    expect(view.avatar?.url128).toBe(
      `memory://${PREFIX}a/${uploaded.original.sha256}-128.webp`,
    );
    // And the object really is there under that address, so this is not two
    // derivations agreeing with each other.
    expect(
      d.objects.has(`${PREFIX}a/${uploaded.original.sha256}-512.webp`),
    ).toBe(true);
  });

  it("wires the confirmed upload into the profile and resolves the variant URLs", async () => {
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 1);
    await setAvatar(d.deps, uploaded.original.fileId);

    const view = await getProfile(d.deps);
    // The name the account set in onboarding — no longer anything derived
    // from the e-mail address (#36).
    expect(view.displayName).toBe("Pracownia Testowa");
    expect(view.avatar?.fileId).toBe(uploaded.original.fileId);
    expect(view.avatar?.url512).toBe(
      `memory://${PREFIX}a/${uploaded.original.sha256}-512.webp`,
    );
    expect(view.avatar?.url128).toBe(
      `memory://${PREFIX}a/${uploaded.original.sha256}-128.webp`,
    );
  });

  it("refuses foreign, missing and non-original file ids", async () => {
    const d = makeDeps();
    const foreign = await uploadAvatar(d, 2, otherUserId);
    await expect(
      setAvatar(d.deps, foreign.original.fileId),
    ).rejects.toMatchObject({ code: "invalid_avatar" });

    const own = await uploadAvatar(d, 3);
    const [variantRow] = await testDb.db
      .select({ id: files.id })
      .from(files)
      .where(eq(files.kind, "avatar-512"));
    await expect(setAvatar(d.deps, variantRow.id)).rejects.toMatchObject({
      code: "invalid_avatar",
    });
    await expect(
      setAvatar(d.deps, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({ code: "invalid_avatar" });
    // The valid original still works after the refusals.
    await expect(
      setAvatar(d.deps, own.original.fileId),
    ).resolves.toBeUndefined();
  });

  it("replacing the avatar frees the old set's rows and objects", async () => {
    const d = makeDeps();
    const first = await uploadAvatar(d, 4);
    await setAvatar(d.deps, first.original.fileId);
    const second = await uploadAvatar(d, 5);
    await setAvatar(d.deps, second.original.fileId);

    // Only the second set's three rows remain (cascade took the variants).
    const rows = await testDb.db.select().from(files);
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.kind === "avatar-original")?.id).toBe(
      second.original.fileId,
    );

    // The first set's objects are gone; the second's remain.
    expect(d.objects.has(first.original.key)).toBe(false);
    expect(d.objects.has(`${PREFIX}a/${first.original.sha256}-512.webp`)).toBe(
      false,
    );
    expect(d.objects.has(second.original.key)).toBe(true);
  });

  // The other half of #49: cleanup deletes the objects this account's rows
  // name, not the ones the deleting environment would have named.
  it("deletes the objects the rows name, from an environment with another prefix", async () => {
    const d = makeDeps();
    const first = await uploadAvatar(d, 10);
    await setAvatar(d.deps, first.original.fileId);
    const second = await uploadAvatar(d, 11);

    // The replacement is made from a preview, which shares the database and
    // the bucket and differs only in its prefix.
    await setAvatar({ ...d.deps, prefix: "pr-49/" }, second.original.fileId);

    expect(d.objects.has(first.original.key)).toBe(false);
    expect(d.objects.has(`${PREFIX}a/${first.original.sha256}-512.webp`)).toBe(
      false,
    );
    expect(d.objects.has(`${PREFIX}a/${first.original.sha256}-128.webp`)).toBe(
      false,
    );
  });

  // Rows written before object_key existed carry none, and until
  // scripts/backfill-file-keys.ts has run in an environment they have to keep
  // working there — read from the environment that wrote them, which is the
  // only place the old derivation was ever right.
  it("falls back to the derived address for rows written before the column", async () => {
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 12);
    await setAvatar(d.deps, uploaded.original.fileId);
    await testDb.db.update(files).set({ objectKey: null });

    const view = await getProfile(d.deps);
    expect(view.avatar?.url512).toBe(
      `memory://${PREFIX}a/${uploaded.original.sha256}-512.webp`,
    );
  });

  it("keeps shared objects when another user's avatar has the same bytes", async () => {
    const d = makeDeps();
    // Identical pixels for both users -> identical content keys.
    const mine = await uploadAvatar(d, 6);
    const theirs = await uploadAvatar(d, 6, otherUserId);
    expect(theirs.original.key).toBe(mine.original.key);
    await setAvatar(d.deps, mine.original.fileId);

    const replacement = await uploadAvatar(d, 7);
    await setAvatar(d.deps, replacement.original.fileId);

    // My old rows are gone, but the shared objects survive for the other user.
    expect(d.objects.has(mine.original.key)).toBe(true);
    const remaining = await testDb.db.select().from(files);
    expect(remaining.filter((row) => row.userId === otherUserId)).toHaveLength(
      3,
    );
  });

  it("setting the same avatar again is a no-op", async () => {
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 8);
    await setAvatar(d.deps, uploaded.original.fileId);
    await setAvatar(d.deps, uploaded.original.fileId);
    expect(await testDb.db.select().from(files)).toHaveLength(3);
    expect((await getProfile(d.deps)).avatar?.fileId).toBe(
      uploaded.original.fileId,
    );
  });

  it("keeps byte-identical variants parented to their own originals", async () => {
    const d = makeDeps();
    // Same flat colour, different source dimensions: the square covers come
    // out byte-identical, but each set stores its own objects (variant keys
    // derive from each original's hash) — so each must keep its own rows.
    const image = (width: number, height: number) =>
      sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 9, g: 9, b: 9 },
        },
      })
        .png()
        .toBuffer();
    const stage = async (body: Buffer) => {
      const { stagingKey } = await presignAvatarUpload(d.deps, {
        sizeBytes: body.length,
        contentType: "image/png",
      });
      await d.deps.storage.putObject(stagingKey, body, "image/png");
      return confirmAvatarUpload(d.deps, { stagingKey });
    };
    const first = await stage(await image(600, 400));
    const second = await stage(await image(500, 500));

    const rows = await testDb.db.select().from(files);
    expect(rows).toHaveLength(6);
    const childrenOf = (id: string) =>
      rows.filter((row) => row.parentFileId === id);
    expect(childrenOf(first.original.fileId)).toHaveLength(2);
    expect(childrenOf(second.original.fileId)).toHaveLength(2);

    // Replacing the first set must not touch the second's rows or objects.
    await setAvatar(d.deps, first.original.fileId);
    await setAvatar(d.deps, second.original.fileId);
    const remaining = await testDb.db.select().from(files);
    expect(remaining).toHaveLength(3);
    expect(remaining.find((row) => row.kind === "avatar-original")?.id).toBe(
      second.original.fileId,
    );
    expect(d.objects.has(second.original.key)).toBe(true);
    expect(d.objects.has(`${PREFIX}a/${second.original.sha256}-512.webp`)).toBe(
      true,
    );
  });

  it("an account past onboarding but with no photo shows the name alone", async () => {
    const d = makeDeps();
    expect(await getProfile(d.deps)).toEqual({
      displayName: "Pracownia Testowa",
      avatar: null,
    });
  });
});
