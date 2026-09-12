// #103/#104 (A13, the decisions on #68): the arithmetic of an orbit — one
// frame at a time, numbered 1..N in the viewer whatever the file names
// said, wrapping past the last. Pure, so the hook and the viewer stay thin
// hands on the pointer and the keyboard, and the mapping is tested here.
//
// #153 puts the shape of the motion here too: the curve a travel
// follows, how fast a drag was going when the hand let go, and how far
// that carries the orbit afterwards.

export interface OrbitParams {
  frameCount: number;
  /** +1: a drag to the right moves up the numbers; −1: down. */
  direction: 1 | -1;
  /** Frames per picture width: how far a drag across the whole picture goes. */
  framesPerWidth: number;
  startFrame: number;
}

/**
 * A travel's pace (#106), and the bounds that keep a long one from
 * dragging on. Here rather than in the hook because #153's coast may not
 * outlast a travel, and a cap that repeats the number in another file is
 * a cap that stops being true the day somebody tunes the original.
 */
const TRAVEL_MS_PER_FRAME = 28;
const TRAVEL_MIN_MS = 250;
export const TRAVEL_MAX_MS = 1200;

/** How long a travel over `pathLength` frames takes, within the bounds. */
export function travelDuration(pathLength: number): number {
  return Math.min(
    TRAVEL_MAX_MS,
    Math.max(TRAVEL_MIN_MS, pathLength * TRAVEL_MS_PER_FRAME),
  );
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

/** #153: where the pointer was, and when — one reading of a drag. */
export interface DragSample {
  x: number;
  /** Milliseconds; every sample of one drag read from the same clock. */
  t: number;
}

/**
 * #153: how fast a drag is turning the orbit when it is let go, in
 * frames per millisecond, signed as the frame numbers run. Measured
 * between the oldest and the newest sample given — the caller hands over
 * only the recent ones, so a hand that came to rest before it let go has
 * nothing here to measure and the orbit stops where it is.
 *
 * Zero wherever there is nothing to divide by: one sample, a picture
 * without width, two readings of the same instant — or a clock that ran
 * backwards, which `travelStop` guards against for its own reasons.
 */
export function dragSpeed(
  samples: readonly DragSample[],
  width: number,
  params: Pick<OrbitParams, "framesPerWidth" | "direction">,
): number {
  if (samples.length < 2 || width <= 0) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const span = last.t - first.t;
  // Not `span <= 0`: a NaN from either reading must land here too.
  if (!(span > 0)) return 0;
  const frames = ((last.x - first.x) / width) * params.framesPerWidth;
  return (params.direction * frames) / span;
}

/**
 * #153: how fast a coast sheds speed, in frames per millisecond squared.
 * The one number that decides both how long a throw runs and how far it
 * carries, and so the one to turn when the feel is wrong — to be tuned
 * on a phone with Dawid.
 */
const COAST_SLOWING = 1 / 12_000;
/**
 * The fastest a coast may start: a harder throw than this is taken as
 * this one. Derived from a travel's longest rather than stated again, so
 * that no motion of the orbit outlasts another however either is tuned.
 */
export const COAST_MAX_SPEED = COAST_SLOWING * TRAVEL_MAX_MS;

/**
 * #153: where a drag let go at `speed` coasts to, and how long it takes
 * to get there — the frames to turn, signed, and the milliseconds to
 * spend slowing to a stop. The slowing is constant, so the distance is
 * half the speed times the time, and `travelStop`'s "slowing" curve is
 * that same motion drawn out frame by frame.
 *
 * Null when the throw would not carry a whole frame: a hand that let go
 * rather than threw leaves the orbit where it is, as it always did. That
 * is the floor, and there is no second threshold to keep in step with it.
 */
export function coastAfterDrag(
  speed: number,
): { turn: number; ms: number } | null {
  if (!Number.isFinite(speed)) return null;
  const capped = Math.max(-COAST_MAX_SPEED, Math.min(COAST_MAX_SPEED, speed));
  const ms = Math.abs(capped) / COAST_SLOWING;
  const turn = Math.round((capped * ms) / 2);
  return turn === 0 ? null : { turn, ms };
}

/**
 * #153: how far back a release looks for the speed to coast at. Long
 * enough to hold several moves at any refresh rate, short enough that a
 * hand which came to rest before it let go leaves nothing inside it —
 * which is what makes a deliberate stop stop, with no threshold to tune.
 */
const COAST_SAMPLE_MS = 100;
/**
 * Readings a drag keeps. More than COAST_SAMPLE_MS can hold at any
 * refresh rate, so the window decides what counts and not the slicing.
 */
export const COAST_SAMPLES_KEPT = 12;

/**
 * #153: the whole of what a release decides — whether the orbit coasts
 * on, and if so how far and for how long. Here rather than in the hook
 * so that every way of NOT coasting can be put to the test: a pointer
 * that was cancelled rather than lifted, a visitor whose system asks for
 * less motion, and a hand that was slowing or standing still when it let
 * go.
 *
 * That last one is why the lift is a reading like any other rather than
 * merely the moment of asking. Measured between MOVES, the time a hand
 * spends resting before it lets go never reaches the divisor: the speed
 * would stay exactly what it was while the hand was still travelling,
 * right up to the moment the window empties, and then fall to nothing.
 * A finger lifts tens of milliseconds after it stops — the ordinary
 * gesture — so that step would have thrown the orbit most of the way
 * round on a drag the visitor had already finished. With the lift in the
 * readings, resting lengthens the span without lengthening the distance,
 * and the throw drains smoothly to nothing.
 */
export function coastOnRelease(
  release: {
    samples: readonly DragSample[];
    /**
     * Where and when the pointer lifted: the drag's last reading, and
     * the clock the window is measured back from.
     */
    lift: DragSample;
    /** The picture's width at the grab, which the drag was measured in. */
    width: number;
    /** The pointer was LIFTED — not cancelled, not taken away. */
    lifted: boolean;
    reducedMotion: boolean;
  },
  params: Pick<OrbitParams, "framesPerWidth" | "direction">,
): { turn: number; ms: number } | null {
  if (!release.lifted || release.reducedMotion) {
    return null;
  }
  const recent = [...release.samples, release.lift].filter(
    (reading) => release.lift.t - reading.t <= COAST_SAMPLE_MS,
  );
  return coastAfterDrag(dragSpeed(recent, release.width, params));
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

/**
 * #153: the shape a travel's progress takes. `steady` gives every frame
 * the same slice of the time — what a travel does, and what it did before
 * any of this. `slowing` starts at the hand's speed and comes to a stop:
 * not chosen for the look of it, it is where constant slowing puts a
 * thing, the very motion `coastAfterDrag` measures out.
 *
 * There was an `eased` shape here too, and owner-set amounts for it on the
 * way (#175). Both are gone on Dawid's decision of 12.09.2026 — the
 * product is losing functions rather than gaining them — so a click on the
 * ring travels at one pace again, and the only curve left is the one a
 * thrown orbit cannot be without.
 */
export type TravelCurve = "steady" | "slowing";

// Every member named, and no `default`: a curve added to the union and
// forgotten here is then a compile error, not a travel that quietly runs
// at a flat pace.
function alongCurve(progress: number, curve: TravelCurve): number {
  switch (curve) {
    case "steady":
      return progress;
    case "slowing":
      // 2t − t²: full speed at the start, none at the end.
      return progress * (2 - progress);
  }
}

/**
 * Where a travel stands (#106): the frame to show after `elapsed` of its
 * `duration`, and whether that frame is the destination. Every frame on
 * the path gets an equal share of the time, and the last one is the
 * destination.
 *
 * `elapsed` is the distance between two clock readings, and a clock can
 * hand back less than it did before: a virtual machine's monotonic clock
 * steps back when the host reschedules it, and an animation frame is given
 * the time that frame BEGAN, which can precede the reading taken in the
 * click that started the travel. Time that runs backwards counts as none —
 * a travel that cannot tell how far it has come shows the first frame of
 * its path, never one outside it (#161).
 *
 * An empty path has nowhere to be: no frame, and arrived. The hook never
 * asks, and `place` ignores a frame that is not a number.
 *
 * #153: `curve` is how the time is spread over the path — equally, or
 * gathered towards one end. It decides which frame is shown when, never
 * where the travel ends or when it is over.
 */
export function travelStop(
  path: readonly number[],
  elapsed: number,
  duration: number,
  curve: TravelCurve = "steady",
): { frame: number; arrived: boolean } {
  if (path.length === 0) return { frame: Number.NaN, arrived: true };
  const since = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const progress = duration > 0 ? since / duration : 1;
  // A curve is only itself over the travel's own time: an animation
  // frame that came late reads a progress past 1, and a slowing curve at 1.2
  // turns back DOWN the path. Clamped for the curve, raw for the arrival.
  const at = Math.min(
    path.length - 1,
    Math.floor(alongCurve(Math.min(1, progress), curve) * path.length),
  );
  return { frame: path[at], arrived: progress >= 1 };
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
 * The frames a turn of `turn` from `from` passes through — the
 * destination last, `from` itself not among them. A turn longer than the
 * frame count wraps and keeps going, because a coast can carry the orbit
 * more than once round (#153).
 */
export function framesAlong(
  from: number,
  turn: number,
  frameCount: number,
): number[] {
  const step = Math.sign(turn);
  return Array.from({ length: Math.abs(turn) }, (_, i) =>
    wrapFrame(from + step * (i + 1), frameCount),
  );
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
