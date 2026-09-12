import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  databaseStall,
  deadlinesFor,
  poolConfig,
  runAsBatchJob,
  watchPool,
} from "./client";

// #172. Two halves: what the pool is configured with (pure, runs everywhere)
// and what those settings actually do to a waiting statement — which only a
// real server can answer, so that half runs when DATABASE_URL_TEST is set
// (always in CI, through the tunnel locally). PGlite cannot stand in: it is
// one in-process connection, and every bound here is about the second one.

const VARIABLES = [
  "DB_POOL_MAX",
  "DB_CONNECT_TIMEOUT_MS",
  "DB_STATEMENT_TIMEOUT_MS",
  "DB_LOCK_TIMEOUT_MS",
  "DB_IDLE_TX_TIMEOUT_MS",
];

beforeEach(() => {
  // Vitest loads .env, and these variables are meant to be set — so a
  // developer who has set one would otherwise fail the tests that assert the
  // built-in numbers, for a reason that has nothing to do with the change.
  for (const name of VARIABLES) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the deadlines a web process runs under", () => {
  it("bounds the wait for a connection, the statement and the lock", () => {
    const config = poolConfig("web", "postgres://example/db");
    expect(config.max).toBe(10);
    expect(config.connectionTimeoutMillis).toBe(5_000);
    expect(config.statement_timeout).toBe(10_000);
    expect(config.lock_timeout).toBe(3_000);
    // A transaction that has gone quiet still holds its locks.
    expect(config.idle_in_transaction_session_timeout).toBe(10_000);
  });

  it("takes its numbers from the environment, so production can differ", () => {
    vi.stubEnv("DB_POOL_MAX", "40");
    vi.stubEnv("DB_STATEMENT_TIMEOUT_MS", "2500");
    expect(deadlinesFor("web")).toMatchObject({
      poolMax: 40,
      statementMs: 2500,
      // Untouched variables keep the built-in number.
      connectMs: 5_000,
    });
  });

  it("keeps the idle-transaction bound when the statement bound is lifted", () => {
    // One variable must not turn off two bounds: raising the statement bound
    // to let a slow report through must not also let a transaction sit on its
    // locks for ever.
    vi.stubEnv("DB_STATEMENT_TIMEOUT_MS", "0");
    expect(deadlinesFor("web")).toMatchObject({
      statementMs: 0,
      idleTxMs: 10_000,
    });
  });

  it("refuses a deadline that is not a whole number of milliseconds", () => {
    vi.stubEnv("DB_CONNECT_TIMEOUT_MS", "5s");
    // Loud, like every other environment mistake here: a deadline that
    // silently fell back to the default would be found the night it mattered.
    expect(() => deadlinesFor("web")).toThrow(/DB_CONNECT_TIMEOUT_MS/);
  });

  it("refuses the values that look permissive and are not", () => {
    // 0 connections becomes pg's default of 10, silently.
    vi.stubEnv("DB_POOL_MAX", "0");
    expect(() => deadlinesFor("web")).toThrow(/DB_POOL_MAX/);
    vi.unstubAllEnvs();
    // 0 here is the unbounded wait this whole issue is about.
    vi.stubEnv("DB_CONNECT_TIMEOUT_MS", "0");
    expect(() => deadlinesFor("web")).toThrow(/DB_CONNECT_TIMEOUT_MS/);
    vi.unstubAllEnvs();
    // Past setTimeout's ceiling Node fires after ONE millisecond, so "a big
    // number meaning never" would refuse every queued caller instantly.
    vi.stubEnv("DB_CONNECT_TIMEOUT_MS", "3000000000");
    expect(() => deadlinesFor("web")).toThrow(/DB_CONNECT_TIMEOUT_MS/);
    vi.unstubAllEnvs();
    // Number("0x10") is 16 — a typo that quietly means something else.
    vi.stubEnv("DB_POOL_MAX", "0x10");
    expect(() => deadlinesFor("web")).toThrow(/DB_POOL_MAX/);
  });

  it("names the connection after the environment holding it", () => {
    vi.stubEnv("S3_PREFIX", "pr-170/");
    // dev and every preview share one database (#113); pg_stat_activity has
    // to say which of them is queueing.
    expect(poolConfig("web", "postgres://example/db").application_name).toBe(
      "platform-lite/pr-170/web",
    );
  });
});

describe("the deadlines a batch job runs under", () => {
  it("lets the work take as long as it takes", () => {
    const { statementMs, lockMs, connectMs } = deadlinesFor("batch");
    // 0 leaves the server's own setting standing — 0 on ours. A seed, an
    // import or a backfill must never be cut off halfway by a number chosen
    // for a page.
    expect(statementMs).toBe(0);
    expect(lockMs).toBe(0);
    // It still gives up on a database that cannot be reached at all.
    expect(connectMs).toBeGreaterThan(0);
  });

  it("ignores the variables an environment sets for its web process", () => {
    vi.stubEnv("DB_STATEMENT_TIMEOUT_MS", "10000");
    vi.stubEnv("DB_LOCK_TIMEOUT_MS", "3000");
    // Otherwise the opt-out would be defeated by the very variables this
    // change introduces: `pnpm db:import-teryt` upserts a hundred thousand
    // places in one statement, and ten seconds would roll it back.
    expect(deadlinesFor("batch")).toMatchObject({
      statementMs: 0,
      lockMs: 0,
    });
  });

  it("refuses to put a server's own pool on those deadlines", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    expect(() => runAsBatchJob()).toThrow(/scripts/);
  });
});

