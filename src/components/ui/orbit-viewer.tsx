"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { nearestLoaded, type OrbitParams } from "@/lib/r360/orbit";
import { useOrbit, type Orbit } from "./use-orbit";

// #103/#104 (A13): one frame at a time. The picture is the control: a
// horizontal drag turns the orbit (touch-action keeps a vertical one for
// the page), the keyboard steps it (#104), and the frame in view is the
// nearest one loaded when the one asked for is not there yet — so the
// orbit is usable while the frames are still arriving, in the owner's
// form and on the visitor's page alike. The ring dial is #106.

export interface OrbitViewerProps {
  /** `frames[ordinal - 1]`: the frame's address, or null until it has one. */
  frames: readonly (string | null)[];
  params: OrbitParams;
  /** What the picture is, for the screen reader. */
  alt: string;
  /** The control's name: what dragging does. */
  label: string;
  /** A prepared hand on the orbit, when the parent needs the frame too. */
  orbit?: Orbit;
  imageClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

export function OrbitViewer({
  frames,
  params,
  alt,
  label,
  orbit: given,
  imageClassName = "",
  className = "",
  children,
}: OrbitViewerProps) {
  const t = useTranslations("Works.orbit");
  const own = useOrbit(params);
  const orbit = given ?? own;
  const loaded = useMemo(
    () =>
      new Set(
        frames.flatMap((url, index) => (url ? [index + 1] : [])),
      ),
    [frames],
  );
  const shown = nearestLoaded(orbit.frame, loaded, params);
  const src = shown === null ? null : frames[shown - 1];

  return (
    <div
      className={`relative select-none focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] ${orbit.dragging ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      style={{ touchAction: "pan-y" }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={params.frameCount}
      aria-valuenow={orbit.frame}
      aria-valuetext={t("frameOf", {
        frame: orbit.frame,
        total: params.frameCount,
      })}
      aria-orientation="horizontal"
      data-testid="orbit-viewer"
      data-frame={orbit.frame}
      {...orbit.handlers}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
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
