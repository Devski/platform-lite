// #127 (the design on #126, Dawid's decision of 10.09.2026): the frame-set
// collector on a schedule — every 12 hours, and once a minute after the
// server starts, so a deploy never pushes it back by half a day. What it
// runs is collectAllUnfinishedFrameSets; this file only says when, and
// where never.
//
// Never in a preview. Since #113 a preview has a database of its own — but
// it is a COPY of dev's, naming dev's objects in the bucket every
// environment shares, and this collector deletes RECORDS and the bytes
// behind them. A sweep there would reason about dev's objects with a copy
// of dev's rows that nothing keeps current. (lib/storage.ts confines a
// delete to the environment's own key prefix, which is the belt; this is
// the braces, and the older of the two.) So the block is a hard allow-list
// on APP_ENV — the deployed environments that own their data — not a
// setting that could be left on: a preview, CI, a developer's machine, a
// missing or a mistyped value all run nothing. Pure, with the collection
// handed in, so the schedule is tested without a database or a clock.

/** Every twelve hours (#126). */
export const COLLECT_EVERY_MS = 12 * 60 * 60 * 1000;
/** Off the startup path, once the server is serving. */
export const FIRST_COLLECT_AFTER_MS = 60 * 1000;

/** The environments that own their database: dev's instance, production. */
const COLLECTING_ENVIRONMENTS = new Set(["dev", "production"]);

/** Whether the collector may run here — see the head of this file. */
export function collectorRunsIn(appEnv: string | undefined): boolean {
  return COLLECTING_ENVIRONMENTS.has(appEnv?.trim() ?? "");
}

/**
 * What one run did: the unfinished sets it collected, and (#156) the sets
 * no record names, which it only looked at. Structural on purpose — this
 * file loads nothing of the database or the bucket.
 */
export interface CollectorRun {
  collected: string[];
  unrecorded: {
    keyPrefix: string;
    objects: number;
    bytes: number;
    more?: boolean;
  }[];
}

/** How many reported sets the log names before it says "and more". */
const REPORTED_IN_LOG = 20;

/**
 * Starts the schedule, or does nothing where the collector may not run
 * (null then). A tick while the last run is still going is skipped; a run
 * that fails is logged, and the next one comes as planned. The timers do
 * not hold the process open.
 */
export function scheduleCollector(options: {
  appEnv: string | undefined;
  collect: () => Promise<CollectorRun>;
}): (() => void) | null {
  if (!collectorRunsIn(options.appEnv)) return null;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { collected, unrecorded } = await options.collect();
      console.info(
        `[r360] collector: ${collected.length} unfinished set(s) collected${
          collected.length ? `: ${collected.join(", ")}` : ""
        }`,
      );
      // #156: said out loud, left where it is — a human decides.
      if (unrecorded.length > 0) {
        const named = unrecorded
          .slice(0, REPORTED_IN_LOG)
          .map(
            (set) =>
              `${set.keyPrefix} (${set.objects}${set.more ? "+" : ""} objects, ${set.bytes} bytes)`,
          )
          .join("; ");
        const more = unrecorded.length - REPORTED_IN_LOG;
        console.warn(
          `[r360] collector: ${unrecorded.length} frame set(s) no record names, left alone: ${named}${
            more > 0 ? `; and ${more} more` : ""
          }`,
        );
      }
    } catch (error) {
      console.error("[r360] collector: the run failed", error);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(run, FIRST_COLLECT_AFTER_MS);
  const every = setInterval(run, COLLECT_EVERY_MS);
  first.unref?.();
  every.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
