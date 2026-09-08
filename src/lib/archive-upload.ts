import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { files, pendingUploads } from "@/db/schema";
import {
  discardStagedObject,
  isOwnStagingKey,
  sweepExpiredUploads,
  type ImageUploadDeps,
} from "@/lib/image-upload";
import { quotaAllows, reservePendingUpload } from "@/lib/quota";
import { ObjectNotFoundError, ownerKey } from "@/lib/storage";
import { sweepOrphanArchives } from "@/lib/works";
import {
  ARCHIVE_MAX_BYTES,
  presignArchiveSchema,
} from "@/lib/archive-upload-shared";

// #72 / A12: the R360 archive, upload only — everything after it is #68.
// The same staging contract as an image (G4: the bytes never pass through
// the app server), but the archive may be hundreds of megabytes on a
// one-core instance with no swap, so the server NEVER reads it: confirm
// asks storage for the object's size and checksum (headObject), copies it
// to its final key inside the bucket (copyObject) and records the row.

export {
  ARCHIVE_CONTENT_TYPES,
  ARCHIVE_MAX_BYTES,
  confirmArchiveSchema,
  presignArchiveSchema,
} from "@/lib/archive-upload-shared";

// S3 copies a single-part object of up to 5 GB in one CopyObject, which is
// exactly ARCHIVE_MAX_BYTES on AWS; OVHcloud is not documented identically
// and the 1 GB quota keeps every real archive far below the edge. To be
// verified on the real bucket the day the quota rises (step 5 review).
//
// A large upload on a home connection takes minutes, and S3 checks the
// URL's expiry when the PUT is received, not when its body finishes — so
// the URL needs only to outlive the click, while the reservation has to
// outlive the whole transfer (#30: the bytes are charged from the presign).
// The window follows the size: a flat four hours would lock an owner whose
// 600 MB PUT died at ninety percent out of retrying for four hours (step 5
// review). Half a megabyte a second is the floor a transfer is given —
// 5 MB in a quarter of an hour, 600 MB in about 35 minutes, 5 GiB in
// under three hours; a browser that gives up sooner says so through
// abandonStagedUpload and frees the bytes at once.
const ARCHIVE_STAGING_TTL_SECONDS = 600;
const ARCHIVE_RESERVATION_GRACE_SECONDS = 300;
const ARCHIVE_BYTES_PER_SECOND = 512 * 1024;
export function archiveReservationSeconds(sizeBytes: number): number {
  return (
    ARCHIVE_STAGING_TTL_SECONDS +
    ARCHIVE_RESERVATION_GRACE_SECONDS +
    Math.ceil(sizeBytes / ARCHIVE_BYTES_PER_SECOND)
  );
}

export type ArchiveUploadErrorCode =
  "invalid_key" | "not_found" | "too_large" | "quota_exceeded";

export class ArchiveUploadError extends Error {
  constructor(public readonly code: ArchiveUploadErrorCode) {
    super(`archive upload rejected: ${code}`);
    this.name = "ArchiveUploadError";
  }
}

export type ArchiveUploadDeps = ImageUploadDeps;

export async function presignArchiveUpload(
  deps: ArchiveUploadDeps,
  input: { sizeBytes: number; contentType: string },
): Promise<{ stagingKey: string; uploadUrl: string }> {
  const parsed = presignArchiveSchema.parse(input);
  // Free what this user abandoned before judging them for it: staged
  // uploads past their window, and archives nothing was ever built on.
  await sweepExpiredUploads(deps);
  await sweepOrphanArchives(deps);
  const stagingKey = `${deps.prefix}staging/${deps.userId}/${randomBytes(16).toString("hex")}`;
  // A9, decided before the URL exists: the declared size is what the
  // signature pins, so it is what the reservation charges (#30).
  const reserved = await reservePendingUpload(deps.db, {
    userId: deps.userId,
    stagingKey,
    sizeBytes: parsed.sizeBytes,
    windowSeconds: archiveReservationSeconds(parsed.sizeBytes),
  });
  if (!reserved) throw new ArchiveUploadError("quota_exceeded");
  const uploadUrl = await deps.storage.presignUpload(stagingKey, {
    maxBytes: parsed.sizeBytes,
    contentType: parsed.contentType,
    expiresInSeconds: ARCHIVE_STAGING_TTL_SECONDS,
  });
  return { stagingKey, uploadUrl };
}

export interface ConfirmedArchive {
  fileId: string;
  key: string;
  sizeBytes: number;
}

export async function confirmArchiveUpload(
  deps: ArchiveUploadDeps,
  input: { stagingKey: string },
): Promise<ConfirmedArchive> {
  const { storage, db, prefix, userId } = deps;
  if (!isOwnStagingKey(prefix, userId, input.stagingKey)) {
    throw new ArchiveUploadError("invalid_key");
  }
  // As for an image (#30): settling EXPIRES the reservation rather than
  // deleting it, so the still-live URL stays sweepable.
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

  let head: { sizeBytes: number; etag: string };
  try {
    head = await storage.headObject(input.stagingKey);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      throw new ArchiveUploadError("not_found");
    }
    throw error;
  }
  // The signature pinned the length; this belt catches an object that
  // reached the bucket any other way.
  if (head.sizeBytes > ARCHIVE_MAX_BYTES || head.sizeBytes === 0) {
    await discardStagedObject(storage, input.stagingKey);
    await settleReservation();
    throw new ArchiveUploadError("too_large");
  }

  // G2 by another name: the server never sees the bytes, so the content
  // identity is the checksum storage computed on receipt — for a single
  // PUT the ETag is the MD5 of the body. Recorded in `sha256` with its
  // algorithm named, since that column is the identity every dedup index
  // reads; the key carries it too, so a re-upload of the same archive lands
  // on the same object and the same row.
  // A multipart ETag (`<hex>-N`) cannot arise — the presigned URL signs a
  // plain PutObject and nothing ever issues the multipart signatures — so
  // anything but 32 hex digits is a provider not keeping the contract the
  // identity rests on, and must fail loudly rather than mint a non-content
  // name.
  if (!/^[0-9a-f]{32}$/.test(head.etag)) {
    throw new Error(`storage answered a non-MD5 ETag for ${input.stagingKey}`);
  }
  const identity = `md5-${head.etag}`;
  const key = ownerKey(userId, `r360-${head.etag}`, "zip", prefix);
  const [existing] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        eq(files.sha256, identity),
        eq(files.kind, "r360-zip"),
      ),
    );
  if (
    !existing &&
    !(await quotaAllows(db, userId, head.sizeBytes, {
      ignoreStagingKey: input.stagingKey,
    }))
  ) {
    await discardStagedObject(storage, input.stagingKey);
    await settleReservation();
    throw new ArchiveUploadError("quota_exceeded");
  }

  // Private, like every original: nothing serves the archive (G3). A copy
  // inside the bucket, never through this process.
  if (!existing) {
    await storage.copyObject(input.stagingKey, key, "application/zip");
  }
  await db
    .insert(files)
    .values({
      userId,
      sha256: identity,
      sizeBytes: head.sizeBytes,
      kind: "r360-zip",
      ext: "zip",
      objectKey: key,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        eq(files.sha256, identity),
        eq(files.kind, "r360-zip"),
      ),
    );
  await settleReservation();
  await discardStagedObject(storage, input.stagingKey);
  return { fileId: row.id, key, sizeBytes: head.sizeBytes };
}
