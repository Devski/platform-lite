import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool, type PoolConfig } from "pg";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

// One driver-agnostic alias: production runs node-postgres, tests may run
// PGlite (src/db/test-db.ts) — consumers such as the Better Auth adapter see
// the same drizzle surface either way.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * What the process holding the pool is doing (#172).
 *
 * `web` answers a visitor: every bound is short, because a page that has not
 * answered in a few seconds has already failed as far as they are concerned,
 * and the connection it is holding is one of ten.
 *
 * `batch` is a script (scripts/*.ts): a seed, a TERYT import, a backfill.
 * It is allowed to take its time — a statement timeout sized for a web
 * request would cut an import off halfway through, which is the one failure
 * worse than a slow one.
 */
export type DatabaseUse = "web" | "batch";

interface Deadlines {
  /** Connections this process may hold at once. */
  poolMax: number;
  /** How long a caller waits for a free connection before it is told no. */
  connectMs: number;
  /** How long one statement may run. 0 turns it off (PostgreSQL's own 0). */
  statementMs: number;
  /** How long one statement may wait for a lock. 0 turns it off. */
  lockMs: number;
}

// Dev's numbers, chosen for the shape of dev: one core, one containerised
// PostgreSQL with max_connections 100, and dev plus every open preview
// sharing it with a pool each (#31, #113). Production's managed database
// (#24) is another machine with another cap and sets its own through the
// environment — which is why each of these is a variable and not a constant.
//
// The web numbers, and why: the app's statements are all small (a profile, a
// page of works, one reorder), so ten seconds is not a slow query, it is a
// stuck one. Three seconds of waiting for a lock is a queue forming behind
// another writer — answering then beats joining it.
const DEADLINES: Record<DatabaseUse, Deadlines> = {
  web: { poolMax: 10, connectMs: 5_000, statementMs: 10_000, lockMs: 3_000 },
  batch: { poolMax: 4, connectMs: 30_000, statementMs: 0, lockMs: 0 },
};

// Fail loud, like requireEnv: a mistyped deadline that silently fell back to
// the default would be discovered the night it was needed.
function readOverride(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a whole number of milliseconds (0 turns the bound off), not "${raw}"`,
    );
  }
  return value;
}

export function deadlinesFor(use: DatabaseUse): Deadlines {
  const defaults = DEADLINES[use];
  return {
    poolMax: readOverride("DB_POOL_MAX", defaults.poolMax),
    connectMs: readOverride("DB_CONNECT_TIMEOUT_MS", defaults.connectMs),
    statementMs: readOverride("DB_STATEMENT_TIMEOUT_MS", defaults.statementMs),
    lockMs: readOverride("DB_LOCK_TIMEOUT_MS", defaults.lockMs),
  };
}

/**
 * The pool's configuration, spelled out (#172).
 *
 * The two server-side bounds travel in the connection's startup packet, NOT
 * in DATABASE_URL — deliberately. The same address is used by the migration
 * runner (deploy/migrate.mjs), by psql and by the scripts, and a migration
 * that hit a web statement timeout would leave a half-applied schema behind.
 * Putting them here means only what opens a pool through this module is
 * bound, and each kind of process gets its own numbers.
 */
export function poolConfig(
  use: DatabaseUse,
  connectionString: string,
): PoolConfig {
  const { poolMax, connectMs, statementMs, lockMs } = deadlinesFor(use);
  return {
    connectionString,
    max: poolMax,
    // Without this the eleventh caller waits for ever: pg's default is 0,
    // and 0 means no deadline at all. This is the whole of #172 in one line.
    connectionTimeoutMillis: connectMs,
    // A connection nobody has used for half a minute is given back. Previews
    // come and go all day and each holds its own pool against dev's single
    // PostgreSQL; idle connections there are pure occupancy.
    idleTimeoutMillis: 30_000,
    statement_timeout: statementMs,
    lock_timeout: lockMs,
    // A transaction left open with nothing happening in it still holds every
    // lock it has taken. Nothing here does I/O inside a transaction, so a gap
    // longer than a whole statement may run means the caller is gone.
    idle_in_transaction_session_timeout: statementMs,
    // Who is holding the connection, as pg_stat_activity will show it: dev
    // and every preview share one database (#113), so "one of them is
    // queueing" is only actionable if the row says which.
    application_name: connectionLabel(use),
  };
}

// The environment's own name, taken from the prefix it already scopes its
// objects with (SPEC §4): "devski/" → devski, "pr-170/" → pr-170, blank in
// production.
function connectionLabel(use: DatabaseUse): string {
  const environment =
    process.env.S3_PREFIX?.trim().replace(/\/+$/, "") ||
    process.env.APP_ENV?.trim() ||
    "local";
  return `platform-lite/${environment}/${use}`;
}

let db: Database | undefined;
let poolUse: DatabaseUse = "web";

/**
 * Declares this process a batch job (#172) — a script that may take as long
 * as its work takes. Call it before the first getDb(); afterwards the pool is
 * already open with the web deadlines and the call would be a lie, so it
 * throws rather than pretend.
 */
export function runAsBatchJob(): void {
  if (db) {
    throw new Error(
      "the database pool is already open — runAsBatchJob() belongs before the first getDb()",
    );
  }
  poolUse = "batch";
}

// Lazy on purpose: importing this module must stay side-effect free so route
// modules can be evaluated at build time (and by the DB-less e2e job) without
// DATABASE_URL; the first query is where a missing variable fails loudly.
export function getDb(): Database {
  if (!db) {
    const pool = new Pool(poolConfig(poolUse, requireEnv("DATABASE_URL")));
    // Without a listener here an idle connection dropped by the server (a
    // restart, an idle-transaction kill) reaches the process as an unhandled
    // 'error' event, which is a crash rather than a log line.
    pool.on("error", (error) => {
      console.error("[db] an idle connection failed:", error.message);
    });
    db = drizzle({ client: pool, schema }) as Database;
  }
  return db;
}

/**
 * The bound a failure ran into, or null for everything else (#172).
 *
 * These four are the ones nobody could see before: each one used to be an
 * unbounded wait, and in the log they all looked like a request that never
 * came back. Drizzle wraps driver errors and keeps the original in `cause`,
 * so the chain is walked rather than the top.
 */
export type DatabaseStall =
  "no-connection" | "statement-timeout" | "lock-timeout" | "idle-transaction";

// SQLSTATEs, from PostgreSQL's errcodes table.
const STALL_BY_CODE: Record<string, DatabaseStall> = {
  // query_canceled — what statement_timeout raises (also a hand cancel).
  "57014": "statement-timeout",
  // lock_not_available — what lock_timeout raises.
  "55P03": "lock-timeout",
  // idle_in_transaction_session_timeout — the session was terminated.
  "25P03": "idle-transaction",
};

// pg-pool's own wording when connectionTimeoutMillis runs out; there is no
// code on that one, it is an Error the pool makes itself.
const NO_CONNECTION = "timeout exceeded when trying to connect";

export function databaseStall(error: unknown): DatabaseStall | null {
  for (
    let current: unknown = error;
    current instanceof Error;
    current = current.cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code in STALL_BY_CODE) {
      return STALL_BY_CODE[code];
    }
    if (current.message.includes(NO_CONNECTION)) return "no-connection";
  }
  return null;
}
