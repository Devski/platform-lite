# Architektów 3d — design system

**Architektów 3d** (short form **A3D**) is a Polish platform where architecture
studios and 3D artists keep a public profile. The pitch is an address, not a
website: sign up, set a name and a photo, pick a handle, and your portfolio
lives at `architektow3d.pl/your-handle`. Product tagline, verbatim from the
repository: *"Public profiles for architecture studios and 3D artists"* —
in Polish, *"Tutaj mieszka Twoje portfolio."*

Two brand layers, kept apart on purpose:

- **Architektów 3d** — the product. Header, hero, profile addresses.
- **Architectorium** — the company. Footer, legal and investor contexts.

## Sources this system was built from

- **GitHub — https://github.com/Devski/platform-lite** (branch `main`, private).
  The whole product: Next.js 16 App Router, `better-auth`, Drizzle, Tailwind v4
  with no custom theme. Worth reading further if you build here — especially
  `SPEC.md` (the team's stated source of truth), `messages/en.json` and
  `messages/pl.json` (every user-facing string), `docs/ideas/001-warsaw-address-plaque.md`
  (the brand concept), `scripts/seed-profiles.ts` (sample studios) and the
  screens under `src/app/[locale]/`.
- Related repositories visible to the same connection, not read for this system:
  `3dbdg/platform`, `3dbdg/pickaflat-website`.
- **Photograph** `assets/hero-facade-plaque.jpeg` — supplied by the user; a Warsaw
  facade with the "ul. Architektów 3d" plaque, which is the brand's whole idea.
- **Brief** — monochrome grey/white, breathing layout, a wise.com/revolut.com-style
  signed-out hero, wise.com-style typography, and a LinkedIn-shaped public and
  editable profile.

**No logo exists.** The repository contains no mark, no favicon, no SVG. Wherever a
logo would go, this system renders a navy square reading **A3D** next to the
product name set in type. Nothing was drawn or reconstructed. Supply a real mark
and it replaces the square in `TopBar`, `Hero` and `AuthShell`.

**The current product has no visual identity to copy.** It renders in Tailwind's
default utilities — `bg-gray-50`, `text-blue-700`, the system font stack. So the
foundations below are the brief's direction, applied to the product's real
structure, copy, states and limits. The exact numbers the code did commit to
(6px controls, 8px cards, 1px borders, 128px avatars, the 28rem form column) are
carried over unchanged.

---

## Content fundamentals

The product's copy is unusually disciplined; keep it that way.

- **Second person, plain, no marketing voice.** "Build a public profile in a few
  minutes and share it with a single link." Says what it does and how long it
  takes. No adjectives, no "seamless", no "empower".
- **Full sentences with a full stop.** Including short ones: "This address is
  free." "Name saved." "Photo set."
- **No exclamation marks anywhere in the interface.** E-mail bodies open with a
  bare "Hello!" and that is the only one in the product.
- **Errors state the fact, then the way out.** "Your account is not activated yet.
  Check your inbox or send the link again."
- **Numbers are named, never vague.** "8 to 30 characters", "up to 10 MB", "valid
  for 24 hours", "the limit of 3 e-mails per hour is used up", "once every 30 days".
- **Consequences are explained before the click.** "Setting it the first time was
  free. Change it now and the next change is only possible in 30 days, while the
  old address redirects here until somebody else claims it."
- **Sentence case everywhere.** Headings, buttons, labels. Caps only in the small
  eyebrow label (`--type-eyebrow`, 0.09em tracking).
- **Buttons are verbs in the imperative**: "Log in", "Sign up", "Set the address",
  "Change the address", "Send the confirmation link". The busy state is the same
  verb in progress: "Logging in…", "Saving…", "Sending…" — with an ellipsis
  character, not three dots.
- **Polish spelling of the product name is lowercase-d**: "Architektów 3d" in
  running text and in `Metadata.title`; "3D" only when it means the discipline.
- **"e-mail" is hyphenated** in this product's English. Keep it.
- **No emoji. Ever.** Not in the interface, not in e-mails, not in commit-adjacent
  copy. The repository contains none.
- **The address is written as a bare host and path**, in mono, never as a clickable
  brand phrase: `architektow3d.pl/studio-praga`.

Polish is the default locale and the market; English is the second dictionary.
Both exist for every string — never ship a screen with copy in one only.

## Visual foundations

**Palette.** Monochrome by decision. Thirteen cool-slate greys (`--n-0` → `--n-950`)
carry the entire interface: white cards on a `#f6f8f9` page, `#0c1116` ink for
type and for the primary button. There is no interface accent colour — the
product's default-Tailwind blue links are replaced by ink, semibold and
underlined on hover, so colour is never the only signal. The only saturated
colour in the system belongs to the **plaque**: navy `#0f4eb1`, red `#c9150f`,
a cyan hairline `#8fd4e6` — sampled off a photograph of a real Warsaw MSI sign
(`assets/msi-sign-reference.jpg`). State colours are desaturated to sit inside grey:
green `#1f6f4a`, red `#a83232`, amber `#8a5a00`.

**Type.** Figtree — a geometric humanist sans with a high x-height, standing in
for the wise.com family the brief points at. It is a variable font and the
scale sits half a step heavier than the usual stops: 450 body, 550 lead, 650
labels and buttons, 750 every heading, 850 the hero (Dawid, 13.09.2026 —
"heavier"). Headings are tracked in
(`-0.018em`), the hero harder (`-0.032em`); body text is tracked `-0.005em` at
1.6 line-height. IBM Plex Mono carries every handle, address and one-time code —
mono is the product's way of saying "this string is an identifier". The plaque
is lettered in **Fira Sans Condensed** (`--font-plaque`), the closest free match to the
Frutiger-class humanist sans the city's MSI signs use; it appears nowhere else.
**The product takes these values 1:1** — `tokens/typography.css` is the contract.

**Layout.** Two kinds of page. *Forms and prose* are single-column and centred:
forms in a 28rem column, prose in 40rem, the top bar and footer in 78rem.
*The profile and a work's page are a wall of work*: pictures at the full width
of a column capped at `--measure-works` (100rem), stacked with 80px between
works, and the words moved into a panel that slides in from the left. The
cover is the background of the fixed 64px bar (56px on a phone), which turns
white once the cover scrolls away. Below 40rem everything stacks and the panel
becomes a drawer, closed on load.

**Backgrounds.** Flat. `--surface-page` grey behind, white cards on top. No
gradients anywhere in the interface, no patterns, no textures, no illustration.
One exception: a photograph.

**Imagery.** Two kinds. The brand photograph — a Warsaw facade in daylight, cool
and neutral, with the address plaque in frame — on the hero and the 404, always
under a scrim. And **the users' work**, which is the point of the product: covers,
renders and R360 orbits at the largest size the column allows, never behind a
scrim, never in a bordered box, corners at `--radius-picture` (8px — half the card radius; a photograph is not a card). A photo is a button
that enlarges; an orbit is a picture that turns. Avatars are the users' own
photos, cropped square by the product and served as WebP; without one, initials
in white on `--n-900` — the same monogram the product draws into its share card.

**Borders and cards.** Forms and settings: a card is white, `1px solid
var(--border-default)`, 16px radius, no shadow. Pictures: no border, no box —
the picture group and its caption are the card. Hairlines (`--n-150`) separate
blocks inside one card; the stronger `--n-300` appears only on hover and on quiet
button borders. Radii: 12px controls, 16px cards, 8px pictures, 28px panels,
full for avatars, pills and badges (Dawid, 13.09.2026 — "more chamfer"; 14.09.2026 — pictures halved).

**Shadows.** Almost none. `--shadow-none` at rest, `--shadow-md` when an
interactive card is hovered, `--shadow-lift` for the one floating element (the
kit's screen switcher). `--shadow-plaque` is a deep, warmless drop shadow that
makes the plaque read as an object on a wall. No inner shadows.

**Transparency and blur.** Only over photographs — white at 94% for the on-photo
button and the owner's pills over a cover, 60% for its border, `rgba(12,17,22,.28)`
with `blur(8px)` for the avatar pill in the bar, the scrim tokens for the ground.
Never over a grey or white surface: a translucent card over an unknown photo has
no measurable contrast, which the product's own code calls out as an
accessibility failure.

**Hover, press, focus.** Solid buttons darken (`--n-950` → `--n-800`); quiet
buttons fill with `--n-50` and their border goes `--n-300`; ghost buttons fill
`--n-100`; on-photo buttons go *lighter*, never darker. Links gain an underline
on hover, or lose it if they were underlined in a sentence. Nothing scales,
shrinks or lifts on press — the colour change is the whole feedback. Focus is a
2px ink outline at 2px offset, visible on every control (white on photographs).
Disabled is opacity 0.45 with the cursor blocked.

**Motion.** 120ms for control colour, 180ms for surfaces, 280ms for content
arriving and for the about panel, one curve — `cubic-bezier(.2,.6,.2,1)`. No
bounce, no spring, no entrance animation on page load, no skeleton shimmer. A
busy control changes its label; there is no spinner in this system. Two motions
are content, not chrome: an R360 orbit may turn slowly on its own when its owner
says so (off under reduced motion, stops when grabbed), and a dragged card
follows the pointer while the others make room (platform-lite #173).

## Iconography

The repository contains **no icons at all** — no icon font, no sprite, no SVG
assets, not one inline `<svg>`. Unicode is used once, as the ellipsis in busy
labels ("Saving…"). No emoji.

So iconography here is a flagged substitution: **Lucide**, loaded from
`unpkg.com/lucide-static@0.544.0`, tinted through a CSS mask by the `Icon`
component. Rules:

- 1.75 stroke, sizes 16 / 18 / 20 / 24 — never scaled between steps.
- Icons are decorative (`aria-hidden`); the label beside them carries the meaning.
- One family only. Never mix in another set and never hand-draw an SVG.
- The vocabulary in use: `map-pin` (address), `pencil` (edit), `copy`/`check`
  (copy address), `mail` (e-mail factor), `smartphone` (authenticator),
  `settings`, `user`, `arrow-right`/`arrow-left`/`arrow-up`/`arrow-down`/`arrow-up-right`,
  `chevron-left`/`chevron-right`, `panel-left-close`, `x`, `plus`, `maximize-2`
  (enlarge an orbit), `grip-vertical` (reorder), `trash-2`, `camera`, `image`,
  `triangle-alert`, `clock`, `folder-open`, `map-pin-off` (404).

If the brand later commissions its own set, replace `Icon.jsx`'s CDN base and
nothing else changes.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The entry point consumers link. Import lines only. |
| `tokens/` | `fonts`, `colors`, `typography`, `spacing`, `radius`, `elevation`, `motion`, `base` |
| `components/` | React primitives — see the list below |
| `ui_kits/public-web/` | The profile as a wall of work (visitor · other · owner, desktop · phone), a work's landing page (#200), the hero, the 404 (`README.md` inside) |
| `ui_kits/app/` | Login, sign-up, 2FA, onboarding, account settings (the profile editor there predates the panel-based editing and is kept for its forms) |
| `guidelines/` | 20 specimen cards for colour, type, spacing, foundations and brand |
| `assets/` | `hero-facade-plaque.jpeg` (user photo), `landing-placeholder.webp` (from the repo), `msi-sign-reference.jpg` (user photo) |
| `docs/claude-code-prompt-195.md` | The approved direction for platform-lite #195, written as a prompt for the implementing agent |
| `docs/ui-specification.md` | Copy of the product's own UI specification (#185) the direction was written against |
| `thumbnail.html` | Homepage tile |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Source-repository association and sync record |

### Components

**`components/core/`** — `Button`, `IconButton`, `Icon`, `Card`, `Badge`,
`Avatar`, `Plaque`, `Divider`
**`components/forms/`** — `Input`, `FormField`, `HandleField`, `PhotoUpload`
**`components/feedback/`** — `StatusMessage`, `EmptyState`
**`components/navigation/`** — `TopBar`, `TextLink`, `LocaleSwitcher`, `Footer`
**`components/profile/`** — `ProfileBar` (fixed bar, transparent over the cover),
`AboutPanel` (the profile's words, sliding in from the left), `WorkCard` (one
work at full column width, three owner-chosen layouts), `OrbitTile` (the R360
as a picture that turns; poster stand-in for the product's canvas viewer)

Each has a sibling `.d.ts` (props contract) and `.prompt.md` (what and when).

### The profile direction (13.09.2026)

Dawid turned the profile upside down: pictures dominate, words move aside.

- The **cover** is the background of the bar; the bar is transparent over it and
  white once it scrolls away. The **avatar + name** in the bar is always visible
  and opens the **about panel** — open on load on a desktop, a closed drawer on a
  phone — with the name, headline, address, places, bio and the plaque.
- **Works** stack vertically at the full width of a 1600px column, each a
  `WorkCard` in the layout its owner chose: cover only, cover + two thumbnails
  (default), or cover beside the description. An R360 turns right on the card.
- Every work has its **own page** at `/{handle}/{slug}` (#200): the words once at
  the top, then every picture at full width, the orbit among them with its cue
  points and, on a desktop, its ring.
- **No global edit mode.** The owner edits identity from one pencil in the panel,
  and each work on its page (layout, order, autorotate, fields) — reached from the
  „Edytuj” pill on the card.
- The **plaque** (#199) — the system's first rule, approved by Dawid 13.09.2026:
  lettering is Fira Sans Condensed Regular 400 — never bold — at one fixed size (44 px, the „Studio Praga” reference); the sign
  grows horizontally with the name, never shrinks its letters, never wraps them,
  never tilts; the red band is not optional. `guidelines/brand-plaque.card.html`
  is the reference specimen.

### Intentional additions

The product defines no component library — it is written in raw Tailwind utility
classes — so this inventory was authored from the screens that exist. Two entries
go beyond a straight extraction and are flagged as such:

- **`Plaque`** — the brand object from `docs/ideas/001-warsaw-address-plaque.md`.
  Stylised, not a clone of the city's MSI plaque; verify before commercial use.
- **`Icon`** — a wrapper around a substituted glyph set (see Iconography).
- **`OrbitTile`** — a poster-and-pan stand-in for the product's canvas R360 viewer,
  so layouts with an orbit can be judged; the product keeps its own viewer.

`EmptyState` is used only for the owner's own view, where the product genuinely
shows "You have no profile photo yet."

### Known gaps

- No logo, no favicon, no brand illustration — none exist upstream.
- Fonts are Google Fonts substitutions (Figtree for the wise.com family, IBM Plex
  Mono for addresses, Fira Sans for the plaque lettering). Supply the real files and only `tokens/fonts.css` changes.
- Polish strings are only partly wired into the kits; `messages/pl.json` has them all.
- `e2e/`, `SPEC.md` §§7–11 and the deployment docs were not mined for UI decisions.
