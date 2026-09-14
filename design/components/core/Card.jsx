import React from "react";

const PADS = { none: 0, sm: "var(--sp-6)", md: "var(--card-pad)", lg: "var(--card-pad-lg)" };

export function Card({ children, padding = "md", as = "div", tone = "default", interactive = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const Tag = as;
  return (
    <Tag
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={{
        background: tone === "sunken" ? "var(--surface-sunken)" : "var(--surface-card)",
        border: "1px solid " + (hover ? "var(--border-strong)" : tone === "sunken" ? "var(--border-hairline)" : "var(--border-default)"),
        borderRadius: "var(--radius-card)",
        padding: PADS[padding],
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-none)",
        transition: "var(--transition-surface)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
