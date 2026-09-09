import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, like, lte, sql } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "@/db/client";
import { files, pendingUploads } from "@/db/schema";
import { quotaAllows, reservePendingUpload } from "@/lib/quota";
import { ObjectNotFoundError, ownerKey, type FileStorage } from "@/lib/storage";
import {
  IMAGE_MAX_BYTES,
  IMAGE_PROFILES,
  presignImageSchema,
  type ImagePurpose,
} from "@/lib/image-upload-shared";

// The image pipeline (#12, generalised by #72), following the staging
// contract recorded on the issue (from the #11 security audit): the browser
// uploads to a random, user-bound STAGING key (G4 — bytes never pass through
// the app server); the server then fetches the copy, verifies it by
// decoding, and only then publishes under content-addressed keys (G2) —
// because a presigned URL pins byte count and type but never the byte
// VALUES, and stays reusable until it expires, nothing is published on the
// strength of the upload alone. Since #72 every key sits under its owner
// (`u/<user id>/`, SPEC §9): one object, one account.

export {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_PROFILES,
  IMAGE_PURPOSES,
  confirmImageSchema,
  imagePurposeSchema,
  presignImageSchema,
  type ImageProfile,
  type ImagePurpose,
  type ImageVariantSpec,
} from "@/lib/image-upload-shared";

// Decode ceiling on top of the byte cap: a mostly-flat 250-megapixel PNG fits
// in 10 MB yet decodes to gigabytes. 64 MP comfortably covers every real
// camera photo. (sharp's own ~268 MP limit stays on as the outer bomb guard.)
export const IMAGE_MAX_PIXELS = 64_000_000;

// A browser PUT needs seconds; a short window shrinks the replay surface of
// the multi-use presigned URL (issue note from the #11 audit).
const STAGING_TTL_SECONDS = 120;

// The reservation must outlive the URL it guards, never the other way round:
// the presign is stamped on the app server's clock and validated on OVH's,
// while `expires_at` is set by the database's, and S3 checks expiry when a
// PUT is RECEIVED, not when its body finishes arriving. Without slack a slow
// or skewed upload could land after its reservation stopped counting — which
// over-counts an abandoned upload for a few minutes, the safe direction.
const STAGING_RESERVATION_GRACE_SECONDS = 300;

// Decoded-format → stored extension and served content type. The DECODER
// decides, never the claimed content type — a mislabeled upload is stored
// under what it actually is, and anything else is refused (A4 allowlist).
const FORMATS: Record<string, { ext: string; contentType: string }> = {
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
};

export type ImageUploadErrorCode =
  | "invalid_key"
  | "not_found"
  | "not_an_image"
  | "unsupported_format"
  | "too_large"
  | "quota_exceeded";

// Stable codes for the route layer; the UI maps them to pl/en copy.
export class ImageUploadError extends Error {
  constructor(public readonly code: ImageUploadErrorCode) {
    super(`image upload rejected: ${code}`);
    this.name = "ImageUploadError";
  }
}

export interface ImageUploadDeps {
  storage: FileStorage;
  db: Database;
  /** Environment key prefix (SPEC §4: `devski/`, `pr-7/`; empty in prod). */
  prefix: string;
  userId: string;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// Deleting a staged object is always best-effort. It may never have arrived,
// and the bucket's lifecycle rule is the backstop for a delete that fails —
// so nothing here is worth failing a request that otherwise succeeded, and
// every caller carries on regardless. A key ending with a slash is an R360
// frame set's staging prefix (#102): one reservation, up to 720 objects,
// discarded one by one — every walk under `staging/` reaches them the way
// it reaches a single upload.
export async function discardStagedObject(
  storage: FileStorage,
  key: string,
): Promise<boolean> {
  try {
    if (!key.endsWith("/")) {
      await storage.deleteObject(key);
      return true;
    }
    let complete = true;
    for (const object of await storage.listObjects(key)) {
      try {
        await storage.deleteObject(object.key);
      } catch (error) {
        console.error("[image-upload] staging cleanup failed:", error);
        complete = false;
      }
    }
    return complete;
  } catch (error) {
    console.error("[image-upload] staging cleanup failed:", error);
    return false;
  }
}

// #30: staged uploads are swept by the APPLICATION, lazily, on the next
// presign from the same user — no cron, and the cost of the cleanup lands on
// the account that created the mess. The bucket lifecycle rule stays as the
// backstop for what this can never reach: a crash between the browser's PUT
// and any row this code writes.
export async function sweepExpiredUploads(
  deps: ImageUploadDeps,
): Promise<void> {
  const expired = await deps.db
    .select({ stagingKey: pendingUploads.stagingKey })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, deps.userId),
        // `lte`, not `lt`: the quota counts a row while `expires_at > now()`,
        // so at equality it already stops counting. The two predicates have to
        // be exact complements or a row settled in this very tick would be
        // uncounted AND unsweepable — invisible on both sides at once.
        lte(pendingUploads.expiresAt, sql`now()`),
        // Scoped to THIS environment's keys, exactly as confirm is: dev and
        // every PR preview share one database and one bucket, separated only
        // by prefix (SPEC §4), so an unscoped sweep would let one deployment
        // delete the same user's staged objects in another.
        like(pendingUploads.stagingKey, `${deps.prefix}staging/%`),
      ),
    );
  // Load-bearing, not an optimization: inArray() on an empty list has no
  // sensible SQL to emit, so the delete below must never see one.
  if (expired.length === 0) return;
  const swept: string[] = [];
  for (const row of expired) {
    // Only drop the row once its object is actually gone. Keeping a row whose
    // delete failed costs nothing — it already stopped counting against the
    // quota — and it is the only record that would make a later sweep retry.
    if (await discardStagedObject(deps.storage, row.stagingKey)) {
      swept.push(row.stagingKey);
    }
  }
  if (swept.length === 0) return;
  await deps.db
    .delete(pendingUploads)
    .where(inArray(pendingUploads.stagingKey, swept));
}

