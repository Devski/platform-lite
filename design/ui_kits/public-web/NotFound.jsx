// V-404 as shipped: one card, photo panel beside the text from `sm`, banner
// above it on a phone (D-SHELL-13). No bar, no logo, no footer.
const { Button, Icon } = window.ArchitektW3dDesignSystem_1d311d;

const NF_T = { pl: { heading: "Zgubiliśmy się?", home: "Wróć do domu" }, en: { heading: "Lost?", home: "Back home" } };

function NotFound({ onGo, locale = "pl", phone = false }) {
  const t = NF_T[locale] || NF_T.pl;
  return (
    <main style={{ background: "var(--surface-page)", minHeight: phone ? "100%" : "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: phone ? "var(--sp-5)" : "var(--sp-10)", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-picture)", overflow: "hidden", background: "var(--surface-card)" }}>
        <div aria-hidden="true" style={{ position: "relative", minHeight: phone ? 160 : 340, background: "var(--n-900)" }}>
          <img src="../../assets/hero-facade-plaque.jpeg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "96% 42%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,17,22,.35), rgba(12,17,22,0) 50%)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "var(--sp-5)", padding: phone ? "var(--sp-7) var(--sp-6)" : "var(--sp-10)" }}>
          <Icon name="map-pin-off" size={24} tone="subtle" />
          <h1 style={{ margin: 0, font: "var(--type-h2)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{t.heading}</h1>
          <Button variant="quiet" onClick={() => onGo("hero")}>{t.home}</Button>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { NotFound });
