"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import {
  positionAfterKey,
  positionFromPointer,
  secondChannelClip,
  type RevealAxis,
} from "@/lib/channel-reveal";
import { Icon } from "./icon";

// #100: two channels of one photo, one revealed under the other. A handle
// moves along the picture (or across it) and the second channel shows up
// to the handle: at 0 the first channel alone, at 100 the second, at 50
// half and half. Drag anywhere on the picture, or take the handle with
// the keyboard (arrows, Page keys, Home, End). The axis is the viewer's
// choice, per look, never stored.
export function ChannelReveal({
  first,
  second,
  label,
  imageClassName = "",
  className = "",
}: {
  first: { src: string; alt: string };
  second: { src: string; alt: string };
  /** The slider's name for the screen reader: what the two channels are. */
  label: string;
  /** Sizing for the picture (the second channel copies it). */
  imageClassName?: string;
  className?: string;
}) {
  const t = useTranslations("Works.reveal");
  const [position, setPosition] = useState(50);
  const [axis, setAxis] = useState<RevealAxis>("x");
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const describedBy = useId();

  function moveTo(event: { clientX: number; clientY: number }) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(positionFromPointer(event, rect, axis));
  }

  const along = axis === "x";
  const percent = `${position}%`;

  return (
    <div className={`flex flex-col items-center gap-(--sp-3) ${className}`}>
      <div
        ref={box}
        className="relative inline-block touch-none select-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          box.current?.setPointerCapture(event.pointerId);
          setDragging(true);
          moveTo(event);
          handle.current?.focus({ preventScroll: true });
        }}
        onPointerMove={(event) => {
          if (dragging) moveTo(event);
        }}
        onPointerUp={(event) => {
          box.current?.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        {/* The first channel sets the size; the second is laid over it and
            cut past the handle. Both are the same view, so one box. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={first.src}
          alt={first.alt}
          draggable={false}
          className={`block ${imageClassName}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={second.src}
          alt={second.alt}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: secondChannelClip(position, axis) }}
        />
        {/* The divide, and the handle on it. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute bg-white/90 shadow-[0_0_0_1px_rgba(12,17,22,0.4)] ${
            along ? "top-0 bottom-0 w-0.5" : "right-0 left-0 h-0.5"
          }`}
          style={along ? { left: percent } : { top: percent }}
        />
        <div
          ref={handle}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation={along ? "horizontal" : "vertical"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={position}
          aria-valuetext={t("valueText", { percent: position })}
          aria-describedby={describedBy}
          onKeyDown={(event) => {
            const next = positionAfterKey(position, event.key, axis);
            if (next === null) return;
            event.preventDefault();
            setPosition(next);
          }}
          className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-${along ? "ew" : "ns"}-resize items-center justify-center rounded-full border border-white/40 bg-n-950/80 text-white shadow-md focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(12,17,22,.6),0_0_0_4px_#fff]`}
          style={
            along
              ? { left: percent, top: "50%" }
              : { top: percent, left: "50%" }
          }
        >
          <Icon name={along ? "chevron-left" : "chevron-up"} size={12} />
          <Icon name={along ? "chevron-right" : "chevron-down"} size={12} />
        </div>
      </div>
      <div className="flex items-center gap-(--sp-4) type-sm text-n-300">
        <span id={describedBy}>{t("hint")}</span>
        <button
          type="button"
          onClick={() => setAxis(along ? "y" : "x")}
          className="rounded-sm border border-white/30 px-(--sp-3) py-(--sp-1) type-eyebrow text-white hover:bg-white/10 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(12,17,22,.6),0_0_0_4px_#fff]"
        >
          {along ? t("axisAcross") : t("axisAlong")}
        </button>
      </div>
    </div>
  );
}
