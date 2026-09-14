// Auth surfaces: login, sign-up, the sent-link confirmation and the 2FA
// challenge. One 28rem card on the grey page, exactly as the product's
// (auth) routes render them. All copy verbatim from messages/en.json.
const { Card, Button, FormField, Input, StatusMessage, TextLink, Divider, Icon } = window.ArchitektW3dDesignSystem_1d311d;

function AuthShell({ heading, children, footer }) {
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--sp-12) var(--sp-7)" }}>
      <div style={{ width: "100%", maxWidth: "var(--measure-form)", display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", justifyContent: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, position: "relative", overflow: "hidden", borderRadius: "var(--radius-xs)", background: "var(--plaque-navy)", color: "var(--plaque-ink)", fontFamily: "var(--font-sans)", fontWeight: "var(--fw-bold)", fontSize: 12 }}>A3D<span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "12%", background: "var(--plaque-red)" }} /></span>
          <span style={{ font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>Architektów 3d</span>
        </div>
        <Card padding="lg">
          <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{heading}</h1>
          {children}
        </Card>
        {footer}
      </div>
    </div>
  );
}

function Login({ onDone, onGo }) {
  const [email, setEmail] = React.useState("studio@praga.pl");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  function submit(e) {
    e.preventDefault();
    if (password.length === 0) { setError("Enter your password."); return; }
    setError(null); setBusy(true);
    setTimeout(() => { setBusy(false); onGo("twofactor"); }, 500);
  }
  return (
    <AuthShell
      heading="Log in"
      footer={
        <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", textAlign: "center" }}>
          No account yet? <TextLink href="#" onClick={(e) => { e.preventDefault(); onGo("register"); }}>Sign up</TextLink>
        </p>
      }
    >
      <form onSubmit={submit} noValidate style={{ marginTop: "var(--sp-7)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <FormField label="E-mail address" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="login-password" error={error}>
          <Input id="login-password" type="password" autoComplete="current-password" invalid={!!error} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <Button type="submit" fullWidth disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
        <div style={{ display: "flex", justifyContent: "space-between", font: "var(--type-sm)" }}>
          <TextLink href="#" onClick={(e) => e.preventDefault()}>Forgot your password?</TextLink>
        </div>
      </form>
    </AuthShell>
  );
}

function Register({ onGo }) {
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");
  if (sent) {
    return (
      <AuthShell heading="Check your inbox">
        <div style={{ marginTop: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <StatusMessage tone="info">We sent an activation link to {email || "studio@praga.pl"}. The link is valid for 24 hours.</StatusMessage>
          <Button variant="quiet" onClick={() => onGo("onboarding")}>I confirmed it — continue</Button>
          <TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); setSent(false); }}>Send the link again</TextLink>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      heading="Create your account"
      footer={
        <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", textAlign: "center" }}>
          Already have an account? <TextLink href="#" onClick={(e) => { e.preventDefault(); onGo("login"); }}>Log in</TextLink>
        </p>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} noValidate style={{ marginTop: "var(--sp-7)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <FormField label="E-mail address" htmlFor="reg-email">
          <Input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="reg-password" hint="8 to 72 characters — no other requirements.">
          <Input id="reg-password" type="password" autoComplete="new-password" />
        </FormField>
        <Button type="submit" fullWidth>Sign up</Button>
      </form>
    </AuthShell>
  );
}

// The factor was chosen long before this screen — it is whatever the account
// has enabled. The challenge only says which code it is waiting for, and
// offers a backup code as the way out.
function TwoFactor({ onGo, method = "totp" }) {
  const [useBackup, setUseBackup] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState(null);
  const active = useBackup ? "backup" : method;
  const intro = {
    totp: "Enter the code from your authenticator app.",
    otp: "We sent a 6-digit code to your account's e-mail address.",
    backup: "Enter one of your backup codes.",
  };
  return (
    <AuthShell
      heading="Confirm your login"
      footer={<p style={{ font: "var(--type-sm)", textAlign: "center" }}><TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); onGo("login"); }}>Back to login</TextLink></p>}
    >
      <div style={{ marginTop: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <Icon name={active === "backup" ? "key-round" : active === "otp" ? "mail" : "smartphone"} size={18} tone="strong" />
          <span style={{ font: "var(--type-sm)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>
            {active === "backup" ? "Backup code" : active === "otp" ? "E-mail code" : "Authenticator app"}
          </span>
        </div>
        <p style={{ font: "var(--type-sm)", color: "var(--text-muted)" }}>{intro[active]}</p>
        {active === "otp" ? <StatusMessage tone="info">Code sent — check your inbox.</StatusMessage> : null}
        <FormField label={active === "backup" ? "Backup code" : "Code"} htmlFor="code" error={error}>
          <Input id="code" mono autoComplete="one-time-code" value={code} invalid={!!error} onChange={(e) => { setCode(e.target.value); setError(null); }} style={{ maxWidth: 180 }} />
        </FormField>
        <Button fullWidth onClick={() => (code.length < 6 ? setError("Invalid code. Try again.") : onGo("onboarding"))}>Confirm</Button>
        <div style={{ display: "flex", gap: "var(--sp-6)", font: "var(--type-sm)" }}>
          {active === "otp" ? <TextLink href="#" tone="muted" onClick={(e) => e.preventDefault()}>Send the code again</TextLink> : null}
          {/* Backup codes are issued when the authenticator app is set up, so
              they are only an alternative to an app code — never to an e-mail one. */}
          {method === "totp" ? (
            <TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); setUseBackup(!useBackup); setCode(""); setError(null); }}>
              {useBackup ? "Back to the app code" : "Use a backup code"}
            </TextLink>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}

Object.assign(window, { Login, Register, TwoFactor, AuthShell });
