import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, like, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, pendingUploads, works } from "@/db/schema";
import {
  discardStagedObject,
  escapeLike,
  sweepExpiredUploads,
  type ImageUploadDeps,
} from "@/lib/image-upload";
import { quotaAllows, reservePendingUpload } from "@/lib/quota";
import { ObjectNotFoundError, type FileStorage } from "@/lib/storage";
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
// what the browser uploaded — count, sizes, every frame's WebP header —
// before copying it under the set's keys and recording a row per frame.

export class FrameSetError extends Error {
  constructor(
    public readonly code:
      | "quota_exceeded"
      /** Not this user's set, no reservation for it, or already saved. */
      | "invalid_set"
      /** The reservation ran out before the save: the frames are swept. */
      | "set_expired"
      /** The staging prefix does not hold exactly the 2N frames expected. */
      | "incomplete_set"
      /** A frame past its width's ceiling. */
      | "frame_too_large"
      /** A frame does not carry a WebP header that agrees with its size. */
      | "not_webp",
  ) {
    super(`frame set rejected: ${code}`);
    this.name = "FrameSetError";
  }
}

export type FrameSetDeps = ImageUploadDeps;

/**
 * The URLs' life: the frames are decoded and encoded one at a time in the
 * owner's browser, in parallel with the archive's own upload, and the
 * owner then fills in the rest of the form — a session, not a transfer
 * (#102 review). Two hours, and five seconds a frame on top.
 */
export function frameSetUrlSeconds(frameCount: number): number {
  return 2 * 3600 + frameCount * 5;
}

/**
 * The reservation outlives the URLs by a grace, as an image's does: a PUT
 * accepted in the URLs' last second must still count when it lands.
 */
export const FRAME_SET_RESERVATION_GRACE_SECONDS = 300;

