import {
  R360_FRAME_CONTENT_TYPE,
  R360_WIDTHS,
  type R360Width,
} from "./frame-set-shared";
import type { FrameEncoder } from "./frame-pipeline";

// #102 (A13): the one piece of the pipeline that needs a browser — the
// platform's image decoder and its canvas WebP encoder. Each frame is
// decoded once, drawn at every width (aspect kept, never enlarged) and
// encoded; the bitmap is closed before the next frame is read, so one
// frame's pixels are in memory at a time. Untested under Node on purpose:
// there is no canvas there; the pipeline around it is.

/** WebP at this quality is a few hundred kilobytes for a 1600 px render. */
const WEBP_QUALITY = 0.82;

export function browserFrameEncoder(quality = WEBP_QUALITY): FrameEncoder {
  return {
    async encode(bytes) {
      const bitmap = await createImageBitmap(new Blob([bytes.slice()]));
      try {
        const out: Partial<Record<R360Width, Blob>> = {};
        for (const width of R360_WIDTHS) {
          const w = Math.min(width, bitmap.width);
          const h = Math.max(1, Math.round((bitmap.height * w) / bitmap.width));
          out[width] = await draw(bitmap, w, h, quality);
        }
        return out as Record<R360Width, Blob>;
      } finally {
        bitmap.close();
      }
    },
  };
}

async function draw(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    paint(canvas.getContext("2d"), bitmap, width, height);
    return canvas.convertToBlob({ type: R360_FRAME_CONTENT_TYPE, quality });
  }
  // A browser without OffscreenCanvas: the same through a detached element.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), bitmap, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      R360_FRAME_CONTENT_TYPE,
      quality,
    );
  });
}

/** The bitmap drawn to fill the canvas; both canvas kinds share the brush. */
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
