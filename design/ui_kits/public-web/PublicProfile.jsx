// The public profile as a wall of work: cover under a transparent bar, the
// about panel sliding in from the left, works stacked full width in a column
// capped at --measure-works. Viewer modes: visitor (signed-out), other
// (signed-in, not the owner), owner. Owner edits identity in the panel and
// works on their own landing pages. Identity editing happens inside the about
// panel itself (same layout, framed fields) — see AboutPanel's `editing`.
const { ProfileBar, AboutPanel, WorkCard, Button, Icon, Footer, Avatar } = window.ArchitektW3dDesignSystem_1d311d;

const T = {
  pl: { login: "Zaloguj się", register: "Załóż konto", add: "Realizacja", edit: "Edytuj", works: "Realizacje", account: "Menu konta", menu: "Menu", profileItem: "Profil", accountItem: "Konto", logout: "Wyloguj", name: "Nazwa", headline: "Nagłówek", bio: "O nas", places: "Siedziba i obszar działania (po przecinku)", save: "Zapisz", cancel: "Anuluj", editTitle: "Edytuj profil", photo: "Zmień zdjęcie", coverChange: "Zmień tło", empty: "Jeszcze bez realizacji", emptyBody: "Wejdź w „Edytuj” i dodaj pierwszą plusem pod zdjęciem w tle. Nazwa i jedno zdjęcie wystarczą na start." },
  en: { login: "Log in", register: "Sign up", add: "Work", edit: "Edit", works: "Works", account: "Account menu", menu: "Menu", profileItem: "Profile", accountItem: "Account", logout: "Log out", name: "Name", headline: "Headline", bio: "About", places: "Based in and working across (comma-separated)", save: "Save", cancel: "Cancel", editTitle: "Edit profile", photo: "Change photo", coverChange: "Change cover", empty: "No works yet", emptyBody: "Open “Edit” and add the first one with the plus under the cover. A name and one photo are enough to start." },
};

// The cover band is always there (a photo, or the dark placeholder) and scrolls
// with the page; the bar turns solid once the band's bottom edge passes under it.
function useSolid(coverRef, rootRef, barTop) {
  const [solid, setSolid] = React.useState(false);
  React.useEffect(() => {
    if (!coverRef.current) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), { root: rootRef && rootRef.current ? rootRef.current : null, rootMargin: "-" + barTop + "px 0px 0px 0px", threshold: 0 });
    io.observe(coverRef.current);
    return () => io.disconnect();
  }, [coverRef, rootRef, barTop]);
  return solid;
}

