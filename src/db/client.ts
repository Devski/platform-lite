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
  /** How long one statement may run. */
  statementMs: number;
  /** How long one statement may wait for a lock. */
  lockMs: number;
  /** How long a transaction may sit between statements, holding its locks. */
  idleTxMs: number;
}

// 0 on the three server-side bounds does NOT mean "off": pg only puts a
// setting in the startup packet when it is truthy (pg/lib/client.js), so 0
// means "send nothing, the server's own setting stands". On ours that setting
// is 0, which is off — but a managed database (#24) may well ship a role-level
// statement_timeout, and a batch job there would inherit it. Read 0 as
// "inherit", and check what is inherited when production exists.

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
  web: {
    poolMax: 10,
    connectMs: 5_000,
    statementMs: 10_000,
    lockMs: 3_000,
    idleTxMs: 10_000,
  },
  batch: {
    poolMax: 4,
    connectMs: 30_000,
    statementMs: 0,
    lockMs: 0,
    idleTxMs: 0,
  },
};

// setTimeout's ceiling. Past it Node warns and fires after ONE millisecond —
// so an operator reaching for a large finite number as "effectively never"
// would make every queued checkout fail instantly, and the log would blame
// the database. Refused instead.
const MAX_MS = 2_147_483_647;

// Fail loud, like requireEnv: a mistyped deadline that silently fell back to
// the default would be discovered the night it was needed. Decimal digits
// only — Number("0x10") is 16, and a typo that quietly means something else
// is worse than one that stops the process.
function readOverride(name: string, fallback: number, least = 0): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < least || value > MAX_MS) {
    throw new Error(
      `${name} must be a whole number between ${least} and ${MAX_MS}, not "${raw}"`,
    );
  }
  return value;
}

export function deadlinesFor(use: DatabaseUse): Deadlines {
  const defaults = DEADLINES[use];
  // A batch job takes the built-in numbers and nothing else. These variables
  // belong to the WEB process of an environment; a seed or an import that
  // inherited a web statement timeout would be cut off halfway through, which
  // is the whole reason the opt-out exists.
  if (use === "batch") return defaults;
  return {
    // Never 0: a pool of 0 silently becomes pg's default of 10, and a connect
    // deadline of 0 is the unbounded wait this issue is about.
    poolMax: readOverride("DB_POOL_MAX", defaults.poolMax, 1),
    connectMs: readOverride("DB_CONNECT_TIMEOUT_MS", defaults.connectMs, 1),
    statementMs: readOverride("DB_STATEMENT_TIMEOUT_MS", defaults.statementMs),
    lockMs: readOverride("DB_LOCK_TIMEOUT_MS", defaults.lockMs),
    // Its own variable, not the statement bound reused: raising the statement
    // bound to let one slow report through must not also let a transaction
    // sit on its locks for ever.
    idleTxMs: readOverride("DB_IDLE_TX_TIMEOUT_MS", defaults.idleTxMs),
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
  const { poolMax, connectMs, statementMs, lockMs, idleTxMs } =
    deadlinesFor(use);
  return {
    connectionString,
    max: poolMax,
    // Without this the eleventh caller waits for ever: pg's default is 0,
    // and 0 means no deadline at all. This is the whole of #172 in one line.
    connectionTimeoutMillis: connectMs,
    // A connection nobody has used for half a minute is given back. Previews
    // come and go all day and each holds its own pool against the one
    // PostgreSQL on the instance; idle connections there are pure occupancy.
    idleTimeoutMillis: 30_000,
    statement_timeout: statementMs,
    lock_timeout: lockMs,
    // A transaction left open with nothing happening in it still holds every
    // lock it has taken. Nothing here does I/O inside a transaction, so a gap
    // that long means the caller is gone.
    idle_in_transaction_session_timeout: idleTxMs,
    // Who is holding the connection, as pg_stat_activity will show it: dev
    // and every preview share one PostgreSQL — a database each since #113,
    // but one instance and one core — so "something is queueing" is only
    // actionable if the row says which of them.
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
  if (process.env.NEXT_RUNTIME) {
    throw new Error(
      "runAsBatchJob() is for scripts/*: a server must not put the pool its pages use on the batch deadlines (#172)",
    );
  }
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
  db ??= openPool(poolUse);
  return db;
}

let backgroundDb: Database | undefined;

/**
 * A second pool, for work that runs inside the server but is answering
 * nobody: today the R360 collector's sweep (#127, #156), which reads every
 * file row to find objects no record names.
 *
 * It has to be a pool of its own, because the deadlines are a property of the
 * connection and the collector shares this process with the pages. Under the
 * web bound its sweep would not fail loudly, it would return "nothing found"
 * as the table grows — and nothing tells that apart from a clean bucket.
 */
export function getBackgroundDb(): Database {
  backgroundDb ??= openPool("batch");
  return backgroundDb;
}

function openPool(use: DatabaseUse): Database {
  const pool = watchPool(new Pool(poolConfig(use, requireEnv("DATABASE_URL"))));
  return drizzle({ client: pool, schema }) as Database;
}

/**
 * Both listeners a pool of ours must carry, and the second is not the first
 * one written twice.
 *
 * pg-pool's own listener watches a connection sitting IDLE IN THE POOL, and
 * it takes that listener off the client the moment the client is checked out.
 * So a connection the server kills while somebody holds it — an
 * idle-in-transaction kill, a restart, the tunnel dropping — arrives at a
 * client with no listener at all, and Node turns an 'error' event with no
 * listener into a crashed process.
 *
 * Measured on 12.09.2026 against dev's PostgreSQL: with only the pool
 * listener the process exits on the idle-in-transaction kill; with the client
 * listener the query rejects and the request fails on its own.
 */
export function watchPool(pool: Pool): Pool {
  pool.on("error", (error) => {
    console.error(
      `[db] an idle connection failed (${databaseStall(error) ?? "no bound"}):`,
      error.message,
    );
  });
  pool.on("connect", (client) => {
    client.on("error", (error) => {
      console.error(
        `[db] a connection in use failed (${databaseStall(error) ?? "no bound"}):`,
        error.message,
      );
    });
  });
  return pool;
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
  // Bounded: a cause chain that points back at itself would otherwise spin
  // for ever, and this runs on the failure path of every request.
  for (
    let current: unknown = error, links = 0;
    current instanceof Error && links < 16;
    current = current.cause, links++
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code in STALL_BY_CODE) {
      return STALL_BY_CODE[code];
    }
    if (current.message.includes(NO_CONNECTION)) return "no-connection";
  }
  return null;
}