describe("reading a failure", () => {
  it("recognises each bound by the code PostgreSQL raises", () => {
    expect(
      databaseStall(Object.assign(new Error("x"), { code: "57014" })),
    ).toBe("statement-timeout");
    expect(
      databaseStall(Object.assign(new Error("x"), { code: "55P03" })),
    ).toBe("lock-timeout");
    expect(
      databaseStall(Object.assign(new Error("x"), { code: "25P03" })),
    ).toBe("idle-transaction");
  });

  it("recognises the pool's own refusal to wait any longer", () => {
    expect(
      databaseStall(new Error("timeout exceeded when trying to connect")),
    ).toBe("no-connection");
  });

  it("looks through the wrapper drizzle puts around driver errors", () => {
    const wrapped = new Error("Failed query: select 1", {
      cause: Object.assign(new Error("canceling statement"), { code: "57014" }),
    });
    expect(databaseStall(wrapped)).toBe("statement-timeout");
  });

  it("gives up on a cause chain that points back at itself", () => {
    // This runs on the failure path of every request, on one core: a chain
    // with a loop in it must end the walk, not the process.
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    (first as { cause?: unknown }).cause = second;
    expect(databaseStall(first)).toBeNull();
  });

  it("says nothing about failures that are not a deadline", () => {
    expect(databaseStall(new Error("duplicate key value"))).toBeNull();
    expect(databaseStall("not an error")).toBeNull();
  });
});

const url = process.env.DATABASE_URL_TEST?.trim();

describe.skipIf(!url)("against a real PostgreSQL", () => {
  const open: Pool[] = [];

  function pool(overrides: Record<string, string>): Pool {
    for (const [name, value] of Object.entries(overrides)) {
      vi.stubEnv(name, value);
    }
    const created = watchPool(new Pool(poolConfig("web", url!)));
    open.push(created);
    return created;
  }

  afterEach(async () => {
    await Promise.all(open.splice(0).map((created) => created.end()));
  });

  it("cuts off a statement waiting on a lock somebody else holds", async () => {
    const holder = pool({ DB_LOCK_TIMEOUT_MS: "0" });
    const held = await holder.connect();
    try {
      await held.query("begin");
      await held.query("select pg_advisory_xact_lock(20260912)");

      const waiter = pool({ DB_LOCK_TIMEOUT_MS: "300" });
      // Taken inside a transaction, as lib/works.ts takes it: this is the
      // per-user advisory lock every write in the app goes through, and that
      // lock_timeout covers an ADVISORY lock at all is the one thing here
      // worth measuring rather than assuming.
      const failure = await waiter
        .query("begin; select pg_advisory_xact_lock(20260912)")
        .then(() => null)
        .catch((error: unknown) => error);
      expect(databaseStall(failure)).toBe("lock-timeout");

      await held.query("rollback");
    } finally {
      // Released whatever the assertions did: an outstanding client would
      // make pool.end() in afterEach wait for a client that never comes back,
      // and the suite would time out instead of reporting the failure.
      held.release();
    }
  });

  it("cuts off a statement that simply runs too long", async () => {
    const slow = pool({ DB_STATEMENT_TIMEOUT_MS: "300" });
    const failure = await slow
      .query("select pg_sleep(5)")
      .then(() => null)
      .catch((error: unknown) => error);
    expect(databaseStall(failure)).toBe("statement-timeout");
  });

  it("answers the caller that cannot get a connection instead of queueing it", async () => {
    const crowded = pool({ DB_POOL_MAX: "1", DB_CONNECT_TIMEOUT_MS: "300" });
    const taken = await crowded.connect();
    try {
      const started = Date.now();
      // Before #172 this call waited for as long as the holder kept the
      // connection — for ever, if that was a statement nothing cut off.
      const failure = await crowded
        .query("select 1")
        .then(() => null)
        .catch((error: unknown) => error);
      expect(databaseStall(failure)).toBe("no-connection");
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      taken.release();
    }
  });

  it("survives the server killing a transaction that went quiet", async () => {
    const said: string[] = [];
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation((...parts: unknown[]) => {
        said.push(parts.join(" "));
      });
    const napping = pool({ DB_IDLE_TX_TIMEOUT_MS: "300" });
    const client = await napping.connect();
    try {
      await client.query("begin");
      await new Promise((wake) => setTimeout(wake, 1_000));
      // The point of the test is not this rejection. It is that the process
      // is still here to make it: the kill arrives on a client the pool has
      // checked out, whose own error listener pg-pool removed, and an 'error'
      // event with no listener ends the process. Measured 12.09.2026 — the
      // guard in watchPool is what this reaches.
      const failure = await client
        .query("select 1")
        .then(() => null)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(said.join("\n")).toContain("idle-transaction");
    } finally {
      client.release();
      logged.mockRestore();
    }
  });
});
