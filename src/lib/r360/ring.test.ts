import { describe, expect, it } from "vitest";
import type { OrbitParams } from "./orbit";
import {
  angleOfFrame,
  angleOfPoint,
  frameAtAngle,
  loadedRuns,
  loadedRunsPath,
  ringPoint,
  ringRadii,
  travelPath,
} from "./ring";

// #106: the ring's geometry — the start frame at the bottom, the frames
// around it the work's way, the pointer's angle picking a frame, a click
// travelling the shorter arc.

const params = (
  frameCount: number,
  direction: 1 | -1 = 1,
  startFrame = 1,
): OrbitParams => ({ frameCount, direction, framesPerWidth: 1, startFrame });
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

describe("angleOfFrame and frameAtAngle", () => {
  // #124: the start frame is still at the bottom, and the numbers still
  // grow the work's way — but round the screen the other way than they
  // did, which is the whole of that issue. Every one of these expectations
  // is the old one with its sign turned.
  it("puts the start frame at the bottom and the next one a step anticlockwise, the work's way", () => {
    const p = params(8, 1, 3);
    close(angleOfFrame(3, p), 0);
    close(angleOfFrame(4, p), -Math.PI / 4);
    close(angleOfFrame(7, p), -Math.PI);
    close(angleOfFrame(2, p), -(7 * Math.PI) / 4);
    const reversed = params(8, -1, 3);
    close(angleOfFrame(4, reversed), Math.PI / 4);
    close(angleOfFrame(2, reversed), (7 * Math.PI) / 4);
  });

  it("maps every angle back to the nearest frame, both ways round", () => {
    for (const p of [params(8, 1, 3), params(8, -1, 3), params(7, -1, 5)]) {
      for (let frame = 1; frame <= p.frameCount; frame++) {
        const angle = angleOfFrame(frame, p);
        const onScreen =
          ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        expect(frameAtAngle(onScreen, p)).toBe(frame);
        expect(frameAtAngle(angle, p)).toBe(frame);
      }
    }
    // Just short of halfway to the next frame stays; just past it moves.
    const p = params(8);
    expect(frameAtAngle(Math.PI / 8 - 0.01, p)).toBe(1);
    // Anticlockwise now (#124): a step clockwise of the bottom is the
    // frame BEFORE the start, not the one after it.
    expect(frameAtAngle(Math.PI / 8 + 0.01, p)).toBe(8);
  });
});

describe("ringPoint and angleOfPoint", () => {
  it("draws the bottom at angle 0 and goes clockwise on screen, on an ellipse", () => {
    const bottom = ringPoint(0, 100, 40);
    close(bottom.x, 0);
    close(bottom.y, 40);
    const left = ringPoint(Math.PI / 2, 100, 40);
    close(left.x, -100);
    close(left.y, 0);
    const top = ringPoint(Math.PI, 100, 40);
    close(top.y, -40);
  });

  it("reads a pointer back to the angle of the point it is on, whatever the flattening", () => {
    for (const angle of [0, 0.7, Math.PI / 2, 2.5, Math.PI, 4, 5.9]) {
      const { x, y } = ringPoint(angle, 100, 15);
      close(angleOfPoint(x, y, 100, 15), angle);
      // Off the ring but in the same direction: the same angle.
      close(angleOfPoint(x * 2, y * 2, 100, 15), angle);
    }
  });
});

describe("travelPath", () => {
  it("takes the shorter arc, frame by frame, the destination last", () => {
    const p = params(10);
    expect(travelPath(1, 4, p)).toEqual([2, 3, 4]);
    expect(travelPath(4, 1, p)).toEqual([3, 2, 1]);
    expect(travelPath(1, 9, p)).toEqual([10, 9]);
    expect(travelPath(9, 1, p)).toEqual([10, 1]);
    expect(travelPath(5, 5, p)).toEqual([]);
  });

  it("breaks a tie the work's way", () => {
    expect(travelPath(1, 6, params(10, 1))).toEqual([2, 3, 4, 5, 6]);
    expect(travelPath(1, 6, params(10, -1))).toEqual([10, 9, 8, 7, 6]);
    // The same tie seen from the far side, and one that crosses the wrap.
    expect(travelPath(6, 1, params(10, 1))).toEqual([7, 8, 9, 10, 1]);
    expect(travelPath(6, 1, params(10, -1))).toEqual([5, 4, 3, 2, 1]);
    expect(travelPath(7, 3, params(8, 1))).toEqual([8, 1, 2, 3]);
    expect(travelPath(7, 3, params(8, -1))).toEqual([6, 5, 4, 3]);
  });
});

