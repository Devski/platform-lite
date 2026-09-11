"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  cueLabelSide,
  cueNear,
  shiftIntoBounds,
  type CueLabelSide,
} from "@/lib/r360/cues";
import type { R360Cue } from "@/lib/r360/frame-set-shared";
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
//
// #107: the cue points are diamonds on the ring — not the dot's circle —
// and a cue's label shows beside its marker: while the mouse is on it,
// while its button under the picture is pointed at or focused, and while
// the orbit stands on its frame. Touch has no hover, so there the first
// tap on a marker shows the label and a second one goes there. The
// buttons (orbit-cues.tsx) are the keyboard's and the screen reader's way
// to the cues; the markers are the pointer's extra on top of them.

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
/** #107: a cue's marker, a diamond round its point, and how much it grows lit. */
const CUE_MARK = "M0 -5 L5 0 L0 5 L-5 0 Z";
const CUE_LIT_SCALE = 1.45;
/** How near a marker, in screen pixels, a pointer is on it. */
const CUE_REACH_PX = 14;
/** The label's gap from its marker, and from the edge it must not cross. */
const LABEL_GAP_PX = 9;
const LABEL_MARGIN_PX = 4;
const LABEL_PLACE: Record<CueLabelSide, string> = {
  above: `translate(-50%, calc(-100% - ${LABEL_GAP_PX}px))`,
  right: `translate(${LABEL_GAP_PX}px, -50%)`,
  left: `translate(calc(-100% - ${LABEL_GAP_PX}px), -50%)`,
};

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
  cues = [],
  cuePreview = null,
  onCuePreview,
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
  /** #107: the work's cue points, a marker each. */
  cues?: readonly R360Cue[];
  /**
   * The cue pointed at, by frame — on the ring or on its button under the
   * picture: its marker is lit and its label shown. The state is the
   * parent's, because the buttons share it.
   */
  cuePreview?: number | null;
  onCuePreview?: (frame: number | null) => void;
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
  // #107: the marker the mouse is on, so leaving it clears only its own.
  const hovered = useRef<number | null>(null);
  // A touch's first tap on a marker: its label shows while the orbit stays
  // on the frame it was tapped at, and a second tap there goes to the cue.
  const [tapped, setTapped] = useState<{ cue: number; at: number } | null>(
    null,
  );
  const label = useRef<HTMLSpanElement>(null);

  /** The frame under a pointer, by its angle around the ring's centre. */
  const frameUnder = (clientX: number, clientY: number, box: DOMRect) => {
    if (!box.width || !box.height) return orbit.frame;
    const x = clientX - (box.left + box.width / 2);
    const y = clientY - (box.top + box.height / 2);
    return frameAtAngle(angleOfPoint(x, y, radiusX, radiusY), params);
  };

  /** The cue whose marker a pointer is on, or null. */
  const cueUnder = (clientX: number, clientY: number, box: DOMRect) => {
    if (cues.length === 0 || !box.width) return null;
    // The view box is scaled evenly into the box: one factor for both axes.
    const units = WIDTH / box.width;
    const pointer = {
      x: (clientX - (box.left + box.width / 2)) * units,
      y: (clientY - (box.top + box.height / 2)) * units,
    };
    return cueNear(
      cues,
      pointer,
      params,
      { radiusX, radiusY },
      CUE_REACH_PX * units,
    );
  };

  const hover = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "mouse" || !onCuePreview) return;
    const cue = cueUnder(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
    if (cue === hovered.current) return;
    hovered.current = cue;
    onCuePreview(cue);
  };
  const leave = () => {
    if (hovered.current === null) return;
    hovered.current = null;
    onCuePreview?.(null);
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
    if (!down) {
      hover(event);
      return;
    }
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
    if (down.dragged || event.type !== "pointerup") return;
    // A click, completed on the up. On a marker: its cue — on touch only
    // at the second tap, the first having shown its label.
    const cue = cueUnder(event.clientX, event.clientY, down.box);
    if (cue !== null) {
      const shown =
        tapped !== null && tapped.cue === cue && tapped.at === orbit.frame;
      if (event.pointerType !== "mouse" && !shown && cue !== orbit.frame) {
        setTapped({ cue, at: orbit.frame });
        return;
      }
      setTapped(null);
      orbit.travelAlong(travelPath(orbit.frame, cue, params));
      return;
    }
    // Anywhere else on the band: travel to the frame at that angle.
    setTapped(null);
    const to = frameUnder(event.clientX, event.clientY, down.box);
    orbit.travelAlong(travelPath(orbit.frame, to, params));
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
        // #125: a gap thinner than the line it is drawn with is not a gap
        // on screen, only a lump in the band.
        LOADED_STROKE,
      ),
    [loaded, params, radiusX, radiusY],
  );

  // #107: whose label shows — the cue pointed at, else the one tapped
  // while the orbit has not moved since, else the one the orbit is on.
  const tappedCue = tapped && tapped.at === orbit.frame ? tapped.cue : null;
  const labelFrame =
    cuePreview ??
    tappedCue ??
    (cues.some((cue) => cue.frame === orbit.frame) ? orbit.frame : null);
  const labelled = cues.find((cue) => cue.frame === labelFrame);
  const labelAt = labelled
    ? ringPoint(angleOfFrame(labelled.frame, params), radiusX, radiusY)
    : null;
  const labelSide = labelAt ? cueLabelSide(labelAt, radiusX, radiusY) : null;

  // The label may be wider than the room beside the ring — the card's
  // ring is a third of a narrow picture — so once it is laid out it is
  // moved back inside the picture, or the page, it would otherwise leave.
  useLayoutEffect(() => {
    const element = label.current;
    if (!element) return;
    element.style.translate = "";
    const bounds = element
      .closest("[data-orbit-bounds]")
      ?.getBoundingClientRect() ?? {
      left: 0,
      right: document.documentElement.clientWidth,
    };
    const shift = shiftIntoBounds(
      element.getBoundingClientRect(),
      bounds,
      LABEL_MARGIN_PX,
    );
    if (shift) element.style.translate = `${shift}px 0`;
  }, [labelled?.frame, labelled?.label, labelSide, radiusX, radiusY]);

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      // The viewer announces the frame; the ring is the same value, drawn.
      aria-hidden="true"
      data-testid="orbit-ring"
      data-frame={orbit.frame}
    >
      <div className="relative w-full">
        {/* The view box has its origin at the ring's centre: every point on
            the ring is drawn as ringPoint gives it. The svg itself takes no
            pointer — the band and the dot do. */}
        <svg
          viewBox={`${-WIDTH / 2} ${-height / 2} ${WIDTH} ${height}`}
          className={`block h-auto w-full ${grabbing ? "cursor-grabbing" : "cursor-pointer"}`}
          style={{ touchAction: "none", pointerEvents: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onPointerLeave={leave}
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
          {cues.map((cue) => {
            const at = ringPoint(
              angleOfFrame(cue.frame, params),
              radiusX,
              radiusY,
            );
            const lit = cue.frame === labelFrame;
            return (
              <path
                key={cue.frame}
                d={CUE_MARK}
                transform={`translate(${at.x} ${at.y})${lit ? ` scale(${CUE_LIT_SCALE})` : ""}`}
                fill="var(--action-solid)"
                stroke={look.dotRim}
                strokeWidth={1.5}
                strokeLinejoin="round"
                data-testid="orbit-ring-cue"
                data-cue-frame={cue.frame}
                data-lit={lit || undefined}
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
            pointerEvents="all"
          />
        </svg>
        {labelled && labelAt && labelSide && (
          <span
            ref={label}
            // The owner's words as written: not the eyebrow's capitals.
            className="pointer-events-none absolute z-10 w-max max-w-44 rounded-xs bg-n-950 px-1.5 py-0.5 text-center text-(length:--fs-xs) leading-tight font-medium text-balance text-white"
            style={{
              left: `${((labelAt.x + WIDTH / 2) / WIDTH) * 100}%`,
              top: `${((labelAt.y + height / 2) / height) * 100}%`,
              transform: LABEL_PLACE[labelSide],
            }}
            data-testid="orbit-ring-cue-label"
          >
            {labelled.label}
          </span>
        )}
      </div>
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
