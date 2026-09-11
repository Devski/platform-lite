"use client";

import type { R360Cue } from "@/lib/r360/frame-set-shared";
import type { OrbitParams } from "@/lib/r360/orbit";
import { travelPath } from "@/lib/r360/ring";
import type { Orbit } from "./use-orbit";

// #107 (A13; Dawid's pick of 11.09.2026, A and B together): the cue
// points as a row of buttons under the picture. A press travels the orbit
// there the way a click on the ring does; the button of the cue the orbit
// stands on is marked; pointing at one, or focusing it, lights its marker
// on the ring and shows its label there. The row works with no ring at
// all — on phones, and on the profile page once the redesign keeps the
// ring for the enlarged view, it is the only way to the cues — and it is
// the keyboard's and the screen reader's way to them everywhere.

// A button's three states, each a whole set of colours: two utilities for
// one property in a class list are settled by the stylesheet's order, not
// the list's.
const TONES = {
  light: {
    rest: "border-transparent bg-(--surface-sunken) text-(--text-body) hover:border-(--border-strong)",
    lit: "border-(--border-strong) bg-(--surface-sunken) text-(--text-body)",
    here: "border-transparent bg-(--action-solid) text-(--action-solid-text)",
    focus: "focus-visible:shadow-[var(--ring-focus)]",
  },
  dark: {
    rest: "border-white/30 bg-white/10 text-white hover:bg-white/20",
    lit: "border-white/30 bg-white/20 text-white",
    here: "border-transparent bg-white text-n-950",
    focus: "focus-visible:shadow-[var(--ring-focus-inverse)]",
  },
} as const;

export function OrbitCueButtons({
  cues,
  orbit,
  params,
  preview,
  onPreview,
  label,
  tone = "light",
  className = "",
}: {
  /** In the order they are shown: cuesInOrder's. */
  cues: readonly R360Cue[];
  orbit: Orbit;
  params: OrbitParams;
  /** The cue pointed at, by frame — shared with the ring's markers. */
  preview: number | null;
  onPreview: (frame: number | null) => void;
  /** The row's name for the screen reader: whose cues these are. */
  label: string;
  /** On the page ("light"), or on the lightbox's dark ground ("dark"). */
  tone?: "light" | "dark";
  className?: string;
}) {
  if (cues.length === 0) return null;
  const look = TONES[tone];
  return (
    <ul
      aria-label={label}
      className={`flex flex-wrap gap-(--sp-2) ${className}`}
      data-testid="orbit-cues"
    >
      {cues.map((cue) => {
        const here = cue.frame === orbit.frame;
        const state = here
          ? look.here
          : cue.frame === preview
            ? look.lit
            : look.rest;
        return (
          <li key={cue.frame}>
            <button
              type="button"
              aria-current={here ? "true" : undefined}
              onClick={() =>
                orbit.travelAlong(travelPath(orbit.frame, cue.frame, params))
              }
              // Touch has no hover: a tap is only the press.
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") onPreview(cue.frame);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") onPreview(null);
              }}
              onFocus={() => onPreview(cue.frame)}
              onBlur={() => onPreview(null)}
              className={`inline-flex min-h-8 items-center gap-(--sp-3) rounded-full border px-(--sp-4) type-label transition-colors focus-visible:outline-none ${look.focus} ${state}`}
            >
              {/* The ring's marker, in small: this button is that diamond. */}
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rotate-45 rounded-[1px] bg-current"
              />
              {cue.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
