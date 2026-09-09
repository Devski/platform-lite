import { randomBytes } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, pendingUploads } from "@/db/schema";
import {
  discardStagedObject,
  sweepExpiredUploads,
  type ImageUploadDeps,
} from "@/lib/image-upload";
import { quotaAllows, reservePendingUpload } from "@/lib/quota";
import type { FileStorage } from "@/lib/storage";
import {
  frameKey,
  frameSetBytesCeiling,
  frameSetPrefix,
  frameSetStagingPrefix,
  frameSlots,
  presignFrameSetSchema,
  R360_FRAME_CONTENT_TYPE,
  R360_FRAME_MAX_BYTES,
  R360_SET_ID_PATTERN,
  type FrameSetPresign,
  type R360Width,
} from "./frame-set-shared";

// #102 (step 3 of #68, A13): the server's half of the frame pipeline. It
// never reads the archive and never decodes a frame (G4's one exception,
// SPEC §10): it mints a set, reserves the bytes (#30), and on save checks
// what the browser uploaded — count, sizes, a sample of headers — before
// copying it under the set's keys and recording a row per frame.

export class FrameSetError extends Error {
  constructor(
    public readonly code:
      | "quota_exceeded"
      /** Not this user's set, or no reservation for it. */
      | "invalid_set"
      /** The staging prefix does not hold exactly the 2N frames expected. */
      | "incomplete_set"
      /** A frame past its width's ceiling. */
      | "frame_too_large"
      /** A sampled frame does not start with a WebP header. */
      | "not_webp",
  ) {
    super(`frame set rejected: ${code}`);
    this.name = "FrameSetError";
  }
}

export type FrameSetDeps = ImageUploadDeps;

/**
 * How long the reservation and the URLs live: the frames are decoded and
 * encoded one at a time in the owner's browser, in parallel with the
 * archive's own upload, so the window grows with the count.
 */
export function frameSetReservationSeconds(frameCount: number): number {
  return 900 + frameCount * 5;
}

/**
 * One batch presign per set (#68): the set id, #30's reservation for the
 * whole set at its ceilings, and the 2N staging URLs — one request where
 * the per-upload limit would take twelve minutes for 120 frames.
 */
export async function presignFrameSet(
  deps: FrameSetDeps,
  input: { frameCount: number },
): Promise<FrameSetPresign> {
  const { frameCount } = presignFrameSetSchema.parse(input);
  const { storage, db, prefix, userId } = deps;
  await sweepExpiredUploads(deps);
  const setId = randomBytes(16).toString("hex");
  const stagingPrefix = frameSetStagingPrefix(prefix, userId, setId);
  const windowSeconds = frameSetReservationSeconds(frameCount);
  const reserved = await reservePendingUpload(db, {
    userId,
    stagingKey: stagingPrefix,
    sizeBytes: frameSetBytesCeiling(frameCount),
    windowSeconds,
  });
  if (!reserved) throw new FrameSetError("quota_exceeded");
  const urls = { 1600: [] as string[], 800: [] as string[] };
  for (const { width, ordinal } of frameSlots(frameCount)) {
    urls[width].push(
      await storage.presignUpload(frameKey(stagingPrefix, width, ordinal), {
        contentType: R360_FRAME_CONTENT_TYPE,
        expiresInSeconds: windowSeconds,
      }),
    );
  }
  return { setId, stagingPrefix, urls };
}

export interface StagedFrame {
  width: R360Width;
  ordinal: number;
  stagingKey: string;
  finalKey: string;
  sizeBytes: number;
  /** The MD5 the bucket computed on receipt — the frame's identity. */
  etag: string;
}

export interface VerifiedFrameSet {
  setId: string;
  stagingPrefix: string;
  frames: StagedFrame[];
  totalBytes: number;
}

/**
 * What the browser uploaded, checked against what the save claims: the
 * set is this user's (a reservation exists for it), the prefix holds
 * exactly 2N objects under the expected names, none past its ceiling, and
 * a sample of the 1600 set starts with `RIFF….WEBP`. One listing, three
 * twelve-byte reads; nothing else passes through the server.
 */
