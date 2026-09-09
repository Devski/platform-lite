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
  const { frameCount, direction, startFrame } = params;
  const steps = wrapFrame(frame - startFrame + 1, frameCount) - 1;
  return (direction * steps * 2 * Math.PI) / frameCount;
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

/** The ring's vertical radius for a horizontal one, at a flattening. */
export function ringRadii(
  width: number,
  flattening: number,
): { radiusX: number; radiusY: number } {
  const radiusX = width / 2;
  const f = Math.min(1, Math.max(RING_MIN_FLATTENING, flattening));
  return { radiusX, radiusY: radiusX * f };
}
