// The owner's view of their own profile: the LinkedIn-shaped header the brief
// asks for, with inline editing for the three fields that exist — display
// name, photo, address. Nothing else is offered, because nothing else is in
// the product (SPEC.md §1).
const { TopBar, Card, Avatar, Button, IconButton, FormField, Input, HandleField, PhotoUpload, StatusMessage, Badge, TextLink, Icon, EmptyState, Divider, Plaque } = window.ArchitektW3dDesignSystem_1d311d;

const TAKEN = ["studio", "praga", "admin", "kowalski"];

function SectionCard({ title, action, children }) {
  return (
    <Card as="section" padding="md">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <h2 style={{ font: "var(--type-h3)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{title}</h2>
        <span style={{ marginLeft: "auto" }}>{action}</span>
      </div>
      {children}
    </Card>
  );
}

function ProfileEditor({ profile, onChange, onNavigate, onViewPublic }) {
  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(profile.displayName);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [handle, setHandle] = React.useState(profile.handle);
  const [handleSaved, setHandleSaved] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const handleState = handle === profile.handle ? "own" : handle.length < 3 ? "invalid" : TAKEN.includes(handle) ? "taken" : "available";
  const handleMessage = {
    own: "This is your current address.",
    available: "This address is free.",
    taken: "This address is already taken.",
    invalid: "The address needs 3 to 30 characters: lowercase letters, digits and hyphens.",
  }[handleState];

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100%" }}>
      <TopBar
        items={[{ id: "profile", label: "Profile", icon: "user" }, { id: "account", label: "Account", icon: "settings" }]}
        activeItem="profile"
        onNavigate={onNavigate}
        user={{ name: profile.displayName, handle: profile.handle }}
        actions={<Button variant="quiet" onClick={onViewPublic}>View public profile</Button>}
      />
      <main style={{ maxWidth: "var(--measure-page)", margin: "0 auto", padding: "var(--sp-10) var(--sp-7) var(--sp-14)", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,300px)", gap: "var(--sp-8)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
          <Card padding="lg">
            <div style={{ display: "flex", gap: "var(--sp-8)", alignItems: "flex-start", flexWrap: "wrap" }}>
              <Avatar src={profile.avatarUrl} name={profile.displayName} size={128} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", minWidth: 0, flex: 1 }}>
                {editingName ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); onChange({ displayName: name.trim() || profile.displayName }); setEditingName(false); setNameSaved(true); }}
                    style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
                  >
                    <FormField label="Name (your studio's or your own)" htmlFor="edit-name">
                      <Input id="edit-name" size="lg" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                    </FormField>
                    <div style={{ display: "flex", gap: "var(--sp-3)" }}>
                      <Button type="submit">Save the name</Button>
                      <Button variant="ghost" onClick={() => { setName(profile.displayName); setEditingName(false); }}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
                    <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--ls-heading)", color: "var(--text-strong)" }}>{profile.displayName}</h1>
                    <IconButton icon="pencil" label="Edit display name" onClick={() => setEditingName(true)} />
                  </div>
                )}
                <p style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", font: "var(--type-mono)", color: "var(--text-muted)" }}>
                  <Icon name="map-pin" size={16} tone="subtle" />
                  <TextLink href="#" underline="always" onClick={(e) => { e.preventDefault(); onViewPublic(); }} style={{ font: "var(--type-mono)" }}>
                    architektow3d.pl/{profile.handle}
                  </TextLink>
                </p>
                {nameSaved ? <StatusMessage tone="success" plain>Name saved.</StatusMessage> : null}
              </div>
            </div>
          </Card>

          <SectionCard title="Profile photo">
            <PhotoUpload
              src={profile.avatarUrl}
              name={profile.displayName}
              busy={uploading}
              onChoose={() => { setUploading(true); setTimeout(() => { setUploading(false); onChange({ avatarUrl: "../../assets/landing-placeholder.webp" }); }, 900); }}
            />
          </SectionCard>

          <SectionCard title="Profile address" action={<Badge tone="neutral">changed 0 times</Badge>}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
              <HandleField
                value={handle}
                onChange={(e) => { setHandle(e.target.value.toLowerCase()); setHandleSaved(false); }}
                state={handleState}
                message={handleMessage}
                hint="3 to 30 characters: lowercase letters, digits and hyphens."
              />
              {handleSaved ? (
                <StatusMessage tone="success">Address saved: architektow3d.pl/{profile.handle}. The old address redirects to the new one until someone else claims it.</StatusMessage>
              ) : null}
              <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
                <Button disabled={handleState !== "available"} onClick={() => { onChange({ handle }); setHandleSaved(true); }}>Change the address</Button>
                <span style={{ font: "var(--type-sm)", color: "var(--text-subtle)" }}>The address can be changed once every 30 days.</span>
              </div>
            </div>
          </SectionCard>

          <EmptyState
            icon="folder-open"
            title="Projects are not part of the product yet"
            body="A profile is a photo, a name and an address. When galleries arrive, this is where they will sit."
          />
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)", position: "sticky", top: 88 }}>
          <Card padding="sm">
            <span style={{ font: "var(--type-eyebrow)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-subtle)" }}>Your plaque</span>
            <div style={{ marginTop: "var(--sp-5)", display: "flex", justifyContent: "flex-start", overflowX: "auto", paddingBottom: "var(--sp-2)" }}>
              <Plaque name={profile.displayName} />
            </div>
            <Divider spacing="var(--sp-6)" />
            <p style={{ font: "var(--type-sm)", color: "var(--text-muted)" }}>
              This is the link preview a visitor sees when your profile is shared without a photo.
            </p>
          </Card>
          <Card padding="sm">
            <h3 style={{ font: "var(--type-h4)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>Finish your profile</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "var(--sp-4) 0 0", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {[["Name", true], ["Address", true], ["Photo", !!profile.avatarUrl]].map(([label, done]) => (
                <li key={label} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", font: "var(--type-sm)", color: done ? "var(--text-muted)" : "var(--text-strong)" }}>
                  <Icon name={done ? "check" : "circle"} size={16} tone={done ? "success" : "subtle"} />
                  {label}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </main>
    </div>
  );
}

Object.assign(window, { ProfileEditor });
