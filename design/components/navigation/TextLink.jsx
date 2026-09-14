import React from "react";
import { Icon } from "../core/Icon";

export function TextLink({ children, href = "#", onClick, tone = "strong", underline = "hover", icon, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const always = underline === "always";
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: icon ? "inline-flex" : "inline",
        alignItems: "center",
        gap: "var(--sp-2)",
        color: tone === "onPhoto" ? "var(--text-on-photo)" : tone === "muted" ? "var(--text-muted)" : "var(--text-strong)",
        font: "inherit",
        fontWeight: "var(--fw-semibold)",
        textDecoration: always ? (hover ? "none" : "underline") : hover ? "underline" : "none",
        textUnderlineOffset: 2,
        cursor: "pointer",
        transition: "var(--transition-control)",
        ...style,
      }}
      {...rest}
    >
      {children}
      {icon ? <Icon name={icon} size={16} tone={tone === "onPhoto" ? "onPhoto" : "strong"} /> : null}
    </a>
  );
}
