"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbitParams } from "@/lib/r360/orbit";
import {
  angleOfFrame,
  angleOfPoint,
  frameAtAngle,
  ringPoint,
  ringRadii,
  travelPath,
} from "@/lib/r360/ring";
import type { Orbit } from "./use-orbit";

// #106 (A13, #68 decisions 2 and 3): the ring dial. An ellipse — a circle
// flattened to the elevation the render camera had — with the start frame
// at the bottom and a dot where the orbit is; the ring is the visitor's
// progress bar too, each loaded frame a solid tick on the translucent arc.
// The ring is absolute: the pointer's angle picks the frame. A click makes
// the dot travel along the shorter arc with the frames changing on the
// way (a tie goes the work's way); a grab cancels the travel; reduced
// motion jumps. The viewer beside it is the control a screen reader and
// the keyboard use — the ring is a second, visual hand on the same value,
// so it is hidden from assistive technology rather than announced twice.

const WIDTH = 200;
/** Room past the arc for the dot (radius 6 plus its 2-wide stroke). */
const PADDING = 8;
/** Half a tick: the tick straddles the arc by this much either side. */
const TICK = 3;
const TRAVEL_MS_PER_FRAME = 28;

// The ring's two grounds: over a picture (the gallery overlay) or on the
// page (the owner's preview) — the strokes and the counter chip differ.
const TONES = {
  dark: {
    stroke: "#fff",
    dotRim: "#fff",
    counter: "rounded-full bg-n-950 px-2 text-white",
  },
  light: {
    stroke: "var(--text-strong)",
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
}: {
  orbit: Orbit;
  params: OrbitParams;
  /** Ordinals whose frame is loaded: the ticks. */
  loaded: ReadonlySet<number>;
  /** 1 = a circle, down to 0.15. */
  flattening: number;
  className?: string;
  /** Over a picture or on a dark ground ("dark"), or on the page ("light"). */
  tone?: "dark" | "light";
}) {
  const t = useTranslations("Works.orbit");
  const look = TONES[tone];
  const { radiusX, radiusY } = ringRadii(WIDTH - 2 * PADDING, flattening);
  const height = 2 * (radiusY + PADDING);
  const [grabbing, setGrabbing] = useState(false);

  // The travel in flight is one pending timer: each step schedules the
  // next, so clearing the pending one stops the whole travel — on a grab,
  // a new click, or the component going away.
  const travelTimer = useRef<number | undefined>(undefined);
  const cancelTravel = useCallback(
    () => window.clearTimeout(travelTimer.current),
    [],
  );
  useEffect(() => cancelTravel, [cancelTravel]);

  const travelTo = (to: number) => {
    cancelTravel();
    const path = travelPath(orbit.frame, to, params);
    if (path.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      orbit.setFrame(to);
      return;
    }
    const step = (at: number) => {
      orbit.setFrame(path[at]);
      if (at + 1 < path.length) {
        travelTimer.current = window.setTimeout(
          () => step(at + 1),
          TRAVEL_MS_PER_FRAME,
        );
      }
    };
    travelTimer.current = window.setTimeout(() => step(0), TRAVEL_MS_PER_FRAME);
  };

  /**
   * The frame under a pointer, by its angle around the ring's centre. The
   * angle needs only the pointer's direction from the centre of the box
   * — which the SVG keeps at the ring's centre — not its distance, so the
   * client pixels go in as they are.
   */
  const frameUnder = (event: React.PointerEvent<SVGSVGElement>): number => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    return frameAtAngle(angleOfPoint(x, y, radiusX, radiusY), params);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setGrabbing(true);
    // A click travels; a drag that follows takes over from the first move.
    travelTo(frameUnder(event));
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!grabbing) return;
    cancelTravel();
    orbit.setFrame(frameUnder(event));
  };
  const release = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!grabbing) return;
    setGrabbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const dot = ringPoint(angleOfFrame(orbit.frame, params), radiusX, radiusY);

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      // The viewer announces the frame; the ring is the same value, drawn.
      aria-hidden="true"
      data-testid="orbit-ring"
      data-frame={orbit.frame}
    >
      {/* The view box has its origin at the ring's centre: every point on
          the ring is drawn as ringPoint gives it. */}
      <svg
        viewBox={`${-WIDTH / 2} ${-height / 2} ${WIDTH} ${height}`}
        className={`h-auto w-full ${grabbing ? "cursor-grabbing" : "cursor-pointer"}`}
        style={{ touchAction: "none" }}
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
          stroke={look.stroke}
          strokeOpacity={0.3}
          strokeWidth={2}
        />
        {/* Each loaded frame a solid tick on the arc; the centre stays free. */}
        {[...loaded].map((frame) => {
          const angle = angleOfFrame(frame, params);
          const inner = ringPoint(angle, radiusX - TICK, radiusY - TICK);
          const outer = ringPoint(angle, radiusX + TICK, radiusY + TICK);
          return (
            <line
              key={frame}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={look.stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        <circle
          cx={dot.x}
          cy={dot.y}
          r={6}
          fill="var(--action-solid)"
          stroke={look.dotRim}
          strokeWidth={2}
        />
      </svg>
      <span
        className={`font-mono type-eyebrow tabular-nums ${look.counter}`}
        data-testid="orbit-counter"
      >
        {t("counter", { frame: orbit.frame, total: params.frameCount })}
      </span>
    </div>
  );
}
