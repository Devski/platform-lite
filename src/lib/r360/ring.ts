import { shortestTurn, wrapFrame, type OrbitParams } from "./orbit";

// #106 (A13, #68 decision 2): the ring dial's geometry. A circle flattened
// to the elevation the render camera had (f from 0.15 to 1, 1 = a circle),
// the start frame at the bottom — nearest the viewer — and the frames laid
// around it in the work's direction. The ring is absolute: the pointer's
// angle picks the frame. Pure; the component is a hand on it.

/** Flattening: 1 is a circle, 0.15 the flattest ring allowed. */
export const RING_MIN_FLATTENING = 0.15;

/**
 * Which way the frames are laid on the ring, for the same drag and the
 * same work (#124). The work's own `direction` flips the PICTURE, frames
 * and all; this flips only the dial's sense of which way round the screen
 * the numbers grow. Asked for by Dawid on 10.09.2026 — a question about
 * which way reads as right when you are watching a building turn.
 */
const RING_SENSE = -1;

/**
 * The angle of a frame on the ring, in radians, from the bottom — where
 * the start frame sits. Positive is clockwise on screen (`ringPoint`), and
 * since #124 the frames run the other way: a work whose direction is +1
 * lays its numbers ANTICLOCKWISE, so the angles here are negative.
 */
export function angleOfFrame(frame: number, params: OrbitParams): number {
  const { frameCount, startFrame } = params;
  const steps = wrapFrame(frame - startFrame + 1, frameCount) - 1;
  return steps * frameAngleStep(params);
}

/**
 * One frame's worth of angle, signed by the work's direction and by the
 * ring's own sense (#124). Every other function here reads the mapping
 * from this one and `frameAtAngle`, which is why flipping it turns the
 * dot, the arc, the travel on a click and the pointer's reading together
 * — a dial whose halves disagreed would simply lie.
 */
export function frameAngleStep(params: OrbitParams): number {
  return (RING_SENSE * params.direction * 2 * Math.PI) / params.frameCount;
}

/** The frame at an angle from the bottom — the nearest one. */
export function frameAtAngle(angle: number, params: OrbitParams): number {
  const { frameCount, direction, startFrame } = params;
  const turns = (angle / (2 * Math.PI)) * frameCount;
  const steps = Math.round(RING_SENSE * direction * turns);
  return wrapFrame(startFrame + steps, frameCount);
}

/** Where an angle lands on an ellipse of the given radii, y down. */
export function ringPoint(
  angle: number,
  radiusX: number,
  radiusY: number,
): { x: number; y: number } {
  // Angle 0 is the bottom (y = +radiusY), growing clockwise on screen.
  return { x: -Math.sin(angle) * radiusX, y: Math.cos(angle) * radiusY };
}

/**
 * The angle a pointer at (x, y) — relative to the ring's centre — points
 * at, on an ellipse of the given radii: the ellipse is unsquashed first,
 * so a flat ring reads the pointer the way the picture does.
 */
