import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { files, profiles, users } from "@/db/schema";
import {
  displayNameSchema,
  profileSectionsSchema,
  type ProfileSectionsInput,
} from "@/lib/profile-schemas";
import { IMAGE_PROFILES } from "@/lib/image-upload-shared";
import { contentKey, type FileStorage } from "@/lib/storage";

// The #14 profile layer: display name, the two image pointers (avatar,
// and since #72 the cover) and the sections (headline, places, bio). The
// handle and everything public-facing stay with #15/#18 — a profile here
// is still the signed-in user's own settings object.

export class ProfileError extends Error {
  constructor(
    public readonly code: "invalid_avatar" | "invalid_cover" | "noProfile",
  ) {
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
// image exists — callers may hand in a lazy publicUrl so a page renders
// without a configured bucket (the local runner has none; #15).
export type ProfileReadDeps = Omit<ProfileDeps, "storage"> & {
  storage: Pick<FileStorage, "publicUrl">;
};

export interface ProfileView {
  displayName: string | null;
  avatar: { fileId: string; url512: string; url128: string } | null;
  // #72: the cover's two width-bound variants (A12).
  cover: { fileId: string; url1600: string; url480: string } | null;
  // #72: the sections. Empty (null, []) both for a profile that has none
  // and for a user with no profile row yet — displayName tells those apart.
  headline: string | null;
  locations: string[];
  bio: string | null;
}

// The two image slots a profile has: the column that points at the
// ORIGINAL's row, and what that row must be — the kind and the variants
// from the purpose table the pipeline publishes by (one place for a size).
const IMAGE_SLOTS = {
  avatar: {
    column: profiles.avatarFileId,
    columnName: "avatarFileId" as const,
    invalid: "invalid_avatar" as const,
    ...IMAGE_PROFILES.avatar,
  },
  cover: {
    column: profiles.coverFileId,
    columnName: "coverFileId" as const,
    invalid: "invalid_cover" as const,
    ...IMAGE_PROFILES.cover,
  },
};
type ImageSlot = keyof typeof IMAGE_SLOTS;

// #49: the address comes from the row that owns the object. A variant row
// that is missing (an insert that never landed) is addressed next to its
// original: the pipeline names variants by the original's key with the
// size suffix, in whichever layout the original sits. Rows written before
// the column existed carry no key at all — until
// `scripts/backfill-file-keys.ts` has run in an environment, those fall
// back to the pre-#72 `a/` derivation, which is correct for exactly the
// environment that wrote them and is the bug everywhere else.
function variantKeyOf(
  original: { objectKey: string | null; sha256: string },
  size: number,
  prefix: string,
): string {
  return original.objectKey
    ? original.objectKey.replace(/\.\w+$/, `-${size}.webp`)
    : contentKey(`${original.sha256}-${size}`, "webp", prefix);
}

export async function getProfile(deps: ProfileReadDeps): Promise<ProfileView> {
  const { db, storage, prefix, userId } = deps;
  const [row] = await db
    .select({
      displayName: profiles.displayName,
      headline: profiles.headline,
      locations: profiles.locations,
      bio: profiles.bio,
      avatarFileId: profiles.avatarFileId,
      coverFileId: profiles.coverFileId,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!row) {
    return {
      displayName: null,
      avatar: null,
      cover: null,
      headline: null,
      locations: [],
      bio: null,
    };
  }

  // The two originals and their variant rows in one read (#49: each variant
  // carries the key of its own object). The pointers name the ORIGINALS,
  // which are never served (G3); pages build their URLs from the variants.
  const originalIds = [row.avatarFileId, row.coverFileId].filter(
    (id): id is string => id !== null,
  );
  const imageRows =
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
              or(
                inArray(files.id, originalIds),
                inArray(files.parentFileId, originalIds),
              ),
            ),
          );
  const urlsOf = (slot: ImageSlot, originalId: string | null) => {
    if (!originalId) return null;
    const original = imageRows.find((image) => image.id === originalId);
    if (!original) return null;
    const { variants } = IMAGE_SLOTS[slot];
    const urls = variants.map(({ kind, size }) =>
      storage.publicUrl(
        imageRows.find(
          (image) => image.parentFileId === originalId && image.kind === kind,
        )?.objectKey ?? variantKeyOf(original, size, prefix),
      ),
    );
    return { fileId: originalId, urls };
  };
  const avatar = urlsOf("avatar", row.avatarFileId);
  const cover = urlsOf("cover", row.coverFileId);

  return {
    displayName: row.displayName,
    headline: row.headline,
    locations: row.locations,
    bio: row.bio,
    avatar: avatar
      ? {
          fileId: avatar.fileId,
          url512: avatar.urls[0],
          url128: avatar.urls[1],
        }
      : null,
    cover: cover
      ? { fileId: cover.fileId, url1600: cover.urls[0], url480: cover.urls[1] }
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

export function setAvatar(deps: ProfileDeps, fileId: string): Promise<void> {
  return setProfileImage(deps, "avatar", fileId);
}

/** #72: the cover photo; null takes it down and frees its set. */
export function setCover(
  deps: ProfileDeps,
  fileId: string | null,
): Promise<void> {
  return setProfileImage(deps, "cover", fileId);
}

// One routine for both image slots: point the profile at a confirmed
// original of the right kind — the caller's own, never anyone else's (the
// database alone would accept any files.id; this is the ownership check
// #72 makes binding for every file pointer) — and free the set it replaces.
async function setProfileImage(
  deps: ProfileDeps,
  slot: ImageSlot,
  fileId: string | null,
): Promise<void> {
  const { db, userId } = deps;
  const { column, columnName, originalKind, invalid } = IMAGE_SLOTS[slot];
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

    if (fileId !== null) {
      const [candidate] = await tx
        .select({ id: files.id })
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            eq(files.userId, userId),
            eq(files.kind, originalKind),
          ),
        );
      if (!candidate) throw new ProfileError(invalid);
    }

    const [profile] = await tx
      .select({ current: column, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    const previous = profile?.current ?? null;
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
      .update(profiles)
      .set({ [columnName]: fileId })
      .where(eq(profiles.userId, userId));
    return previous;
  });

  if (previousId) await removeImageSet(deps, previousId, slot);
}

// App-mediated cleanup (G2): replacing an image frees its quota rows and
// its objects — each object only when no OTHER row still names its key.
// Keys can be shared: by another user's avatar under the pre-#72 `a/`
// layout, and since #72 by this user's own cover or work photo with the
// same bytes (a different kind, the same key). Rows from before #49 carry
// no key; for those the hash stands in, as it always did. Object deletes
// are best-effort: a failed delete is logged and the rows still go (an
// orphaned object joins the reconciliation-sweep residue family); the
// reverse order would strand rows that keep charging the quota forever.
// Accepted residual (#14 audit): a confirm of byte-identical content that
// is mid-flight for another row (objects put, rows not yet inserted) is
// invisible to the check — that image 404s until re-uploaded, which fully
// heals. Needs the exact bytes plus a sub-second window.
async function removeImageSet(
  deps: ProfileDeps,
  originalFileId: string,
  slot: ImageSlot,
): Promise<void> {
  const { db, storage, prefix, userId } = deps;
  const { originalKind, variants } = IMAGE_SLOTS[slot];
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
        eq(files.kind, originalKind),
      ),
    );
  if (!original) return;

  // The set's rows carry their own keys (#49); the variant rows are about to
  // be taken by the parent cascade, so read them while they exist.
  const variantRows = await db
    .select({ id: files.id, objectKey: files.objectKey, kind: files.kind })
    .from(files)
    .where(eq(files.parentFileId, original.id));
  // A set in the pre-#72 `a/` layout — written before #49 (no keys) or
  // backfilled into that layout — shares its objects with every other
  // account's set of the same bytes, whose rows may still carry no key at
  // all. So for such a set a keyless parentless row with the same hash keeps
  // every one of its keys alive. A set under its owner is judged by its keys
  // alone: nothing but its own rows can name them.
  const legacyLayout =
    original.objectKey === null ||
    original.objectKey === contentKey(original.sha256, original.ext, prefix);
  const setKeys = [
    original.objectKey ?? contentKey(original.sha256, original.ext, prefix),
    ...variants.map(
      ({ kind, size }) =>
        variantRows.find((variant) => variant.kind === kind)?.objectKey ??
        variantKeyOf(original, size, prefix),
    ),
  ];
  // The set's own rows (the original and its variants) are about to go, so
  // they never count as "still referenced".
  const setIds = [original.id, ...variantRows.map((variant) => variant.id)];

  for (const key of setKeys) {
    // Still named by a row outside this set: the object stays.
    const [shared] = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          notInArray(files.id, setIds),
          legacyLayout
            ? or(
                eq(files.objectKey, key),
                and(
                  isNull(files.objectKey),
                  isNull(files.parentFileId),
                  eq(files.sha256, original.sha256),
                ),
              )
            : eq(files.objectKey, key),
        ),
      )
      .limit(1);
    if (shared) continue;
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error(`[profile] ${slot} object cleanup failed:`, error);
    }
  }

  // The parent cascade would take the variant rows with the original; naming
  // them too keeps the delete honest about what it removes.
  await db.delete(files).where(inArray(files.id, setIds));
}
