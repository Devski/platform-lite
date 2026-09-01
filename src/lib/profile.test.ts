import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, profiles, users } from "@/db/schema";
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
  const rows = await testDb.db
    .insert(users)
    .values([
      { name: "owner-local", email: "owner@example.com" },
      { name: "other-local", email: "other@example.com" },
    ])
    .returning({ id: users.id });
  [userId, otherUserId] = rows.map((row) => row.id);
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
});

describe("setAvatar + getProfile (A4, G2)", () => {
  it("wires the confirmed upload into the profile and resolves the variant URLs", async () => {
    const d = makeDeps();
    const uploaded = await uploadAvatar(d, 1);
    await setAvatar(d.deps, uploaded.original.fileId);

    const view = await getProfile(d.deps);
    // Display identity defaults to users.name until a name is set.
    expect(view.displayName).toBe("owner-local");
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
      .where(eqKind("avatar-512"));
    await expect(setAvatar(d.deps, variantRow.id)).rejects.toMatchObject({
      code: "invalid_avatar",
    });
    await expect(
      setAvatar(d.deps, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({ code: "invalid_avatar" });
    // The valid original still works after the refusals.
    await expect(setAvatar(d.deps, own.original.fileId)).resolves.toBeUndefined();
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
    expect(
      rows.find((row) => row.kind === "avatar-original")?.id,
    ).toBe(second.original.fileId);

    // The first set's objects are gone; the second's remain.
    expect(d.objects.has(first.original.key)).toBe(false);
    expect(
      d.objects.has(`${PREFIX}a/${first.original.sha256}-512.webp`),
    ).toBe(false);
    expect(d.objects.has(second.original.key)).toBe(true);
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
    expect(
      remaining.filter((row) => row.userId === otherUserId),
    ).toHaveLength(3);
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

  it("a fresh account has an empty profile view", async () => {
    const d = makeDeps();
    expect(await getProfile(d.deps)).toEqual({
      displayName: null,
      avatar: null,
    });
  });
});

function eqKind(kind: "avatar-512" | "avatar-128" | "avatar-original") {
  return eq(files.kind, kind);
}