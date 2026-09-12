import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Source of truth for drizzle-kit (SPEC.md §4); migrations in drizzle/ are the
// source of truth for the database (G6).
//
// users/sessions/accounts/verifications follow the Better Auth 1.7 core schema
// (https://www.better-auth.com/docs/concepts/database, verified 30.08.2026
// against the INSTALLED 1.7.2 packages — the live docs run ahead of it).
// Contract for the auth task (#7):
//   advanced.database.generateId: "uuid" — the documented option that disables
//     application-side id generation; with the PostgreSQL adapter the database
//     generates the UUID itself (SPEC.md §9).
//   drizzleAdapter(db, { provider: "pg", usePlural: true, schema }) with NO
//     `fields` mappings — the adapter resolves fields by the TS property names
//     below (they are the Better Auth defaults); drizzle itself maps them to
//     the snake_case columns.
//   1.7.2 stores account.issuer = "local:credential" for credential accounts
//     unconditionally; the docs' account.identityStrategy option ships in a
//     later release — do not add it while pinned to 1.7.2.
//   Emails: normalize to lowercase at the Zod edge; users_email_lower_unique
//     is the database-side guard against case-variant duplicates (A1).

function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}

// The stored value must already be lowercase — inserting a case-variant
// handle fails instead of creating a look-alike row (SPEC.md §9, A5).
function lowercaseCheck(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} = lower(${column})`);
}

// Factories, not shared instances: drizzle column builders are one-shot
// mutable configs — a shared instance aliases metadata across tables, and a
// future .unique() or .references() chained on one would silently bind them all.
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
const authTimestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // NOT the display name and NOT the handle — three fields, two of them
    // called "name", and the confusion has already cost a debugging session.
    // Better Auth requires this column on sign-up; nothing in this product
    // reads it and nobody sees it. Since #36 it is written EMPTY on purpose:
    // it used to hold the e-mail local part, which then leaked into
    // profiles.display_name and into the proposed handle.
    //
    //   profiles.handle        the public address, in the URL
    //   profiles.display_name  the name shown on the profile and in links
    //   users.name             this. A library requirement, kept blank.
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // #29: flipped on by the Better Auth two-factor plugin when a user enrolls
    // in a second factor (e-mail OTP or an authenticator app).
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    ...authTimestamps(),
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(lower(table.email))],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...authTimestamps(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    // scrypt hash for provider_id = 'credential' (A2: hashes only in our Postgres)
    password: text("password"),
    ...authTimestamps(),
  },
  (table) => [
    uniqueIndex("accounts_issuer_account_id_unique").on(
      table.issuer,
      table.accountId,
    ),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...authTimestamps(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// #29: the Better Auth two-factor plugin's per-user 2FA record. Exported
// `twoFactors` (plural) so the drizzle adapter resolves the plugin model
// `twoFactor` under usePlural, same as users/sessions/... The plugin encrypts
// `secret` and `backupCodes` at rest itself (symmetricEncrypt with AUTH_SECRET),
// so no plaintext seed is ever stored; the columns are opaque ciphertext to us.
export const twoFactors = pgTable(
  "two_factors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    // false only between TOTP enrollment and the confirming code; e-mail-OTP
    // enrollment and the default both leave it true.
    verified: boolean("verified").notNull().default(true),
    // Challenge-failure counter and lock window (plugin default 10 fails →
    // 15 min lock) for the TOTP and backup-code factors, which have a row to
    // track. E-mail OTP enrolls row-less, so it is capped per-code instead —
    // never by these columns (see the note in src/lib/auth.ts).
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  // One 2FA record per user (the plugin upserts by user_id) — the unique index
  // enforces that and serves the by-user lookup on every challenge.
  (table) => [uniqueIndex("two_factors_user_id_unique").on(table.userId)],
);

// SPEC.md §9: a handle is an attribute, not an identifier — despite uniqueness
// it is never the target of a foreign key; every relation points at users.id.
// Handles are stored pre-normalized (CHECK lowercase), so the plain unique
// index delivers §9's case-insensitive uniqueness AND serves equality lookups.
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    // Nullable: assigned during onboarding (#15); unique index ignores NULLs.
    handle: text("handle"),
    handleChangedAt: timestamp("handle_changed_at", { withTimezone: true }),
    avatarFileId: uuid("avatar_file_id").references(
      (): AnyPgColumn => files.id,
      { onDelete: "set null" },
    ),
    // #72 (decision of 08.09.2026): the profile sections beyond name, photo
    // and address. All optional — a profile is complete without them.
    //   headline   one line under the name, A12: up to 220 characters
    //   locations  where the studio sits and works: a short list of places,
    //              each a TERYT name or free text (A12) — text[] rather than
    //              a table, because a place is a label, never a key
    //   bio        A12: up to 1500 characters, line breaks kept
    //   cover      the photo across the top of the card; the ORIGINAL's row,
    //              as avatar_file_id is — variants hang off it by parent
    headline: text("headline"),
    locations: text("locations")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    bio: text("bio"),
    coverFileId: uuid("cover_file_id").references((): AnyPgColumn => files.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("profiles_handle_unique").on(table.handle),
    lowercaseCheck("profiles_handle_lowercase", table.handle),
    // NOT NULL does not stop the empty string, and this column is what the
    // public page and every shared link display. Registration deliberately
    // sends an empty name now (#36) — the name is asked for in onboarding —
    // so the one thing that must not happen is that emptiness arriving here
    // and publishing a nameless profile.
    check(
      "profiles_display_name_not_blank",
      sql`length(btrim(${table.displayName})) > 0`,
    ),
    index("profiles_avatar_file_id_idx").on(table.avatarFileId),
    index("profiles_cover_file_id_idx").on(table.coverFileId),
    // The A12 lengths, repeated from lib/profile-schemas.ts on purpose (#39:
    // what the database refuses, the form must refuse first). The literals
    // are pinned to the Zod constants by src/db/schema.test.ts.
    check(
      "profiles_headline_length",
      sql`${table.headline} IS NULL OR length(${table.headline}) <= 220`,
    ),
    check(
      "profiles_bio_length",
      sql`${table.bio} IS NULL OR length(${table.bio}) <= 1500`,
    ),
    check(
      "profiles_locations_count",
      sql`cardinality(${table.locations}) <= 8`,
    ),
    // A CHECK cannot look at each element (no subqueries in DDL), so the
    // per-place 80 is held from two sides: no NULL element — one would come
    // back as null inside a string[] — and a total no longer than 8 × 80.
    check(
      "profiles_locations_no_null",
      sql`array_position(${table.locations}, NULL) IS NULL`,
    ),
    check(
      "profiles_locations_total_length",
      sql`length(array_to_string(${table.locations}, '')) <= 640`,
    ),
  ],
);

// #72: a work (realizacja) on a profile. At most 10 per profile — counted
// by the application under the same per-user advisory lock the quota uses,
// because a CHECK cannot count rows. Order on the page is the order of
// adding (created_at); a position column arrives with reordering, if ever.
// Cascade from users on purpose: a work is nothing but profile content, and
// the files it points at are what actually blocks a user's deletion (their
// rows restrict), which forces the object cleanup through code (G2).
export const works = pgTable(
  "works",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    investor: text("investor"),
    developer: text("developer"),
    // #102 (A13): the frame set the owner's browser derived from a zip on
    // their own disk — the prefix `u/<user>/r360/<set id>/` the frames sit
    // under (32 hex digits minted at presign) — and the six viewer
    // parameters: frame count, direction, frames per picture width, start
    // frame and ring flattening (#68), and whether the orbit glides
    // (#153). Both or neither: a set without parameters cannot be shown,
    // parameters without a set describe nothing.
    //
    // #120: there is no archive column any more. The zip never leaves the
    // owner's machine, so the work names its frames and nothing else.
    r360SetId: text("r360_set_id"),
    r360Params: jsonb("r360_params").$type<R360ParamsRow>(),
    // #140: WHERE the set's frames are, as a storage key prefix — recorded
    // at save, not rebuilt from the environment at every read. Rebuilt, it
    // was `<this environment's prefix>u/<user>/r360/<set>/`, and a work made
    // on one preview pointed at nothing on the next (previews share dev's
    // database, each under its own key prefix): its orbit showed empty, its
    // frames answered AccessDenied, and deleting it freed none of them.
    // Photos have carried their own keys since #49; this is the orbit
    // catching up. Null on a row the backfill could not place — the reader
    // falls back to the rebuilt prefix, which is what it did before.
    r360KeyPrefix: text("r360_key_prefix"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // The profile page lists a user's works in adding order.
    index("works_user_id_created_at_idx").on(table.userId, table.createdAt),
    // #102 review: a set belongs to one work — the second save of one set
    // is refused by the code and, should it slip past, by the database.
    uniqueIndex("works_r360_set_id_unique").on(table.r360SetId),
    check(
      "works_r360_set_pairing",
      sql`(${table.r360SetId} IS NULL) = (${table.r360Params} IS NULL)`,
    ),
    check(
      "works_r360_set_id_format",
      sql`${table.r360SetId} IS NULL OR ${table.r360SetId} ~ '^[0-9a-f]{32}$'`,
    ),
    // A recorded prefix names THIS work's set and nothing else: it ends in
    // `/r360/<the work's own set id>/`. A prefix pointing at another set
    // would show one work's frames on another's card.
    check(
      "works_r360_key_prefix_names_the_set",
      sql`${table.r360KeyPrefix} IS NULL OR (${table.r360SetId} IS NOT NULL AND right(${table.r360KeyPrefix}, 39) = '/r360/' || ${table.r360SetId} || '/')`,
    ),
    // Same guard as the display name (#36): NOT NULL does not stop "".
    check("works_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("works_name_length", sql`length(${table.name}) <= 120`),
    check(
      "works_investor_length",
      sql`${table.investor} IS NULL OR length(${table.investor}) <= 120`,
    ),
    check(
      "works_developer_length",
      sql`${table.developer} IS NULL OR length(${table.developer}) <= 120`,
    ),
  ],
);

