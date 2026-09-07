// Ported from the design handoff's design-system-source/Plaque.jsx, which is
// ground truth: one form, taken from the Warsaw MSI sign — a tall navy field
// with the name centred in it, and a red band underneath that always carries
// the product name. Token names (--shadow-plaque, --plaque-navy, --plaque-
// ink, --font-plaque, --fw-regular, --fw-medium) match this project's
// globals.css 1:1, so the port changes only JSX/casing, never a value.
type PlaqueProps = {
  name?: string;
  footer?: string;
  width?: number;
  tilt?: number;
  shadow?: boolean;
  className?: string;
};

// Fixed 16px left/right padding (--sp-5) on the navy field, in place of the
// source component's u-scaled 18u — the closed-form font-size-from-length
// curve below has no notion of that padding, so at the plaque's default
// 150px width a long name can still be sized wider than the space the fixed
// padding leaves. Calibrated from two real browser measurements of Fira
// Sans Condensed at this weight ("XOSA Architekci", "Studio Praga"): about
// 0.46em average advance per character.
const PADDING_X = 16;
const AVG_CHAR_ADVANCE_EM = 0.46;

export function Plaque({
  name = "Architektów",
  footer = "Architektów 3d",
  width = 320,
  tilt = 0,
  shadow = true,
  className,
}: PlaqueProps) {
  const u = width / 320;
  const text = String(name);
  const border = Math.max(1, 2 * u);
  // Same closed-form size-from-length curve as the source component: the
  // name must stay on one line regardless of how long it is. Capped against
  // an estimate of what actually fits the fixed padding, since the source
  // curve alone doesn't reliably clear it (see PADDING_X above).
  const lengthBasedSize =
    Math.min(54, Math.max(18, 680 / Math.max(5, text.length))) * u;
  const availableWidth = Math.max(0, width - 2 * border - 2 * PADDING_X);
  const widthFitSize = text.length
    ? availableWidth / (text.length * AVG_CHAR_ADVANCE_EM)
    : lengthBasedSize;
  const size = Math.min(lengthBasedSize, widthFitSize);

  return (
    <div
      className={className}
      style={{
        width,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        boxShadow: shadow ? "var(--shadow-plaque)" : "none",
        overflow: "hidden",
        borderRadius: 2 * u,
        // The enamel sits in a shallow frame; on the photograph it reads as
        // a pale hairline around the whole sign.
        border: `${border}px solid rgba(255,255,255,.55)`,
        fontFamily: "var(--font-plaque)",
        color: "var(--plaque-ink)",
      }}
    >
      <div
        style={{
          background: "var(--plaque-navy)",
          // Left/right padding fixed at 16px (--sp-5) rather than scaled by
          // u, per Dawid's review of screen 2 — vertical padding still
          // follows the source component's scale.
          padding: `${22 * u}px var(--sp-5) ${8 * u}px`,
          minHeight: 84 * u,
          display: "flex",
          // The lettering sits low in the field, close to the district band,
          // exactly as on the street.
          alignItems: "flex-end",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: size,
            fontWeight: "var(--fw-regular)",
            letterSpacing: "-.01em",
            lineHeight: 1.1,
            // The source formula sizes the font from the name's length, but
            // for some name/width pairs (e.g. "XOSA Architekci" at the
            // default 150px used on screen 2) the result still measures a
            // few px wider than the field — enough to wrap without this.
            // The outer overflow:hidden clips the rare few-px overrun
            // instead, which reads far closer to "one line" than a wrap.
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
      <div
        style={{
          background: "var(--plaque-red)",
          padding: `${5 * u}px var(--sp-5) ${7 * u}px`,
          fontSize: 18 * u,
          fontWeight: "var(--fw-medium)",
          textAlign: "center",
        }}
      >
        {footer}
      </div>
    </div>
  );
}