export function frameSetReservationSeconds(frameCount: number): number {
  return frameSetUrlSeconds(frameCount) + FRAME_SET_RESERVATION_GRACE_SECONDS;
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
  const reserved = await reservePendingUpload(db, {
    userId,
    stagingKey: stagingPrefix,
    sizeBytes: frameSetBytesCeiling(frameCount),
    windowSeconds: frameSetReservationSeconds(frameCount),
  });
  if (!reserved) throw new FrameSetError("quota_exceeded");
  const urls = { 1600: [] as string[], 800: [] as string[] };
  for (const { width, ordinal } of frameSlots(frameCount)) {
    urls[width].push(
      await storage.presignUpload(frameKey(stagingPrefix, width, ordinal), {
        contentType: R360_FRAME_CONTENT_TYPE,
        expiresInSeconds: frameSetUrlSeconds(frameCount),
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
  finalPrefix: string;
  frames: StagedFrame[];
  totalBytes: number;
}

/**
 * What the browser uploaded, checked against what the save claims: the
 * set is this user's and still live (a reservation not yet run out — a
 * settled one is a set already saved), no work names it yet, the prefix
 * holds exactly 2N objects under the expected names, none past its
 * ceiling, and every frame starts with a WebP header whose size field
 * agrees with the object (#102 review: the frames are published verbatim
 * and public, so every one is read — sixteen bytes each). One listing, 2N
 * small ranged reads; nothing else passes through the server. A set that
 * fails on its bytes is discarded at once rather than left for the sweep.
 */
export async function verifyFrameSet(
  deps: FrameSetDeps,
  input: { setId: string; frameCount: number },
): Promise<VerifiedFrameSet> {
  const { storage, db, prefix, userId } = deps;
  const { setId, frameCount } = input;
  if (!R360_SET_ID_PATTERN.test(setId)) throw new FrameSetError("invalid_set");
  const stagingPrefix = frameSetStagingPrefix(prefix, userId, setId);
  const finalPrefix = frameSetPrefix(prefix, userId, setId);
  const [reservation] = await db
    .select({ expiresAt: pendingUploads.expiresAt })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, userId),
        eq(pendingUploads.stagingKey, stagingPrefix),
      ),
    );
  if (!reservation) throw new FrameSetError("invalid_set");
  if (await isRecorded(db, userId, setId)) {
    throw new FrameSetError("invalid_set");
  }
  if (reservation.expiresAt.getTime() <= Date.now()) {
    throw new FrameSetError("set_expired");
  }

  const slots = frameSlots(frameCount);
  const listed = await storage.listObjects(stagingPrefix, {
    maxKeys: slots.length + 1,
  });
  if (listed.length > slots.length) throw new FrameSetError("incomplete_set");
  const byKey = new Map(listed.map((object) => [object.key, object]));
  const refuse = async (code: FrameSetError["code"]): Promise<never> => {
    // Bytes the save cannot use are not left for the sweep: the length
    // was not signed, so the prefix may hold far more than reserved.
    await discardStagedObject(storage, stagingPrefix);
    await settleReservation(deps, stagingPrefix);
    throw new FrameSetError(code);
  };
  const frames: StagedFrame[] = [];
  for (const { width, ordinal } of slots) {
    const stagingKey = frameKey(stagingPrefix, width, ordinal);
    // A listing may trail the last PUT by a moment on some providers: a
    // key it lacks is asked for by name before the set is refused.
    const object =
      byKey.get(stagingKey) ?? (await headOrNull(storage, stagingKey));
    if (!object || object.sizeBytes === 0) {
      throw new FrameSetError("incomplete_set");
    }
    if (object.sizeBytes > R360_FRAME_MAX_BYTES[width]) {
      await refuse("frame_too_large");
    }
    // As for the archive: a presigned PUT is a single PUT, so the ETag is
    // the body's MD5; anything else is a provider off the contract.
    if (!/^[0-9a-f]{32}$/.test(object.etag)) {
      throw new Error(`storage answered a non-MD5 ETag for ${stagingKey}`);
    }
    frames.push({
      width,
      ordinal,
      stagingKey,
      finalKey: frameKey(finalPrefix, width, ordinal),
      sizeBytes: object.sizeBytes,
      etag: object.etag,
    });
  }
  let webp = true;
  await inBatches(frames, 8, async (frame) => {
    const header = await storage.getObject(frame.stagingKey, {
      range: { offset: 0, length: WEBP_HEADER_LENGTH },
    });
    if (!isWebpHeader(header, frame.sizeBytes)) webp = false;
  });
  if (!webp) await refuse("not_webp");
  const totalBytes = frames.reduce((sum, frame) => sum + frame.sizeBytes, 0);
  if (
    !(await quotaAllows(db, userId, totalBytes, {
      ignoreStagingKey: stagingPrefix,
    }))
  ) {
    throw new FrameSetError("quota_exceeded");
  }
  return { setId, stagingPrefix, finalPrefix, frames, totalBytes };
}

/** A work of this user already names the set. */
export async function isRecorded(
  db: Database,
  userId: string,
  setId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: works.id })
    .from(works)
    .where(and(eq(works.userId, userId), eq(works.r360SetId, setId)))
    .limit(1);
  return row !== undefined;
}

async function headOrNull(
  storage: FileStorage,
  key: string,
): Promise<{ key: string; sizeBytes: number; etag: string } | null> {
  try {
    const head = await storage.headObject(key);
    return { key, sizeBytes: head.sizeBytes, etag: head.etag };
  } catch {
    return null;
  }
}

/** `RIFF` <size> `WEBP` <chunk tag>: the size field and the first chunk. */
export const WEBP_HEADER_LENGTH = 16;

/**
 * A WebP by its container: `RIFF`, the file size less eight in the size
 * field, `WEBP`, and a first chunk the format defines (`VP8 `, `VP8L` or
 * `VP8X`). Not a decode — the size field is what a renamed file gets wrong.
 */
