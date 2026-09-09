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
  /** Ordinals already loaded (a remount): fetched again never. */
  known?: ReadonlySet<number>;
  queue: FrameQueue;
  createImage: () => TImage;
  /**
   * One ordinal, decoded, with the picture itself — the caller keeps it so
   * the viewer can paint it without fetching and decoding again (#117).
   */
  onLoaded: (ordinal: number, picture: TImage) => void;
}

/**
 * Fetches the frames in the loading order, up to the tier, through the
 * queue. Each is decoded before it counts; one that fails is skipped.
 */
export function startFrameLoading<TImage extends ImageLike>(
  options: FrameLoadingOptions<TImage>,
): FrameLoading {
  const { urls, queue, createImage, onLoaded } = options;
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
  const inFlight = new Set<TImage>();

  const wanted = (ordinal: number) => limit === "all" || coarse.has(ordinal);
  const live = () => !stopped;

  const load = (ordinal: number) =>
    new Promise<void>((resolve) => {
      const image = createImage();
      inFlight.add(image);
      const finish = (ok: boolean) => {
        inFlight.delete(image);
        image.onload = null;
        image.onerror = null;
        if (ok && !stopped) onLoaded(ordinal, image);
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
      for (const image of inFlight) {
        image.onload = null;
        image.onerror = null;
        // An empty source aborts a fetch in flight in every browser.
        image.src = "";
      }
      inFlight.clear();
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
