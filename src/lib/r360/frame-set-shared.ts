import { z } from "zod";
import { R360_MAX_FRAMES, R360_MIN_FRAMES } from "./frame-names";

// #102 (step 3 of #68, A13): what the browser and the server agree on
// about a frame set — the widths, the ceilings, the keys, the viewer's
// parameters. Client-safe: no storage, no database.

/** The two widths kept of every frame (A13); the first is the largest. */
export const R360_WIDTHS = [1600, 800] as const;
export type R360Width = (typeof R360_WIDTHS)[number];

export const R360_FRAME_CONTENT_TYPE = "image/webp";

/**
 * Ceilings per frame, per width. A rendered frame at 1600 px encodes to a
 * few hundred kilobytes of WebP; the ceilings leave room for a noisy one
 * and still bound what the save verifies and the reservation counts.
 */
export const R360_FRAME_MAX_BYTES: Record<R360Width, number> = {
  1600: 1024 * 1024,
  800: 384 * 1024,
};

/** The set id the server mints: 16 random bytes, in hex. */
export const R360_SET_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Bytes the reservation counts for a set: every frame at its ceilings. */
export function frameSetBytesCeiling(frameCount: number): number {
  return (
    frameCount *
    R360_WIDTHS.reduce((sum, w) => sum + R360_FRAME_MAX_BYTES[w], 0)
  );
}

/** The frame's ordinal in the set, 1..N, as three zero-padded digits. */
export function frameOrdinal(ordinal: number): string {
  return String(ordinal).padStart(3, "0");
}

/** Where the browser PUTs the frames: under staging, swept like any upload. */
export function frameSetStagingPrefix(
  prefix: string,
  userId: string,
  setId: string,
): string {
  return `${prefix}staging/${userId}/${setId}/`;
}

/** Where the frames live once the work is saved (SPEC §9). */
export function frameSetPrefix(
  prefix: string,
  userId: string,
  setId: string,
): string {
  return `${prefix}u/${userId}/r360/${setId}/`;
}

/** Every frame's public address at one width, `urls[ordinal - 1]` (#104). */
export function frameUrls(
  frameBase: string,
  width: R360Width,
  frameCount: number,
): string[] {
  return Array.from({ length: frameCount }, (_, i) =>
    frameUrl(frameBase, width, i + 1),
  );
}

/** A frame's public address from the work's `frameBase` (#104). */
export function frameUrl(
  frameBase: string,
  width: R360Width,
  ordinal: number,
): string {
  return frameKey(frameBase, width, ordinal);
}

/** One frame's key under either prefix: `<width>/<ordinal>.webp`. */
export function frameKey(
  base: string,
  width: R360Width,
  ordinal: number,
): string {
  return `${base}${width}/${frameOrdinal(ordinal)}.webp`;
}

/**
 * The 2N (width, ordinal) pairs of a set, in the order the presign answers
 * them and the save checks them: every ordinal of the first width, then of
 * the second.
 */
export function frameSlots(
  frameCount: number,
): { width: R360Width; ordinal: number }[] {
  return R360_WIDTHS.flatMap((width) =>
    Array.from({ length: frameCount }, (_, i) => ({ width, ordinal: i + 1 })),
  );
}

const frameCountSchema = z
  .number()
  .int()
  .min(R360_MIN_FRAMES)
  .max(R360_MAX_FRAMES);

/**
 * The five viewer parameters (#68), as stored in works.r360_params. The
 * frame count is detected, not chosen; the other four are the owner's.
 */
export const r360ParamsSchema = z
  .object({
    frameCount: frameCountSchema,
    direction: z.union([z.literal(1), z.literal(-1)]),
    framesPerWidth: z.number().int().min(1).max(R360_MAX_FRAMES),
    startFrame: z.number().int().min(1).max(R360_MAX_FRAMES),
    flattening: z.number().min(0.15).max(1),
  })
  .refine(
    (p) => p.framesPerWidth <= p.frameCount && p.startFrame <= p.frameCount,
    { message: "within the frame count" },
  );
export type R360Params = z.infer<typeof r360ParamsSchema>;

/** The defaults of #68's table: a half turn per picture width, a circle. */
export function defaultR360Params(frameCount: number): R360Params {
  return {
    frameCount,
    direction: 1,
    framesPerWidth: Math.max(1, Math.round(frameCount / 2)),
    startFrame: 1,
    flattening: 1,
  };
}

export const presignFrameSetSchema = z.object({ frameCount: frameCountSchema });

/** What the batch presign answers: 2N URLs, by width, in ordinal order. */
export interface FrameSetPresign {
  setId: string;
  stagingPrefix: string;
  /** `urls[width][ordinal - 1]` */
  urls: Record<R360Width, string[]>;
}
