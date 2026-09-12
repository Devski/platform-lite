import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
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
import {
  assertNotRecorded,
  insertFrameRows,
  removeFrameSetRows,
  settleFrameSet,
  verifyFrameSet,
  type VerifiedFrameSet,
} from "@/lib/r360/frame-set";
import { frameSetPrefix, type R360Params } from "@/lib/r360/frame-set-shared";
import {
  secondariesOf,
  workInputSchema,
  WORKS_MAX,
  type WorkInput,
} from "@/lib/work-schemas";

// #72 / A12: a profile's works — up to ten, each with one to three photos
// (position 0 is the main one) and, since #68, an R360 orbit. Photos
// arrive through the image pipeline as `work-original` sets; the orbit's
// frames are made in the owner's browser and land as `r360-<width>` rows
// (#102). A work only points at them, and a file is freed when no work
// names it any more.
//
// #120: the zip the frames were made from never reaches us. It is read on
// the owner's machine and stays there, so a work names a frame set and
// nothing else — there is no archive to own, to account for, or to free.

export class WorksError extends Error {
  constructor(
    public readonly code:
      | "limit"
      | "invalid_image"
      | "invalid_archive"
      /** #102: a frame set kept while its archive changed. */
      | "invalid_set"
      /** #66: an order about a list of works that is not the one there now. */
      | "stale_order"
      | "not_found",
  ) {
    super(`work rejected: ${code}`);
    this.name = "WorksError";
  }
}

export interface WorkChannelView {
  fileId: string;
  url1600: string;
  url480: string;
}

export interface WorkImageView {
  /** #99: the second channel, if the photo has one. */
  secondary?: WorkChannelView;
  fileId: string;
  url1600: string;
  url480: string;
}

/** #104: what a visitor needs to orbit — the parameters and where the frames are. */
export interface WorkOrbitView {
  /** The set the frames sit under; the owner's form names it on save. */
  setId: string;
  params: R360Params;
  frameBase: string;
}

export interface WorkView {
  id: string;
  name: string;
  investor: string | null;
  developer: string | null;
  /** In display order; the first is the main photo. */
  images: WorkImageView[];
  /**
   * The R360 as shown: the set's id, the viewer's parameters, and the
   * public address every frame's URL starts with
   * (`${frameBase}${width}/${ordinal}.webp`). None when the work has no
   * orbit.
   */
  orbit: WorkOrbitView | null;
}

const WORK_VARIANTS = IMAGE_PROFILES.work.variants;

/**
 * A user's works in the order the owner put them in, with their photos'
 * public URLs. Adding order breaks a tie (#66): positions are rewritten
 * wholesale, so they are neither unique nor dense, and two works that have
 * never been reordered both sit at 0.
 */
