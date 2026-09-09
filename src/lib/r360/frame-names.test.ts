import { describe, expect, it } from "vitest";
import {
  orderFrames,
  R360_MAX_FRAMES,
  R360_MIN_FRAMES,
  type FrameOrder,
} from "./frame-names";

// #101: the frame contract of #64, applied to entry names. The number is
// the last run of digits before the extension, or the first run when the
// last does not form a contiguous range from 0 or 1 without duplicates.

const named = (...names: string[]) => names.map((name) => ({ name }));
const sequence = (pattern: (n: string) => string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    pattern(String(from + i).padStart(4, "0")),
  );
const shuffled = <T>(items: T[]) => [...items].reverse();

function ordered(result: FrameOrder<{ name: string }>): string[] {
  if (!result.ok) throw new Error(`refused: ${result.reason} ${result.files}`);
  return result.frames.map((f) => f.name);
}

function refused(result: FrameOrder<{ name: string }>) {
  if (result.ok) throw new Error("expected a refusal");
  return result;
}

describe("orderFrames", () => {
  it("orders by the last run of digits, whatever the order of the entries", () => {
    const names = shuffled(sequence((n) => `render_${n}.png`, 1, 120));
    expect(ordered(orderFrames(named(...names)))).toEqual(
      sequence((n) => `render_${n}.png`, 1, 120),
    );
  });

  it("reads the number after a dot, without a separator, and beside a constant", () => {
    expect(
      ordered(
        orderFrames(named("shot.0002.jpg", "shot.0001.jpg", "shot.0003.jpg")),
      ),
    ).toEqual(["shot.0001.jpg", "shot.0002.jpg", "shot.0003.jpg"]);
    expect(
      ordered(orderFrames(named("Camera002.png", "Camera001.png"))),
    ).toEqual(["Camera001.png", "Camera002.png"]);
    // The first run is the scene, the last run is the frame.
    expect(
      ordered(orderFrames(named("Scene2_0002.png", "Scene2_0001.png"))),
    ).toEqual(["Scene2_0001.png", "Scene2_0002.png"]);
  });

  it("falls back to the first run when the last run is a constant", () => {
    expect(
      ordered(orderFrames(named("0002_v2.png", "0003_v2.png", "0001_v2.png"))),
    ).toEqual(["0001_v2.png", "0002_v2.png", "0003_v2.png"]);
  });

  it("accepts a sequence from 0 and one from 1, but not one from 2", () => {
    expect(ordered(orderFrames(named("f0.png", "f1.png", "f2.png")))).toEqual([
      "f0.png",
      "f1.png",
      "f2.png",
    ]);
    expect(ordered(orderFrames(named("f1.png", "f2.png")))).toEqual([
      "f1.png",
      "f2.png",
    ]);
    const late = refused(orderFrames(named("f2.png", "f3.png", "f4.png")));
    expect(late.reason).toBe("numbering");
    expect(late.files).toEqual(["f2.png"]);
  });

  it("names the two sides of a gap and the two files sharing a number", () => {
    const gap = refused(
      orderFrames(named("f_0001.png", "f_0002.png", "f_0004.png")),
    );
    expect(gap.reason).toBe("numbering");
    expect(gap.files).toEqual(["f_0002.png", "f_0004.png"]);
    const twice = refused(
      orderFrames(named("f_0001.png", "f_0002.jpg", "f_0002.png")),
    );
    expect(twice.reason).toBe("numbering");
    expect(twice.files).toEqual(["f_0002.jpg", "f_0002.png"]);
    expect(twice.count).toBe(3);
  });

  it("names a frame without any digits", () => {
    const result = refused(orderFrames(named("f_0001.png", "cover.png")));
    expect(result.reason).toBe("unnumbered");
    expect(result.files).toEqual(["cover.png"]);
  });

  it("ignores directories, __MACOSX, dot-files, Thumbs.db and files of other types", () => {
    const result = orderFrames(
      named(
        "orbit/",
        "orbit/f_0002.PNG",
        "orbit/f_0001.jpeg",
        "orbit/Thumbs.db",
        "orbit/.DS_Store",
        "orbit/._f_0001.jpeg",
        "__MACOSX/orbit/f_0002.PNG",
        "orbit/preview.mp4",
        "orbit/camera.json",
        "orbit/f_0003.webp",
      ),
    );
    expect(ordered(result)).toEqual([
      "orbit/f_0001.jpeg",
      "orbit/f_0002.PNG",
      "orbit/f_0003.webp",
    ]);
  });

  it("allows one top-level folder, not two folders and not a deeper one", () => {
    const two = refused(
      orderFrames(named("a/f_0001.png", "a/f_0002.png", "b/f_0003.png")),
    );
    expect(two.reason).toBe("folders");
    expect(two.files).toEqual(["a/f_0001.png", "b/f_0003.png"]);
    const mixed = refused(orderFrames(named("f_0001.png", "a/f_0002.png")));
    expect(mixed.reason).toBe("folders");
    expect(mixed.files).toEqual(["f_0001.png", "a/f_0002.png"]);
    const deep = refused(
      orderFrames(named("a/b/f_0001.png", "a/b/f_0002.png")),
    );
    expect(deep.reason).toBe("folders");
    expect(deep.files).toEqual(["a/b/f_0001.png", "a/b/f_0002.png"]);
  });

  it("refuses render formats a browser cannot show, naming the files", () => {
    const result = refused(
      orderFrames(
        named("f_0001.exr", "f_0002.EXR", "f_0003.png", "f_0004.tif"),
      ),
    );
    expect(result.reason).toBe("unsupported_format");
    expect(result.files).toEqual(["f_0001.exr", "f_0002.EXR", "f_0004.tif"]);
    expect(refused(orderFrames(named("a.tiff", "b.tga"))).files).toEqual([
      "a.tiff",
      "b.tga",
    ]);
  });

  it("refuses an empty archive, a single frame and more than 360", () => {
    expect(refused(orderFrames(named("readme.txt", "orbit/"))).reason).toBe(
      "no_frames",
    );
    const one = refused(orderFrames(named("f_0001.png")));
    expect(one.reason).toBe("too_few");
    expect(one.count).toBe(1);
    expect(R360_MIN_FRAMES).toBe(2);
    const many = refused(
      orderFrames(
        named(...sequence((n) => `f_${n}.png`, 1, R360_MAX_FRAMES + 1)),
      ),
    );
    expect(many.reason).toBe("too_many");
    expect(many.count).toBe(361);
    expect(
      ordered(
        orderFrames(
          named(...sequence((n) => `f_${n}.png`, 1, R360_MAX_FRAMES)),
        ),
      ),
    ).toHaveLength(360);
  });

  it("keeps the entries themselves, so the caller can read them back", () => {
    const entries = [
      { name: "f_0002.png", offset: 200 },
      { name: "f_0001.png", offset: 100 },
    ];
    const result = orderFrames(entries);
    expect(result.ok && result.frames.map((f) => f.offset)).toEqual([100, 200]);
  });
});
