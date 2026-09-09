import { describe, expect, it } from "vitest";
import {
  clampPosition,
  positionAfterKey,
  positionFromPointer,
  secondChannelClip,
} from "./channel-reveal";

// #100: the reveal slider's arithmetic. 0 is the first channel alone, 100
// the second alone, 50 half and half.

describe("clampPosition", () => {
  it("keeps 0..100, whole numbers, and turns nonsense into 0", () => {
    expect(clampPosition(-3)).toBe(0);
    expect(clampPosition(49.6)).toBe(50);
    expect(clampPosition(140)).toBe(100);
    expect(clampPosition(Number.NaN)).toBe(0);
  });
});

describe("positionFromPointer", () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };
  it("maps the pointer along the axis onto 0..100, clamped to the box", () => {
    expect(positionFromPointer({ clientX: 100, clientY: 0 }, box, "x")).toBe(0);
    expect(positionFromPointer({ clientX: 300, clientY: 0 }, box, "x")).toBe(
      50,
    );
    expect(positionFromPointer({ clientX: 900, clientY: 0 }, box, "x")).toBe(
      100,
    );
    expect(positionFromPointer({ clientX: 0, clientY: 150 }, box, "y")).toBe(
      50,
    );
    expect(positionFromPointer({ clientX: 0, clientY: 10 }, box, "y")).toBe(0);
  });
  it("answers 0 for a box with no size", () => {
    expect(
      positionFromPointer(
        { clientX: 5, clientY: 5 },
        { ...box, width: 0 },
        "x",
      ),
    ).toBe(0);
  });
});

describe("positionAfterKey", () => {
  it("steps by 5 along the axis, by 20 with Page keys, jumps with Home and End, ignores the rest", () => {
    expect(positionAfterKey(50, "ArrowRight", "x")).toBe(55);
    expect(positionAfterKey(50, "ArrowLeft", "x")).toBe(45);
    expect(positionAfterKey(50, "ArrowDown", "y")).toBe(55);
    expect(positionAfterKey(50, "ArrowUp", "y")).toBe(45);
    // The other axis's arrows are not the slider's.
    expect(positionAfterKey(50, "ArrowUp", "x")).toBeNull();
    expect(positionAfterKey(50, "PageDown", "x")).toBe(70);
    expect(positionAfterKey(98, "ArrowRight", "x")).toBe(100);
    expect(positionAfterKey(50, "Home", "y")).toBe(0);
    expect(positionAfterKey(50, "End", "y")).toBe(100);
    expect(positionAfterKey(50, "Enter", "x")).toBeNull();
  });
});

describe("secondChannelClip", () => {
  it("cuts what lies past the handle: all of it at 0, none at 100, half at 50", () => {
    expect(secondChannelClip(0, "x")).toBe("inset(0 100% 0 0)");
    expect(secondChannelClip(100, "x")).toBe("inset(0 0% 0 0)");
    expect(secondChannelClip(50, "x")).toBe("inset(0 50% 0 0)");
    expect(secondChannelClip(50, "y")).toBe("inset(0 0 50% 0)");
  });
});
