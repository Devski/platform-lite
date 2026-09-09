import { and, eq, gt, ne, sql, sum } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, pendingUploads } from "@/db/schema";

// A9: 1 GB per user, free in the MVP. Usage is computed in the database as
// the per-user SUM over files.size_bytes — the files(user_id, size_bytes)
// covering index makes it an index-only scan. Safe thanks to OVH's zero
// egress; the pain threshold and the paid-model conversation live in SPEC §10.

export const QUOTA_BYTES = 1024 * 1024 * 1024;

export async function quotaUsageBytes(
  db: Database,
  userId: string,
  // Confirm needs the total WITHOUT the reservation it is about to turn into
  // `files` rows, or the upload would be weighed against itself. Excluding one
  // key is safer than releasing it early: the reservation stays in place until
  // the bytes are published, so nothing is ever under-counted (#30).
  opts?: { ignoreStagingKey?: string },
): Promise<number> {
  // Stored bytes plus STAGED bytes (#30). A staged upload already occupies the
  // bucket, so leaving it out let a user park unaccounted gigabytes there —
  // presign is capped at 10/min at 10 MB each, and the bucket lifecycle rule
  // only sweeps a day later. The presign signature pins content-length, so the
  // declared size cannot differ from what the bucket accepts — except for the
  // R360 frames (#102), whose sizes are unknowable at presign: their
  // reservation is a ceiling, the save checks the real sizes, and SPEC §10
  // carries the residual.
  const [stored] = await db
    .select({ total: sum(files.sizeBytes) })
    .from(files)
    .where(eq(files.userId, userId));
  // Expiry is evaluated in the database, so a row stops counting the moment
  // its window closes — the sweep frees the object, not the quota, and a
  // browser that walked away never holds someone's quota hostage.
  const [staged] = await db
    .select({ total: sum(pendingUploads.sizeBytes) })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.userId, userId),
        gt(pendingUploads.expiresAt, sql`now()`),
        opts?.ignoreStagingKey
          ? ne(pendingUploads.stagingKey, opts.ignoreStagingKey)
          : undefined,
      ),
    );
  // drizzle sums into a numeric string (null for no rows); far below 2^53.
  return Number(stored?.total ?? 0) + Number(staged?.total ?? 0);
}

/**
 * Reserves `sizeBytes` for a staged upload atomically with the check that they
 * fit, returning false when they do not.
 *
 * Read-then-insert as two statements is not enough: two presigns racing each
 * other both read the pre-insert usage and both pass, so the reservation would
 * approximate A9 rather than enforce it (#30 review).
 */
export async function reservePendingUpload(
  db: Database,
  reservation: {
    userId: string;
    stagingKey: string;
    sizeBytes: number;
    windowSeconds: number;
  },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Per-user and transaction-scoped: released on commit or rollback, and it
    // never makes one account wait for another.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${reservation.userId}))`,
    );
    if (!(await quotaAllows(tx, reservation.userId, reservation.sizeBytes))) {
      return false;
    }
    await tx.insert(pendingUploads).values({
      stagingKey: reservation.stagingKey,
      userId: reservation.userId,
      sizeBytes: reservation.sizeBytes,
      // One clock decides the window: the same `now()` the quota compares
      // against, never the application's.
      expiresAt: sql`now() + make_interval(secs => ${reservation.windowSeconds})`,
    });
    return true;
  });
}

/** True while `additionalBytes` more still fits — the limit itself is fine. */
export async function quotaAllows(
  db: Database,
  userId: string,
  additionalBytes: number,
  opts?: { ignoreStagingKey?: string },
): Promise<boolean> {
  const usage = await quotaUsageBytes(db, userId, opts);
  return usage + additionalBytes <= QUOTA_BYTES;
}
