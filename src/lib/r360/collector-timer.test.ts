import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLLECT_EVERY_MS,
  FIRST_COLLECT_AFTER_MS,
  collectorRunsIn,
  scheduleCollector,
  type CollectorRun,
} from "./collector-timer";
import type { UnrecordedFrameSet } from "./frame-set";

// #127: when the frame-set collector runs on its own — every 12 hours, and
// once a minute after the server starts — and where it never does.

describe("collectorRunsIn", () => {
  it("is on only in the deployed environments that own their data", () => {
    expect(collectorRunsIn("dev")).toBe(true);
    expect(collectorRunsIn("production")).toBe(true);
    // A stray space reads as the value, as isProduction reads it.
    expect(collectorRunsIn(" dev ")).toBe(true);
  });

  it("is off in a preview — which shares dev's database — and everywhere else, a typo included", () => {
    for (const env of [
      "preview",
      "ci",
      "local",
      "",
      undefined,
      "Dev",
      "development",
      "prod",
    ]) {
      expect(collectorRunsIn(env), String(env)).toBe(false);
    }
  });
});

describe("scheduleCollector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ran = (
    collected: string[] = [],
    unrecorded: UnrecordedFrameSet[] = [],
  ) => vi.fn(async () => ({ collected, unrecorded }));

  it("runs a minute after the start, then every 12 hours", async () => {
    const collect = ran(["devski/u/a/r360/s/"]);
    const stop = scheduleCollector({ appEnv: "dev", collect });
    expect(stop).not.toBeNull();
    await vi.advanceTimersByTimeAsync(FIRST_COLLECT_AFTER_MS - 1);
    expect(collect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(collect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS);
    expect(collect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS);
    expect(collect).toHaveBeenCalledTimes(3);
    stop?.();
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS * 2);
    expect(collect).toHaveBeenCalledTimes(3);
  });

  // #156: what no record names is said out loud and left where it is.
  it("says what it collected, and warns about the sets no record names", async () => {
    const collect = ran(
      ["devski/u/a/r360/one/"],
      [{ keyPrefix: "devski/u/a/r360/two/", objects: 3, bytes: 900 }],
    );
    scheduleCollector({ appEnv: "dev", collect });
    await vi.advanceTimersByTimeAsync(FIRST_COLLECT_AFTER_MS);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining("1 unfinished set(s) collected"),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("devski/u/a/r360/two/"),
    );
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("3"));
  });

  it("names twenty of them at most, says how many more, and marks a count that stopped at its cap", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      keyPrefix: `devski/u/a/r360/${i}/`,
      objects: 1000,
      bytes: 10,
      more: true,
    }));
    scheduleCollector({ appEnv: "dev", collect: ran([], many) });
    await vi.advanceTimersByTimeAsync(FIRST_COLLECT_AFTER_MS);
    const line = vi.mocked(console.warn).mock.calls[0][0] as string;
    expect(line).toContain("25 frame set(s)");
    expect(line).toContain("1000+ objects");
    expect(line).toContain("and 5 more");
    expect(line).toContain("devski/u/a/r360/19/");
    expect(line).not.toContain("devski/u/a/r360/20/");
  });

  it("warns about nothing when every set is accounted for", async () => {
    scheduleCollector({ appEnv: "dev", collect: ran() });
    await vi.advanceTimersByTimeAsync(FIRST_COLLECT_AFTER_MS);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("schedules nothing where it may not run", async () => {
    const collect = ran();
    expect(scheduleCollector({ appEnv: "preview", collect })).toBeNull();
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS * 3);
    expect(collect).not.toHaveBeenCalled();
  });

  it("skips a tick while the last run is still going, and keeps going after a run that failed", async () => {
    let finish: () => void = () => undefined;
    const nothing = { collected: [], unrecorded: [] };
    const collect = vi
      .fn<() => Promise<CollectorRun>>()
      .mockImplementationOnce(
        () =>
          new Promise<CollectorRun>((resolve) => {
            finish = () => resolve(nothing);
          }),
      )
      .mockRejectedValueOnce(new Error("the bucket said no"))
      .mockResolvedValue(nothing);
    const stop = scheduleCollector({ appEnv: "production", collect });
    await vi.advanceTimersByTimeAsync(FIRST_COLLECT_AFTER_MS);
    expect(collect).toHaveBeenCalledTimes(1);
    // Still running at the first 12-hour tick: that tick is skipped.
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS);
    expect(collect).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS);
    expect(collect).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS);
    expect(collect).toHaveBeenCalledTimes(3);
    stop?.();
  });
});
