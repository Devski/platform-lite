import React from "react";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name = "", size = 128, square = false, alt, style, ...rest }) {
  const shape = {
    width: size,
    height: size,
    flex: "0 0 auto",
    borderRadius: square ? (size >= 96 ? "var(--radius-md)" : size >= 48 ? "var(--radius-sm)" : "var(--radius-xs)") : "var(--radius-avatar)",
    border: "1px solid var(--border-default)",
    background: "var(--surface-sunken)",
    objectFit: "cover",
    ...style,
  };
  if (src) return <img src={src} alt={alt || name} width={size} height={size} style={shape} {...rest} />;
  return (
    <div
      aria-hidden="true"
      style={{
        ...shape,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--n-900)",
        color: "var(--n-0)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--fw-semibold)",
        fontSize: Math.max(11, Math.round(size * 0.34)),
        letterSpacing: "var(--ls-heading)",
      }}
      {...rest}
    >
      {initials(name)}
    </div>
  );
}
