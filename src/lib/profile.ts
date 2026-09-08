import { and, eq, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import { files, profiles, users } from "@/db/schema";
import {
  displayNameSchema,
  profileSectionsSchema,
  type ProfileSectionsInput,
} from "@/lib/profile-schemas";
import { contentKey, type FileStorage } from "@/lib/storage";

// The #14 profile layer: display name, the avatar pointer and, since #72, the
// sections (headline, places, bio). The handle and everything public-facing
// stay with #15/#18 — a profile here is still the signed-in user's own
// settings object.

export class ProfileError extends Error {
  constructor(public readonly code: "invalid_avatar" | "noProfile") {
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
  // #72: the sections. Empty (null, []) both for a profile that has none
  // and for a user with no profile row yet — displayName tells those apart.
  headline: string | null;
  locations: string[];
  bio: string | null;
}

// #49: the address comes from the row that owns the object. `object_key` is
// null only on rows written before that column existed — until
// `scripts/backfill-file-keys.ts` has run in an environment, those fall back
// to the old derivation, which is correct for exactly the environment that
// wrote them and is the bug everywhere else.
function variantUrl(
  storage: Pick<FileStorage, "publicUrl">,
  prefix: string,
  storedKey: string | null,
  sha256: string,
  px: 512 | 128,
): string {
  // The #12 naming contract, kept for the fallback only: variants are keyed
  // by the ORIGINAL's hash + size suffix.
  return storage.publicUrl(
    storedKey ?? contentKey(`${sha256}-${px}`, "webp", prefix),
  );
}

export async function getProfile(deps: ProfileReadDeps): Promise<ProfileView> {
  const { db, storage, prefix, userId } = deps;
  // The two variant rows are joined in by their parent, because each carries
  // the key of its own object (#49). profiles.avatar_file_id points at the
  // ORIGINAL, which is never served (G3).
  const variant512 = alias(files, "variant_512");
  const variant128 = alias(files, "variant_128");
  const [row] = await db
    .select({
      displayName: profiles.displayName,
      headline: profiles.headline,
      locations: profiles.locations,
      bio: profiles.bio,
      avatarFileId: profiles.avatarFileId,
      avatarSha256: files.sha256,
      key512: variant512.objectKey,
      key128: variant128.objectKey,
    })
    .from(profiles)
    .leftJoin(files, eq(profiles.avatarFileId, files.id))
    .leftJoin(
      variant512,
      and(
        eq(variant512.parentFileId, files.id),
        eq(variant512.kind, "avatar-512"),
      ),
    )
    .leftJoin(
      variant128,
      and(
        eq(variant128.parentFileId, files.id),
        eq(variant128.kind, "avatar-128"),
      ),
    )
    .where(eq(profiles.userId, userId));
  if (!row) {
    return {
      displayName: null,
      avatar: null,
      headline: null,
      locations: [],
      bio: null,
    };
  }
  return {
    displayName: row.displayName,
    headline: row.headline,
    locations: row.locations,
    bio: row.bio,
    avatar:
      row.avatarFileId && row.avatarSha256
        ? {
            fileId: row.avatarFileId,
            url512: variantUrl(
              storage,
              prefix,
              row.key512,
              row.avatarSha256,
              512,
            ),
            url128: variantUrl(
              storage,
              prefix,
              row.key128,
              row.avatarSha256,
              128,
            ),
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

// #72: the headline, the places and the bio, any subset per call — the
// owner's page saves each field on blur, so a call usually carries one. An
// empty headline or bio is stored as NULL: "no headline" is one state, not
// two. Unlike the name, a section can never CREATE the profile row (the
// same reasoning as setAvatar's noProfile: a row invented here would have
// no name and fail the not-blank CHECK inside Postgres as a 500).
export async function updateProfileSections(
  deps: Pick<ProfileDeps, "db" | "userId">,
  input: ProfileSectionsInput,
): Promise<void> {
  const parsed = profileSectionsSchema.parse(input);
  const set: Partial<typeof profiles.$inferInsert> = {};
  if (parsed.headline !== undefined) set.headline = parsed.headline || null;
  if (parsed.locations !== undefined) set.locations = parsed.locations;
  if (parsed.bio !== undefined) set.bio = parsed.bio || null;
  if (Object.keys(set).length === 0) return;

  const updated = await deps.db
    .update(profiles)
    .set(set)
    .where(eq(profiles.userId, deps.userId))
    .returning({ userId: profiles.userId });
  if (updated.length === 0) throw new ProfileError("noProfile");
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

    // A photo cannot create the profile row. Whoever uploads one has been
    // through onboarding, which sets the name and the address — and a row
    // invented here would have no name, fail the not-blank CHECK inside
    // PostgreSQL (constraints are evaluated on the tuple being INSERTED,
    // before ON CONFLICT turns it into an update) and surface as a 500.
    // That is exactly what happened on dev on 05.09.2026. Reachable by a
    // direct API call before onboarding, since the session already exists.
    if (!profile) throw new ProfileError("noProfile");
    await tx
      .insert(profiles)
      .values({
        userId,
        displayName: profile.displayName,
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
    .select({
      id: files.id,
      sha256: files.sha256,
      ext: files.ext,
      objectKey: files.objectKey,
    })
    .from(files)
    .where(
      and(
        eq(files.id, originalFileId),
        eq(files.userId, userId),
        eq(files.kind, "avatar-original"),
      ),
    );
  if (!original) return;

  // Content-addressed objects can be shared: by another user's avatar under
  // the pre-#72 `a/` keys, and since #72 by this user's own cover or work
  // photo with the same bytes — a different KIND under the same KEY. So the
  // original's liveness is decided by the key it was written under, not by
  // "another avatar-original with this hash" (#72 review). Rows from before
  // #49 carry no key; for those the hash stands in, as it always did.
  const originalKey =
    original.objectKey ?? contentKey(original.sha256, original.ext, prefix);
  const [sharedObject] = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        ne(files.id, original.id),
        or(
          eq(files.objectKey, originalKey),
          and(
            isNull(files.objectKey),
            isNull(files.parentFileId),
            eq(files.sha256, original.sha256),
          ),
        ),
      ),
    )
    .limit(1);
  // The variant objects are named by this hash with an AVATAR suffix, so
  // only another avatar-original with the same bytes can share them.
  const [sharedVariants] = await db
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

  const keys: string[] = [];
  if (!sharedObject) keys.push(originalKey);
  if (!sharedVariants) {
    // The variants' own rows carry their own keys (#49); they are about to be
    // taken by the parent cascade below, so read them while they exist.
    const variantRows = await db
      .select({ objectKey: files.objectKey, kind: files.kind })
      .from(files)
      .where(eq(files.parentFileId, original.id));
    const variantKey = (kind: "avatar-512" | "avatar-128", px: 512 | 128) =>
      variantRows.find((variant) => variant.kind === kind)?.objectKey ??
      contentKey(`${original.sha256}-${px}`, "webp", prefix);
    keys.push(variantKey("avatar-512", 512), variantKey("avatar-128", 128));
  }
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error("[profile] avatar object cleanup failed:", error);
    }
  }

  // The parent cascade takes the variant rows with the original.
  await db.delete(files).where(eq(files.id, original.id));
}
