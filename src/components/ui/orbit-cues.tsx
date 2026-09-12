"use client";

import type { R360Cue } from "@/lib/r360/frame-set-shared";
import type { OrbitParams } from "@/lib/r360/orbit";
import { travelPath } from "@/lib/r360/ring";
import type { Orbit } from "./use-orbit";

// #107 (A13; Dawid's pick of 11.09.2026, A and B together): the cue
// points as a row of buttons under the picture. A press travels the orbit
// there the way a click on the ring does; the button of the cue the orbit
// stands on is marked; pointing at one, or focusing it from the keyboard,
// lights its marker on the ring and shows its label there. The row works
// with no ring at all — a phone's public page shows none (Dawid,
// 11.09.2026), and once the redesign keeps the ring for the enlarged view
// the profile page will not either — and it is the keyboard's and the
// screen reader's way to the cues everywhere.

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

/**
 * Whether an element's focus shows — the keyboard's, not a press's. An
 * engine that does not know :focus-visible counts every focus.
 */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

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
        // #175: where the orbit was ASKED to be — the frame it is travelling
        // to while it travels, the frame it stands on otherwise. Lighting
        // the current frame instead meant a press did nothing until the
        // orbit arrived, and that every cue a travel crossed on the way lit
        // for the single frame it stood there: a blink, not a signal.
        const here = cue.frame === (orbit.aimedAt ?? orbit.frame);
        // Crossed on the way to somewhere else: a pulse says the orbit went
        // by, and says it in a ring rather than in the tones, which cannot
        // fade between each other without passing through colours that
        // cannot be read (#107, caught by axe in the lightbox).
        const passing = orbit.aimedAt !== null && cue.frame === orbit.frame;
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
              // Only the keyboard's focus points at a cue. A button pressed
              // keeps the focus after the press, on a phone through any
              // drag after it, and would keep its label on the ring
              // wherever the orbit went next.
              onFocus={(event) => {
                if (focusVisible(event.currentTarget)) onPreview(cue.frame);
              }}
              onBlur={() => {
                if (preview === cue.frame) onPreview(null);
              }}
              // No colour transition: the mark follows the orbit frame by
              // frame, a readout like the counter, and a fade between the
              // two tones passes through ones that cannot be read (axe
              // caught one mid-way in the lightbox).
              data-passing={passing ? "" : undefined}
              className={`inline-flex min-h-8 cursor-pointer items-center gap-(--sp-3) rounded-full border px-(--sp-4) type-label focus-visible:outline-none data-passing:animate-cue-pulse motion-reduce:data-passing:animate-none ${look.focus} ${state}`}
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
