import type { FramePicture } from "./frame-pictures";
import type { ZipArchive, ZipEntry } from "./zip-reader";
import {
  R360_FRAME_CONTENT_TYPE,
  R360_FRAME_MAX_BYTES,
  R360_WIDTHS,
  type FrameSetPresign,
  type R360Width,
} from "./frame-set-shared";

// #102 (step 3 of #68, A13): the browser is the worker. One frame at a
// time, in order: read out of the archive, decode, hand the picture to
// whoever is watching, encode at the two widths, upload to staging (G4),
// release. The set's URLs come from one batch presign before the first
// frame is touched — a quota refusal costs no decoding. Pure
// orchestration: the encoder and the transport are handed in, so the loop
// runs under a test as it does in a browser.
//
// #121 and #122, from the first real archive (872 MB, 60 frames of an 8K
// render): the frame is shown at DECODE time rather than after both WebPs
// exist, and the producer no longer waits on the uplink. Decoding is the
// processor's work, the PUTs are the network's; they meet at a bounded
// queue instead of in lockstep.

/**
 * One frame decoded, before anything is encoded (#121). `picture` is that
 * frame at the preview's width, paintable this instant; the encodings are
 * made from the same decode, on demand.
 */
export interface DecodedFrame {
  /** Handed on by the pipeline, which never frees it — the taker does. */
  picture: FramePicture;
  /** The uploadable WebPs, one per width. */
  encode(): Promise<Record<R360Width, Blob>>;
  /** Frees what the decode holds. The picture is not touched. */
  close(): void;
}

/** Turns one frame's bytes into a picture and a WebP per width. */
export interface FrameEncoder {
  decode(bytes: Uint8Array<ArrayBuffer>, name: string): Promise<DecodedFrame>;
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
  /** Frames whose both encodings have landed — a count that only grows. */
  framesLanded: number;
}

export type FrameSetOutcome =
  | { ok: true; setId: string; stagingPrefix: string; frameCount: number }
  | { ok: false; failure: FrameSetFailure };

/** PUTs in the air at once while the producer works ahead of them. */
const UPLOAD_CONCURRENCY = 6;

/**
 * Frames encoded but not yet sent. A frame is at most 1 MiB + 384 KiB
 * across both widths (frame-set-shared.ts). The cap is per part and the
 * producer resumes just under it, so the real peak is the queue plus what
 * is in the air — around 27 MiB at the ceilings, whatever the orbit's
 * length. Enough to work through a stall of some seconds, far short of
 * what a phone would mind.
 */
const QUEUED_FRAMES = 16;

export interface ProduceFrameSetOptions {
  archive: ZipArchive;
  /** The frames in orbit order (frame-names.ts); ordinal = index + 1. */
  frames: ZipEntry[];
  encoder: FrameEncoder;
  transport: FrameSetTransport;
  onProgress?: (progress: FrameSetProgress) => void;
  /**
   * The frame the moment it is decoded (#121), before either WebP exists:
   * the owner's preview shows it an encode earlier than the uploads do.
   * The picture becomes the callback's, to keep and to release; with no
   * callback the pipeline frees it on the spot.
   */
  onPicture?: (ordinal: number, picture: FramePicture) => void;
  /**
   * Each frame's encodings the moment they exist (#103): what the form
   * keeps, so a frame the preview evicted can be decoded again without
   * going back to the archive.
   */
  onFrame?: (ordinal: number, encoded: Record<R360Width, Blob>) => void;
  signal?: AbortSignal;
  /** Uploads in flight at once. */
  concurrency?: number;
  /** How far the producer may run ahead of the uplink, in frames (#122). */
  queuedFrames?: number;
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
  // Floors, and NaN counts as no answer: at zero — or at a number that
  // compares false against everything — the sender would start nothing
  // and the run would report success having uploaded not one frame.
  const atLeastOne = (given: number | undefined, fallback: number) =>
    Number.isFinite(given) ? Math.max(1, given as number) : fallback;
  const concurrency = atLeastOne(options.concurrency, UPLOAD_CONCURRENCY);
  const queueCap =
    atLeastOne(options.queuedFrames, QUEUED_FRAMES) * R360_WIDTHS.length;
  const presigned = await transport.presign(frames.length);
  if (!presigned.ok) return presigned;
  const { set } = presigned;

  const progress: FrameSetProgress = {
    framesDone: 0,
    framesTotal: frames.length,
    bytesSent: 0,
    bytesQueued: 0,
    framesLanded: 0,
  };
  const report = () => options.onProgress?.({ ...progress });
  // A frame has landed once its encodings, one per width, both did.
  const landedParts = new Map<number, number>();
  const landed = (ordinal: number) => {
    const parts = (landedParts.get(ordinal) ?? 0) + 1;
    landedParts.set(ordinal, parts);
    if (parts === R360_WIDTHS.length) {
      progress.framesLanded += 1;
      report();
    }
  };
  report();

