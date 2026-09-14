// A work's landing page (#200): /{handle}/{slug}. Behance-shaped — the words
// once at the top, then every picture at full column width, the orbit among
// them. The owner edits here, in place. Edit mode is a form top-to-bottom:
// words → pictures (each with replace / remove / cover) → how the card looks on
// the profile → autorotate → delete. A new work starts empty.
const { ProfileBar, AboutPanel, OrbitTile, Button, Icon, Avatar, Footer, Input, FormField } = window.ArchitektW3dDesignSystem_1d311d;

const WT = {
  pl: {
    back: "Wszystkie realizacje", edit: "Edytuj", save: "Zapisz", cancel: "Anuluj", newWork: "Nowa realizacja", untitled: "Bez nazwy",
    name: "Nazwa", investor: "Inwestor", developer: "Deweloper", description: "Opis", descHint: "Do 300 znaków. Widoczny na stronie realizacji i — w układzie „Okładka + opis” — na karcie.",
    pictures: "Zdjęcia", picturesHint: "Kolejność ustawiasz, przeciągając miniatury. Pierwsze zdjęcie jest okładką karty na profilu; drugie i trzecie — miniaturami w układzie „Okładka + 2 miniatury”.", dragHint: "Przeciągnij, aby zmienić kolejność", moveLeft: "Przesuń w lewo", moveRight: "Przesuń w prawo",
    orbit: "Widok 360° (R360)", orbitHint: "Paczka zip z R360. Na profilu widok obraca się w miejscu karty.", addOrbit: "Dodaj zip R360", replaceOrbit: "Wymień zip", removeOrbit: "Usuń widok 360°",
    add: "Dodaj zdjęcia", addFirst: "Dodaj pierwsze zdjęcie", addFirstBody: "JPG, PNG lub WebP, do 20 MB. Najwyżej dziesięć zdjęć.", cover: "Okładka", setCover: "Ustaw jako okładkę", replace: "Wymień", remove: "Usuń", up: "Przesuń wyżej", down: "Przesuń niżej",
    layout: "Karta na profilu", layoutHint: "Jak ta realizacja pokazuje się na Twojej ścianie realizacji. Okładka i miniatury to pierwsze zdjęcia z listy poniżej.", layouts: { cover: "Okładka", "cover-thumbs": "Okładka + 2 miniatury", "cover-text": "Okładka + opis" }, needThumbs: "Wymaga co najmniej trzech zdjęć.", needDesc: "Wymaga opisu.",
    autorotate: "R360 obraca się sam na profilu", delete: "Usuń realizację", deleteHint: "Razem ze zdjęciami i paczką R360. Nie da się cofnąć.",
  },
  en: {
    back: "All works", edit: "Edit", save: "Save", cancel: "Cancel", newWork: "New work", untitled: "Untitled",
    name: "Name", investor: "Investor", developer: "Developer", description: "Description", descHint: "Up to 300 characters. Shown on the work page and — in the “Cover + description” layout — on the card.",
    pictures: "Photos", picturesHint: "Reorder by dragging the thumbnails. The first photo is the card's cover on the profile; the second and third are the thumbnails in the “Cover + 2 thumbnails” layout.", dragHint: "Drag to reorder", moveLeft: "Move left", moveRight: "Move right",
    orbit: "360° view (R360)", orbitHint: "An R360 zip. On the profile the view turns in place of the card.", addOrbit: "Add R360 zip", replaceOrbit: "Replace zip", removeOrbit: "Remove 360° view",
    add: "Add photos", addFirst: "Add the first photo", addFirstBody: "JPG, PNG or WebP, up to 20 MB. Ten photos at most.", cover: "Cover", setCover: "Set as cover", replace: "Replace", remove: "Remove", up: "Move up", down: "Move down",
    layout: "Card on the profile", layoutHint: "How this work shows on your wall of work. The cover and thumbnails are the first photos in the list below.", layouts: { cover: "Cover", "cover-thumbs": "Cover + 2 thumbnails", "cover-text": "Cover + description" }, needThumbs: "Needs at least three photos.", needDesc: "Needs a description.",
    autorotate: "R360 turns by itself on the profile", delete: "Delete work", deleteHint: "Together with its photos and the R360 zip. Cannot be undone.",
  },
};
const SAMPLE_PHOTOS = ["../../assets/hero-facade-plaque.jpeg", "../../assets/landing-placeholder.webp"];

