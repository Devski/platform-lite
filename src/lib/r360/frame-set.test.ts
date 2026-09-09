import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, pendingUploads, works } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import { sweepExpiredUploads } from "@/lib/image-upload";
import { QUOTA_BYTES, quotaUsageBytes } from "@/lib/quota";
import { createMemoryStorage, ObjectNotFoundError } from "@/lib/storage";
import { updateDisplayName } from "@/lib/profile";
import { uploadTestArchive, uploadTestPhoto } from "@/lib/test-uploads";
import { createWork, deleteWork, listWorks, updateWork } from "@/lib/works";
import sharp from "sharp";
import {
  CopyFailed,
  copyFrameSet,
  FrameSetError,
  frameSetReservationSeconds,
  isStagingGone,
  frameSetUrlSeconds,
  isWebpHeader,
  presignFrameSet,
  verifyFrameSet,
} from "./frame-set";
import { imageWidthOf } from "./browser-frame-encoder";
import { escapeLike } from "@/lib/image-upload";
import {
  defaultR360Params,
  frameKey,
  frameSetBytesCeiling,
  frameSetPrefix,
  frameSlots,
  R360_FRAME_MAX_BYTES,
  r360ParamsSchema,
} from "./frame-set-shared";

// #102: the server's half of the frame pipeline on PGlite + the memory
// storage fake — the batch presign and its reservation, what the save
// verifies before copying, the rows it writes, and what replacing or
// deleting frees. The browser's half is frame-pipeline.test.ts.

const PREFIX = "devski/";

let testDb: TestDb;
let userId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  userId = await insertTestAccount(testDb.db, { email: "r360@example.com" });
  await updateDisplayName({ db: testDb.db, userId }, "Pracownia R360");
});

function makeDeps() {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    deps: { db: testDb.db, storage: memory.storage, prefix: PREFIX, userId },
  };
}

/** A small photo: the tests here are about the frames, not the variants. */
const uploadPhoto = (d: ReturnType<typeof makeDeps>) =>
  uploadTestPhoto(d.deps, { seed: 68, width: 40, height: 30 });

const uploadArchive = (d: ReturnType<typeof makeDeps>, seed: string) =>
  uploadTestArchive(d.deps, seed);

/** A WebP of the given width, as the browser would encode a frame. */
async function webp(width: number, seed: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height: Math.round(width * 0.6),
      channels: 3,
      background: { r: seed * 20, g: 90, b: 140 },
    },
  })
    .webp({ quality: 60 })
    .toBuffer();
}

/** Presigns a set and PUTs 2N frames under it, as the browser does. */
async function stageSet(
  d: ReturnType<typeof makeDeps>,
  frameCount: number,
  options: { skip?: string; oversize?: string; notWebp?: string } = {},
) {
  const set = await presignFrameSet(d.deps, { frameCount });
  for (const { width, ordinal } of frameSlots(frameCount)) {
    const short = `${width}/${ordinal}`;
    if (options.skip === short) continue;
    let body = await webp(width === 1600 ? 64 : 32, ordinal);
    if (options.oversize === short) {
      body = Buffer.alloc(R360_FRAME_MAX_BYTES[width] + 1, 1);
    }
    if (options.notWebp === short) body = Buffer.from("not a webp at all");
    await d.deps.storage.putObject(
      frameKey(set.stagingPrefix, width, ordinal),
      body,
      "image/webp",
    );
  }
  return set;
}