describe("ringRadii", () => {
  it("flattens the vertical radius, within 0.15..1", () => {
    expect(ringRadii(200, 1)).toEqual({ radiusX: 100, radiusY: 100 });
    expect(ringRadii(200, 0.5)).toEqual({ radiusX: 100, radiusY: 50 });
    expect(ringRadii(200, 0.01)).toEqual({ radiusX: 100, radiusY: 15 });
    expect(ringRadii(200, 3)).toEqual({ radiusX: 100, radiusY: 100 });
  });
});

// #117: the loaded frames drawn as arcs along the ring instead of ticks
// across it — runs found around the wrap, a lone frame left as a dot.
describe("loadedRuns", () => {
  it("has nothing to draw for nothing loaded", () => {
    expect(loadedRuns(new Set(), 12)).toEqual([]);
  });

  it("joins consecutive frames into one run", () => {
    expect(loadedRuns(new Set([3, 4, 5]), 12)).toEqual([
      { from: 3, to: 5, length: 3 },
    ]);
  });

  it("keeps gaps apart", () => {
    expect(loadedRuns(new Set([1, 2, 7]), 12)).toEqual([
      { from: 1, to: 2, length: 2 },
      { from: 7, to: 7, length: 1 },
    ]);
  });

  it("reads a run across the wrap as one", () => {
    expect(loadedRuns(new Set([11, 12, 1, 2]), 12)).toEqual([
      { from: 11, to: 2, length: 4 },
    ]);
  });

  it("makes the whole orbit a single closed run", () => {
    const all = new Set(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(loadedRuns(all, 12)).toEqual([{ from: 1, to: 12, length: 12 }]);
  });
});

describe("loadedRunsPath", () => {
  const params = {
    frameCount: 12,
    direction: 1 as const,
    framesPerWidth: 6,
    startFrame: 1,
  };

  it("draws nothing for no runs", () => {
    expect(loadedRunsPath([], params, 90, 45)).toBe("");
  });

  it("draws a lone frame as a zero-length line, which a round cap makes a dot", () => {
    // A subpath of a single moveto is not stroked at all (SVG 1.1 §11.4),
    // and the coarse tier is nothing but lone frames — a bare M would
    // leave the ring empty for the whole of a visitor's first load.
    const path = loadedRunsPath(
      [{ from: 1, to: 1, length: 1 }],
      params,
      90,
      45,
    );
    expect(path).toBe("M0.00 45.00L0.00 45.00");
  });

  it("starts a run at its first frame and ends at its last", () => {
    const path = loadedRunsPath(
      [{ from: 1, to: 4, length: 4 }],
      params,
      90,
      45,
    );
    const end = ringPoint(angleOfFrame(4, params), 90, 45);
    expect(path.startsWith("M0.00 45.00")).toBe(true);
    expect(path.endsWith(`L${end.x.toFixed(2)} ${end.y.toFixed(2)}`)).toBe(
      true,
    );
  });

  it("closes the ring when every frame is loaded", () => {
    const path = loadedRunsPath(
      [{ from: 1, to: 12, length: 12 }],
      params,
      90,
      45,
    );
    const start = ringPoint(angleOfFrame(1, params), 90, 45);
    expect(path.endsWith(`L${start.x.toFixed(2)} ${start.y.toFixed(2)}`)).toBe(
      true,
    );
  });

  // #125: the loading order is 8, 4, 2, 1, so every orbit passes through
  // "every other frame" — 60 lone frames on a 120-frame ring, each drawn
  // as a round dot the full width of the stroke. On the card's 160 px ring
  // their centres are 8.4 px apart, which leaves 3.4 px of ink between
  // 5 px blobs: beads, not a band. That is what looked strange.
  describe("gaps the stroke closes", () => {
    const orbit = { ...params, frameCount: 120, framesPerWidth: 60 };
    const every = (stride: number) =>
      new Set(
        Array.from(
          { length: Math.ceil(120 / stride) },
          (_, i) => i * stride + 1,
        ),
      );
    const subpaths = (loaded: Set<number>, stroke: number, flat = 1) =>
      (
        loadedRunsPath(
          loadedRuns(loaded, 120),
          orbit,
          80,
          80 * flat,
          stroke,
        ).match(/M/g) ?? []
      ).length;

    it("joins every other frame into one band, and leaves sparser tiers as dots", () => {
      expect(loadedRuns(every(2), 120)).toHaveLength(60);
      // 8.4 px apart, 3.4 px of it visible: closed.
      expect(subpaths(every(2), 5)).toBe(1);
      // 16.7 px apart on the fourths and 33.3 on the eighths: those gaps
      // are real on screen, and a quarter loaded should look like it.
      expect(subpaths(every(4), 5)).toBe(30);
      expect(subpaths(every(8), 5)).toBe(15);
    });

    it("closes the ring when one run all but meets itself", () => {
      // 119 of 120 is a single run, so there is no second run to compare a
      // gap with — and its own gap at the wrap is 4 px on this ring, less
      // than the 5 px stroke drawing it. It used to show as a nick.
      const missingOne = new Set(
        Array.from({ length: 120 }, (_, i) => i + 1).filter((n) => n !== 60),
      );
      expect(loadedRuns(missingOne, 120)).toHaveLength(1);
      expect(subpaths(missingOne, 5)).toBe(1);
      // It closes: the last point drawn is the first one. Not the same
      // STRING as a full set's path — this ring is traced from frame 61,
      // where the run begins — but the same circle.
      const ends = (d: string) => {
        const points = d.replace(/^M/, "").split("L");
        return [points[0], points[points.length - 1]];
      };
      const [from, to] = ends(
        loadedRunsPath(loadedRuns(missingOne, 120), orbit, 80, 80, 5),
      );
      expect(to).toBe(from);
      // A hole of three frames is 12.6 px: wider than the stroke, so it
      // stays a hole. The dial does not lie about a set that is short.
      const missingThree = new Set(
        Array.from({ length: 120 }, (_, i) => i + 1).filter(
          (n) => n < 60 || n > 62,
        ),
      );
      const [openFrom, openTo] = ends(
        loadedRunsPath(loadedRuns(missingThree, 120), orbit, 80, 80, 5),
      );
      expect(openTo).not.toBe(openFrom);
    });

    it("draws every gap when the caller strokes nothing", () => {
      expect(subpaths(every(2), 0)).toBe(60);
    });

    it("follows the ellipse: the same gap closes along the flat and stays at the ends", () => {
      // A ring flattened to 0.15 crowds the frames along the top and
      // bottom and spreads them at the sides, so one tier cannot be all
      // dots or all band — which is the point of measuring the distance
      // rather than counting frames.
      const flat = subpaths(every(4), 5, 0.15);
      expect(flat).toBeGreaterThan(1);
      expect(flat).toBeLessThan(30);
    });
  });

  it("runs the other way round for a reversed orbit", () => {
    const xs = (path: string) =>
      [...path.matchAll(/[ML](-?\d+\.\d\d) /g)].map((m) => Number(m[1]));
    const forward = xs(
      loadedRunsPath([{ from: 1, to: 3, length: 3 }], params, 90, 45),
    );
    const back = xs(
      loadedRunsPath(
        [{ from: 1, to: 3, length: 3 }],
        { ...params, direction: -1 },
        90,
        45,
      ),
    );
    // The same arc mirrored across the vertical axis: both start at the
    // bottom and the reversed one goes the other side.
    expect(back).toHaveLength(forward.length);
    expect(back.map((x) => x + 0)).toEqual(forward.map((x) => -x + 0));
  });

  it("draws one segment per run", () => {
    const path = loadedRunsPath(
      [
        { from: 1, to: 2, length: 2 },
        { from: 7, to: 7, length: 1 },
      ],
      params,
      90,
      45,
    );
    expect(path.match(/M/g)).toHaveLength(2);
  });
});
