import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
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
// (position 0 is the main one) and, since step 5, an R360 archive. Photos
// arrive through the image pipeline as `work-original` sets and the
// archive through the archive pipeline as an `r360-zip` row; a work only
// points at them, and a file is freed when no work names it any more.

export class WorksError extends Error {
  constructor(
    public readonly code:
      "limit" | "invalid_image" | "invalid_archive" | "not_found",
  ) {
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
  /** The R360 archive, owner-facing: a visitor never learns one exists. */
  r360: { fileId: string; sizeBytes: number } | null;
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
  const archiveIds = rows
    .map((row) => row.r360FileId)
    .filter((id): id is string => id !== null);
  const fileIds = [...originalIds, ...archiveIds];
  // The originals, the archives and the variants of the originals, in one
  // read, the caller's own (#49: each variant carries its object's key).
  const fileRows =
    fileIds.length === 0
      ? []
      : await db
          .select({
            id: files.id,
            parentFileId: files.parentFileId,
            kind: files.kind,
            sha256: files.sha256,
            sizeBytes: files.sizeBytes,
            objectKey: files.objectKey,
          })
          .from(files)
          .where(
            and(
              eq(files.userId, userId),
              originalIds.length === 0
                ? inArray(files.id, fileIds)
                : or(
                    inArray(files.id, fileIds),
                    inArray(files.parentFileId, originalIds),
                  ),
            ),
          );

  const urlsOf = (fileId: string): WorkImageView | null => {
    const original = fileRows.find((row) => row.id === fileId);
    if (!original) return null;
    const [url1600, url480] = WORK_VARIANTS.map(({ kind, size }) =>
      storage.publicUrl(
        fileRows.find((row) => row.parentFileId === fileId && row.kind === kind)
          ?.objectKey ?? variantKeyOf(original, size, prefix),
      ),
    );
    return { fileId, url1600, url480 };
  };

  return rows.map((row) => {
    const archive = row.r360FileId
      ? fileRows.find((file) => file.id === row.r360FileId)
      : undefined;
    return {
      id: row.id,
      name: row.name,
      investor: row.investor,
      developer: row.developer,
      images: imageRows
        .filter((image) => image.workId === row.id)
        .map((image) => urlsOf(image.fileId))
        .filter((image): image is WorkImageView => image !== null),
      r360: archive
        ? { fileId: archive.id, sizeBytes: archive.sizeBytes }
        : null,
    };
  });
}

// Every file a work is given must be the caller's own confirmed row of the
// right kind — the ownership check #72 makes binding for every file pointer
// (the database alone would accept any files.id).
async function assertOwnFiles(
  db: Database,
  userId: string,
  fileIds: string[],
  kind: "work-original" | "r360-zip",
  code: "invalid_image" | "invalid_archive",
): Promise<void> {
  if (fileIds.length === 0) return;
  const owned = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.userId, userId),
        eq(files.kind, kind),
      ),
    );
  if (owned.length !== fileIds.length) throw new WorksError(code);
}

async function assertOwnInput(
  db: Database,
  userId: string,
  parsed: { imageFileIds: string[]; r360FileId: string | null },
): Promise<void> {
  await assertOwnFiles(
    db,
    userId,
    parsed.imageFileIds,
    "work-original",
    "invalid_image",
  );
  await assertOwnFiles(
    db,
    userId,
    parsed.r360FileId ? [parsed.r360FileId] : [],
    "r360-zip",
    "invalid_archive",
  );
}

const lockUser = (db: Database, userId: string) =>
  db.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

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
    await lockUser(tx, userId);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(works)
      .where(eq(works.userId, userId));
    if (count >= WORKS_MAX) throw new WorksError("limit");
    await assertOwnInput(tx, userId, parsed);
    const [created] = await tx
      .insert(works)
      .values({
        userId,
        name: parsed.name,
        investor: parsed.investor || null,
        developer: parsed.developer || null,
        r360FileId: parsed.r360FileId,
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
 * Replaces a work's fields, photos and archive. The photos are a
 * delete-and-reinsert in one transaction: the (work_id, position) key is
 * not deferrable, so no sequence of UPDATEs can swap two positions without
 * a duplicate (SPEC §9). A file the work no longer names is freed
 * afterwards, unless another work still names it.
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
    // the same file never interleave.
    await lockUser(tx, userId);
    const [own] = await tx
      .select({ id: works.id, r360FileId: works.r360FileId })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, userId)))
      .for("update");
    if (!own) throw new WorksError("not_found");
    await assertOwnInput(tx, userId, parsed);
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
        r360FileId: parsed.r360FileId,
        updatedAt: sql`now()`,
      })
      .where(eq(works.id, workId));
    return {
      images: before
        .map((row) => row.fileId)
        .filter((fileId) => !parsed.imageFileIds.includes(fileId)),
      archives:
        own.r360FileId && own.r360FileId !== parsed.r360FileId
          ? [own.r360FileId]
          : [],
    };
  });
  await freeUnreferenced(deps, dropped);
}