describe("presignFrameSet", () => {
  it("mints a set, reserves the ceilings, and answers 2N URLs for a window that grows with N", async () => {
    const d = makeDeps();
    const set = await presignFrameSet(d.deps, { frameCount: 3 });
    expect(set.setId).toMatch(/^[0-9a-f]{32}$/);
    expect(set.stagingPrefix).toBe(`${PREFIX}staging/${userId}/${set.setId}/`);
    expect(set.urls[1600]).toHaveLength(3);
    expect(set.urls[800]).toHaveLength(3);
    expect(set.urls[1600][2]).toContain(
      `${set.stagingPrefix}1600/003.webp?maxBytes=any`,
    );
    const [reservation] = await testDb.db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.userId, userId));
    expect(reservation.stagingKey).toBe(set.stagingPrefix);
    expect(reservation.sizeBytes).toBe(frameSetBytesCeiling(3));
    expect(await quotaUsageBytes(testDb.db, userId)).toBe(
      frameSetBytesCeiling(3),
    );
    // A session, not a transfer: two hours plus five seconds a frame for
    // the URLs, and a grace on the reservation past them.
    expect(frameSetUrlSeconds(120)).toBe(7800);
    expect(frameSetReservationSeconds(120)).toBe(8100);
  });

  it("refuses a set the quota cannot hold, and refuses a count outside 2..360", async () => {
    const d = makeDeps();
    // 360 frames at the ceilings is under half a gibibyte, far from the
    // quota; a stored file leaves room for exactly two such sets.
    await testDb.db.insert(files).values({
      userId,
      sha256: "hash-filler",
      sizeBytes: QUOTA_BYTES - frameSetBytesCeiling(360) * 2,
      kind: "avatar-original",
      ext: "png",
    });
    await presignFrameSet(d.deps, { frameCount: 360 });
    await presignFrameSet(d.deps, { frameCount: 360 });
    await expect(
      presignFrameSet(d.deps, { frameCount: 360 }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    await expect(presignFrameSet(d.deps, { frameCount: 1 })).rejects.toThrow();
    await expect(
      presignFrameSet(d.deps, { frameCount: 361 }),
    ).rejects.toThrow();
  });

  it("sweeps an expired set's staged frames on the next presign, as one prefix (#30)", async () => {
    const d = makeDeps();
    const stale = await stageSet(d, 2);
    await testDb.db
      .update(pendingUploads)
      .set({
        createdAt: sql`now() - interval '2 minutes'`,
        expiresAt: sql`now() - interval '1 minute'`,
      })
      .where(eq(pendingUploads.stagingKey, stale.stagingPrefix));
    expect(await d.deps.storage.listObjects(stale.stagingPrefix)).toHaveLength(
      4,
    );
    await sweepExpiredUploads(d.deps);
    expect(await d.deps.storage.listObjects(stale.stagingPrefix)).toHaveLength(
      0,
    );
    expect(
      await testDb.db
        .select()
        .from(pendingUploads)
        .where(eq(pendingUploads.stagingKey, stale.stagingPrefix)),
    ).toHaveLength(0);
  });
});

