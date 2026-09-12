import { describe, expect, it } from "vitest";
import {
  frameAfterDrag,
  frameAfterKey,
  loadingOrder,
  nearestLoaded,
  pageStep,
  shortestTurn,
  travelStop,
  wrapFrame,
  type OrbitParams,
} from "./orbit";

// #103/#104: the orbit's arithmetic, as decided on #68 — relative,
// discrete, wrapping, in the work's direction.

const params = (
  frameCount: number,
  framesPerWidth = frameCount,
  direction: 1 | -1 = 1,
  startFrame = 1,
): OrbitParams => ({ frameCount, framesPerWidth, direction, startFrame });

describe("wrapFrame", () => {
  it("keeps 1..N and wraps both ways with the non-negative modulo", () => {
    expect(wrapFrame(1, 10)).toBe(1);
    expect(wrapFrame(10, 10)).toBe(10);
    expect(wrapFrame(11, 10)).toBe(1);
    expect(wrapFrame(0, 10)).toBe(10);
    expect(wrapFrame(-9, 10)).toBe(1);
    expect(wrapFrame(-10, 10)).toBe(10);
    expect(wrapFrame(25, 2)).toBe(1);
  });
});

describe("frameAfterDrag", () => {
  it("the design conversation's example: 10 frames, k = 10, a drag from 35 % to 85 % of the width goes from 4 through 5, 6, 7, 8 to 9", () => {
    const p = params(10, 10);
    const width = 1000;
    const from = 350;
    const passed = [400, 500, 600, 700, 800, 850].map((x) =>
      frameAfterDrag(4, x - from, width, p),
    );
    expect(passed).toEqual([5, 6, 7, 8, 9, 9]);
  });

  it("rounds from the anchor, never accumulates: a slow drag still moves", () => {
    const p = params(120, 60);
    // Each frame is width/60 wide; a pointer at 0.4 of that rounds to 0,
    // at 0.6 to 1 — from the anchor, whatever the moves in between.
    const width = 600;
    expect(frameAfterDrag(1, 4, width, p)).toBe(1);
    expect(frameAfterDrag(1, 6, width, p)).toBe(2);
    expect(frameAfterDrag(1, 600, width, p)).toBe(61);
    expect(frameAfterDrag(1, -10, width, p)).toBe(120);
  });

  it("follows the work's direction and wraps past the last frame", () => {
    expect(frameAfterDrag(9, 250, 1000, params(10, 4))).toBe(10);
    expect(frameAfterDrag(9, 500, 1000, params(10, 4))).toBe(1);
    expect(frameAfterDrag(2, 500, 1000, params(10, 4, -1))).toBe(10);
    expect(frameAfterDrag(1, 1000, 1000, params(2, 1))).toBe(2);
    expect(frameAfterDrag(1, 2000, 1000, params(2, 1))).toBe(1);
  });

  it("stays put over a box with no width", () => {
    expect(frameAfterDrag(3, 100, 0, params(9))).toBe(3);
  });
});

describe("frameAfterKey", () => {
  it("arrows one frame the work's way, Page keys a twelfth, Home the start frame, End the opposite one, the rest ignored", () => {
    const p = params(120, 60, 1, 7);
    expect(frameAfterKey(120, "ArrowRight", p)).toBe(1);
    expect(frameAfterKey(1, "ArrowLeft", p)).toBe(120);
    expect(pageStep(120)).toBe(10);
    expect(frameAfterKey(115, "PageDown", p)).toBe(5);
    expect(frameAfterKey(5, "PageUp", p)).toBe(115);
    expect(frameAfterKey(50, "Home", p)).toBe(7);
    expect(frameAfterKey(50, "End", p)).toBe(67);
    expect(frameAfterKey(120, "ArrowUp", p)).toBe(1);
    expect(frameAfterKey(1, "ArrowDown", p)).toBe(120);
    expect(frameAfterKey(50, "Enter", p)).toBeNull();
    const reversed = params(9, 9, -1);
    expect(frameAfterKey(1, "ArrowRight", reversed)).toBe(9);
    expect(pageStep(9)).toBe(1);
    expect(frameAfterKey(1, "PageDown", reversed)).toBe(9);
  });
});