/** Deletes a work and frees the photos and the archive no other work names. */
export async function deleteWork(
  deps: ProfileDeps,
  workId: string,
): Promise<void> {
  const { db, userId } = deps;
  const dropped = await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [own] = await tx
      .select({ id: works.id, r360FileId: works.r360FileId })
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
    return {
      images: images.map((row) => row.fileId),
      archives: own.r360FileId ? [own.r360FileId] : [],
    };
  });
  await freeUnreferenced(deps, dropped);
}

/**
 * Frees a confirmed work photo or R360 archive that never made it onto a
 * work — the owner closed the form after uploading. A file a work still
 * names is left alone.
 */
export async function discardWorkFile(
  deps: ProfileDeps,
  fileId: string,
): Promise<void> {
  const { db, userId } = deps;
  const [own] = await db
    .select({ id: files.id, kind: files.kind })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId),
        inArray(files.kind, ["work-original", "r360-zip"]),
      ),
    );
  if (!own) throw new WorksError("invalid_image");
  await freeUnreferenced(
    deps,
    own.kind === "r360-zip"
      ? { images: [], archives: [fileId] }
      : { images: [fileId], archives: [] },
  );
}

// A file is freed only once no work names it — decided and done, rows
// first, under the per-user advisory lock every attach takes, so a
// concurrent attach cannot slip between the check and the delete (the
// `restrict` on work_images.file_id would otherwise fail the row delete
// after the objects were already gone). The objects go last, outside the
// transaction.
async function freeUnreferenced(
  deps: ProfileDeps,
  dropped: { images: string[]; archives: string[] },
): Promise<void> {
  if (dropped.images.length === 0 && dropped.archives.length === 0) return;
  const keys = await deps.db.transaction(async (tx) => {
    await lockUser(tx, deps.userId);
    const freed: string[] = [];
    if (dropped.images.length > 0) {
      const stillUsed = await tx
        .select({ fileId: workImages.fileId })
        .from(workImages)
        .where(inArray(workImages.fileId, dropped.images));
      const used = new Set(stillUsed.map((row) => row.fileId));
      const free = [...new Set(dropped.images)].filter((id) => !used.has(id));
      freed.push(
        ...(await removeImageSetRows({ ...deps, db: tx }, free, "work")),
      );
    }
    if (dropped.archives.length > 0) {
      freed.push(...(await removeArchiveRows(tx, deps, dropped.archives)));
    }
    return freed;
  });
  await deleteObjects(deps, keys, "work");
}

/**
 * An archive confirmed and never attached — the tab closed between the
 * upload and the save — is invisible to the owner and can be most of the
 * quota. Nothing but this frees it: on the user's next archive presign,
 * every r360-zip of theirs older than a day that no work names goes
 * (step 5 review). A day, because a form left open overnight is not an
 * orphan yet.
 */
export async function sweepOrphanArchives(
  deps: ProfileDeps,
  olderThanHours = 24,
): Promise<void> {
  const { db, userId } = deps;
  const orphans = await db
    .select({ id: files.id })
    .from(files)
    .leftJoin(works, eq(works.r360FileId, files.id))
    .where(
      and(
        eq(files.userId, userId),
        eq(files.kind, "r360-zip"),
        isNull(works.id),
        lt(
          files.createdAt,
          sql`now() - make_interval(hours => ${olderThanHours})`,
        ),
      ),
    );
  if (orphans.length === 0) return;
  await freeUnreferenced(deps, {
    images: [],
    archives: orphans.map((row) => row.id),
  });
}

// An archive is one row, one private object; two works may name the same
// one (the same bytes confirm to the same row), so it goes only when no
// work does. Returns the keys whose objects nothing names any more.
async function removeArchiveRows(
  tx: Database,
  deps: Pick<ProfileDeps, "userId">,
  archiveIds: string[],
): Promise<string[]> {
  const stillUsed = await tx
    .select({ fileId: works.r360FileId })
    .from(works)
    .where(inArray(works.r360FileId, archiveIds));
  const used = new Set(stillUsed.map((row) => row.fileId));
  const free = [...new Set(archiveIds)].filter((id) => !used.has(id));
  if (free.length === 0) return [];
  const rows = await tx
    .select({ id: files.id, objectKey: files.objectKey })
    .from(files)
    .where(
      and(
        inArray(files.id, free),
        eq(files.userId, deps.userId),
        eq(files.kind, "r360-zip"),
      ),
    );
  if (rows.length === 0) return [];
  await tx.delete(files).where(
    inArray(
      files.id,
      rows.map((row) => row.id),
    ),
  );
  const freed: string[] = [];
  for (const row of rows) {
    if (!row.objectKey) continue;
    const [shared] = await tx
      .select({ id: files.id })
      .from(files)
      .where(eq(files.objectKey, row.objectKey))
      .limit(1);
    if (!shared) freed.push(row.objectKey);
  }
  return freed;
}