function Seg({ value, options, onChange, label, disabled = {} }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", padding: 3, gap: 2, borderRadius: "var(--radius-control)", background: "var(--surface-sunken)" }}>
      {Object.entries(options).map(([k, l]) => {
        const off = !!disabled[k];
        return (
          <button key={k} type="button" role="radio" aria-checked={value === k} disabled={off} title={off ? disabled[k] : undefined} onClick={() => onChange(k)} style={{ height: 34, padding: "0 var(--sp-4)", border: 0, borderRadius: 9, background: value === k ? "var(--surface-card)" : "transparent", color: off ? "var(--text-subtle)" : value === k ? "var(--text-strong)" : "var(--text-muted)", font: "var(--type-label)", cursor: off ? "not-allowed" : "pointer", boxShadow: value === k ? "var(--shadow-sm)" : "none", opacity: off ? 0.6 : 1 }}>{l}</button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-3)", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "var(--type-label)", color: "var(--text-body)" }}>
      <span aria-hidden="true" style={{ width: 40, height: 24, borderRadius: 12, background: checked ? "var(--n-950)" : "var(--n-300)", position: "relative", transition: "var(--transition-control)" }}>
        <span style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left var(--dur-1) var(--ease-standard)" }} />
      </span>
      {label}
    </button>
  );
}

function Section({ title, hint, children, right }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{title}</h2>
        {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
      </div>
      {hint ? <p style={{ margin: 0, font: "var(--type-sm)", color: "var(--text-muted)", maxWidth: "40rem" }}>{hint}</p> : null}
      {children}
    </section>
  );
}

// The white pill of controls that sits on an editable picture.
function TileActions({ children }) {
  return <div style={{ position: "absolute", top: "var(--sp-4)", right: "var(--sp-4)", display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: "var(--radius-full)", background: "rgba(255,255,255,.94)", boxShadow: "var(--shadow-md)" }}>{children}</div>;
}
function TileBtn({ icon, label, onClick, danger }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} style={{ width: 32, height: 32, border: 0, borderRadius: 16, background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} tone={danger ? "danger" : "strong"} /></button>;
}
function TileTag({ children }) {
  return <span style={{ alignSelf: "center", padding: "0 var(--sp-3)", font: "var(--type-eyebrow)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: "var(--text-muted)" }}>{children}</span>;
}

// Thumbnail strip: the place to reorder. Drag a thumb (pointer) or focus it
// and press ←/→. The first thumb is the card's cover on the profile.
function Filmstrip({ photos, onReorder, onAdd, t, phone }) {
  const [drag, setDrag] = React.useState(null);
  const [over, setOver] = React.useState(null);
  const size = phone ? 72 : 96;
  const drop = (to) => { if (drag == null || to == null || drag === to) { setDrag(null); setOver(null); return; } const l = [...photos]; const [m] = l.splice(drag, 1); l.splice(to, 0, m); onReorder(l); setDrag(null); setOver(null); };
  const nudge = (i, d) => { const j = i + d; if (j < 0 || j >= photos.length) return; const l = [...photos]; [l[i], l[j]] = [l[j], l[i]]; onReorder(l); };
  return (
    <ol aria-label={t.dragHint} style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", margin: 0, padding: 0, listStyle: "none" }}>
      {photos.map((src, i) => (
        <li
          key={src + i}
          draggable
          tabIndex={0}
          aria-label={(i === 0 ? t.cover + " · " : "") + (i + 1) + "/" + photos.length + " — " + t.dragHint}
          onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (over !== i) setOver(i); }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); drop(i); }}
          onDragEnd={() => { setDrag(null); setOver(null); }}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); nudge(i, -1); } if (e.key === "ArrowRight") { e.preventDefault(); nudge(i, 1); } }}
          style={{ position: "relative", width: size * 4 / 3, height: size, borderRadius: "var(--radius-picture)", overflow: "hidden", background: "var(--n-150)", cursor: "grab", opacity: drag === i ? 0.4 : 1, outline: over === i && drag !== i ? "2px solid var(--n-950)" : "none", outlineOffset: 2, boxShadow: i === 0 ? "0 0 0 2px var(--n-950)" : "none", transition: "opacity var(--dur-1) var(--ease-standard)" }}
        >
          <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
          {i === 0 ? <span style={{ position: "absolute", left: 6, bottom: 6, padding: "2px 8px", borderRadius: "var(--radius-full)", background: "rgba(255,255,255,.94)", font: "var(--type-eyebrow)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: "var(--text-strong)" }}>{t.cover}</span> : null}
          {phone ? (
            <span style={{ position: "absolute", right: 4, bottom: 4, display: "flex", gap: 2 }}>
              <button type="button" aria-label={t.moveLeft} onClick={() => nudge(i, -1)} disabled={i === 0} style={{ width: 24, height: 24, border: 0, borderRadius: 12, background: "rgba(255,255,255,.94)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.4 : 1 }}><Icon name="chevron-left" size={14} tone="strong" /></button>
              <button type="button" aria-label={t.moveRight} onClick={() => nudge(i, 1)} disabled={i === photos.length - 1} style={{ width: 24, height: 24, border: 0, borderRadius: 12, background: "rgba(255,255,255,.94)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: i === photos.length - 1 ? 0.4 : 1 }}><Icon name="chevron-right" size={14} tone="strong" /></button>
            </span>
          ) : null}
        </li>
      ))}
      <li style={{ width: size * 4 / 3, height: size }}>
        <button type="button" aria-label={t.add} title={t.add} onClick={onAdd} style={{ width: "100%", height: "100%", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-picture)", background: "var(--surface-card)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={20} tone="muted" /></button>
      </li>
    </ol>
  );
}

function Dropzone({ title, body, action, onClick, compact }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-3)", width: "100%", minHeight: compact ? 120 : 260, padding: "var(--sp-7)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-picture)", background: "var(--surface-card)", cursor: "pointer", textAlign: "center" }}>
      <Icon name={compact ? "plus" : "image-plus"} size={compact ? 20 : 28} tone="subtle" />
      <span style={{ font: "var(--type-h4)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>{title}</span>
      {body ? <span style={{ font: "var(--type-sm)", color: "var(--text-muted)", maxWidth: "26rem" }}>{body}</span> : null}
      {action ? <span style={{ marginTop: "var(--sp-2)", font: "var(--type-label)", color: "var(--text-strong)", textDecoration: "underline", textUnderlineOffset: 3 }}>{action}</span> : null}
    </button>
  );
}

function WorkPage({ profile, work, viewer, locale = "pl", phone = false, editing: editingInit = false, onBack, onSave, onDelete, onEnlarge, onGo }) {
  const t = WT[locale];
  const owner = viewer === "owner";
  const isNew = !!work.isNew;
  const [editing, setEditing] = React.useState(owner && (editingInit || isNew));
  const [draft, setDraft] = React.useState(work);
  React.useEffect(() => setDraft(work), [work]);
  // The about panel opens from the bar's logo here too (read-only); its avatar goes back to the profile.
  const [about, setAbout] = React.useState(false);
  const barTop = phone ? 56 : 64;
  const panelAvatar = phone ? 96 : 120;
  const panelAvatarTop = phone ? 24 : 32;
  const w = editing ? draft : work;
  const photos = w.pictures || [];
  const pictures = [w.orbit ? { kind: "orbit" } : null, ...photos.map((src) => ({ kind: "photo", src }))].filter(Boolean);
  const setPhotos = (list) => setDraft({ ...draft, pictures: list, cover: list[0] || (draft.orbit && draft.orbit.poster) || null, thumbs: list.slice(1, 3) });
  const remove = (i) => setPhotos(photos.filter((_, k) => k !== i));
  const replace = (i) => { const l = [...photos]; l[i] = SAMPLE_PHOTOS[(SAMPLE_PHOTOS.indexOf(l[i]) + 1) % SAMPLE_PHOTOS.length]; setPhotos(l); };
  const add = () => setPhotos([...photos, SAMPLE_PHOTOS[photos.length % SAMPLE_PHOTOS.length]]);
  const setOrbit = (o) => setDraft({ ...draft, orbit: o, cover: photos[0] || (o && o.poster) || null });
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const layoutDisabled = { "cover-thumbs": photos.length < 3 ? t.needThumbs : null, "cover-text": !(draft.description || "").trim() ? t.needDesc : null };
  const layout = layoutDisabled[draft.layout] ? "cover" : draft.layout;
  const canSave = (draft.name || "").trim() && (photos.length > 0 || draft.orbit);
  const padX = phone ? "var(--sp-4)" : "var(--sp-7)";
  const actions = owner ? (
    editing ? (
      <React.Fragment>
        {/* Same trio as the about panel's corner: trash (icon only), × cancels, ✓ saves. */}
        {!isNew ? <button type="button" aria-label={t.delete} title={t.delete} onClick={() => onDelete && onDelete(work)} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "transparent", cursor: "pointer" }}><Icon name="trash-2" size={18} tone="danger" /></button> : null}
        <button type="button" aria-label={t.cancel} title={t.cancel} onClick={() => { if (isNew) { onBack && onBack(); return; } setDraft(work); setEditing(false); }} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "transparent", cursor: "pointer" }}><Icon name="x" size={20} tone="muted" /></button>
        <button type="button" aria-label={t.save} title={t.save} disabled={!canSave} onClick={() => { onSave && onSave({ ...draft, layout, isNew: false }); setEditing(false); }} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "var(--action-solid)", cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.4 }}><Icon name="check" size={20} tone="var(--action-solid-text)" /></button>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <button type="button" aria-label={t.edit} title={t.edit} onClick={() => setEditing(true)} style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "rgba(255,255,255,.94)", color: "var(--n-950)", cursor: "pointer", boxShadow: "var(--shadow-md)" }}><Icon name="pencil" size={16} tone="strong" /></button>
        <button type="button" aria-label="Menu konta" style={{ width: 40, height: 40, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}><Avatar src={profile.avatarUrl} name={profile.displayName} size={32} square={profile.avatarShape === "square"} alt="" /></button>
      </React.Fragment>
    )
  ) : null;
  const rows = [w.investor && [t.investor, w.investor], w.developer && [t.developer, w.developer]].filter(Boolean);
  const field = { display: "flex", flexDirection: "column", gap: "var(--sp-2)" };
  const label = { font: "var(--type-label)", color: "var(--text-body)" };
  const area = { font: "var(--type-body)", padding: "var(--sp-4) var(--sp-5)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", resize: "vertical", minHeight: 120, color: "var(--text-body)", fontFamily: "var(--font-sans)", width: "100%", boxSizing: "border-box" };
  const tileAspect = phone ? "4 / 3" : "16 / 9";

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%" }}>
      <ProfileBar profile={profile} solid aboutOpen={about} onToggleAbout={() => setAbout((o) => !o)} phone={phone} actions={actions} />
      <AboutPanel profile={profile} open={about} onClose={() => setAbout(false)} onAvatar={onBack} phone={phone} owner={owner} top={barTop} start={barTop} width={380} headroom={panelAvatarTop + panelAvatar + (phone ? 16 : 24)} avatarTop={panelAvatarTop} avatarSize={panelAvatar} locale={locale} />
      <main style={{ maxWidth: "var(--measure-works)", margin: "0 auto", padding: (phone ? 56 + 24 : 64 + 40) + "px " + padX + " " + (phone ? "var(--sp-12)" : "var(--sp-16)"), display: "flex", flexDirection: "column", gap: phone ? "var(--sp-8)" : "var(--sp-10)" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onBack && onBack(); }} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", font: "var(--type-label)", color: "var(--text-muted)", textDecoration: "none", alignSelf: "flex-start" }}>
          <Icon name="arrow-left" size={16} tone="muted" />{t.back}
        </a>

        {editing ? (
          <header style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: "var(--sp-5) var(--sp-8)", maxWidth: "64rem" }}>
            <div style={{ ...field, gridColumn: phone ? undefined : "1 / -1" }}>
              <label style={label} htmlFor="w-name">{t.name}</label>
              <Input id="w-name" size="lg" value={draft.name || ""} placeholder={t.newWork} onChange={set("name")} />
            </div>
            <div style={field}><label style={label} htmlFor="w-inv">{t.investor}</label><Input id="w-inv" value={draft.investor || ""} onChange={set("investor")} /></div>
            <div style={field}><label style={label} htmlFor="w-dev">{t.developer}</label><Input id="w-dev" value={draft.developer || ""} onChange={set("developer")} /></div>
            <div style={{ ...field, gridColumn: phone ? undefined : "1 / -1" }}>
              <label style={label} htmlFor="w-desc">{t.description}</label>
              <textarea id="w-desc" value={draft.description || ""} maxLength={300} onChange={set("description")} style={area} />
              <span style={{ font: "var(--type-sm)", color: "var(--text-subtle)" }}>{t.descHint} <span style={{ font: "var(--type-mono)" }}>{(draft.description || "").length}/300</span></span>
            </div>
            <div style={{ ...field, gridColumn: phone ? undefined : "1 / -1", gap: "var(--sp-3)", paddingTop: "var(--sp-2)" }}>
              <span style={label}>{t.layout}</span>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--sp-4) var(--sp-8)" }}>
                <Seg label={t.layout} value={layout} options={t.layouts} disabled={layoutDisabled} onChange={(v) => setDraft({ ...draft, layout: v })} />
                {draft.orbit ? <Toggle label={t.autorotate} checked={!!draft.orbit.autorotate} onChange={(v) => setOrbit({ ...draft.orbit, autorotate: v })} /> : null}
              </div>
              <span style={{ font: "var(--type-sm)", color: "var(--text-subtle)" }}>{layoutDisabled[draft.layout] && draft.layout !== layout ? layoutDisabled[draft.layout] : t.layoutHint}</span>
            </div>
          </header>
        ) : (
          <header style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "minmax(0,1.4fr) minmax(0,1fr)", gap: phone ? "var(--sp-5)" : "var(--sp-12)", alignItems: "start", maxWidth: "80rem" }}>
            <h1 style={{ margin: 0, font: phone ? "var(--type-h1)" : "var(--type-display)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", textWrap: "balance" }}>{w.name || t.untitled}</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {rows.length ? (
                <dl style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2) var(--sp-7)", margin: 0, font: "var(--type-sm)" }}>
                  {rows.map(([k, v]) => <div key={k} style={{ display: "flex", gap: "var(--sp-2)" }}><dt style={{ color: "var(--text-subtle)" }}>{k}</dt><dd style={{ margin: 0, fontWeight: "var(--fw-semibold)", color: "var(--text-body)" }}>{v}</dd></div>)}
                </dl>
              ) : null}
              {w.description ? <p style={{ margin: 0, font: "var(--type-lead)", color: "var(--text-muted)" }}>{w.description}</p> : null}
            </div>
          </header>
        )}

        {editing ? (
          <Section title={t.orbit} hint={t.orbitHint}>
            {draft.orbit ? (
              <div style={{ position: "relative" }}>
                <OrbitTile poster={draft.orbit.poster || photos[0]} name={draft.name || t.untitled} cues={draft.orbit.cues || []} autorotate={false} ring={!phone} aspect={tileAspect} />
                <TileActions>
                  <TileTag>360°</TileTag>
                  <TileBtn icon="refresh-cw" label={t.replaceOrbit} onClick={() => setOrbit({ ...draft.orbit, poster: SAMPLE_PHOTOS[(SAMPLE_PHOTOS.indexOf(draft.orbit.poster) + 1) % SAMPLE_PHOTOS.length] })} />
                  <TileBtn icon="x" label={t.removeOrbit} onClick={() => setOrbit(null)} danger />
                </TileActions>
              </div>
            ) : (
              <Dropzone compact title={t.addOrbit} onClick={() => setOrbit({ poster: photos[0] || SAMPLE_PHOTOS[0], autorotate: true, cues: [] })} />
            )}
          </Section>
        ) : null}

        {editing ? (
          <Section title={t.pictures} hint={t.picturesHint}>
            {photos.length === 0 ? (
              <Dropzone title={t.addFirst} body={t.addFirstBody} action={t.add} onClick={add} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--sp-5)" : "var(--sp-7)" }}>
                <Filmstrip photos={photos} onReorder={setPhotos} onAdd={add} t={t} phone={phone} />
                {photos.map((src, i) => (
                  <figure key={src + i} style={{ position: "relative", margin: 0, borderRadius: "var(--radius-picture)", overflow: "hidden", background: "var(--n-150)", aspectRatio: tileAspect }}>
                    <img src={src} alt={(draft.name || t.untitled) + ", zdjęcie " + (i + 1)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    <TileActions>
                      {i === 0 ? <TileTag>{t.cover}</TileTag> : <TileTag>{i + 1}</TileTag>}
                      <TileBtn icon="refresh-cw" label={t.replace} onClick={() => replace(i)} />
                      <TileBtn icon="x" label={t.remove} onClick={() => remove(i)} danger />
                    </TileActions>
                  </figure>
                ))}
              </div>
            )}
          </Section>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--sp-4)" : "var(--sp-6)" }}>
            {pictures.map((p, i) =>
              p.kind === "orbit" ? (
                <OrbitTile key="orbit" poster={w.orbit.poster || w.cover} name={w.name} cues={w.orbit.cues || []} autorotate={w.orbit.autorotate} ring={!phone} aspect={tileAspect} onEnlarge={onEnlarge ? () => onEnlarge(w, 0) : undefined} />
              ) : (
                <figure key={p.src + i} style={{ position: "relative", margin: 0, borderRadius: "var(--radius-picture)", overflow: "hidden", background: "var(--n-150)", aspectRatio: tileAspect }}>
                  <img src={p.src} alt={w.name + ", zdjęcie " + (i + (w.orbit ? 0 : 1))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: onEnlarge ? "zoom-in" : "default" }} onClick={onEnlarge ? () => onEnlarge(w, i) : undefined} />
                </figure>
              )
            )}
          </div>
        )}

      </main>
      <Footer note="Warszawa · architektow3d.pl" links={[{ label: "Regulamin" }, { label: "Prywatność" }, { label: "Kontakt" }]} locale={locale} />
    </div>
  );
}

