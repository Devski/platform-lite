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
          { collectAllUnfinishedFrameSets },
        ] = await Promise.all([
          import("@/db/client"),
          import("@/lib/storage"),
          import("@/lib/r360/frame-set"),
        ]);
        return collectAllUnfinishedFrameSets({
          db: getDb(),
          storage: getStorage(),
          prefix: keyPrefix(),
        });
      },
    });
  } catch (error) {
    console.error("[r360] collector: the schedule did not start", error);
  }
}
