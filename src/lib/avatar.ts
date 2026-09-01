import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import type { Database } from "@/db/client";
import { files } from "@/db/schema";
import { quotaAllows } from "@/lib/quota";
import { contentKey, ObjectNotFoundError, type FileStorage } from "@/lib/storage";

// The #12 avatar pipeline, following the staging contract recorded on the
// issue (from the #11 security audit): the browser uploads to a random,
// user-bound STAGING key (G4 — bytes never pass through the app server); the
// server then fetches the copy, verifies it by decoding, and only then
// publishes under content-addressed keys (G2) — because a presigned URL pins
// byte count and type but never the byte VALUES, and stays reusable until it
// expires, nothing is published on the strength of the upload alone.

// A4: JPEG/PNG/WebP up to 10 MB.
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

// Decode ceiling on top of the byte cap: a mostly-flat 250-megapixel PNG fits
// in 10 MB yet decodes to gigabytes. 64 MP comfortably covers every real
// camera photo. (sharp's own ~268 MP limit stays on as the outer bomb guard.)
export const AVATAR_MAX_PIXELS = 64_000_000;
export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const presignAvatarSchema = z.object({
  sizeBytes: z.number().int().min(1).max(AVATAR_MAX_BYTES),
  contentType: z.enum(AVATAR_CONTENT_TYPES),
});

// A browser PUT needs seconds; a short window shrinks the replay surface of
// the multi-use presigned URL (issue note from the #11 audit).
const STAGING_TTL_SECONDS = 120;

// G5/A4: square cover crops — the avatar is displayed as a square/round chip.
export const AVATAR_VARIANTS = [
  { kind: "avatar-512", px: 512 },
  { kind: "avatar-128", px: 128 },
] as const;

// Decoded-format → stored extension and served content type. The DECODER
// decides, never the claimed content type — a mislabeled upload is stored
// under what it actually is, and anything else is refused (A4 allowlist).
const FORMATS: Record<string, { ext: string; contentType: string }> = {
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
};

export type AvatarErrorCode =
  | "invalid_key"
  | "not_found"
  | "not_an_image"
  | "unsupported_format"
  | "too_large"
  | "quota_exceeded";

// Stable codes for the route layer; the UI (#14) maps them to pl/en copy.
export class AvatarUploadError extends Error {
  constructor(public readonly code: AvatarErrorCode) {
    super(`avatar upload rejected: ${code}`);
    this.name = "AvatarUploadError";
  }
}

export interface AvatarDeps {
  storage: FileStorage;
  db: Database;
  /** Environment key prefix (SPEC §4: `devski/`, `pr-7/`; empty in prod). */
  prefix: string;
  userId: string;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function presignAvatarUpload(
  deps: AvatarDeps,
  input: { sizeBytes: number; contentType: string },
): Promise<{ stagingKey: string; uploadUrl: string }> {
  const parsed = presignAvatarSchema.parse(input);
  // A9, checked before any URL is minted (the #12 obligation): the signature
  // pins declared == uploaded bytes, so the declared size is trustworthy.
  if (!(await quotaAllows(deps.db, deps.userId, parsed.sizeBytes))) {
    throw new AvatarUploadError("quota_exceeded");
  }
  // Random and user-bound: confirm accepts only keys from this namespace, so
  // one user can never confirm (or guess) another user's staged upload.
  const stagingKey = `${deps.prefix}staging/${deps.userId}/${randomBytes(16).toString("hex")}`;
  const uploadUrl = await deps.storage.presignUpload(stagingKey, {
    maxBytes: parsed.sizeBytes,
    contentType: parsed.contentType,
    expiresInSeconds: STAGING_TTL_SECONDS,
  });
  return { stagingKey, uploadUrl };
}

export interface ConfirmedAvatar {
  original: { fileId: string; key: string; url: string; sha256: string };
  variants: { kind: string; key: string; url: string }[];
}

export async function confirmAvatarUpload(
  deps: AvatarDeps,
  input: { stagingKey: string },
): Promise<ConfirmedAvatar> {
  const { storage, db, prefix, userId } = deps;
  // Only this user's staging namespace is confirmable; everything else —
  // other users' keys, content keys, arbitrary paths — is refused unread.
  const ownStagingKey = new RegExp(
    `^${escapeRegExp(prefix)}staging/${escapeRegExp(userId)}/[0-9a-f]{32}$`,
  );
  if (!ownStagingKey.test(input.stagingKey)) {
    throw new AvatarUploadError("invalid_key");
  }

  let original: Buffer;
  try {
    original = await storage.getObject(input.stagingKey);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      throw new AvatarUploadError("not_found");
    }
    throw error;
  }
  // A typed rejection after the bytes were fetched is terminal for this
  // staged object — a retry needs a fresh presign anyway — so discard it
  // (best-effort) instead of leaving it for the lifecycle sweep.
  const discarded = async (code: AvatarErrorCode): Promise<AvatarUploadError> => {
    try {
      await storage.deleteObject(input.stagingKey);
    } catch (error) {
      console.error("[avatar] staging cleanup failed:", error);
    }
    return new AvatarUploadError(code);
  };

