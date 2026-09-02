import { createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "@/db/client";
import { accounts, profiles, users } from "@/db/schema";
import {
  confirmAvatarUpload,
  presignAvatarUpload,
  type AvatarDeps,
} from "@/lib/avatar";
import { checkHandle, handleBaseFrom } from "@/lib/handle";
import { setAvatar, updateDisplayName } from "@/lib/profile";
import { HandleError, setHandle } from "@/lib/profile-handle";
import type { FileStorage } from "@/lib/storage";

// pnpm db:seed (#17): a dozen-plus sample profiles — accounts, display names,
// handles and generated avatar photos — so a fresh environment shows
// real-looking pages within a minute (SPEC.md G7). The CLI is scripts/seed.ts;
// the data and the logic live here so the integration suite
// (src/db/seed.test.ts) drives them on PGlite with the memory storage fake.
//
// G7 — kept current with the schema and the profile features: a new profile
// field means a new column in SEED_PROFILES and a new step in createProfile;
// a changed profile layer changes the step that calls it, in the same change;
// a changed environment contract (the S3_* names behind isStorageConfigured,
// DATABASE_URL) changes the CLI, scripts/seed.ts. The suite fails the moment
// the seed and the application disagree.
//
// Account-row contract. Accounts are inserted directly, not through
// auth.api.signUpEmail — that would send verification e-mails and trip the
// per-IP sign-up limit (3 per 10 s). The rows mirror what Better Auth 1.7.2
// writes on sign-up (node_modules/better-auth/dist/api/routes/sign-up.mjs,
// asserted by auth.test.ts "stores only a password hash"):
//   users    { name: the e-mail local part (as register-form.tsx sends it),
//              email lowercase, emailVerified: true — the seed stands in for
//              the A1 verification click }
//   accounts { userId, providerId: "credential", issuer: "local:credential",
//              accountId: the user id, password: scrypt from
//              better-auth/crypto's hashPassword — the hasher the app itself
//              uses (auth.ts sets no custom password.hash) }
// A Better Auth upgrade that changes this shape is a change here too.

export const SEED_PASSWORD = "architekt-seed-2026";

// A reserved domain (RFC 2606): no seed address can ever receive mail.
const SEED_EMAIL_DOMAIN = "seed.example";

export interface SeedProfile {
  displayName: string;
  handle: string;
  email: string;
}

// Polish studios and 3D creators, several with diacritics and mixed forms so
// the slugging is exercised: "Pracownia Żółć" → pracownia-zolc, "Loft & Cegła"
// → loft-cegla, "Anna Nowak 3D" → anna-nowak-3d.
const SEED_NAMES: readonly string[] = [
  "Pracownia Żółć",
  "Studio Praga",
  "Atelier Wola",
  "Biuro Projektów Mokotów",
  "Jan Kowalski",
  "Anna Nowak 3D",
  "Formy Przestrzenne",
  "Kreślarnia",
  "Modelarnia Ochota",
  "Wizualizacje Bemowo",
  "Loft & Cegła",
  "Szkic i Bryła",
  "Render Lab Łódź",
  "Cegła i Szkło",
];

function seedProfile(displayName: string): SeedProfile {
  const handle = handleBaseFrom(displayName);
  if (!handle) {
    throw new Error(`seed: "${displayName}" yields no usable handle`);
  }
  return { displayName, handle, email: `${handle}@${SEED_EMAIL_DOMAIN}` };
}

// Asserted at module load: an edit to the names that produces a duplicate or
// an A5 violation fails before anything touches a database.
function assertHandles(profiles: readonly SeedProfile[]): void {
  const seen = new Set<string>();
  for (const { handle } of profiles) {
    const problem = checkHandle(handle);
    if (problem) throw new Error(`seed: handle "${handle}" is ${problem}`);
    if (seen.has(handle)) throw new Error(`seed: duplicate handle "${handle}"`);
    seen.add(handle);
  }
}

export const SEED_PROFILES: readonly SeedProfile[] =
  SEED_NAMES.map(seedProfile);
assertHandles(SEED_PROFILES);

// ---- Photos --------------------------------------------------------------

const AVATAR_PX = 512;

// Plain HSL → #rrggbb (the CSS Color 4 algorithm), so the SVG carries a
// literal hex color and never depends on the rasterizer's hsl() support.
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number): string => {
    const k = (n + hue / 30) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// Deterministic per name — a hue from the name's sha256 — and kept dark
// enough (45 % saturation, 38 % lightness) for white initials to read.
function backgroundHex(displayName: string): string {
  const digest = createHash("sha256").update(displayName).digest();
  return hslToHex(digest.readUInt16BE(0) % 360, 0.45, 0.38);
}

// Up to two initials, ASCII-folded exactly like the handle ("Loft & Cegła" →
// "LC", "Kreślarnia" → "K"): librsvg on a fontless CI runner still gets plain
// letters, and [a-z0-9] needs no XML escaping.
function initialsOf(displayName: string): string {
  const slug = handleBaseFrom(displayName) ?? "";
  const initials = slug
    .split("-")
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return initials || "?";
}

/** A 512×512 PNG: white initials on a color derived from the name. */
export async function avatarPng(displayName: string): Promise<Buffer> {
  // Named faces first: the Windows sharp build ignores a bare `sans-serif`,
  // so the initials would not render there. DejaVu Sans is what the Linux
  // runners carry, Arial/Helvetica what Windows and macOS have; the generic
  // family stays as the last resort.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR_PX}" height="${AVATAR_PX}">
  <rect width="100%" height="100%" fill="${backgroundHex(displayName)}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="220" font-weight="700" fill="#ffffff">${initialsOf(displayName)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---- Seeding -------------------------------------------------------------

export interface SeedDeps {
  db: Database;
  /** null when no bucket is configured: accounts, names and handles only. */
  storage: FileStorage | null;
  /** Environment key prefix (keyPrefix(); SPEC.md §4). */
  prefix: string;
  log: (line: string) => void;
}

/** Handles, in SEED_PROFILES order. */
export interface SeedSummary {
  created: string[];
  skipped: string[];
  /** Profiles that got a photo in this run: created with one, or resumed. */
  photos: string[];
}

type CreateOutcome =
  | { kind: "created"; userId: string }
  | { kind: "skipped"; reason: "e-mail exists" | "handle taken" }
  // Ours from an earlier run without a storage — the seed's handle on the
  // seed's e-mail, avatar_file_id NULL — and a storage is present now.
  | { kind: "photo missing"; userId: string };

// The account-row contract from the header, in one place: the users row and
// its credential account exactly as Better Auth 1.7.2 leaves them after
// sign-up. Returns the new user's id.
async function insertAccount(
  db: Database,
  profile: SeedProfile,
  password: string,
): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      name: profile.email.split("@")[0],
      email: profile.email,
      emailVerified: true,
    })
    .returning({ id: users.id });
  await db.insert(accounts).values({
    userId: user.id,
    providerId: "credential",
    issuer: "local:credential",
    accountId: user.id,
    password,
  });
  return user.id;
}

