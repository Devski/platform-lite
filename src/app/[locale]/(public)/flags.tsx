import { useId } from "react";

// Flags as inline SVG, not emoji. 🇵🇱 and 🇬🇧 are pairs of regional-indicator
// letters, and Windows ships no glyphs for them: Chrome on Windows draws them
// as the literal letters "PL" and "GB" — which is exactly the row of letters
// these are meant to replace (Dawid, 06.09.2026). Inline rather than files,
// so there is no second request and nothing to allow through the CSP.
//
// Decorative in both cases: every flag here sits beside the language's own
// name, which is what a screen reader reads. A flag on its own would name a
// country anyway, not a language.

const FRAME = "h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-gray-300";

export function FlagPl() {
  return (
    <svg
      viewBox="0 0 16 10"
      className={FRAME}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="16" height="5" fill="#fff" />
      <rect y="5" width="16" height="5" fill="#d4213d" />
    </svg>
  );
}

export function FlagGb() {
  // The red diagonals are offset, not centred, on each white one — that is
  // the one detail a hand-drawn Union Jack always gets wrong. The clip path
  // is what does it, and its id has to be unique on the page, hence useId.
  const clip = useId();
  return (
    <svg
      viewBox="0 0 60 30"
      className={FRAME}
      aria-hidden="true"
      focusable="false"
    >
      <clipPath id={clip}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath={`url(#${clip})`}
        stroke="#c8102e"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
