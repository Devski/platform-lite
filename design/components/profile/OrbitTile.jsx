import React from "react";
import { Icon } from "../core/Icon";

// The R360 orbit as the design system sees it: a picture that turns. The real
// product renders frames on a canvas (orbit-viewer.tsx); here a poster and a
// slow horizontal pan stand in so layouts can be judged. Keeps the product's
// rules: the picture is the drag control, so enlarging is a separate "+"
// button; a "360°" mark sits top-left; the ring shows only where asked
// (D-WORKS-19/20 — never on a phone's public page, only when enlarged on the
// desktop profile page).
export function OrbitTile({
  poster,
  name = "",
  cues = [],
  autorotate = false,
  ring = false,
  aspect = "16 / 10",
  onEnlarge,
  onOpen,
  openLabel,
  radius = "var(--radius-picture)",
  style,
  ...rest
}) {
  const [pos, setPos] = React.useState(50);
  const [active, setActive] = React.useState(0);
  const drag = React.useRef(null);
  React.useEffect(() => {
    if (!autorotate) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf;
    let last = performance.now();
    const tick = (t) => {
      const dt = t - last;
      last = t;
      if (!drag.current) setPos((p) => (p + dt * 0.004) % 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autorotate]);
  const onDown = (e) => {
    drag.current = { x: e.clientX, pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const d = (e.clientX - drag.current.x) / 6;
    setPos(((drag.current.pos + d) % 100 + 100) % 100);
  };
  const onUp = () => {
    drag.current = null;
  };
  const goCue = (i) => {
    setActive(i);
    setPos((i / Math.max(1, cues.length)) * 100);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", ...style }} {...rest}>
      <div
        role="slider"
        aria-label={"Widok 360° realizacji " + name + ": przeciągnij po obrazie, by go obrócić"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => (p + 98) % 100);
          if (e.key === "ArrowRight") setPos((p) => (p + 2) % 100);
        }}
        style={{
          position: "relative",
          aspectRatio: aspect,
          borderRadius: radius,
          overflow: "hidden",
          background: "var(--n-900)",
          cursor: "grab",
          touchAction: "pan-y",
          outline: "none",
        }}
      >
        {poster ? (
          <img
            src={poster}
            alt={name + ", widok 360°"}
            draggable="false"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos + "% 50%", transform: "scale(1.18)", userSelect: "none" }}
          />
        ) : null}
        <span
          style={{
            position: "absolute",
            top: "var(--sp-4)",
            left: "var(--sp-4)",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: "rgba(12,17,22,.72)",
            color: "#fff",
            font: "var(--type-eyebrow)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
          }}
          aria-hidden="true"
        >
          360°
        </span>
        {onOpen || onEnlarge ? (
          <button
            type="button"
            aria-label={onOpen ? (openLabel || "Otwórz realizację: " + name) : "Powiększ widok 360°: " + name}
            title={onOpen ? (openLabel || "Otwórz realizację: " + name) : "Powiększ widok 360°: " + name}
            onClick={onOpen || onEnlarge}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: "var(--sp-4)",
              bottom: "var(--sp-4)",
              width: 40,
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-full)",
              border: 0,
              background: "rgba(255,255,255,.94)",
              cursor: "pointer",
            }}
          >
            <Icon name={onOpen ? "arrow-up-right" : "maximize-2"} size={18} tone="strong" />
          </button>
        ) : null}
        {ring ? (
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "var(--sp-5)", transform: "translateX(-50%)", width: "min(38%, 10rem)", aspectRatio: "3 / 1" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(255,255,255,.55)" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: "50%", background: "#fff", transform: "rotate(" + pos * 3.6 + "deg) translateX(" + 0 + "px)", transformOrigin: "50% 50%" }} />
          </div>
        ) : null}
      </div>
      {cues.length ? (
        <ul aria-label={"Punkty widoku 360°: " + name} style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", listStyle: "none", margin: 0, padding: 0 }}>
          {cues.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                aria-pressed={active === i}
                onClick={() => goCue(i)}
                style={{
                  height: 32,
                  padding: "0 var(--sp-4)",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid " + (active === i ? "var(--n-950)" : "var(--action-quiet-border)"),
                  background: active === i ? "var(--n-950)" : "var(--surface-card)",
                  color: active === i ? "var(--n-0)" : "var(--text-body)",
                  font: "var(--type-label)",
                  cursor: "pointer",
                  transition: "var(--transition-control)",
                }}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
