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
const TRAVEL_MS_PER_FRAME = 28;

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
  const { radiusX, radiusY } = ringRadii(WIDTH - 16, flattening);
  const height = radiusY * 2 + 16;
  const centre = { x: WIDTH / 2, y: height / 2 };
  const svg = useRef<SVGSVGElement>(null);
  const [grabbing, setGrabbing] = useState(false);

  // The travel in flight: one frame per tick along the path, cancelled
  // by a grab, a new click, or the component going away.
  const travel = useRef<{ path: number[]; at: number; timer: number } | null>(
    null,
  );
  const cancelTravel = useCallback(() => {
    if (travel.current) window.clearTimeout(travel.current.timer);
    travel.current = null;
  }, []);
  useEffect(() => cancelTravel, [cancelTravel]);

  const travelTo = useCallback(
    (to: number) => {
      cancelTravel();
      const path = travelPath(orbit.frame, to, params);
      if (path.length === 0) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        orbit.setFrame(to);
        return;
      }
      const tick = () => {
        const current = travel.current;
        if (!current) return;
        orbit.setFrame(current.path[current.at]);
        current.at += 1;
        if (current.at >= current.path.length) {
          travel.current = null;
          return;
        }
        current.timer = window.setTimeout(tick, TRAVEL_MS_PER_FRAME);
      };
      travel.current = {
        path,
        at: 0,
        timer: window.setTimeout(tick, TRAVEL_MS_PER_FRAME),
      };
    },
    [cancelTravel, orbit, params],
  );

  /** The frame under a pointer, by its angle around the ring's centre. */
  const frameUnder = useCallback(
    (event: React.PointerEvent<SVGSVGElement>): number => {
      const box = event.currentTarget.getBoundingClientRect();
      const scale = box.width / WIDTH;
      const x = (event.clientX - box.left) / scale - centre.x;
      const y = (event.clientY - box.top) / scale - centre.y;
      return frameAtAngle(angleOfPoint(x, y, radiusX, radiusY), params);
    },
    [centre.x, centre.y, radiusX, radiusY, params],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    cancelTravel();
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
  const stroke = tone === "dark" ? "#fff" : "var(--text-strong)";

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      // The viewer announces the frame; the ring is the same value, drawn.
      aria-hidden="true"
      data-testid="orbit-ring"
      data-frame={orbit.frame}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className={`h-auto w-full ${grabbing ? "cursor-grabbing" : "cursor-pointer"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <ellipse
          cx={centre.x}
          cy={centre.y}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke={stroke}
          strokeOpacity={0.3}
          strokeWidth={2}
        />
        {/* Each loaded frame a solid tick on the arc; the centre stays free. */}
        {[...loaded].map((frame) => {
          const angle = angleOfFrame(frame, params);
          const inner = ringPoint(angle, radiusX - 3, radiusY - 3);
          const outer = ringPoint(angle, radiusX + 3, radiusY + 3);
          return (
            <line
              key={frame}
              x1={centre.x + inner.x}
              y1={centre.y + inner.y}
              x2={centre.x + outer.x}
              y2={centre.y + outer.y}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        <circle
          cx={centre.x + dot.x}
          cy={centre.y + dot.y}
          r={6}
          fill="var(--action-solid)"
          stroke={tone === "dark" ? "#fff" : "var(--surface-card)"}
          strokeWidth={2}
        />
      </svg>
      <span
        className={`font-mono type-eyebrow tabular-nums ${tone === "dark" ? "rounded-full bg-n-950 px-2 text-white" : "text-(--text-muted)"}`}
        data-testid="orbit-counter"
      >
        {t("counter", { frame: orbit.frame, total: params.frameCount })}
      </span>
    </div>
  );
}
