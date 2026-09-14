// V-HOME, as the product ships it (atlas 12.09.2026): the facade photograph
// fills the first screen behind a scrim, the bar floats on it, the promise and
// two calls to action sit in the hero column, and the footer follows below.
const { Button, IconButton, Icon, Footer } = window.ArchitektW3dDesignSystem_1d311d;

const HERO_T = {
  pl: { heading: "Twoje portfolio pod dobrym adresem.", lead: "Sceny 3D w internecie w kilka minut. Publiczne profile dla architektów i artystów.", primary: "Zamelduj się", secondary: "Jestem zameldowany", login: "Zaloguj się", register: "Załóż konto", menu: "Menu główne", lang: "Polski" },
  en: { heading: "Your portfolio, at a good address.", lead: "3D scenes online in minutes. Public profiles for architects and artists.", primary: "Check in", secondary: "I'm already checked in", login: "Log in", register: "Sign up", menu: "Main menu", lang: "English" },
};
const HERO_PHOTO = "../../assets/hero-facade-plaque.jpeg";
const HERO_SCRIM = "linear-gradient(180deg, rgba(12,17,22,.62) 0%, rgba(12,17,22,.3) 32%, rgba(12,17,22,.75) 100%)";

function Flag({ locale }) {
  const s = { width: 18, height: 12, borderRadius: 2, overflow: "hidden", display: "inline-flex", flexDirection: "column", flex: "0 0 auto", boxShadow: "0 0 0 1px rgba(0,0,0,.12)" };
  if (locale === "en") return <span aria-hidden="true" style={{ ...s, background: "#0f4eb1", position: "relative" }}><span style={{ position: "absolute", left: 0, right: 0, top: 4, height: 4, background: "#c9150f", boxShadow: "0 0 0 1px #fff" }} /><span style={{ position: "absolute", top: 0, bottom: 0, left: 7, width: 4, background: "#c9150f", boxShadow: "0 0 0 1px #fff" }} /></span>;
  return <span aria-hidden="true" style={s}><span style={{ flex: 1, background: "#fff" }} /><span style={{ flex: 1, background: "#c9150f" }} /></span>;
}

// C-LANGUAGE-CHIP — flag, locale name, chevron; opens the other locale.
function LanguageChip({ locale, onChange, onPhoto = false }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const names = { pl: "Polski", en: "English" };
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-3)", height: 40, padding: "0 var(--sp-4)", border: 0, borderRadius: "var(--radius-control)", cursor: "pointer", font: "var(--type-sm)", fontWeight: "var(--fw-medium)", color: onPhoto ? "#fff" : "var(--text-body)", background: hover ? (onPhoto ? "rgba(255,255,255,.1)" : "var(--surface-active)") : "transparent", transition: "var(--transition-control)" }}>
        <Flag locale={locale} />{names[locale]}<Icon name="chevron-down" size={14} tone={onPhoto ? "onPhoto" : "muted"} />
      </button>
      {open ? (
        <ul role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 160, margin: 0, padding: "var(--sp-2)", listStyle: "none", background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-lift)", zIndex: 5 }}>
          {["pl", "en"].map((l) => (
            <li key={l} role="option" aria-selected={l === locale} onClick={() => { setOpen(false); if (onChange) onChange(l); }}
              style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", height: 40, padding: "0 var(--sp-4)", borderRadius: "var(--radius-control)", cursor: "pointer", font: "var(--type-sm)", fontWeight: l === locale ? "var(--fw-semibold)" : "var(--fw-regular)", color: "var(--text-strong)", background: l === locale ? "var(--surface-sunken)" : "transparent" }}>
              <Flag locale={l} />{names[l]}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}

function HeroMark() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, flex: "0 0 auto", position: "relative", overflow: "hidden", borderRadius: "var(--radius-xs)", background: "var(--plaque-navy)", color: "var(--plaque-ink)", fontFamily: "var(--font-sans)", fontWeight: "var(--fw-bold)", fontSize: 11, letterSpacing: "-.02em" }}>
      A3D<span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "12%", background: "var(--plaque-red)" }} />
    </span>
  );
}

