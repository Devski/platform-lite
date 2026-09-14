import React from "react";

const SIZES = {
  md: { height: "var(--control-h)", padding: "0 var(--control-pad-x)", font: "var(--fs-sm)" },
  lg: { height: "var(--control-h-lg)", padding: "0 var(--sp-7)", font: "var(--fs-body)" },
};

function skin(variant, hover) {
  switch (variant) {
    case "quiet":
      return {
        background: hover ? "var(--action-quiet-hover)" : "var(--surface-card)",
        color: "var(--text-strong)",
        border: "1px solid " + (hover ? "var(--border-strong)" : "var(--action-quiet-border)"),
      };
    case "ghost":
      return {
        background: hover ? "var(--surface-active)" : "transparent",
        color: "var(--text-body)",
        border: "1px solid transparent",
      };
    case "onPhoto":
      return {
        background: hover ? "var(--n-0)" : "rgba(255,255,255,.94)",
        color: "var(--n-950)",
        border: "1px solid transparent",
      };
    case "onPhotoQuiet":
      return {
        background: hover ? "rgba(255,255,255,.14)" : "transparent",
        color: "var(--text-on-photo)",
        border: "1px solid rgba(255,255,255,.6)",
      };
    default:
      return {
        background: hover ? "var(--action-solid-hover)" : "var(--action-solid)",
        color: "var(--action-solid-text)",
        border: "1px solid transparent",
      };
  }
}

export function Button({
  children,
  variant = "solid",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  href,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const off = disabled || loading;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sp-3)",
    height: s.height,
    padding: s.padding,
    width: fullWidth ? "100%" : undefined,
    borderRadius: "var(--radius-control)",
    fontFamily: "var(--font-sans)",
    fontSize: s.font,
    fontWeight: "var(--fw-semibold)",
    letterSpacing: "var(--ls-body)",
    textDecoration: "none",
    cursor: off ? "not-allowed" : "pointer",
    transition: "var(--transition-control)",
    whiteSpace: "nowrap",
    ...skin(variant, hover && !off),
    ...(off ? { opacity: 0.45 } : null),
    ...style,
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  if (href && !off) {
    return (
      <a href={href} style={base} {...handlers} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} disabled={off} onClick={onClick} style={base} {...handlers} {...rest}>
      {children}
    </button>
  );
}
