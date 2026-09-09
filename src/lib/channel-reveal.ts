// #100: the maths behind the reveal slider for a two-channel photo — pure,
// so the component stays a thin hand on the pointer and the keyboard. The
// position is 0..100: at 0 the first channel alone, at 100 the second
// alone, at 50 half and half, with the divide where the handle is. Along
// the x axis the second channel is revealed from the left edge to the
// handle; along y, from the top edge down.

export type RevealAxis = "x" | "y";

export const REVEAL_STEP = 5;

export function clampPosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Where a pointer at (clientX, clientY) puts the handle, over a box. */
export function positionFromPointer(
  point: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
  axis: RevealAxis,
): number {
  const size = axis === "x" ? box.width : box.height;
  if (size <= 0) return 0;
  const offset =
    axis === "x" ? point.clientX - box.left : point.clientY - box.top;
  return clampPosition((offset / size) * 100);
}

/** The handle after a key, or null when the key is not the slider's. */
export function positionAfterKey(
  position: number,
  key: string,
  axis: RevealAxis,
): number | null {
  const less = axis === "x" ? "ArrowLeft" : "ArrowUp";
  const more = axis === "x" ? "ArrowRight" : "ArrowDown";
  switch (key) {
    case less:
      return clampPosition(position - REVEAL_STEP);
    case more:
      return clampPosition(position + REVEAL_STEP);
    case "PageUp":
      return clampPosition(position - REVEAL_STEP * 4);
    case "PageDown":
      return clampPosition(position + REVEAL_STEP * 4);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}

/** The CSS clip of the second channel: what lies past the handle is cut. */
export function secondChannelClip(position: number, axis: RevealAxis): string {
  const hidden = 100 - clampPosition(position);
  return axis === "x" ? `inset(0 ${hidden}% 0 0)` : `inset(0 0 ${hidden}% 0)`;
}
