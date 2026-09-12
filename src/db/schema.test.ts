import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  BIO_MAX,
  HEADLINE_MAX,
  LOCATION_MAX,
  LOCATIONS_MAX,
} from "@/lib/profile-schemas";
import * as schema from "./schema";

// Type-filtered, not try/catch-filtered: a genuine getTableConfig failure
// (e.g. after a drizzle upgrade) must fail the suite, not shrink the table set.
const pgTables = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => getTableConfig(table));

function tableByName(name: string) {
  const table = pgTables.find((t) => t.name === name);
  if (!table) throw new Error(`table "${name}" not found in schema`);
  return table;
}

describe("schema tables (SPEC §9)", () => {
  it("defines exactly the §9 tables plus accounts, two_factors and pending_uploads", () => {
    // §9 lists the eight (works and work_images since #72); `accounts` and
    // `two_factors` come from Better Auth (#7, #29) and `pending_uploads`
    // from #30 — a staged upload has no `files` row yet, so without it the
    // A9 quota cannot see those bytes.
    expect(pgTables.map((t) => t.name).sort()).toEqual([
      "accounts",
      "files",
      "handle_redirects",
      "pending_uploads",
      "places",
      "profiles",
      "sessions",
      "two_factors",
      "users",
      "verifications",
      "work_images",
      "works",
    ]);
  });

  it("works belong to a user and cascade away with them; their image rows go with the work, the file rows never do (#72)", () => {
    const works = tableByName("works");
    expect(works.columns.map((c) => c.name).sort()).toEqual(
      [
        "created_at",
        "developer",
        "id",
        "investor",
        "name",
        "r360_set_id",
        "r360_params",
        // #140: where the set's frames are, recorded at save.
        "r360_key_prefix",
        // #66: where the owner put this work among their own.
        "position",
        "updated_at",
        "user_id",
      ].sort(),
    );
    const userRef = works.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === "user_id"),
    );
    expect(userRef?.onDelete).toBe("cascade");

    const images = tableByName("work_images");
    expect(images.columns.map((c) => c.name).sort()).toEqual([
      "file_id",
      "position",
      "secondary_file_id",
      "work_id",
    ]);
    const byColumn = (name: string) =>
      images.foreignKeys.find((fk) =>
        fk.reference().columns.some((c) => c.name === name),
      );
    expect(byColumn("work_id")?.onDelete).toBe("cascade");
    // A photo's bytes are an S3 object: removing it goes through code (G2).
    expect(byColumn("file_id")?.onDelete).toBe("restrict");
    // Position 0 is the main photo; the pair is the identity of a slot.
    expect(
      images.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
    ).toEqual(["work_id", "position"]);
  });

  it("pending_uploads reserves declared bytes against the quota (#30)", () => {
    const pending = tableByName("pending_uploads");
    expect(pending.columns.map((c) => c.name).sort()).toEqual([
      "created_at",
      "expires_at",
      "size_bytes",
      "staging_key",
      "user_id",
    ]);
    // Like `files`: the row points at an S3 object, so removing a user has to
    // go through code that deletes objects first (G2), never a cascade.
    const userRef = pending.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === "user_id"),
    );
    expect(userRef?.onDelete).toBe("restrict");
  });

  it("two_factors carries the plugin fields and points at users.id, one row per user (#29)", () => {
    const twoFactors = tableByName("two_factors");
    expect(twoFactors.columns.map((c) => c.name).sort()).toEqual(
      [
        "backup_codes",
        "failed_verification_count",
        "id",
        "locked_until",
        "secret",
        "user_id",
        "verified",
      ].sort(),
    );
    const targets = twoFactors.foreignKeys.map((k) => k.reference());
    expect(targets.map((r) => getTableConfig(r.foreignTable).name)).toEqual([
      "users",
    ]);
    expect(targets[0].foreignColumns.map((c) => c.name)).toEqual(["id"]);
  });

  it("profiles carries exactly the §9 columns, keyed by user_id pointing at users.id", () => {
    const profiles = tableByName("profiles");
    expect(profiles.columns.map((c) => c.name).sort()).toEqual(
      [
        "avatar_file_id",
        "bio",
        "cover_file_id",
        "display_name",
        "handle",
        "handle_changed_at",
        "headline",
        "locations",
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

  it("files carries the §9 columns plus the #14 set linkage and points at users.id", () => {
    const files = tableByName("files");
    const columnNames = files.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual(
      [
        "created_at",
        "ext",
        "id",
        "kind",
        "object_key",
        "parent_file_id",
        "sha256",
        "size_bytes",
        "user_id",
      ].sort(),
    );
    const targets = files.foreignKeys.map((k) => k.reference());
    expect(
      targets.map((r) => getTableConfig(r.foreignTable).name).sort(),
    ).toEqual(["files", "users"]);
  });

  it("variant rows cascade away with their original (#14 replacement cleanup)", () => {
    const sql = readFileSync(
      join(__dirname, "../../drizzle/0003_giant_falcon.sql"),
      "utf8",
    );
    expect(sql).toMatch(
      /"files_parent_file_id_files_id_fk"[\s\S]*ON DELETE cascade/,
    );
  });

  it("file kind names every stored representation: avatar, cover and work sets plus the R360 zip (#72)", () => {
    expect(schema.fileKind.enumValues.sort()).toEqual(
      [
        "avatar-original",
        "avatar-512",
        "avatar-128",
        "cover-original",
        "cover-1600",
        "cover-480",
        "work-original",
        "work-1600",
        "work-480",
        "r360-zip",
        // #102: the frames the owner's browser derives from the archive.
        "r360-1600",
        "r360-800",
      ].sort(),
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

  it("a display name can never be blank (#36)", () => {
    // NOT NULL does not stop the empty string, and the public page renders
    // this column. Registration now sends an empty name deliberately, so
    // the one thing that must not happen is that emptiness reaching a
    // profile row and a shared link as a nameless card.
    expect(sql).toContain('length(btrim("profiles"."display_name")) > 0');
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
      'CREATE UNIQUE INDEX "two_factors_user_id_unique" ON "two_factors" USING btree ("user_id")',
      // #72: the role read from parentage, so covers, work photos and zips
      // dedupe as originals rather than masquerading as variants.
      'CREATE UNIQUE INDEX "files_original_user_sha256_unique" ON "files" USING btree ("user_id","sha256","kind") WHERE "files"."parent_file_id" IS NULL',
      // #102: the R360 frames (N rows of one kind under one parent) are out
      // of the variant dedup, and each frame is keyed by its object.
      'CREATE UNIQUE INDEX "files_variant_user_parent_kind_unique" ON "files" USING btree ("user_id","parent_file_id","kind") WHERE "files"."parent_file_id" IS NOT NULL AND ("files"."object_key" IS NULL OR "files"."object_key" NOT LIKE \'%/r360/%\')',
      'CREATE UNIQUE INDEX "files_r360_frame_user_object_key_unique" ON "files" USING btree ("user_id","object_key") WHERE "files"."object_key" LIKE \'%/r360/%\'',
      'CREATE INDEX "files_parent_file_id_idx" ON "files" USING btree ("parent_file_id")',
      'CREATE INDEX "files_object_key_idx" ON "files" USING btree ("object_key")',
      'CREATE INDEX "profiles_cover_file_id_idx" ON "profiles" USING btree ("cover_file_id")',
      'CREATE INDEX "works_user_id_created_at_idx" ON "works" USING btree ("user_id","created_at")',
      // #102 review: one set, one work.
      'CREATE UNIQUE INDEX "works_r360_set_id_unique" ON "works" USING btree ("r360_set_id")',
      'CREATE UNIQUE INDEX "work_images_work_id_file_id_unique" ON "work_images" USING btree ("work_id","file_id")',
      'CREATE INDEX "work_images_file_id_idx" ON "work_images" USING btree ("file_id")',
      'CREATE INDEX "work_images_secondary_file_id_idx" ON "work_images" USING btree ("secondary_file_id")',
    ]) {
      expect(sql).toContain(ddl);
    }
  });

  it("the A12 lengths in the database are the ones the forms enforce (#39)", () => {
    // The CHECKs carry literals (a parameter cannot live in DDL); this pins
    // them to the Zod constants so the two can only move together.
    expect(sql).toContain(
      `"profiles"."headline" IS NULL OR length("profiles"."headline") <= ${HEADLINE_MAX}`,
    );
    expect(sql).toContain(
      `"profiles"."bio" IS NULL OR length("profiles"."bio") <= ${BIO_MAX}`,
    );
    expect(sql).toContain(
      `cardinality("profiles"."locations") <= ${LOCATIONS_MAX}`,
    );
    // A CHECK cannot measure each element: no NULL, and a total no longer
    // than every place at its Zod maximum.
    expect(sql).toContain(
      'array_position("profiles"."locations", NULL) IS NULL',
    );
    expect(sql).toContain(
      `length(array_to_string("profiles"."locations", '')) <= ${LOCATIONS_MAX * LOCATION_MAX}`,
    );
    expect(sql).toContain('length(btrim("works"."name")) > 0');
    expect(sql).toContain('length("works"."name") <= 120');
    expect(sql).toContain(
      '"work_images"."position" >= 0 AND "work_images"."position" <= 2',
    );
  });

  it("deleting a user cascades away its 2FA record (#29)", () => {
    expect(sql).toMatch(
      /"two_factors_user_id_users_id_fk"[^;]*ON DELETE cascade/,
    );
  });

  it("file_kind in SQL starts as the three avatar values and grows by ADD VALUE only (#72)", () => {
    expect(sql).toContain(
      "CREATE TYPE \"public\".\"file_kind\" AS ENUM('avatar-original', 'avatar-512', 'avatar-128')",
    );
    for (const value of schema.fileKind.enumValues.slice(3)) {
      expect(sql).toContain(
        `ALTER TYPE "public"."file_kind" ADD VALUE '${value}'`,
      );
    }
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
    // migration legitimately drops or alters one, extend the accepted list —
    // this canary forces exactly that review.
    const accepted = [
      // 0004 (#14 review): the one-size dedup index split into per-role
      // partial indexes; the replacement is guarded above.
      'DROP INDEX "files_user_sha256_kind_unique"',
      // 0010 (#72): the same two indexes re-created under the same names
      // with the role read from parentage; guarded above. And the enum
      // grown by seven values — ADD VALUE is additive, but it is also
      // irreversible, which is why it passes through this list.
      'DROP INDEX "files_original_user_sha256_unique"',
      'DROP INDEX "files_variant_user_parent_kind_unique"',
      // 0014 (#102): the variant index re-created once more, with the R360
      // frames left out of it; guarded above. The enum grows by two.
      'DROP INDEX "files_variant_user_parent_kind_unique"',
      // 0017 (#120): the zip is never uploaded, so nothing on the server
      // owns an archive. The pointer goes with its index and its foreign
      // key, and the originals index is re-created leaving the frames out
      // — they have no parent now, and two frames of one orbit that encode
      // to identical bytes would collide on (user, sha256, kind).
      'DROP CONSTRAINT "works_r360_file_id_files_id_fk"',
      'DROP INDEX "works_r360_file_id_idx"',
      'DROP INDEX "files_original_user_sha256_unique"',
      // 0019 (#66): the works index re-created with the owner's own order in
      // front of the adding order it used to carry alone; guarded above.
      'DROP INDEX "works_user_id_created_at_idx"',
      ...schema.fileKind.enumValues
        .slice(3)
        .map((value) => `ALTER TYPE "public"."file_kind" ADD VALUE '${value}'`),
    ];
    const drops =
      sql.match(
        /(?:DROP INDEX|DROP CONSTRAINT|DROP DEFAULT|DROP TABLE|ALTER TYPE)[^;]*/gi,
      ) ?? [];
    expect(drops.map((statement) => statement.trim()).sort()).toEqual(
      accepted.sort(),
    );
  });
});
