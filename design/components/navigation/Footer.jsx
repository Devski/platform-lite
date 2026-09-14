import React from "react";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function Footer({
  company = "Architectorium",
  links = [],
  locale = "pl",
  onLocaleChange,
  note,
  copyright,
  style,
  ...rest
}) {
  return (
    <footer style={{ borderTop: "1px solid var(--border-hairline)", background: "var(--surface-card)", ...style }} {...rest}>
      <div
        style={{
          maxWidth: "var(--measure-wide)",
          margin: "0 auto",
          padding: "var(--sp-9) var(--sp-7)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-7)",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <span style={{ font: "var(--type-sm)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>{company}</span>
          {note ? <span style={{ font: "var(--type-sm)", color: "var(--text-subtle)" }}>{note}</span> : null}
          {copyright ? <span style={{ font: "var(--type-sm)", color: "var(--text-muted)" }}>{copyright}</span> : null}
        </div>
        {links.length ? (
          <nav style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-6)" }}>
            {links.map((l) => (
              <a key={l.label} href={l.href || "#"} style={{ font: "var(--type-sm)", color: "var(--text-muted)", textDecoration: "none" }}>
                {l.label}
              </a>
            ))}
          </nav>
        ) : null}
        {onLocaleChange ? <LocaleSwitcher current={locale} onChange={onLocaleChange} /> : null}
      </div>
    </footer>
  );
}