// #72: the one to three photos of a work. Position 0 is the MAIN photo —
// the one that dominates the card and stands for the work wherever a single
// image is needed; choosing another main reorders the positions rather than
// flipping a flag that could disagree with them (decision of 08.09.2026).
// Reordering is a delete-and-reinsert of the work's rows in one transaction:
// the primary key is not deferrable, so no sequence of UPDATEs can swap two
// positions without passing through a duplicate. The image rows go with
// their work (cascade); the file rows do not go with the image rows
// (restrict) — removing a photo has to reach the object.
export const workImages = pgTable(
  "work_images",
  {
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    /** #99: the photo's second channel — the same view, the other way
     * (before/after, day/night, render/photograph); none for most. */
    secondaryFileId: uuid("secondary_file_id").references(() => files.id, {
      onDelete: "restrict",
    }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.position] }),
    // A channel is another picture, not the same one twice.
    check(
      "work_images_secondary_differs",
      sql`${table.secondaryFileId} IS NULL OR ${table.secondaryFileId} <> ${table.fileId}`,
    ),
    index("work_images_secondary_file_id_idx").on(table.secondaryFileId),
    // The same photo twice in one work is a mistake, not a layout.
    uniqueIndex("work_images_work_id_file_id_unique").on(
      table.workId,
      table.fileId,
    ),
    // Postgres does not index FK source columns; the "is this file still
    // used" question before an object delete scans by file.
    index("work_images_file_id_idx").on(table.fileId),
    // A12: at most three photos, so positions are exactly 0, 1, 2.
    check(
      "work_images_position_range",
      sql`${table.position} >= 0 AND ${table.position} <= 2`,
    ),
  ],
);