/**
 * The browser gave up on a staged upload — the PUT failed, or the owner
 * cancelled it (#72 step 5 review). Settles the reservation the way confirm
 * does (expires it, never deletes it: the URL may still be live), so the
 * declared bytes stop counting at once instead of at the window's end, and
 * discards whatever partial object landed. Idempotent; refuses nothing but
 * a key outside the caller's namespace, silently.
 */
export async function abandonStagedUpload(
  deps: ImageUploadDeps,
  input: { stagingKey: string },
): Promise<void> {
  if (!isOwnStagingKey(deps.prefix, deps.userId, input.stagingKey)) return;
  await deps.db
    .update(pendingUploads)
    .set({ expiresAt: sql`now()` })
    .where(
      and(
        eq(pendingUploads.stagingKey, input.stagingKey),
        eq(pendingUploads.userId, deps.userId),
      ),
    );
  await discardStagedObject(deps.storage, input.stagingKey);
}

/** Only this user's staging namespace: other users' keys, content keys and
 * arbitrary paths are refused unread. A trailing slash names a frame set's
 * prefix (#102), abandoned the same way. */
export function isOwnStagingKey(
  prefix: string,
  userId: string,
  key: string,
): boolean {
  return new RegExp(
    `^${escapeRegExp(prefix)}staging/${escapeRegExp(userId)}/[0-9a-f]{32}/?$`,
  ).test(key);
}

/**
 * Step one for every image, whatever it is for: reserve the declared bytes
 * against the quota and mint a short-lived URL to a staging slot.
 */
export async function presignImageUpload(
  deps: ImageUploadDeps,
  input: { sizeBytes: number; contentType: string },
): Promise<{ stagingKey: string; uploadUrl: string }> {
  const parsed = presignImageSchema.parse(input);
  // Free what this user abandoned before judging them for it.
  await sweepExpiredUploads(deps);
  // Random and user-bound: confirm accepts only keys from this namespace, so
  // one user can never confirm (or guess) another user's staged upload.
  const stagingKey = `${deps.prefix}staging/${deps.userId}/${randomBytes(16).toString("hex")}`;
  // A9, decided BEFORE the URL exists (the #12 obligation), so there is no
  // instant in which a caller can upload bytes nobody is counting. The check
  // and the reservation are one atomic step — two parallel presigns reading
  // the same pre-insert usage would otherwise both pass. Since #30 the usage
  // includes bytes staged and not yet confirmed; the signature pins declared
  // == uploaded bytes, so the declared size is trustworthy.
  const reserved = await reservePendingUpload(deps.db, {
    userId: deps.userId,
    stagingKey,
    sizeBytes: parsed.sizeBytes,
    windowSeconds: STAGING_TTL_SECONDS + STAGING_RESERVATION_GRACE_SECONDS,
  });
  if (!reserved) {
    throw new ImageUploadError("quota_exceeded");
  }
  const uploadUrl = await deps.storage.presignUpload(stagingKey, {
    maxBytes: parsed.sizeBytes,
    contentType: parsed.contentType,
    expiresInSeconds: STAGING_TTL_SECONDS,
  });
  return { stagingKey, uploadUrl };
}

export interface ConfirmedImage {
  original: { fileId: string; key: string; url: string; sha256: string };
  variants: { kind: string; key: string; url: string }[];
}

/**
 * Step two: verify the staged bytes by decoding them, scrub them, publish
 * the original (private) and the purpose's variants (public) under the
 * owner's content-addressed keys, and record the set in `files`.
 */
