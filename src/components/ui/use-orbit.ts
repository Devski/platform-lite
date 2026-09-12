"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COAST_SAMPLES_KEPT,
  coastOnRelease,
  frameAfterDrag,
  frameAfterKey,
  framesAlong,
  glides,
  travelCurve,
  travelDuration,
  travelStop,
  wrapFrame,
  type DragSample,
  type OrbitParams,
  type TravelCurve,
} from "@/lib/r360/orbit";

// #103/#104 (the decisions on #68): the hand on an orbit. A drag on the
// picture is relative and discrete — pointer-down remembers the frame and
// the x, every move is computed from that anchor — and wraps; the pointer
// is captured so a drag lives on outside the picture. The keyboard steps
// the same way (#104). A travel (#106: a click on the ring) moves frame by
// frame along a path over a bounded time, and any hand that takes hold —
// a grab, a key — ends it. The arithmetic is lib/r360/orbit.ts.
//
// #153: the motion eases, on a work whose owner has left it to. A
// travel gathers pace and settles onto its frame; a drag thrown rather
// than put down coasts on and slows to a stop. Reduced motion still
// wins over both — a travel jumps, a release stops dead — and so does a
// hand: a grab or a key ends a coast exactly as it ends a travel,
// because a coast IS a travel, along the frames the throw would carry.

const DRAG_SLOP_PX = 6;
/**
 * How long after a travel's own time is up its landing waits for the
 * animation to have done the job itself (#161). Wide enough that a busy
 * frame does not land the orbit early, short enough that a visitor who
 * comes back to the tab finds the orbit where they sent it.
 */
const TRAVEL_LANDING_AFTER_MS = 200;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * #153: the clock a drag is measured on. `event.timeStamp` is when the
 * pointer actually moved, not when the handler got round to running —
 * and on an orbit page those come apart: decoding frames blocks the main
 * thread, the moves queued behind it then drain in one task, and
 * `performance.now()` would read a whole swipe as having happened at
 * once. Every reading of one gesture comes from here, so a browser whose
 * stamps sit on another origin is still self-consistent; one that hands
 * back no time at all leaves a span of zero, which `dragSpeed` reads as
 * no speed — the safe way to be wrong.
 */
function clockOf(event: React.PointerEvent<HTMLElement>): number {
  return event.timeStamp;
}

export interface Orbit {
  /** The frame in view, 1..N. */
  frame: number;
  setFrame: (frame: number) => void;
  /**
   * Moves along `path` (the frames on the way, the destination last) over
   * a time proportional to its length, within bounds; reduced motion
   * jumps. A grab or a key on the way ends it where it is. #153: eased
   * in and out of its frame on an orbit that glides, at a constant pace
   * on one whose owner turned that off.
   */
  travelAlong: (path: readonly number[]) => void;
  /**
   * #175: the frame an aimed travel is on its way to, or null when the
   * orbit is standing still, being dragged, or coasting. What the cue
   * buttons light on — the frame that was ASKED for, not the one the orbit
   * happens to be crossing.
   */
  aimedAt: number | null;
  cancelTravel: () => void;
  dragging: boolean;
  /** Spread onto the element that is the picture. */
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    /** Capture lost any other way: the drag ends rather than lingers. */
    onLostPointerCapture: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  };
}