export async function listWorks(deps: ProfileReadDeps): Promise<WorkView[]> {
  const { db, storage, prefix, userId } = deps;
  const rows = await db
    .select({
      id: works.id,
      name: works.name,
      investor: works.investor,
      developer: works.developer,
      r360SetId: works.r360SetId,
      r360Params: works.r360Params,
      r360KeyPrefix: works.r360KeyPrefix,
    })
    .from(works)
    .where(eq(works.userId, userId))
    .orderBy(asc(works.position), asc(works.createdAt), asc(works.id));
  if (rows.length === 0) return [];

  const workIds = rows.map((row) => row.id);
  const imageRows = await db
    .select({
      workId: workImages.workId,
      position: workImages.position,
      fileId: workImages.fileId,
      secondaryFileId: workImages.secondaryFileId,
    })
    .from(workImages)
    .where(inArray(workImages.workId, workIds))
    .orderBy(asc(workImages.position));
  const originalIds = [
    ...new Set(
      imageRows.flatMap((image) =>
        image.secondaryFileId
          ? [image.fileId, image.secondaryFileId]
          : [image.fileId],
      ),
    ),
  ];
  const fileIds = originalIds;
  // The originals and their variants in one read, the caller's own
  // (#49: each variant carries its object's key).
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

  const urlsOf = (fileId: string): WorkChannelView | null => {
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
  const imageOf = (image: {
    fileId: string;
    secondaryFileId: string | null;
  }): WorkImageView | null => {
    const first = urlsOf(image.fileId);
    if (!first) return null;
    const secondary = image.secondaryFileId
      ? urlsOf(image.secondaryFileId)
      : null;
    return secondary ? { ...first, secondary } : first;
  };

  return rows.map((row) => {
    const orbit: WorkOrbitView | null =
      row.r360SetId && row.r360Params
        ? {
            setId: row.r360SetId,
            params: row.r360Params,
            // #140: where the frames ARE — recorded at save. The rebuilt
            // prefix is only for a row the backfill could not place.
            frameBase: storage.publicUrl(
              row.r360KeyPrefix ??
                frameSetPrefix(prefix, userId, row.r360SetId),
            ),
          }
        : null;
    return {
      id: row.id,
      name: row.name,
      investor: row.investor,
      developer: row.developer,
      images: imageRows
        .filter((image) => image.workId === row.id)
        .map(imageOf)
        .filter((image): image is WorkImageView => image !== null),
      orbit,
    };
  });
}

/**
 * #102: a new set on a work is verified BEFORE the work's transaction — a
 * listing has no business under the per-user lock. `run` gets the verified
 * set to record its rows with the work; success then drops the
 * reservation, which is what marks the set finished (#126). With no set
 * (`null`), `run` simply runs.
 *
 * #126 took the copy out of here. The frames were uploaded to the keys the
 * rows will name, so there is nothing to move and nothing to take back:
 * a transaction that fails leaves objects that no row names and a
 * reservation that still stands, which is exactly what the sweep collects.
 * The race this used to guard — two saves of one set, the loser deleting
 * the winner's frames — cannot arise, because the loser has nothing of its
 * own to delete; `assertNotRecorded` inside the transaction and the unique
 * index on `works.r360_set_id` still decide which one wins.
 */
async function withFrameSet<T>(
  deps: ProfileDeps,
  set: { r360SetId: string | null; r360Params: R360Params | null } | null,
  run: (verified: VerifiedFrameSet | null) => Promise<T>,
): Promise<T> {
  if (!set?.r360SetId || !set.r360Params) return run(null);
  const verified = await verifyFrameSet(deps, {
    setId: set.r360SetId,
    frameCount: set.r360Params.frameCount,
  });
  const result = await run(verified);
  await settleFrameSet(deps, verified);
  return result;
}

/**
 * The cheap refusals before a set is copied (#102 review): the works
 * limit and the ownership of every file, read without the lock — the
 * transaction repeats them under it; this only spares a few hundred
 * copies and deletes for a save that was never going to go through.
 */
async function assertCouldSave(
  db: Database,
  userId: string,
  parsed: ReturnType<typeof workInputSchema.parse>,
  creating: boolean,
): Promise<void> {
  if (creating) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(works)
      .where(eq(works.userId, userId));
    if (count >= WORKS_MAX) throw new WorksError("limit");
  }
  await assertOwnInput(db, userId, parsed);
}

/** The work's own columns as the form sends them; blank text is null. */
function workColumnsOf(parsed: ReturnType<typeof workInputSchema.parse>) {
  return {
    name: parsed.name,
    investor: parsed.investor || null,
    developer: parsed.developer || null,
    r360SetId: parsed.r360SetId,
    r360Params: parsed.r360Params,
  };
}

// Every file a work is given must be the caller's own confirmed row of the
// right kind — the ownership check #72 makes binding for every file pointer
// (the database alone would accept any files.id).
async function assertOwnFiles(
  db: Database,
  userId: string,
  fileIds: string[],
  kind: "work-original",
  code: "invalid_image",
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
  parsed: { imageFileIds: string[]; secondaryFileIds?: (string | null)[] },
): Promise<void> {
  await assertOwnFiles(
    db,
    userId,
    [
      ...parsed.imageFileIds,
      ...secondariesOf(parsed).filter((id): id is string => id !== null),
    ],
    "work-original",
    "invalid_image",
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
  if (parsed.r360SetId) await assertCouldSave(db, userId, parsed, true);
  return withFrameSet(deps, parsed, (verified) =>
    db.transaction(async (tx) => {
      await lockUser(tx, userId);
      // #66: the count and the last position in one pass, under the lock
      // that already serialises adds — a new work goes after the ones there,
      // wherever the owner has since dragged them.
      const [{ count, lastPosition }] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          lastPosition: sql<number>`coalesce(max(${works.position}), -1)::int`,
        })
        .from(works)
        .where(eq(works.userId, userId));
      if (count >= WORKS_MAX) throw new WorksError("limit");
      await assertOwnInput(tx, userId, parsed);
      if (verified) await assertNotRecorded(tx, userId, verified.setId);
      const [created] = await tx
        .insert(works)
        .values({
          userId,
          ...workColumnsOf(parsed),
          r360KeyPrefix: verified?.keyPrefix ?? null,
          position: lastPosition + 1,
        })
        .returning({ id: works.id });
      await insertImageRows(tx, created.id, parsed);
      if (verified) await insertFrameRows(tx, userId, verified);
      return { id: created.id };
    }),
  );
}

