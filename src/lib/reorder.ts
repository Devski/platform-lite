// #66: the arithmetic of putting a list in order by hand. Two lists want it —
// the places on a profile and the works below them — and they look nothing
// alike: one is a wrapped row of chips, the other a grid of cards. What they
// share is here, pure and tested; the hand on the pointer is
// components/ui/use-reorder.ts.

/** A box on the page, as `getBoundingClientRect` gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The list with the item at `from` moved to `to`, the rest closing the gap
 * behind it and making room in front. Out-of-range indices and a move to
 * where it already is give the list back unchanged — a caller that computed
 * an index from a pointer should not have to check first.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const last = list.length - 1;
  if (from < 0 || from > last || to < 0 || to > last || from === to) {
    return [...list];
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Whether the point is inside the box, edges counting as inside. */
function contains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/** How far the point is from the box's middle, squared (the root is never
 * needed: only the order of the distances matters). */
function fromCentre(box: Box, x: number, y: number): number {
  const dx = (box.left + box.right) / 2 - x;
  const dy = (box.top + box.bottom) / 2 - y;
  return dx * dx + dy * dy;
}

/**
 * Which item a pointer is over: the box it is inside, or failing that the box
 * whose middle it is nearest. The fallback is what makes a drag usable — a
 * finger in the gap between two chips, or below the last row of a grid, is
 * still asking for somewhere in particular, and a drag that only answers while
 * exactly over an item stalls wherever the layout has air in it.
 *
 * Null only when there is nothing to be over. Ties go to the earlier item, so
 * the answer does not depend on the order boxes happen to be measured in.
 */
export function indexAtPoint(
  boxes: readonly Box[],
  x: number,
  y: number,
): number | null {
  if (boxes.length === 0) return null;
  for (const [index, box] of boxes.entries()) {
    if (contains(box, x, y)) return index;
  }
  let nearest = 0;
  let best = fromCentre(boxes[0], x, y);
  for (let index = 1; index < boxes.length; index++) {
    const distance = fromCentre(boxes[index], x, y);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  }
  return nearest;
}
