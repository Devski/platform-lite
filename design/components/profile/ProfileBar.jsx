import React from "react";
import { Icon } from "../core/Icon";

// The profile's sticky bar. Over the cover it is transparent and white-on-photo;
// once the cover scrolls away it becomes a white bar with a hairline. The left
// group — A3D mark + „Architektów 3d” — is one button and the one control that
// is always on screen: it toggles the AboutPanel (the avatar on the cover's
// bottom edge does the same). When the panel is open it starts at the top of
// the screen under the bar, so the left group turns ink. The label crossfades:
// panel closed → the studio's name; panel open → „Architektów 3d” (the name is
// then the panel's own heading). The bar itself lets clicks through to what is
// under it (the panel's pencil); only its controls catch the pointer. `actions` is the right-hand
// slot (language chip, sign-up, account menu — whatever the viewer mode wants).
// Stacking: the bar (with its toolbar) sits under the AboutPanel (z 45); the
// mark + wordmark is its own fixed layer above the panel — so the open panel
// slides in between the toolbar and the logo. A chevron after the label points
// right (panel closed) and flips left when the panel is open.
export function ProfileBar({ profile, brand = "Architektów 3d", solid = false, aboutOpen = false, onToggleAbout, toggleDisabled = false, phone = false, actions, style, ...rest }) {
  const onPhoto = !solid;
  const ink = onPhoto ? "#fff" : "var(--text-strong)";
  const leftInk = onPhoto && !aboutOpen ? "#fff" : "var(--text-strong)"; // the open panel (white) is under the group on every width
  const barH = phone ? 56 : 64;
  return (
    <React.Fragment>
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 44,
        height: barH,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: phone ? "0 var(--sp-4)" : "0 var(--sp-7)",
        background: solid ? "var(--surface-card)" : "transparent",
        borderBottom: "1px solid " + (solid ? "var(--border-hairline)" : "transparent"),
        color: ink,
        pointerEvents: "none",
        transition: "background-color var(--dur-2) var(--ease-standard), border-color var(--dur-2) var(--ease-standard), color var(--dur-2) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: phone ? "var(--sp-3)" : "var(--sp-4)", pointerEvents: "auto" }}>{actions}</div>
    </header>
      <button
        type="button"
        aria-expanded={aboutOpen}
        aria-label={(aboutOpen ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName}
        onClick={toggleDisabled ? undefined : onToggleAbout}
        disabled={toggleDisabled}
        style={{ position: "fixed", top: (barH - 44) / 2, left: phone ? "var(--sp-4)" : "var(--sp-7)", zIndex: 48, display: "inline-flex", alignItems: "center", gap: "var(--sp-3)", height: 44, minWidth: 0, padding: "0 var(--sp-3) 0 0", border: 0, background: "transparent", color: leftInk, cursor: toggleDisabled ? "default" : "pointer", textAlign: "left", pointerEvents: "auto", transition: "color var(--dur-2) var(--ease-standard)" }}
      >
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, flex: "0 0 auto", position: "relative", overflow: "hidden", borderRadius: "var(--radius-xs)", background: "var(--plaque-navy)", color: "var(--plaque-ink)", fontFamily: "var(--font-sans)", fontWeight: "var(--fw-bold)", fontSize: 12, letterSpacing: "-.02em" }}>
          A3D<span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "12%", background: "var(--plaque-red)" }} />
        </span>
        <span aria-live="polite" style={{ display: "inline-grid", font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", whiteSpace: "nowrap", minWidth: 0 }}>
          <span aria-hidden={aboutOpen} style={{ gridArea: "1 / 1", overflow: "hidden", textOverflow: "ellipsis", maxWidth: phone ? "44vw" : "24rem", opacity: aboutOpen ? 0 : 1, transform: aboutOpen ? "translateY(-6px)" : "none", transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)" }}>{profile.displayName}</span>
          <span aria-hidden={!aboutOpen} style={{ gridArea: "1 / 1", opacity: aboutOpen ? 1 : 0, transform: aboutOpen ? "none" : "translateY(6px)", transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)" }}>{brand}</span>
        </span>
        <Icon name="chevron-right" size={18} tone={leftInk} style={{ transform: aboutOpen ? "rotate(180deg)" : "none", transition: "transform var(--dur-3) var(--ease-standard), background-color var(--dur-2) var(--ease-standard)" }} />
      </button>
    </React.Fragment>
  );
}
