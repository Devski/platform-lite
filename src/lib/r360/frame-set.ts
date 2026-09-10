import { randomBytes } from "node:crypto";
import { and, eq, like, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, pendingUploads, works } from "@/db/schema";
import {
  discardStagedObject,
  escapeLike,
  sweepExpiredUploads,
  type ImageUploadDeps,
} from "@/lib/image-upload";
import { quotaAllows, reservePendingUpload } from "@/lib/quota";
import { type FileStorage } from "@/lib/storage";
import {
  frameKey,
  frameSetBytesCeiling,
  frameSetOwnerPrefix,
  frameSetPrefix,
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
// what the browser uploaded — count, sizes, a sample of WebP headers —
// before recording a row per frame.
//
// #126: the frames are presigned STRAIGHT TO THEIR FINAL KEYS. They used
// to land under `staging/` and be copied at save, which cost a copy per
// object on top of a header read per object: 481 requests to OVH for a
// 120-frame orbit, eight at a time, from a one-core instance, with the
// owner watching a spinner that said nothing. There is no copy now and
// no second place for the bytes to be.
//
// What the staging prefix used to guarantee — everything under it is
// unclaimed, so a lifecycle rule may expire it — is gone with it, and the
// RESERVATION ROW carries that meaning instead: a row that still exists is
// a set that was never finished. So the save DELETES the row (it used to
// expire it) and the sweep collects what is left. The one thing that must
// never happen is deleting the frames of a saved work, so the sweep asks
// the `files` rows before it deletes anything under a set's prefix.

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
  // #126: and this owner's own unfinished sets, which no longer live under
  // `staging/` and so are past the sweep above. Lazily, as #30 does it —
  // the cost of the cleanup lands on the account that made the mess. The
  // collector on a schedule is what reaches an owner who never comes back.
  await collectUnfinishedFrameSets(deps);
  const setId = randomBytes(16).toString("hex");
  // #126: the set's final home. The reservation row is keyed on it, and
  // while that row exists the set counts as unfinished — which is what
  // lets the sweep collect it without guessing.
  const keyPrefix = frameSetPrefix(prefix, userId, setId);
  const reserved = await reservePendingUpload(db, {
    userId,
    stagingKey: keyPrefix,
    sizeBytes: frameSetBytesCeiling(frameCount),
    windowSeconds: frameSetReservationSeconds(frameCount),
  });
  if (!reserved) throw new FrameSetError("quota_exceeded");
  const urls = { 1600: [] as string[], 800: [] as string[] };
  for (const { width, ordinal } of frameSlots(frameCount)) {
    urls[width].push(
      await storage.presignUpload(frameKey(keyPrefix, width, ordinal), {
        contentType: R360_FRAME_CONTENT_TYPE,
        expiresInSeconds: frameSetUrlSeconds(frameCount),
        // The upload publishes the frame: there is no copy left to do it,
        // and a frame nobody may read is a hole in the public page (G3).
        publicRead: true,
      }),
    );
  }
  return { setId, keyPrefix, urls };
}

export interface StagedFrame {
  width: R360Width;
  ordinal: number;
  /** Where it already is: the frame was uploaded to its final key (#126). */
  key: string;
  sizeBytes: number;
  /** The MD5 the bucket computed on receipt — the frame's identity. */
  etag: string;
}

export interface VerifiedFrameSet {
  setId: string;
  keyPrefix: string;
  frames: StagedFrame[];
  totalBytes: number;
}

/**
 * How many frames have their WebP header read at save. A13 asked for a
 * SAMPLE and the old code read every one: 240 ranged GETs for a 120-frame
 * orbit, which with the copies made a save take a minute (#126). The
 * listing already carries every object's size and its ETag, so what the
 * header adds is proof the bytes are a WebP at all — and the frames of one
 * set come out of one encoder in one browser, so a set with eight good
 * headers and one bad one is not a case that happens by accident.
 */
export const HEADER_SAMPLE = 8;

