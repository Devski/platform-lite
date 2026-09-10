import { describe, expect, it } from "vitest";
import {
  coarseCount,
  FrameQueue,
  prefersLittleData,
  startFrameLoading,
  type ImageLike,
} from "./frame-loading";
import { loadingOrder } from "./orbit";

// #104: the loading policy without a browser — a fake Image that settles
// when the test says so, a queue with a small concurrency, the tiers.

class FakeImage implements ImageLike {
  onload: HTMLImageElement["onload"] = null;
  onerror: HTMLImageElement["onerror"] = null;
  decoded = 0;
  naturalWidth = 800;
  naturalHeight = 450;
  private _src = "";
  static all: FakeImage[] = [];
  static requested: string[] = [];
  constructor() {
    FakeImage.all.push(this);
  }
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value) FakeImage.requested.push(value);
  }
  async decode() {
    this.decoded += 1;
  }
  finish(ok = true) {
    const handler = ok ? this.onload : this.onerror;
    handler?.call(this as unknown as GlobalEventHandlers, new Event("load"));
  }
  static reset() {
    FakeImage.all = [];
    FakeImage.requested = [];
  }
  /** The images with a source and handlers: fetches in flight. */
  static inFlight() {
    return FakeImage.all.filter((i) => i.src && i.onload);
  }
}

