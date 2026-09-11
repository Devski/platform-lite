import { pictureBytes } from "./frame-pictures";
import {
  R360_FRAME_CONTENT_TYPE,
  R360_PREVIEW_WIDTH,
  R360_WIDTHS,
  type R360Width,
} from "./frame-widths";
import type { DecodedFrame, FrameEncoder } from "./frame-pipeline";

// #102 (A13): the one piece of the pipeline that needs a browser — the
// platform's image decoder and its canvas WebP encoder. Each frame is
// decoded once, at the largest width kept (an 8K render decoded whole is
// a hundred megabytes of pixels — the decoder is asked for 1600 wide, #102
// review), drawn at every width (aspect kept, never enlarged) and encoded;
// the decode is closed as soon as both are, so an encoder holds one frame's
// pixels at a time. Since #137 it usually runs in a worker, several of them
// side by side (frame-worker.ts), and says how large its frame was so the
// pool knows how many fit in memory at once. Untested under Node on
// purpose: there is no canvas there; the pipeline around it is.
//
// #121: the decode also yields a PICTURE, at the preview's width, handed
// back before either WebP is encoded. It costs one more draw — a resize
// blit — and saves the preview both encodes and a decode of its own: the
// form used to wait for the 1600 and the 800 WebP and then decode the 800
// again to paint it.

/** WebP at this quality is a few hundred kilobytes for a 1600 px render. */
const WEBP_QUALITY = 0.82;

type Canvas = OffscreenCanvas | HTMLCanvasElement;

export function browserFrameEncoder(quality = WEBP_QUALITY): FrameEncoder {
  return {
    async decode(bytes): Promise<DecodedFrame> {
      const largest = R360_WIDTHS[0];
      const native = imageWidthOf(bytes);
      const bitmap = await createImageBitmap(new Blob([bytes]), {
        // Not enlarged: a frame narrower than 1600 decodes at its own size.
        resizeWidth: Math.min(largest, native ?? largest),
        resizeQuality: "high",
      });
      let open = true;
      const close = () => {
        if (!open) return;
        open = false;
        bitmap.close();
      };
      try {
        const width = Math.min(R360_PREVIEW_WIDTH, bitmap.width);
        const height = heightFor(bitmap, width);
        const shown = await createImageBitmap(painted(bitmap, width, height));
        return {
          picture: {
            source: shown,
            width: shown.width,
            height: shown.height,
            bytes: pictureBytes(shown.width, shown.height),
            release: () => shown.close(),
          },
          // The decode kept the aspect, so the source's height follows
          // from its width and the decoded shape.
          sourcePixels: native ? native * heightFor(bitmap, native) : null,
          close,
          async encode() {
            const out: Partial<Record<R360Width, Blob>> = {};
            for (const each of R360_WIDTHS) {
              const w = Math.min(each, bitmap.width);
              out[each] = await encodeCanvas(
                painted(bitmap, w, heightFor(bitmap, w)),
                quality,
              );
            }
            return out as Record<R360Width, Blob>;
          },
        };
      } catch (error) {
        close();
        throw error;
      }
    },
  };
}

/**
 * Whether this browser's canvas encodes WebP at all — Safari's answers a
 * PNG to a request for WebP. Asked once, before a set is presigned, so a
 * browser that cannot deliver takes no reservation (#102 review).
 */
export async function canEncodeWebp(): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(new ImageData(1, 1));
    const blob = await encodeCanvas(painted(bitmap, 1, 1), WEBP_QUALITY);
    bitmap.close();
    return blob.type === R360_FRAME_CONTENT_TYPE;
  } catch {
    return false;
  }
}

/**
 * The pixel width in the file's header — PNG, JPEG or WebP, the three
 * formats a frame may be (frame-names.ts) — or null when the header is
 * not one of theirs. Enough to size the decode; the decoder is the judge.
 */
export function imageWidthOf(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  // PNG: the IHDR chunk follows the 8-byte signature; width at 16.
  if (bytes.length >= 24 && ascii(1, 3) === "PNG") {
    return view.getUint32(16, false);
  }
  // WebP: after RIFF/WEBP a VP8X (canvas width at 24, 24-bit minus one),
  // VP8L (14 bits at 21) or VP8 (16 bits at 26, low 14) chunk.
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return 1 + (view.getUint32(24, true) & 0xffffff);
    if (chunk === "VP8L") return 1 + (view.getUint16(21, true) & 0x3fff);
    if (chunk === "VP8 ") return view.getUint16(26, true) & 0x3fff;
    return null;
  }
  // JPEG: walk the markers to the first start-of-frame; width at +7.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        at += 2;
        continue;
      }
      const length = view.getUint16(at + 2, false);
      const startOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (startOfFrame) return view.getUint16(at + 7, false);
      at += 2 + length;
    }
  }
  return null;
}

/** The height that keeps the aspect at a width, never below one pixel. */
function heightFor(bitmap: ImageBitmap, width: number): number {
  return Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
}

/**
 * #137: every canvas here is kept in the processor's memory, not the
 * graphics card's. A picture drawn on a worker's GPU canvas belongs to that
 * worker's GPU context, and the pool stops its workers when a run ends:
 * measured on 11.09.2026 (Intel Iris Xe, Direct3D 11), a preview picture
 * handed over from a worker read back as transparent black the moment its
 * worker was terminated, and the same picture from a canvas asked for
 * `willReadFrequently` survived it. It costs nothing measurable — within
 * 2% over eight 4K frames, on one lane and on four, the WebP byte for byte
 * the same — since the WebP encoder reads the pixels back from the card
 * anyway.
 */
const CANVAS_OPTIONS: CanvasRenderingContext2DSettings = {
  willReadFrequently: true,
};

/** The bitmap drawn to fill a canvas of this size; both canvas kinds. */
function painted(bitmap: ImageBitmap, width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    paint(canvas.getContext("2d", CANVAS_OPTIONS), bitmap, width, height);
    return canvas;
  }
  // A browser without OffscreenCanvas: the same through a detached element.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d", CANVAS_OPTIONS), bitmap, width, height);
  return canvas;
}

async function encodeCanvas(canvas: Canvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: R360_FRAME_CONTENT_TYPE, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      R360_FRAME_CONTENT_TYPE,
      quality,
    );
  });
}

/** The brush both canvas kinds share. */
function paint(
  context: (CanvasDrawImage & CanvasImageSmoothing) | null,
  bitmap: ImageBitmap,
  width: number,
  height: number,
): void {
  if (!context) throw new Error("no 2d context");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
}
