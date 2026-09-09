import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { files, works } from "@/db/schema";
import type { ProfileDeps } from "@/lib/profile";
import { ARCHIVE_CLAIM_HOURS } from "@/lib/works";
import { frameSetUrlSeconds } from "./frame-set";
import { R360_MAX_FRAMES } from "./frame-names";

// #105 (step 7 of #68, A13): an archive that reached the bucket while its
// frames did not is not sent twice. The owner is offered it on the form
// (this user's, not named by any work, younger than the orphan sweep) and,
// accepting, claims it — the sweep leaves a claimed archive alone — and
// gets a short-lived signed GET the browser reads the frames from again
// by Range (#101's remote reader). No byte of it passes through the server.

export class ArchiveResumeError extends Error {
  constructor(public readonly code: "not_found") {
    super(`archive resume rejected: ${code}`);
    this.name = "ArchiveResumeError";
  }
}

export interface UnattachedArchive {
  fileId: string;
  sizeBytes: number;
  createdAt: Date;
}

/** This user's archives no work names, younger than the sweep's day. */
export async function listUnattachedArchives(
  deps: Pick<ProfileDeps, "db" | "userId">,
  youngerThanHours = 24,
): Promise<UnattachedArchive[]> {
  const rows = await deps.db
    .select({
      fileId: files.id,
      sizeBytes: files.sizeBytes,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(works, eq(works.r360FileId, files.id))
    .where(
      and(
        eq(files.userId, deps.userId),
        eq(files.kind, "r360-zip"),
        isNull(works.id),
        gt(
          files.createdAt,
          sql`now() - make_interval(hours => ${youngerThanHours})`,
        ),
      ),
    )
    .orderBy(desc(files.createdAt))
    .limit(5);
  return rows;
}

/**
 * Claims the archive and hands out the address to read it from: the
 * claim first, so the sweep on the next presign cannot take the archive
 * from under the reader; the URL lives as long as a set's (#102).
 */
export async function claimArchive(
  deps: ProfileDeps,
  input: { fileId: string },
): Promise<{
  downloadUrl: string;
  sizeBytes: number;
  expiresInSeconds: number;
}> {
  const [claimed] = await deps.db
    .update(files)
    .set({ claimedAt: sql`now()` })
    .where(
      and(
        eq(files.id, input.fileId),
        eq(files.userId, deps.userId),
        eq(files.kind, "r360-zip"),
      ),
    )
    .returning({ objectKey: files.objectKey, sizeBytes: files.sizeBytes });
  if (!claimed?.objectKey) throw new ArchiveResumeError("not_found");
  const expiresInSeconds = Math.min(
    frameSetUrlSeconds(R360_MAX_FRAMES),
    ARCHIVE_CLAIM_HOURS * 3600,
  );
  const downloadUrl = await deps.storage.presignDownload(claimed.objectKey, {
    expiresInSeconds,
  });
  return { downloadUrl, sizeBytes: claimed.sizeBytes, expiresInSeconds };
}
