import { browserFrameEncoder, canEncodeWebp } from "./browser-frame-encoder";
import type { DecodedFrame } from "./frame-pipeline";
import type { FromFrameWorker, ToFrameWorker } from "./frame-workers";

// #137 (A13): one frame worker — the page's frame code, run off the page's
// thread. It takes a frame's bytes, answers its picture the moment it is
// decoded (#121) and its WebPs once they are encoded, and lets go of the
// decode. One frame at a time: the pool never sends a second before the
// first is answered. Untested under Node on purpose, like the encoder it
// wraps; the pool around it is, and the e2e suite runs a real archive
// through it in Chromium.

/** The part of a dedicated worker's global scope this file uses. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ToFrameWorker>) => void) | null;
  postMessage(message: FromFrameWorker, transfer?: Transferable[]): void;
}

// The DOM typings describe a window; in here `self` is the worker's scope.
const scope = self as unknown as WorkerScope;
const encoder = browserFrameEncoder();

scope.onmessage = ({ data }) => {
  void answer(data);
};

async function answer(message: ToFrameWorker): Promise<void> {
  if (message.type === "probe") {
    scope.postMessage({ type: "probe", webp: await canEncodeWebp() });
    return;
  }
  const { id } = message;
  let decoded: DecodedFrame;
  try {
    decoded = await encoder.decode(message.bytes, message.name);
  } catch {
    scope.postMessage({ type: "failed", id });
    return;
  }
  let handedOver = false;
  try {
    // Handed over, not copied: from here the picture is the page's to
    // close, which the pipeline leaves to whoever it gives it to.
    const picture = decoded.picture.source as ImageBitmap;
    scope.postMessage(
      {
        type: "picture",
        id,
        picture,
        sourcePixels: decoded.sourcePixels ?? null,
      },
      [picture],
    );
    handedOver = true;
    scope.postMessage({ type: "encoded", id, encoded: await decoded.encode() });
  } catch {
    // A picture that never left is still this worker's to free.
    if (!handedOver) decoded.picture.release?.();
    scope.postMessage({ type: "failed", id });
  } finally {
    decoded.close();
  }
}
