import React from "react";
import { Icon } from "../core/Icon";
import { Avatar } from "../core/Avatar";
import { Plaque } from "../core/Plaque";

// The "about" panel: everything the old profile card said, moved off the wall
// of work into a panel that slides in from the left (as on Behance). On the
// desktop it is open on load and overlays the left edge of the works; on a
// phone it is closed on load and slides over everything with a scrim. The
// page's big avatar (on the cover band's bottom edge, flush with the works
// column, scrolling with the page) is its trigger; the panel carries its own
// copy, centred, at the same height (`avatarTop`, `avatarSize`), which closes
// the panel. `headroom` reserves the space under it.
//
// Edit mode (`editing`) is the same panel, same order, same type — the
// editable pieces just get a frame: the name (h1), the headline, the bio, and
// the places (chips keep their look, the pin becomes a remove ×, a framed
// field under them adds a place). Address and plaque stay read-only; the
// plaque follows the name field live. ✓ (save) and × (cancel) sit in the top-right corner.
function Chip({ children, onRemove, removeLabel }) {
  return (
    <li style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", height: 32, padding: onRemove ? "0 var(--sp-4) 0 var(--sp-2)" : "0 var(--sp-4)", borderRadius: "var(--radius-full)", background: "var(--surface-sunken)", font: "var(--type-label)", color: "var(--text-body)" }}>
      {onRemove ? (
        <button type="button" aria-label={removeLabel} title={removeLabel} onClick={onRemove} style={{ width: 24, height: 24, padding: 0, border: 0, background: "transparent", borderRadius: "var(--radius-full)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="circle-x" size={16} tone="muted" />
        </button>
      ) : (
        <Icon name="map-pin" size={14} tone="muted" />
      )}
      {children}
    </li>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <h2 style={{ margin: 0, font: "var(--type-eyebrow)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-subtle)" }}>{title}</h2>
      {children}
    </section>
  );
}

// A frame that reads exactly like the text it replaces: the same element, font,
// colour, alignment and width — so the text wraps as it does in read-only. The
// frame hangs outside the text box (padding + 1px border exactly compensated by
// negative margins, so the text box is the read-only box to the pixel) and
// turns ink on focus. Contenteditable, so it flows like a paragraph, not an input.
function Framed({ as = "h1", value, onChange, placeholder, label, block = false, textStyle }) {
  const ref = React.useRef(null);
  const [focus, setFocus] = React.useState(false);
  React.useEffect(() => { if (ref.current && ref.current.innerText !== (value || "")) ref.current.innerText = value || ""; }, []); // seed once; typing owns the DOM afterwards
  const Tag = as;
  return (
    <span style={{ position: "relative", display: block ? "block" : "inline-block", maxWidth: "100%", minWidth: 0, verticalAlign: "top" }}>
      <Tag ref={ref} role="textbox" aria-multiline="true" aria-label={label} contentEditable suppressContentEditableWarning spellCheck={false} onInput={(e) => onChange(e.currentTarget.innerText.replace(/\n$/, ""))} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ ...textStyle, margin: "-3px -7px", padding: "2px 6px", minWidth: "3ch", minHeight: "1lh", boxSizing: "content-box", border: "1px solid " + (focus ? "var(--focus-ring)" : "var(--border-default)"), borderRadius: "var(--radius-control)", background: "transparent", outline: "none", whiteSpace: "pre-wrap", overflowWrap: "anywhere", cursor: "text", transition: "border-color var(--dur-1) var(--ease-standard)" }} />
      {!value && placeholder ? <span aria-hidden="true" style={{ ...textStyle, position: "absolute", inset: 0, pointerEvents: "none", color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{placeholder}</span> : null}
    </span>
  );
}

// Adding a place: a small round „+” chip at the end of the row. It opens into a
// chip-shaped field that suggests places from TERYT (here a small sample of the
// register; the product searches the server from 2 characters, 10 at most).
// Detail rules as in the spec: voivodeship → kind only; county → „powiat, {voivodeship}”;
// town → „{gmina or powiat}, {voivodeship}”. Enter or a click adds the NAME only.
const TERYT_SAMPLE = [
  { name: "Warszawa", detail: "miasto, mazowieckie" }, { name: "Kraków", detail: "miasto, małopolskie" }, { name: "Wrocław", detail: "miasto, dolnośląskie" }, { name: "Poznań", detail: "miasto, wielkopolskie" }, { name: "Gdańsk", detail: "miasto, pomorskie" }, { name: "Łódź", detail: "miasto, łódzkie" }, { name: "Szczecin", detail: "miasto, zachodniopomorskie" }, { name: "Lublin", detail: "miasto, lubelskie" }, { name: "Katowice", detail: "miasto, śląskie" }, { name: "Białystok", detail: "miasto, podlaskie" },
  { name: "Piaseczno", detail: "gmina Piaseczno, mazowieckie" }, { name: "Pruszków", detail: "powiat pruszkowski, mazowieckie" }, { name: "Nowa Wieś", detail: "gmina Michałowice, mazowieckie" }, { name: "Konstancin-Jeziorna", detail: "gmina Konstancin-Jeziorna, mazowieckie" }, { name: "Zakopane", detail: "powiat tatrzański, małopolskie" }, { name: "Sopot", detail: "miasto, pomorskie" }, { name: "Gdynia", detail: "miasto, pomorskie" },
  { name: "powiat warszawski zachodni", detail: "powiat, mazowieckie" }, { name: "powiat piaseczyński", detail: "powiat, mazowieckie" }, { name: "powiat krakowski", detail: "powiat, małopolskie" },
  { name: "mazowieckie", detail: "województwo" }, { name: "małopolskie", detail: "województwo" }, { name: "pomorskie", detail: "województwo" }, { name: "dolnośląskie", detail: "województwo" }, { name: "wielkopolskie", detail: "województwo" }, { name: "śląskie", detail: "województwo" },
];
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

function PlaceAdder({ places, onAdd, label, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hi, setHi] = React.useState(-1);
  const ref = React.useRef(null);
  React.useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  const list = q.trim().length >= 2 ? TERYT_SAMPLE.filter((p) => fold(p.name).includes(fold(q.trim())) && !places.includes(p.name)).slice(0, 10) : [];
  const add = (name) => { const n = (name || q).trim(); if (!n) return; onAdd(n); setQ(""); setHi(-1); };
  const close = () => { setOpen(false); setQ(""); setHi(-1); };
  const chip = { display: "inline-flex", alignItems: "center", height: 32, borderRadius: "var(--radius-full)", background: "var(--surface-sunken)", font: "var(--type-label)", color: "var(--text-body)" };
  if (!open) {
    return (
      <li style={{ display: "inline-flex" }}>
        <button type="button" aria-label={label} title={label} onClick={() => setOpen(true)} style={{ ...chip, width: 32, justifyContent: "center", padding: 0, border: 0, cursor: "pointer" }}>
          <Icon name="plus" size={16} tone="strong" />
        </button>
      </li>
    );
  }
  return (
    <li style={{ display: "inline-flex", flex: "1 1 12ch", minWidth: "12ch" }}>
      <span style={{ ...chip, width: "100%", padding: "0 var(--sp-3) 0 var(--sp-2)", gap: "var(--sp-2)", boxShadow: "inset 0 0 0 1px var(--focus-ring)" }}>
        <Icon name="map-pin" size={14} tone="muted" />
        <input ref={ref} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={list.length > 0} aria-controls="place-suggest" aria-activedescendant={hi >= 0 ? "place-opt-" + hi : undefined} value={q} placeholder={placeholder} maxLength={80}
          onChange={(e) => { setQ(e.target.value); setHi(-1); }}
          onBlur={() => { if (!q.trim()) close(); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            else if (e.key === "ArrowDown" && list.length) { e.preventDefault(); setHi((i) => (i + 1) % list.length); }
            else if (e.key === "ArrowUp" && list.length) { e.preventDefault(); setHi((i) => (i <= 0 ? list.length - 1 : i - 1)); }
            else if (e.key === "Enter" || (e.key === "Tab" && q.trim())) { e.preventDefault(); add(hi >= 0 ? list[hi].name : null); }
          }}
          style={{ flex: 1, minWidth: 0, height: 32, padding: 0, border: 0, background: "transparent", font: "var(--type-label)", color: "var(--text-body)", outline: "none" }} />
      </span>
      {list.length ? (
        <ul id="place-suggest" role="listbox" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 2, margin: 0, padding: "var(--sp-1)", listStyle: "none", background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-md)", maxHeight: 280, overflowY: "auto" }}>
          {list.map((p, i) => (
            <li key={p.name} id={"place-opt-" + i} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); add(p.name); }} onMouseEnter={() => setHi(i)}
              style={{ display: "flex", flexDirection: "column", gap: 1, padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--radius-xs)", background: i === hi ? "var(--surface-hover)" : "transparent", cursor: "pointer" }}>
              <span style={{ font: "var(--type-label)", color: "var(--text-strong)" }}>{p.name}</span>
              <span style={{ font: "var(--type-sm)", color: "var(--text-muted)" }}>{p.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AboutPanel({ profile, open = true, onClose, onAvatar, phone = false, owner = false, editing = false, draft, onDraftChange, onSave, onCancel, onChangePhoto, width = 380, top = 64, start = 0, headroom, avatarTop, avatarSize = 176, locale = "pl", children, style, ...rest }) {
  const [copied, setCopied] = React.useState(false);
  const address = "architektow3d.pl/" + profile.handle;
  const w = phone ? "min(100% - 88px, 320px)" : width;
  // Phone: one step smaller everywhere — type, gaps, corner buttons.
  const fH1 = phone ? "var(--type-h2)" : "var(--type-h1)";
  const fLead = phone ? "var(--type-body)" : "var(--type-lead)";
  const fBody = phone ? "var(--type-sm)" : "var(--type-body)";
  const btn = phone ? 32 : 40;
  const btnIcon = phone ? 16 : 20;
  const t = locale === "en"
    ? { about: "About", places: "Based in and working across", address: "Profile address", copy: "Copy address", copied: "Address copied", close: "Close panel", toProfile: "Go to profile: ", editTitle: "Edit profile", name: "Name", headline: "Headline", headlinePh: "What you do, in one line", bioPh: "A few sentences about the studio", addPlace: "Add a place", addPlacePh: "Type a place…", remove: "Remove: ", photo: "Change photo", shapeCircle: "Round avatar", shapeSquare: "Square avatar", save: "Save", cancel: "Cancel" }
    : { about: "O nas", places: "Siedziba i obszar działania", address: "Adres profilu", copy: "Kopiuj adres", copied: "Skopiowano adres", close: "Zamknij panel", toProfile: "Przejdź do profilu: ", editTitle: "Edytuj profil", name: "Nazwa", headline: "Nagłówek", headlinePh: "Czym się zajmujecie, jednym zdaniem", bioPh: "Kilka zdań o pracowni", addPlace: "Dodaj miejsce", addPlacePh: "Wpisz miejsce…", remove: "Usuń: ", photo: "Zmień zdjęcie", shapeCircle: "Avatar okrągły", shapeSquare: "Avatar kwadratowy", save: "Zapisz", cancel: "Anuluj" };
  const d = editing && draft ? draft : profile;
  const set = (k) => (v) => onDraftChange && onDraftChange({ [k]: v });
  const places = d.places || [];
  const sq = d.avatarShape === "square";
  const avatarRadius = sq ? "var(--radius-md)" : "var(--radius-full)";
  const addPlace = (name) => { if (name && !places.includes(name)) onDraftChange && onDraftChange({ places: [...places, name] }); };
  const padB = phone ? "var(--sp-9)" : "var(--sp-10)";
  const padX = phone ? "var(--sp-6)" : "var(--sp-8)";
  return (
    <React.Fragment>
      {phone && open ? <div onClick={editing ? undefined : onClose} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 44, background: "var(--scrim-photo)" }} /> : null}
      <aside
        aria-label={editing ? t.editTitle : t.about}
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: start,
          bottom: 0,
          left: 0,
          zIndex: 45,
          width: w,
          boxSizing: "border-box",
          padding: (headroom != null ? (typeof headroom === "number" ? headroom + "px" : headroom) : phone ? "var(--sp-7)" : "var(--sp-8)") + " " + padX + " " + padB,
          background: "var(--surface-card)",
          borderRight: "1px solid var(--border-hairline)",
          boxShadow: open ? "var(--shadow-lift)" : "none",
          transform: open ? "translateX(0)" : "translateX(-102%)",
          transition: "transform var(--dur-3) var(--ease-standard), box-shadow var(--dur-3) var(--ease-standard)",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: phone ? "var(--sp-6)" : "var(--sp-8)",
          ...style,
        }}
        {...rest}
      >
        {avatarTop != null ? (
          <span style={{ position: "absolute", top: avatarTop, left: "50%", marginLeft: -avatarSize / 2, display: "inline-flex", borderRadius: avatarRadius, boxShadow: "0 0 0 4px var(--surface-card)", zIndex: 1 }}>
            {editing ? (
              <Avatar src={d.avatarUrl} name={d.displayName} size={avatarSize} square={sq} alt="" />
            ) : (
              <button type="button" aria-label={onAvatar ? t.toProfile + profile.displayName : t.close} title={onAvatar ? t.toProfile + profile.displayName : t.close} onClick={onAvatar || onClose} style={{ padding: 0, border: 0, background: "transparent", borderRadius: avatarRadius, cursor: "pointer", display: "inline-flex" }}>
                <Avatar src={profile.avatarUrl} name={profile.displayName} size={avatarSize} square={sq} alt="" />
              </button>
            )}
            {editing ? (
              // Bottom-left arc, fixed spot whatever the shape: [shape toggle][camera]. The toggle shows the OTHER shape — what you get by pressing it.
              <span style={{ position: "absolute", left: 4, bottom: 4, display: "inline-flex", gap: "var(--sp-2)" }}>
                <button type="button" aria-label={sq ? t.shapeCircle : t.shapeSquare} title={sq ? t.shapeCircle : t.shapeSquare} aria-pressed={sq} onClick={() => onDraftChange && onDraftChange({ avatarShape: sq ? "circle" : "square" })} style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: "1px solid var(--action-quiet-border)", background: "var(--surface-card)", boxShadow: "var(--shadow-md)", cursor: "pointer" }}>
                  <Icon name={sq ? "circle" : "square"} size={18} tone="strong" />
                </button>
                <button type="button" aria-label={t.photo} title={t.photo} onClick={onChangePhoto} style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: "1px solid var(--action-quiet-border)", background: "var(--surface-card)", boxShadow: "var(--shadow-md)", cursor: "pointer" }}>
                  <Icon name="camera" size={18} tone="strong" />
                </button>
              </span>
            ) : null}
          </span>
        ) : null}
        {/* Top-right corner, edit mode only: ✓ saves, × cancels. Out of edit the bar's mark/wordmark and the avatar close the panel — on the phone exactly as on the desktop (the panel slides in under the logo, over the toolbar). Editing is started from the bar's „Edytuj” — no pencil here. */}
        {editing ? (
          <div style={{ position: "absolute", top: start ? "var(--sp-4)" : phone ? top + 8 : (top - btn) / 2, right: phone ? "var(--sp-4)" : "var(--sp-5)", display: "flex", gap: "var(--sp-2)", zIndex: 1 }}>
            {editing ? (
              <button type="button" aria-label={t.save} title={t.save} onClick={onSave} style={{ width: btn, height: btn, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "var(--action-solid)", cursor: "pointer" }}>
                <Icon name="check" size={btnIcon} tone="var(--action-solid-text)" />
              </button>
            ) : null}
            <button type="button" aria-label={t.cancel} title={t.cancel} onClick={onCancel} style={{ width: btn, height: btn, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "transparent", cursor: "pointer" }}>
              <Icon name="x" size={btnIcon} tone="muted" />
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", textAlign: "center", alignItems: "center" }}>
          {editing ? (
            <Framed as="h1" label={t.name} value={d.displayName} onChange={set("displayName")} textStyle={{ margin: 0, font: fH1, letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", textAlign: "center" }} />
          ) : (
            <h1 style={{ margin: 0, font: fH1, letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", overflowWrap: "anywhere", minWidth: 0 }}>{profile.displayName}</h1>
          )}
          {editing ? (
            <Framed as="p" label={t.headline} value={d.headline || ""} onChange={set("headline")} placeholder={t.headlinePh} textStyle={{ margin: 0, font: fLead, color: "var(--text-muted)", textAlign: "center" }} />
          ) : profile.headline ? <p style={{ margin: 0, font: fLead, color: "var(--text-muted)" }}>{profile.headline}</p> : null}
        </div>
        <Section title={t.address}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <span style={{ font: "var(--type-mono)", color: "var(--text-body)" }}>{address}</span>
            <button type="button" aria-label={copied ? t.copied : t.copy} title={copied ? t.copied : t.copy} onClick={() => setCopied(true)} style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "var(--surface-sunken)", cursor: "pointer" }}>
              <Icon name={copied ? "check" : "copy"} size={15} tone="strong" />
            </button>
          </div>
        </Section>
        {editing || places.length ? (
          <Section title={t.places}>
            <ul style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", listStyle: "none", margin: 0, padding: 0 }}>
              {places.map((p) => <Chip key={p} onRemove={editing ? () => onDraftChange && onDraftChange({ places: places.filter((x) => x !== p) }) : undefined} removeLabel={t.remove + p}>{p}</Chip>)}
              {editing ? <PlaceAdder places={places} onAdd={addPlace} label={t.addPlace} placeholder={t.addPlacePh} /> : null}
            </ul>
          </Section>
        ) : null}
        {editing || profile.bio ? (
          <Section title={t.about}>
            {editing ? (
              <Framed as="p" block label={t.about} value={d.bio || ""} onChange={set("bio")} placeholder={t.bioPh} textStyle={{ margin: 0, font: fBody, color: "var(--text-body)" }} />
            ) : (
              <p style={{ margin: 0, font: fBody, color: "var(--text-body)", whiteSpace: "pre-line" }}>{profile.bio}</p>
            )}
          </Section>
        ) : null}
        {children}
        {/* Plaque: a sticky footer, always in view; while editing it follows the name live. Chrome's sticky box is the scroller's content box, so `bottom` = -padding keeps it flush with the panel's edge; flexShrink 0 so the overflowing column cannot squash it. */}
        <div style={{ marginTop: "auto", flexShrink: 0, position: "sticky", bottom: "calc(-1 * " + padB + ")", background: "var(--surface-card)", borderTop: "1px solid var(--border-hairline)", marginLeft: "calc(-1 * " + padX + ")", marginRight: "calc(-1 * " + padX + ")", marginBottom: "calc(-1 * " + padB + ")", padding: (phone ? "var(--sp-4)" : "var(--sp-5)") + " " + padX + " " + (phone ? "var(--sp-6)" : "var(--sp-7)"), display: "flex", justifyContent: "center", overflowX: "auto" }}>
          <Plaque name={d.displayName} scale={0.5} shadow={false} />
        </div>
      </aside>
    </React.Fragment>
  );
}