export async function confirmImageUpload(
  deps: ImageUploadDeps,
  input: { stagingKey: string; purpose: ImagePurpose },
): Promise<ConfirmedImage> {
  const { storage, db, prefix, userId } = deps;
  const profile = IMAGE_PROFILES[input.purpose];
  if (!isOwnStagingKey(prefix, userId, input.stagingKey)) {
    throw new ImageUploadError("invalid_key");
  }

  // #30: the presign reserved this upload's declared size against the A9
  // quota. SETTLING expires the row rather than deleting it — the two are not
  // interchangeable. The presigned URL stays live and reusable for the rest of
  // its window, so a deleted row would leave a key the client can re-upload to
  // that neither the quota (no row to sum) nor the sweep (it reads only this
  // table) could ever see again: exactly the hole #30 closes, one step later.
  // Expiring stops the charge immediately and keeps the row as a sweep target
  // until the URL is dead. Scoped by user as well as key, so the row query
  // stands on its own rather than leaning on the regex above.
  const settleReservation = () =>
    db
      .update(pendingUploads)
      .set({ expiresAt: sql`now()` })
      .where(
        and(
          eq(pendingUploads.stagingKey, input.stagingKey),
          eq(pendingUploads.userId, userId),
        ),
      );

  let original: Buffer;
  try {
    original = await storage.getObject(input.stagingKey);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      // Deliberately NOT releasing the reservation (#30): the presigned URL is
      // still live, so the client can upload after this. Releasing here would
      // let a caller reserve, ask early, reserve again and then upload both —
      // the reservation has to outlive the URL, and it expires with it.
      throw new ImageUploadError("not_found");
    }
    throw error;
  }
  // A typed rejection after the bytes were fetched is terminal for this
  // staged object — a retry needs a fresh presign anyway — so discard it
  // (best-effort) instead of leaving it for the lifecycle sweep.
  const discarded = async (
    code: ImageUploadErrorCode,
  ): Promise<ImageUploadError> => {
    await discardStagedObject(storage, input.stagingKey);
    // Stop charging for bytes we just refused, but keep the row: the URL is
    // still live, so a re-upload to this key must remain sweepable (#30).
    await settleReservation();
    return new ImageUploadError(code);
  };

  // The presign signature already pins the length; this belt catches an
  // object that reached the bucket any other way before we buffer variants.
  if (original.length > IMAGE_MAX_BYTES) {
    throw await discarded("too_large");
  }

  // Decode-verify. The decoded format is authoritative; metadata() only
  // parses the header, so the full-decode steps below stay guarded too.
  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ format, width, height } = await sharp(original).metadata());
  } catch {
    throw await discarded("not_an_image");
  }
  const known = format ? FORMATS[format] : undefined;
  if (!known) throw await discarded("unsupported_format");
  if ((width ?? 0) * (height ?? 0) > IMAGE_MAX_PIXELS) {
    throw await discarded("too_large");
  }

  // Review findings (01.09.2026): the published original is a RE-ENCODE, not
  // the uploaded bytes — sharp strips every metadata block (EXIF GPS, device
  // serial: the object sits at a public, derivable URL) and autoOrient bakes
  // the EXIF rotation into the pixels (0.35 defaults it OFF; without it every
  // portrait phone photo would publish sideways variants under immutable
  // names). A small re-encode loss on JPEG is the accepted price. The G2
  // hash is therefore the hash of the PUBLISHED bytes.
  let scrubbed: Buffer;
  let variantBodies: Buffer[];
  try {
    scrubbed = await sharp(original, { autoOrient: true })
      .toFormat(format as "jpeg" | "png" | "webp")
      .toBuffer();
    variantBodies = await Promise.all(
      profile.variants.map(({ size, fit }) =>
        (fit === "cover"
          ? sharp(scrubbed).resize(size, size, {
              fit: "cover",
              position: "centre",
            })
          : // The width bound alone: height follows the aspect ratio, and a
            // smaller photo is never blown up (A12).
            sharp(scrubbed).resize({
              width: size,
              fit: "inside",
              withoutEnlargement: true,
            })
        )
          .webp()
          .toBuffer(),
      ),
    );
  } catch {
    // Header parsed but the pixel stream is truncated/corrupt.
    throw await discarded("not_an_image");
  }

  // G2: the original is named by its published bytes; the variants are named
  // by the ORIGINAL's hash + size suffix, so every URL is derivable from the
  // one sha256 stored on the original's files row. The variant rows still
  // record their own real sha256/size. Regenerating variants in place (a
  // sharp upgrade) would need new names — accepted; a migration task would
  // bump the suffix. #72: all of them under the owner (SPEC §9).
  const originalHash = sha256(scrubbed);
  const originalKey = ownerKey(userId, originalHash, known.ext, prefix);
  const variants = profile.variants.map(({ kind, size }, index) => ({
    kind,
    body: variantBodies[index],
    key: ownerKey(userId, `${originalHash}-${size}`, "webp", prefix),
  }));

  // #49: each row records the key its own object is written under, prefix
  // included. Every reader then addresses the object this upload created,
  // rather than one whose name it recomputes from its own environment.
  const plannedRows = [
    {
      sha256: originalHash,
      sizeBytes: scrubbed.length,
      kind: profile.originalKind,
      ext: known.ext,
      objectKey: originalKey,
    },
    ...variants.map((variant) => ({
      sha256: sha256(variant.body),
      sizeBytes: variant.body.length,
      kind: variant.kind,
      ext: "webp",
      objectKey: variant.key,
    })),
  ];

  // A9 belt at confirm, against the REAL bytes about to be stored, charging
  // only what is not already recorded — so replaying (or re-uploading) an
  // already-published image passes even at the cap: nothing new would be
  // stored. Checked before any putObject, so a rejection publishes and
  // records nothing. Parallel confirms of DIFFERENT files can still overshoot
  // once — bounded by the per-user confirm rate limit to a handful of sets;
  // the next check sees the committed SUM and refuses. Accepted for the A9
  // soft cost cap.
  const existing = await db
    .select({ sha256: files.sha256, kind: files.kind })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        inArray(
          files.sha256,
          plannedRows.map((row) => row.sha256),
        ),
      ),
    );
  const alreadyRecorded = new Set(
    existing.map((row) => `${row.sha256}:${row.kind}`),
  );
  const newBytes = plannedRows
    .filter((row) => !alreadyRecorded.has(`${row.sha256}:${row.kind}`))
    .reduce((total, row) => total + row.sizeBytes, 0);
  // Discount this upload's own reservation rather than releasing it: the
  // declared bytes it holds are the very bytes about to become `files` rows,
  // so counting both would weigh the upload against itself. Releasing early
  // instead would leave the bytes accounted by nothing at all across the puts
  // and inserts below — and unaccounted forever if any of them throws.
  if (
    !(await quotaAllows(db, userId, newBytes, {
      ignoreStagingKey: input.stagingKey,
    }))
  ) {
    throw await discarded("quota_exceeded");
  }

  // Only the variants are served to the world (G3). The original is kept
  // private: nothing renders it — pages build their URLs from the variant
  // keys — and it is the full-resolution file the user handed us, which a
  // public address derivable from any variant URL would hand back to anyone.
  // Decision of 04.09.2026, with the G3 mechanism itself: OVHcloud has no
  // bucket policies, so public access is a per-object ACL and this is where
  // the choice is made.
  await storage.putObject(originalKey, scrubbed, known.contentType);
  for (const variant of variants) {
    await storage.putObject(variant.key, variant.body, "image/webp", {
      publicRead: true,
    });
  }

  // Idempotent by content (unique user_id+sha256+kind among originals): a
  // replayed confirm — the presigned URL stays live for its TTL —
  // re-records nothing, so the A9 quota never counts the same stored bytes
  // twice. The original lands first so the variants can point at it (#14:
  // deleting the original row cascades its set away, which is how
  // replacement frees quota).
  const [originalPlan, ...variantPlans] = plannedRows;
  await db
    .insert(files)
    .values({ userId, ...originalPlan })
    .onConflictDoNothing();
  const [originalRow] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        eq(files.sha256, originalHash),
        eq(files.kind, profile.originalKind),
      ),
    );
  await db
    .insert(files)
    .values(
      variantPlans.map((plan) => ({
        userId,
        ...plan,
        parentFileId: originalRow.id,
      })),
    )
    .onConflictDoNothing();

  // Settled only now that the bytes exist as `files` rows: until this line
  // the reservation is what keeps them accounted, so a throw anywhere above
  // leaves the upload counted rather than invisible. A replayed confirm
  // settles an already-settled row, which is a no-op.
  await settleReservation();

  // Best-effort: the published state is complete; a failed cleanup only
  // leaves a staging object behind. Residue classes, none user-visible: an
  // undeleted staging object from this pass, and published objects with no
  // rows (puts succeeded, the insert failed — a client retry heals it, since
  // staging still exists). Both are reached by the settled reservation above
  // on this user's next presign, with the bucket's `staging/` lifecycle rule
  // (provisioned with #2) as the outer backstop.
  await discardStagedObject(storage, input.stagingKey);

  return {
    original: {
      fileId: originalRow.id,
      key: originalKey,
      url: storage.publicUrl(originalKey),
      sha256: originalHash,
    },
    variants: variants.map((variant) => ({
      kind: variant.kind,
      key: variant.key,
      url: storage.publicUrl(variant.key),
    })),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
