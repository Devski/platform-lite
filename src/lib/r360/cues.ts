import type { R360Cue } from "./frame-set-shared";
import { wrapFrame, type OrbitParams } from "./orbit";
import { angleOfFrame, ringPoint } from "./ring";

// #107 (A13; the layout Dawid chose on 11.09.2026 from a sketch of three —
// the label beside its marker, and a list under the picture, together):
// the cue points' arithmetic. A cue is a labelled frame. The visitor
// reaches it from its marker on the ring — the label shows beside it on
// hover, on touch at the first tap — or from a row of buttons under the
// picture. The buttons stand on their own: on phones, and on the profile
// page once the redesign shows the ring only in the enlarged view, they
// are all there is. Pure; the ring and the buttons are hands on it.

/**
 * The cues in the order a turn from the start frame meets them: the order
 * of the buttons, so reading them walks the orbit the way its numbers grow.
 */
export function cuesInOrder<T extends R360Cue>(
  cues: readonly T[] | undefined,
  params: Pick<OrbitParams, "frameCount" | "startFrame">,
): T[] {
  const fromStart = (frame: number) =>
    wrapFrame(frame - params.startFrame + 1, params.frameCount);
  return [...(cues ?? [])].sort(
    (a, b) => fromStart(a.frame) - fromStart(b.frame),
  );
}

export type CueLabelSide = "above" | "left" | "right";

/** How far the outward way has to lean sideways for a label to go beside. */
const SIDEWAYS = 0.4;

/**
 * Which side of its marker a cue's label goes: outward from the ring, the
 * way the ellipse's own normal points there — above the far arc, beside
 * either end. Never below: under the ring is its counter, and under that
 * the card's edge or the page's own text. The near arc's labels go to
 * their own side instead.
 */
export function cueLabelSide(
  point: { x: number; y: number },
  radiusX: number,
  radiusY: number,
): CueLabelSide {
  // The ellipse's normal at (x, y) is (x / rx², y / ry²).
  const nx = point.x / (radiusX * radiusX);
  const ny = point.y / (radiusY * radiusY);
  const sideways = nx / (Math.hypot(nx, ny) || 1);
  if (sideways > SIDEWAYS) return "right";
  if (sideways < -SIDEWAYS) return "left";
  if (ny < 0) return "above";
  return point.x < 0 ? "left" : "right";
}

/**
 * How far to move a label, sideways, to keep it inside the bounds it would
 * cross — the card's picture clips what leaves it, and the page scrolls
 * sideways for what leaves it. 0 when it fits. A label wider than the room
 * starts at the room's left edge, where its first words are read.
 */
export function shiftIntoBounds(
  box: { left: number; right: number },
  bounds: { left: number; right: number },
  margin: number,
): number {
  const left = bounds.left + margin;
  const right = bounds.right - margin;
  if (box.right - box.left >= right - left || box.left < left) {
    return left - box.left;
  }
  if (box.right > right) return right - box.right;
  return 0;
}

/**
 * The frame of the cue whose marker is nearest a pointer — both in the
 * ring's own units, from its centre — if it is within `reach`, else null.
 * The nearest, not the first found: on the short far arc of a flat ring
 * the markers crowd, and a pointer between two means the closer one.
 */
export function cueNear(
  cues: readonly R360Cue[],
  pointer: { x: number; y: number },
  params: OrbitParams,
  radii: { radiusX: number; radiusY: number },
  reach: number,
): number | null {
  let nearest: number | null = null;
  let best = Infinity;
  for (const cue of cues) {
    const at = ringPoint(
      angleOfFrame(cue.frame, params),
      radii.radiusX,
      radii.radiusY,
    );
    const away = Math.hypot(at.x - pointer.x, at.y - pointer.y);
    if (away < best) {
      nearest = cue.frame;
      best = away;
    }
  }
  return best <= reach ? nearest : null;
}
