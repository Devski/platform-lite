// V-SETTINGS-ACCOUNT as shipped (atlas 12.09.2026): the settings bar (logo,
// account avatar), one 28rem card with five sections split by dividers —
// address, password, e-mail, two-factor with its two methods.
const { TopBar, Card, Button, FormField, Input, StatusMessage, TextLink, Badge, Divider, Icon, Avatar } = window.ArchitektW3dDesignSystem_1d311d;

const ACC_T = {
  pl: {
    title: "Ustawienia konta", address: "Adres profilu", current: "Twój adres: ", handleLabel: "Adres profilu", handleHint: "Od 3 do 30 znaków: małe litery, cyfry i myślniki.", handleOwn: "To jest Twój obecny adres.", changeHandle: "Zmień adres", handleDone: "Adres zmieniony. Stary adres przekierowuje przez 30 dni.",
    password: "Zmiana hasła", curPass: "Bieżące hasło", newPass: "Nowe hasło", passHint: "Od 8 do 128 znaków — bez żadnych dodatkowych wymagań.", changePass: "Zmień hasło", passDone: "Hasło zmienione. Pozostałe urządzenia zostały wylogowane.",
    email: "Zmiana adresu e-mail", newEmail: "Nowy adres e-mail", sendLink: "Wyślij link potwierdzający", emailSent: "Jeśli ten adres jest wolny, wysłaliśmy na niego link potwierdzający (ważny 24 godziny). Nic się nie zmienia, dopóki go nie potwierdzisz.", emailErr: "Podaj poprawny adres e-mail.", other: "Użyj innego adresu",
    twoFactor: "Weryfikacja dwuskładnikowa", off: "Wył.", on: "Wł.", offBody: "Weryfikacja dwuskładnikowa jest wyłączona. Włącz drugi składnik, aby lepiej chronić konto.", onBody: "Weryfikacja dwuskładnikowa jest włączona.",
    otp: "Kody e-mailowe", otpBody: "Przy każdym logowaniu wysyłamy 6-cyfrowy kod na e-mail konta. Nic do instalowania.", confirm: "Potwierdź hasłem", enableOtp: "Włącz kody e-mail",
    totp: "Aplikacja uwierzytelniająca", totpBody: "Silniejsza ochrona — kod z aplikacji działa nawet, gdy ktoś przejmie Twoją skrzynkę.", setup: "Skonfiguruj", disable: "Wyłącz weryfikację dwuskładnikową", account: "Menu konta",
  },
  en: {
    title: "Account settings", address: "Profile address", current: "Your address: ", handleLabel: "Profile address", handleHint: "3 to 30 characters: lowercase letters, digits and hyphens.", handleOwn: "This is your current address.", changeHandle: "Change address", handleDone: "Address changed. The old one redirects for 30 days.",
    password: "Change password", curPass: "Current password", newPass: "New password", passHint: "8 to 128 characters — no other requirements.", changePass: "Change password", passDone: "Password changed. Your other devices have been signed out.",
    email: "Change e-mail address", newEmail: "New e-mail address", sendLink: "Send confirmation link", emailSent: "If this address is free, we sent it a confirmation link (valid 24 hours). Nothing changes until you confirm it.", emailErr: "Enter a valid e-mail address.", other: "Use a different address",
    twoFactor: "Two-factor authentication", off: "Off", on: "On", offBody: "Two-factor authentication is off. Turn on a second factor to better protect your account.", onBody: "Two-factor authentication is on.",
    otp: "E-mail codes", otpBody: "At each login we send a 6-digit code to the account's e-mail. Nothing to install.", confirm: "Confirm with your password", enableOtp: "Turn on e-mail codes",
    totp: "Authenticator app", totpBody: "Stronger protection — a code from an app works even if someone takes over your mailbox.", setup: "Set up", disable: "Turn off two-factor authentication", account: "Account menu",
  },
};
const ACC_ORIGIN = "https://dev.architektow3d.pl/";

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
      <h2 style={{ margin: 0, font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{children}</h2>
      {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
    </div>
  );
}

function Method({ icon, title, body, action, t, onEnable, disabled }) {
  const [pass, setPass] = React.useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px minmax(0,1fr)", columnGap: "var(--sp-4)", alignItems: "start" }}>
      <Icon name={icon} size={20} tone="body" style={{ marginTop: 2 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <div>
          <h3 style={{ margin: 0, font: "var(--type-h4)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>{title}</h3>
          <p style={{ margin: "var(--sp-1) 0 0", font: "var(--type-sm)", color: "var(--text-muted)" }}>{body}</p>
        </div>
        <FormField label={t.confirm} htmlFor={"pass-" + icon}><Input id={"pass-" + icon} type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} disabled={disabled} /></FormField>
        <Button variant="quiet" disabled={disabled || !pass} onClick={onEnable} style={{ alignSelf: "flex-start" }}>{action}</Button>
      </div>
    </div>
  );
}

function AccountSettings({ profile, onNavigate, locale = "pl" }) {
  const t = ACC_T[locale] || ACC_T.pl;
  const current = profile.handle || "";
  const [handle, setHandle] = React.useState(current);
  const [handleDone, setHandleDone] = React.useState(false);
  const [passwordDone, setPasswordDone] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [error, setError] = React.useState(null);
  const [twoFactor, setTwoFactor] = React.useState(null);
  const handleValid = /^[a-z0-9-]{3,30}$/.test(handle);
  const handleChanged = handle !== current;
  const sectionGap = { display: "flex", flexDirection: "column", gap: "var(--sp-5)" };

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%" }}>
      <TopBar
        items={[]}
        user={{ name: profile.displayName, avatarUrl: profile.avatarUrl }}
        actions={null}
      />
      <main style={{ maxWidth: "var(--measure-form)", margin: "0 auto", padding: "var(--sp-10) var(--sp-7) var(--sp-14)", boxSizing: "content-box" }}>
        <Card padding="md" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
          <h1 style={{ margin: 0, font: "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{t.title}</h1>
          <Divider spacing="0" />

          <section style={sectionGap}>
            <SectionTitle>{t.address}</SectionTitle>
            <p style={{ margin: 0, font: "var(--type-sm)", color: "var(--text-muted)", overflowWrap: "anywhere" }}>
              {t.current}<TextLink href="#" onClick={(e) => { e.preventDefault(); onNavigate("profile"); }}>{ACC_ORIGIN}<wbr />{current}</TextLink>
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (handleChanged && handleValid) setHandleDone(true); }} style={sectionGap}>
              <FormField label={t.handleLabel} htmlFor="handle" hint={t.handleHint} status={handleChanged ? undefined : t.handleOwn} error={handle && !handleValid ? t.handleHint : undefined}>
                <Input id="handle" mono value={handle} onChange={(e) => { setHandle(e.target.value); setHandleDone(false); }} invalid={!!handle && !handleValid} autoComplete="off" spellCheck={false} />
                <p style={{ margin: 0, font: "var(--type-mono)", color: "var(--text-subtle)", overflowWrap: "anywhere" }}>{ACC_ORIGIN}<wbr />{handle || "…"}</p>
              </FormField>
              {handleDone ? <StatusMessage tone="success">{t.handleDone}</StatusMessage> : null}
              <Button type="submit" disabled={!handleChanged || !handleValid} style={{ alignSelf: "flex-start" }}>{t.changeHandle}</Button>
            </form>
          </section>
          <Divider spacing="0" />

          <section style={sectionGap}>
            <SectionTitle>{t.password}</SectionTitle>
            <form onSubmit={(e) => { e.preventDefault(); setPasswordDone(true); }} style={sectionGap}>
              <FormField label={t.curPass} htmlFor="cur-pass"><Input id="cur-pass" type="password" autoComplete="current-password" /></FormField>
              <FormField label={t.newPass} htmlFor="new-pass" hint={t.passHint}><Input id="new-pass" type="password" autoComplete="new-password" /></FormField>
              {passwordDone ? <StatusMessage tone="success">{t.passDone}</StatusMessage> : null}
              <Button type="submit" style={{ alignSelf: "flex-start" }}>{t.changePass}</Button>
            </form>
          </section>
          <Divider spacing="0" />

          <section style={sectionGap}>
            <SectionTitle>{t.email}</SectionTitle>
            {emailSent ? (
              <div style={sectionGap}>
                <StatusMessage tone="info">{t.emailSent}</StatusMessage>
                <TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); setEmailSent(false); }}>{t.other}</TextLink>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (!newEmail.includes("@")) { setError(t.emailErr); return; } setError(null); setEmailSent(true); }} style={sectionGap}>
                <FormField label={t.newEmail} htmlFor="new-email" error={error}>
                  <Input id="new-email" type="email" invalid={!!error} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </FormField>
                <Button type="submit" style={{ alignSelf: "flex-start" }}>{t.sendLink}</Button>
              </form>
            )}
          </section>
          <Divider spacing="0" />

          <section style={sectionGap}>
            <SectionTitle right={<Badge uppercase tone={twoFactor ? "success" : "neutral"}>{twoFactor ? t.on : t.off}</Badge>}>{t.twoFactor}</SectionTitle>
            <p style={{ margin: 0, font: "var(--type-sm)", color: "var(--text-muted)" }}>{twoFactor ? t.onBody : t.offBody}</p>
            <Divider spacing="var(--sp-2)" />
            <Method icon="mail" title={t.otp} body={t.otpBody} action={t.enableOtp} t={t} disabled={!!twoFactor} onEnable={() => setTwoFactor("otp")} />
            <Divider spacing="var(--sp-2)" />
            <Method icon="smartphone" title={t.totp} body={t.totpBody} action={t.setup} t={t} disabled={!!twoFactor} onEnable={() => setTwoFactor("totp")} />
            {twoFactor ? <TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); setTwoFactor(null); }}>{t.disable}</TextLink> : null}
          </section>
        </Card>
      </main>
    </div>
  );
}

Object.assign(window, { AccountSettings });
