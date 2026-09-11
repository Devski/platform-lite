import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, pendingUploads, works } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import { QUOTA_BYTES, quotaUsageBytes } from "@/lib/quota";
import { createMemoryStorage } from "@/lib/storage";
import { updateDisplayName } from "@/lib/profile";
import { uploadTestPhoto } from "@/lib/test-uploads";
import { createWork, deleteWork, listWorks, updateWork } from "@/lib/works";
import sharp from "sharp";
import {
  collectUnfinishedFrameSets,
  FrameSetError,
  frameSetReservationSeconds,
  frameSetUrlSeconds,
  headerSample,
  isWebpHeader,
  presignFrameSet,
  verifyFrameSet,
} from "./frame-set";
import { imageWidthOf } from "./browser-frame-encoder";
import { abandonStagedUpload, escapeLike } from "@/lib/image-upload";
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

/** A reservation pushed into the past, as a walked-away browser leaves it. */
const expireReservation = (keyPrefix: string) =>
  testDb.db
    .update(pendingUploads)
    .set({
      createdAt: sql`now() - interval '2 minutes'`,
      expiresAt: sql`now() - interval '1 minute'`,
    })
    .where(eq(pendingUploads.stagingKey, keyPrefix));

const reservationsOf = (keyPrefix: string) =>
  testDb.db
    .select({ key: pendingUploads.stagingKey })
    .from(pendingUploads)
    .where(eq(pendingUploads.stagingKey, keyPrefix));

