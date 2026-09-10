"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import type { OrbitParams } from "@/lib/r360/orbit";
import {
  angleOfFrame,
  angleOfPoint,
  frameAtAngle,
  loadedRuns,
  loadedRunsPath,
  ringPoint,
  ringRadii,
  travelPath,
} from "@/lib/r360/ring";
import type { Orbit } from "./use-orbit";

// #106 (A13, #68 decisions 2 and 3): the ring dial. An ellipse — a circle
// flattened to the elevation the render camera had — with the start frame
// at the bottom and a dot where the orbit is; the ring is the visitor's
// progress bar too, what has loaded drawn as a thicker arc over the
// translucent ring (#117 — the arithmetic is in lib/r360/ring.ts).
// The ring is absolute: the pointer's angle picks the frame. A click makes
// the dot travel along the shorter arc with the frames changing on the
// way (a tie goes the work's way) — the travel itself lives in the orbit
// hand, so a grab on the picture or a key ends it; a grab on the ring
// follows the pointer; reduced motion jumps. Only the band of the ring is
// the target: the picture under the rest keeps its drag and the page its
// scroll (#106 review). The viewer beside it is the control a screen
// reader and the keyboard use — the ring is the same value drawn, hidden
// from assistive technology rather than announced twice.

const WIDTH = 200;
/** Room past the arc for the dot (radius 6 plus its 2-wide stroke). */
const PADDING = 8;
/** The ring's own line, and the thicker one drawn over what has loaded. */
const RING_STROKE = 2;
const LOADED_STROKE = 5;
/** How far the dark halo reaches past the line it sits under. */
const HALO_WIDEN = 3;
/** The band around the arc that takes the pointer: a thumb's width. */
const HIT_BAND = 36;
/** A tap moves this little between down and up; more is a drag. */
const TAP_SLOP_PX = 6;

// The ring's two grounds: over a picture (the gallery overlay) or on the
// page (the owner's preview) — the strokes and the counter chip differ.
// Over a picture the ring and its loaded arc get a dark halo, or a white
// sky at the foot of a render would swallow them.
const TONES = {
  dark: {
    stroke: "#fff",
    halo: "rgb(12 17 22 / 0.5)",
    dotRim: "#fff",
    counter: "rounded-full bg-n-950 px-2 text-white",
  },
  light: {
    stroke: "var(--text-strong)",
    halo: null,
    dotRim: "var(--surface-card)",
    counter: "text-(--text-muted)",
  },
} as const;

export function OrbitRing({
  orbit,
  params,
  loaded,
  flattening,
  className = "",
  tone = "dark",
  counter = true,
}: {
  orbit: Orbit;
  params: OrbitParams;
  /** Ordinals whose frame is loaded: the arc drawn over the ring. */
  loaded: ReadonlySet<number>;
  /** 1 = a circle, down to 0.15. */
  flattening: number;
  className?: string;
  /** Over a picture or on a dark ground ("dark"), or on the page ("light"). */
  tone?: "dark" | "light";
  /** The "n / N" under the ring; off where another counter is near. */
  counter?: boolean;
}) {
  const t = useTranslations("Works.orbit");
  const look = TONES[tone];
  const { radiusX, radiusY } = ringRadii(WIDTH - 2 * PADDING, flattening);
  const height = 2 * (radiusY + PADDING);
  const [grabbing, setGrabbing] = useState(false);
  // The pointer down on the ring: where, and whether it became a drag.
  const press = useRef<{
    x: number;
    y: number;
    box: DOMRect;
    dragged: boolean;
  } | null>(null);

  /** The frame under a pointer, by its angle around the ring's centre. */
  const frameUnder = (clientX: number, clientY: number, box: DOMRect) => {
    if (!box.width || !box.height) return orbit.frame;
    const x = clientX - (box.left + box.width / 2);
    const y = clientY - (box.top + box.height / 2);
    return frameAtAngle(angleOfPoint(x, y, radiusX, radiusY), params);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    orbit.cancelTravel();
    press.current = {
      x: event.clientX,
      y: event.clientY,
      box: event.currentTarget.getBoundingClientRect(),
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setGrabbing(true);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const down = press.current;
    if (!down) return;
    // A tap moves a little between down and up; only more is a grab that
    // follows the pointer — else a finger's own jitter would turn every
    // click into a jump.
    if (
      !down.dragged &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP_PX
    ) {
      return;
    }
    down.dragged = true;
    orbit.setFrame(frameUnder(event.clientX, event.clientY, down.box));
  };
  const release = (event: React.PointerEvent<SVGSVGElement>) => {
    const down = press.current;
    if (!down) return;
    press.current = null;
    setGrabbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // A click, completed on the up: travel to the frame at that angle.
    if (!down.dragged && event.type === "pointerup") {
      const to = frameUnder(event.clientX, event.clientY, down.box);
      orbit.travelAlong(travelPath(orbit.frame, to, params));
    }
  };

  const dot = ringPoint(angleOfFrame(orbit.frame, params), radiusX, radiusY);
  // #117: what has loaded, drawn along the ring — see loadedRuns.
  const loadedPath = useMemo(
    () =>
      loadedRunsPath(
        loadedRuns(loaded, params.frameCount),
        params,
        radiusX,
        radiusY,
      ),
    [loaded, params, radiusX, radiusY],
  );

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      // The viewer announces the frame; the ring is the same value, drawn.
      aria-hidden="true"
      data-testid="orbit-ring"
      data-frame={orbit.frame}
    >
      {/* The view box has its origin at the ring's centre: every point on
          the ring is drawn as ringPoint gives it. The svg itself takes no
          pointer — the band and the dot do. */}
      <svg
        viewBox={`${-WIDTH / 2} ${-height / 2} ${WIDTH} ${height}`}
        className={`h-auto w-full ${grabbing ? "cursor-grabbing" : "cursor-pointer"}`}
        style={{ touchAction: "none", pointerEvents: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <ellipse
          cx={0}
          cy={0}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_BAND}
          pointerEvents="stroke"
          data-testid="orbit-ring-band"
        />
        {look.halo && (
          <>
            <ellipse
              cx={0}
              cy={0}
              rx={radiusX}
              ry={radiusY}
              fill="none"
              stroke={look.halo}
              strokeWidth={RING_STROKE + HALO_WIDEN}
            />
            <path
              d={loadedPath}
              fill="none"
              stroke={look.halo}
              strokeWidth={LOADED_STROKE + HALO_WIDEN}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        <ellipse
          cx={0}
          cy={0}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke={look.stroke}
          strokeOpacity={0.3}
          strokeWidth={RING_STROKE}
        />
        <path
          d={loadedPath}
          fill="none"
          stroke={look.stroke}
          strokeWidth={LOADED_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-testid="orbit-ring-loaded"
        />
        <circle
          cx={dot.x}
          cy={dot.y}
          r={6}
          fill="var(--action-solid)"
          stroke={look.dotRim}
          strokeWidth={2}
          pointerEvents="all"
        />
      </svg>
      {counter && (
        <span
          className={`font-mono type-eyebrow tabular-nums ${look.counter}`}
          data-testid="orbit-counter"
        >
          {t("counter", { frame: orbit.frame, total: params.frameCount })}
        </span>
      )}
    </div>
  );
}
