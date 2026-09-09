import { describe, expect, it } from "vitest";
import {
  produceFrameSet,
  type FrameEncoder,
  type FrameSetProgress,
  type FrameSetTransport,
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

/** Encodes a frame as a "WebP" whose bytes name the frame and the width. */
function fakeEncoder(
  options: { type?: string; sizeOf?: (width: R360Width) => number } = {},
): FrameEncoder & { encoded: string[] } {
  const encoded: string[] = [];
  return {
    encoded,
    async encode(bytes, name) {
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
      return { 1600: make(1600), 800: make(800) };
    },
  };
}

function presignOf(frameCount: number): FrameSetPresign {
  const urls = (width: number) =>
    Array.from({ length: frameCount }, (_, i) => `put://${width}/${i + 1}`);
  return {
    setId: "s".repeat(32),
    stagingPrefix: "devski/staging/u/s/",
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
      stagingPrefix: "devski/staging/u/s/",
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
    const outcome = await produceFrameSet({
      archive,
      frames,
      encoder: fakeEncoder(),
      transport,
      concurrency: 2,
    });
    expect(outcome).toEqual({ ok: false, failure: "upload_failed" });
    expect(transport.abandoned).toEqual(["devski/staging/u/s/"]);
    // Not every frame was encoded: the loop stopped once the failure showed.
    expect(transport.puts.length).toBeLessThan(12);
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
          async encode() {
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
});