describe("travelStop", () => {
  const path = [4, 1];

  it("gives every frame on the path an equal share of the time, and arrives at the end", () => {
    expect(travelStop(path, 0, 250)).toEqual({ frame: 4, arrived: false });
    expect(travelStop(path, 124, 250)).toEqual({ frame: 4, arrived: false });
    expect(travelStop(path, 125, 250)).toEqual({ frame: 1, arrived: false });
    // On the destination, not yet arrived: the last frame has its slice too.
    expect(travelStop(path, 249, 250)).toEqual({ frame: 1, arrived: false });
    expect(travelStop(path, 250, 250)).toEqual({ frame: 1, arrived: true });
    // Long past its time — an animation frame that came late.
    expect(travelStop(path, 9_000, 250)).toEqual({ frame: 1, arrived: true });
  });

  // #161: a clock that hands back less than it did before must not strand
  // the orbit. The frame an animation gets is the time that frame began,
  // which can precede the reading taken in the click that started the
  // travel, and a virtual machine's monotonic clock steps back outright.
  it("reads time that runs backwards as no time at all, never past the path", () => {
    expect(travelStop(path, -1, 250)).toEqual({ frame: 4, arrived: false });
    expect(travelStop(path, -9_000, 250)).toEqual({ frame: 4, arrived: false });
  });

  it("has arrived before it starts when there is no time to take", () => {
    expect(travelStop(path, 0, 0)).toEqual({ frame: 1, arrived: true });
  });

  it("has nowhere to be with no path, and says so", () => {
    const { frame, arrived } = travelStop([], 10, 250);
    expect(Number.isNaN(frame)).toBe(true);
    expect(arrived).toBe(true);
  });

  it("reads a time that is no number as none — the frame stays on the path", () => {
    expect(travelStop(path, Number.NaN, 250)).toEqual({
      frame: 4,
      arrived: false,
    });
  });

  // The everyday path: travelPath gives one frame for the next one round.
  it("shows the one frame of a one-frame path until its time is up", () => {
    expect(travelStop([9], 0, 250)).toEqual({ frame: 9, arrived: false });
    expect(travelStop([9], 249, 250)).toEqual({ frame: 9, arrived: false });
    expect(travelStop([9], 250, 250)).toEqual({ frame: 9, arrived: true });
  });

  it("walks a long path frame by frame, each in its own slice", () => {
    const long = [5, 6, 7, 8];
    expect(travelStop(long, 0, 400).frame).toBe(5);
    expect(travelStop(long, 99, 400).frame).toBe(5);
    expect(travelStop(long, 100, 400).frame).toBe(6);
    expect(travelStop(long, 250, 400).frame).toBe(7);
    expect(travelStop(long, 399, 400)).toEqual({ frame: 8, arrived: false });
    expect(travelStop(long, 400, 400)).toEqual({ frame: 8, arrived: true });
  });
});

describe("shortestTurn", () => {
  it("takes the shorter arc, signed, and goes forward on a tie", () => {
    expect(shortestTurn(1, 3, 10)).toBe(2);
    expect(shortestTurn(3, 1, 10)).toBe(-2);
    expect(shortestTurn(1, 10, 10)).toBe(-1);
    expect(shortestTurn(1, 6, 10)).toBe(5);
    expect(shortestTurn(6, 1, 10)).toBe(5);
    expect(shortestTurn(4, 4, 10)).toBe(0);
  });
});

describe("loadingOrder", () => {
  it("starts at the start frame, every 8th, then 4th, 2nd, the rest — each frame once", () => {
    const order = loadingOrder(16, 1);
    expect(order.slice(0, 2)).toEqual([1, 9]);
    expect(order.slice(2, 4)).toEqual([5, 13]);
    expect(order.slice(4, 8)).toEqual([3, 7, 11, 15]);
    expect(order.slice(8)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(loadingOrder(9, 4)[0]).toBe(4);
    expect([...loadingOrder(9, 4)].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(loadingOrder(2, 2)).toEqual([2, 1]);
  });
});

describe("nearestLoaded", () => {
  it("answers the frame itself, else the nearest around the orbit, the work's way on a tie, null with nothing loaded", () => {
    const p = { frameCount: 10, direction: 1 as const };
    expect(nearestLoaded(3, new Set(), p)).toBeNull();
    expect(nearestLoaded(3, new Set([3]), p)).toBe(3);
    expect(nearestLoaded(3, new Set([1, 6]), p)).toBe(1);
    expect(nearestLoaded(9, new Set([1, 6]), p)).toBe(1);
    expect(nearestLoaded(3, new Set([1, 5]), p)).toBe(5);
    expect(nearestLoaded(3, new Set([1, 5]), { ...p, direction: -1 })).toBe(1);
  });
});
