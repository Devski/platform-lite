import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLLECT_EVERY_MS,
  FIRST_COLLECT_AFTER_MS,
  collectorRunsIn,
  scheduleCollector,
} from "./collector-timer";

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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs a minute after the start, then every 12 hours", async () => {
    const collect = vi.fn(async () => ["devski/u/a/r360/s/"]);
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

  it("schedules nothing where it may not run", async () => {
    const collect = vi.fn(async () => []);
    expect(scheduleCollector({ appEnv: "preview", collect })).toBeNull();
    await vi.advanceTimersByTimeAsync(COLLECT_EVERY_MS * 3);
    expect(collect).not.toHaveBeenCalled();
  });

  it("skips a tick while the last run is still going, and keeps going after a run that failed", async () => {
    let finish: () => void = () => undefined;
    const collect = vi
      .fn<() => Promise<string[]>>()
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            finish = () => resolve([]);
          }),
      )
      .mockRejectedValueOnce(new Error("the bucket said no"))
      .mockResolvedValue([]);
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
