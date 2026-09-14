import React from "react";

export function Divider({ label, spacing = "var(--sp-7)", style, ...rest }) {
  const line = { height: 1, background: "var(--border-hairline)", flex: 1 };
  if (!label) return <div role="separator" style={{ ...line, margin: spacing + " 0", flex: "none" }} {...rest} />;
  return (
    <div role="separator" style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", margin: spacing + " 0", ...style }} {...rest}>
      <div style={line} />
      <span style={{ font: "var(--type-eyebrow)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-subtle)" }}>{label}</span>
      <div style={line} />
    </div>
  );
}