/** An even spread across the set; the first and the last always in it. */
export function headerSample<T>(
  frames: readonly T[],
  size = HEADER_SAMPLE,
): T[] {
  if (frames.length <= size) return [...frames];
  const step = (frames.length - 1) / (size - 1);
  const picked = new Set<number>();
  for (let i = 0; i < size; i++) picked.add(Math.round(i * step));
  return [...picked].map((index) => frames[index]);
}

/**
 * What the browser uploaded, checked against what the save claims: the
 * set is this user's and still live (a reservation not yet run out — and
 * since #126 a set already saved has no reservation at all), no work names
 * it yet, the prefix holds exactly 2N objects under the expected names,
 * none past its ceiling, and a sample of them start with a WebP header
 * whose size field agrees with the object. One listing and eight small
 * ranged reads; nothing else passes through the server. A set that fails
 * on its bytes is discarded at once rather than left for the sweep.
 */
export async function verifyFrameSet(
  deps: FrameSetDeps,
  input: { setId: string; frameCount: number },
): Promise<VerifiedFrameSet> {
  const { storage, db, prefix, userId } = deps;
  const { setId, frameCount } = input;
  if (!R360_SET_ID_PATTERN.test(setId)) throw new FrameSetError("invalid_set");
  const keyPrefix = frameSetPrefix(prefix, userId, setId);
  const [reservation] = await db
    .select({ expiresAt: pendingUploads.expiresAt })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, userId),
        eq(pendingUploads.stagingKey, keyPrefix),
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
  const listed = await storage.listObjects(keyPrefix, {
    maxKeys: slots.length + 1,
  });
  if (listed.length > slots.length) throw new FrameSetError("incomplete_set");
  const byKey = new Map(listed.map((object) => [object.key, object]));
  const refuse = async (code: FrameSetError["code"]): Promise<never> => {
    // Bytes the save cannot use are not left for the sweep: the length
    // was not signed, so the prefix may hold far more than reserved. No
    // work names this set — that was checked above — so the prefix holds
    // nothing but the refused upload.
    await discardStagedObject(storage, keyPrefix);
    await dropReservation(deps, keyPrefix);
    throw new FrameSetError(code);
  };
  const frames: StagedFrame[] = [];
  for (const { width, ordinal } of slots) {
    const key = frameKey(keyPrefix, width, ordinal);
    // A listing may trail the last PUT by a moment on some providers: a
    // key it lacks is asked for by name before the set is refused.
    const object = byKey.get(key) ?? (await headOrNull(storage, key));
    if (!object || object.sizeBytes === 0) {
      throw new FrameSetError("incomplete_set");
    }
    if (object.sizeBytes > R360_FRAME_MAX_BYTES[width]) {
      await refuse("frame_too_large");
    }
    // As for the archive: a presigned PUT is a single PUT, so the ETag is
    // the body's MD5; anything else is a provider off the contract.
    if (!/^[0-9a-f]{32}$/.test(object.etag)) {
      throw new Error(`storage answered a non-MD5 ETag for ${key}`);
    }
    frames.push({
      width,
      ordinal,
      key,
      sizeBytes: object.sizeBytes,
      etag: object.etag,
    });
  }
  let webp = true;
  await inBatches(headerSample(frames), HEADER_SAMPLE, async (frame) => {
    const header = await storage.getObject(frame.key, {
      range: { offset: 0, length: WEBP_HEADER_LENGTH },
    });
    if (!isWebpHeader(header, frame.sizeBytes)) webp = false;
  });
  if (!webp) await refuse("not_webp");
  const totalBytes = frames.reduce((sum, frame) => sum + frame.sizeBytes, 0);
  if (
    !(await quotaAllows(db, userId, totalBytes, {
      ignoreStagingKey: keyPrefix,
    }))
  ) {
    throw new FrameSetError("quota_exceeded");
  }
  return { setId, keyPrefix, frames, totalBytes };
}