  // The presign signature already pins the length; this belt catches an
  // object that reached the bucket any other way before we buffer variants.
  if (original.length > AVATAR_MAX_BYTES) {
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
  if ((width ?? 0) * (height ?? 0) > AVATAR_MAX_PIXELS) {
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
      AVATAR_VARIANTS.map(({ px }) =>
        sharp(scrubbed)
          .resize(px, px, { fit: "cover", position: "centre" })
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
  // one sha256 stored on the original's files row (#14/#18 need no extra
  // lookup). The variant rows still record their own real sha256/size.
  // Regenerating variants in place (a sharp upgrade) would need new names —
  // accepted; a migration task would bump the suffix.
  const originalHash = sha256(scrubbed);
  const originalKey = contentKey(originalHash, known.ext, prefix);
  const variants = AVATAR_VARIANTS.map(({ kind, px }, index) => ({
    kind,
    px,
    body: variantBodies[index],
    key: contentKey(`${originalHash}-${px}`, "webp", prefix),
  }));

  const plannedRows = [
    {
      sha256: originalHash,
      sizeBytes: scrubbed.length,
      kind: "avatar-original" as const,
      ext: known.ext,
    },
    ...variants.map((variant) => ({
      sha256: sha256(variant.body),
      sizeBytes: variant.body.length,
      kind: variant.kind,
      ext: "webp",
    })),
  ];

  // A9 belt at confirm, against the REAL bytes about to be stored, charging
  // only what is not already recorded — so replaying (or re-uploading) an
  // already-published avatar passes even at the cap: nothing new would be
  // stored. Checked before any putObject, so a rejection publishes and
  // records nothing. Parallel confirms of DIFFERENT files can still overshoot
  // once — bounded by the per-user confirm rate limit to a handful of avatar
  // sets; the next check sees the committed SUM and refuses. Accepted for the
  // A9 soft cost cap.
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
  if (!(await quotaAllows(db, userId, newBytes))) {
    throw await discarded("quota_exceeded");
  }

  await storage.putObject(originalKey, scrubbed, known.contentType);
  for (const variant of variants) {
    await storage.putObject(variant.key, variant.body, "image/webp");
  }

  // Idempotent by content (unique user_id+sha256+kind): a replayed confirm —
  // the presigned URL stays live for its TTL — re-records nothing, so the A9
  // quota never counts the same stored bytes twice. The original lands first
  // so the variants can point at it (#14: deleting the original row cascades
  // its set away, which is how avatar replacement frees quota).
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
        eq(files.kind, "avatar-original"),
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

  // Best-effort: the published state is complete; a failed cleanup only
  // leaves a staging object behind. Residue classes, none user-visible:
  // uploads NEVER confirmed at all (the presign TTL kills the URL, not the
  // object — the bucket needs a lifecycle rule on the staging/ prefix,
  // recorded on #2/#24); an undeleted staging object from this best-effort
  // pass; published `a/` objects with no rows (puts succeeded, the insert
  // failed — a client retry heals it, since staging still exists).
  try {
    await storage.deleteObject(input.stagingKey);
  } catch (error) {
    console.error("[avatar] staging cleanup failed:", error);
  }

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
