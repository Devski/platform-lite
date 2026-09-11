import { pictureBytes } from "./frame-pictures";
import type { DecodedFrame, FrameEncoder, FrameSize } from "./frame-pipeline";
import type { R360Width } from "./frame-widths";

// #137 (A13): the frames made on the machine's other cores. Every step of
// making a frame — the decode, the resize, both WebP encodes — used to run
// on the page's own thread, one frame at a time, while the cores beside it
// stood idle. Measured on 11.09.2026 with the form's own frame code
// (Chromium 152, a 20-core laptop, sixteen frames): four workers made a
// 4K frame 3.1 times as fast as one and a 1080p one 3.0 times, with the
// page never held up for more than 17 ms; four frames started at once on
// the page's thread managed 3.1 and 2.1, and held the page up for 150 ms
// at a time — a drag across the preview would stutter. So: workers, and a
// pool of them.
//
// This file is the pool, and nothing in it needs a browser: the workers
// arrive through `spawn`, so the dispatch, the message routing and the
// ways a run ends are tested with fakes. The worker itself is
// frame-worker.ts; frame-encoder.ts puts the two together.

/** What the page sends a frame worker. */
export type ToFrameWorker =
  | { type: "probe" }
  | { type: "frame"; id: number; bytes: Uint8Array<ArrayBuffer>; name: string };

/** What a frame worker answers. */
export type FromFrameWorker =
  | { type: "probe"; webp: boolean }
  /** The frame decoded (#121): the picture, handed over, not copied. */
  | {
      type: "picture";
      id: number;
      picture: ImageBitmap;
      sourcePixels: number | null;
    }
  | { type: "encoded"; id: number; encoded: Record<R360Width, Blob> }
  /** The frame could not be decoded, or — after its picture — encoded. */
  | { type: "failed"; id: number };

/** One worker, as the pool drives it. */
export interface FrameWorker {
  post(message: ToFrameWorker, transfer: Transferable[]): void;
  terminate(): void;
}

/** Starts a worker that reports to these two. */
export type SpawnFrameWorker = (listeners: {
  message: (message: FromFrameWorker) => void;
  /** The worker died, or never started: its script failed to load. */
  error: () => void;
}) => FrameWorker;

/**
 * Four at most. The gain measured above flattens past four (3.1 times at
 * four lanes, 3.7 at six, 4.3 at eight), and every lane is one more frame's
 * pixels held at once — which on a phone is the number that matters.
 */
export const MAX_FRAME_LANES = 4;

/** A decoded pixel: four bytes, held whole before the resize. */
const BYTES_PER_DECODED_PIXEL = 4;

/**
 * Copies of a frame's file one lane holds while it decodes: the bytes
 * handed to the worker, the Blob made of them for the decoder, and the
 * browser's own read of that Blob.
 */
const FILE_COPIES_PER_LANE = 3;

/** The share of the device's memory the lanes may take: a sixteenth. */
const LANE_BUDGET_PER_GB = 64 * 1024 * 1024;

/**
 * A device that does not say how much memory it has — Firefox, on a phone
 * too — is given a 4 GB budget and never more than this many lanes, since
 * the phone it may be cannot tell us so.
 */
const UNKNOWN_MEMORY_LANES = 2;

export interface Device {
  /** `navigator.hardwareConcurrency`. */
  cores?: number;
  /**
   * `navigator.deviceMemory`, in gigabytes — Chromium only, rounded down
   * and capped at 8.
   */
  memoryGb?: number;
}

/** The value when it is a usable count — finite and above zero. */
const positiveOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

/** The most frames this device makes at once: a core is left for the page. */
export function maxFrameLanes(device: Device): number {
  const cores = Math.floor(positiveOr(device.cores, 2));
  return Math.max(1, Math.min(MAX_FRAME_LANES, cores - 1));
}

/**
 * Frames of this size the device makes at once: as many as its cores
 * allow and its memory can hold while they decode. A frame of unknown size
 * is made alone — an 8K render decoded whole is 130 MB.
 */
export function frameLanes(device: Device, size: FrameSize): number {
  const { sourcePixels } = size;
  if (sourcePixels === null || !(sourcePixels > 0)) return 1;
  const lane =
    sourcePixels * BYTES_PER_DECODED_PIXEL +
    Math.max(0, size.fileBytes) * FILE_COPIES_PER_LANE;
  const memoryGb = positiveOr(device.memoryGb, 0);
  const byMemory =
    memoryGb > 0
      ? Math.floor((memoryGb * LANE_BUDGET_PER_GB) / lane)
      : Math.min(
          UNKNOWN_MEMORY_LANES,
          Math.floor((4 * LANE_BUDGET_PER_GB) / lane),
        );
  return Math.max(1, Math.min(maxFrameLanes(device), byMemory));
}

/** An encoder on workers, owned by the run that opened it. */
export interface FramePool extends FrameEncoder {
  /**
   * Whether a worker starts at all and its canvas encodes WebP: true or
   * false as the worker answers, null when it never did — its script did
   * not load, or not within `timeoutMs`.
   */
  probe(timeoutMs: number): Promise<boolean | null>;
  /** Stops every worker; whatever was still being made fails. */
  dispose(): void;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: Error): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