// The account and its profile land in ONE transaction: a failure part-way —
// the handle already held by a real account, say — leaves no half-profile
// behind that the e-mail check would then skip on every later run. The
// profile layers take the transaction as their Database; setHandle's own
// transaction nests as a savepoint.
async function createProfile(
  db: Database,
  profile: SeedProfile,
  canAddPhoto: boolean,
): Promise<CreateOutcome> {
  const [existing] = await db
    .select({
      id: users.id,
      handle: profiles.handle,
      avatarFileId: profiles.avatarFileId,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.email, profile.email));
  if (existing) {
    // The seed's own account is told from a real user's by the handle: a
    // different one means someone registered the address, and it stays theirs.
    const ours = existing.handle === profile.handle;
    if (ours && existing.avatarFileId === null && canAddPhoto) {
      return { kind: "photo missing", userId: existing.id };
    }
    return { kind: "skipped", reason: "e-mail exists" };
  }

  // scrypt takes ~100 ms — hashed before the transaction opens, per account
  // (a fresh salt each, as sign-up would).
  const password = await hashPassword(SEED_PASSWORD);
  try {
    return await db.transaction(async (tx) => {
      const userId = await insertAccount(tx, profile, password);
      await updateDisplayName({ db: tx, userId }, profile.displayName);
      // An initial assignment: no cooldown stamp (A6).
      await setHandle(tx, userId, profile.handle);
      return { kind: "created", userId };
    });
  } catch (error) {
    if (error instanceof HandleError && error.code === "taken") {
      return { kind: "skipped", reason: "handle taken" };
    }
    throw error;
  }
}

// The #12 pipeline end to end, the seed standing in for the browser's PUT:
// presign → put the bytes on the staging key → confirm (decode-verify,
// variants, files rows) → point the profile at the original. Never a files
// row or an object written by hand.
async function uploadAvatar(
  deps: AvatarDeps,
  displayName: string,
): Promise<void> {
  const png = await avatarPng(displayName);
  const { stagingKey } = await presignAvatarUpload(deps, {
    sizeBytes: png.length,
    contentType: "image/png",
  });
  await deps.storage.putObject(stagingKey, png, "image/png");
  const confirmed = await confirmAvatarUpload(deps, { stagingKey });
  await setAvatar(deps, confirmed.original.fileId);
}

/**
 * Seed every SEED_PROFILES entry that does not exist yet. Idempotent: an
 * existing e-mail (or a handle held by another account) is skipped and
 * reported; nothing is ever deleted. Photos only with a storage — and
 * resumable: a seed account left without one by an earlier run gets its
 * photo the first time a storage is present.
 */
export async function seedProfiles(deps: SeedDeps): Promise<SeedSummary> {
  const { db, storage, prefix, log } = deps;
  const summary: SeedSummary = { created: [], skipped: [], photos: [] };
  for (const profile of SEED_PROFILES) {
    const { handle } = profile;
    const outcome = await createProfile(db, profile, storage !== null);
    if (outcome.kind === "skipped") {
      summary.skipped.push(handle);
      log(`skipped  ${handle}  (${outcome.reason})`);
      continue;
    }
    if (storage) {
      await uploadAvatar(
        { db, storage, prefix, userId: outcome.userId },
        profile.displayName,
      );
      summary.photos.push(handle);
    }
    if (outcome.kind === "photo missing") {
      log(`photo    ${handle}  added`);
      continue;
    }
    summary.created.push(handle);
    log(`created  ${handle}  ${storage ? "with photo" : "no photo"}`);
  }
  return summary;
}
