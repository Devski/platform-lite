import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// Type-filtered, not try/catch-filtered: a genuine getTableConfig failure
// (e.g. after a drizzle upgrade) must fail the suite, not shrink the table set.
const pgTables = Object.values(schema)
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table));

function tableByName(name: string) {
  const table = pgTables.find((t) => t.name === name);
  if (!table) throw new Error(`table "${name}" not found in schema`);
  return table;
}

describe("schema tables (SPEC §9)", () => {
  it("defines exactly the §9 tables plus Better Auth's accounts", () => {
    expect(pgTables.map((t) => t.name).sort()).toEqual([
      "accounts",
      "files",
      "handle_redirects",
      "profiles",
      "sessions",
      "users",
      "verifications",
    ]);
  });

  it("profiles carries exactly the §9 columns, keyed by user_id pointing at users.id", () => {
    const profiles = tableByName("profiles");
    expect(profiles.columns.map((c) => c.name).sort()).toEqual(
      [
        "avatar_file_id",
        "display_name",
        "handle",
        "handle_changed_at",
        "user_id",
      ].sort(),
    );
    const fk = profiles.foreignKeys.map((k) => k.reference());
    expect(
      fk.some(
        (r) =>
          getTableConfig(r.foreignTable).name === "users" &&
          r.columns.some((c) => c.name === "user_id") &&
          r.foreignColumns.some((c) => c.name === "id"),
      ),
    ).toBe(true);
    const pkColumns = profiles.primaryKeys
      .flatMap((pk) => pk.columns.map((c) => c.name))
      .concat(profiles.columns.filter((c) => c.primary).map((c) => c.name));
    expect(pkColumns).toContain("user_id");
  });

  it("no foreign key anywhere targets the handle (handle is an attribute, not an identifier)", () => {
    for (const table of pgTables) {
      for (const key of table.foreignKeys) {
        const referencedColumns = key
          .reference()
          .foreignColumns.map((c) => c.name);
        expect(referencedColumns).not.toContain("handle");
        expect(referencedColumns).not.toContain("old_handle");
      }
    }
  });

  it("handle_redirects resolves to users.id, with old_handle as the primary key", () => {
    const redirects = tableByName("handle_redirects");
    const targets = redirects.foreignKeys.map((k) => k.reference());
    expect(targets.map((r) => getTableConfig(r.foreignTable).name)).toEqual([
      "users",
    ]);
    expect(targets[0].foreignColumns.map((c) => c.name)).toEqual(["id"]);
    const pkColumns = redirects.columns
      .filter((c) => c.primary)
      .map((c) => c.name);
    expect(pkColumns).toEqual(["old_handle"]);
  });

  it("files carries exactly the §9 columns and points at users.id", () => {
    const files = tableByName("files");
    const columnNames = files.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual(
      ["created_at", "id", "kind", "sha256", "size_bytes", "user_id"].sort(),
    );
    const targets = files.foreignKeys.map((k) => k.reference());
    expect(targets.map((r) => getTableConfig(r.foreignTable).name)).toEqual([
      "users",
    ]);
    expect(targets[0].foreignColumns.map((c) => c.name)).toEqual(["id"]);
  });

  it("file kind is restricted to the three avatar variants", () => {
    expect(schema.fileKind.enumValues.sort()).toEqual(
      ["avatar-128", "avatar-512", "avatar-original"].sort(),
    );
  });
});

describe("generated migration SQL (G6 — migrations are the source of truth)", () => {
  const migrationsDir = join(__dirname, "../../drizzle");
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n");

  it("users.id specifically defaults to a database-generated UUID", () => {
    const usersBlock =
      sql.match(/CREATE TABLE "users" \(([^;]*)\);/)?.[1] ?? "";
    expect(usersBlock).toMatch(
      /"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/,
    );
  });

  it("the handle namespace is case-insensitive end to end: lowercase CHECKs plus unique handle", () => {
    expect(sql).toContain('"profiles"."handle" = lower("profiles"."handle")');
    expect(sql).toContain(
      '"handle_redirects"."old_handle" = lower("handle_redirects"."old_handle")',
    );
  });

  it("emails are guarded unique case-insensitively at the database", () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"))',
    );
  });

  it("every guarded index exists with its exact table and columns", () => {
    for (const ddl of [
      'CREATE UNIQUE INDEX "accounts_issuer_account_id_unique" ON "accounts" USING btree ("issuer","account_id")',
      'CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id")',
      'CREATE INDEX "files_user_id_size_bytes_idx" ON "files" USING btree ("user_id","size_bytes")',
      'CREATE INDEX "handle_redirects_target_user_id_idx" ON "handle_redirects" USING btree ("target_user_id")',
      'CREATE UNIQUE INDEX "profiles_handle_unique" ON "profiles" USING btree ("handle")',
      'CREATE INDEX "profiles_avatar_file_id_idx" ON "profiles" USING btree ("avatar_file_id")',
      'CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id")',
      'CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier")',
    ]) {
      expect(sql).toContain(ddl);
    }
  });

  it("file_kind in SQL matches the three variants exactly", () => {
    expect(sql).toContain(
      "CREATE TYPE \"public\".\"file_kind\" AS ENUM('avatar-original', 'avatar-512', 'avatar-128')",
    );
  });

  it("deleting a user cannot silently cascade away file rows (S3 cleanup is app-mediated)", () => {
    expect(sql).toMatch(/"files_user_id_users_id_fk"[^;]*ON DELETE restrict/);
  });

  it("no REFERENCES clause targets a handle column", () => {
    const statements = sql.split(/;|--> statement-breakpoint/);
    const withReferences = statements.filter((s) => /REFERENCES/i.test(s));
    // Non-vacuity: migration 0000 already ships six foreign keys.
    expect(withReferences.length).toBeGreaterThanOrEqual(6);
    for (const statement of withReferences) {
      expect(statement).not.toMatch(
        /REFERENCES[\s\S]*?\(\s*"?(old_)?handle"?\s*\)/i,
      );
    }
  });

  it("canary: no migration weakens a guarded object without conscious review", () => {
    // The SQL assertions above check the joined history, so a later migration
    // could drop a guarded object while they stay green. When a future
    // migration legitimately drops or alters one, update the guarded
    // assertions in this file in the same change — this canary forces that.
    expect(sql).not.toMatch(
      /DROP INDEX|DROP CONSTRAINT|DROP DEFAULT|DROP TABLE|ALTER TYPE/i,
    );
  });
});
