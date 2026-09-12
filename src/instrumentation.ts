// Next.js calls register() once, when a server starts (the file
// convention in node_modules/next/dist/docs/01-app/02-guides/
// instrumentation.md). #127: the one thing this app starts with its
// server is the frame-set collector's schedule (lib/r360/
// collector-timer.ts) — on the Node runtime, and only where APP_ENV lets
// it run.
//
// Every request waits for register() to settle, so it must never fail and
// never be slow: it only sets the timers, and what a run needs — the
// database, the bucket, sharp behind them — is loaded at the run, a minute
// after the start, where a failure is logged by the schedule instead of
// taking the site down (#127 review). A preview's server loads none of it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { collectorRunsIn, scheduleCollector } =
      await import("@/lib/r360/collector-timer");
    if (!collectorRunsIn(process.env.APP_ENV)) return;
    scheduleCollector({
      appEnv: process.env.APP_ENV,
      collect: async () => {
        const [
          { getDb },
          { getStorage, keyPrefix },
          { collectAllUnfinishedFrameSets, unrecordedFrameSets },
        ] = await Promise.all([
          import("@/db/client"),
          import("@/lib/storage"),
          import("@/lib/r360/frame-set"),
        ]);
        const deps = {
          db: getDb(),
          storage: getStorage(),
          prefix: keyPrefix(),
        };
        // Collect first: what a record names is dealt with before what
        // nothing does is counted (#156). The report has its own net —
        // what was deleted must reach the log even if the counting after
        // it fails (#156 review).
        const collected = await collectAllUnfinishedFrameSets(deps);
        try {
          return { collected, unrecorded: await unrecordedFrameSets(deps) };
        } catch (error) {
          console.error("[r360] collector: the report failed", error);
          return { collected, unrecorded: [] };
        }
      },
    });
  } catch (error) {
    console.error("[r360] collector: the schedule did not start", error);
  }
}

// #172: the one place every server-side failure passes through (the
// `onRequestError` half of the instrumentation file convention). It exists
// for one line of log — the database deadlines answer with an error now
// instead of waiting for ever, and an operator reading the log has to be able
// to tell that from a request that was merely slow. Everything else Next
// already prints; this adds a name to the four bounds #172 introduced.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
) {
  const { databaseStall } = await import("@/db/client");
  const stall = databaseStall(error);
  if (!stall) return;
  console.error(
    `[db] ${request.method} ${request.path} hit the ${stall} bound — the numbers are DB_* in .env.example (#172)`,
  );
}
