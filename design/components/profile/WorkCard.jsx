import React from "react";
import { Icon } from "../core/Icon";
import { OrbitTile } from "./OrbitTile";

// One work, full width of the page column. Pictures first, words after — the
// profile is a wall of work, not a list of cards. Three layouts the owner picks
// per work (stored with the work): `cover` (one picture), `cover-thumbs` (the
// default: cover + up to two thumbnails), `cover-text` (picture beside the
// words). Below `phone` every layout stacks. No border, no box: the picture
// group and its caption are the card.
const RADIUS = "var(--radius-picture)";

// A picture is a link to the work's landing page (read-only); only the orbit is
// interactive in place and carries the ↗ badge — plain photos have no badge.
function Photo({ src, alt, aspect, href, onClick, label, radius = RADIUS }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a
      href={href || "#"}
      aria-label={label}
      onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "block", position: "relative", width: "100%", aspectRatio: aspect, borderRadius: radius, overflow: "hidden", background: "var(--n-150)", cursor: "pointer", textDecoration: "none" }}
    >
      {src ? <img src={src} alt={alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: hover ? "scale(1.02)" : "none", transition: "transform var(--dur-3) var(--ease-standard)" }} /> : null}
    </a>
  );
}

function Parties({ work, phone, tone = "var(--text-muted)" }) {
  const rows = [work.investor && ["Inwestor", work.investor], work.developer && ["Deweloper", work.developer]].filter(Boolean);
  if (!rows.length) return null;
  return (
    <dl style={{ display: "flex", flexWrap: "wrap", gap: phone ? "var(--sp-2) var(--sp-5)" : "var(--sp-2) var(--sp-7)", margin: 0, font: "var(--type-sm)", color: tone }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: "var(--sp-2)" }}>
          <dt style={{ color: "var(--text-subtle)" }}>{k}</dt>
          <dd style={{ margin: 0, fontWeight: "var(--fw-semibold)", color: "var(--text-body)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WorkCard({ work, layout = "cover-thumbs", phone = false, owner = false, onOpen, onEdit, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const thumbs = (work.thumbs || []).slice(0, 2);
  const hasThumbs = layout === "cover-thumbs" && thumbs.length > 0;
  const beside = layout === "cover-text" && !phone;
  const coverAspect = phone ? "4 / 3" : hasThumbs || beside ? "16 / 10" : "21 / 9";
  const open = onOpen ? () => onOpen(work) : undefined;
  const openLabel = "Otwórz realizację: " + work.name;
  const cover = work.orbit ? (
    <OrbitTile poster={work.orbit.poster || work.cover} name={work.name} cues={[]} autorotate={work.orbit.autorotate} aspect={coverAspect} onOpen={open} openLabel={openLabel} />
  ) : (
    <Photo src={work.cover} alt={work.name + ", zdjęcie 1"} aspect={coverAspect} href={work.href} onClick={open} label={openLabel} />
  );
  const pictures = hasThumbs ? (
    <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "minmax(0,2fr) minmax(0,1fr)", gridAutoRows: phone ? undefined : "1fr", gap: "var(--sp-3)" }}>
      <div style={{ gridRow: phone ? undefined : "1 / span 2" }}>{cover}</div>
      {phone ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
          {thumbs.map((t, i) => <Photo key={i} src={t} alt={work.name + ", zdjęcie " + (i + 2)} aspect="4 / 3" href={work.href} onClick={open} label={openLabel} />)}
        </div>
      ) : (
        thumbs.map((t, i) => <Photo key={i} src={t} alt={work.name + ", zdjęcie " + (i + 2)} aspect="16 / 10" href={work.href} onClick={open} label={openLabel} />)
      )}
    </div>
  ) : cover;
  const pencil = owner ? (
    <button
      type="button"
      aria-label={"Edytuj: " + work.name}
      title={"Edytuj: " + work.name}
      onClick={onEdit ? () => onEdit(work) : undefined}
      style={{ position: "absolute", top: "var(--sp-4)", right: "var(--sp-4)", zIndex: 2, width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "rgba(255,255,255,.94)", color: "var(--n-950)", cursor: "pointer", boxShadow: "var(--shadow-md)" }}
    >
      <Icon name="pencil" size={16} tone="strong" />
    </button>
  ) : null;
  // The pencil always sits on the picture (top-right of the cover), whatever the layout.
  const picturesWithPencil = <div style={{ position: "relative", minWidth: 0 }}>{pictures}{pencil}</div>;
  const caption = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", minWidth: 0 }}>
      <h3 style={{ margin: 0, font: phone ? "var(--type-h3)" : "var(--type-h2)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", textWrap: "balance" }}>
        <a
          href={work.href || "#"}
          onClick={onOpen ? (e) => { e.preventDefault(); onOpen(work); } : undefined}
          style={{ color: "inherit", textDecoration: hover ? "underline" : "none", textUnderlineOffset: 4, textDecorationThickness: 2 }}
        >
          {work.name}
        </a>
      </h3>
      <Parties work={work} phone={phone} />
      {work.description ? (
        <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-muted)", maxWidth: beside ? undefined : "48rem", display: "-webkit-box", WebkitLineClamp: beside ? 6 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{work.description}</p>
      ) : null}
    </div>
  );
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: beside ? "grid" : "flex", gridTemplateColumns: beside ? "minmax(0,3fr) minmax(0,1fr)" : undefined, flexDirection: "column", gap: phone ? "var(--sp-5)" : "var(--sp-7)", alignItems: beside ? "end" : undefined, ...style }}
      {...rest}
    >
      {picturesWithPencil}
      {caption}
    </article>
  );
}