describe("verifyFrameSet", () => {
  it("accepts exactly 2N frames under their names, sizes and headers", async () => {
    const d = makeDeps();
    const set = await stageSet(d, 3);
    const verified = await verifyFrameSet(d.deps, {
      setId: set.setId,
      frameCount: 3,
    });
    expect(verified.frames).toHaveLength(6);
    expect(verified.frames[0]).toMatchObject({
      width: 1600,
      ordinal: 1,
      stagingKey: `${set.stagingPrefix}1600/001.webp`,
      finalKey: `${PREFIX}u/${userId}/r360/${set.setId}/1600/001.webp`,
    });
    expect(verified.frames[0].etag).toMatch(/^[0-9a-f]{32}$/);
    expect(verified.totalBytes).toBeGreaterThan(0);
  });

  const refusal = async (
    run: () => Promise<unknown>,
  ): Promise<string | undefined> => {
    try {
      await run();
    } catch (error) {
      if (error instanceof FrameSetError) return error.code;
      throw error;
    }
    return undefined;
  };

  it("refuses a set that is not the caller's, a missing frame, a wrong count, an oversized frame and a non-WebP", async () => {
    const d = makeDeps();
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: "not-a-set", frameCount: 3 }),
      ),
    ).toBe("invalid_set");
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: "a".repeat(32), frameCount: 3 }),
      ),
    ).toBe("invalid_set");
    const complete = await stageSet(d, 3);
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: complete.setId, frameCount: 4 }),
      ),
    ).toBe("incomplete_set");
    const missing = await stageSet(d, 3, { skip: "800/2" });
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: missing.setId, frameCount: 3 }),
      ),
    ).toBe("incomplete_set");
    const fat = await stageSet(d, 3, { oversize: "800/3" });
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: fat.setId, frameCount: 3 }),
      ),
    ).toBe("frame_too_large");
    const fake = await stageSet(d, 3, { notWebp: "1600/2" });
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: fake.setId, frameCount: 3 }),
      ),
    ).toBe("not_webp");
    // A frame renamed to .webp on a non-sampled ordinal: every frame's
    // header is read, and a refusal on the bytes clears the staging.
    const renamed = await stageSet(d, 4, { notWebp: "800/3" });
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: renamed.setId, frameCount: 4 }),
      ),
    ).toBe("not_webp");
    expect(
      await d.deps.storage.listObjects(renamed.stagingPrefix),
    ).toHaveLength(0);
    // A reservation that ran out: the frames may be swept any moment.
    const stale = await stageSet(d, 2);
    await testDb.db
      .update(pendingUploads)
      .set({
        createdAt: sql`now() - interval '2 minutes'`,
        expiresAt: sql`now() - interval '1 minute'`,
      })
      .where(eq(pendingUploads.stagingKey, stale.stagingPrefix));
    expect(
      await refusal(() =>
        verifyFrameSet(d.deps, { setId: stale.setId, frameCount: 2 }),
      ),
    ).toBe("set_expired");
    // Another user's set under the same id: the reservation is theirs.
    const other = await insertTestAccount(testDb.db, {
      email: "other-r360@example.com",
    });
    expect(
      await refusal(() =>
        verifyFrameSet(
          { ...d.deps, userId: other },
          { setId: complete.setId, frameCount: 3 },
        ),
      ),
    ).toBe("invalid_set");
  });

  it("reads WebP headers by their RIFF container: signature, size field, first chunk", async () => {
    const real = await webp(64, 1);
    expect(isWebpHeader(real.subarray(0, 16), real.length)).toBe(true);
    expect(isWebpHeader(real.subarray(0, 16), real.length + 1)).toBe(false);
    expect(isWebpHeader(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(isWebpHeader(Buffer.from("RIFF\0\0\0\0WEBPJUNK"))).toBe(false);
    expect(isWebpHeader(Buffer.from("RIFF\0\0\0\0WAVE"))).toBe(false);
    expect(isWebpHeader(Buffer.from("\x89PNG"))).toBe(false);
  });

  it("reads a frame's width from its header — PNG, JPEG, WebP — for the decode hint", async () => {
    const picture = sharp({
      create: { width: 123, height: 45, channels: 3, background: "#123456" },
    });
    expect(imageWidthOf(await picture.clone().png().toBuffer())).toBe(123);
    expect(imageWidthOf(await picture.clone().jpeg().toBuffer())).toBe(123);
    expect(imageWidthOf(await picture.clone().webp().toBuffer())).toBe(123);
    expect(
      imageWidthOf(await picture.clone().webp({ lossless: true }).toBuffer()),
    ).toBe(123);
    expect(imageWidthOf(Buffer.from("not a picture"))).toBeNull();
  });

  it("escapes LIKE wildcards in a prefix", () => {
    expect(escapeLike("pr_7/u/x%")).toBe("pr\\_7/u/x\\%");
  });
});

