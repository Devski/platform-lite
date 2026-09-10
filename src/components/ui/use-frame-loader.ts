"use client";

import { useEffect, useRef, useState } from "react";
import {
  FrameQueue,
  prefersLittleData,
  startFrameLoading,
} from "@/lib/r360/frame-loading";
import { FramePictures } from "@/lib/r360/frame-pictures";

// #104 (A13, #68 decision 3): the visitor's frames, loaded the way
// lib/r360/frame-loading.ts decides — coarse to fine, through one queue
// for the page, decoded before they count, nothing before the tile is in
// view. What has loaded is remembered per set for the page's life, so a
// lightbox opened twice, or a tile scrolled out and back, starts from what
// it knows rather than from nothing.
//
// #117: the decoded picture is kept, not dropped. It used to be thrown
// away the moment it had been decoded, which left only the browser's file
// cache — so every frame had to be decoded again the first time the
// viewer showed it, and the <img> stood empty meanwhile. Now the pictures
// go into a store the viewer paints onto a canvas. A visitor's frames are
// never evicted from it (see elementPicture); what bounds them is the
// number of sets kept.

export interface FrameLoader {
  /** Ordinals the browser has fetched and decoded: the ring's filled arc. */
  loaded: ReadonlySet<number>;
  /** Those of them still resident, ready to paint (#117). */
  pictures: FramePictures;
}

/** One queue for every orbit on the page: three requests in the air. */
const pageQueue = new FrameQueue(3);

/** What each set (its first address stands for it) has loaded so far. */
const knownBySet = new Map<string, Set<number>>();
/** And the decoded pictures it still holds, for the page's life. */
const picturesBySet = new Map<string, FramePictures>();

/**
 * Sets kept at once. A profile shows ten works at most (A12), each with an
 * orbit at two widths, so a page never reaches this — the cap is against a
 * session that walks from profile to profile without a reload, where the
 * sets of every profile behind it would otherwise be held for good. The
 * oldest goes first, and a visitor who walks back simply fetches it again.
 */
const SETS_KEPT = 20;

/**
 * Both maps live for the page, so on the SERVER they must not be touched:
 * a render there would leave a set in them for the life of the process,
 * once per visitor. Nothing is painted server-side anyway.
 */
function shared(): boolean {
  return typeof window !== "undefined";
}

function knownOf(urls: readonly string[]): Set<number> {
  const key = urls[0] ?? "";
  if (!shared()) return new Set();
  let known = knownBySet.get(key);
  if (!known) {
    known = new Set();
    knownBySet.set(key, known);
  }
  return known;
}

function picturesOf(urls: readonly string[]): FramePictures {
  const key = urls[0] ?? "";
  if (!shared()) return new FramePictures(urls.length);
  const held = picturesBySet.get(key);
  if (held && held.frameCount === urls.length) return held;
  const made = new FramePictures(urls.length);
  picturesBySet.set(key, made);
  for (const stale of picturesBySet.keys()) {
    if (picturesBySet.size <= SETS_KEPT) break;
    picturesBySet.get(stale)?.clear();
    picturesBySet.delete(stale);
  }
  return made;
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
 * fetched while `enabled` is false.
 *
 * #123: an orbit in view loads its WHOLE set, without waiting to be
 * touched. It used to stop at every 8th frame until a pointer, a key or
 * focus arrived — so an orbit nobody touched never filled, and one that
 * was touched showed a picture that moved in jumps of eight while the
 * ring's arc said the frames were there. What stays is the order (coarse
 * first, so the orbit is usable after a dozen requests either way), the
 * in-view gate (a profile may carry ten orbits) and the escape hatch for
 * a connection that asked for little, which is a different question from
 * whether the mouse moved.
 */
export function useFrameLoader(
  urls: string[],
  startFrame: number,
  options: { enabled?: boolean } = {},
): FrameLoader {
  const { enabled = true } = options;
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
  const pictures = picturesOf(urls);

  useEffect(() => {
    if (!enabled || urls.length === 0) return;
    const known = knownOf(urls);
    const held = picturesOf(urls);
    // One render per animation frame, not per picture: the frames arrive
    // in bursts and each would otherwise be a commit of its own.
    let flush = 0;
    const started = startFrameLoading({
      urls,
      startFrame,
      tier: connectionPrefersLittle() ? "coarse" : "all",
      known,
      queue: pageQueue,
      createImage: () => new Image(),
      onLoaded: (ordinal, picture) => {
        known.add(ordinal);
        held.put(ordinal, elementPicture(picture));
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
  }, [urls, startFrame, enabled]);

  return {
    loaded: snapshot.urls === urls ? snapshot.loaded : new Set(),
    pictures,
  };
}

/**
 * An <img> the loader decoded, as the store counts it: NOTHING. The
 * element is a handle, not a buffer — the browser decides whether to keep
 * the decoded pixels behind it and re-decodes on demand, which blocks a
 * frame rather than blanking one, and the bytes are in its own cache
 * either way. Charging it would make the store evict a frame the visitor
 * can still see for nothing, and the orbit would stick on the far side of
 * a long set. The budget is there for the owner's ImageBitmaps (#117),
 * which really do hold their pixels until they are closed.
 */
function elementPicture(source: HTMLImageElement) {
  return {
    source,
    width: source.naturalWidth,
    height: source.naturalHeight,
    bytes: 0,
  };
}
