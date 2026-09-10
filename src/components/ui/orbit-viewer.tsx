"use client";

import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { FramePictures } from "@/lib/r360/frame-pictures";
import { nearestLoaded, type OrbitParams } from "@/lib/r360/orbit";
import { useOrbit, type Orbit } from "./use-orbit";

// #103/#104 (A13): one frame at a time. The picture is the control: a
// horizontal drag turns the orbit (touch-action keeps a vertical one for
// the page), the keyboard steps it (#104), and the frame in view is the
// nearest one the browser can paint when the one asked for is not there
// yet — so the orbit is usable while the frames are still arriving, in the
// owner's form and on the visitor's page alike. The ring dial is #106.
//
// #117: the frames are painted onto a canvas, not into an <img> whose src
// changes. Changing src empties the element until the new picture has been
// fetched and decoded — measured in Chrome, a frame that element has never
// shown is unpainted on the next animation frame — so a turn round the
// orbit flashed the ground between every pair of frames. drawImage of a
// decoded picture is synchronous and cannot flash. The <img> stays as the
// poster: it is what the server renders, what a crawler and a visitor
// without script get, and what shows until the first frame is decoded.

export interface OrbitViewerProps {
  params: OrbitParams;
  /** What the picture is, for the screen reader. */
  alt: string;
  /** The control's name: what dragging does. */
  label: string;
  /** A prepared hand on the orbit, when the parent needs the frame too. */
  orbit?: Orbit;
  /**
   * The decoded frames, ready to paint (#117). Without it the viewer shows
   * the poster alone — the state before any script has loaded a frame.
   */
  pictures?: FramePictures;
  /**
   * A frame shown whatever is loaded — the start frame the server renders
   * as the poster, so the page has a picture before any script runs.
   */
  poster?: number;
  /**
   * The poster's address. The lightbox gives the card's cached 800 px
   * start frame, so it paints at once while the 1600 px set is still on
   * its way (#104 review).
   */
  posterSrc?: string;
  /** The poster's fetch: lazy below the fold, eager for the page's first. */
  posterLoading?: "lazy" | "eager";
  imageClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

export function OrbitViewer({
  params,
  alt,
  label,
  orbit: given,
  pictures,
  poster,
  posterSrc,
  posterLoading = "lazy",
  imageClassName = "",
  className = "",
  children,
}: OrbitViewerProps) {
  const t = useTranslations("Works.orbit");
  const own = useOrbit(params);
  const orbit = given ?? own;
  const nearest = pictures
    ? nearestLoaded(orbit.frame, pictures, params)
    : null;
  const picture = nearest === null ? undefined : pictures?.get(nearest);
  const shown = nearest ?? poster;

  const canvas = useRef<HTMLCanvasElement>(null);
  // The store keeps the frames around the one in view: it evicts when a
  // picture arrives, so it needs to know where the orbit is by then.
  useEffect(() => {
    pictures?.focus(orbit.frame);
  }, [pictures, orbit.frame]);
  // BEFORE the browser paints the commit, not after: a passive effect
  // would let the frame the render replaced (or, on the first frame, an
  // empty canvas where the poster had been) reach the screen for a beat —
  // the very flash this change removes.
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element || !picture) return;
    const context = element.getContext("2d");
    if (!context) return;
    try {
      // Cleared first: a render exported with transparency encodes to a
      // WebP with an alpha channel, and the frame before would otherwise
      // show through it.
      context.clearRect(0, 0, element.width, element.height);
      context.drawImage(picture.source, 0, 0, picture.width, picture.height);
    } catch {
      // The store closed this bitmap between the render and here — the
      // owner removed the archive, or it was evicted. The next render
      // paints whatever is resident; a blank beat beats a broken form.
    }
  }, [picture]);

  return (
    <div
      className={`relative select-none focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--surface-card),inset_0_0_0_5px_var(--focus-ring)] ${orbit.dragging ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      style={{ touchAction: "pan-y" }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={params.frameCount}
      aria-valuenow={orbit.frame}
      aria-valuetext={
        shown && shown !== orbit.frame
          ? t("frameOfShowing", {
              frame: orbit.frame,
              total: params.frameCount,
              shown,
            })
          : t("frameOf", { frame: orbit.frame, total: params.frameCount })
      }
      aria-orientation="horizontal"
      data-testid="orbit-viewer"
      data-frame={orbit.frame}
      {...orbit.handlers}
    >
      {picture ? (
        <canvas
          ref={canvas}
          // Sized in the markup, so the first commit already has the
          // frame's pixels rather than the 300x150 a canvas defaults to.
          // The element is laid out by CSS exactly as the poster is
          // (object-fit), so the browser scales it the way it scales an
          // image.
          width={picture.width}
          height={picture.height}
          // The value is the slider's; the canvas is that value drawn.
          role="img"
          aria-label={alt}
          data-testid="orbit-canvas"
          className={`block h-full w-full object-contain ${imageClassName}`}
        />
      ) : posterSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterSrc}
          alt={alt}
          draggable={false}
          loading={posterLoading}
          decoding="async"
          className={`block h-full w-full object-contain ${imageClassName}`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-(--surface-sunken) type-sm text-(--text-muted) ${imageClassName}`}
        >
          {t("loading")}
        </div>
      )}
      {children}
    </div>
  );
}