describe("a frame set on a work", () => {
  it("saves the set: the frames copied public under the final keys, a row each, the reservation settled, staging cleared", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const archive = await uploadArchive(d, "one");
    const set = await stageSet(d, 3);
    const params = defaultR360Params(3);
    const { id } = await createWork(d.deps, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
      r360FileId: archive.fileId,
      r360SetId: set.setId,
      r360Params: params,
    });
    const finalPrefix = frameSetPrefix(PREFIX, userId, set.setId);
    const published = await d.deps.storage.listObjects(finalPrefix);
    expect(published.map((o) => o.key.slice(finalPrefix.length))).toEqual([
      "1600/001.webp",
      "1600/002.webp",
      "1600/003.webp",
      "800/001.webp",
      "800/002.webp",
      "800/003.webp",
    ]);
    expect(d.objects.get(`${finalPrefix}1600/001.webp`)?.publicRead).toBe(true);
    expect(await d.deps.storage.listObjects(set.stagingPrefix)).toHaveLength(0);
    const rows = await testDb.db
      .select({
        kind: files.kind,
        parentFileId: files.parentFileId,
        objectKey: files.objectKey,
        sha256: files.sha256,
      })
      .from(files)
      .where(eq(files.parentFileId, archive.fileId));
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.kind === "r360-1600")).toHaveLength(3);
    expect(rows.every((r) => r.sha256.startsWith("md5-"))).toBe(true);
    const [reservation] = await testDb.db
      .select({ expiresAt: pendingUploads.expiresAt })
      .from(pendingUploads)
      .where(eq(pendingUploads.stagingKey, set.stagingPrefix));
    expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    // The quota counts the frames now, not the ceiling.
    expect(await quotaUsageBytes(testDb.db, userId)).toBeLessThan(
      frameSetBytesCeiling(3),
    );

    const [view] = await listWorks(d.deps);
    expect(view.r360).toEqual({
      fileId: archive.fileId,
      sizeBytes: archive.sizeBytes,
      set: { id: set.setId, params, frameBase: `memory://${finalPrefix}` },
    });
    const [row] = await testDb.db
      .select({ setId: works.r360SetId, params: works.r360Params })
      .from(works)
      .where(eq(works.id, id));
    expect(row).toEqual({ setId: set.setId, params });
  });

  it("refuses a save that names a set the staging prefix does not hold, leaving nothing behind", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const archive = await uploadArchive(d, "one");
    const set = await stageSet(d, 3, { skip: "1600/3" });
    await expect(
      createWork(d.deps, {
        name: "Niepełna",
        imageFileIds: [photo.original.fileId],
        r360FileId: archive.fileId,
        r360SetId: set.setId,
        r360Params: defaultR360Params(3),
      }),
    ).rejects.toMatchObject({ code: "incomplete_set" });
    expect(await listWorks(d.deps)).toHaveLength(0);
    expect(
      await d.deps.storage.listObjects(
        frameSetPrefix(PREFIX, userId, set.setId),
      ),
    ).toHaveLength(0);
  });

  it("takes the copies back when the work itself is refused after the copy", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    await uploadArchive(d, "one");
    const set = await stageSet(d, 2);
    // The archive named is not the caller's: refused inside the transaction,
    // after the frames were copied.
    const other = await insertTestAccount(testDb.db, {
      email: "other-r360@example.com",
    });
    const theirs = await uploadArchive(
      { ...d, deps: { ...d.deps, userId: other } },
      "theirs",
    );
    await expect(
      createWork(d.deps, {
        name: "Cudze archiwum",
        imageFileIds: [photo.original.fileId],
        r360FileId: theirs.fileId,
        r360SetId: set.setId,
        r360Params: defaultR360Params(2),
      }),
    ).rejects.toMatchObject({ code: "invalid_archive" });
    expect(
      await d.deps.storage.listObjects(
        frameSetPrefix(PREFIX, userId, set.setId),
      ),
    ).toHaveLength(0);
    // Still staged: the owner may try again.
    expect(await d.deps.storage.listObjects(set.stagingPrefix)).toHaveLength(4);
  });

  it("refuses a second save of the same set, and a save that lost the race keeps the winner's frames", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const archive = await uploadArchive(d, "one");
    const set = await stageSet(d, 2);
    const input = {
      name: "Raz",
      imageFileIds: [photo.original.fileId],
      r360FileId: archive.fileId,
      r360SetId: set.setId,
      r360Params: defaultR360Params(2),
    };
    // Two saves at once: both verify against a live reservation, both copy
    // the same keys; the second finds the set recorded under the lock.
    const outcomes = await Promise.allSettled([
      createWork(d.deps, input),
      createWork(d.deps, { ...input, name: "Dwa" }),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const lost = outcomes.find((o) => o.status === "rejected");
    expect(lost && "reason" in lost && lost.reason).toMatchObject({
      code: "invalid_set",
    });
    const finalPrefix = frameSetPrefix(PREFIX, userId, set.setId);
    expect(await d.deps.storage.listObjects(finalPrefix)).toHaveLength(4);
    // A replay after the save: the reservation is settled.
    await expect(
      createWork(d.deps, { ...input, name: "Trzy" }),
    ).rejects.toMatchObject({ code: "invalid_set" });
    expect(await d.deps.storage.listObjects(finalPrefix)).toHaveLength(4);
  });

  it("a copy whose staging vanished under it — the other save settled — is told apart, and the winner's frames stay", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const archive = await uploadArchive(d, "one");
    const set = await stageSet(d, 2);
    const verified = await verifyFrameSet(d.deps, {
      setId: set.setId,
      frameCount: 2,
    });
    const { id } = await createWork(d.deps, {
      name: "Zwycięzca",
      imageFileIds: [photo.original.fileId],
      r360FileId: archive.fileId,
      r360SetId: set.setId,
      r360Params: defaultR360Params(2),
    });
    expect(id).toBeTruthy();
    // The loser verified before the winner settled, and copies now: the
    // staging is gone. What it copied before that is the winner's.
    let failure: unknown;
    try {
      await copyFrameSet(d.deps.storage, verified);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CopyFailed);
    expect(isStagingGone(failure)).toBe(true);
    expect((failure as CopyFailed).cause).toBeInstanceOf(ObjectNotFoundError);
    expect((failure as CopyFailed).copied).toEqual([]);
    expect(isStagingGone(new CopyFailed(new Error("503"), []))).toBe(false);
    const finalPrefix = frameSetPrefix(PREFIX, userId, set.setId);
    expect(await d.deps.storage.listObjects(finalPrefix)).toHaveLength(4);
  });

  it("a copy that fails midway leaves no public object, and a settle that fails does not fail the save", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const archive = await uploadArchive(d, "one");
    const set = await stageSet(d, 3);
    const finalPrefix = frameSetPrefix(PREFIX, userId, set.setId);
    const storage = d.deps.storage;
    let copies = 0;
    const flaky = {
      ...storage,
      async copyObject(...args: Parameters<typeof storage.copyObject>) {
        if (++copies === 4) throw new Error("503 from the bucket");
        return storage.copyObject(...args);
      },
    };
    await expect(
      createWork(
        { ...d.deps, storage: flaky },
        {
          name: "Urwana kopia",
          imageFileIds: [photo.original.fileId],
          r360FileId: archive.fileId,
          r360SetId: set.setId,
          r360Params: defaultR360Params(3),
        },
      ),
    ).rejects.toThrow("503");
    expect(await storage.listObjects(finalPrefix)).toHaveLength(0);
    // Still staged and still reserved: the owner can save again.
    expect(await storage.listObjects(set.stagingPrefix)).toHaveLength(6);
    // The save lists the staging prefix once to verify; the settle lists
    // it again to discard — that second listing fails.
    let listings = 0;
    const deaf = {
      ...storage,
      async listObjects(...args: Parameters<typeof storage.listObjects>) {
        if (++listings === 2) throw new Error("timeout");
        return storage.listObjects(...args);
      },
    };
    const { id } = await createWork(
      { ...d.deps, storage: deaf },
      {
        name: "Zapisana mimo to",
        imageFileIds: [photo.original.fileId],
        r360FileId: archive.fileId,
        r360SetId: set.setId,
        r360Params: defaultR360Params(3),
      },
    );
    expect(id).toBeTruthy();
    expect(await storage.listObjects(finalPrefix)).toHaveLength(6);
  });

  it("replaces the set with the archive, keeps it across an edit, refuses it across a change of archive, and frees it with the work", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const first = await uploadArchive(d, "one");
    const firstSet = await stageSet(d, 2);
    const { id } = await createWork(d.deps, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
      r360FileId: first.fileId,
      r360SetId: firstSet.setId,
      r360Params: defaultR360Params(2),
    });
    const firstPrefix = frameSetPrefix(PREFIX, userId, firstSet.setId);

    // An edit that keeps the set: the parameters may change, nothing moves.
    const turned = { ...defaultR360Params(2), direction: -1 as const };
    await updateWork(d.deps, id, {
      name: "Z orbitą, w drugą stronę",
      imageFileIds: [photo.original.fileId],
      r360FileId: first.fileId,
      r360SetId: firstSet.setId,
      r360Params: turned,
    });
    expect((await listWorks(d.deps))[0].r360?.set?.params).toEqual(turned);
    expect(await d.deps.storage.listObjects(firstPrefix)).toHaveLength(4);

    // The set kept with another count: the count is detected, not chosen.
    await expect(
      updateWork(d.deps, id, {
        name: "Z orbitą",
        imageFileIds: [photo.original.fileId],
        r360FileId: first.fileId,
        r360SetId: firstSet.setId,
        r360Params: defaultR360Params(3),
      }),
    ).rejects.toMatchObject({ code: "invalid_set" });

    // The set kept while the archive changes: refused.
    const second = await uploadArchive(d, "two");
    await expect(
      updateWork(d.deps, id, {
        name: "Z orbitą",
        imageFileIds: [photo.original.fileId],
        r360FileId: second.fileId,
        r360SetId: firstSet.setId,
        r360Params: turned,
      }),
    ).rejects.toMatchObject({ code: "invalid_set" });

    // A new archive with a new set: the old set's rows and objects go.
    const secondSet = await stageSet(d, 3);
    await updateWork(d.deps, id, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
      r360FileId: second.fileId,
      r360SetId: secondSet.setId,
      r360Params: defaultR360Params(3),
    });
    expect(await d.deps.storage.listObjects(firstPrefix)).toHaveLength(0);
    expect(
      await testDb.db
        .select()
        .from(files)
        .where(eq(files.parentFileId, first.fileId)),
    ).toHaveLength(0);
    const secondPrefix = frameSetPrefix(PREFIX, userId, secondSet.setId);
    expect(await d.deps.storage.listObjects(secondPrefix)).toHaveLength(6);
    expect(d.objects.has(first.key)).toBe(false);

    // Deleting the work frees the set and the archive.
    await deleteWork(d.deps, id);
    expect(await d.deps.storage.listObjects(secondPrefix)).toHaveLength(0);
    // The photo went with the work too: nothing else named it.
    expect(
      await testDb.db.select().from(files).where(eq(files.userId, userId)),
    ).toHaveLength(0);
    expect(d.objects.has(second.key)).toBe(false);
  });

  it("the parameters are pinned: within the count, a direction of ±1, a flattening in 0.15..1", () => {
    expect(defaultR360Params(120)).toEqual({
      frameCount: 120,
      direction: 1,
      framesPerWidth: 60,
      startFrame: 1,
      flattening: 1,
    });
    expect(defaultR360Params(2).framesPerWidth).toBe(1);
    const ok = r360ParamsSchema.safeParse({
      frameCount: 3,
      direction: -1,
      framesPerWidth: 3,
      startFrame: 3,
      flattening: 0.15,
    });
    expect(ok.success).toBe(true);
    for (const bad of [
      { framesPerWidth: 4 },
      { startFrame: 0 },
      { direction: 0 },
      { flattening: 0.1 },
      { frameCount: 1, framesPerWidth: 1, startFrame: 1 },
    ]) {
      expect(
        r360ParamsSchema.safeParse({ ...defaultR360Params(3), ...bad }).success,
      ).toBe(false);
    }
  });
});