export function useOrbit(
  params: OrbitParams,
  options: {
    initialFrame?: number;
    onFrameChange?: (frame: number) => void;
  } = {},
): Orbit {
  const { frameCount, framesPerWidth, direction } = params;
  // #153: read once, and as a plain boolean — the parameters arrive as a
  // fresh object on some renders (a form with no set yet builds its
  // defaults inline), and a callback keyed on the object itself would be
  // rebuilt with every one of them.
  const glide = glides(params);
  // #175: one curve for every travel, whichever hand started it — the ring,
  // a marker on it, or a cue button all come through travelAlong.
  const curve = travelCurve(params);
  const [frame, setFrameState] = useState(() =>
    wrapFrame(options.initialFrame ?? params.startFrame, frameCount),
  );
  const [dragging, setDragging] = useState(false);
  // The anchor of the drag in flight, and the frame as it is right now —
  // read between renders by the move handler, never from a stale closure.
  const anchor = useRef<{ frame: number; x: number; width: number } | null>(
    null,
  );
  const current = useRef(frame);
  // #153: where the pointer has lately been, for the speed a release
  // coasts at. Kept short, and thrown away with every new grab.
  const samples = useRef<DragSample[]>([]);
  const onFrameChange = useRef(options.onFrameChange);
  useEffect(() => {
    onFrameChange.current = options.onFrameChange;
  }, [options.onFrameChange]);
  // The travel in flight: one animation frame pending at a time, and the
  // landing that does not depend on it (#161).
  const travel = useRef<number | undefined>(undefined);
  const landing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // #175: the frame an aimed travel is on its way to, or null.
  const [aimedAt, setAimedAt] = useState<number | null>(null);
  const cancelTravel = useCallback(() => {
    setAimedAt(null);
    if (travel.current !== undefined) {
      window.cancelAnimationFrame(travel.current);
    }
    travel.current = undefined;
    if (landing.current !== undefined) {
      clearTimeout(landing.current);
    }
    landing.current = undefined;
  }, []);

  const place = useCallback(
    (next: number) => {
      // A guard at the sink: a NaN from a box without layout would stick.
      if (!Number.isFinite(next)) return;
      const wrapped = wrapFrame(next, frameCount);
      if (wrapped === current.current) return;
      current.current = wrapped;
      setFrameState(wrapped);
      onFrameChange.current?.(wrapped);
    },
    [frameCount],
  );
  /** A hand taking hold: whatever travel was on its way ends here. */
  const setFrame = useCallback(
    (next: number) => {
      cancelTravel();
      place(next);
    },
    [cancelTravel, place],
  );

  /**
   * #153: the motion itself — the frames of `path` spread over `duration`
   * along `curve`, and the landing that does not depend on the animation
   * (#161). A click on the ring and a drag thrown both end up here; they
   * differ only in where the path and the time come from.
   */
  const run = useCallback(
    (path: readonly number[], duration: number, curve: TravelCurve) => {
      cancelTravel();
      const destination = path[path.length - 1];
      const started = performance.now();
      const step = (now: number) => {
        const { frame: on, arrived } = travelStop(
          path,
          now - started,
          duration,
          curve,
        );
        // Settled before the frame is placed, never after: placing tells the
        // consumer where the orbit is, and a consumer that takes hold there
        // must not find the travel scheduling itself again behind its back.
        if (arrived) cancelTravel();
        else travel.current = window.requestAnimationFrame(step);
        place(on);
      };
      travel.current = window.requestAnimationFrame(step);
      // Arriving is not the animation's job (#161). Animation frames stop
      // coming to a page that is not being drawn — a tab put aside, a
      // window behind another — and the travel would be left standing on
      // whichever frame it had reached, one nobody asked for, with nothing
      // to bring it the rest of the way. A timer still fires there, late
      // and slowed though a background one is, and a page put to sleep
      // outright is woken before it is shown again: so the destination is
      // reached either way, and the animation only decides whether the
      // visitor watches the turn or finds it already made. A hand that
      // takes hold first cancels this with everything else.
      landing.current = setTimeout(() => {
        cancelTravel();
        place(destination);
      }, duration + TRAVEL_LANDING_AFTER_MS);
    },
    [cancelTravel, place],
  );

  const travelAlong = useCallback(
    (path: readonly number[]) => {
      cancelTravel();
      if (path.length === 0) return;
      const destination = path[path.length - 1];
      if (reducedMotion()) {
        place(destination);
        return;
      }
      // #175: where this orbit is headed, for as long as it is headed
      // there. A cue button lights on the press rather than on the arrival,
      // and the cues the travel passes on the way stay unlit — the row was
      // reading the CURRENT frame, so every cue crossed by a travel flashed
      // for the 28 ms it stood on it.
      //
      // Only an aimed travel sets this. A coast has an end too, but nobody
      // asked for that frame, so nothing should claim it was asked for.
      // After `run`, not before: it begins by cancelling whatever travel was
      // in flight, and cancelling is what drops the aim — set first, the
      // press would light the button for as long as it takes the next line
      // to run, which is no time at all.
      run(path, travelDuration(path.length), curve);
      setAimedAt(destination);
    },
    [cancelTravel, curve, place, run],
  );

  // A frame count that changed under the hook (a new archive in the same
  // form) keeps the frame within it, and ends a travel planned for the
  // old one.
  useEffect(() => {
    setFrame(current.current);
  }, [frameCount, setFrame]);
  useEffect(() => cancelTravel, [cancelTravel]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      cancelTravel();
      const box = event.currentTarget.getBoundingClientRect();
      anchor.current = {
        frame: current.current,
        x: event.clientX,
        width: box.width,
      };
      // #153: the readings of the drag before this one are not this
      // drag's. The press itself is not one of them either — it is where
      // the finger landed, not motion, and counting it would measure a
      // speed across the slop below and throw the orbit on a tap that
      // wobbled.
      samples.current = [];
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [cancelTravel],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const from = anchor.current;
      if (!from) return;
      const deltaX = event.clientX - from.x;
      // A diagonal swipe sends a few moves before the browser claims the
      // vertical pan: a little slop keeps the orbit from jittering a frame.
      if (Math.abs(deltaX) < DRAG_SLOP_PX) return;
      // #153: read past the slop, never within it. A tap whose finger
      // jitters a few pixels quickly has a speed like any other motion,
      // but it has not turned the orbit — and it must not throw it.
      samples.current = [
        ...samples.current,
        { x: event.clientX, t: clockOf(event) },
      ].slice(-COAST_SAMPLES_KEPT);
      place(frameAfterDrag(from.frame, deltaX, from.width, params));
    },
    [params, place],
  );

  const release = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const from = anchor.current;
      if (!from) return;
      anchor.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
      // #153: a hand still moving throws the orbit on. What decides that
      // is lib/r360/orbit.ts, where it can be put to the test — this is
      // only the reading of the clock and of the event. A pointer
      // cancelled or taken away is not a release the visitor made, which
      // is the same way the ring tells a click from a drag.
      const coast = coastOnRelease(
        {
          samples: samples.current,
          lift: { x: event.clientX, t: clockOf(event) },
          width: from.width,
          lifted: event.type === "pointerup",
          glide,
          reducedMotion: reducedMotion(),
        },
        { framesPerWidth, direction },
      );
      if (!coast) return;
      run(
        framesAlong(current.current, coast.turn, frameCount),
        coast.ms,
        "slowing",
      );
    },
    [direction, frameCount, framesPerWidth, glide, run],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const next = frameAfterKey(current.current, event.key, params);
      if (next === null) return;
      event.preventDefault();
      setFrame(next);
    },
    [params, setFrame],
  );

  return {
    frame,
    aimedAt,
    setFrame,
    travelAlong,
    cancelTravel,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onKeyDown,
    },
  };
}
