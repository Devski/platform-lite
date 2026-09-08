import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, workImages, works } from "@/db/schema";
import { IMAGE_PROFILES } from "@/lib/image-upload-shared";
import {
  deleteObjects,
  removeImageSetRows,
  variantKeyOf,
  type ProfileDeps,
  type ProfileReadDeps,
} from "@/lib/profile";
import { WORKS_MAX, workInputSchema, type WorkInput } from "@/lib/work-schemas";

// #72 / A12: a profile's works — up to ten, each with one to three photos
// (position 0 is the main one) and, from step 5, an R360 archive. Photos
// arrive through the image pipeline as `work-original` sets; a work only
// points at them, and a set is freed when no work names it any more.

export class WorksError extends Error {
  constructor(public readonly code: "limit" | "invalid_image" | "not_found") {
    super(`work rejected: ${code}`);
    this.name = "WorksError";
  }
}

export interface WorkImageView {
  fileId: string;
  url1600: string;
  url480: string;
}

export interface WorkView {
  id: string;
  name: string;
  investor: string | null;
  developer: string | null;
  /** In display order; the first is the main photo. */
  images: WorkImageView[];
  /** Whether an R360 archive is attached (owner-facing; step 5 fills it). */
  hasR360: boolean;
}

const WORK_VARIANTS = IMAGE_PROFILES.work.variants;

/** A user's works in adding order, with their photos' public URLs. */
export async function listWorks(deps: ProfileReadDeps): Promise<WorkView[]> {
  const { db, storage, prefix, userId } = deps;
  const rows = await db
    .select({
      id: works.id,
      name: works.name,
      investor: works.investor,
      developer: works.developer,
      r360FileId: works.r360FileId,
    })
    .from(works)
    .where(eq(works.userId, userId))
    .orderBy(asc(works.createdAt), asc(works.id));
  if (rows.length === 0) return [];

  const workIds = rows.map((row) => row.id);
  const imageRows = await db
    .select({
      workId: workImages.workId,
      position: workImages.position,
      fileId: workImages.fileId,
    })
    .from(workImages)
    .where(inArray(workImages.workId, workIds))
    .orderBy(asc(workImages.position));
  const originalIds = [...new Set(imageRows.map((image) => image.fileId))];
  const fileRows =
    originalIds.length === 0
      ? []
      : await db
          .select({
            id: files.id,
            parentFileId: files.parentFileId,
            kind: files.kind,
            sha256: files.sha256,
            objectKey: files.objectKey,
          })
          .from(files)
          .where(
            and(
              eq(files.userId, userId),
              inArray(files.parentFileId, originalIds),
            ),
          );
  const originals =
    originalIds.length === 0
      ? []
      : await db
          .select({
            id: files.id,
            sha256: files.sha256,
            objectKey: files.objectKey,
          })
          .from(files)
          .where(and(eq(files.userId, userId), inArray(files.id, originalIds)));

  const urlsOf = (fileId: string): WorkImageView | null => {
    const original = originals.find((row) => row.id === fileId);
    if (!original) return null;
    const [url1600, url480] = WORK_VARIANTS.map(({ kind, size }) =>
      storage.publicUrl(
        fileRows.find((row) => row.parentFileId === fileId && row.kind === kind)
          ?.objectKey ?? variantKeyOf(original, size, prefix),
      ),
    );
    return { fileId, url1600, url480 };
  };

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    investor: row.investor,
    developer: row.developer,
    images: imageRows
      .filter((image) => image.workId === row.id)
      .map((image) => urlsOf(image.fileId))
      .filter((image): image is WorkImageView => image !== null),
    hasR360: row.r360FileId !== null,
  }));
}

// Every photo a work is given must be the caller's own confirmed
// work-original — the ownership check #72 makes binding for every file
// pointer (the database alone would accept any files.id).
async function assertOwnWorkOriginals(
  db: Database,
  userId: string,
  fileIds: string[],
): Promise<void> {
  const owned = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.userId, userId),
        eq(files.kind, "work-original"),
      ),
    );
  if (owned.length !== fileIds.length) throw new WorksError("invalid_image");
}

/**
 * Adds a work. The ten-per-profile limit is counted here, under the same
 * per-user advisory lock the quota uses — a CHECK cannot count rows, and two
 * parallel adds reading "nine" would otherwise both pass.
 */
