import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, profiles, users } from "@/db/schema";
import { displayNameSchema } from "@/lib/profile-schemas";
import { contentKey, type FileStorage } from "@/lib/storage";

// The #14 profile layer: display name and the avatar pointer. The handle and
// everything public-facing stay with #15/#18 — a profile here is still the
// signed-in user's own settings object.

export class ProfileError extends Error {
  constructor(public readonly code: "invalid_avatar") {
    super(`profile update rejected: ${code}`);
    this.name = "ProfileError";
  }
}

export interface ProfileDeps {
  db: Database;
  storage: FileStorage;
  /** Environment key prefix (SPEC §4). */
  prefix: string;
  userId: string;
}

// The read side needs only the URL half of the storage, and only when an
// avatar exists — callers may hand in a lazy publicUrl so a page renders
// without a configured bucket (the local runner has none; #15).
export type ProfileReadDeps = Omit<ProfileDeps, "storage"> & {
  storage: Pick<FileStorage, "publicUrl">;
};

export interface ProfileView {
  displayName: string | null;
  avatar: { fileId: string; url512: string; url128: string } | null;
}

function variantUrl(
  storage: Pick<FileStorage, "publicUrl">,
  prefix: string,
  sha256: string,
  px: 512 | 128,
): string {
  // The #12 naming contract: variants are keyed by the ORIGINAL's hash + size
  // suffix, so the one sha256 on the original's row yields every URL.
  return storage.publicUrl(contentKey(`${sha256}-${px}`, "webp", prefix));
}

export async function getProfile(deps: ProfileReadDeps): Promise<ProfileView> {
  const { db, storage, prefix, userId } = deps;
  const [row] = await db
    .select({
      displayName: profiles.displayName,
      avatarFileId: profiles.avatarFileId,
      avatarSha256: files.sha256,
    })
    .from(profiles)
    .leftJoin(files, eq(profiles.avatarFileId, files.id))
    .where(eq(profiles.userId, userId));
  if (!row) return { displayName: null, avatar: null };
  return {
    displayName: row.displayName,
    avatar:
      row.avatarFileId && row.avatarSha256
        ? {
            fileId: row.avatarFileId,
            url512: variantUrl(storage, prefix, row.avatarSha256, 512),
            url128: variantUrl(storage, prefix, row.avatarSha256, 128),
          }
        : null,
  };
}

export async function updateDisplayName(
  deps: Pick<ProfileDeps, "db" | "userId">,
  displayName: string,
): Promise<void> {
  const parsed = displayNameSchema.parse(displayName);
  await deps.db
    .insert(profiles)
    .values({ userId: deps.userId, displayName: parsed })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { displayName: parsed },
    });
}

export async function setAvatar(
  deps: ProfileDeps,
  fileId: string,
): Promise<void> {
  const { db, userId } = deps;
  // The check-read-swap runs in one transaction serialized per user (FOR
  // UPDATE on the users row, which always exists): without it, two
  // overlapping calls both read the same previous pointer and the losing
  // call's set is never cleaned — permanently quota-charged (#14 review,
  // reproduced). Storage deletes stay OUTSIDE the transaction.
  const previousId = await db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");

    // Only the caller's own avatar-original row can become their avatar.
    const [candidate] = await tx
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.id, fileId),
          eq(files.userId, userId),
          eq(files.kind, "avatar-original"),
        ),
      );
    if (!candidate) throw new ProfileError("invalid_avatar");

    const [profile] = await tx
      .select({
        avatarFileId: profiles.avatarFileId,
        displayName: profiles.displayName,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    const previous = profile?.avatarFileId ?? null;
    if (previous === fileId) return null;

    // Upsert, not insert: the first profile write can race a concurrent
    // updateDisplayName upsert, which does not take the user lock.
    //
    // The name spelled into the INSERT matters even when the row exists and
    // only the avatar is changing: PostgreSQL evaluates constraints on the
    // tuple being inserted BEFORE ON CONFLICT turns it into an update. Since
    // #36 registration leaves users.name empty, using it here failed the
    // not-blank CHECK on every photo upload — so the existing row is asked
    // first. Same trap as setHandle, found the same way: by hand, on dev.
    const [user] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));
    await tx
      .insert(profiles)
      .values({
        userId,
        displayName: profile?.displayName ?? user.name,
        avatarFileId: fileId,
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { avatarFileId: fileId },
      });
    return previous;
  });

  if (previousId) await removeAvatarSet(deps, previousId);
}

// App-mediated cleanup (G2): replacing an avatar frees its quota rows and —
// when no other user's avatar shares the same bytes — its objects. Object
// deletes are best-effort: a failed delete is logged and the rows still go
// (an orphaned `a/` object joins the reconciliation-sweep residue family);
// the reverse order would strand rows that keep charging the quota forever.
// Accepted residual (#14 audit): a confirm of byte-identical content that is
// mid-flight for ANOTHER user (objects put, rows not yet inserted) is
// invisible to the shared check — its avatar 404s until re-uploaded, which
// fully heals. Needs the victim's exact file plus a sub-second window.
async function removeAvatarSet(
  deps: ProfileDeps,
  originalFileId: string,
): Promise<void> {
  const { db, storage, prefix, userId } = deps;
  const [original] = await db
    .select({ id: files.id, sha256: files.sha256, ext: files.ext })
    .from(files)
    .where(
      and(
        eq(files.id, originalFileId),
        eq(files.userId, userId),
        eq(files.kind, "avatar-original"),
      ),
    );
  if (!original) return;

  // Content-addressed objects are shared across users: identical bytes live
  // once. Delete them only when this was the last original referencing them.
  const [shared] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.sha256, original.sha256),
        eq(files.kind, "avatar-original"),
        ne(files.id, original.id),
      ),
    )
    .limit(1);
  if (!shared) {
    const keys = [
      contentKey(original.sha256, original.ext, prefix),
      contentKey(`${original.sha256}-512`, "webp", prefix),
      contentKey(`${original.sha256}-128`, "webp", prefix),
    ];
    for (const key of keys) {
      try {
        await storage.deleteObject(key);
      } catch (error) {
        console.error("[profile] avatar object cleanup failed:", error);
      }
    }
  }

  // The parent cascade takes the variant rows with the original.
  await db.delete(files).where(eq(files.id, original.id));
}