export const handleRedirects = pgTable(
  "handle_redirects",
  {
    oldHandle: text("old_handle").primaryKey(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    lowercaseCheck("handle_redirects_old_handle_lowercase", table.oldHandle),
    index("handle_redirects_target_user_id_idx").on(table.targetUserId),
  ],
);

// One value per stored representation. An `-original` (and the zip) has no
// parent; every other value is a variant hanging off its original by
// parent_file_id. Appended in place (ALTER TYPE ... ADD VALUE): an enum
// value can be added but never removed, so the list only grows.
// #87 / A12: every locality in Poland, from the GUS TERYT registers, for
// the place suggestions — reference data the import script owns
// (scripts/import-teryt.ts) and the app only reads. Searched by the folded
// name's prefix, hence the text_pattern_ops index; ranked so a whole place
// comes before a part of one (see PLACE_RANK in lib/places).
export const placeKind = pgEnum("place_kind", [
  "voivodeship",
  "county",
  "commune",
  "city",
  "village",
  "settlement",
  "part",
]);

export const places = pgTable(
  "places",
  {
    /** TERYT-derived: w<woj>, p<woj><pow>, g<woj><pow><gmi><rodz>, s<sym>. */
    code: text("code").primaryKey(),
    kind: placeKind("kind").notNull(),
    rank: smallint("rank").notNull(),
    name: text("name").notNull(),
    nameFolded: text("name_folded").notNull(),
    commune: text("commune"),
    county: text("county"),
    countyKind: text("county_kind").$type<"county" | "cityCounty">(),
    voivodeship: text("voivodeship"),
    /** The register's "stan na" date the row came from. */
    asOf: date("as_of").notNull(),
  },
  (table) => [
    check("places_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("places_rank_range", sql`${table.rank} BETWEEN 0 AND 9`),
    check(
      "places_county_kind_known",
      sql`${table.countyKind} IS NULL OR ${table.countyKind} IN ('county', 'cityCounty')`,
    ),
    index("places_name_folded_prefix_idx").on(
      table.nameFolded.op("text_pattern_ops"),
    ),
    index("places_kind_idx").on(table.kind),
  ],
);

export const fileKind = pgEnum("file_kind", [
  "avatar-original",
  "avatar-512",
  "avatar-128",
  // #72: the cover across the top of the profile card, and a work's photos —
  // two WebP widths each (A12), aspect ratio kept, the original private.
  "cover-original",
  "cover-1600",
  "cover-480",
  "work-original",
  "work-1600",
  "work-480",
  // #72: a work's R360 archive, stored as uploaded; #68 processes it.
  "r360-zip",
  // #102: the archive's frames, encoded in the owner's browser (A13) — N
  // rows of each width under the archive's row.
  "r360-1600",
  "r360-800",
]);

/** #102: works.r360_params as stored — the shape lib/r360 pins with Zod. */
export interface R360ParamsRow {
  frameCount: number;
  direction: 1 | -1;
  framesPerWidth: number;
  startFrame: number;
  flattening: number;
  /** #107: labelled frames; absent on a work saved before them. */
  cues?: { frame: number; label: string }[];
  /**
   * #153: whether the orbit eases and coasts. Absent is ON — the field
   * arrived after works were saved — so only `false` is ever written.
   */
  glide?: boolean;
}

// #30: a staged upload is bytes that already exist in the bucket but have no
// `files` row yet, so without this table the A9 quota cannot see them — and
// presign is rate-limited to 10/min at 10 MB each, which is 100 MB a minute
// per account outside the accounting. The bucket lifecycle rule cannot close
// that: S3 expiration is expressed in whole days while the staging TTL is 120
// seconds, so it sweeps up to a day late and stays a backstop only.
//
// A row is written when the URL is minted and dropped when the upload is
// confirmed or discarded; anything still here past `expires_at` is a browser
// that walked away, swept by the application on that user's next presign.
export const pendingUploads = pgTable(
  "pending_uploads",
  {
    // The staging key is the identity: random, user-bound, one per presign.
    stagingKey: text("staging_key").primaryKey(),
    // restrict like `files`, and for the same reason: the row points at an S3
    // object, so removing a user has to go through code that deletes objects.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // The DECLARED size. The presign signature pins content-length, so the
    // bucket cannot accept a different byte count — which is what makes
    // charging for bytes that have not arrived yet honest.
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    // Past this the row stops counting against the quota even before the
    // sweep removes it, so a walked-away browser never holds quota hostage.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    // Covering index for the quota SUM, mirroring files(user_id, size_bytes).
    index("pending_uploads_user_id_size_bytes_idx").on(
      table.userId,
      table.sizeBytes,
    ),
    // The sweep selects this user's expired rows.
    index("pending_uploads_user_id_expires_at_idx").on(
      table.userId,
      table.expiresAt,
    ),
    // This table's whole purpose is to be summed into a security decision, so
    // it defends its own arithmetic: a negative size would MANUFACTURE quota
    // rather than consume it. The upper bound stays in the Zod schema (A4) —
    // pinning 10 MB here would make changing the limit a migration.
    check("pending_uploads_size_positive", sql`${table.sizeBytes} > 0`),
    check(
      "pending_uploads_window_forward",
      sql`${table.expiresAt} >= ${table.createdAt}`,
    ),
  ],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // restrict, not cascade: file rows reference content-addressed S3 objects
    // (G2) — deleting a user must go through application code that removes the
    // objects first, otherwise they become unfindable orphans.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sha256: text("sha256").notNull(),
    // A9: per-user quota = sum of size_bytes; number mode is safe far beyond 1 GB.
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    kind: fileKind("kind").notNull(),
    // #14: variants belong to their original — deleting the original row
    // takes its set with it, which is how avatar replacement frees quota.
    parentFileId: uuid("parent_file_id").references(
      (): AnyPgColumn => files.id,
      { onDelete: "cascade" },
    ),
    // #14: the stored object's extension (jpg/png/webp), needed to rebuild
    // the original's key for app-mediated object cleanup (G2).
    ext: text("ext").notNull(),
    // #49: the key this row's object was ACTUALLY written under, prefix and
    // all. The address used to be rebuilt at read time from sha256 + ext +
    // the READING environment's S3_PREFIX, so one row resolved to a different
    // object in every environment: a PR preview, which shares dev's database
    // and bucket and differs only in that prefix, 404'd on every avatar. It
    // also meant that changing S3_PREFIX anywhere silently unhooked every
    // existing file from its object, with the row and the object both still
    // there.
    //
    // Nullable only for rows written before this column existed;
    // `scripts/backfill-file-keys.ts` fills them per environment, and the two
    // read paths fall back to the old derivation until it has run. New rows
    // always carry it.
    objectKey: text("object_key"),
    createdAt: createdAt(),
  },
  (table) => [
    // Covering index: the A9 quota SUM(size_bytes) per user is index-only.
    index("files_user_id_size_bytes_idx").on(table.userId, table.sizeBytes),
    // #12/#14: dedup keys differ by role. ORIGINALS dedupe by content —
    // identical bytes live under one key (G2), so they are recorded once.
    // VARIANTS dedupe by (parent, kind): their OBJECTS are keyed by the
    // parent's hash, so two different originals with byte-identical variant
    // pixels still store two objects — sha-based dedup would skip the second
    // row, mis-parenting it and undercounting the A9 quota (#14 review).
    // #72: the role is told by parentage, not by naming the kinds — the
    // predicates used to say `kind = 'avatar-original'`, which would have
    // read every cover, work photo and zip as a variant. (Not naming the
    // new values also lets the migration that adds them redefine these
    // indexes in the same transaction: Postgres refuses to USE an enum
    // value added in the transaction that added it.)
    // #120: an R360 frame has no parent any more — the archive row it used
    // to hang from is gone — so it would fall in here, where two frames of
    // one orbit that happen to encode to identical bytes (a building that
    // does not change between two camera positions) would collide on
    // (user, sha256, kind) and the save would fail. Frames are told by
    // their key, as they are in the variant index below.
    uniqueIndex("files_original_user_sha256_unique")
      .on(table.userId, table.sha256, table.kind)
      .where(
        sql`${table.parentFileId} IS NULL AND (${table.objectKey} IS NULL OR ${table.objectKey} NOT LIKE '%/r360/%')`,
      ),
    // #102: the R360 frames are N rows of one kind under one parent — the
    // point of a set — so they are out of this dedup. Told by their key
    // (`…/r360/<set>/…`, SPEC §9): the enum note above rules out naming the
    // kinds, and the enum-to-text cast is not immutable, which an index
    // predicate must be. A row written before #49 has no key and is no
    // frame.
    uniqueIndex("files_variant_user_parent_kind_unique")
      .on(table.userId, table.parentFileId, table.kind)
      .where(
        sql`${table.parentFileId} IS NOT NULL AND (${table.objectKey} IS NULL OR ${table.objectKey} NOT LIKE '%/r360/%')`,
      ),
    // #102: a frame is one object and one row — the key is its identity.
    // Only the frames: an ordinary photo may sit under one key as two rows
    // (the same picture as a cover and as a work photo).
    uniqueIndex("files_r360_frame_user_object_key_unique")
      .on(table.userId, table.objectKey)
      .where(sql`${table.objectKey} LIKE '%/r360/%'`),
    // Postgres does not index FK source columns; the replacement cascade
    // scans by parent.
    index("files_parent_file_id_idx").on(table.parentFileId),
    // #72: freeing a set asks, per key, whether another row still names it.
    index("files_object_key_idx").on(table.objectKey),
  ],
);
