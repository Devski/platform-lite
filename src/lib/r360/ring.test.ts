import { describe, expect, it } from "vitest";
import type { OrbitParams } from "./orbit";
import {
  angleOfFrame,
  angleOfPoint,
  frameAtAngle,
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
  it("puts the start frame at the bottom and the next one a step clockwise, the work's way", () => {
    const p = params(8, 1, 3);
    close(angleOfFrame(3, p), 0);
    close(angleOfFrame(4, p), Math.PI / 4);
    close(angleOfFrame(7, p), Math.PI);
    close(angleOfFrame(2, p), (7 * Math.PI) / 4);
    const reversed = params(8, -1, 3);
    close(angleOfFrame(4, reversed), -Math.PI / 4);
    close(angleOfFrame(2, reversed), -(7 * Math.PI) / 4);
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
    expect(frameAtAngle(Math.PI / 8 + 0.01, p)).toBe(2);
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
