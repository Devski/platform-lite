import { describe, expect, it } from "vitest";
import {
  produceFrameSet,
  type FrameEncoder,
  type FrameSetProgress,
  type FrameSetTransport,
  type FrameSize,
} from "./frame-pipeline";
import {
  R360_FRAME_MAX_BYTES,
  type FrameSetPresign,
  type R360Width,
} from "./frame-set-shared";
import { orderFrames } from "./frame-names";
import { buildZip } from "./test-zip";
import { fileSource, openZip } from "./zip-reader";

// #102: the browser's loop without a browser — a real archive read by the
// #101 reader, a fake encoder in place of the canvas, a fake transport in
// place of the network. What is checked is the order, the bookkeeping and
// the way it gives up.

const text = (s: string) => new TextEncoder().encode(s);

async function orbit(frameCount: number) {
  const bytes = buildZip(
    Array.from({ length: frameCount }, (_, i) => ({
      name: `render_${String(i + 1).padStart(4, "0")}.png`,
      data: text(`frame ${i + 1} `.repeat(20)),
      method: 8 as const,
    })),
  );
  const archive = await openZip(fileSource(new Blob([bytes])));
  const order = orderFrames(archive.entries);
  if (!order.ok) throw new Error(order.reason);
  return { archive, frames: order.frames };
}

/**
 * Decodes a frame into a picture nothing can paint (there is no canvas
 * here) and a "WebP" per width whose bytes name the frame and the width.
 * `released` records the pictures the pipeline freed itself; `closed` the
 * decodes it let go of — the browser's are ImageBitmaps, and a decode the
 * loop forgets is a leak nothing else would catch.
 */
function fakeEncoder(
  options: {
    type?: string;
    sizeOf?: (width: R360Width) => number;
    onEncode?: (ordinal: number) => void;
  } = {},
): FrameEncoder & {
  encoded: string[];
  released: number[];
  closed: number[];
} {
  const encoded: string[] = [];
  const released: number[] = [];
  const closed: number[] = [];
  return {
    encoded,
    released,
    closed,
    async decode(bytes, name) {
      encoded.push(name);
      const label = new TextDecoder().decode(bytes).trim().split(" ")[1];
      const make = (width: R360Width) =>
        new Blob(
          [
            `RIFF..WEBP ${label}@${width}`.padEnd(
              options.sizeOf?.(width) ?? 24,
              ".",
            ),
          ],
          {
            type: options.type ?? "image/webp",
          },
        );
      return {
        picture: {
          source: {} as CanvasImageSource,
          width: 800,
          height: 450,
          bytes: 0,
          release: () => released.push(Number(label)),
        },
        close() {
          closed.push(Number(label));
        },
        async encode() {
          options.onEncode?.(Number(label));
          return { 1600: make(1600), 800: make(800) };
        },
      };
    },
  };
}

/**
 * #137: an encoder that makes several frames at once, the way the worker
 * pool does — with a log of when each frame started, finished decoding
 * and finished encoding, and the most frames it ever had in the making. A
 * frame is in the making from its decode's start until its encodings
 * exist: that is how long a worker is busy with it.
 */
