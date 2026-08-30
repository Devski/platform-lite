import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const pgTables = Object.values(schema).flatMap((value) => {
  try {
    return [getTableConfig(value as Parameters<typeof getTableConfig>[0])];
  } catch {
    return [];
  }
});

function tableByName(name: string) {
  const table = pgTables.find((t) => t.name === name);
  if (!table) throw new Error(`table "${name}" not found in schema`);
  return table;
}

describe("schema tables (SPEC §9)", () => {
  it("defines every table from the outline", () => {
    const names = pgTables.map((t) => t.name);
    for (const required of [
      "users",
      "sessions",
      "verifications",
      "profiles",
      "handle_redirects",
      "files",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("profiles carries exactly the §9 columns, keyed by user_id pointing at users", () => {
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
          r.columns.some((c) => c.name === "user_id"),
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

  it("handle_redirects resolves to users, with old_handle as the primary key", () => {
    const redirects = tableByName("handle_redirects");
    const references = redirects.foreignKeys.map(
      (k) => getTableConfig(k.reference().foreignTable).name,
    );
    expect(references).toEqual(["users"]);
    const pkColumns = redirects.columns
      .filter((c) => c.primary)
      .map((c) => c.name);
    expect(pkColumns).toEqual(["old_handle"]);
  });

  it("files carries exactly the §9 columns and points at users", () => {
    const files = tableByName("files");
    const columnNames = files.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual(
      ["created_at", "id", "kind", "sha256", "size_bytes", "user_id"].sort(),
    );
    const references = files.foreignKeys.map(
      (k) => getTableConfig(k.reference().foreignTable).name,
    );
    expect(references).toEqual(["users"]);
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
    expect(sql).toMatch(/CREATE UNIQUE INDEX "profiles_handle_unique"/);
  });

  it("emails are guarded unique case-insensitively at the database", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "users_email_lower_unique".*lower\("email"\)/,
    );
  });

  it("hot query paths are indexed (A9 quota, auth lookups, FK delete paths)", () => {
    for (const indexName of [
      "files_user_id_size_bytes_idx",
      "sessions_user_id_idx",
      "accounts_user_id_idx",
      "verifications_identifier_idx",
      "profiles_avatar_file_id_idx",
      "handle_redirects_target_user_id_idx",
    ]) {
      expect(sql).toContain(`"${indexName}"`);
    }
  });

  it("deleting a user cannot silently cascade away file rows (S3 cleanup is app-mediated)", () => {
    expect(sql).toMatch(/"files_user_id_users_id_fk"[^;]*ON DELETE restrict/);
  });

  it("no REFERENCES clause targets a handle column", () => {
    const references = sql.match(/references[^;\n]*/gi) ?? [];
    for (const clause of references) {
      expect(clause).not.toMatch(/"handle"|"old_handle"/);
    }
  });
});