/**
 * #126/#127: the collector. Every frame set of this owner whose
 * reservation has run out is a set nobody finished — the save drops the
 * row, so a row that is still here means the browser walked away, the
 * abandon raced a landing PUT, or the save never came. Their objects go,
 * then their rows.
 *
 * The guard is the whole design. Deleting under a set's FINAL prefix is
 * only safe while "a reservation exists" means "unfinished", and
 * `settleFrameSet` is best-effort — a row can outlive its own save. So
 * before anything is deleted, the `files` rows are asked whether they name
 * the frames: if they do, the work is saved and only the stale row goes.
 * The deletion is driven by what a record says, never by what one lacks.
 *
 * Returns the prefixes it collected, for a caller that wants to say so.
 */
export async function collectUnfinishedFrameSets(
  deps: FrameSetDeps,
): Promise<string[]> {
  const { db, storage, prefix, userId } = deps;
  const expired = await db
    .select({ keyPrefix: pendingUploads.stagingKey })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, userId),
        // The same complement the image sweep uses: the quota counts a row
        // while `expires_at > now()`, so at equality it already stopped.
        lte(pendingUploads.expiresAt, sql`now()`),
        // This environment's keys and this owner's sets only — dev and
        // every preview share a database and a bucket, separated by prefix.
        like(
          pendingUploads.stagingKey,
          `${escapeLike(frameSetOwnerPrefix(prefix, userId))}%`,
        ),
      ),
    );
  const collected: string[] = [];
  for (const { keyPrefix } of expired) {
    if (await namesFrames(db, userId, keyPrefix)) {
      // Saved after all: the frames belong to a work. Only the row goes.
      console.warn(`[r360] a saved set kept its reservation: ${keyPrefix}`);
    } else if (await discardStagedObject(storage, keyPrefix)) {
      collected.push(keyPrefix);
    } else {
      // The objects are still there; keeping the row is what makes the
      // next sweep try again.
      continue;
    }
    await dropReservation(deps, keyPrefix);
  }
  return collected;
}

/** A `files` row of this user names something under the prefix. */
async function namesFrames(
  db: Database,
  userId: string,
  keyPrefix: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        like(files.objectKey, `${escapeLike(keyPrefix)}%`),
      ),
    )
    .limit(1);
  return row !== undefined;
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
  verified: VerifiedFrameSet,
): Promise<void> {
  await tx.insert(files).values(
    verified.frames.map((frame) => ({
      userId,
      sha256: `md5-${frame.etag}`,
      sizeBytes: frame.sizeBytes,
      kind: `r360-${frame.width}` as const,
      // #120: no parent. The frames used to hang off the archive's row so
      // that freeing it took them along; there is no archive now, and the
      // work's own free path removes them by set.
      parentFileId: null,
      ext: "webp",
      objectKey: frame.key,
    })),
  );
}

/**
 * After the rows are in: the reservation DROPPED. #126 — the row is what
 * says a set was never finished, so a saved set must not leave one behind;
 * and there is nothing else to clean up, because the frames were uploaded
 * where they belong. Best effort: the work is saved by now, and a failure
 * here is logged rather than turned into a 500 for a work that exists.
 *
 * A row that outlives its save anyway (this failed, the process died) is
 * not a disaster: the sweep asks the `files` rows before deleting anything
 * under a set's prefix, finds the frames named, and drops the row alone.
 */
export async function settleFrameSet(
  deps: FrameSetDeps,
  verified: VerifiedFrameSet,
): Promise<void> {
  try {
    await dropReservation(deps, verified.keyPrefix);
  } catch (error) {
    console.error("[r360] settling the frame set failed:", error);
  }
}

async function dropReservation(
  deps: Pick<FrameSetDeps, "db" | "userId">,
  keyPrefix: string,
): Promise<void> {
  await deps.db
    .delete(pendingUploads)
    .where(
      and(
        eq(pendingUploads.stagingKey, keyPrefix),
        eq(pendingUploads.userId, deps.userId),
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