// One popover for the bar's right slot. Desktop: language chip + avatar menu
// (Profil, Konto, Wyloguj). Phone: EVERYTHING lives under one trigger — the
// avatar for the signed-in, a hamburger for the visitor — language included.
// Dismiss: outside press, Escape, or picking an item.
function Popover({ trigger, label, open, setOpen, children }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {React.cloneElement(trigger, { "aria-haspopup": "menu", "aria-expanded": open, "aria-label": label, onClick: () => setOpen((o) => !o) })}
      {open ? (
        <nav role="menu" aria-label={label} style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 224, padding: "var(--sp-2)", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lift)", display: "flex", flexDirection: "column", gap: 2, color: "var(--text-body)" }}>
          {children}
        </nav>
      ) : null}
    </div>
  );
}
function MenuItem({ icon, lead, check, children, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" role="menuitem" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", width: "100%", height: 44, padding: "0 var(--sp-4)", border: 0, borderRadius: "var(--radius-sm)", background: hover ? "var(--surface-hover)" : "transparent", font: "var(--type-body)", color: "var(--text-strong)", textAlign: "left", cursor: "pointer" }}>
      {lead ? lead : icon ? <Icon name={icon} size={18} tone="muted" /> : null}
      <span style={{ flex: 1 }}>{children}</span>
      {check ? <Icon name="check" size={16} tone="strong" /> : null}
    </button>
  );
}
function MenuRule() { return <hr style={{ margin: "var(--sp-1) 0", border: 0, borderTop: "1px solid var(--border-hairline)" }} />; }
function LanguageItems({ locale, onLocale, onPick }) {
  return (
    <React.Fragment>
      <MenuItem lead={<window.Flag locale="pl" />} check={locale === "pl"} onClick={() => { onLocale && onLocale("pl"); onPick(); }}>Polski</MenuItem>
      <MenuItem lead={<window.Flag locale="en" />} check={locale === "en"} onClick={() => { onLocale && onLocale("en"); onPick(); }}>English</MenuItem>
    </React.Fragment>
  );
}
function AccountMenu({ profile, phone, locale, onLocale, onGo, t }) {
  const [open, setOpen] = React.useState(false);
  const pick = (s) => () => { setOpen(false); if (s && onGo) onGo(s); };
  const trigger = (
    <button type="button" style={{ width: 40, height: 40, padding: 0, border: 0, background: "transparent", borderRadius: profile.avatarShape === "square" ? "var(--radius-xs)" : "var(--radius-full)", cursor: "pointer", display: "inline-flex", boxShadow: "0 0 0 2px var(--surface-card)" }}>
      <Avatar src={profile.avatarUrl} name={profile.displayName} size={40} square={profile.avatarShape === "square"} alt="" />
    </button>
  );
  return (
    <Popover trigger={trigger} label={t.account} open={open} setOpen={setOpen}>
      <MenuItem icon="user" onClick={pick("profile")}>{t.profileItem}</MenuItem>
      <MenuItem icon="settings" onClick={pick("account")}>{t.accountItem}</MenuItem>
      {phone ? <React.Fragment><MenuRule /><LanguageItems locale={locale} onLocale={onLocale} onPick={() => setOpen(false)} /></React.Fragment> : null}
      <MenuRule />
      <MenuItem icon="log-out" onClick={pick("logout")}>{t.logout}</MenuItem>
    </Popover>
  );
}
function VisitorMenu({ onPhoto, locale, onLocale, onGo, t }) {
  const [open, setOpen] = React.useState(false);
  const pick = (s) => () => { setOpen(false); if (s && onGo) onGo(s); };
  const trigger = (
    <button type="button" style={{ width: 40, height: 40, padding: 0, border: 0, background: "transparent", borderRadius: "var(--radius-full)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="menu" size={22} tone={onPhoto ? "onPhoto" : "strong"} />
    </button>
  );
  return (
    <Popover trigger={trigger} label={t.menu} open={open} setOpen={setOpen}>
      <LanguageItems locale={locale} onLocale={onLocale} onPick={() => setOpen(false)} />
      <MenuRule />
      <MenuItem icon="log-in" onClick={pick("login")}>{t.login}</MenuItem>
      <MenuItem icon="user-plus" onClick={pick("register")}>{t.register}</MenuItem>
    </Popover>
  );
}

function PublicProfile({ profile, works, viewer = "visitor", locale = "pl", onLocale, phone = false, rootRef, aboutDefault, onOpenWork, onEditWork, onEnlarge, onChangeProfile, onGo }) {
  const t = T[locale];
  const owner = viewer === "owner";
  const hasCover = true; // a photo or the placeholder — the band is always there
  const [about, setAbout] = React.useState(aboutDefault ?? !phone);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const startEdit = () => { setDraft({ ...profile }); setAbout(true); setEditing(true); };
  const stopEdit = () => { setEditing(false); setDraft(null); };
  const cancelEdit = () => { stopEdit(); setAbout(false); }; // × drops the draft and closes the panel; ✓ saves and leaves it open
  const saveEdit = () => { if (draft && onChangeProfile) onChangeProfile({ displayName: draft.displayName, headline: draft.headline, bio: draft.bio, places: draft.places || [], avatarShape: draft.avatarShape || "circle" }); stopEdit(); };
  const barTop = phone ? 56 : 64;
  const coverRef = React.useRef(null);
  const solid = useSolid(coverRef, rootRef, barTop);
  const onPhoto = hasCover && !solid;
  const lang = !phone ? <window.LanguageChip locale={locale} onChange={onLocale} onPhoto={onPhoto} /> : null;
  const actions = viewer === "visitor" ? (
    phone ? <VisitorMenu onPhoto={onPhoto} locale={locale} onLocale={onLocale} onGo={onGo} t={t} /> : (
      <React.Fragment>
        {lang}
        <Button variant={onPhoto ? "onPhotoQuiet" : "ghost"} onClick={() => onGo && onGo("login")}>{t.login}</Button>
        <Button variant={onPhoto ? "onPhoto" : "solid"} onClick={() => onGo && onGo("register")}>{t.register}</Button>
      </React.Fragment>
    )
  ) : viewer === "other" ? (
    <React.Fragment>
      {lang}
      <AccountMenu profile={{ displayName: "Kuba Render", avatarUrl: null }} phone={phone} locale={locale} onLocale={onLocale} onGo={onGo} t={t} />
    </React.Fragment>
  ) : (
    <React.Fragment>
      {lang}
      <button type="button" aria-label={t.editTitle} title={t.editTitle} aria-pressed={editing} disabled={editing} onClick={startEdit} style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", border: 0, background: "rgba(255,255,255,.94)", color: "var(--n-950)", cursor: editing ? "default" : "pointer", boxShadow: "var(--shadow-md)", opacity: editing ? 0.5 : 1 }}><Icon name="pencil" size={16} tone="strong" /></button>
      <AccountMenu profile={profile} phone={phone} locale={locale} onLocale={onLocale} onGo={onGo} t={t} />
    </React.Fragment>
  );
  const padX = phone ? "var(--sp-4)" : "var(--sp-7)";
  const PANEL_W = 380;
  const avatarSize = phone ? 120 : 176;
  // Floor = bar + avatar/2 + gap, so the avatar can never rise into the bar.
  const coverMin = barTop + avatarSize / 2 + (phone ? 12 : 16);
  const coverH = phone ? "clamp(" + coverMin + "px, 17vh, 150px)" : "clamp(" + coverMin + "px, 19vh, 240px)";
  // Page avatar: on the band's bottom edge, left edge flush with the works column
  // (same rule as <main>'s padding); scrolls with the band. The panel carries its
  // own copy, centred, at the same height.
  const avatarLeft = "max(" + padX + ", calc((100% - var(--measure-works)) / 2 + " + padX + "))";
  const avatarTop = "calc(" + coverH + " - " + avatarSize / 2 + "px)";
  const gap = phone ? 16 : 24;
  const panelStart = 0;
  const headroom = "calc(" + coverH + " + " + (avatarSize / 2 + gap) + "px)";
  const sq = profile.avatarShape === "square";
  const avatarButton = (
    <button type="button" aria-expanded={about} aria-label={(about ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName} onClick={() => { if (!editing) setAbout((o) => !o); }} style={{ padding: 0, border: 0, background: "transparent", borderRadius: sq ? "var(--radius-md)" : "var(--radius-full)", cursor: editing ? "default" : "pointer", display: "inline-flex", boxShadow: "0 0 0 4px var(--surface-card)" }}>
      <Avatar src={profile.avatarUrl} name={profile.displayName} size={avatarSize} square={sq} alt="" />
    </button>
  );
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%" }}>
      <ProfileBar profile={profile} solid={!onPhoto} aboutOpen={about} onToggleAbout={() => setAbout((o) => !o)} toggleDisabled={editing} phone={phone} actions={actions} />
      <div ref={coverRef} style={{ position: "relative", height: coverH, background: "var(--n-900)", zIndex: 2 }}>
          <div role="button" tabIndex={0} aria-expanded={about} aria-label={(about ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName} onClick={() => { if (!editing) setAbout((o) => !o); }} onKeyDown={(e) => { if (!editing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setAbout((o) => !o); } }} style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: editing ? "default" : "pointer" }}>
            {profile.cover ? (
              <img src={profile.cover} alt={"Zdjęcie w tle profilu " + profile.displayName} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 45%" }} />
            ) : (
              // Placeholder band: the plaque's navy, deep, with a faint diagonal weave — never empty.
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 14px), linear-gradient(180deg, var(--plaque-navy-deep), #052a68)" }} />
            )}
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,17,22,.5), rgba(12,17,22,0) 60%)" }} />
          </div>
          <div style={{ position: "absolute", left: avatarLeft, right: padX, bottom: -avatarSize / 2, display: "flex", alignItems: "flex-end", gap: phone ? "var(--sp-4)" : "var(--sp-6)", zIndex: 3, pointerEvents: "none" }}>
            <div style={{ display: "flex", pointerEvents: "auto" }}>{avatarButton}</div>
            {/* Name beside the avatar, on the page half of the band. Fades with the panel: the panel slides over the avatar, the name goes with it. */}
            <p aria-hidden={about} style={{ margin: 0, paddingBottom: phone ? 6 : 10, font: phone ? "var(--type-h2)" : "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", minWidth: 0, overflowWrap: "anywhere", textWrap: "balance", opacity: about ? 0 : 1, transform: about ? "translateX(-12px)" : "none", transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)" }}>{profile.displayName}</p>
          </div>
          {editing ? <div style={{ position: "absolute", right: padX, bottom: "var(--sp-4)", zIndex: 3 }}><Button variant="onPhoto"><Icon name="image" size={16} tone="strong" />{t.coverChange}</Button></div> : null}
      </div>
      <div style={{ position: "relative", zIndex: 1, background: "var(--surface-page)" }}>
      {/* Owner, edit mode only: „+ Realizacja” under the cover, top-right of the works column, opposite the avatar. */}
      {owner && editing ? <div style={{ position: "absolute", top: gap, right: avatarLeft, zIndex: 3 }}><Button variant="quiet" onClick={() => onEditWork && onEditWork(null)}><Icon name="plus" size={16} tone="strong" />{t.add}</Button></div> : null}
      <main style={{ maxWidth: "var(--measure-works)", margin: "0 auto", padding: avatarSize / 2 + gap + "px " + padX + " " + (phone ? "var(--sp-12)" : "var(--sp-16)"), display: "flex", flexDirection: "column", gap: phone ? "var(--sp-10)" : "var(--sp-14)" }}>
        {works.length === 0 && owner ? (
          <div style={{ padding: "var(--sp-14) var(--sp-7)", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-card)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)" }}>
            <Icon name="folder-open" size={28} tone="subtle" />
            <p style={{ margin: 0, font: "var(--type-h3)", color: "var(--text-strong)" }}>{t.empty}</p>
            <p style={{ margin: 0, font: "var(--type-sm)", color: "var(--text-muted)", maxWidth: "26rem" }}>{t.emptyBody}</p>
          </div>
        ) : null}
        {works.map((w) => (
          <WorkCard key={w.id} work={{ ...w, href: "/" + profile.handle + "/" + w.slug }} layout={w.layout} phone={phone} owner={owner} onOpen={onOpenWork} onEdit={onEditWork} />
        ))}
      </main>
      <Footer note="Warszawa · architektow3d.pl" links={[{ label: "Regulamin" }, { label: "Prywatność" }, { label: "Kontakt" }]} locale={locale} onLocaleChange={onLocale} />
      </div>
      <AboutPanel profile={profile} open={about} onClose={() => setAbout(false)} phone={phone} owner={owner} editing={editing} draft={draft} onDraftChange={(p) => setDraft((d) => ({ ...d, ...p }))} onSave={saveEdit} onCancel={cancelEdit} top={barTop} start={panelStart} width={PANEL_W} headroom={headroom} avatarTop={avatarTop} avatarSize={avatarSize} locale={locale}>
      </AboutPanel>
    </div>
  );
}

Object.assign(window, { PublicProfile });
