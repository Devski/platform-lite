import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

// One driver-agnostic alias: production runs node-postgres, tests may run
// PGlite (src/db/test-db.ts) — consumers such as the Better Auth adapter see
// the same drizzle surface either way.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Database | undefined;

// Lazy on purpose: importing this module must stay side-effect free so route
// modules can be evaluated at build time (and by the DB-less e2e job) without
// DATABASE_URL; the first query is where a missing variable fails loudly.
export function getDb(): Database {
  if (!db) {
    const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
    db = drizzle({ client: pool, schema }) as Database;
  }
  return db;
}
