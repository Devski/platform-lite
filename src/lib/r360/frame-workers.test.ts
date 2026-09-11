import { describe, expect, it } from "vitest";
import { orderFrames } from "./frame-names";
import { produceFrameSet, type FrameSetTransport } from "./frame-pipeline";
import {
  framePool,
  frameLanes,
  maxFrameLanes,
  type FromFrameWorker,
  type SpawnFrameWorker,
  type ToFrameWorker,
} from "./frame-workers";
import { buildZip } from "./test-zip";
import { fileSource, openZip } from "./zip-reader";

// #137: the pool without a browser. The workers are fakes that record what
// they were sent and answer when the test says so — which is what lets a
// test put the answers in any order, and kill a worker halfway.

interface FakeBitmap {
  width: number;
  height: number;
  closed: boolean;
  close(): void;
}

function bitmap(width = 800, height = 450): FakeBitmap {
  return {
    width,
    height,
    closed: false,
    close() {
      this.closed = true;
    },
  };
}

interface FakeWorker {
  posted: { message: ToFrameWorker; transfer: Transferable[] }[];
  terminated: boolean;
  /** Answers as the worker script would. */
  say(message: FromFrameWorker): void;
  /** The worker's script failed. */
  die(): void;
  /** The frames it was sent, by id. */
  frames(): number[];
}

function fakeWorkers(
  options: {
    throwOnSpawn?: boolean;
    /**
     * Answers even once terminated. A real worker cannot — terminate
     * empties its queue — but the pool must not count on it.
     */
    deliverAfterTerminate?: boolean;
  } = {},
) {
  const workers: FakeWorker[] = [];
  const spawn: SpawnFrameWorker = ({ message, error }) => {
    if (options.throwOnSpawn) throw new Error("no workers here");
    const worker: FakeWorker = {
      posted: [],
      terminated: false,
      say: (answer) => {
        if (!worker.terminated || options.deliverAfterTerminate) {
          message(answer);
        }
      },
      die: () => error(),
      frames: () =>
        worker.posted.flatMap(({ message: m }) =>
          m.type === "frame" ? [m.id] : [],
        ),
    };
    workers.push(worker);
    return {
      post: (sent, transfer) => worker.posted.push({ message: sent, transfer }),
      terminate: () => {
        worker.terminated = true;
      },
    };
  };
  return { workers, spawn };
}

const bytes = (label: string) => new TextEncoder().encode(label);

function webps() {
  return {
    1600: new Blob(["RIFF....WEBP"], { type: "image/webp" }),
    800: new Blob(["RIFF....WEBP"], { type: "image/webp" }),
  };
}

