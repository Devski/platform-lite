import { describe, expect, it } from "vitest";
import {
  COAST_MAX_SPEED,
  TRAVEL_MAX_MS,
  coastAfterDrag,
  coastOnRelease,
  dragSpeed,
  frameAfterDrag,
  frameAfterKey,
  framesAlong,
  glides,
  loadingOrder,
  nearestLoaded,
  pageStep,
  shortestTurn,
  travelCurve,
  travelStop,
  wrapFrame,
  type OrbitParams,
} from "./orbit";

// #103/#104: the orbit's arithmetic, as decided on #68 — relative,
// discrete, wrapping, in the work's direction. #153 adds the shape of
// the motion: the curve a travel follows, and what a drag let go of
// carries with it.

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

describe("glides (#153)", () => {
  it("is on unless the owner said otherwise: only false turns it off", () => {
    expect(glides({})).toBe(true);
    expect(glides({ glide: undefined })).toBe(true);
    expect(glides({ glide: true })).toBe(true);
    expect(glides({ glide: false })).toBe(false);
  });
});

describe("framesAlong", () => {
  it("lists the frames a turn passes, the destination last and the frame it starts on not among them", () => {
    expect(framesAlong(1, 3, 10)).toEqual([2, 3, 4]);
    expect(framesAlong(1, -3, 10)).toEqual([10, 9, 8]);
    expect(framesAlong(9, 4, 10)).toEqual([10, 1, 2, 3]);
  });

  it("has nowhere to go on a turn of nothing", () => {
    expect(framesAlong(4, 0, 10)).toEqual([]);
  });

  // #153: a throw can be worth more than one turn of the orbit, and the
  // path must carry every frame of it — the travel spends its time on
  // the list it is given, not on the distance between two numbers.
  it("keeps going past the last frame when the turn is longer than the orbit", () => {
    expect(framesAlong(1, 12, 10)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3,
    ]);
  });
});

describe("dragSpeed (#153)", () => {
  const p = params(120, 10);

  it("is the frames the drag covered over the time it took, in the work's direction", () => {
    // Half the picture's width in 100 ms, at 10 frames a width: 5 frames
    // in 100 ms.
    const samples = [
      { x: 0, t: 0 },
      { x: 50, t: 50 },
      { x: 100, t: 100 },
    ];
    expect(dragSpeed(samples, 200, p)).toBeCloseTo(0.05, 10);
    expect(dragSpeed(samples, 200, params(120, 10, -1))).toBeCloseTo(-0.05, 10);
  });

  it("reads the oldest and the newest, whatever happened between them", () => {
    // There and back again inside the window: the hand ends where it
    // started and the orbit is going nowhere.
    expect(
      dragSpeed(
        [
          { x: 0, t: 0 },
          { x: 90, t: 50 },
          { x: 0, t: 100 },
        ],
        200,
        p,
      ),
    ).toBe(0);
  });

  it("is nothing when there is nothing to divide by", () => {
    const two = [
      { x: 0, t: 0 },
      { x: 100, t: 100 },
    ];
    expect(dragSpeed([], 200, p)).toBe(0);
    expect(dragSpeed([{ x: 0, t: 0 }], 200, p)).toBe(0);
    expect(dragSpeed(two, 0, p)).toBe(0);
    // One instant, read twice — and a clock that ran backwards, which is
    // the same guard travelStop keeps for #161.
    expect(
      dragSpeed(
        [
          { x: 0, t: 40 },
          { x: 100, t: 40 },
        ],
        200,
        p,
      ),
    ).toBe(0);
    expect(
      dragSpeed(
        [
          { x: 0, t: 100 },
          { x: 100, t: 0 },
        ],
        200,
        p,
      ),
    ).toBe(0);
  });
});

