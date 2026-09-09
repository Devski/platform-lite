import type { ZipArchive, ZipEntry } from "./zip-reader";
import {
  R360_FRAME_CONTENT_TYPE,
  R360_FRAME_MAX_BYTES,
  R360_WIDTHS,
  type FrameSetPresign,
  type R360Width,
} from "./frame-set-shared";

// #102 (step 3 of #68, A13): the browser is the worker. One frame at a
// time, in order: read out of the archive, decode and encode at the two
// widths, upload straight to staging (G4), release. The set's URLs come
// from one batch presign before the first frame is touched — a quota
// refusal costs no decoding. Pure orchestration: the encoder and the
// transport are handed in, so the loop runs under a test as it does in a
// browser.

/** Turns one frame's bytes into a WebP per width; the browser's canvas. */
export interface FrameEncoder {
  encode(bytes: Uint8Array, name: string): Promise<Record<R360Width, Blob>>;
}

export type FrameSetFailure =
  | "aborted"
  /** The presign was refused (the code is in `detail`) or failed. */
  | "presign_failed"
  | "quota_exceeded"
  | "rate_limited"
  /** A frame the archive holds could not be read. */
  | "read_failed"
  /** The browser could not decode a frame. */
  | "encode_failed"
  /** The browser encodes no WebP — the frames would fail the save. */
  | "webp_unsupported"
  /** A frame encoded past its width's ceiling. */
  | "frame_too_large"
  | "upload_failed";

export type PresignOutcome =
  { ok: true; set: FrameSetPresign } | { ok: false; failure: FrameSetFailure };

/** The network side: the batch presign, the PUT, the give-up. */
export interface FrameSetTransport {
  presign(frameCount: number): Promise<PresignOutcome>;
  put(
    url: string,
    body: Blob,
    options: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
  ): Promise<"ok" | "failed" | "aborted">;
  abandon(stagingPrefix: string): Promise<unknown>;
}

export interface FrameSetProgress {
  /** Frames decoded and encoded so far. */
  framesDone: number;
  framesTotal: number;
  /** Bytes of frames that have left the browser, out of those encoded. */
  bytesSent: number;
  bytesQueued: number;
}

export type FrameSetOutcome =
  | { ok: true; setId: string; frameCount: number }
  | { ok: false; failure: FrameSetFailure };

export interface ProduceFrameSetOptions {
  archive: ZipArchive;
  /** The frames in orbit order (frame-names.ts); ordinal = index + 1. */
  frames: ZipEntry[];
  encoder: FrameEncoder;
  transport: FrameSetTransport;
  onProgress?: (progress: FrameSetProgress) => void;
  signal?: AbortSignal;
  /** Uploads in flight at once while the next frame is being encoded. */
  concurrency?: number;
}

/**
 * Produces and uploads a set. Resolves when every frame has landed, or
 * with the first failure — after which the set is abandoned server-side
 * and whatever was uploaded stops counting.
 */
export async function produceFrameSet(
  options: ProduceFrameSetOptions,
): Promise<FrameSetOutcome> {
  const { archive, frames, encoder, transport, signal } = options;
  const concurrency = options.concurrency ?? 3;
  const presigned = await transport.presign(frames.length);
  if (!presigned.ok) return presigned;
  const { set } = presigned;

  const progress: FrameSetProgress = {
    framesDone: 0,
    framesTotal: frames.length,
    bytesSent: 0,
    bytesQueued: 0,
  };
  const report = () => options.onProgress?.({ ...progress });
  report();

  // The uploads: bounded in flight, the first failure remembered. Every
  // PUT reports its own fraction; the sum is the bar's byte count.
  const inFlight = new Set<Promise<void>>();
  let failure: FrameSetFailure | null = null;
  const sent = new Map<Promise<void>, number>();
  const upload = (url: string, blob: Blob) => {
    const task: Promise<void> = transport
      .put(url, blob, {
        signal,
        onProgress: (fraction) => {
          const before = sent.get(task) ?? 0;
          const now = Math.round(fraction * blob.size);
          sent.set(task, now);
          progress.bytesSent += now - before;
          report();
        },
      })
      .then((result) => {
        if (result !== "ok" && !failure) {
          failure = result === "aborted" ? "aborted" : "upload_failed";
        }
      })
      .finally(() => {
        inFlight.delete(task);
        sent.delete(task);
      });
    inFlight.add(task);
    sent.set(task, 0);
  };
  const drainTo = async (count: number) => {
    while (inFlight.size > count && !failure) await Promise.race(inFlight);
  };
  const giveUp = async (why: FrameSetFailure): Promise<FrameSetOutcome> => {
    await Promise.allSettled(inFlight);
    void transport.abandon(set.stagingPrefix);
    return { ok: false, failure: why };
  };

  for (const [index, frame] of frames.entries()) {
    if (signal?.aborted) return giveUp("aborted");
    if (failure) return giveUp(failure);
    let bytes: Uint8Array;
    try {
      bytes = await archive.readEntry(frame);
    } catch {
      return giveUp("read_failed");
    }
    let encoded: Record<R360Width, Blob>;
    try {
      encoded = await encoder.encode(bytes, frame.name);
    } catch {
      return giveUp("encode_failed");
    }
    for (const width of R360_WIDTHS) {
      const blob = encoded[width];
      if (blob.type !== R360_FRAME_CONTENT_TYPE)
        return giveUp("webp_unsupported");
      if (blob.size === 0 || blob.size > R360_FRAME_MAX_BYTES[width]) {
        return giveUp("frame_too_large");
      }
    }
    progress.framesDone = index + 1;
    for (const width of R360_WIDTHS) {
      // Room for this one before it goes: never more than `concurrency`
      // PUTs in the air, the next frame decoding meanwhile.
      await drainTo(concurrency - 1);
      if (failure) break;
      progress.bytesQueued += encoded[width].size;
      upload(set.urls[width][index], encoded[width]);
    }
    report();
  }
  await drainTo(0);
  await Promise.allSettled(inFlight);
  if (failure) return giveUp(failure);
  if (signal?.aborted) return giveUp("aborted");
  return { ok: true, setId: set.setId, frameCount: frames.length };
}
