import React from "react";

const CDN = "https://unpkg.com/lucide-static@0.544.0/icons/";

const TONES = {
  body: "var(--text-body)",
  muted: "var(--text-muted)",
  subtle: "var(--text-subtle)",
  strong: "var(--text-strong)",
  onPhoto: "var(--text-on-photo)",
  success: "var(--state-success)",
  danger: "var(--state-danger)",
};

export function Icon({ name, size = 18, tone = "body", strokeWidth = 1.75, style, ...rest }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flex: "0 0 auto",
        background: TONES[tone] || tone,
        WebkitMaskImage: "url(" + CDN + name + ".svg)",
        maskImage: "url(" + CDN + name + ".svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        opacity: strokeWidth < 1.75 ? 0.9 : 1,
        ...style,
      }}
      {...rest}
    />
  );
}
