import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
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

const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull();
const authTimestamps = { createdAt, updatedAt };

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...authTimestamps,
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
    ...authTimestamps,
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
    ...authTimestamps,
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
    ...authTimestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
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
    createdAt,
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
    createdAt,
  },
  (table) => [
    // Covering index: the A9 quota SUM(size_bytes) per user is index-only.
    index("files_user_id_size_bytes_idx").on(table.userId, table.sizeBytes),
  ],
);