interface Job {
  id: number;
  bytes: Uint8Array<ArrayBuffer>;
  name: string;
  decoded: Deferred<DecodedFrame>;
  encoded: Deferred<Record<R360Width, Blob>>;
  pictured: boolean;
}

interface Slot {
  worker: FrameWorker;
  job: Job | null;
}

/**
 * Up to `maxWorkers` workers, started as frames need them — the first
 * frame runs alone, so a run whose frames are too large for a second lane
 * never starts one. A worker takes one frame at a time and is free again
 * once the frame is encoded; frames beyond the free workers wait in order.
 */
export function framePool(options: {
  spawn: SpawnFrameWorker;
  maxWorkers: number;
  lanesFor: (size: FrameSize) => number;
}): FramePool {
  const maxWorkers = Math.max(1, Math.floor(positiveOr(options.maxWorkers, 1)));
  const slots: Slot[] = [];
  const waiting: Job[] = [];
  let lastId = 0;
  let closed: Error | null = null;
  let answerProbe: ((webp: boolean | null) => void) | null = null;

  /** Every frame not yet encoded fails, and no worker is left running. */
  const close = (reason: Error) => {
    if (closed) return;
    closed = reason;
    answerProbe?.(null);
    const jobs = [
      ...slots.flatMap((slot) => (slot.job ? [slot.job] : [])),
      ...waiting,
    ];
    waiting.length = 0;
    for (const slot of slots) {
      slot.job = null;
      slot.worker.terminate();
    }
    for (const job of jobs) fail(job);
  };

  const fail = (job: Job) => {
    const reason = closed ?? new Error(`frame ${job.name} failed`);
    if (job.pictured) job.encoded.reject(reason);
    else job.decoded.reject(reason);
  };

  const receive = (slot: Slot, message: FromFrameWorker) => {
    if (message.type === "probe") {
      answerProbe?.(message.webp);
      return;
    }
    const job = slot.job;
    if (!job || job.id !== message.id) {
      // Not the frame this worker is on — nothing sends one, but a picture
      // that nobody will take still holds its pixels until it is closed.
      if (message.type === "picture") message.picture.close();
      return;
    }
    if (message.type === "picture") {
      const bitmap = message.picture;
      job.pictured = true;
      job.decoded.resolve({
        picture: {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          bytes: pictureBytes(bitmap.width, bitmap.height),
          release: () => bitmap.close(),
        },
        sourcePixels: message.sourcePixels,
        encode: () => job.encoded.promise,
        // The worker let go of its decode as soon as it had encoded.
        close() {},
      });
      return;
    }
    slot.job = null;
    // Encodings with no picture before them — the worker never sends that,
    // but taken as they come the decode would wait for a picture forever.
    if (message.type === "encoded" && job.pictured) {
      job.encoded.resolve(message.encoded);
    } else fail(job);
    dispatch();
  };

  const spawn = (): Slot | null => {
    let slot: Slot | null = null;
    try {
      const worker = options.spawn({
        message: (message) => {
          if (slot) receive(slot, message);
        },
        error: () => close(new Error("a frame worker failed")),
      });
      slot = { worker, job: null };
    } catch {
      close(new Error("a frame worker could not be started"));
      return null;
    }
    slots.push(slot);
    return slot;
  };

  /** Hands the waiting frames to free workers, starting more if allowed. */
  const dispatch = () => {
    while (!closed) {
      const job = waiting[0];
      if (!job) return;
      const slot =
        slots.find((s) => s.job === null) ??
        (slots.length < maxWorkers ? spawn() : null);
      if (!slot) return;
      waiting.shift();
      slot.job = job;
      // The bytes go to the worker, not a copy of them: the page never
      // reads a frame's bytes again once they are handed to the encoder.
      slot.worker.post(
        { type: "frame", id: job.id, bytes: job.bytes, name: job.name },
        [job.bytes.buffer],
      );
    }
  };

  return {
    decode(bytes, name) {
      if (closed) return Promise.reject(closed);
      const job: Job = {
        id: ++lastId,
        bytes,
        name,
        decoded: deferred(),
        encoded: deferred(),
        pictured: false,
      };
      // An encoding nobody asks for — the run gave up first — fails
      // quietly instead of as an unhandled rejection.
      job.encoded.promise.catch(() => {});
      waiting.push(job);
      dispatch();
      return job.decoded.promise;
    },

    lanes(size) {
      return Math.min(maxWorkers, options.lanesFor(size));
    },

    probe(timeoutMs) {
      if (closed) return Promise.resolve(null);
      const slot = slots[0] ?? spawn();
      if (!slot) return Promise.resolve(null);
      return new Promise((resolve) => {
        const timer = setTimeout(() => answer(null), timeoutMs);
        const answer = (webp: boolean | null) => {
          clearTimeout(timer);
          answerProbe = null;
          resolve(webp);
        };
        answerProbe = answer;
        slot.worker.post({ type: "probe" }, []);
      });
    },

    dispose() {
      close(new Error("the frame pool was closed"));
    },
  };
}
