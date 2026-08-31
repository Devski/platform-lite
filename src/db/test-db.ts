import { fileURLToPath } from "node:url";
import { getTableName, is, sql } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

// Integration-test database (SPEC.md §6). Two backends behind one shape:
//   - DATABASE_URL_TEST set → that PostgreSQL (the CI service container, or
//     platform_test_<handle> through the SSH tunnel once #2 is provisioned);
//   - otherwise → in-process PGlite (real Postgres compiled to WASM), so the
//     suite runs with no environment at all. CI always sets DATABASE_URL_TEST,
//     which keeps the real-server path continuously proven.
// Both backends apply the committed migrations from drizzle/ (G6) — never
// a schema push — so tests exercise exactly what production will run.
//
// NOTE: with DATABASE_URL_TEST all vitest workers share one database, so keep
// every suite that touches the database inside a single test file for now;
// reset() wipes tables and would race across parallel files.

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export type TestDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface TestDb {
  db: TestDatabase;
  backend: "postgres" | "pglite";
  /** TRUNCATE every application table (identities restart, cascades on). */
  reset(): Promise<void>;
  close(): Promise<void>;
}

function applicationTables(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) {
      names.push(getTableName(value));
    }
  }
  return names;
}

export async function createTestDb(): Promise<TestDb> {
  // An empty string (a copied-but-unfilled .env) counts as unset.
  const url = process.env.DATABASE_URL_TEST?.trim();
  const tables = applicationTables()
    .map((name) => `"${name}"`)
    .join(", ");
  const truncateAll = sql.raw(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );

  if (url) {
    const pool = new Pool({ connectionString: url });
    const db = drizzleNodePg({ client: pool, schema });
    // Idempotent: replays only migrations missing from the journal table, so
    // running after CI's `pnpm db:migrate` pre-step is a cheap no-op.
    await migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return {
      db: db as TestDatabase,
      backend: "postgres",
      async reset() {
        await db.execute(truncateAll);
      },
      async close() {
        await pool.end();
      },
    };
  }

  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: db as TestDatabase,
    backend: "pglite",
    async reset() {
      await db.execute(truncateAll);
    },
    async close() {
      await client.close();
    },
  };
}
