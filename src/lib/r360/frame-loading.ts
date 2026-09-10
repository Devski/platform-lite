import { loadingOrder } from "./orbit";

// #104 (A13, #68 decision 3), reshaped by its review: how a visitor's
// frames are fetched. A profile may show ten orbits of 360 frames; fetching
// them all on arrival is hundreds of megabytes nobody asked for, in the
// way of the page's own pictures. So: a tile fetches nothing beyond its
// poster until it is in view, then only the coarse tier — every 8th frame,
// enough for a first turn — and the rest once the visitor touches it; one
// queue for the whole page, a few requests at a time; a picture counts as
// loaded once the browser has decoded it, not merely received it. Pure,
// with the Image handed in, so the policy is tested without a browser.

export type LoadTier = "coarse" | "all";

/**
 * What the loader needs of an Image — the browser's, or a test's. The
 * natural size comes with it because #117 keeps the decoded picture rather
 * than dropping it, and a store with a budget has to know what it holds.
 */
export type ImageLike = Pick<
  HTMLImageElement,
  "onload" | "onerror" | "src" | "decode" | "naturalWidth" | "naturalHeight"
>;

/**
 * Failures in a row, with nothing loaded, that mean the set is not there
 * rather than that the network hiccuped. Three: enough that a single
 * cancelled request cannot end a run, few enough that a set of 720
 * objects which answers nothing costs three requests and not 720.
 */
const GIVE_UP_AFTER = 3;

/** The coarse tier: every 8th frame from the start — ⌈N / 8⌉ of them. */
export function coarseCount(frameCount: number): number {
  return Math.ceil(frameCount / 8);
}

/**
 * One queue for every orbit on the page: a few requests in the air at
 * once, so the frames never crowd out the page's own pictures. A job that
 * was cancelled before its turn is skipped.
 */
export class FrameQueue {
  private running = 0;
  private readonly waiting: {
    run: () => Promise<void>;
    live: () => boolean;
  }[] = [];

  constructor(readonly concurrency: number) {}

  enqueue(run: () => Promise<void>, live: () => boolean): void {
    this.waiting.push({ run, live });
    this.pump();
  }

  private pump(): void {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const job = this.waiting.shift();
      if (!job || !job.live()) continue;
      this.running += 1;
      void job.run().finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }
}

export interface FrameLoading {
  /** Widen the tier; `"all"` fetches the rest, coarse first as before. */
  setTier: (tier: LoadTier) => void;
  /** Cancels what is queued and in flight; nothing is reported after. */
  stop: () => void;
}

export interface FrameLoadingOptions<TImage extends ImageLike = ImageLike> {
  /** `urls[ordinal - 1]` */
  urls: readonly string[];
  startFrame: number;
  tier: LoadTier;
  /** Ordinals not to ask for: their picture is already held. */
  known?: ReadonlySet<number>;
  /**
   * This set has given the page a frame before, in an earlier run. Then it
   * is reachable, whatever this run runs into, and the giving-up below is
   * off — it is there to catch a set that has NEVER answered, not a run
   * that began badly.
   *
   * Load it wrong and closing a viewer twice kills the orbit: each close
   * cancels what was in flight, a cancelled request is a failure to an
   * <img>, and the next run opens on three of them (Dawid, 10.09.2026 —
   * "powiększenie, ESC, powiększenie, ESC i potem już nie doładowuje").
   */
  loadedBefore?: boolean;
  queue: FrameQueue;
  createImage: () => TImage;
  /**
   * One ordinal, decoded, with the picture itself — the caller keeps it so
   * the viewer can paint it without fetching and decoding again (#117).
   */
  onLoaded: (ordinal: number, picture: TImage) => void;
  /**
   * Told once, when a set has answered nothing but failures: none of it
   * can load, and the run gives up rather than asking for the rest.
   *
   * A whole set can be unreachable — a work made under another
   * environment's key prefix answers AccessDenied to every frame (#140) —
   * and it used to cost a hundred-odd failing requests EVERY time it came
   * into view, through the queue of three that every orbit on the page
   * shares. The orbits that could load queued behind the one that never
   * would.
   *
   * Counted rather than remembered per frame: a cancelled request and a
   * refused one are the same event to an <img>, so remembering each
   * failure would let a closed lightbox, or a blip, put a permanent hole
   * in an orbit. A run that has loaded nothing and failed three times in
   * a row is not a blip.
   */
  onUnreachable?: () => void;
}

