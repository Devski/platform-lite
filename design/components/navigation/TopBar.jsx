import React from "react";
import { Avatar } from "../core/Avatar";
import { Button } from "../core/Button";
import { Icon } from "../core/Icon";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function TopBar({
  brand = "Architektów 3d",
  items = [],
  activeItem,
  onNavigate,
  user,
  locale = "pl",
  onLocaleChange,
  actions,
  style,
  ...rest
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--surface-card)",
        borderBottom: "1px solid var(--border-hairline)",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          maxWidth: "var(--measure-wide)",
          margin: "0 auto",
          padding: "0 var(--sp-7)",
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-8)",
        }}
      >
        <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", textDecoration: "none" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              position: "relative",
              overflow: "hidden",
              borderRadius: "var(--radius-xs)",
              background: "var(--plaque-navy)",
              color: "var(--plaque-ink)",
              font: "var(--type-sm)",
              fontWeight: "var(--fw-bold)",
              fontSize: 12,
              letterSpacing: "-.02em",
            }}
          >
            A3D<span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "12%", background: "var(--plaque-red)" }} />
          </span>
          <span style={{ font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{brand}</span>
        </a>
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--sp-6)", marginLeft: "auto" }}>
          {items.map((item) => {
            const active = item.id === activeItem;
            return (
              <a
                key={item.id}
                href="#"
                onClick={(e) => { e.preventDefault(); if (onNavigate) onNavigate(item.id); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-2)",
                  font: "var(--type-sm)",
                  fontWeight: active ? "var(--fw-semibold)" : "var(--fw-regular)",
                  color: active ? "var(--text-strong)" : "var(--text-muted)",
                  textDecoration: "none",
                  height: 63,
                  borderBottom: "2px solid " + (active ? "var(--n-950)" : "transparent"),
                }}
              >
                {item.icon ? <Icon name={item.icon} size={17} tone={active ? "strong" : "muted"} /> : null}
                {item.label}
              </a>
            );
          })}
          {onLocaleChange ? <LocaleSwitcher current={locale} onChange={onLocaleChange} /> : null}
          {actions}
          {user ? (
            <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
              {user.handle || user.email ? <span style={{ font: "var(--type-mono)", color: "var(--text-subtle)" }}>{user.handle ? "/" + user.handle : user.email}</span> : null}
              <Avatar src={user.avatarUrl} name={user.name} size={32} />
            </span>
          ) : (
            <span style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Button variant="ghost">Log in</Button>
              <Button variant="solid">Sign up</Button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
