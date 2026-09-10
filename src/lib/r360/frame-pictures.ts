import { shortestTurn } from "./orbit";

// #117 (A13): the frames a viewer can paint RIGHT NOW, kept decoded.
//
// Before this, both viewers painted an <img> and changed its src per frame.
// Changing src puts the element in the "no image" state until the new one
// has been fetched and decoded — measured in Chrome: a frame the element
// has never shown is unpainted on the next animation frame, one it has
// shown before is instant. So the first turn round an orbit flashed the
// container's ground between every pair of frames, which is what the owner
// who first uploaded a real orbit called badly flickery (09.09.2026).
// Painting a decoded picture onto
// a canvas is synchronous: the worst case is a few milliseconds of blocked
// frame, never a blank one.
//
// Keeping every frame decoded is not free — 360 frames at 1600 px is over
// two gigabytes of pixels — so this is a store with a budget, holding the
// frames around the one in view and dropping the far side of the orbit
// first. It holds pictures without drawing any: no canvas call, no DOM, so
// the policy is tested without a browser.

/** What `drawImage` takes, sized, and freed if the browser will not. */
export interface FramePicture {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  /**
   * Bytes this picture keeps resident. An ImageBitmap holds its pixels
   * until it is closed; an <img> element holds its file and lets the
   * browser reclaim the pixels, so it counts for much less.
   */
  readonly bytes: number;
  /** Called when the store drops it; an ImageBitmap needs closing. */
  readonly release?: () => void;
}

/**
 * 128 MB, and only pictures that really hold their pixels are charged for
 * it — the owner's ImageBitmaps. Every frame of a 60-frame orbit at 800 px
 * (86 MB) stays resident; a 360-frame one keeps a window of about ninety
 * around the frame in view, and the frames outside it are decoded again
 * from the encodings the form kept when the orbit turns their way.
 */
const FRAME_PICTURE_BUDGET_BYTES = 128 * 1024 * 1024;

/** Pixels an image of this size holds decoded: four bytes each. */
export function pictureBytes(width: number, height: number): number {
  return Math.max(0, width) * Math.max(0, height) * 4;
}

export class FramePictures {
  private readonly held = new Map<number, FramePicture>();
  private bytes = 0;
  /** The frame the orbit is on: what the store keeps closest. */
  private anchor = 1;

  constructor(
    readonly frameCount: number,
    readonly budgetBytes: number = FRAME_PICTURE_BUDGET_BYTES,
  ) {}

  /** Ordinals resident right now: what a canvas can paint this instant. */
  get ordinals(): ReadonlySet<number> {
    return new Set(this.held.keys());
  }

  get size(): number {
    return this.held.size;
  }

  get(ordinal: number): FramePicture | undefined {
    return this.held.get(ordinal);
  }

  has(ordinal: number): boolean {
    return this.held.has(ordinal);
  }

  /**
   * The frame in view. Eviction measures from here, so a drag carries the
   * resident window with it instead of dropping what is about to be asked
   * for.
   */
  focus(ordinal: number): void {
    this.anchor = ordinal;
  }

  /**
   * Holds a decoded frame, replacing whatever that ordinal had. A picture
   * larger than the whole budget is still held — a store that refused the
   * only frame it was given would paint nothing at all.
   */
  put(ordinal: number, picture: FramePicture): void {
    this.drop(ordinal);
    this.held.set(ordinal, picture);
    this.bytes += picture.bytes;
    this.evict();
  }

  /** Frees every picture; the store is reusable afterwards. */
  clear(): void {
    for (const ordinal of [...this.held.keys()]) this.drop(ordinal);
  }

  private drop(ordinal: number): void {
    const held = this.held.get(ordinal);
    if (!held) return;
    this.held.delete(ordinal);
    this.bytes -= held.bytes;
    held.release?.();
  }

  /** Over budget: the frame furthest round the orbit goes first. */
  private evict(): void {
    // Distance is meaningless without an orbit to measure round, and the
    // loop below would never find a frame to drop — a hung tab, not a
    // wrong pixel. A store for no frames holds whatever it was given.
    if (this.frameCount <= 0) return;
    while (this.bytes > this.budgetBytes && this.held.size > 1) {
      let furthest = -1;
      let worst = -1;
      for (const ordinal of this.held.keys()) {
        const away = Math.abs(
          shortestTurn(this.anchor, ordinal, this.frameCount),
        );
        if (away > worst) {
          worst = away;
          furthest = ordinal;
        }
      }
      // Only the anchor is left within budget: stop rather than drop the
      // one frame the viewer is showing. The second test is the loop's
      // own guarantee of progress — without a frame to drop it would spin.
      if (furthest === this.anchor || !this.held.has(furthest)) return;
      this.drop(furthest);
    }
  }
}