export function isWebpHeader(bytes: Uint8Array, sizeBytes?: number): boolean {
  if (bytes.length < 12) return false;
  const text = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") return false;
  if (sizeBytes !== undefined) {
    const riffSize =
      (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
    if (riffSize + 8 !== sizeBytes) return false;
  }
  if (bytes.length >= 16) {
    return ["VP8 ", "VP8L", "VP8X"].includes(text(12, 16));
  }
  return true;
}

/** A copy that failed midway, with what it wrote so far. */
export class CopyFailed extends Error {
  constructor(
    readonly cause: unknown,
    readonly copied: string[],
  ) {
    super("frame set copy failed");
    this.name = "CopyFailed";
  }
}

/**
 * The verified frames copied under the set's final keys — server-side
 * copies, several at a time, public like every served variant (G3). A copy
 * that fails midway reports what it wrote, for the caller to take back
 * (minus what a row names by then: a second save of the same set that
 * lost the race — the winner's settle took the staging away under this
 * copy — must not delete the winner's frames; #103 CI).
 */
export async function copyFrameSet(
  storage: FileStorage,
  verified: VerifiedFrameSet,
): Promise<string[]> {
  const copied: string[] = [];
  try {
    await inBatches(verified.frames, 8, async (frame) => {
      await storage.copyObject(
        frame.stagingKey,
        frame.finalKey,
        R360_FRAME_CONTENT_TYPE,
        { publicRead: true },
      );
      copied.push(frame.finalKey);
    });
  } catch (error) {
    throw new CopyFailed(error, copied);
  }
  return copied;
}

/** A staged frame gone before the copy: the set was saved by another request. */
export function isStagingGone(error: unknown): boolean {
  return (
    error instanceof CopyFailed && error.cause instanceof ObjectNotFoundError
  );
}

/**
 * The last look, under the caller's lock and before the work is written,
 * that no work names the set: the check before the copy ran without the
 * lock, and a second save of the same set must not get this far (#102
 * review).
 */
export async function assertNotRecorded(
  tx: Database,
  userId: string,
  setId: string,
): Promise<void> {
  if (await isRecorded(tx, userId, setId)) {
    throw new FrameSetError("invalid_set");
  }
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
 * The copies of a save that did not go through — minus any a `files` row
 * names by now: two saves of one set both copy to the same keys, and the
 * one that lost must not take the winner's frames with it.
 */
export async function takeBackCopies(
  deps: Pick<FrameSetDeps, "db" | "storage" | "userId">,
  copied: string[],
): Promise<void> {
  if (copied.length === 0) return;
  const named = await deps.db
    .select({ objectKey: files.objectKey })
    .from(files)
    .where(
      and(eq(files.userId, deps.userId), inArray(files.objectKey, copied)),
    );
  const keep = new Set(named.map((row) => row.objectKey));
  await deleteFrameObjects(
    deps.storage,
    copied.filter((key) => !keep.has(key)),
  );
}

/**
 * After the rows are in: the reservation settled (expired, as confirm
 * does, never deleted) and the staged copies discarded. Best effort — the
 * work is saved by now, and the sweep and the lifecycle rule stand behind
 * this; a failure here is logged, never a 500 for a work that exists.
 */
export async function settleFrameSet(
  deps: FrameSetDeps,
  verified: VerifiedFrameSet,
): Promise<void> {
  try {
    await settleReservation(deps, verified.stagingPrefix);
    await discardStagedObject(deps.storage, verified.stagingPrefix);
  } catch (error) {
    console.error("[r360] settling the frame set failed:", error);
  }
}

async function settleReservation(
  deps: Pick<FrameSetDeps, "db" | "userId">,
  stagingPrefix: string,
): Promise<void> {
  await deps.db
    .update(pendingUploads)
    .set({ expiresAt: sql`now()` })
    .where(
      and(
        eq(pendingUploads.stagingKey, stagingPrefix),
        eq(pendingUploads.userId, deps.userId),
        gt(pendingUploads.expiresAt, sql`now()`),
      ),
    );
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
    const pattern = `${escapeLike(frameSetPrefix(deps.prefix, deps.userId, setId))}%`;
    const rows = await tx
      .delete(files)
      .where(and(eq(files.userId, deps.userId), like(files.objectKey, pattern)))
      .returning({ objectKey: files.objectKey });
    for (const row of rows) if (row.objectKey) keys.push(row.objectKey);
  }
  return keys;
}

/** Deletes objects in bulk; a failure is logged, never fatal. */
export async function deleteFrameObjects(
  storage: FileStorage,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await storage.deleteObjects([...new Set(keys)]);
  } catch (error) {
    console.error("[r360] frame object cleanup failed:", error);
  }
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