/**
 * #66: the owner's order for their own works, first to last.
 *
 * The request names every work the owner has, and this refuses anything else
 * — an order written while another tab was adding or deleting one would
 * otherwise be applied to a list it was never about, quietly moving works
 * the owner never touched. The client refreshes and the owner drags again,
 * which is the honest outcome of two tabs disagreeing.
 *
 * Positions are rewritten wholesale rather than shuffled, so they stay dense
 * and gap-free; under the same per-user lock as every other works write.
 */
export async function reorderWorks(
  deps: Pick<ProfileDeps, "db" | "userId">,
  workIds: string[],
): Promise<void> {
  const { db, userId } = deps;
  await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const own = await tx
      .select({ id: works.id })
      .from(works)
      .where(eq(works.userId, userId));
    const mine = new Set(own.map((row) => row.id));
    const asked = new Set(workIds);
    if (mine.size !== asked.size || workIds.some((id) => !mine.has(id))) {
      throw new WorksError("stale_order");
    }
    // One statement rather than ten: the lock and the pooled connection are
    // held for a round trip instead of a dozen. The owner is still in the
    // WHERE — the set comparison above is the first answer to "are these
    // yours", this is the second, and neither is a comment about the other.
    const pairs = sql.join(
      workIds.map((id, position) => sql`(${id}::uuid, ${position}::int)`),
      sql`, `,
    );
    await tx.execute(sql`
      update "works" as w
      set "position" = v."position"
      from (values ${pairs}) as v("id", "position")
      where w."id" = v."id" and w."user_id" = ${userId}::uuid
    `);
  });
}