/** A small photo: the tests here are about the frames, not the variants. */
const uploadPhoto = (d: ReturnType<typeof makeDeps>) =>
  uploadTestPhoto(d.deps, { seed: 68, width: 40, height: 30 });

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
      frameKey(set.keyPrefix, width, ordinal),
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
    // #126: the frames are signed straight to where they will live, and
    // every URL publishes what it writes — nothing copies them afterwards
    // to give them an ACL, and a private frame is a hole in a public page.
    expect(set.keyPrefix).toBe(`${PREFIX}u/${userId}/r360/${set.setId}/`);
    expect(set.keyPrefix).toBe(frameSetPrefix(PREFIX, userId, set.setId));
    expect(set.urls[1600]).toHaveLength(3);
    expect(set.urls[800]).toHaveLength(3);
    expect(set.urls[1600][2]).toContain(
      `${set.keyPrefix}1600/003.webp?maxBytes=any`,
    );
    for (const url of [...set.urls[1600], ...set.urls[800]]) {
      expect(url).toContain("acl=public-read");
    }
    const [reservation] = await testDb.db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.userId, userId));
    expect(reservation.stagingKey).toBe(set.keyPrefix);
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

  it("collects an expired set on the next presign, as one prefix (#30, #126)", async () => {
    const d = makeDeps();
    const stale = await stageSet(d, 2);
    await testDb.db
      .update(pendingUploads)
      .set({
        createdAt: sql`now() - interval '2 minutes'`,
        expiresAt: sql`now() - interval '1 minute'`,
      })
      .where(eq(pendingUploads.stagingKey, stale.keyPrefix));
    expect(await d.deps.storage.listObjects(stale.keyPrefix)).toHaveLength(4);
    await presignFrameSet(d.deps, { frameCount: 2 });
    expect(await d.deps.storage.listObjects(stale.keyPrefix)).toHaveLength(0);
    expect(
      await testDb.db
        .select()
        .from(pendingUploads)
        .where(eq(pendingUploads.stagingKey, stale.keyPrefix)),
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
      key: `${PREFIX}u/${userId}/r360/${set.setId}/1600/001.webp`,
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
    expect(await d.deps.storage.listObjects(renamed.keyPrefix)).toHaveLength(0);
    // A reservation that ran out: the frames may be swept any moment.
    const stale = await stageSet(d, 2);
    await testDb.db
      .update(pendingUploads)
      .set({
        createdAt: sql`now() - interval '2 minutes'`,
        expiresAt: sql`now() - interval '1 minute'`,
      })
      .where(eq(pendingUploads.stagingKey, stale.keyPrefix));
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

  // #126: A13 asked for a sample of headers, and reading all 2N of them
  // was most of what made a save take a minute. What the sample must not
  // do is cluster: the first and the last frame are the ones a truncated
  // or misordered upload gets wrong.
  it("samples headers evenly, ends included, and reads them all when there are few", () => {
    const of = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(headerSample(of(6))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(headerSample(of(8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const sampled = headerSample(of(240));
    expect(sampled).toHaveLength(8);
    expect(sampled[0]).toBe(1);
    expect(sampled[sampled.length - 1]).toBe(240);
    expect(new Set(sampled).size).toBe(sampled.length);
    // Evenly: no two neighbours further apart than one step plus a round.
    const gaps = sampled.slice(1).map((at, i) => at - sampled[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  });

  it("escapes LIKE wildcards in a prefix", () => {
    expect(escapeLike("pr_7/u/x%")).toBe("pr\\_7/u/x\\%");
  });
});

describe("a frame set on a work", () => {
  it("saves the set: the frames where they were uploaded, a row each, the reservation dropped", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const set = await stageSet(d, 3);
    const params = defaultR360Params(3);
    const { id } = await createWork(d.deps, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
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
    // #126: the frames were uploaded here; the save moved nothing. What
    // publishes them is the ACL on the presigned PUT, asserted where the
    // presign is — a memory storage has no bucket to carry one.
    expect(finalPrefix).toBe(set.keyPrefix);
    const rows = await testDb.db
      .select({
        kind: files.kind,
        parentFileId: files.parentFileId,
        objectKey: files.objectKey,
        sha256: files.sha256,
      })
      .from(files)
      .where(inArray(files.kind, ["r360-1600", "r360-800"]));
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.kind === "r360-1600")).toHaveLength(3);
    expect(rows.every((r) => r.sha256.startsWith("md5-"))).toBe(true);
    // The row is gone, not expired: while it exists the set counts as
    // unfinished, and the collector deletes what unfinished sets hold.
    expect(
      await testDb.db
        .select({ key: pendingUploads.stagingKey })
        .from(pendingUploads)
        .where(eq(pendingUploads.stagingKey, set.keyPrefix)),
    ).toEqual([]);
    // The quota counts the frames now, not the ceiling.
    expect(await quotaUsageBytes(testDb.db, userId)).toBeLessThan(
      frameSetBytesCeiling(3),
    );

    const [view] = await listWorks(d.deps);
    expect(view.orbit).toEqual({
      setId: set.setId,
      params,
      frameBase: `memory://${finalPrefix}`,
    });
    const [row] = await testDb.db
      .select({ setId: works.r360SetId, params: works.r360Params })
      .from(works)
      .where(eq(works.id, id));
    expect(row).toEqual({ setId: set.setId, params });
  });

  it("refuses a save of a set a frame short, records nothing, and leaves the rest for the owner to finish", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const set = await stageSet(d, 3, { skip: "1600/3" });
    await expect(
      createWork(d.deps, {
        name: "Niepełna",
        imageFileIds: [photo.original.fileId],
        r360SetId: set.setId,
        r360Params: defaultR360Params(3),
      }),
    ).rejects.toMatchObject({ code: "incomplete_set" });
    expect(await listWorks(d.deps)).toHaveLength(0);
    expect(
      await testDb.db
        .select()
        .from(files)
        .where(inArray(files.kind, ["r360-1600", "r360-800"])),
    ).toHaveLength(0);
    // #126: the five frames that did land stay where they were uploaded,
    // and so does the reservation. A set a frame short is what a save
    // pressed mid-upload looks like, and the missing frame may still be on
    // its way — this is not the moment to throw the other five away. The
    // collector takes them when the window closes and nothing named them.
    expect(await d.deps.storage.listObjects(set.keyPrefix)).toHaveLength(5);
    expect(await reservationsOf(set.keyPrefix)).toHaveLength(1);
    await expireReservation(set.keyPrefix);
    expect(await collectUnfinishedFrameSets(d.deps)).toEqual([set.keyPrefix]);
    expect(await d.deps.storage.listObjects(set.keyPrefix)).toHaveLength(0);
  });

  it("refuses a second save of the same set, and a save that lost the race keeps the winner's frames", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const set = await stageSet(d, 2);
    const input = {
      name: "Raz",
      imageFileIds: [photo.original.fileId],
      r360SetId: set.setId,
      r360Params: defaultR360Params(2),
    };
    // Two saves at once: both verify against a live reservation and both
    // name the same keys — which is harmless now that neither writes any
    // (#126); the second finds the set recorded under the lock.
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
    // A replay after the save: the reservation is gone, so there is no set
    // to verify — and the winner's frames are untouched by the refusal.
    await expect(
      createWork(d.deps, { ...input, name: "Trzy" }),
    ).rejects.toMatchObject({ code: "invalid_set" });
    expect(await d.deps.storage.listObjects(finalPrefix)).toHaveLength(4);
  });

  // The owner's cancel goes through the same route as an image's, by the
  // set's prefix — which since #126 is where the frames LIVE. A cancel
  // that arrives after the save (a replay, a late unmount) must not take
  // the saved work's pictures with it.
  it("abandons an unsaved set, and refuses to abandon a saved one", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const unsaved = await stageSet(d, 2);
    await abandonStagedUpload(d.deps, { stagingKey: unsaved.keyPrefix });
    expect(await d.deps.storage.listObjects(unsaved.keyPrefix)).toHaveLength(0);
    // The row stays, expired: it is what makes the collector look again,
    // for a PUT that landed after this listing (#127).
    expect(await reservationsOf(unsaved.keyPrefix)).toHaveLength(1);
    expect(await quotaUsageBytes(testDb.db, userId)).toBeLessThan(
      frameSetBytesCeiling(2),
    );

    const saved = await stageSet(d, 2);
    await createWork(d.deps, {
      name: "Nie ruszać",
      imageFileIds: [photo.original.fileId],
      r360SetId: saved.setId,
      r360Params: defaultR360Params(2),
    });
    await abandonStagedUpload(d.deps, { stagingKey: saved.keyPrefix });
    expect(await d.deps.storage.listObjects(saved.keyPrefix)).toHaveLength(4);
  });

  it("collects an unfinished set: the frames it holds and the row that says so", async () => {
    const d = makeDeps();
    const stale = await stageSet(d, 2);
    await expireReservation(stale.keyPrefix);
    expect(await d.deps.storage.listObjects(stale.keyPrefix)).toHaveLength(4);
    expect(await collectUnfinishedFrameSets(d.deps)).toEqual([stale.keyPrefix]);
    expect(await d.deps.storage.listObjects(stale.keyPrefix)).toHaveLength(0);
    expect(await reservationsOf(stale.keyPrefix)).toHaveLength(0);
  });

  it("leaves a set whose window is still open", async () => {
    const d = makeDeps();
    const live = await stageSet(d, 2);
    expect(await collectUnfinishedFrameSets(d.deps)).toEqual([]);
    expect(await d.deps.storage.listObjects(live.keyPrefix)).toHaveLength(4);
    expect(await reservationsOf(live.keyPrefix)).toHaveLength(1);
  });

  // The guard the whole of #126 rests on. `settleFrameSet` is best effort,
  // so a saved set CAN keep its reservation — and collecting on "the row is
  // still here" alone would then delete a saved work's frames, at the final
  // keys the public page serves. The `files` rows are asked first.
  it("spares a saved set whose reservation outlived the save, and drops the row alone", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const set = await stageSet(d, 2);
    await createWork(d.deps, {
      name: "Zapisana",
      imageFileIds: [photo.original.fileId],
      r360SetId: set.setId,
      r360Params: defaultR360Params(2),
    });
    // The settle that did not happen: the row is back, and expired. It
    // goes in with its window open — `pending_uploads_window_forward`
    // refuses a row that expired before it was created — and is aged after.
    await testDb.db.insert(pendingUploads).values({
      stagingKey: set.keyPrefix,
      userId,
      sizeBytes: frameSetBytesCeiling(2),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expireReservation(set.keyPrefix);
    expect(await collectUnfinishedFrameSets(d.deps)).toEqual([]);
    expect(await d.deps.storage.listObjects(set.keyPrefix)).toHaveLength(4);
    expect(await reservationsOf(set.keyPrefix)).toHaveLength(0);
  });

  // #140. Previews share dev's database, each under its own key prefix,
  // so a work made on one preview is read, edited and deleted on the next.
  // Dawid hit all three on 10.09.2026: the orbit blank on pr-143, its
  // frames answering AccessDenied, and a delete that freed none of them.
  describe("a work made under another environment's key prefix (#140)", () => {
    const on = (prefix: string, d: ReturnType<typeof makeDeps>) => ({
      ...d,
      deps: { ...d.deps, prefix },
    });

    it("records where its frames are, and is shown from there on the next preview", async () => {
      const made = on("pr-142/", makeDeps());
      const photo = await uploadPhoto(made);
      const set = await stageSet(made, 2);
      await createWork(made.deps, {
        name: "Z innego podglądu",
        imageFileIds: [photo.original.fileId],
        r360SetId: set.setId,
        r360Params: defaultR360Params(2),
      });
      const [row] = await testDb.db
        .select({ keyPrefix: works.r360KeyPrefix })
        .from(works);
      expect(row.keyPrefix).toBe(`pr-142/u/${userId}/r360/${set.setId}/`);

      // The same work, read by the next preview: its own prefix, not ours.
      const [view] = await listWorks(on("pr-143/", made).deps);
      expect(view.orbit?.frameBase).toBe(`memory://${row.keyPrefix}`);
    });

    it("keeps that prefix across an edit that keeps the set", async () => {
      const made = on("pr-142/", makeDeps());
      const photo = await uploadPhoto(made);
      const set = await stageSet(made, 2);
      const input = {
        name: "Przed",
        imageFileIds: [photo.original.fileId],
        r360SetId: set.setId,
        r360Params: defaultR360Params(2),
      };
      const { id } = await createWork(made.deps, input);
      await updateWork(on("pr-143/", made).deps, id, { ...input, name: "Po" });
      const [row] = await testDb.db
        .select({ keyPrefix: works.r360KeyPrefix })
        .from(works);
      expect(row.keyPrefix).toBe(`pr-142/u/${userId}/r360/${set.setId}/`);
    });

    it("frees its frames when deleted from another preview", async () => {
      const made = on("pr-142/", makeDeps());
      const photo = await uploadPhoto(made);
      const set = await stageSet(made, 2);
      const { id } = await createWork(made.deps, {
        name: "Do usunięcia gdzie indziej",
        imageFileIds: [photo.original.fileId],
        r360SetId: set.setId,
        r360Params: defaultR360Params(2),
      });
      await deleteWork(on("pr-143/", made).deps, id);
      // The rows went — they used to stay, 240 of them, on the quota.
      expect(
        await testDb.db
          .select()
          .from(files)
          .where(inArray(files.kind, ["r360-1600", "r360-800"])),
      ).toHaveLength(0);
      // And so did the objects, under the prefix they were written to.
      expect(await made.deps.storage.listObjects(set.keyPrefix)).toHaveLength(
        0,
      );
    });
  });

  it("replaces the set, keeps it across an edit, refuses a change of its count, and frees it with the work", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const firstSet = await stageSet(d, 2);
    const { id } = await createWork(d.deps, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
      r360SetId: firstSet.setId,
      r360Params: defaultR360Params(2),
    });
    const firstPrefix = frameSetPrefix(PREFIX, userId, firstSet.setId);

    // An edit that keeps the set: the parameters may change, nothing moves.
    const turned = { ...defaultR360Params(2), direction: -1 as const };
    await updateWork(d.deps, id, {
      name: "Z orbitą, w drugą stronę",
      imageFileIds: [photo.original.fileId],
      r360SetId: firstSet.setId,
      r360Params: turned,
    });
    expect((await listWorks(d.deps))[0].orbit?.params).toEqual(turned);
    expect(await d.deps.storage.listObjects(firstPrefix)).toHaveLength(4);

    // The set kept with another count: the count is detected, not chosen.
    await expect(
      updateWork(d.deps, id, {
        name: "Z orbitą",
        imageFileIds: [photo.original.fileId],
        r360SetId: firstSet.setId,
        r360Params: defaultR360Params(3),
      }),
    ).rejects.toMatchObject({ code: "invalid_set" });

    // A new zip with a new set: the old set's rows and objects go.
    const secondSet = await stageSet(d, 3);
    await updateWork(d.deps, id, {
      name: "Z orbitą",
      imageFileIds: [photo.original.fileId],
      r360SetId: secondSet.setId,
      r360Params: defaultR360Params(3),
    });
    expect(await d.deps.storage.listObjects(firstPrefix)).toHaveLength(0);
    expect(
      await testDb.db
        .select()
        .from(files)
        .where(inArray(files.kind, ["r360-1600", "r360-800"])),
    ).toHaveLength(6);
    const secondPrefix = frameSetPrefix(PREFIX, userId, secondSet.setId);
    expect(await d.deps.storage.listObjects(secondPrefix)).toHaveLength(6);

    // Deleting the work frees the set.
    await deleteWork(d.deps, id);
    expect(await d.deps.storage.listObjects(secondPrefix)).toHaveLength(0);
    // The photo went with the work too: nothing else named it.
    expect(
      await testDb.db.select().from(files).where(eq(files.userId, userId)),
    ).toHaveLength(0);
  });

  it("keeps the cue points an edit gives a kept set, trimmed, shows them with the orbit, and refuses one past the count (#107)", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d);
    const set = await stageSet(d, 4);
    const input = {
      name: "Z punktami",
      imageFileIds: [photo.original.fileId],
      r360SetId: set.setId,
    };
    const { id } = await createWork(d.deps, {
      ...input,
      r360Params: defaultR360Params(4),
    });
    // Saved before there were cue points: it has none, and says nothing.
    expect((await listWorks(d.deps))[0].orbit?.params.cues).toBeUndefined();

    await updateWork(d.deps, id, {
      ...input,
      r360Params: {
        ...defaultR360Params(4),
        cues: [
          { frame: 4, label: " Taras " },
          { frame: 1, label: "Wejście" },
        ],
      },
    });
    const saved = [
      { frame: 4, label: "Taras" },
      { frame: 1, label: "Wejście" },
    ];
    expect((await listWorks(d.deps))[0].orbit?.params.cues).toEqual(saved);

    await expect(
      updateWork(d.deps, id, {
        ...input,
        r360Params: {
          ...defaultR360Params(4),
          cues: [{ frame: 5, label: "Za daleko" }],
        },
      }),
    ).rejects.toThrow();
    expect((await listWorks(d.deps))[0].orbit?.params.cues).toEqual(saved);
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
