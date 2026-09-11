import { z } from "zod";
import { R360_MAX_FRAMES, R360_MIN_FRAMES } from "./frame-names";
import { R360_WIDTHS, type R360Width } from "./frame-widths";

// #102 (step 3 of #68, A13): what the browser and the server agree on
// about a frame set — the widths, the ceilings, the keys, the viewer's
// parameters. Client-safe: no storage, no database.

export {
  R360_FRAME_CONTENT_TYPE,
  R360_PREVIEW_WIDTH,
  R360_WIDTHS,
  type R360Width,
} from "./frame-widths";

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
  return `${frameSetOwnerPrefix(prefix, userId)}${setId}/`;
}

/** Every frame set of one owner, in this environment: the sweep's range. */
export function frameSetOwnerPrefix(prefix: string, userId: string): string {
  return `${prefix}u/${userId}/r360/`;
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

/** #107: the most cue points a work carries, and a cue's longest label. */
export const R360_CUES_MAX = 12;
export const R360_CUE_LABEL_MAX = 40;

/** A work's name's rule (work-schemas.ts): no control or format characters. */
const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u;

/** #107: a labelled frame the visitor reaches from the ring or a button. */
const cueSchema = z.object({
  frame: z.number().int().min(1).max(R360_MAX_FRAMES),
  label: z
    .string()
    .normalize("NFC")
    .trim()
    .min(1)
    .max(R360_CUE_LABEL_MAX)
    .regex(NO_CONTROL_OR_FORMAT),
});
export type R360Cue = z.infer<typeof cueSchema>;

/**
 * The viewer parameters (#68), as stored in works.r360_params. The frame
 * count is detected, not chosen; the other four are the owner's, and so
 * are the cue points (#107) — optional, so a work saved before them reads
 * as a work with none.
 */
export const r360ParamsSchema = z
  .object({
    frameCount: frameCountSchema,
    direction: z.union([z.literal(1), z.literal(-1)]),
    framesPerWidth: z.number().int().min(1).max(R360_MAX_FRAMES),
    startFrame: z.number().int().min(1).max(R360_MAX_FRAMES),
    flattening: z.number().min(0.15).max(1),
    cues: z.array(cueSchema).max(R360_CUES_MAX).optional(),
  })
  .refine(
    (p) => p.framesPerWidth <= p.frameCount && p.startFrame <= p.frameCount,
    { message: "within the frame count" },
  )
  .refine(
    (p) =>
      !p.cues ||
      (p.cues.every((cue) => cue.frame <= p.frameCount) &&
        new Set(p.cues.map((cue) => cue.frame)).size === p.cues.length),
    { message: "one cue a frame, within the frame count", path: ["cues"] },
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

/**
 * Whether the parameters are the defaults for their count, untouched and
 * without cue points — nothing of the owner's in them to keep (#107).
 */
export function isDefaultR360Params(params: R360Params): boolean {
  const defaults = defaultR360Params(params.frameCount);
  return (
    params.direction === defaults.direction &&
    params.framesPerWidth === defaults.framesPerWidth &&
    params.startFrame === defaults.startFrame &&
    params.flattening === defaults.flattening &&
    !params.cues?.length
  );
}

export const presignFrameSetSchema = z.object({ frameCount: frameCountSchema });

/** What the batch presign answers: 2N URLs, by width, in ordinal order. */
export interface FrameSetPresign {
  setId: string;
  keyPrefix: string;
  /** `urls[width][ordinal - 1]` */
  urls: Record<R360Width, string[]>;
}
