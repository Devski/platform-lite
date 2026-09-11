// #102 (A13): the widths a frame is kept at and the format it is kept in.
// A module of its own, with no dependency, because the frame workers need
// these and nothing else (#137): frame-set-shared.ts, which re-exports
// them, also carries the schemas — and every worker would load and parse
// zod for four constants.

/** The two widths kept of every frame (A13); the first is the largest. */
export const R360_WIDTHS = [1600, 800] as const;
export type R360Width = (typeof R360_WIDTHS)[number];

/**
 * The width the owner's own preview shows: the smallest kept. Named here
 * because two sides have to agree on it — the encoder makes the picture
 * at this width (#121) and the form keeps the encoding at this width to
 * decode again after an eviction (#117). Were they to disagree, one
 * ordinal would hold pictures of two sizes and the viewer's canvas would
 * clear itself whenever a frame flipped between them.
 */
export const R360_PREVIEW_WIDTH = R360_WIDTHS[R360_WIDTHS.length - 1];

export const R360_FRAME_CONTENT_TYPE = "image/webp";