/**
 * Fetches the frames in the loading order, up to the tier, through the
 * queue. Each is decoded before it counts; one that fails is skipped.
 */
export function startFrameLoading<TImage extends ImageLike>(
  options: FrameLoadingOptions<TImage>,
): FrameLoading {
  const { urls, queue, createImage, onLoaded, onUnreachable } = options;
  const order = loadingOrder(urls.length, options.startFrame).filter(
    (ordinal) => !options.known?.has(ordinal),
  );
  const coarse = new Set(
    loadingOrder(urls.length, options.startFrame).slice(
      0,
      coarseCount(urls.length),
    ),
  );
  let limit = options.tier;
  let cursor = 0;
  let stopped = false;
  let failuresInARow = 0;
  let everLoaded = options.loadedBefore ?? false;
  /**
   * The frames in the air, each with the way to settle its job. A job that
   * never settles never gives the page's queue its place back — see stop.
   */
  const inFlight = new Map<TImage, () => void>();

  const wanted = (ordinal: number) => limit === "all" || coarse.has(ordinal);
  const live = () => !stopped;

  const load = (ordinal: number) =>
    new Promise<void>((resolve) => {
      const image = createImage();
      const finish = (ok: boolean) => {
        // Once: an image stopped mid-decode may still have a decode()
        // settle after the job already has.
        if (!inFlight.delete(image)) return;
        image.onload = null;
        image.onerror = null;
        if (!stopped) {
          if (ok) {
            everLoaded = true;
            failuresInARow = 0;
            onLoaded(ordinal, image);
          } else {
            failuresInARow += 1;
            if (!everLoaded && failuresInARow >= GIVE_UP_AFTER) {
              // `live()` reads this, so what is queued is dropped unrun.
              stopped = true;
              onUnreachable?.();
            }
          }
        }
        resolve();
      };
      image.onload = () => {
        // Decoded, not merely received: a frame shown from the cache
        // still decodes on the main thread the first time it is painted.
        image.decode().then(
          () => finish(true),
          () => finish(true),
        );
      };
      image.onerror = () => finish(false);
      inFlight.set(image, () => finish(false));
      image.src = urls[ordinal - 1];
    });

  const fill = () => {
    // Everything wanted that is not yet queued goes to the queue now; the
    // queue paces it. Frames beyond the tier wait for setTier.
    while (cursor < order.length && wanted(order[cursor])) {
      const ordinal = order[cursor];
      cursor += 1;
      queue.enqueue(() => load(ordinal), live);
    }
  };
  fill();

  return {
    setTier(tier) {
      if (tier === limit || stopped) return;
      limit = tier;
      fill();
    },
    stop() {
      stopped = true;
      // Each frame in the air is SETTLED here, not merely silenced. The
      // page has one queue with three places, and a place comes back only
      // when its job settles — which, with the handlers taken away, used to
      // be never. Every viewer closed mid-load kept the places of its
      // frames in flight for the life of the page, and after two or three
      // closes there were none left: nothing on the page loaded again.
      // `stopped` is set first, so settling reports nothing to the caller.
      for (const [image, settle] of [...inFlight]) {
        settle();
        // An empty source aborts a fetch in flight in every browser.
        image.src = "";
      }
    },
  };
}

/** A connection the visitor would rather not spend on frames. */
export function prefersLittleData(
  connection: { saveData?: boolean; effectiveType?: string } | undefined,
): boolean {
  if (!connection) return false;
  return (
    connection.saveData === true ||
    /(^|\D)(2g|3g)$/.test(connection.effectiveType ?? "")
  );
}
