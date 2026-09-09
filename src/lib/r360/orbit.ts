// #103/#104 (A13, the decisions on #68): the arithmetic of an orbit — one
// frame at a time, numbered 1..N in the viewer whatever the file names
// said, wrapping past the last. Pure, so the hook and the viewer stay thin
// hands on the pointer and the keyboard, and the mapping is tested here.

export interface OrbitParams {
  frameCount: number;
  /** +1: a drag to the right moves up the numbers; −1: down. */
  direction: 1 | -1;
  /** Frames per picture width: how far a drag across the whole picture goes. */
  framesPerWidth: number;
  startFrame: number;
}

/** The non-negative modulo: JavaScript's `%` keeps the dividend's sign. */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** The frame 1..N that `frame` wraps to. */
export function wrapFrame(frame: number, frameCount: number): number {
  return mod(frame - 1, frameCount) + 1;
}

/**
 * The frame a drag lands on. Relative and discrete (#68 decision 1): the
 * pointer-down remembered the frame and the x; every move is computed
 * from that anchor, never accumulated per event, so a slow drag still
 * moves. `deltaX / width * k` frames, rounded, in the work's direction.
 */
export function frameAfterDrag(
  anchorFrame: number,
  deltaX: number,
  width: number,
  params: OrbitParams,
): number {
  if (width <= 0) return wrapFrame(anchorFrame, params.frameCount);
  const steps = Math.round((deltaX / width) * params.framesPerWidth);
  return wrapFrame(anchorFrame + params.direction * steps, params.frameCount);
}

/** A twelfth of the orbit, at least one frame — the Page keys' step. */
export function pageStep(frameCount: number): number {
  return Math.max(1, Math.round(frameCount / 12));
}

/**
 * The frame after a key (#104), or null when the key is not the orbit's:
 * arrows one frame in the work's direction (up and down as right and left,
 * as a slider's do), Page keys a twelfth of the orbit, Home the start
 * frame, End the frame opposite it.
 */
export function frameAfterKey(
  frame: number,
  key: string,
  params: OrbitParams,
): number | null {
  const { frameCount, direction } = params;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return wrapFrame(frame + direction, frameCount);
    case "ArrowLeft":
    case "ArrowDown":
      return wrapFrame(frame - direction, frameCount);
    case "PageDown":
      return wrapFrame(frame + direction * pageStep(frameCount), frameCount);
    case "PageUp":
      return wrapFrame(frame - direction * pageStep(frameCount), frameCount);
    case "Home":
      return wrapFrame(params.startFrame, frameCount);
    case "End":
      return wrapFrame(
        params.startFrame + Math.floor(frameCount / 2),
        frameCount,
      );
    default:
      return null;
  }
}

/** The shorter way round from one frame to another, signed; a tie is +. */
export function shortestTurn(
  from: number,
  to: number,
  frameCount: number,
): number {
  const forward = mod(to - from, frameCount);
  return forward <= frameCount - forward ? forward : forward - frameCount;
}

/**
 * The order the visitor's frames load in (#104): the start frame, then
 * every 8th, every 4th, every 2nd, the rest — so the orbit is usable
 * after a dozen requests and fills in evenly.
 */
export function loadingOrder(frameCount: number, startFrame: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  for (const stride of [8, 4, 2, 1]) {
    for (let offset = 0; offset < frameCount; offset += stride) {
      const frame = wrapFrame(startFrame + offset, frameCount);
      if (seen.has(frame)) continue;
      seen.add(frame);
      order.push(frame);
    }
  }
  return order;
}

/**
 * A membership test over ordinals: a Set of them, or #117's store of
 * decoded pictures, which answers the same question without building one.
 */
export interface OrdinalSet {
  has(ordinal: number): boolean;
  readonly size: number;
}

/**
 * The loaded frame nearest to `frame` around the orbit, or null when none
 * is loaded yet; the frame itself when it is. A tie goes the work's way.
 */
export function nearestLoaded(
  frame: number,
  loaded: OrdinalSet,
  params: Pick<OrbitParams, "frameCount" | "direction">,
): number | null {
  if (loaded.size === 0) return null;
  if (loaded.has(frame)) return frame;
  const { frameCount, direction } = params;
  for (let distance = 1; distance <= frameCount / 2; distance++) {
    const ahead = wrapFrame(frame + direction * distance, frameCount);
    if (loaded.has(ahead)) return ahead;
    const behind = wrapFrame(frame - direction * distance, frameCount);
    if (loaded.has(behind)) return behind;
  }
  return null;
}