export async function verifyFrameSet(
  deps: FrameSetDeps,
  input: { setId: string; frameCount: number },
): Promise<VerifiedFrameSet> {
  const { storage, db, prefix, userId } = deps;
  const { setId, frameCount } = input;
  if (!R360_SET_ID_PATTERN.test(setId)) throw new FrameSetError("invalid_set");
  const stagingPrefix = frameSetStagingPrefix(prefix, userId, setId);
  const [reservation] = await db
    .select({ key: pendingUploads.stagingKey })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, userId),
        eq(pendingUploads.stagingKey, stagingPrefix),
      ),
    );
  if (!reservation) throw new FrameSetError("invalid_set");

  const slots = frameSlots(frameCount);
  const listed = await storage.listObjects(stagingPrefix, {
    maxKeys: slots.length + 1,
  });
  if (listed.length !== slots.length) {
    throw new FrameSetError("incomplete_set");
  }
  const byKey = new Map(listed.map((object) => [object.key, object]));
  const finalPrefix = frameSetPrefix(prefix, userId, setId);
  const frames = slots.map(({ width, ordinal }): StagedFrame => {
    const stagingKey = frameKey(stagingPrefix, width, ordinal);
    const object = byKey.get(stagingKey);
    if (!object || object.sizeBytes === 0) {
      throw new FrameSetError("incomplete_set");
    }
    if (object.sizeBytes > R360_FRAME_MAX_BYTES[width]) {
      throw new FrameSetError("frame_too_large");
    }
    // As for the archive: a presigned PUT is a single PUT, so the ETag is
    // the body's MD5; anything else is a provider off the contract.
    if (!/^[0-9a-f]{32}$/.test(object.etag)) {
      throw new Error(`storage answered a non-MD5 ETag for ${stagingKey}`);
    }
    return {
      width,
      ordinal,
      stagingKey,
      finalKey: frameKey(finalPrefix, width, ordinal),
      sizeBytes: object.sizeBytes,
      etag: object.etag,
    };
  });
  for (const ordinal of sampleOrdinals(frameCount)) {
    const header = await storage.getObject(
      frameKey(stagingPrefix, 1600, ordinal),
      { range: { offset: 0, length: 12 } },
    );
    if (!isWebpHeader(header)) throw new FrameSetError("not_webp");
  }
  const totalBytes = frames.reduce((sum, frame) => sum + frame.sizeBytes, 0);
  if (
    !(await quotaAllows(db, userId, totalBytes, {
      ignoreStagingKey: stagingPrefix,
    }))
  ) {
    throw new FrameSetError("quota_exceeded");
  }
  return { setId, stagingPrefix, frames, totalBytes };
}

/** The first, the middle and the last frame — three reads, whatever N. */
function sampleOrdinals(frameCount: number): number[] {
  return [...new Set([1, Math.ceil(frameCount / 2), frameCount])];
}

/** `RIFF` <size> `WEBP`: the twelve bytes every WebP file starts with. */
export function isWebpHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  );
}

/**
 * The verified frames copied under the set's final keys — server-side
 * copies, a few at a time, public like every served variant (G3). Returns
 * the keys written, so a save that fails afterwards can take them back.
 */
export async function copyFrameSet(
  storage: FileStorage,
  verified: VerifiedFrameSet,
): Promise<string[]> {
  await inBatches(verified.frames, 4, async (frame) => {
    await storage.copyObject(
      frame.stagingKey,
      frame.finalKey,
      R360_FRAME_CONTENT_TYPE,
      { publicRead: true },
    );
  });
  return verified.frames.map((frame) => frame.finalKey);
}

/** One `files` row per frame variant, under the archive's row. */
export async function insertFrameRows(
  tx: Database,
  userId: string,
  archiveFileId: string,
  verified: VerifiedFrameSet,
): Promise<void> {
  await tx.insert(files).values(
    verified.frames.map((frame) => ({
      userId,
      sha256: `md5-${frame.etag}`,
      sizeBytes: frame.sizeBytes,
      kind: `r360-${frame.width}` as const,
      parentFileId: archiveFileId,
      ext: "webp",
      objectKey: frame.finalKey,
    })),
  );
}

/**
 * After the rows are in: the reservation settled (expired, as confirm
 * does, never deleted) and the staged copies discarded — best effort, the
 * sweep and the lifecycle rule stand behind it.
 */
export async function settleFrameSet(
  deps: FrameSetDeps,
  verified: VerifiedFrameSet,
): Promise<void> {
  await deps.db
    .update(pendingUploads)
    .set({ expiresAt: sql`now()` })
    .where(
      and(
        eq(pendingUploads.stagingKey, verified.stagingPrefix),
        eq(pendingUploads.userId, deps.userId),
      ),
    );
  await discardStagedObject(deps.storage, verified.stagingPrefix);
}

/**
 * The rows of the sets a work no longer names — every frame under the
 * set's prefix. Returns the keys, for the caller to delete the objects
 * outside the transaction, as the other file sets are freed.
 */
export async function removeFrameSetRows(
  tx: Database,
  deps: Pick<FrameSetDeps, "prefix" | "userId">,
  setIds: string[],
): Promise<string[]> {
  const keys: string[] = [];
  for (const setId of new Set(setIds)) {
    if (!R360_SET_ID_PATTERN.test(setId)) continue;
    const pattern = `${frameSetPrefix(deps.prefix, deps.userId, setId)}%`;
    const rows = await tx
      .delete(files)
      .where(and(eq(files.userId, deps.userId), like(files.objectKey, pattern)))
      .returning({ objectKey: files.objectKey });
    for (const row of rows) if (row.objectKey) keys.push(row.objectKey);
  }
  return keys;
}

/** Deletes objects a few at a time; a failure is logged, never fatal. */
export async function deleteFrameObjects(
  storage: FileStorage,
  keys: string[],
): Promise<void> {
  await inBatches([...new Set(keys)], 4, async (key) => {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error("[r360] frame object cleanup failed:", error);
    }
  });
}

async function inBatches<T>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  for (let at = 0; at < items.length; at += size) {
    await Promise.all(items.slice(at, at + size).map(run));
  }
}