export function angleOfPoint(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): number {
  const angle = Math.atan2(-x / radiusX, y / radiusY);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

/**
 * The frames a click travels through, from one frame to another along the
 * shorter arc (#68: a tie goes the work's direction), the destination
 * last; an empty list when already there.
 */
export function travelPath(
  from: number,
  to: number,
  params: OrbitParams,
): number[] {
  const { frameCount, direction } = params;
  const turn = shortestTurn(from, to, frameCount);
  // A tie — half the orbit either way — comes back from shortestTurn as +;
  // the work's direction decides it here.
  const signed = Math.abs(turn) * 2 === frameCount ? direction * turn : turn;
  const step = Math.sign(signed);
  return Array.from({ length: Math.abs(signed) }, (_, i) =>
    wrapFrame(from + step * (i + 1), frameCount),
  );
}

/** A stretch of consecutive loaded frames, possibly across the wrap. */
export interface LoadedRun {
  from: number;
  to: number;
  /** Frames in it, 1..N — not derivable from `from` and `to` at the wrap. */
  length: number;
}

/**
 * #117: the loaded frames as ARCS along the ring, not as ticks across it.
 * Sixty ticks on a ring 200 wide is a comb, and a comb says nothing about
 * where the gaps are (Dawid, 09.09.2026). Consecutive frames become one
 * thick arc, a lone frame a round dot at its angle — so the ring reads as
 * a progress bar bent into a circle.
 *
 * Runs are found around the wrap, so a set loaded from the start frame
 * outwards is one arc rather than two. The whole orbit is one closed run.
 */
export function loadedRuns(
  loaded: ReadonlySet<number>,
  frameCount: number,
): LoadedRun[] {
  if (loaded.size === 0) return [];
  if (loaded.size >= frameCount) {
    return [{ from: 1, to: frameCount, length: frameCount }];
  }
  const runs: LoadedRun[] = [];
  for (let frame = 1; frame <= frameCount; frame++) {
    if (!loaded.has(frame)) continue;
    // A run starts where the frame before it is missing; the wrap makes
    // the last frame the one before the first. At least one frame is
    // missing here (the whole orbit returned above), so the walk stops.
    if (loaded.has(wrapFrame(frame - 1, frameCount))) continue;
    let last = frame;
    // The bound is belt and braces: a gap exists (the whole orbit returned
    // above), so `has` stops the walk — unless a caller pairs a loaded set
    // with a frame count it does not belong to.
    while (
      loaded.has(wrapFrame(last + 1, frameCount)) &&
      last - frame < frameCount
    ) {
      last += 1;
    }
    runs.push({
      from: frame,
      to: wrapFrame(last, frameCount),
      length: last - frame + 1,
    });
  }
  return runs;
}

/** How finely an arc is sampled: a point every few degrees is smooth. */
const ARC_STEP_RADIANS = (4 * Math.PI) / 180;

/** Where two frames sit apart from each other on the ring, in pixels. */
function gapBetween(
  from: number,
  to: number,
  params: OrbitParams,
  radiusX: number,
  radiusY: number,
): number {
  const a = ringPoint(angleOfFrame(from, params), radiusX, radiusY);
  const b = ringPoint(angleOfFrame(to, params), radiusX, radiusY);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Runs whose gap the stroke closes anyway, joined into one (#125).
 * Measured between the actual endpoints, so it follows the ellipse: on a
 * flattened ring the same number of missing frames is a wide gap at the
 * ends and nothing at all along the flat, and this joins exactly the ones
 * that cannot be seen.
 *
 * The arc then over-reports by at most a gap nobody could make out, and
 * in exchange it reads as a band filling rather than as beads.
 */
function joinInvisibleGaps(
  runs: readonly LoadedRun[],
  params: OrbitParams,
  radiusX: number,
  radiusY: number,
  strokeWidth: number,
): LoadedRun[] {
  // One run is not a special case: its own gap, at the wrap, is the one
  // that shows when a set is a single frame short.
  if (strokeWidth <= 0 || runs.length === 0) return [...runs];
  // The ink gap is the distance less the two caps that reach into it;
  // it stops reading as a gap once it is thinner than the line.
  const joinUnderPx = 2 * strokeWidth;
  const { frameCount } = params;
  const endOf = (run: LoadedRun) =>
    wrapFrame(run.from + run.length - 1, frameCount);
  const joined: LoadedRun[] = [];
  for (const run of runs) {
    const last = joined[joined.length - 1];
    const gapFrames = last
      ? wrapFrame(run.from - endOf(last), frameCount)
      : Infinity;
    if (
      last &&
      gapBetween(endOf(last), run.from, params, radiusX, radiusY) < joinUnderPx
    ) {
      last.length += gapFrames + run.length - 1;
      continue;
    }
    joined.push({ ...run });
  }
  // The wrap: the last run's end may sit against the first run's start.
  const first = joined[0];
  const last = joined[joined.length - 1];
  if (
    joined.length > 1 &&
    gapBetween(endOf(last), first.from, params, radiusX, radiusY) < joinUnderPx
  ) {
    const gapFrames = wrapFrame(first.from - endOf(last), frameCount);
    joined.pop();
    joined[0] = {
      from: last.from,
      to: first.to,
      length: last.length + gapFrames + first.length - 1,
    };
  }
  // One run that all but closes the ring has a gap too — its own, at the
  // wrap — and the loop above never looks at it, because there is no
  // second run to compare it with. A single frame missing from a set of
  // 120 is 4 px on the card's ring, less than the stroke that draws it, so
  // it read as a nick in an otherwise full circle: "zawsze zostaje taki
  // punkcik w tym kole kiedy wszystko już jest załadowane" (Dawid,
  // 10.09.2026). Wider than the rule allows, it stays visible.
  if (
    joined.length === 1 &&
    joined[0].length < frameCount &&
    gapBetween(endOf(joined[0]), joined[0].from, params, radiusX, radiusY) <
      joinUnderPx
  ) {
    joined[0].length = frameCount;
  }
  for (const run of joined) run.length = Math.min(run.length, frameCount);
  return joined;
}

/**
 * An SVG path along the ring through every run: sampled around the
 * ellipse rather than drawn with arc flags, so one expression covers a
 * flattened ring, a run of one frame (a dot under a round cap) and a
 * complete orbit alike.
 */
export function loadedRunsPath(
  runs: readonly LoadedRun[],
  params: OrbitParams,
  radiusX: number,
  radiusY: number,
  /**
   * #125: the width the caller strokes this path with, and with it the
   * arithmetic of what a gap LOOKS like. Two runs whose frames are
   * `distance` apart are drawn with a round cap each, and a cap reaches
   * half a stroke towards the other — so the gap that reaches the eye is
   * `distance - strokeWidth`. When that is thinner than the line itself
   * the gap does not read as a gap: it reads as a lump in the band. Those
   * are joined, and the arc over-reports by exactly what nobody can see.
   *
   * This is what made the arc "go strange after a while" (Dawid, on the
   * #117 preview, 09.09.2026). The loading order is 8, 4, 2, 1
   * (`loadingOrder`), so EVERY orbit passes through "every other frame" on
   * its way to full. Measured on the card's 160 px ring with 120 frames:
   * 60 subpaths, each a lone frame drawn as a 5 px dot, centres 8.4 px
   * apart on a circle — 3.4 px of ink gap between 5 px blobs — and 1.3 px
   * apart on a ring flattened to 0.15, where they overlap into a sausage
   * with a scalloped edge. Zero leaves every gap drawn, as before.
   */
  strokeWidth = 0,
): string {
  const parts: string[] = [];
  for (const run of joinInvisibleGaps(
    runs,
    params,
    radiusX,
    radiusY,
    strokeWidth,
  )) {
    const from = angleOfFrame(run.from, params);
    // A full orbit closes the ring rather than stopping one frame short
    // of itself; any other run spans the gaps between its frames.
    const steps =
      run.length >= params.frameCount ? params.frameCount : run.length - 1;
    const span = steps * frameAngleStep(params);
    const at = (angle: number) => {
      const point = ringPoint(angle, radiusX, radiusY);
      // A coordinate that rounds to nothing is written as nothing: the
      // sine of a whole turn is a hair below zero, and "-0.00" in the path
      // is the same point written two ways.
      const fixed = (value: number) =>
        Math.abs(value) < 0.005 ? "0.00" : value.toFixed(2);
      return `${fixed(point.x)} ${fixed(point.y)}`;
    };
    // A subpath of one moveto is not stroked (SVG 1.1 §11.4), so a lone
    // frame is drawn as a zero-length LINE, which a round cap turns into
    // the dot it should be. The coarse tier is nothing but lone frames
    // (every 8th, #104), so this is the common case, not the corner.
    const count = Math.max(1, Math.ceil(Math.abs(span) / ARC_STEP_RADIANS));
    parts.push(`M${at(from)}`);
    for (let i = 1; i <= count; i++) {
      parts.push(`L${at(from + (span * i) / count)}`);
    }
  }
  return parts.join("");
}

/** The ring's vertical radius for a horizontal one, at a flattening. */
export function ringRadii(
  width: number,
  flattening: number,
): { radiusX: number; radiusY: number } {
  const radiusX = width / 2;
  const f = Math.min(1, Math.max(RING_MIN_FLATTENING, flattening));
  return { radiusX, radiusY: radiusX * f };
}