// C-TOPBAR, home variant, on photo. Phone: the actions fold into C-MOBILE-MENU.
function HomeBar({ t, locale, onLocale, onGo, phone }) {
  const [menu, setMenu] = React.useState(false);
  return (
    <header style={{ position: "relative", zIndex: 2, height: phone ? 56 : 64, display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: phone ? "0 var(--sp-5)" : "0 var(--sp-7)", maxWidth: "var(--measure-wide)", margin: "0 auto", width: "100%", boxSizing: "border-box", color: "#fff" }}>
      <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-3)", textDecoration: "none", color: "inherit" }}>
        <HeroMark /><span style={{ font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "#fff" }}>Architektów 3d</span>
      </a>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        {phone ? (
          <IconButton icon={menu ? "x" : "menu"} label={t.menu} tone="onPhoto" aria-expanded={menu} onClick={() => setMenu((o) => !o)} />
        ) : (
          <React.Fragment>
            <LanguageChip locale={locale} onChange={onLocale} onPhoto />
            <Button variant="onPhotoQuiet" onClick={() => onGo("login")}>{t.login}</Button>
            <Button variant="onPhoto" onClick={() => onGo("register")}>{t.register}</Button>
          </React.Fragment>
        )}
      </div>
      {phone && menu ? (
        <div role="dialog" aria-label={t.menu} style={{ position: "absolute", top: 56, left: "var(--sp-4)", right: "var(--sp-4)", padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)", background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-lift)", color: "var(--text-body)" }}>
          <LanguageChip locale={locale} onChange={(l) => { setMenu(false); onLocale(l); }} />
          <Button variant="quiet" fullWidth onClick={() => { setMenu(false); onGo("login"); }}>{t.login}</Button>
          <Button variant="solid" fullWidth onClick={() => { setMenu(false); onGo("register"); }}>{t.register}</Button>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ onGo, locale = "pl", onLocale = () => {}, phone = false }) {
  const t = HERO_T[locale] || HERO_T.pl;
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <main style={{ position: "relative", isolation: "isolate", minHeight: phone ? 760 : "100svh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <img src={HERO_PHOTO} alt="" aria-hidden="true" fetchPriority="high" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: phone ? "90% 40%" : "70% 40%", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", background: HERO_SCRIM }}>
          <HomeBar t={t} locale={locale} onLocale={onLocale} onGo={onGo} phone={phone} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: phone ? "flex-end" : "center", maxWidth: "var(--measure-wide)", width: "100%", margin: "0 auto", boxSizing: "border-box", padding: phone ? "var(--sp-10) var(--sp-5) var(--sp-9)" : "var(--sp-12) var(--sp-7)" }}>
            <div style={{ maxWidth: "44rem", display: "flex", flexDirection: "column", gap: phone ? "var(--sp-5)" : "var(--sp-7)" }}>
              <h1 style={{ margin: 0, font: "var(--type-hero)", fontSize: phone ? "var(--fs-display)" : "var(--fs-hero)", letterSpacing: "var(--ls-hero)", color: "#fff", textWrap: "balance" }}>{t.heading}</h1>
              <p style={{ margin: 0, font: "var(--type-lead)", color: "rgba(255,255,255,.86)", maxWidth: "30rem" }}>{t.lead}</p>
              <div style={{ display: "flex", flexDirection: phone ? "column" : "row", flexWrap: "wrap", gap: phone ? "var(--sp-4)" : "var(--sp-4)", marginTop: phone ? 0 : "var(--sp-2)" }}>
                <Button size="lg" variant="onPhoto" fullWidth={phone} onClick={() => onGo("register")}>{t.primary}</Button>
                <Button size="lg" variant="onPhotoQuiet" fullWidth={phone} onClick={() => onGo("login")} style={{ border: "1px solid rgba(255,255,255,.55)" }}>{t.secondary}</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer company="Architectorium Sp. z o.o." copyright="© 2026" links={[]} style={{ background: "var(--surface-page)", border: 0 }} />
    </div>
  );
}

Object.assign(window, { Hero, LanguageChip, Flag });