// The numbers themselves are a feel, to be tried on a phone with Dawid;
// what is tested here is what must hold whatever they are tuned to.
describe("coastAfterDrag (#153)", () => {
  it("goes the way the hand was going", () => {
    // Half the cap: hard enough to carry whatever the feel is tuned to,
    // and not so hard that both readings land on the cap and prove
    // nothing.
    const forward = coastAfterDrag(COAST_MAX_SPEED / 2);
    const back = coastAfterDrag(-COAST_MAX_SPEED / 2);
    expect(forward).not.toBeNull();
    expect(forward?.turn).toBeGreaterThan(0);
    expect(back?.turn).toBe(-(forward?.turn ?? 0));
    expect(back?.ms).toBe(forward?.ms);
  });

  // Constant slowing: twice the speed takes twice as long to shed, and
  // covers four times the ground doing it.
  it("twice as fast runs twice as long and carries more than twice as far", () => {
    // Both under the cap by construction, so the comparison is of the
    // slowing and not of the clamp.
    const slower = coastAfterDrag(COAST_MAX_SPEED / 4);
    const faster = coastAfterDrag(COAST_MAX_SPEED / 2);
    expect(faster?.ms).toBeCloseTo(2 * (slower?.ms ?? 0), 10);
    expect(faster?.turn).toBeGreaterThan(2 * (slower?.turn ?? 0));
  });

  it("takes a throw no further than a travel's longest, however hard it was", () => {
    // Derived, not guessed: the inputs stay above the cap and the bound
    // stays the travel's own, whatever the feel is later tuned to.
    const hard = coastAfterDrag(COAST_MAX_SPEED * 4);
    const harder = coastAfterDrag(COAST_MAX_SPEED * 400);
    expect(hard?.ms).toBeLessThanOrEqual(TRAVEL_MAX_MS);
    expect(harder).toEqual(hard);
  });

  // The floor is the frame itself: a throw that would not carry one is a
  // hand that let go rather than threw, and the orbit stops where it is.
  it("does not coast a hand that was barely moving, or not at all", () => {
    expect(coastAfterDrag(0)).toBeNull();
    expect(coastAfterDrag(0.0001)).toBeNull();
    expect(coastAfterDrag(Number.NaN)).toBeNull();
    expect(coastAfterDrag(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

// #153: the four ways a release does NOT throw the orbit, and the one
// way it does. This is the half of the coast that lives on a pointer
// event rather than in a number, and the half most likely to be undone
// by a tidy-up of the hook.
describe("coastOnRelease (#153)", () => {
  const p = params(120, 10);
  // A hand crossing a fifth of a 200 px picture in the 40 ms before it
  // let go: 2 frames in 40 ms at 10 frames a width, well over the floor.
  const thrown = {
    samples: [
      { x: 0, t: 960 },
      { x: 20, t: 980 },
      { x: 40, t: 1000 },
    ],
    lift: { x: 40, t: 1000 },
    width: 200,
    lifted: true,
    glide: true,
    reducedMotion: false,
  };
  /** The same throw, the hand resting `rest` ms before it lets go. */
  const rested = (rest: number) => ({
    ...thrown,
    lift: { x: 40, t: 1000 + rest },
  });

  /** The same throw, the hand going the other way. */
  const mirrored = {
    ...thrown,
    samples: thrown.samples.map((s) => ({ ...s, x: -s.x })),
    lift: { ...thrown.lift, x: -thrown.lift.x },
  };

  it("throws the orbit the way a hand still moving was going", () => {
    const coast = coastOnRelease(thrown, p);
    expect(coast).not.toBeNull();
    expect(coast?.turn).toBeGreaterThan(0);
    expect(coastOnRelease(mirrored, p)?.turn).toBe(-(coast?.turn ?? 0));
  });

  // The one with no flag of its own: a hand at rest states itself, which
  // is why there is no threshold here to drift out of step with anything.
  it("does not throw a hand that came to rest before it let go", () => {
    expect(coastOnRelease(rested(500), p)).toBeNull();
  });

  // What that rest must NOT be is a step. Measured between moves, the
  // time a hand spends still before lifting never reaches the divisor:
  // the throw would keep its full speed until the window emptied and
  // then vanish. A finger lifts tens of milliseconds after it stops, so
  // that edge is the ordinary gesture, and it would have spun the orbit
  // most of the way round on a drag the visitor had already finished.
  it("drains the throw as the hand rests, rather than all at once", () => {
    const turnAfter = (rest: number) => coastOnRelease(rested(rest), p)?.turn;
    const straight = turnAfter(0);
    expect(straight).toBeGreaterThan(0);
    expect(turnAfter(40)).toBeLessThan(straight!);
    expect(turnAfter(70)).toBeLessThan(turnAfter(40)!);
    expect(coastOnRelease(rested(150), p)).toBeNull();
  });

  it("does not throw a pointer that was cancelled or taken away", () => {
    expect(coastOnRelease({ ...thrown, lifted: false }, p)).toBeNull();
  });

  it("does not throw an orbit whose owner turned the glide off", () => {
    expect(coastOnRelease({ ...thrown, glide: false }, p)).toBeNull();
  });

  // Reduced motion wins over the owner: a jump is not a substitute for a
  // coast, so there is nothing to fall back to and the orbit stops dead.
  it("does not throw for a visitor whose system asks for less motion", () => {
    expect(coastOnRelease({ ...thrown, reducedMotion: true }, p)).toBeNull();
  });

  it("has nothing to measure from the lift alone, or a picture with no width", () => {
    expect(coastOnRelease({ ...thrown, samples: [] }, p)).toBeNull();
    expect(coastOnRelease({ ...thrown, width: 0 }, p)).toBeNull();
  });

  // The press is not a reading (the hook does not record it), so a tap
  // that wobbled past the slop once and stopped has one move and a lift
  // at the same place: no distance, no throw.
  it("does not throw a tap that wobbled and stopped", () => {
    expect(
      coastOnRelease({ ...thrown, samples: [{ x: 40, t: 990 }] }, p),
    ).toBeNull();
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

  // #153: the same path and the same time, the frames spread differently
  // along it. A ten-frame path over a second, read against the constant
  // pace every travel had before. #175 made the eased shape two amounts;
  // full both ways is the curve #153 shipped, so this test is unchanged
  // except for how the curve is named.
  const EASED = { easeIn: 1, easeOut: 1 };
  it("eased lingers at the start and settles onto its frame early", () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // A tenth of the way through, an eased travel has not left its first
    // frame; a steady one is already on the second.
    expect(travelStop(ten, 100, 1000, EASED).frame).toBe(1);
    expect(travelStop(ten, 100, 1000).frame).toBe(2);
    // Halfway is halfway either way — the curve is symmetric.
    expect(travelStop(ten, 500, 1000, EASED).frame).toBe(6);
    expect(travelStop(ten, 500, 1000).frame).toBe(6);
    // And it is on its last frame with time left to settle there.
    expect(travelStop(ten, 850, 1000, EASED).frame).toBe(10);
    expect(travelStop(ten, 850, 1000).frame).toBe(9);
  });

  // #175: each amount bends its own half of the travel, and nothing else.
  it("eases each end by its own amount, and none at all at zero", () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const none = { easeIn: 0, easeOut: 0 };
    // Nothing either way is the constant pace, frame for frame.
    for (const at of [100, 200, 500, 850]) {
      expect(travelStop(ten, at, 1000, none).frame, `at ${at}`).toBe(
        travelStop(ten, at, 1000).frame,
      );
    }
    // Gathering pace but not settling: slow away from the first frame,
    // then straight on to the last — which it reaches no earlier than a
    // travel at a constant pace does.
    const inOnly = { easeIn: 1, easeOut: 0 };
    expect(travelStop(ten, 100, 1000, inOnly).frame).toBe(1);
    expect(travelStop(ten, 850, 1000, inOnly).frame).toBe(9);
    // Settling but not gathering: off the mark at once, then easing in.
    const outOnly = { easeIn: 0, easeOut: 1 };
    expect(travelStop(ten, 100, 1000, outOnly).frame).toBe(2);
    expect(travelStop(ten, 850, 1000, outOnly).frame).toBe(10);
    // Halfway is halfway whatever the amounts: the two halves are bent
    // around the point they share, so no mixture puts a step in the middle.
    for (const curve of [none, inOnly, outOnly, EASED]) {
      expect(travelStop(ten, 500, 1000, curve).frame).toBe(6);
    }
  });

  it("reads an amount outside 0..1, or none at all, as the full ease", () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const full = travelStop(ten, 100, 1000, EASED).frame;
    expect(travelStop(ten, 100, 1000, travelCurve({})).frame).toBe(full);
    expect(
      travelStop(ten, 100, 1000, travelCurve({ easeIn: Number.NaN })).frame,
    ).toBe(full);
    expect(travelStop(ten, 100, 1000, travelCurve({ easeIn: 9 })).frame).toBe(
      full,
    );
    // And the switch still wins over both amounts.
    expect(travelCurve({ glide: false, easeIn: 1, easeOut: 1 })).toBe("steady");
  });

  it("slowing spends its speed early: three quarters of the path in half the time", () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(travelStop(ten, 500, 1000, "slowing").frame).toBe(8);
    expect(travelStop(ten, 500, 1000).frame).toBe(6);
    expect(travelStop(ten, 200, 1000, "slowing").frame).toBe(4);
    expect(travelStop(ten, 200, 1000).frame).toBe(3);
  });

  // A curve is a way of spending the time, not of changing where the
  // travel ends or when it is over: an animation frame that arrives late
  // reads a progress past 1, and smoothstep of 1.2 turns back DOWN the
  // path — the orbit would walk backwards out of its destination.
  it("ends on the destination, on time, whatever curve it took", () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const curve of [
      "steady",
      "slowing",
      EASED,
      { easeIn: 0, easeOut: 1 },
    ] as const) {
      expect(travelStop(ten, 1000, 1000, curve), String(curve)).toEqual({
        frame: 10,
        arrived: true,
      });
      expect(travelStop(ten, 9_000, 1000, curve), String(curve)).toEqual({
        frame: 10,
        arrived: true,
      });
      expect(travelStop(ten, -9_000, 1000, curve), String(curve)).toEqual({
        frame: 1,
        arrived: false,
      });
    }
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
