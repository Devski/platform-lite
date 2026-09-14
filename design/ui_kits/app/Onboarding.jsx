// #15/#36: the one step between login and the app, in two parts — the display
// name, then the address derived from it. The derivation happens once, so
// going back to fix the name leaves the address alone.
const { Card, Button, FormField, Input, HandleField, TextLink, Plaque, Badge, StatusMessage } = window.ArchitektW3dDesignSystem_1d311d;

function handleBaseFrom(name) {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}

const TAKEN = ["studio", "praga", "admin", "kowalski"];

function Onboarding({ onDone }) {
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState("");
  const [handle, setHandle] = React.useState(null);
  const trimmed = name.trim();

  const state = React.useMemo(() => {
    if (handle === null) return "idle";
    if (handle.length < 3) return "invalid";
    if (TAKEN.includes(handle)) return "taken";
    return "available";
  }, [handle]);
  const message = {
    available: "This address is free.",
    taken: "This address is already taken.",
    invalid: "The address needs 3 to 30 characters: lowercase letters, digits and hyphens, with no hyphen at the start or end.",
    idle: undefined,
  }[state];

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--sp-12) var(--sp-7)" }}>
      <div style={{ width: "100%", maxWidth: "var(--measure-page)", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,320px)", gap: "var(--sp-12)", alignItems: "center" }}>
        <Card padding="lg" style={{ maxWidth: "var(--measure-form)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
            <Badge uppercase>Step {step} of 2</Badge>
          </div>
          {step === 1 ? (
            <React.Fragment>
              <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>What is your name?</h1>
              <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", marginTop: "var(--sp-3)" }}>
                How your profile is signed. The address is proposed from it — you can change it.
              </p>
              <form
                style={{ marginTop: "var(--sp-7)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}
                onSubmit={(e) => { e.preventDefault(); if (!trimmed) return; if (handle === null) setHandle(handleBaseFrom(trimmed) || "studio-1"); setStep(2); }}
              >
                <FormField label="Your name" htmlFor="display-name" hint="Your studio's name or your own. Up to 80 characters.">
                  <Input id="display-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <Button type="submit" size="lg" disabled={trimmed === ""} style={{ alignSelf: "flex-start" }}>Next</Button>
              </form>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>Set your profile address</h1>
              <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", marginTop: "var(--sp-3)" }}>
                This is the public address of your profile. We prefilled a proposal based on your account — change it if you like.
              </p>
              <div style={{ marginTop: "var(--sp-7)", display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
                <HandleField
                  value={handle || ""}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  state={state}
                  message={message}
                  hint="3 to 30 characters: lowercase letters, digits and hyphens."
                />
                <StatusMessage tone="warning">
                  Setting it the first time is free. Change it later and the next change is only possible in 30 days, while the old address redirects here until somebody else claims it.
                </StatusMessage>
                <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
                  <Button size="lg" disabled={state !== "available"} onClick={() => onDone({ name: trimmed, handle })}>Set the address</Button>
                  <TextLink href="#" tone="muted" onClick={(e) => { e.preventDefault(); setStep(1); }}>Back</TextLink>
                </div>
              </div>
            </React.Fragment>
          )}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", alignItems: "center" }}>
          <Plaque name={trimmed || "Your name"} />
          <p style={{ font: "var(--type-sm)", color: "var(--text-subtle)", textAlign: "center", maxWidth: "18rem" }}>
            Your plaque, as a visitor will read it.
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding });
