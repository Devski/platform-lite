"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  frameAfterDrag,
  frameAfterKey,
  wrapFrame,
  type OrbitParams,
} from "@/lib/r360/orbit";

// #103/#104 (the decisions on #68): the hand on an orbit. A drag on the
// picture is relative and discrete — pointer-down remembers the frame and
// the x, every move is computed from that anchor — and wraps; the pointer
// is captured so a drag lives on outside the picture. The keyboard steps
// the same way (#104). A travel (#106: a click on the ring) moves frame by
// frame along a path over a bounded time, and any hand that takes hold —
// a grab, a key — ends it. The arithmetic is lib/r360/orbit.ts.

const DRAG_SLOP_PX = 6;
/** A travel's pace, and the bounds that keep a long one from dragging on. */
const TRAVEL_MS_PER_FRAME = 28;
const TRAVEL_MIN_MS = 250;
const TRAVEL_MAX_MS = 1200;

export interface Orbit {
  /** The frame in view, 1..N. */
  frame: number;
  setFrame: (frame: number) => void;
  /**
   * Moves along `path` (the frames on the way, the destination last) over
   * a time proportional to its length, within bounds; reduced motion
   * jumps. A grab or a key on the way ends it where it is.
   */
  travelAlong: (path: readonly number[]) => void;
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
  const { frameCount } = params;
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
  const onFrameChange = useRef(options.onFrameChange);
  useEffect(() => {
    onFrameChange.current = options.onFrameChange;
  }, [options.onFrameChange]);
  // The travel in flight: one animation frame pending at a time.
  const travel = useRef<number | undefined>(undefined);
  const cancelTravel = useCallback(() => {
    if (travel.current !== undefined) {
      window.cancelAnimationFrame(travel.current);
    }
    travel.current = undefined;
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

  const travelAlong = useCallback(
    (path: readonly number[]) => {
      cancelTravel();
      if (path.length === 0) return;
      const destination = path[path.length - 1];
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        place(destination);
        return;
      }
      const duration = Math.min(
        TRAVEL_MAX_MS,
        Math.max(TRAVEL_MIN_MS, path.length * TRAVEL_MS_PER_FRAME),
      );
      const started = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        const at = Math.min(
          path.length - 1,
          Math.floor(progress * path.length),
        );
        place(path[at]);
        if (progress < 1) {
          travel.current = window.requestAnimationFrame(step);
        } else {
          travel.current = undefined;
          place(destination);
        }
      };
      travel.current = window.requestAnimationFrame(step);
    },
    [cancelTravel, place],
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
      place(frameAfterDrag(from.frame, deltaX, from.width, params));
    },
    [params, place],
  );

  const release = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!anchor.current) return;
    anchor.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }, []);

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