  /** One encoding of one frame, waiting its turn on the uplink. */
  interface Part {
    url: string;
    blob: Blob;
    ordinal: number;
  }
  // The sender. #122: the queue is where the two rates meet — the
  // producer pushes and carries on, `concurrency` PUTs drain it, and only
  // a full queue stops the producer. Every PUT reports its own fraction;
  // the sum is the bar's byte count.
  const waiting: Part[] = [];
  const inFlight = new Set<Promise<void>>();
  let failure: FrameSetFailure | null = null;
  const send = ({ url, blob, ordinal }: Part) => {
    let sentOfThis = 0;
    // Declared before the PUT starts: a transport reporting progress
    // synchronously must find the task already in the set.
    let task: Promise<void> = Promise.resolve();
    task = transport
      .put(url, blob, {
        signal,
        onProgress: (fraction) => {
          const now = Math.round(fraction * blob.size);
          progress.bytesSent += now - sentOfThis;
          sentOfThis = now;
          report();
        },
      })
      // A transport is supposed to answer rather than throw. One that
      // throws anyway is a failed upload, not a rejected run: the set
      // still has to be abandoned, and `drain` now awaits these.
      .catch((): "failed" => "failed")
      .then((result) => {
        if (result === "ok") landed(ordinal);
        else if (!failure) {
          failure = result === "aborted" ? "aborted" : "upload_failed";
        }
      })
      .finally(() => {
        inFlight.delete(task);
        pump();
      });
    inFlight.add(task);
  };
  /** Starts what the uplink has room for, in the order queued. */
  const pump = () => {
    while (!failure && inFlight.size < concurrency) {
      const next = waiting.shift();
      if (!next) return;
      send(next);
    }
  };
  const enqueue = (part: Part) => {
    progress.bytesQueued += part.blob.size;
    waiting.push(part);
    pump();
  };
  /**
   * The producer's only wait: a queue at its cap. `pump` keeps the uplink
   * as full as it is allowed, so a queue at the cap means there are PUTs
   * in the air to wait for.
   */
  const waitForRoom = async () => {
    while (waiting.length >= queueCap && !failure && inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  };
  /**
   * Everything queued, sent. Waiting on what is in the air is enough to
   * wait for the queue behind it: every PUT that finishes pumps the next.
   */
  const drain = async () => {
    while (!failure && inFlight.size > 0) await Promise.race(inFlight);
    await Promise.allSettled(inFlight);
  };
  const giveUp = async (why: FrameSetFailure): Promise<FrameSetOutcome> => {
    // What has not left yet never will: the prefix is about to go.
    waiting.length = 0;
    await Promise.allSettled(inFlight);
    void transport.abandon(set.stagingPrefix);
    return { ok: false, failure: why };
  };

  for (const [index, frame] of frames.entries()) {
    if (signal?.aborted) return giveUp("aborted");
    if (failure) return giveUp(failure);
    const ordinal = index + 1;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await archive.readEntry(frame);
    } catch {
      return giveUp("read_failed");
    }
    let decoded: DecodedFrame;
    try {
      decoded = await encoder.decode(bytes, frame.name);
    } catch {
      return giveUp("encode_failed");
    }
    // An abort that landed while this frame was decoding: the frame is
    // not handed out — whatever the caller kept of it would have nobody
    // left to free it (#117: a decoded bitmap).
    if (signal?.aborted) {
      decoded.picture.release?.();
      decoded.close();
      return giveUp("aborted");
    }
    let encoded: Record<R360Width, Blob>;
    // Whatever happens between here and the encodings — including a
    // callback of the caller's that throws — the decode is let go of.
    try {
      // #121: the earliest the frame can be seen. Both encodings are
      // still to come, and on an 8K render they are the long part.
      if (options.onPicture) options.onPicture(ordinal, decoded.picture);
      else decoded.picture.release?.();
      encoded = await decoded.encode();
    } catch {
      return giveUp("encode_failed");
    } finally {
      decoded.close();
    }
    for (const width of R360_WIDTHS) {
      const blob = encoded[width];
      if (blob.type !== R360_FRAME_CONTENT_TYPE) {
        return giveUp("webp_unsupported");
      }
      if (blob.size === 0 || blob.size > R360_FRAME_MAX_BYTES[width]) {
        return giveUp("frame_too_large");
      }
    }
    if (signal?.aborted) return giveUp("aborted");
    progress.framesDone = ordinal;
    options.onFrame?.(ordinal, encoded);
    for (const width of R360_WIDTHS) {
      enqueue({ url: set.urls[width][index], blob: encoded[width], ordinal });
    }
    report();
    await waitForRoom();
  }
  await drain();
  if (failure) return giveUp(failure);
  if (signal?.aborted) return giveUp("aborted");
  return {
    ok: true,
    setId: set.setId,
    stagingPrefix: set.stagingPrefix,
    frameCount: frames.length,
  };
}
