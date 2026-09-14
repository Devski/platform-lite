import React from "react";

export function LocaleSwitcher({ locales = ["pl", "en"], names = { pl: "Polski", en: "English" }, current = "pl", onChange, tone = "default", style, ...rest }) {
  const onPhoto = tone === "onPhoto";
  return (
    <nav aria-label="Language selection" style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", ...style }} {...rest}>
      {locales.map((l) => {
        const active = l === current;
        return (
          <a
            key={l}
            href="#"
            lang={l}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); if (onChange) onChange(l); }}
            style={{
              font: "var(--type-sm)",
              fontWeight: active ? "var(--fw-semibold)" : "var(--fw-regular)",
              color: onPhoto ? (active ? "var(--text-on-photo)" : "rgba(255,255,255,.78)") : active ? "var(--text-strong)" : "var(--text-muted)",
              textDecoration: active ? "underline" : "none",
              textUnderlineOffset: 3,
              padding: "var(--sp-1) 0",
            }}
          >
            {names[l] || l}
          </a>
        );
      })}
    </nav>
  );
}
