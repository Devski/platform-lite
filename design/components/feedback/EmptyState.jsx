import React from "react";
import { Icon } from "../core/Icon";

export function EmptyState({ icon = "square-dashed", title, body, action, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-10) var(--sp-7)",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-card)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={22} tone="subtle" style={{ background: "var(--text-subtle)" }} />
      {title ? <h3 style={{ font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", margin: 0 }}>{title}</h3> : null}
      {body ? <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", margin: 0, maxWidth: "26rem" }}>{body}</p> : null}
      {action}
    </div>
  );
}