/** Lets the promise callbacks queued so far run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("framePool", () => {
  it("starts workers only as frames need them, up to its size, and hands the rest out in order", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 2, lanesFor: () => 2 });
    const sent = [bytes("one"), bytes("two"), bytes("three")];
    void pool.decode(sent[0], "f1.png");
    expect(workers).toHaveLength(1);
    void pool.decode(sent[1], "f2.png");
    void pool.decode(sent[2], "f3.png");
    expect(workers).toHaveLength(2);
    expect(workers[0].frames()).toEqual([1]);
    expect(workers[1].frames()).toEqual([2]);
    // The bytes go over, not a copy: their buffer is in the transfer.
    expect(workers[0].posted[0].transfer).toEqual([sent[0].buffer]);
    // The first worker done with its frame takes the third.
    workers[1].say({
      type: "picture",
      id: 2,
      picture: bitmap() as never,
      sourcePixels: null,
    });
    expect(workers[1].frames()).toEqual([2]);
    workers[1].say({ type: "encoded", id: 2, encoded: webps() });
    expect(workers[1].frames()).toEqual([2, 3]);
    expect(workers).toHaveLength(2);
  });

  it("answers the decode with the picture, and the encodings only once they exist", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
    const decoding = pool.decode(bytes("one"), "f1.png");
    const picture = bitmap(800, 450);
    workers[0].say({
      type: "picture",
      id: 1,
      picture: picture as never,
      sourcePixels: 3840 * 2160,
    });
    const decoded = await decoding;
    expect(decoded.picture.width).toBe(800);
    expect(decoded.picture.height).toBe(450);
    expect(decoded.picture.bytes).toBe(800 * 450 * 4);
    expect(decoded.sourcePixels).toBe(3840 * 2160);
    let encoded = false;
    const encoding = decoded.encode().then((result) => {
      encoded = true;
      return result;
    });
    await settle();
    expect(encoded).toBe(false);
    const sent = webps();
    workers[0].say({ type: "encoded", id: 1, encoded: sent });
    expect(await encoding).toBe(sent);
    // The picture is the taker's: released through the frame, not before.
    expect(picture.closed).toBe(false);
    decoded.picture.release?.();
    expect(picture.closed).toBe(true);
  });

  it("fails a frame's decode, or after its picture its encode, and moves on to the next", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
    const first = pool.decode(bytes("one"), "f1.png");
    const second = pool.decode(bytes("two"), "f2.png");
    workers[0].say({ type: "failed", id: 1 });
    await expect(first).rejects.toThrow("f1.png");
    // The worker is free again, and the next frame is on it.
    expect(workers[0].frames()).toEqual([1, 2]);
    workers[0].say({
      type: "picture",
      id: 2,
      picture: bitmap() as never,
      sourcePixels: null,
    });
    const decoded = await second;
    workers[0].say({ type: "failed", id: 2 });
    await expect(decoded.encode()).rejects.toThrow("f2.png");
  });

  it("fails every frame not yet encoded, and every one after, when a worker dies", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 2, lanesFor: () => 2 });
    const first = pool.decode(bytes("one"), "f1.png");
    const second = pool.decode(bytes("two"), "f2.png");
    const third = pool.decode(bytes("three"), "f3.png");
    workers[0].say({
      type: "picture",
      id: 1,
      picture: bitmap() as never,
      sourcePixels: null,
    });
    const decoded = await first;
    workers[1].die();
    await expect(decoded.encode()).rejects.toThrow("failed");
    await expect(second).rejects.toThrow("failed");
    await expect(third).rejects.toThrow("failed");
    await expect(pool.decode(bytes("four"), "f4.png")).rejects.toThrow(
      "failed",
    );
    expect(workers.every((w) => w.terminated)).toBe(true);
  });

  it("stops every worker on dispose and fails what was still being made", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 2, lanesFor: () => 2 });
    const first = pool.decode(bytes("one"), "f1.png");
    pool.dispose();
    await expect(first).rejects.toThrow("closed");
    expect(workers[0].terminated).toBe(true);
    await expect(pool.decode(bytes("two"), "f2.png")).rejects.toThrow("closed");
    // Twice is once.
    pool.dispose();
    expect(await pool.probe(1000)).toBeNull();
  });

  it("frees a picture for a frame the worker is not on", () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
    void pool.decode(bytes("one"), "f1.png");
    const stray = bitmap();
    workers[0].say({
      type: "picture",
      id: 99,
      picture: stray as never,
      sourcePixels: null,
    });
    expect(stray.closed).toBe(true);
  });

  it("closes itself when a worker cannot be started at all", async () => {
    const { spawn } = fakeWorkers({ throwOnSpawn: true });
    const pool = framePool({ spawn, maxWorkers: 2, lanesFor: () => 2 });
    await expect(pool.decode(bytes("one"), "f1.png")).rejects.toThrow(
      "could not be started",
    );
    expect(await pool.probe(1000)).toBeNull();
  });

  it("never offers more lanes than it has workers", () => {
    const { spawn } = fakeWorkers();
    const pool = framePool({
      spawn,
      maxWorkers: 3,
      lanesFor: ({ fileBytes }) => fileBytes,
    });
    expect(pool.lanes?.({ sourcePixels: 1, fileBytes: 2 })).toBe(2);
    expect(pool.lanes?.({ sourcePixels: 1, fileBytes: 10 })).toBe(3);
  });

  // Nothing sends it — the worker posts the picture first, on one port —
  // but taken as it came, the decode would wait for a picture for ever.
  it("fails a frame whose encodings come before its picture, rather than hang", async () => {
    const { workers, spawn } = fakeWorkers();
    const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
    const decoding = pool.decode(bytes("one"), "f1.png");
    workers[0].say({ type: "encoded", id: 1, encoded: webps() });
    await expect(decoding).rejects.toThrow("f1.png");
  });

  it("frees a picture that arrives after the pool was closed", () => {
    const { workers, spawn } = fakeWorkers({ deliverAfterTerminate: true });
    const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
    void pool.decode(bytes("one"), "f1.png").catch(() => {});
    pool.dispose();
    const late = bitmap();
    workers[0].say({
      type: "picture",
      id: 1,
      picture: late as never,
      sourcePixels: null,
    });
    expect(late.closed).toBe(true);
  });

  describe("probe", () => {
    it("asks one worker whether it encodes WebP, and gives that worker the first frame", async () => {
      const { workers, spawn } = fakeWorkers();
      const pool = framePool({ spawn, maxWorkers: 4, lanesFor: () => 4 });
      const asking = pool.probe(1000);
      expect(workers[0].posted[0].message).toEqual({ type: "probe" });
      workers[0].say({ type: "probe", webp: true });
      expect(await asking).toBe(true);
      void pool.decode(bytes("one"), "f1.png");
      expect(workers).toHaveLength(1);
      expect(workers[0].frames()).toEqual([1]);
    });

    it("hears a worker whose canvas encodes no WebP", async () => {
      const { workers, spawn } = fakeWorkers();
      const pool = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
      const asking = pool.probe(1000);
      workers[0].say({ type: "probe", webp: false });
      expect(await asking).toBe(false);
    });

    it("gives up on a worker that never answers, or dies instead", async () => {
      const silent = framePool({
        spawn: fakeWorkers().spawn,
        maxWorkers: 1,
        lanesFor: () => 1,
      });
      expect(await silent.probe(5)).toBeNull();
      const { workers, spawn } = fakeWorkers();
      const dying = framePool({ spawn, maxWorkers: 1, lanesFor: () => 1 });
      const asking = dying.probe(1000);
      workers[0].die();
      expect(await asking).toBeNull();
    });
  });
});

// The pool and the pipeline together, with workers that answer on their
// own a few milliseconds apart, as real ones do. What is checked is the
// promise the two make between them: every picture a worker hands over
// is closed exactly once, whoever ends up holding it — the watcher, the
// loop freeing what it made ahead, or the pool dropping a late one.
describe("framePool under produceFrameSet", () => {
  const text = (s: string) => new TextEncoder().encode(s);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function orbit(frameCount: number) {
    const archive = await openZip(
      fileSource(
        new Blob([
          buildZip(
            Array.from({ length: frameCount }, (_, i) => ({
              name: `render_${String(i + 1).padStart(4, "0")}.png`,
              data: text(`frame ${i + 1} `.repeat(20)),
              method: 8 as const,
            })),
          ),
        ]),
      ),
    );
    const order = orderFrames(archive.entries);
    if (!order.ok) throw new Error(order.reason);
    return { archive, frames: order.frames };
  }

  const transport: FrameSetTransport = {
    async presign(frameCount) {
      const urls = (width: number) =>
        Array.from({ length: frameCount }, (_, i) => `put://${width}/${i}`);
      return {
        ok: true,
        set: {
          setId: "s".repeat(32),
          keyPrefix: "p/",
          urls: { 1600: urls(1600), 800: urls(800) },
        },
      };
    },
    async put() {
      await wait(1);
      return "ok";
    },
    async abandon() {},
  };

  /** Workers that decode in `pictureMs` and encode 2 ms later. */
  function answeringWorkers(options: {
    pictureMs: (ordinal: number) => number;
    failAfterPictureOf?: number;
    deliverAfterTerminate?: boolean;
  }) {
    const closes = new Map<number, number>();
    const delivered: number[] = [];
    const spawn: SpawnFrameWorker = ({ message }) => {
      let terminated = false;
      const say = (answer: FromFrameWorker, ordinal?: number) => {
        if (terminated && !options.deliverAfterTerminate) return;
        if (ordinal !== undefined) delivered.push(ordinal);
        message(answer);
      };
      return {
        post(sent) {
          if (sent.type === "probe") return say({ type: "probe", webp: true });
          const ordinal = Number(
            new TextDecoder().decode(sent.bytes).split(" ")[1],
          );
          setTimeout(() => {
            const picture = {
              width: 800,
              height: 450,
              close: () => closes.set(ordinal, (closes.get(ordinal) ?? 0) + 1),
            };
            say(
              {
                type: "picture",
                id: sent.id,
                picture: picture as never,
                sourcePixels: 1,
              },
              ordinal,
            );
            setTimeout(() => {
              say(
                ordinal === options.failAfterPictureOf
                  ? { type: "failed", id: sent.id }
                  : { type: "encoded", id: sent.id, encoded: webps() },
              );
            }, 2);
          }, options.pictureMs(ordinal));
        },
        terminate() {
          terminated = true;
        },
      };
    };
    return { spawn, closes, delivered };
  }

  async function run(
    workers: ReturnType<typeof answeringWorkers>,
    signal?: AbortSignal,
    onPicture?: (ordinal: number) => void,
  ) {
    const pool = framePool({
      spawn: workers.spawn,
      maxWorkers: 4,
      lanesFor: () => 4,
    });
    expect(await pool.probe(100)).toBe(true);
    const { archive, frames } = await orbit(8);
    try {
      return await produceFrameSet({
        archive,
        frames,
        encoder: pool,
        transport,
        signal,
        onPicture: (ordinal, picture) => {
          picture.release?.();
          onPicture?.(ordinal);
        },
      });
    } finally {
      pool.dispose();
    }
  }

  it("closes every picture exactly once when a frame fails after its picture", async () => {
    const workers = answeringWorkers({
      pictureMs: (ordinal) => (ordinal === 3 ? 20 : 1),
      failAfterPictureOf: 3,
    });
    expect(await run(workers)).toEqual({ ok: false, failure: "encode_failed" });
    await wait(40);
    expect(workers.delivered.length).toBeGreaterThan(3);
    for (const ordinal of workers.delivered) {
      expect(workers.closes.get(ordinal)).toBe(1);
    }
  });

  it("closes every picture exactly once when the run is aborted and answers keep coming", async () => {
    const workers = answeringWorkers({
      pictureMs: (ordinal) => (ordinal >= 3 ? 15 : 1),
      deliverAfterTerminate: true,
    });
    const controller = new AbortController();
    const outcome = await run(workers, controller.signal, (ordinal) => {
      if (ordinal === 2) controller.abort();
    });
    expect(outcome).toEqual({ ok: false, failure: "aborted" });
    await wait(60);
    expect(workers.delivered.length).toBeGreaterThan(2);
    for (const ordinal of workers.delivered) {
      expect(workers.closes.get(ordinal)).toBe(1);
    }
  });
});