function laneEncoder(options: {
  lanes: (size: FrameSize) => number;
  /** Each frame's source size; unknown (null) when not given. */
  sourcePixels?: (ordinal: number) => number | null;
  /** How long each frame's decode takes, in milliseconds. */
  decodeMs?: (ordinal: number) => number;
  failDecodeOf?: number;
}): FrameEncoder & {
  log: string[];
  peak: () => number;
  /** How many frames were in the making as each one started, itself in. */
  busyAtStart: Map<number, number>;
  lanesAskedFor: FrameSize[];
  released: number[];
  closed: number[];
} {
  const log: string[] = [];
  const busyAtStart = new Map<number, number>();
  const lanesAskedFor: FrameSize[] = [];
  const released: number[] = [];
  const closed: number[] = [];
  let active = 0;
  let peak = 0;
  return {
    log,
    peak: () => peak,
    busyAtStart,
    lanesAskedFor,
    released,
    closed,
    lanes(size) {
      lanesAskedFor.push(size);
      return options.lanes(size);
    },
    async decode(bytes) {
      const ordinal = Number(new TextDecoder().decode(bytes).split(" ")[1]);
      active += 1;
      peak = Math.max(peak, active);
      busyAtStart.set(ordinal, active);
      log.push(`start ${ordinal}`);
      await new Promise((r) => setTimeout(r, options.decodeMs?.(ordinal) ?? 1));
      if (ordinal === options.failDecodeOf) {
        active -= 1;
        throw new Error("decode failed");
      }
      log.push(`decoded ${ordinal}`);
      const webp = (width: R360Width) =>
        new Blob([`RIFF..WEBP ${ordinal}@${width}`.padEnd(24, ".")], {
          type: "image/webp",
        });
      return {
        picture: {
          source: {} as CanvasImageSource,
          width: 800,
          height: 450,
          bytes: 0,
          release: () => released.push(ordinal),
        },
        sourcePixels: options.sourcePixels?.(ordinal) ?? null,
        close: () => closed.push(ordinal),
        async encode() {
          await new Promise((r) => setTimeout(r, 1));
          active -= 1;
          log.push(`encoded ${ordinal}`);
          return { 1600: webp(1600), 800: webp(800) };
        },
      };
    },
  };
}

/** Waits for something the loop does on its own, without fixing a delay. */
async function until(condition: () => boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 1));
  }
}

function presignOf(frameCount: number): FrameSetPresign {
  const urls = (width: number) =>
    Array.from({ length: frameCount }, (_, i) => `put://${width}/${i + 1}`);
  return {
    setId: "s".repeat(32),
    keyPrefix: "devski/staging/u/s/",
    urls: { 1600: urls(1600), 800: urls(800) },
  };
}

interface FakeTransport extends FrameSetTransport {
  puts: { url: string; body: string }[];
  abandoned: string[];
  inFlightPeak: number;
}

function fakeTransport(
  options: {
    presign?: () => ReturnType<FrameSetTransport["presign"]>;
    failOn?: string;
    delay?: number;
  } = {},
): FakeTransport {
  const transport: FakeTransport = {
    puts: [],
    abandoned: [],
    inFlightPeak: 0,
    presign:
      options.presign ??
      (async (frameCount) => ({ ok: true, set: presignOf(frameCount) })),
    async put(url, body, put) {
      inFlight += 1;
      transport.inFlightPeak = Math.max(transport.inFlightPeak, inFlight);
      await new Promise((r) => setTimeout(r, options.delay ?? 1));
      inFlight -= 1;
      if (put.signal?.aborted) return "aborted";
      if (url === options.failOn) return "failed";
      put.onProgress?.(0.5);
      put.onProgress?.(1);
      transport.puts.push({ url, body: await body.text() });
      return "ok";
    },
    async abandon(prefix) {
      transport.abandoned.push(prefix);
    },
  };
  let inFlight = 0;
  return transport;
}

