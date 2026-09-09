import { shortestTurn, wrapFrame, type OrbitParams } from "./orbit";

// #106 (A13, #68 decision 2): the ring dial's geometry. A circle flattened
// to the elevation the render camera had (f from 0.15 to 1, 1 = a circle),
// the start frame at the bottom — nearest the viewer — and the frames laid
// around it in the work's direction. The ring is absolute: the pointer's
// angle picks the frame. Pure; the component is a hand on it.

/** Flattening: 1 is a circle, 0.15 the flattest ring allowed. */
export const RING_MIN_FLATTENING = 0.15;

/**
 * The angle of a frame on the ring, in radians, measured clockwise from
 * the bottom (where the start frame sits) — the way the building turns
 * when the frames go up the numbers in the work's direction.
 */
export function angleOfFrame(frame: number, params: OrbitParams): number {
  const { frameCount, startFrame } = params;
  const steps = wrapFrame(frame - startFrame + 1, frameCount) - 1;
  return steps * frameAngleStep(params);
}

/** One frame's worth of angle, signed by the work's direction. */
export function frameAngleStep(params: OrbitParams): number {
  return (params.direction * 2 * Math.PI) / params.frameCount;
}

/** The frame at an angle from the bottom — the nearest one. */
export function frameAtAngle(angle: number, params: OrbitParams): number {
  const { frameCount, direction, startFrame } = params;
  const turns = (angle / (2 * Math.PI)) * frameCount;
  const steps = Math.round(direction * turns);
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
): string {
  const parts: string[] = [];
  for (const run of runs) {
    const from = angleOfFrame(run.from, params);
    // A full orbit closes the ring rather than stopping one frame short
    // of itself; any other run spans the gaps between its frames.
    const steps =
      run.length === params.frameCount ? run.length : run.length - 1;
    const span = steps * frameAngleStep(params);
    const at = (angle: number) => {
      const point = ringPoint(angle, radiusX, radiusY);
      return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
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