describe("frame lanes", () => {
  it("leaves a core for the page, and stops at four", () => {
    expect(maxFrameLanes({ cores: 20 })).toBe(4);
    expect(maxFrameLanes({ cores: 8 })).toBe(4);
    expect(maxFrameLanes({ cores: 4 })).toBe(3);
    expect(maxFrameLanes({ cores: 2 })).toBe(1);
    expect(maxFrameLanes({ cores: 1 })).toBe(1);
    // A browser that will not say: two cores assumed, one lane.
    expect(maxFrameLanes({})).toBe(1);
    expect(maxFrameLanes({ cores: Number.NaN })).toBe(1);
  });

  const k4 = 3840 * 2160;
  const k8 = 7680 * 4320;
  // A lane holds the frame decoded, four bytes a pixel, and its file three
  // times; a sixteenth of the device's memory is theirs to share.
  const flat4k = { sourcePixels: k4, fileBytes: 50_000 };
  const busy4k = { sourcePixels: k4, fileBytes: 15_000_000 };
  const render8k = { sourcePixels: k8, fileBytes: 14_500_000 };
  const noisy8k = { sourcePixels: k8, fileBytes: 60_000_000 };

  it("fits as many frames as a sixteenth of the memory holds while they decode", () => {
    // A laptop reports 8 (the most it may).
    expect(frameLanes({ cores: 20, memoryGb: 8 }, busy4k)).toBe(4);
    // The 872 MB archive of #121: sixty 8K frames of 14.5 MB.
    expect(frameLanes({ cores: 20, memoryGb: 8 }, render8k)).toBe(3);
    expect(frameLanes({ cores: 20, memoryGb: 8 }, noisy8k)).toBe(1);
    // A phone makes fewer at once, and the file counts as well as the
    // pixels: four flat frames where three busy ones fit.
    expect(frameLanes({ cores: 8, memoryGb: 4 }, flat4k)).toBe(4);
    expect(frameLanes({ cores: 8, memoryGb: 4 }, busy4k)).toBe(3);
    expect(frameLanes({ cores: 8, memoryGb: 4 }, render8k)).toBe(1);
    expect(frameLanes({ cores: 8, memoryGb: 2 }, busy4k)).toBe(1);
    expect(frameLanes({ cores: 8, memoryGb: 0.5 }, flat4k)).toBe(1);
  });

  it("makes two at most where the device does not say how much memory it has", () => {
    expect(frameLanes({ cores: 20 }, flat4k)).toBe(2);
    expect(frameLanes({ cores: 20 }, busy4k)).toBe(2);
    expect(frameLanes({ cores: 20 }, render8k)).toBe(1);
  });

  it("makes a frame of unknown size alone", () => {
    const device = { cores: 20, memoryGb: 8 };
    expect(frameLanes(device, { sourcePixels: null, fileBytes: 1 })).toBe(1);
    expect(frameLanes(device, { sourcePixels: 0, fileBytes: 1 })).toBe(1);
    expect(frameLanes(device, { sourcePixels: Number.NaN, fileBytes: 1 })).toBe(
      1,
    );
  });
});
