import { browserFrameEncoder, canEncodeWebp } from "./browser-frame-encoder";
import type { FrameEncoder } from "./frame-pipeline";
import {
  framePool,
  frameLanes,
  maxFrameLanes,
  type Device,
  type SpawnFrameWorker,
} from "./frame-workers";

// #137 (A13): the encoder an owner's browser makes its frames with —
// workers where it has them, the page's own thread where it does not. The
// fallback is the pipeline as it was before #137, not a lesser one: every
// browser that could make a set yesterday still can.

/** An encoder the run owns, and lets go of when the run ends. */
export type OwnedFrameEncoder = FrameEncoder & { dispose(): void };

/**
 * How long a worker gets to start and answer. Its script is small and
 * local; a worker that says nothing for this long is not going to be the
 * faster way.
 */
const PROBE_TIMEOUT_MS = 10_000;

const spawnFrameWorker: SpawnFrameWorker = ({ message, error }) => {
  // Written out in full so the bundler sees the worker and emits it as a
  // file of our own origin — the only kind the CSP lets a page start.
  const worker = new Worker(new URL("./frame-worker.ts", import.meta.url), {
    type: "module",
    name: "r360-frames",
  });
  worker.onmessage = (event) => message(event.data);
  worker.onerror = () => error();
  worker.onmessageerror = () => error();
  return {
    post: (data, transfer) => worker.postMessage(data, transfer),
    terminate: () => worker.terminate(),
  };
};

/**
 * Opens the encoder for one run: a pool of workers when a worker starts
 * and its canvas encodes WebP, the page's own thread when not — and null
 * when neither can encode WebP, which is a browser that cannot make a set.
 */
export async function openFrameEncoder(): Promise<OwnedFrameEncoder | null> {
  if (typeof Worker !== "undefined") {
    const device: Device = {
      cores: navigator.hardwareConcurrency,
      memoryGb: (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory,
    };
    const pool = framePool({
      spawn: spawnFrameWorker,
      maxWorkers: maxFrameLanes(device),
      lanesFor: (size) => frameLanes(device, size),
    });
    if ((await pool.probe(PROBE_TIMEOUT_MS)) === true) return pool;
    pool.dispose();
  }
  if (!(await canEncodeWebp())) return null;
  return Object.assign(browserFrameEncoder(), { dispose() {} });
}
