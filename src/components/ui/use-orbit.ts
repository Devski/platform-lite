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
// the same way (#104). The arithmetic is lib/r360/orbit.ts, tested there.

export interface Orbit {
  /** The frame in view, 1..N. */
  frame: number;
  setFrame: (frame: number) => void;
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

  const setFrame = useCallback(
    (next: number) => {
      const wrapped = wrapFrame(next, frameCount);
      if (wrapped === current.current) return;
      current.current = wrapped;
      setFrameState(wrapped);
      onFrameChange.current?.(wrapped);
    },
    [frameCount],
  );

  // A frame count that changed under the hook (a new archive in the same
  // form) keeps the frame within it.
  useEffect(() => {
    setFrame(current.current);
  }, [frameCount, setFrame]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const box = event.currentTarget.getBoundingClientRect();
      anchor.current = {
        frame: current.current,
        x: event.clientX,
        width: box.width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const from = anchor.current;
      if (!from) return;
      setFrame(
        frameAfterDrag(from.frame, event.clientX - from.x, from.width, params),
      );
    },
    [params, setFrame],
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
