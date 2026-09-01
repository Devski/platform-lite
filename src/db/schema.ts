import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
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
  },
  (table) => [
    uniqueIndex("profiles_handle_unique").on(table.handle),
    lowercaseCheck("profiles_handle_lowercase", table.handle),
    index("profiles_avatar_file_id_idx").on(table.avatarFileId),
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

export const fileKind = pgEnum("file_kind", [
  "avatar-original",
  "avatar-512",
  "avatar-128",
]);

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
    createdAt: createdAt(),
  },
  (table) => [
    // Covering index: the A9 quota SUM(size_bytes) per user is index-only.
    index("files_user_id_size_bytes_idx").on(table.userId, table.sizeBytes),
    // #12: identical bytes are stored once (G2), so they are RECORDED once —
    // a replayed confirm upserts instead of over-counting the A9 quota.
    uniqueIndex("files_user_sha256_kind_unique").on(
      table.userId,
      table.sha256,
      table.kind,
    ),
  ],
);
