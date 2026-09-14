import React from "react";

const TONES = {
  neutral: ["var(--surface-sunken)", "var(--text-muted)", "var(--border-hairline)"],
  success: ["var(--state-success-bg)", "var(--state-success)", "transparent"],
  danger: ["var(--state-danger-bg)", "var(--state-danger)", "transparent"],
  warning: ["var(--state-warning-bg)", "var(--state-warning)", "transparent"],
  ink: ["var(--surface-inverse)", "var(--text-inverse)", "transparent"],
};

export function Badge({ children, tone = "neutral", uppercase = false, style, ...rest }) {
  const [bg, fg, bd] = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        height: 24,
        padding: "0 var(--sp-3)",
        borderRadius: "var(--radius-full)",
        background: bg,
        color: fg,
        border: "1px solid " + bd,
        font: uppercase ? "var(--type-eyebrow)" : "var(--type-mono)",
        fontSize: "var(--fs-micro)",
        letterSpacing: uppercase ? "var(--ls-caps)" : "0",
        textTransform: uppercase ? "uppercase" : "none",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