export async function createWork(
  deps: ProfileDeps,
  input: WorkInput,
): Promise<{ id: string }> {
  const parsed = workInputSchema.parse(input);
  const { db, userId } = deps;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(works)
      .where(eq(works.userId, userId));
    if (count >= WORKS_MAX) throw new WorksError("limit");
    await assertOwnWorkOriginals(tx, userId, parsed.imageFileIds);
    const [created] = await tx
      .insert(works)
      .values({
        userId,
        name: parsed.name,
        investor: parsed.investor || null,
        developer: parsed.developer || null,
      })
      .returning({ id: works.id });
    await tx.insert(workImages).values(
      parsed.imageFileIds.map((fileId, position) => ({
        workId: created.id,
        fileId,
        position,
      })),
    );
    return { id: created.id };
  });
}

/**
 * Replaces a work's fields and photos. The photos are a delete-and-reinsert
 * in one transaction: the (work_id, position) key is not deferrable, so no
 * sequence of UPDATEs can swap two positions without a duplicate (SPEC §9).
 * A photo the work no longer names is freed afterwards, unless another work
 * still names it.
 */
export async function updateWork(
  deps: ProfileDeps,
  workId: string,
  input: WorkInput,
): Promise<void> {
  const parsed = workInputSchema.parse(input);
  const { db, userId } = deps;
  const dropped = await db.transaction(async (tx) => {
    // The same per-user lock create and free take: an attach and a free of
    // the same photo never interleave.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [own] = await tx
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, userId)))
      .for("update");
    if (!own) throw new WorksError("not_found");
    await assertOwnWorkOriginals(tx, userId, parsed.imageFileIds);
    const before = await tx
      .select({ fileId: workImages.fileId })
      .from(workImages)
      .where(eq(workImages.workId, workId));
    await tx.delete(workImages).where(eq(workImages.workId, workId));
    await tx.insert(workImages).values(
      parsed.imageFileIds.map((fileId, position) => ({
        workId,
        fileId,
        position,
      })),
    );
    await tx
      .update(works)
      .set({
        name: parsed.name,
        investor: parsed.investor || null,
        developer: parsed.developer || null,
        updatedAt: sql`now()`,
      })
      .where(eq(works.id, workId));
    return before
      .map((row) => row.fileId)
      .filter((fileId) => !parsed.imageFileIds.includes(fileId));
  });
  await freeUnreferenced(deps, dropped);
}

/** Deletes a work and frees the photos no other work still names. */
export async function deleteWork(
  deps: ProfileDeps,
  workId: string,
): Promise<void> {
  const { db, userId } = deps;
  const dropped = await db.transaction(async (tx) => {
    const [own] = await tx
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, userId)))
      .for("update");
    if (!own) throw new WorksError("not_found");
    const images = await tx
      .select({ fileId: workImages.fileId })
      .from(workImages)
      .where(eq(workImages.workId, workId));
    // The image rows go with the work (cascade); the file rows do not.
    await tx.delete(works).where(eq(works.id, workId));
    return images.map((row) => row.fileId);
  });
  await freeUnreferenced(deps, dropped);
}

/**
 * Frees a confirmed work photo that never made it onto a work — the owner
 * closed the form after uploading. Refuses anything a work still names.
 */
export async function discardWorkImage(
  deps: ProfileDeps,
  fileId: string,
): Promise<void> {
  const { db, userId } = deps;
  const [own] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId),
        eq(files.kind, "work-original"),
      ),
    );
  if (!own) throw new WorksError("invalid_image");
  await freeUnreferenced(deps, [fileId]);
}

// A photo set is freed only once no work_images row names it — decided
// and done, rows first, under the per-user advisory lock every attach
// takes, so a concurrent attach cannot slip between the check and the
// delete (the `restrict` on work_images.file_id would otherwise fail the
// row delete after the objects were already gone). The objects go last,
// outside the transaction.
async function freeUnreferenced(
  deps: ProfileDeps,
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;
  const keys = await deps.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${deps.userId}))`,
    );
    const stillUsed = await tx
      .select({ fileId: workImages.fileId })
      .from(workImages)
      .where(inArray(workImages.fileId, fileIds));
    const used = new Set(stillUsed.map((row) => row.fileId));
    const free = [...new Set(fileIds)].filter((fileId) => !used.has(fileId));
    return removeImageSetRows({ ...deps, db: tx }, free, "work");
  });
  await deleteObjects(deps, keys, "work");
}
