import React from "react";

// One form only, taken from the Warsaw MSI sign: a tall navy field with the
// name centred in it, and a red band underneath that ALWAYS carries the
// product name. The lettering is one fixed size (44 px, the „Studio Praga”
// reference) and the sign grows horizontally with the text — it never shrinks
// the letters to fit, never wraps them and never tilts. `scale` shrinks the
// WHOLE sign proportionally (letters included) for a secondary placement such
// as the panel foot at 0.5; it is never used to squeeze a long name into a box.
// Weights are literal 400 / 500: Fira Sans Condensed is loaded at exactly those two,
// and the Figtree tokens (450 / 550) would make the browser synthesise a heavier face.
const LETTER = 44;

export function Plaque({
  name = "Architektów",
  footer = "Architektów 3d",
  scale = 1,
  minWidth,
  shadow = true,
  decorative = true,
  style,
  ...rest
}) {
  const u = scale;
  const text = String(name);
  return (
    <div
      aria-hidden={decorative ? "true" : undefined}
      style={{
        display: "inline-block",
        minWidth: minWidth ?? Math.round(200 * u),
        maxWidth: "none",
        flex: "0 0 auto",
        boxShadow: shadow ? "var(--shadow-plaque)" : "none",
        overflow: "hidden",
        borderRadius: Math.max(2, 3 * u),
        border: Math.max(1, 2 * u) + "px solid rgba(255,255,255,.55)",
        fontFamily: "var(--font-plaque)",
        color: "var(--plaque-ink)",
        boxSizing: "border-box",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          background: "var(--plaque-navy)",
          padding: 22 * u + "px " + 20 * u + "px " + 8 * u + "px",
          minHeight: 84 * u,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: LETTER * u, fontWeight: 400, letterSpacing: "-.01em", lineHeight: 1.1, whiteSpace: "nowrap" }}>{text}</span>
      </div>
      <div
        style={{
          background: "var(--plaque-red)",
          padding: 4 * u + "px " + 20 * u + "px " + 6 * u + "px",
          fontSize: 16 * u,
          fontWeight: 500,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {footer}
      </div>
    </div>
  );
}
