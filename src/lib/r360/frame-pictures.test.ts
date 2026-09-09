import { describe, expect, it } from "vitest";
import {
  FramePictures,
  pictureBytes,
  type FramePicture,
} from "./frame-pictures";

// #117: the store's policy — what stays resident and what goes when the
// budget is spent. No canvas here: a picture is anything with a size.

function picture(bytes: number, onRelease?: () => void): FramePicture {
  return {
    source: {} as CanvasImageSource,
    width: 1,
    height: 1,
    bytes,
    release: onRelease,
  };
}

const MB = 1024 * 1024;

describe("pictureBytes", () => {
  it("counts four bytes a pixel", () => {
    expect(pictureBytes(800, 450)).toBe(800 * 450 * 4);
  });

  it("treats a picture without a size as holding nothing", () => {
    expect(pictureBytes(0, 450)).toBe(0);
    expect(pictureBytes(-10, 450)).toBe(0);
  });
});

describe("FramePictures", () => {
  it("holds what fits and answers which ordinals it can paint", () => {
    const store = new FramePictures(60, 10 * MB);
    store.put(1, picture(MB));
    store.put(2, picture(MB));
    expect(store.get(1)).toBeDefined();
    expect(store.has(2)).toBe(true);
    expect(store.has(3)).toBe(false);
    expect([...store.ordinals]).toEqual([1, 2]);
  });

  it("replaces an ordinal and frees what it held", () => {
    let freed = false;
    const store = new FramePictures(60, 10 * MB);
    store.put(
      1,
      picture(MB, () => (freed = true)),
    );
    store.put(1, picture(MB));
    expect(freed).toBe(true);
    expect(store.size).toBe(1);
  });

  it("drops the frame furthest round the orbit when the budget is spent", () => {
    const store = new FramePictures(60, 3 * MB);
    store.focus(1);
    // 1, 2 and 60 are the anchor's neighbours; 30 is the far side.
    store.put(1, picture(MB));
    store.put(2, picture(MB));
    store.put(60, picture(MB));
    store.put(30, picture(MB));
    expect(store.has(30)).toBe(false);
    expect([...store.ordinals].sort((a, b) => a - b)).toEqual([1, 2, 60]);
  });

  it("measures distance the short way round, so the wrap is near", () => {
    const store = new FramePictures(60, 2 * MB);
    store.focus(1);
    store.put(1, picture(MB));
    store.put(59, picture(MB));
    // 59 is two frames back from 1; 25 is twenty-four away and loses.
    store.put(25, picture(MB));
    expect(store.has(59)).toBe(true);
    expect(store.has(25)).toBe(false);
  });

  it("carries the resident window with the frame in view", () => {
    const store = new FramePictures(60, 2 * MB);
    store.focus(1);
    store.put(1, picture(MB));
    store.put(2, picture(MB));
    // The orbit turns to the far side: what is near it now stays, and the
    // frames left behind go.
    store.focus(30);
    store.put(30, picture(MB));
    store.put(31, picture(MB));
    expect(store.has(30)).toBe(true);
    expect(store.has(31)).toBe(true);
    expect(store.has(1)).toBe(false);
  });

  it("keeps the frame in view even when it alone is over budget", () => {
    const store = new FramePictures(60, MB);
    store.focus(7);
    store.put(7, picture(50 * MB));
    expect(store.has(7)).toBe(true);
  });

  it("frees everything on clear and stays usable", () => {
    let freed = 0;
    const store = new FramePictures(60, 10 * MB);
    store.put(
      1,
      picture(MB, () => freed++),
    );
    store.put(
      2,
      picture(MB, () => freed++),
    );
    store.clear();
    expect(freed).toBe(2);
    expect(store.size).toBe(0);
    store.put(3, picture(MB));
    expect(store.has(3)).toBe(true);
  });
});

describe("FramePictures without an orbit to measure round", () => {
  it("holds what it is given for a frame count of zero instead of spinning", () => {
    // picturesOf([]) builds one of these for a form with no saved set;
    // eviction has no distance to measure, and used to loop forever.
    const store = new FramePictures(0, 1);
    store.put(1, picture(10 * MB));
    store.put(2, picture(10 * MB));
    expect(store.size).toBe(2);
  });

  it("keeps a picture that brought no way to free it", () => {
    const store = new FramePictures(4, 10 * MB);
    store.put(1, {
      source: {} as CanvasImageSource,
      width: 1,
      height: 1,
      bytes: 0,
    });
    expect(store.has(1)).toBe(true);
    store.clear();
    expect(store.size).toBe(0);
  });

  it("takes a focus on a frame it does not hold", () => {
    const store = new FramePictures(8, 2 * MB);
    store.put(1, picture(MB));
    store.focus(5);
    store.put(5, picture(MB));
    store.put(4, picture(MB));
    // 1 is four frames from the focus, 4 is one: 1 goes.
    expect(store.has(1)).toBe(false);
    expect(store.has(4)).toBe(true);
  });
});
