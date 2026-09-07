// The seven auth screens are one shell: a centered column holding a compact
// logo, a card with a heading and a form, and a footer line. They were drawn
// desktop-first, so the mobile pass lives here rather than being retyped on
// each page — a screen that drifts out of the family is then a visible import
// change, not a silent edit to one class string out of seven.

/** Page frame. The horizontal gutter tracks the top bar's (16px below sm,
 *  24px from sm): on a 390px phone 24px each side spends an eighth of the
 *  screen on margin. Vertical padding is unchanged at every width — the
 *  column is centered and never wanted the room back. svh, not vh: mobile
 *  Chrome sizes vh to the viewport with its address bar hidden, so a 100vh
 *  frame is taller than what is actually on screen and these short pages
 *  scrolled a bar's worth with nothing underneath. svh is the smallest
 *  viewport height, and on a desktop the two are the same number. */
export const AUTH_MAIN =
  "flex min-h-svh items-center justify-center bg-(--surface-page) px-(--sp-5) py-(--sp-7) sm:px-(--sp-7)";

/** The logo → card → footer-line stack. One stop down on the 4px scale below
 *  sm (20px → 16px), matching how the primitives step their padding. */
export const AUTH_COLUMN =
  "flex w-full max-w-(--measure-form) flex-col items-center gap-(--sp-5) sm:gap-(--sp-6)";

/** The card's heading. type-h1 is a fixed 2rem, which wraps "Create your
 *  account" and "Potwierdź logowanie" onto two lines inside a phone-width
 *  card; below sm it steps down exactly one stop on the type scale, the same
 *  one-stop rule the spacing follows. The font-size utility wins over
 *  .type-h1's `font:` shorthand because utilities sit in a later cascade
 *  layer than components, and the shorthand's line-height is unitless so it
 *  rides along; letter-spacing is set separately and is shared by h1 and h2. */
export const AUTH_HEADING =
  "type-h1 text-(length:--fs-h2) text-(--text-strong) sm:text-(length:--fs-h1)";

/** Touch floor for the buttons on these screens. --control-h is 40px, four
 *  short of the 44px a thumb expects. min-height raises it on a phone without
 *  colliding with the height utility Button already sets (different property,
 *  so no dependence on stylesheet order), and sm: hands the handoff's 40px
 *  back untouched. */
export const AUTH_TOUCH = "min-h-(--control-h-lg) sm:min-h-0";

/** The full-width primary action every one of these forms ends with. */
export const AUTH_SUBMIT = `w-full ${AUTH_TOUCH}`;

/** The "we sent a link to {email}" line on the register and reset-request
 *  screens. The address comes from whoever is typing and offers no break
 *  opportunity of its own once it has no hyphens: a 53-character address
 *  measured 373px against the 246px column a 360px phone leaves inside the
 *  card, painting past the card's edge and dragging the document out to
 *  430px — a sideways scroll on the whole page. break-words lets the address
 *  break at the box edge instead. Every other muted paragraph on these
 *  screens holds translated prose only, which wraps on its own spaces. */
export const AUTH_SENT_BODY = "type-sm break-words text-(--text-muted)";
