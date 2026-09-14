import React from "react";
import { Icon } from "./Icon";

export function IconButton({ icon, label, size = 40, tone = "quiet", onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const onPhoto = tone === "onPhoto";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-control)",
        cursor: "pointer",
        transition: "var(--transition-control)",
        background: hover
          ? onPhoto ? "rgba(255,255,255,.14)" : "var(--surface-active)"
          : "transparent",
        border: "1px solid " + (tone === "bordered" ? "var(--action-quiet-border)" : "transparent"),
        color: onPhoto ? "var(--text-on-photo)" : "var(--text-body)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} tone={onPhoto ? "onPhoto" : "body"} />
    </button>
  );
}
