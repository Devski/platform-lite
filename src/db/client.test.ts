import { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseStall, deadlinesFor, poolConfig } from "./client";

// #172. Two halves: what the pool is configured with (pure, runs everywhere)
// and what those settings actually do to a waiting statement — which only a
// real server can answer, so that half runs when DATABASE_URL_TEST is set
// (always in CI, through the tunnel locally). PGlite cannot stand in: it is
// one in-process connection, and every bound here is about the second one.

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
    // A transaction that has gone quiet still holds its locks, so it is given
    // no longer than a single statement may run.
    expect(config.idle_in_transaction_session_timeout).toBe(10_000);
  });

  it("lets a batch job take as long as its work takes", () => {
    const { statementMs, lockMs, connectMs } = deadlinesFor("batch");
    // 0 is PostgreSQL's own "no bound": a seed, an import or a backfill must
    // never be cut off halfway by a number chosen for a page.
    expect(statementMs).toBe(0);
    expect(lockMs).toBe(0);
    // It still gives up on a database that cannot be reached at all.
    expect(connectMs).toBeGreaterThan(0);
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

  it("refuses a deadline that is not a whole number of milliseconds", () => {
    vi.stubEnv("DB_CONNECT_TIMEOUT_MS", "5s");
    // Loud, like every other environment mistake here: a deadline that
    // silently fell back to the default would be found the night it mattered.
    expect(() => deadlinesFor("web")).toThrow(/DB_CONNECT_TIMEOUT_MS/);
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
    const created = new Pool(poolConfig("web", url!));
    created.on("error", () => {});
    open.push(created);
    return created;
  }

  afterEach(async () => {
    await Promise.all(open.splice(0).map((created) => created.end()));
  });

  it("cuts off a statement waiting on a lock somebody else holds", async () => {
    const holder = pool({ DB_LOCK_TIMEOUT_MS: "0" });
    const held = await holder.connect();
    await held.query("begin");
    await held.query("select pg_advisory_xact_lock(20260912)");

    const waiter = pool({ DB_LOCK_TIMEOUT_MS: "300" });
    // The app's own per-user lock is an advisory one (lockUser in
    // lib/works.ts), and lock_timeout covers it — measured here rather than
    // assumed, because that is the lock every write in the app takes.
    const failure = await waiter
      .query("select pg_advisory_xact_lock(20260912)")
      .then(() => null)
      .catch((error: unknown) => error);
    expect(databaseStall(failure)).toBe("lock-timeout");

    await held.query("rollback");
    held.release();
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
    const started = Date.now();
    // Before #172 this call waited for as long as the holder kept the
    // connection — for ever, if that was a statement nothing cut off.
    const failure = await crowded
      .query("select 1")
      .then(() => null)
      .catch((error: unknown) => error);
    expect(databaseStall(failure)).toBe("no-connection");
    expect(Date.now() - started).toBeLessThan(5_000);
    taken.release();
  });
});
