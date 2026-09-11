import { describe, expect, it } from "vitest";
import { cueLabelSide, cueNear, cuesInOrder, shiftIntoBounds } from "./cues";
import {
  R360_CUE_LABEL_MAX,
  R360_CUES_MAX,
  defaultR360Params,
  r360ParamsSchema,
} from "./frame-set-shared";
import type { OrbitParams } from "./orbit";
import { angleOfFrame, ringPoint } from "./ring";

// #107: the cue points — labelled frames the visitor reaches from a marker
// on the ring or a button under the picture. What the parameters accept,
// the order the buttons go in, where a label sits beside its marker, and
// which marker a pointer is on.

const params = (
  frameCount: number,
  startFrame = 1,
  direction: 1 | -1 = 1,
): OrbitParams => ({ frameCount, direction, framesPerWidth: 1, startFrame });

describe("cues in the parameters", () => {
  const withCues = (frameCount: number, cues: unknown) =>
    r360ParamsSchema.safeParse({ ...defaultR360Params(frameCount), cues });

  it("a work saved before cue points existed still parses, with none", () => {
    const parsed = r360ParamsSchema.safeParse(defaultR360Params(4));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.cues).toBeUndefined();
  });

  it("takes labelled frames within the count, the labels trimmed", () => {
    const parsed = withCues(4, [
      { frame: 4, label: " Taras " },
      { frame: 1, label: "Wejście główne" },
    ]);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.cues).toEqual([
      { frame: 4, label: "Taras" },
      { frame: 1, label: "Wejście główne" },
    ]);
  });

  it(`takes ${R360_CUES_MAX} cues and a label of ${R360_CUE_LABEL_MAX} characters, and no more`, () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        frame: i + 1,
        label: `Punkt ${i + 1}`,
      }));
    expect(withCues(20, many(R360_CUES_MAX)).success).toBe(true);
    expect(withCues(20, many(R360_CUES_MAX + 1)).success).toBe(false);
    const longest = "a".repeat(R360_CUE_LABEL_MAX);
    expect(withCues(4, [{ frame: 1, label: longest }]).success).toBe(true);
    expect(withCues(4, [{ frame: 1, label: `${longest}a` }]).success).toBe(
      false,
    );
  });

  it("refuses a cue outside the count, two on one frame, and a label that is empty or carries control characters", () => {
    for (const cues of [
      [{ frame: 0, label: "Zero" }],
      [{ frame: 5, label: "Za daleko" }],
      [{ frame: 1.5, label: "Pół" }],
      [
        { frame: 2, label: "Jeden" },
        { frame: 2, label: "Drugi" },
      ],
      [{ frame: 1, label: "" }],
      [{ frame: 1, label: "   " }],
      [{ frame: 1, label: "Dwie\nlinie" }],
      // A zero-width space: a format character, invisible on the page.
      [{ frame: 1, label: "Znak\u200bukryty" }],
      [{ frame: 1 }],
    ]) {
      expect(withCues(4, cues).success, JSON.stringify(cues)).toBe(false);
    }
  });
});

describe("cuesInOrder", () => {
  it("lists the cues as a turn from the start frame meets them, wrapping past the last frame", () => {
    const cues = [
      { frame: 1, label: "Wejście" },
      { frame: 4, label: "Taras" },
      { frame: 3, label: "Front" },
    ];
    expect(cuesInOrder(cues, params(4, 3)).map((cue) => cue.frame)).toEqual([
      3, 4, 1,
    ]);
    // The list it was handed is left as it was.
    expect(cues.map((cue) => cue.frame)).toEqual([1, 4, 3]);
  });

  it("has nothing to list for a work without cues", () => {
    expect(cuesInOrder(undefined, params(4))).toEqual([]);
  });
});

describe("cueLabelSide", () => {
  const radii = { radiusX: 92, radiusY: 92 * 0.35 };
  const sideAt = (angle: number, r = radii) =>
    cueLabelSide(ringPoint(angle, r.radiusX, r.radiusY), r.radiusX, r.radiusY);

  it("puts the label outward from the ring: above the far arc, beside either end", () => {
    expect(sideAt(Math.PI)).toBe("above");
    // Along the far arc of a flat ring the outward way is still up, well
    // towards the ends.
    expect(sideAt(Math.PI * 0.75)).toBe("above");
    expect(sideAt(Math.PI * 1.25)).toBe("above");
    // ringPoint: a quarter turn clockwise from the bottom is the left end.
    expect(sideAt(Math.PI / 2)).toBe("left");
    expect(sideAt(-Math.PI / 2)).toBe("right");
  });

  it("never puts it below the ring, where the counter and the page's text are: the near arc's labels go to their side", () => {
    expect(sideAt(0)).toBe("right");
    expect(sideAt(0.2)).toBe("left");
    expect(sideAt(-0.2)).toBe("right");
    // A circle as well as a flat ring.
    const circle = { radiusX: 92, radiusY: 92 };
    expect(sideAt(0.3, circle)).toBe("left");
    expect(sideAt(Math.PI, circle)).toBe("above");
  });
});

describe("shiftIntoBounds", () => {
  const card = { left: 100, right: 320 };

  it("leaves a label that fits where it is", () => {
    expect(shiftIntoBounds({ left: 150, right: 250 }, card, 4)).toBe(0);
  });

  it("moves one past either edge back inside, the margin kept", () => {
    expect(shiftIntoBounds({ left: 260, right: 360 }, card, 4)).toBe(-44);
    expect(shiftIntoBounds({ left: 60, right: 160 }, card, 4)).toBe(44);
  });

  it("starts one wider than the room at the room's left edge", () => {
    expect(shiftIntoBounds({ left: 200, right: 450 }, card, 4)).toBe(-96);
  });
});

describe("cueNear", () => {
  const radii = { radiusX: 92, radiusY: 32 };
  const orbit = params(120);
  const cues = [
    { frame: 53, label: "Garaż" },
    { frame: 58, label: "Ogród zimowy" },
    { frame: 1, label: "Wejście" },
  ];
  const markerOf = (frame: number) =>
    ringPoint(angleOfFrame(frame, orbit), radii.radiusX, radii.radiusY);

  it("finds the marker the pointer is on, the nearest of two close ones", () => {
    const garage = markerOf(53);
    const winter = markerOf(58);
    expect(cueNear(cues, garage, orbit, radii, 10)).toBe(53);
    // A pointer a little towards the second marker, but still nearer the first.
    const between = {
      x: garage.x + (winter.x - garage.x) * 0.4,
      y: garage.y + (winter.y - garage.y) * 0.4,
    };
    expect(cueNear(cues, between, orbit, radii, 10)).toBe(53);
    expect(cueNear(cues, winter, orbit, radii, 10)).toBe(58);
  });

  it("finds none beyond the reach, and none on a work without cues", () => {
    const entrance = markerOf(1);
    expect(
      cueNear(cues, { x: entrance.x + 11, y: entrance.y }, orbit, radii, 10),
    ).toBeNull();
    expect(cueNear([], entrance, orbit, radii, 10)).toBeNull();
  });
});
