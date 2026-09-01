import { eq, sum } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files } from "@/db/schema";

// A9: 1 GB per user, free in the MVP. Usage is computed in the database as
// the per-user SUM over files.size_bytes — the files(user_id, size_bytes)
// covering index makes it an index-only scan. Safe thanks to OVH's zero
// egress; the pain threshold and the paid-model conversation live in SPEC §10.

export const QUOTA_BYTES = 1024 * 1024 * 1024;

export async function quotaUsageBytes(
  db: Database,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(files.sizeBytes) })
    .from(files)
    .where(eq(files.userId, userId));
  // drizzle sums into a numeric string (null for no rows); far below 2^53.
  return Number(row?.total ?? 0);
}

/** True while `additionalBytes` more still fits — the limit itself is fine. */
export async function quotaAllows(
  db: Database,
  userId: string,
  additionalBytes: number,
): Promise<boolean> {
  const usage = await quotaUsageBytes(db, userId);
  return usage + additionalBytes <= QUOTA_BYTES;
}
