import React from "react";
import { Icon } from "../core/Icon";

const TONES = {
  info: ["var(--state-info-bg)", "var(--state-info)", "info"],
  success: ["var(--state-success-bg)", "var(--state-success)", "check"],
  danger: ["var(--state-danger-bg)", "var(--state-danger)", "triangle-alert"],
  warning: ["var(--state-warning-bg)", "var(--state-warning)", "clock"],
};

export function StatusMessage({ children, tone = "info", plain = false, style, ...rest }) {
  const [bg, fg, icon] = TONES[tone] || TONES.info;
  if (plain) {
    return (
      <p role={tone === "danger" ? "alert" : "status"} style={{ font: "var(--type-sm)", color: fg, margin: 0, ...style }} {...rest}>
        {children}
      </p>
    );
  }
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: "var(--sp-3)",
        alignItems: "flex-start",
        padding: "var(--sp-4) var(--sp-5)",
        borderRadius: "var(--radius-control)",
        background: bg,
        color: fg,
        font: "var(--type-sm)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={16} tone={fg} style={{ marginTop: 3 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}
