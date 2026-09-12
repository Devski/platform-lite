"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { indexAtPoint, type Box } from "@/lib/reorder";

// #66: the hand that puts a list in order. Two lists use it and they look
// nothing alike — a wrapped row of place chips, a grid of work cards — so this
// knows only about a handle to take hold of and the boxes the items occupy.
// The arithmetic is lib/reorder.ts.
//
// Pointer events, not HTML5 drag-and-drop: `dragstart` never fires on a touch
// screen, and half of this product is used on a phone. One pointer path serves
// a mouse, a finger and a stylus, and the same handle answers the keyboard —
// arrows move the item one place, no grab mode to enter or forget to leave.

export interface Reorder {
  /** The item being dragged right now, or null. */
  dragging: number | null;
  /** Where it would land if let go now, or null. */
  over: number | null;
  /** Spread onto the element of each item: it is what gets measured. */
  itemProps: (index: number) => {
    ref: (node: HTMLElement | null) => void;
  };
  /** Spread onto the control inside each item that takes hold of it. */
  handleProps: (index: number) => {
    ref: (node: HTMLElement | null) => void;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    onLostPointerCapture: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    style: { touchAction: "none" };
  };
}

export function useReorder(options: {
  count: number;
  /** Called once a move is decided; the caller saves and announces it. */
  onMove: (from: number, to: number) => void;
}): Reorder {
  const { count, onMove } = options;
  // The drag in flight is kept in refs and mirrored into state. The refs are
  // what the handlers read: a pointerup can be delivered before the render
  // that a pointermove scheduled has committed, and a handler closed over the
  // older render then sees the drag still sitting where it started — so a
  // real drag, moved and dropped in one gesture, decided nothing at all. The
  // state exists only so the cards can show which is held and where it lands.
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);
  const items = useRef(new Map<number, HTMLElement>());
  const handles = useRef(new Map<number, HTMLElement>());
  // Measured once when the drag starts: nothing moves until it ends, and
  // measuring per pointer move would read layout dozens of times a second.
  const boxes = useRef<Box[]>([]);
  // Held in a ref and refreshed after render, the way use-orbit.ts does:
  // written during render, a ref is a value the component's output depends on
  // without React being told, and the lint says so.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);
  // The handle to put focus back on after a keyboard move. The list re-renders
  // in its new order, so the element that had focus is gone by then — without
  // this, one arrow press moves the item and drops the keyboard out of the
  // list entirely, which is the whole feature for anyone not using a mouse.
  const refocus = useRef<number | null>(null);

  // Deliberately a fresh closure per render: that is what makes React re-run
  // it, which is how the focus restore below ever gets a chance to fire.
  // Memoizing these — the obvious future tidy-up — silently ends keyboard
  // reordering, and no test would notice.
  const keep = useCallback(
    (map: React.RefObject<Map<number, HTMLElement>>, index: number) =>
      (node: HTMLElement | null) => {
        if (node) map.current.set(index, node);
        else map.current.delete(index);
        if (map === handles && node && refocus.current === index) {
          refocus.current = null;
          node.focus();
        }
      },
    [],
  );

  const itemProps = useCallback(
    (index: number) => ({ ref: keep(items, index) }),
    [keep],
  );

  const finish = useCallback(() => {
    draggingRef.current = null;
    overRef.current = null;
    setDragging(null);
    setOver(null);
    boxes.current = [];
  }, []);

  const handleProps = useCallback(
    (index: number) => ({
      ref: keep(handles, index),
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        // One drag at a time. A second finger on another grip would take the
        // drag over, and the first finger's release would then commit the
        // second one's half-finished move — and make its own release a no-op.
        if (draggingRef.current !== null) return;
        // Every item or none: a box list with a hole in it would answer the
        // wrong index for every item after the hole, and silently.
        const measured: Box[] = [];
        for (let at = 0; at < count; at++) {
          const node = items.current.get(at);
          if (!node) return;
          measured.push(node.getBoundingClientRect());
        }
        // Capture on the handle, so a drag that leaves the list — a finger
        // over the page's edge, a mouse over the card next to it — keeps
        // being reported here instead of ending where it left.
        event.currentTarget.setPointerCapture(event.pointerId);
        boxes.current = measured;
        draggingRef.current = index;
        overRef.current = index;
        setDragging(index);
        setOver(index);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (draggingRef.current === null) return;
        const at = indexAtPoint(boxes.current, event.clientX, event.clientY);
        // Pointer moves arrive dozens of times a second and every card here
        // holds a live orbit: re-render only when the answer actually moves.
        if (at === overRef.current) return;
        overRef.current = at;
        setOver(at);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        const from = draggingRef.current;
        const to = overRef.current;
        if (from !== null && to !== null && to !== from) {
          onMoveRef.current(from, to);
        }
        finish();
      },
      // A cancelled pointer is not a decision: the browser took the gesture
      // over (a scroll, a back-swipe), and the list stays as it was.
      onPointerCancel: finish,
      // Capture lost any other way — the grip unmounted because editing
      // ended, or the list shrank under it. `pointercancel` does not fire
      // then, and without this the card keeps its held look until the next
      // drag.
      onLostPointerCapture: finish,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
        const on = event.key === "ArrowRight" || event.key === "ArrowDown";
        if (!back && !on) return;
        const to = back ? index - 1 : index + 1;
        if (to < 0 || to >= count) return;
        event.preventDefault();
        refocus.current = to;
        onMoveRef.current(index, to);
      },
      style: { touchAction: "none" as const },
    }),
    [count, finish, keep],
  );

  return { dragging, over, itemProps, handleProps };
}
