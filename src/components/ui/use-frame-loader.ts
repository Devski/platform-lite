"use client";

import { useEffect, useRef, useState } from "react";
import {
  FrameQueue,
  prefersLittleData,
  startFrameLoading,
  type LoadTier,
} from "@/lib/r360/frame-loading";

// #104 (A13, #68 decision 3): the visitor's frames, loaded the way
// lib/r360/frame-loading.ts decides — coarse to fine, through one queue
// for the page, decoded before they count, nothing before the tile is in
// view. What has loaded is remembered per set for the page's life, so a
// lightbox opened twice, or a tile scrolled out and back, starts from what
// it knows rather than from nothing.

export interface FrameLoader {
  /** Ordinals whose picture the browser has decoded. */
  loaded: ReadonlySet<number>;
}

/** One queue for every orbit on the page: three requests in the air. */
const pageQueue = new FrameQueue(3);

/** What each set (its first address stands for it) has loaded so far. */
const knownBySet = new Map<string, Set<number>>();

function knownOf(urls: readonly string[]): Set<number> {
  const key = urls[0] ?? "";
  let known = knownBySet.get(key);
  if (!known) {
    known = new Set();
    knownBySet.set(key, known);
  }
  return known;
}

/** The visitor's connection asks for little: the coarse tier is all. */
function connectionPrefersLittle(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return prefersLittleData(nav.connection);
}

/**
 * `urls` is the set's identity: a new array starts the loading over, so
 * the caller memoizes it for as long as the set is the same. Nothing is
 * fetched while `enabled` is false; the tier may widen at any time.
 */
export function useFrameLoader(
  urls: string[],
  startFrame: number,
  options: { enabled?: boolean; tier?: LoadTier } = {},
): FrameLoader {
  const { enabled = true, tier = "coarse" } = options;
  // The loaded set belongs to one `urls`: a new set starts from what the
  // page already knows of it — settled during render, as derived state is.
  const [snapshot, setSnapshot] = useState(() => ({
    urls,
    loaded: new Set(knownOf(urls)) as ReadonlySet<number>,
  }));
  if (snapshot.urls !== urls) {
    setSnapshot({ urls, loaded: new Set(knownOf(urls)) });
  }
  const loading = useRef<ReturnType<typeof startFrameLoading> | null>(null);

  useEffect(() => {
    if (!enabled || urls.length === 0) return;
    const known = knownOf(urls);
    // One render per animation frame, not per picture: the frames arrive
    // in bursts and each would otherwise be a commit of its own.
    let flush = 0;
    const started = startFrameLoading({
      urls,
      startFrame,
      tier: connectionPrefersLittle() ? "coarse" : tier,
      known,
      queue: pageQueue,
      createImage: () => new Image(),
      onLoaded: (ordinal) => {
        known.add(ordinal);
        if (flush) return;
        flush = window.requestAnimationFrame(() => {
          flush = 0;
          setSnapshot({ urls, loaded: new Set(known) });
        });
      },
    });
    loading.current = started;
    return () => {
      started.stop();
      loading.current = null;
      if (flush) window.cancelAnimationFrame(flush);
    };
    // The tier widens through setTier below; a new tier must not restart
    // the loading (which would refetch nothing but re-queue everything).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, startFrame, enabled]);

  useEffect(() => {
    if (tier === "all" && !connectionPrefersLittle()) {
      loading.current?.setTier("all");
    }
  }, [tier, urls, enabled]);

  return { loaded: snapshot.urls === urls ? snapshot.loaded : new Set() };
}
