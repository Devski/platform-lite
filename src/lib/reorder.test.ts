import { describe, expect, it } from "vitest";
import { indexAtPoint, moveItem, type Box } from "./reorder";

// #66: the arithmetic under both reorderable lists — the places on a profile
// and the works below them.

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"];

  it("takes the last to the front, which is the thing this exists for", () => {
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("closes the gap behind and makes room in front, both ways", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 2, 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveItem(list, 1, 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("gives back the same order when there is nowhere to go", () => {
    expect(moveItem(list, 2, 2)).toEqual(list);
    expect(moveItem(list, -1, 0)).toEqual(list);
    expect(moveItem(list, 0, 4)).toEqual(list);
    expect(moveItem(list, 9, 9)).toEqual(list);
    expect(moveItem([], 0, 0)).toEqual([]);
    expect(moveItem(["only"], 0, 0)).toEqual(["only"]);
  });

  it("never hands back the list it was given", () => {
    const next = moveItem(list, 1, 1);
    expect(next).not.toBe(list);
    next[0] = "changed";
    expect(list[0]).toBe("a");
  });
});

describe("indexAtPoint", () => {
  // Two chips side by side with a gap, and a third wrapped onto a second row.
  const row: Box[] = [
    { left: 0, top: 0, right: 100, bottom: 40 },
    { left: 120, top: 0, right: 220, bottom: 40 },
    { left: 0, top: 60, right: 100, bottom: 100 },
  ];

  it("answers the box the point is inside, edges included", () => {
    expect(indexAtPoint(row, 50, 20)).toBe(0);
    expect(indexAtPoint(row, 150, 20)).toBe(1);
    expect(indexAtPoint(row, 50, 80)).toBe(2);
    expect(indexAtPoint(row, 0, 0)).toBe(0);
    expect(indexAtPoint(row, 220, 40)).toBe(1);
  });

  it("answers the nearest middle in the air between and around them", () => {
    // In the gap, but closer to the first chip's middle.
    expect(indexAtPoint(row, 105, 20)).toBe(0);
    expect(indexAtPoint(row, 118, 20)).toBe(1);
    // Below everything, and off to the right of everything.
    expect(indexAtPoint(row, 50, 400)).toBe(2);
    expect(indexAtPoint(row, 900, 20)).toBe(1);
  });

  it("has no answer only when there is nothing to be over", () => {
    expect(indexAtPoint([], 10, 10)).toBeNull();
  });

  it("gives a tie to the earlier item, so the answer does not depend on measuring order", () => {
    const twins: Box[] = [
      { left: 0, top: 0, right: 100, bottom: 40 },
      { left: 200, top: 0, right: 300, bottom: 40 },
    ];
    // Exactly between the two middles: 50 and 250, so 150.
    expect(indexAtPoint(twins, 150, 20)).toBe(0);
  });
});
