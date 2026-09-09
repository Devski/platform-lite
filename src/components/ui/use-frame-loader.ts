"use client";

import { useEffect, useMemo, useState } from "react";
import { loadingOrder } from "@/lib/r360/orbit";

// #104 (A13, #68 decision 3): the visitor's frames load coarse to fine —
// the start frame, then every 8th, every 4th, every 2nd, the rest — so
// the orbit is usable after a dozen requests. Each frame is fetched by an
// Image the browser decodes and caches; the set of those decoded is what
// the viewer shows the nearest of, and what the ring (#106) ticks.

export interface FrameLoader {
  /** Ordinals whose picture the browser has decoded. */
  loaded: ReadonlySet<number>;
  /** Every frame's address, `urls[ordinal - 1]`. */
  urls: string[];
}

/**
 * `urls` is the set's identity: a new array starts the loading over, so
 * the caller memoizes it for as long as the set is the same.
 */
export function useFrameLoader(
  urls: string[],
  startFrame: number,
  options: { concurrency?: number; enabled?: boolean } = {},
): FrameLoader {
  const { concurrency = 4, enabled = true } = options;
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set());
  const frameCount = urls.length;
  const order = useMemo(
    () => loadingOrder(frameCount, startFrame),
    [frameCount, startFrame],
  );

  useEffect(() => {
    if (!enabled || order.length === 0) return;
    let stopped = false;
    const done = new Set<number>();
    let next = 0;
    const take = () => {
      if (stopped || next >= order.length) return;
      const ordinal = order[next++];
      const image = new Image();
      image.decoding = "async";
      const settle = (ok: boolean) => {
        if (stopped) return;
        if (ok) {
          done.add(ordinal);
          setLoaded(new Set(done));
        }
        take();
      };
      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = urls[ordinal - 1];
    };
    for (let i = 0; i < concurrency; i++) take();
    return () => {
      stopped = true;
    };
  }, [urls, order, enabled, concurrency]);

  return { loaded, urls };
}