const urls = (n: number) => Array.from({ length: n }, (_, i) => `f/${i + 1}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("coarseCount", () => {
  it("is every 8th frame, rounded up", () => {
    expect(coarseCount(120)).toBe(15);
    expect(coarseCount(360)).toBe(45);
    expect(coarseCount(4)).toBe(1);
    expect(coarseCount(9)).toBe(2);
  });
});

describe("startFrameLoading", () => {
  // The queue is ONE for the whole page, three places, and a place is given
  // back only when a job settles. Closing a viewer mid-load stops its run;
  // if the frames in flight never settle, their places are gone for good,
  // and after two or three closes nothing on the page loads any more
  // (Dawid, 10.09.2026: "powiększenie, ESC, powiększenie, ESC i potem już
  // nie doładowuje").
  // Dawid's sequence, as he did it: enlarge, Escape, enlarge, Escape,
  // enlarge — each close while frames are still in the air, on the
  // page's queue of three. The third opening is the one that died.
  it("still loads on the third opening after two closes mid-load", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(3);
    const open = (n: number) =>
      startFrameLoading({
        urls: urls(40).map((url) => `open${n}/${url}`),
        startFrame: 1,
        tier: "all",
        queue,
        createImage: () => new FakeImage(),
        onLoaded: () => {},
      });
    for (const n of [1, 2]) {
      const viewer = open(n);
      await tick();
      // Three frames in the air when Escape is pressed.
      expect(FakeImage.inFlight()).toHaveLength(3);
      viewer.stop();
      await tick();
    }
    open(3);
    await tick();
    // The third opening gets the whole queue, not what two closes left.
    const third = FakeImage.requested.filter((url) => url.startsWith("open3/"));
    expect(third).toHaveLength(3);
  });

  it("gives its places in the page's queue back when stopped mid-flight", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(1);
    const first = startFrameLoading({
      urls: urls(8),
      startFrame: 1,
      tier: "all",
      queue,
      createImage: () => new FakeImage(),
      onLoaded: () => {},
    });
    await tick();
    // One frame in the air, and the queue has no other place.
    expect(FakeImage.requested).toEqual(["f/1"]);
    first.stop();
    await tick();
    // The next viewer on the page must get the place the first one left.
    startFrameLoading({
      urls: urls(8).map((url) => `next/${url}`),
      startFrame: 1,
      tier: "all",
      queue,
      createImage: () => new FakeImage(),
      onLoaded: () => {},
    });
    await tick();
    expect(FakeImage.requested).toEqual(["f/1", "next/f/1"]);
  });

  // A set that answers nothing but failures is dropped after three tries
  // rather than asked for in full on every mount: a work made under
  // another environment's key prefix answers AccessDenied to every one of
  // its frames (#140), and that used to cost a hundred-odd failing
  // requests each time it came into view.
  it("gives a set up after three failures with nothing loaded, and drops what is queued", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(1);
    let unreachable = 0;
    startFrameLoading({
      urls: urls(40),
      startFrame: 1,
      tier: "all",
      queue,
      createImage: () => new FakeImage(),
      onLoaded: () => {},
      onUnreachable: () => (unreachable += 1),
    });
    for (let i = 0; i < 6; i++) {
      await tick();
      for (const image of FakeImage.inFlight()) image.finish(false);
    }
    await tick();
    expect(unreachable).toBe(1);
    // Three asked for, and the other 37 never left the queue.
    expect(FakeImage.requested).toHaveLength(3);
  });

  // Every close of a viewer cancels what was in flight, and a cancelled
  // request is a failure to an <img>. A set that has already given the
  // page frames must survive a run that opens on three of them — opening
  // a lightbox for the third time used to kill the orbit.
  it("never gives up on a set that has loaded before, however badly a run starts", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(1);
    let unreachable = 0;
    startFrameLoading({
      urls: urls(20),
      startFrame: 1,
      tier: "all",
      queue,
      createImage: () => new FakeImage(),
      loadedBefore: true,
      onLoaded: () => {},
      onUnreachable: () => (unreachable += 1),
    });
    for (let i = 0; i < 6; i++) {
      await tick();
      for (const image of FakeImage.inFlight()) image.finish(false);
    }
    await tick();
    expect(unreachable).toBe(0);
    // Still asking, rather than three and out.
    expect(FakeImage.requested.length).toBeGreaterThan(3);
  });

  // A cancelled request looks exactly like a refused one to an <img>, and
  // a lightbox closed mid-load cancels several at once. One failure among
  // frames that ARE arriving must not end the run.
  it("keeps going when a frame fails among frames that load", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(1);
    let unreachable = 0;
    const loaded: number[] = [];
    startFrameLoading({
      urls: urls(12),
      startFrame: 1,
      tier: "all",
      queue,
      createImage: () => new FakeImage(),
      onLoaded: (ordinal) => loaded.push(ordinal),
      onUnreachable: () => (unreachable += 1),
    });
    for (let i = 0; i < 8; i++) {
      await tick();
      // Every third one fails; the rest arrive.
      for (const image of FakeImage.inFlight()) image.finish(i % 3 !== 0);
    }
    await tick();
    expect(unreachable).toBe(0);
    expect(loaded.length).toBeGreaterThan(3);
  });

  it("fetches the coarse tier in loading order through the queue, a few at a time, and reports decoded frames", async () => {
    FakeImage.reset();
    const loaded: number[] = [];
    const pictures: ImageLike[] = [];
    const queue = new FrameQueue(3);
    startFrameLoading({
      urls: urls(32),
      startFrame: 5,
      tier: "coarse",
      queue,
      createImage: () => new FakeImage(),
      onLoaded: (o, picture) => {
        loaded.push(o);
        pictures.push(picture);
      },
    });
    const order = loadingOrder(32, 5);
    expect(FakeImage.requested).toEqual(order.slice(0, 3).map((o) => `f/${o}`));
    FakeImage.inFlight()[0].finish();
    await tick();
    expect(loaded).toEqual([order[0]]);
    expect(FakeImage.all[0].decoded).toBe(1);
    // #117: the decoded picture comes with the ordinal, so the viewer can
    // paint it without fetching and decoding it again.
    expect(pictures).toEqual([FakeImage.all[0]]);
    expect(FakeImage.requested).toHaveLength(4);
    for (let i = 0; i < 10; i++) {
      for (const image of FakeImage.inFlight()) image.finish();
      await tick();
    }
    // The coarse tier is 4 of 32 — the start frame and every 8th after.
    expect(loaded.sort((a, b) => a - b)).toEqual([5, 13, 21, 29]);
    expect(FakeImage.requested).toHaveLength(4);
  });

  it("widens to the rest on setTier, skips what is known and what failed, and stops on stop", async () => {
    FakeImage.reset();
    const loaded: number[] = [];
    const queue = new FrameQueue(2);
    const loading = startFrameLoading({
      urls: urls(16),
      startFrame: 1,
      tier: "coarse",
      known: new Set([1]),
      queue,
      createImage: () => new FakeImage(),
      onLoaded: (o) => loaded.push(o),
    });
    // 1 is known: the coarse tier left is 9 alone.
    expect(FakeImage.requested).toEqual(["f/9"]);
    FakeImage.inFlight()[0].finish(false);
    await tick();
    expect(loaded).toEqual([]);
    loading.setTier("all");
    expect(FakeImage.requested.slice(1)).toEqual(["f/5", "f/13"]);
    for (const image of FakeImage.inFlight()) image.finish();
    await tick();
    expect(loaded).toEqual([5, 13]);
    // Stop: the ones in flight are abandoned and nothing more is asked.
    const before = FakeImage.requested.length;
    const flying = FakeImage.inFlight();
    loading.stop();
    expect(flying.every((i) => i.src === "" && i.onload === null)).toBe(true);
    for (const image of FakeImage.all) image.finish();
    await tick();
    expect(FakeImage.requested.length).toBe(before);
    expect(loaded).toEqual([5, 13]);
  });

  it("shares one queue between two orbits: never more in flight than the queue allows", async () => {
    FakeImage.reset();
    const queue = new FrameQueue(3);
    for (const start of [1, 2]) {
      startFrameLoading({
        urls: urls(64),
        startFrame: start,
        tier: "all",
        queue,
        createImage: () => new FakeImage(),
        onLoaded: () => undefined,
      });
    }
    expect(FakeImage.inFlight()).toHaveLength(3);
    FakeImage.inFlight()[0].finish();
    await tick();
    expect(FakeImage.inFlight()).toHaveLength(3);
  });
});

describe("prefersLittleData", () => {
  it("reads the data saver and a slow effective type", () => {
    expect(prefersLittleData(undefined)).toBe(false);
    expect(prefersLittleData({ saveData: true })).toBe(true);
    expect(prefersLittleData({ effectiveType: "slow-2g" })).toBe(true);
    expect(prefersLittleData({ effectiveType: "3g" })).toBe(true);
    expect(prefersLittleData({ effectiveType: "4g" })).toBe(false);
  });
});