describe("produceFrameSet", () => {
  it("presigns once, encodes every frame in orbit order, uploads both widths to the frame's own URL", async () => {
    const { archive, frames } = await orbit(5);
    const encoder = fakeEncoder();
    const transport = fakeTransport();
    const reports: FrameSetProgress[] = [];
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder,
      transport,
      onProgress: (p) => reports.push(p),
      concurrency: 2,
    });
    expect(outcome).toEqual({
      ok: true,
      setId: "s".repeat(32),
      keyPrefix: "devski/staging/u/s/",
      frameCount: 5,
    });
    expect(encoder.encoded).toEqual(frames.map((f) => f.name));
    expect(transport.puts).toHaveLength(10);
    const at = (url: string) => transport.puts.find((p) => p.url === url)?.body;
    expect(at("put://1600/1")).toContain("1@1600");
    expect(at("put://800/1")).toContain("1@800");
    expect(at("put://1600/5")).toContain("5@1600");
    expect(transport.inFlightPeak).toBeLessThanOrEqual(2);
    expect(transport.abandoned).toEqual([]);
    const last = reports[reports.length - 1];
    expect(last.framesDone).toBe(5);
    expect(last.framesTotal).toBe(5);
    expect(last.bytesQueued).toBe(10 * 24);
    expect(last.bytesSent).toBe(10 * 24);
    expect(last.framesLanded).toBe(5);
    // A count that only grows, one per frame whose both encodings landed.
    const landed = reports.map((r) => r.framesLanded);
    expect(landed.every((n, i) => i === 0 || n >= landed[i - 1])).toBe(true);
    expect(reports[0]).toEqual({
      framesDone: 0,
      framesTotal: 5,
      bytesSent: 0,
      bytesQueued: 0,
      framesLanded: 0,
    });
  });

  it("stops at a refused presign before touching a frame", async () => {
    const { archive, frames } = await orbit(3);
    const encoder = fakeEncoder();
    const transport = fakeTransport({
      presign: async () => ({ ok: false, failure: "quota_exceeded" }),
    });
    expect(
      await produceFrameSet({ archive, frames, encoder, transport }),
    ).toEqual({ ok: false, failure: "quota_exceeded" });
    expect(encoder.encoded).toEqual([]);
  });

  it("gives up on a failed upload, waits for the ones in flight, and abandons the set", async () => {
    const { archive, frames } = await orbit(6);
    const transport = fakeTransport({ failOn: "put://800/2", delay: 3 });
    const encoder = fakeEncoder();
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder,
      transport,
      concurrency: 2,
      // Short on purpose: with the default queue the producer outruns the
      // failure and encodes the whole orbit before seeing it (#122), and
      // then this says nothing about stopping.
      queuedFrames: 1,
    });
    expect(outcome).toEqual({ ok: false, failure: "upload_failed" });
    expect(transport.abandoned).toEqual(["devski/staging/u/s/"]);
    // Not every frame was encoded: the loop stopped once the failure showed.
    expect(encoder.encoded.length).toBeLessThan(6);
    // And every decode it did make was let go of on the way out.
    expect(encoder.closed).toEqual(encoder.encoded.map((_, i) => i + 1));
  });

  it("refuses an encoder that produces no WebP, or a frame past the ceiling, or nothing", async () => {
    const { archive, frames } = await orbit(2);
    for (const [encoder, failure] of [
      [fakeEncoder({ type: "image/png" }), "webp_unsupported"],
      [
        fakeEncoder({
          sizeOf: (w) => (w === 800 ? R360_FRAME_MAX_BYTES[800] + 1 : 24),
        }),
        "frame_too_large",
      ],
      [
        {
          async decode() {
            throw new Error("decode failed");
          },
        },
        "encode_failed",
      ],
    ] as const) {
      const transport = fakeTransport();
      expect(
        await produceFrameSet({ archive, frames, encoder, transport }),
      ).toEqual({ ok: false, failure });
      expect(transport.abandoned).toHaveLength(1);
    }
  });

  it("reports a frame the archive cannot give as read_failed", async () => {
    const { archive, frames } = await orbit(2);
    const broken = { ...frames[1], localHeaderOffset: 5 };
    const transport = fakeTransport();
    expect(
      await produceFrameSet({
        archive,
        frames: [frames[0], broken],
        encoder: fakeEncoder(),
        transport,
      }),
    ).toEqual({ ok: false, failure: "read_failed" });
  });

  it("stops on abort and abandons what it had", async () => {
    const { archive, frames } = await orbit(4);
    const controller = new AbortController();
    const transport = fakeTransport({ delay: 2 });
    let seen = 0;
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder: fakeEncoder(),
      transport,
      signal: controller.signal,
      onProgress: (p) => {
        seen = p.framesDone;
        if (p.framesDone === 2) controller.abort();
      },
    });
    expect(outcome).toEqual({ ok: false, failure: "aborted" });
    expect(seen).toBeLessThan(4);
    expect(transport.abandoned).toHaveLength(1);
  });

  // #121: the preview used to wait for both WebPs and then decode one of
  // them again. The picture comes out of the decode instead.
  it("hands the picture over before the frame is encoded, and leaves it to the taker", async () => {
    const { archive, frames } = await orbit(3);
    const order: string[] = [];
    const encoder = fakeEncoder({
      onEncode: (ordinal) => order.push(`encoded ${ordinal}`),
    });
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder,
      transport: fakeTransport(),
      onPicture: (ordinal) => order.push(`picture ${ordinal}`),
      onFrame: (ordinal) => order.push(`frame ${ordinal}`),
    });
    expect(outcome.ok).toBe(true);
    expect(order.slice(0, 4)).toEqual([
      "picture 1",
      "encoded 1",
      "frame 1",
      "picture 2",
    ]);
    // Handed on is handed over: the store closes it, not the pipeline.
    expect(encoder.released).toEqual([]);
    // The decode behind it is the pipeline's, and it lets go of each.
    expect(encoder.closed).toEqual([1, 2, 3]);
  });

  it("frees the picture nobody is watching for", async () => {
    const { archive, frames } = await orbit(3);
    const encoder = fakeEncoder();
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder,
      transport: fakeTransport(),
    });
    expect(outcome.ok).toBe(true);
    expect(encoder.released).toEqual([1, 2, 3]);
  });

  it("gives the decode up, and the set, when the watcher itself throws", async () => {
    const { archive, frames } = await orbit(3);
    const encoder = fakeEncoder();
    const transport = fakeTransport();
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder,
      transport,
      onPicture: () => {
        throw new Error("the form blew up");
      },
    });
    // Not a rejected run: the staged bytes still have to stop counting.
    expect(outcome).toEqual({ ok: false, failure: "encode_failed" });
    expect(transport.abandoned).toEqual(["devski/staging/u/s/"]);
    expect(encoder.closed).toEqual([1]);
  });

  // A concurrency of zero, or one that came out of a bad Number(), would
  // start no upload at all — and the run would report a set it had never
  // sent, which the save then refuses server-side.
  it("falls back on an upload concurrency it cannot use", async () => {
    const { archive, frames } = await orbit(3);
    const transport = fakeTransport();
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder: fakeEncoder(),
      transport,
      concurrency: Number("half a dozen"),
      queuedFrames: 0,
    });
    expect(outcome.ok).toBe(true);
    expect(transport.puts).toHaveLength(6);
  });

  // #122: the producer used to queue a frame's PUTs and wait for room
  // before reading the next one, so a slow uplink set the pace of the
  // decoding. Now it runs ahead — as far as the queue's cap, no further.
  it("keeps encoding while the uplink is busy, and stops at the queue cap", async () => {
    const { archive, frames } = await orbit(12);
    let letThemLand: () => void = () => {};
    const held = new Promise<void>((resolve) => (letThemLand = resolve));
    const encoder = fakeEncoder();
    const transport: FrameSetTransport = {
      async presign(frameCount) {
        return { ok: true, set: presignOf(frameCount) };
      },
      async put() {
        await held;
        return "ok";
      },
      async abandon() {},
    };
    const run = produceFrameSet({
      archive,
      frames,
      encoder,
      transport,
      // Two PUTs in the air and six parts queued: four frames' worth.
      concurrency: 2,
      queuedFrames: 3,
    });
    await until(() => encoder.encoded.length >= 4);
    await new Promise((r) => setTimeout(r, 10));
    expect(encoder.encoded).toHaveLength(4);
    letThemLand();
    expect((await run).ok).toBe(true);
    expect(encoder.encoded).toHaveLength(12);
  });

  // #137: the frames used to be made one at a time on a machine with
  // cores standing idle. An encoder that can make several says so, for
  // frames the size of the first.
  describe("with lanes", () => {
    it("makes the first frame alone, then as many at once as the encoder says — never more", async () => {
      const { archive, frames } = await orbit(8);
      const encoder = laneEncoder({
        lanes: () => 3,
        sourcePixels: () => 3840 * 2160,
      });
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport: fakeTransport(),
      });
      expect(outcome.ok).toBe(true);
      // Nothing else started before the first frame was decoded: it gets
      // the machine to itself, and the preview gets it first.
      expect(encoder.log.slice(0, 2)).toEqual(["start 1", "decoded 1"]);
      expect(encoder.peak()).toBe(3);
      // Asked with each frame's size: its pixels, and its file as the
      // archive holds it.
      expect(encoder.lanesAskedFor[0]).toEqual({
        sourcePixels: 3840 * 2160,
        fileBytes: frames[0].uncompressedSize,
      });
      expect(encoder.lanesAskedFor).toHaveLength(8);
      expect(encoder.closed.toSorted((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
    });

    it("hands every picture and every frame on in orbit order, whichever finished first", async () => {
      const { archive, frames } = await orbit(6);
      // The second frame is the slow one: the third and the fourth are
      // decoded before it.
      const encoder = laneEncoder({
        lanes: () => 4,
        decodeMs: (ordinal) => (ordinal === 2 ? 25 : 1),
      });
      const order: string[] = [];
      const transport = fakeTransport();
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport,
        onPicture: (ordinal) => order.push(`picture ${ordinal}`),
        onFrame: (ordinal) => order.push(`frame ${ordinal}`),
      });
      expect(outcome.ok).toBe(true);
      expect(encoder.log.indexOf("decoded 3")).toBeLessThan(
        encoder.log.indexOf("decoded 2"),
      );
      expect(order).toEqual(
        [1, 2, 3, 4, 5, 6].flatMap((n) => [`picture ${n}`, `frame ${n}`]),
      );
      // And each encoding went to its own frame's URL.
      const at = (url: string) =>
        transport.puts.find((p) => p.url === url)?.body;
      expect(at("put://1600/2")).toContain("2@1600");
      expect(at("put://800/3")).toContain("3@800");
    });

    it("frees the frames it made ahead when a frame fails", async () => {
      const { archive, frames } = await orbit(6);
      // The third frame fails slowly, after the fourth and fifth are made.
      const encoder = laneEncoder({
        lanes: () => 3,
        failDecodeOf: 3,
        decodeMs: (ordinal) => (ordinal === 3 ? 25 : 1),
      });
      const transport = fakeTransport();
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport,
        onPicture: (_, picture) => picture.release?.(),
      });
      expect(outcome).toEqual({ ok: false, failure: "encode_failed" });
      expect(transport.abandoned).toEqual(["devski/staging/u/s/"]);
      await until(() => encoder.log.includes("decoded 5"));
      await until(() => encoder.closed.includes(5));
      // Frames 4 and 5 were decoded ahead and never handed on: the loop
      // freed them. 1 and 2 went to the watcher, who freed them.
      expect(encoder.released.toSorted((a, b) => a - b)).toEqual([1, 2, 4, 5]);
      expect(encoder.closed.toSorted((a, b) => a - b)).toEqual([1, 2, 4, 5]);
      // Nothing past the lanes was started.
      expect(encoder.log).not.toContain("start 6");
    });

    it("frees the frames it made ahead when it is aborted", async () => {
      const { archive, frames } = await orbit(8);
      const controller = new AbortController();
      const encoder = laneEncoder({ lanes: () => 3 });
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport: fakeTransport(),
        signal: controller.signal,
        onPicture: (ordinal, picture) => {
          picture.release?.();
          if (ordinal === 2) controller.abort();
        },
      });
      expect(outcome).toEqual({ ok: false, failure: "aborted" });
      const decoded = () =>
        encoder.log.filter((line) => line.startsWith("decoded")).length;
      await until(() => encoder.released.length === decoded());
      // Every decode made was freed, handed on or not, and let go of.
      expect(encoder.released.toSorted((a, b) => a - b)).toEqual(
        encoder.closed.toSorted((a, b) => a - b),
      );
      expect(decoded()).toBeGreaterThan(2);
    });

    it("makes one at a time on a lanes answer it cannot use", async () => {
      for (const answer of [0, -2, Number.NaN, Infinity]) {
        const { archive, frames } = await orbit(4);
        const encoder = laneEncoder({ lanes: () => answer });
        const outcome = await produceFrameSet({
          archive,
          frames,
          encoder,
          transport: fakeTransport(),
        });
        expect(outcome.ok).toBe(true);
        expect(encoder.peak()).toBe(1);
      }
    });

    it("takes a fractional answer as the whole lanes in it", async () => {
      const { archive, frames } = await orbit(6);
      const encoder = laneEncoder({ lanes: () => 2.9 });
      await produceFrameSet({
        archive,
        frames,
        encoder,
        transport: fakeTransport(),
      });
      expect(encoder.peak()).toBe(2);
    });

    // A zip of holiday photos need not be one size (#68): a 48-megapixel
    // one late in the orbit must not be decoded four at a time because the
    // first photo was small.
    it("narrows the lanes for a larger frame later on, and never widens them again", async () => {
      const { archive, frames } = await orbit(9);
      const photo = 8000 * 6000;
      const encoder = laneEncoder({
        sourcePixels: (ordinal) => (ordinal === 3 ? photo : 1920 * 1080),
        lanes: ({ sourcePixels }) => (sourcePixels === photo ? 1 : 4),
      });
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport: fakeTransport(),
      });
      expect(outcome.ok).toBe(true);
      expect(encoder.peak()).toBe(4);
      // Frames 4 to 6 were already under way when the third was taken;
      // every frame started after that was made alone, small as it was.
      expect(
        [7, 8, 9].map((ordinal) => encoder.busyAtStart.get(ordinal)),
      ).toEqual([1, 1, 1]);
    });

    it("starts no frame while it waits for room on the uplink, however many lanes (#122)", async () => {
      const { archive, frames } = await orbit(12);
      let letThemLand: () => void = () => {};
      const held = new Promise<void>((resolve) => (letThemLand = resolve));
      const encoder = laneEncoder({ lanes: () => 3 });
      const transport: FrameSetTransport = {
        async presign(frameCount) {
          return { ok: true, set: presignOf(frameCount) };
        },
        async put() {
          await held;
          return "ok";
        },
        async abandon() {},
      };
      const run = produceFrameSet({
        archive,
        frames,
        encoder,
        transport,
        concurrency: 2,
        queuedFrames: 3,
      });
      const count = (what: string) =>
        encoder.log.filter((line) => line.startsWith(what)).length;
      await until(() => count("encoded") >= 4);
      await new Promise((r) => setTimeout(r, 20));
      // Two PUTs in the air and six parts queued: four frames' worth,
      // encoded — and the two made ahead of them while there was room.
      expect(count("encoded")).toBe(4);
      expect(count("start")).toBe(6);
      letThemLand();
      expect((await run).ok).toBe(true);
    });

    it("gives the set up, and frees the frames made ahead, when a callback throws", async () => {
      const { archive, frames } = await orbit(6);
      const encoder = laneEncoder({ lanes: () => 3 });
      const transport = fakeTransport();
      const outcome = await produceFrameSet({
        archive,
        frames,
        encoder,
        transport,
        onPicture: (_, picture) => picture.release?.(),
        onFrame: (ordinal) => {
          if (ordinal === 2) throw new Error("the form blew up");
        },
      });
      // Not a rejected run: the set still has to stop counting.
      expect(outcome).toEqual({ ok: false, failure: "encode_failed" });
      expect(transport.abandoned).toEqual(["devski/staging/u/s/"]);
      const decoded = () =>
        encoder.log.filter((line) => line.startsWith("decoded")).length;
      await until(() => encoder.released.length === decoded());
      expect(decoded()).toBeGreaterThan(2);
      expect(encoder.released.toSorted((a, b) => a - b)).toEqual(
        encoder.closed.toSorted((a, b) => a - b),
      );
    });
  });

  it("reserves nothing for a run aborted before it began", async () => {
    const { archive, frames } = await orbit(3);
    const controller = new AbortController();
    controller.abort();
    let presigns = 0;
    const encoder = fakeEncoder();
    const transport = fakeTransport({
      presign: async () => {
        presigns += 1;
        return { ok: true, set: presignOf(3) };
      },
    });
    expect(
      await produceFrameSet({
        archive,
        frames,
        encoder,
        transport,
        signal: controller.signal,
      }),
    ).toEqual({ ok: false, failure: "aborted" });
    expect(presigns).toBe(0);
    expect(encoder.encoded).toEqual([]);
    expect(transport.abandoned).toEqual([]);
  });
});