function Lightbox({ work, index, onClose }) {
  const pics = [work.orbit ? { kind: "orbit" } : null, ...(work.pictures || []).map((src) => ({ kind: "photo", src }))].filter(Boolean);
  const [i, setI] = React.useState(index);
  const p = pics[i];
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((x) => (x + 1) % pics.length); if (e.key === "ArrowLeft") setI((x) => (x + pics.length - 1) % pics.length); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [pics.length, onClose]);
  const nav = (d) => setI((x) => (x + d + pics.length) % pics.length);
  const btn = { width: 44, height: 44, borderRadius: 22, border: 0, background: "rgba(255,255,255,.12)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  return (
    <div role="dialog" aria-modal="true" aria-label={work.name} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(12,17,22,.96)", display: "grid", gridTemplateRows: "auto 1fr", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-4) var(--sp-6)" }}>
        <span style={{ font: "var(--type-label)" }}>{work.name}</span>
        <span style={{ font: "var(--type-mono)", color: "rgba(255,255,255,.6)" }}>{i + 1} / {pics.length}</span>
        <button type="button" aria-label="Zamknij" onClick={onClose} style={{ ...btn, marginLeft: "auto" }}><Icon name="x" size={20} tone="onPhoto" /></button>
      </div>
      <div style={{ position: "relative", display: "grid", placeItems: "center", padding: "0 var(--sp-16) var(--sp-8)", minHeight: 0 }}>
        {p.kind === "orbit" ? <OrbitTile poster={work.orbit.poster || work.cover} name={work.name} cues={work.orbit.cues || []} autorotate={false} ring aspect="16 / 9" style={{ width: "min(100%, 1400px)" }} radius="var(--radius-picture)" /> : <img src={p.src} alt={work.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "var(--radius-picture)", objectFit: "contain" }} />}
        {pics.length > 1 ? (
          <React.Fragment>
            <button type="button" aria-label="Poprzednie" onClick={() => nav(-1)} style={{ ...btn, position: "absolute", left: "var(--sp-6)", top: "50%", marginTop: -22 }}><Icon name="chevron-left" size={22} tone="onPhoto" /></button>
            <button type="button" aria-label="Następne" onClick={() => nav(1)} style={{ ...btn, position: "absolute", right: "var(--sp-6)", top: "50%", marginTop: -22 }}><Icon name="chevron-right" size={22} tone="onPhoto" /></button>
          </React.Fragment>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { WorkPage, Lightbox });
