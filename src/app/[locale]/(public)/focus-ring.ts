// The keyboard focus ring for the public pages, in a module of its own — and
// that is the whole point of the file.
//
// It used to live in session-panel.tsx, which carries "use client". A server
// component importing a value from a client module does not get the value: it
// gets a client reference, and interpolating that into a template literal
// stringifies the stub. The language switcher on the landing page therefore
// shipped `class="py-1 function(){throw Error("Attempted to call
// FOCUS_RING() from the server...")} ..."` — a valid class token, so nothing
// failed and axe had nothing to report, while the ring silently fell back to
// the browser's own outline.
//
// A plain module has no boundary to cross and both sides get the string.
// e2e/a11y.spec.ts pins it by the outline offset, which is what tells our ring
// apart from the browser default.
//
// gray-900 rather than the blue the rest of the app uses: the landing page is
// monochrome (Dawid, 06.09.2026), and a blue ring would be the one coloured
// thing on it.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";