/**
 * Replaces a work's fields, photos and orbit. The photos are a
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
  // The set as the work has it now, read before the transaction: a new one
  // is verified and copied outside the lock (withFrameSet), and one the
  // work already has is left exactly as it is.
  const [current] = await db
    .select({
      r360SetId: works.r360SetId,
      r360Params: works.r360Params,
    })
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)));
  if (!current) throw new WorksError("not_found");
  const setChanges = parsed.r360SetId !== current.r360SetId;
  // The count is detected, not chosen (A13): a kept set keeps its N.
  if (
    !setChanges &&
    parsed.r360SetId !== null &&
    parsed.r360Params?.frameCount !== current.r360Params?.frameCount
  ) {
    throw new WorksError("invalid_set");
  }
  if (setChanges && parsed.r360SetId) {
    await assertCouldSave(db, userId, parsed, false);
  }
  // Only a set the work did not have is staged; one kept is left alone.
  const staging = setChanges ? parsed : null;
  const dropped = await withFrameSet(deps, staging, (verified) =>
    db.transaction(async (tx) => {
      // The same per-user lock create and free take: an attach and a free of
      // the same file never interleave.
      await lockUser(tx, userId);
      const [own] = await tx
        .select({
          id: works.id,
          r360SetId: works.r360SetId,
        })
        .from(works)
        .where(and(eq(works.id, workId), eq(works.userId, userId)))
        .for("update");
      if (!own) throw new WorksError("not_found");
      // Read again under the lock: a save that raced this one is a conflict,
      // not a silent overwrite of its frames.
      if (own.r360SetId !== current.r360SetId)
        throw new WorksError("invalid_set");
      await assertOwnInput(tx, userId, parsed);
      if (verified) await assertNotRecorded(tx, userId, verified.setId);
      const before = await tx
        .select({
          fileId: workImages.fileId,
          secondaryFileId: workImages.secondaryFileId,
        })
        .from(workImages)
        .where(eq(workImages.workId, workId));
      await tx.delete(workImages).where(eq(workImages.workId, workId));
      await insertImageRows(tx, workId, parsed);
      await tx
        .update(works)
        .set({
          ...workColumnsOf(parsed),
          // A new set records where it landed; a removed one clears it. A
          // set kept across an edit keeps the prefix it was saved with —
          // including one saved under another environment's key prefix,
          // which is exactly the work that used to go blank on the next
          // preview (#140).
          ...(setChanges ? { r360KeyPrefix: verified?.keyPrefix ?? null } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(works.id, workId));
      if (verified) await insertFrameRows(tx, userId, verified);
      const kept = new Set([
        ...parsed.imageFileIds,
        ...secondariesOf(parsed).filter((id): id is string => id !== null),
      ]);
      return {
        images: channelsOf(before).filter((fileId) => !kept.has(fileId)),
        sets: own.r360SetId && setChanges ? [own.r360SetId] : [],
      };
    }),
  );
  await freeUnreferenced(deps, dropped);
}

// The rows of a work's photos as given: position, the photo, its second
// channel if any (#99). None at all for a work with an R360 set and no
// photo (#103) — an insert of no rows is an error, not a no-op.
async function insertImageRows(
  tx: Database,
  workId: string,
  parsed: { imageFileIds: string[]; secondaryFileIds?: (string | null)[] },
): Promise<void> {
  if (parsed.imageFileIds.length === 0) return;
  const secondaries = secondariesOf(parsed);
  await tx.insert(workImages).values(
    parsed.imageFileIds.map((fileId, position) => ({
      workId,
      fileId,
      secondaryFileId: secondaries[position] ?? null,
      position,
    })),
  );
}

/** Every file the rows name: the photos and their second channels. */
function channelsOf(
  rows: { fileId: string; secondaryFileId: string | null }[],
): string[] {
  return rows.flatMap((row) =>
    row.secondaryFileId ? [row.fileId, row.secondaryFileId] : [row.fileId],
  );
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
      .select({ id: works.id, r360SetId: works.r360SetId })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, userId)))
      .for("update");
    if (!own) throw new WorksError("not_found");
    const images = await tx
      .select({
        fileId: workImages.fileId,
        secondaryFileId: workImages.secondaryFileId,
      })
      .from(workImages)
      .where(eq(workImages.workId, workId));
    // The image rows go with the work (cascade); the file rows do not.
    await tx.delete(works).where(eq(works.id, workId));
    return {
      images: channelsOf(images),
      sets: own.r360SetId ? [own.r360SetId] : [],
    };
  });
  await freeUnreferenced(deps, dropped);
}

/**
 * Frees a confirmed work photo that never made it onto a work — the owner
 * closed the form after uploading. A file a work still names is left
 * alone.
 */
export async function discardWorkFile(
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
  await freeUnreferenced(deps, { images: [fileId] });
}

// A file is freed only once no work names it — decided and done, rows
// first, under the per-user advisory lock every attach takes, so a
// concurrent attach cannot slip between the check and the delete (the
// `restrict` on work_images.file_id would otherwise fail the row delete
// after the objects were already gone). The objects go last, outside the
// transaction.
async function freeUnreferenced(
  deps: ProfileDeps,
  dropped: { images: string[]; sets?: string[] },
): Promise<void> {
  const sets = dropped.sets ?? [];
  const nothing = [dropped.images, sets].every((ids) => ids.length === 0);
  if (nothing) return;
  const keys = await deps.db.transaction(async (tx) => {
    await lockUser(tx, deps.userId);
    const freed: string[] = [];
    // #102: a set belongs to one work, and its rows are its own since #120
    // — nothing cascades over them any more.
    if (sets.length > 0) {
      freed.push(...(await removeFrameSetRows(tx, deps, sets)));
    }
    if (dropped.images.length > 0) {
      // Named as a photo or as a second channel: either keeps the file.
      const stillUsed = await tx
        .select({
          fileId: workImages.fileId,
          secondaryFileId: workImages.secondaryFileId,
        })
        .from(workImages)
        .where(
          or(
            inArray(workImages.fileId, dropped.images),
            inArray(workImages.secondaryFileId, dropped.images),
          ),
        );
      const used = new Set(channelsOf(stillUsed));
      const free = [...new Set(dropped.images)].filter((id) => !used.has(id));
      freed.push(
        ...(await removeImageSetRows({ ...deps, db: tx }, free, "work")),
      );
    }
    return freed;
  });
  await deleteObjects(deps, keys, "work");
}
