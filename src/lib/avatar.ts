import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import type { Database } from "@/db/client";
import { files } from "@/db/schema";
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
  | "too_large";

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
  deps: Pick<AvatarDeps, "storage" | "prefix" | "userId">,
  input: { sizeBytes: number; contentType: string },
): Promise<{ stagingKey: string; uploadUrl: string }> {
  const parsed = presignAvatarSchema.parse(input);
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
  // The presign signature already pins the length; this belt catches an
  // object that reached the bucket any other way before we buffer variants.
  if (original.length > AVATAR_MAX_BYTES) {
    throw new AvatarUploadError("too_large");
  }

  // Decode-verify (sharp's default input-pixel limit stays on as the
  // decompression-bomb guard). The decoded format is authoritative.
  let format: string | undefined;
  try {
    format = (await sharp(original).metadata()).format;
  } catch {
    throw new AvatarUploadError("not_an_image");
  }
  const known = format ? FORMATS[format] : undefined;
  if (!known) throw new AvatarUploadError("unsupported_format");

  // G2: the original is named by its own bytes; the variants are named by the
  // ORIGINAL's hash + size suffix, so every URL is derivable from the one
  // sha256 stored on the original's files row (#14/#18 need no extra lookup).
  // The variant rows still record their own real sha256/size. Regenerating
  // variants in place (a sharp upgrade) would need new names — accepted; a
  // migration task would bump the suffix.
  const originalHash = sha256(original);
  const originalKey = contentKey(originalHash, known.ext, prefix);

  const variants = await Promise.all(
    AVATAR_VARIANTS.map(async ({ kind, px }) => {
      const body = await sharp(original)
        .resize(px, px, { fit: "cover", position: "centre" })
        .webp()
        .toBuffer();
      return { kind, px, body, key: contentKey(`${originalHash}-${px}`, "webp", prefix) };
    }),
  );

  await storage.putObject(originalKey, original, known.contentType);
  for (const variant of variants) {
    await storage.putObject(variant.key, variant.body, "image/webp");
  }

  const rows = await db
    .insert(files)
    .values([
      {
        userId,
        sha256: originalHash,
        sizeBytes: original.length,
        kind: "avatar-original" as const,
      },
      ...variants.map((variant) => ({
        userId,
        sha256: sha256(variant.body),
        sizeBytes: variant.body.length,
        kind: variant.kind,
      })),
    ])
    .returning({ id: files.id, kind: files.kind });

  // Best-effort: the published state is complete; a failed cleanup only
  // leaves a staging object for the (future) reconciliation sweep.
  try {
    await storage.deleteObject(input.stagingKey);
  } catch (error) {
    console.error("[avatar] staging cleanup failed:", error);
  }

  const originalRow = rows.find((row) => row.kind === "avatar-original")!;
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
