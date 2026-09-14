# Prompt for Claude Code — platform-lite #195, "The final UI"

Paste everything below the line into Claude Code, opened in the `Devski/platform-lite` repository, with this design system checked out (or exported) next to it at `../architektow3d-design-system` (adjust the path in §0.2).

---

You are implementing **issue #195 — the final UI of Architektów 3d**. Dawid decided on 12.09.2026 to turn the interface upside down; **#185** (`docs/ui-specification.md`) wrote down the interface as it stands so that nothing is lost by accident. This prompt is the approved direction (#195 "Wanted" item 1), decided with Dawid on 13.09.2026. Read it whole before touching a file. Where it and `docs/ui-specification.md` disagree, this prompt wins and you record the overturned `D-*` in the PR description; where this prompt is silent, the specification stands.

## 0. Inputs — read in this order

0.1 `docs/ui-specification.md` §0, §1, §2, and the index of views. Then the section of each view before you rebuild it.
0.2 The design system, folder `../architektow3d-design-system`:
  - `tokens/*.css` — the values. Port them **1:1** (§1). `styles.css` is the import order.
  - `components/profile/` — `ProfileBar.jsx`, `AboutPanel.jsx`, `WorkCard.jsx`, `OrbitTile.jsx` and their `.d.ts` / `.prompt.md`. These are the reference implementations of the new profile primitives, written in inline-style React so every measurement is explicit. Re-implement them in the product's stack (Tailwind v4 arbitrary-value utilities over the same CSS variables, `D-SHELL-15`); do not copy the files.
  - `components/core/Plaque.jsx` — the plaque after #199.
  - `ui_kits/public-web/` — `PublicProfile.jsx`, `WorkPage.jsx`, `data.js`, `index.html`. Open `index.html` in a browser: the Tweaks panel switches viewer (signed-out / signed-in other / owner), width (desktop / phone), language, cover, avatar, panel default. **This is the approved look for the profile and the work's page.** Everything else keeps its current structure with the new tokens.
  - `readme.md` — content and visual foundations (copy rules, palette, motion, iconography).
0.3 Issues **#199** (plaque grows horizontally), **#200** (work landing page), **#173** (dragging looks like dragging), **#182**, **#159**, **#62**, **#35**.
0.4 `SPEC.md` §1 (A1–A13) — the rules; none change here.

## 1. Non-negotiables (Dawid, 13.09.2026)

1. **Fonts and type scale are taken 1:1 from `tokens/fonts.css` and `tokens/typography.css`.** Do not round, do not "normalise" to Tailwind's scale, do not pick different weights. Figtree is a variable font: the weights are **350 / 450 / 550 / 650 / 750 / 850**, not 400/500/600/700. Every heading is `--type-h*` (weight 750), body is 450, labels and buttons 650, the hero 850. Tracking: `--ls-hero -.032em`, `--ls-display -.026em`, `--ls-heading -.018em`, `--ls-body -.005em`, `--ls-caps .09em`. Line heights 1.05 / 1.2 / 1.28 / 1.6 / 1.75. Sizes: hero `clamp(2.5rem,5.4vw,4.25rem)`, display `clamp(2rem,3.4vw,3rem)`, h1 2rem, h2 1.375rem, h3 1.125rem, h4 1rem, lead 1.1875rem, body 1rem, sm .875rem, xs .8125rem, micro .6875rem. Families: `--font-sans "Figtree"`, `--font-mono "IBM Plex Mono"`, `--font-plaque "Fira Sans Condensed"`. Keep loading from Google Fonts for now (F-SHELL-18 stays open, tracked separately); load Figtree as `wght@300..900`.
2. **Radii**: `--radius-xs 8`, `-sm 12` (controls), `-md 16` (cards), `-lg 20`, `-xl 28` (panels), `-2xl 36`, `-full`. **Pictures are the exception — `--radius-picture 8`** on every cover, thumbnail, orbit tile, work-page figure and the hero/404 photo panel (Dawid, 14.09.2026: the 16 px on photographs read as a chamfer). Aliases `--radius-control = sm`, `--radius-card = md`, `--radius-panel = xl`, `--radius-avatar = full`. Nothing in the interface is 4 or 6 px any more.
3. **The plaque's red band is always there and always reads „Architektów 3d”.** Not a prop that can be turned off. (#199) **Rule #1 of the design system, approved by Dawid 13.09.2026 — reference specimen `guidelines/brand-plaque.card.html`.** **The lettering is Fira Sans Condensed Regular 400 (never bold; do not use the 450/550 Figtree weight tokens — the font ships at 400/500 only and the browser would synthesise a heavier face) at ONE fixed size — 44 px, the „Studio Praga” reference — and the sign grows horizontally with the name; the letters never shrink, the text never wraps, the sign never tilts. There is no size prop: a host narrower than the sign scrolls it horizontally, never shrinks it. Example: „Dawid Wróblewski Head of AI” is simply a wider sign than „Studio Praga”.** `size` = the name's font size in px; the sign's dimensions scale from `u = size/40`: navy field padding `20u 18u 7u`, min-height `76u`, red band `4u 18u 6u` at `14u` px, medium weight, radius `max(2, 3u)`, frame `max(1, 2u)` px white 55 %. Min width `180u`. `white-space: nowrap` on both lines. Overturns `D-SHELL-11`. Resolves `F-SHELL-15` (size floor) — and mark the plaque `aria-hidden="true"` wherever the name is already on the page.
4. **White canvas, photographs dominate.** `--surface-page #f6f8f9`, `--surface-card #fff`. No dark theme. The profile is a wall of work: pictures at the full width of a column capped at `--measure-works` (100rem = 1600 px); words live in a panel. Never a grey placeholder where a photo could be.
5. **Responsive, and different on a phone.** Breakpoint `sm` (40rem) is the line between `phone` and `desktop` as §1 of the spec defines them. Every new element below has a phone form specified here.
6. **No global edit mode on the profile any more.** Identity is edited from a pencil in the about panel; each work is edited on its own landing page. Overturns `D-SHELL-7` / `D-PROFILE-7` and `D-WORKS-4`; see §4 and §7.
7. **Copy rules from `readme.md` › Content fundamentals stay** (sentence case, full stops, imperative verbs, „e-mail”, no exclamation marks, no emoji, both dictionaries for every string — A8).

## 2. Tokens (PR 2)

Replace the `@theme` / `:root` blocks of `src/app/globals.css` with the design system's tokens, name for name. The files, in import order (`styles.css`): `fonts`, `colors`, `typography`, `spacing`, `radius`, `elevation`, `motion`, `base`. Keep `D-SHELL-15` (plain custom properties used through arbitrary-value utilities). Keep the `phone:` variant. Add `--measure-works: 100rem`. Colour names, semantic aliases, state colours, plaque colours, shadows, focus rings, motion durations and curves are unchanged from what `globals.css` already has — diff, don't retype. Delete `.type-*` classes that no longer match and regenerate them from `--type-*`.

Verify: `pnpm check`, `pnpm build`, and a screenshot of `/login` — the type must be visibly heavier and the card corners visibly rounder than on dev today.

## 3. Structure — navigation, bars, where things live

### 3.1 Routes

| Page | URL pl · en | Status |
| --- | --- | --- |
| Profile | `/{handle}` · `/en/{handle}` | rebuilt (§4) |
| **Work landing page** (#200) | `/{handle}/{slug}` · `/en/{handle}/{slug}` | **new** (§5) |
| Work landing page, edit mode | same URL + `?edit=1` (owner only; anyone else ignores the query) | new |
| Homepage, auth, onboarding, settings, 404 | unchanged | re-skinned (§6) |
| **Error screen** | `src/app/[locale]/error.tsx` + `global-error.tsx` | **new** (§6.5) |

`slug` = the work's name run through `slugify` (lowercase, ASCII, hyphens, ≤ 60 chars), unique per profile, stored on the work (`works.slug`, back-filled by migration; on a name change the slug does not change — the URL is a permalink). `/{handle}/{slug}` for an unknown slug → the localized 404. The catch-all `[locale]/[...rest]` keeps catching everything deeper.

### 3.2 One bar per page type

- **Profile and work pages** use the new `ProfileBar` (reference: `components/profile/ProfileBar.jsx`), not `TopBar`:
  - `position: fixed; top: 0; z-index: 50`, height **64 px desktop / 56 px phone**, side padding 24 / 16. The header itself is `pointer-events: none`; only its two control groups catch the pointer, so the about panel's corner pencil (in the bar's band, under it) stays clickable.
  - **Over the cover it is transparent** — the cover is the bar's background — with white text and `onPhoto` / `onPhotoQuiet` buttons. The cover is sticky and never leaves the viewport, so **with a cover the bar is transparent for the whole page**; a profile without a cover is solid from the start — `--surface-card`, hairline bottom border, ink text (Dawid, 14.09.2026; the earlier IntersectionObserver rule is gone). The work page is always solid. Transition 180 ms on background, border and colour (`--dur-2`, `--ease-standard`).
  - **Left (Dawid, 14.09.2026):** the A3D mark (32 px square, `--plaque-navy`, `--radius-xs`) and a label in `--type-h3` that **crossfades** (opacity + 6 px slide, `--dur-3`, `aria-live="polite"`): **panel closed → the studio's display name; panel open → „Architektów 3d”** (`Brand.wordmark`; the studio's name is then the panel's heading). No chevron. Mark + label are **one button** (inert — `disabled` — while identity editing is open), `aria-expanded`, which toggles the about panel; on a profile the mark is not a home link. While the panel is open on desktop the group turns ink — the white panel is under it. **No avatar in the bar.** The group is always on screen, never collapses into a hamburger, never hides on scroll (resolves `F-SHELL-7`).
  - **Right slot by viewer** (resolves `F-SHELL-5`):
    - `signed-out`: desktop — `LanguageChip`, „Zaloguj się” (`onPhotoQuiet` → `ghost` when solid), „Załóż konto” (`onPhoto` → `solid`); phone — „Załóż konto” only; the language chip moves into the about panel (§4.3).
    - `other` and `no-handle`: desktop — `LanguageChip`, `AccountMenu`; phone — `AccountMenu` (chip in the panel).
    - `owner`: „+ Realizacja” (`Works.add` — reuse the existing key), on a phone the plus alone, `aria-label` = the same key; then `AccountMenu` — its avatar at the bar's control height (40 px) with a 2 px `--surface-card` ring (half the big avatar's).
  - On the work page the avatar + name button goes **back to the profile** (`/{handle}`) instead of toggling a panel.
- **Homepage** keeps its `TopBar` `onPhoto` + `MobileMenu` (D-SHELL-6). Rename „Zamelduj się” in the hero to „Załóż konto” (`Session.register`) and drop the second log-in phrasing (resolves `F-SHELL-16`; delete the orphaned keys from both dictionaries).
- **Settings** keeps `TopBar` with the logo and `AccountMenu`; add `LanguageChip` before the menu (resolves `F-SHELL-4` for signed-in users on the page where they can act on it; #62 makes the choice stick).
- **Auth screens** keep `C-AUTH-SHELL` (compact non-link logo, D-SHELL-10); add the `LanguageChip` under the card, right-aligned, card tone.
- **Onboarding**: add a bar with the logo (non-link) and `AccountMenu` (resolves `F-SHELL-6`: a stuck user can sign out).
- Every bar is a `<header>` landmark and precedes `<main>`; add one skip link („Przejdź do treści” · "Skip to content", new key `Shell.skipToContent`) as the first focusable element of every page (resolves `F-SHELL-8`).

### 3.3 Popovers

`AccountMenu`, `LanguageChip`, `MobileMenu` keep their behaviour and dismissal (C-DISMISSABLE). Add what `F-SHELL-13` names: on open, focus moves to the first item; Escape and outside press return focus to the trigger; arrow keys move within `role="menu"`. Reset `signOutFailed` when the menu closes (F-SHELL-10). Signing out from the work page in edit mode asks through the leave guard (F-SHELL-11 → resolved by routing „Wyloguj” through the same guard the links use).

## 4. The profile — V-PROFILE, V-PROFILE-OWNER, V-PROFILE-EDIT → one page

Reference: `ui_kits/public-web/PublicProfile.jsx`. Open the kit and look at all three viewers, both widths.

### 4.1 Layout, top to bottom

1. `ProfileBar` (fixed).
2. **Cover band — always present, scrolls with the page** (Dawid, 14.09.2026, final): a photo when the profile has one, otherwise a **placeholder** — `--plaque-navy-deep` → `#052a68` vertical gradient with a faint 135° weave (`repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 14px)`) — so the band, the bar's on-photo tone and the avatar's position are the same with or without a photo. Not sticky. The bar turns solid once the band's bottom edge passes under it (IntersectionObserver on the band, `rootMargin: -bar`). The **avatar sits in the band**, absolute at its bottom edge, and scrolls with it. Full-bleed and **short** (Dawid, 14.09.2026: half the earlier height on desktop, much lower on a phone): `height: clamp(168px, 19vh, 240px)` desktop, `clamp(128px, 17vh, 150px)` phone — the floor is bar + avatar/2 + gap (64 + 88 + 16 / 56 + 60 + 12) so the avatar can never rise into the bar; `object-fit: cover; object-position: 50% 45%`; a top scrim `linear-gradient(to bottom, rgba(12,17,22,.5), transparent 60%)` for the bar's legibility. Same `srcSet` 480w/1600w, `sizes="100vw"`. **The avatar sits on the cover's bottom edge**, half over the photo — **176 px desktop / 120 px phone** (Dawid, 14.09.2026: much bigger), a 4 px `--surface-card` ring, `z-index` above the about panel (58). Its **left edge is flush with the works column** (`left: max(gutter, (100% − measure-works) / 2 + gutter)`, the same rule as `<main>`'s padding). It is a button that toggles the panel; **the band itself is the same toggle** (`role="button"`, Enter/Space) — a click anywhere on the photo opens or closes the panel. **The panel carries its own copy of the avatar** — same size, same height, centred on the panel's width — which closes the panel on click; the page avatar stays where it is (no travel animation). In identity editing the panel's copy carries the 44 px camera button. `<main>` starts avatar/2 + 24 px (16 on a phone) below the cover. Without a cover: no band; the avatar sits directly under the solid bar at the same horizontal position. Alt stays `PublicProfile.coverAlt`. (Keeps `PROFILE.card.cover` → moved.)
3. `<main>` — `max-width: var(--measure-works)`, centred, padding `40px 24px 96px` desktop / `24px 16px 64px` phone. **Works stacked in one column**, gap 80 px desktop / 48 px phone. No „Realizacje” heading, no count for visitors; the owner's count `Works.count` („{count} z {max}”) moves into the about panel under the address (§4.3).
4. Footer (`C-FOOTER`, `measure-wide`).
5. **About panel** (§4.3), fixed, over everything.

Deleted from the page: the profile card (`article` with identity row, places, bio), the standalone plaque `PROFILE.page.plaque`, the „Edytuj profil” toggle, the owner scope note (`PublicProfile.ownerScopeNote` — delete the key, resolves `F-PROFILE-6`).

### 4.2 The work card — `WorkCard` (V-WORKS-LIST rebuilt)

**Click model (Dawid, 14.09.2026):** every picture on the card is a link to the work's landing page `/{handle}/{slug}`; there is no lightbox on the profile. On hover a round white badge with `arrow-up-right` appears at the picture's bottom-right. The orbit is the one exception: it stays interactive in place (drag to turn), and its bottom-right button carries the same `arrow-up-right` and leads to the landing page — not a fullscreen/enlarge control. Enlarge/lightbox lives on the landing page only.

Reference: `components/profile/WorkCard.jsx`, `WorkCard.d.ts`.

- One `<article>` per work, full column width, **no border, no box, no shadow** — the picture group and its caption are the card. Order = `works.position`.
- **Three layouts, chosen by the owner per work** and stored on the work (`works.card_layout` enum `cover | cover-thumbs | cover-text`, default `cover-thumbs` — backend change, say so in the PR):
  - `cover`: one picture, 21:9 desktop.
  - `cover-thumbs` (default): grid `minmax(0,2fr) minmax(0,1fr)`, gap 8 px; the cover spans two rows at 16:10; up to **two** further pictures at 16:10 in the right column. With one further picture the right column holds one tile and the cover still spans (the second row is empty — accept it, do not stretch).
  - `cover-text`: grid `minmax(0,3fr) minmax(0,1fr)`, gap 24 px, `align-items: end`; the picture at 16:10 on the left, the caption in the right column with the description clamped to 6 lines.
  - **Phone**: every layout stacks — cover 4:3, further pictures in a 2-up row of 4:3 tiles, caption below; gap 16 px.
- **Pictures** are `<button>`s with `aria-label` `Works.card.enlarge` (keep the key; `{count}` now counts every picture of the work, orbit included — resolves `F-WORKS-12`, update the copy in both dictionaries to „Powiększ zdjęcie {index} z {count}: {name}” counting the way the lightbox does). `border-radius: var(--radius-card)`; hover `transform: scale(1.02)` over 280 ms; `cursor: zoom-in`. Two-channel badge stays top-right (`WORKS-LIST.strip.two-channel-badge`).
- **Orbit**: when the work has an R360 the cover slot is the orbit tile (`OrbitTile`; the product's `OrbitViewer` at 800 px inside it). „360°” mark top-left as a pill `rgba(12,17,22,.72)`, `--type-eyebrow` uppercase. The „+” enlarge button (`WORKS-LIST.strip.orbit-enlarge`) is 40 px round, white 94 %, bottom-right, with the `maximize-2` icon. **No ring on the profile page at any width** (D-WORKS-19 + D-WORKS-20 — the ring appears only in the lightbox on desktop). Cue buttons (`WORKS-LIST.body.cues`) are **not** on the card any more — they belong to the work page and the lightbox; the card's orbit turns by drag and keys only. **Autorotate** (new, per work: `works.r360_autorotate` boolean, default false): the orbit turns slowly on its own (one full turn ≈ 25 s) until the visitor grabs it; off under `prefers-reduced-motion`; one autorotating orbit at a time per page (the one most in view — reuse the `useInView` gate).
- **Caption** under (or beside) the pictures, gap 24 px desktop / 16 px phone: `h3` in `--type-h2` (h3 on phone) whose text is a **link to the work's page** `/{handle}/{slug}` — underline on hover of the whole article, `text-underline-offset: 4px`, thickness 2 px; then the `dl` of investor / developer inline (`Works.card.investor`, `Works.card.developer` — existing keys; `dt` subtle, `dd` semibold), then the description (`works.description` — new optional text field, ≤ 600 chars, backend change) in `--type-body` muted, clamped to 2 lines (6 in `cover-text`).
- **Owner controls** (`owner`, every width): one pill over the cover's top-right, 40 px, white 94 %, `--shadow-md`: pencil icon + „Edytuj” (`Works.card.edit`, accessible name „Edytuj: {name}” — keep `F-WORKS-13` in mind: build the name with a dictionary key `Works.card.editNamed` „Edytuj: {name}” instead of string concatenation). It navigates to `/{handle}/{slug}?edit=1`. **Delete** moves to the work page (§5.4). The R360 badge (`WORKS-LIST.owner.r360-badge`) is dropped (Dawid, 13.09.2026) — the orbit's presence is visible.
- **Reordering** (`WORKS-LIST.owner.grip`, `.order.notice`, `.order.error`): kept for the owner, always available (no edit mode to enter). The grip is a second pill next to „Edytuj” (`grip-vertical` icon, `aria-label` `Works.card.move`, `aria-describedby` the hint). Pointer and arrow keys as today (D-WORKS-5), whole order posted 300 ms after the last move (D-WORKS-6). **Implement #173 here**: the held card follows the pointer (`transform: translateY`), the others slide into place over 180 ms; under reduced motion they jump. Auto-scroll the page when the pointer is within 80 px of the viewport's edge (resolves `F-WORKS-8`).
- **Empty** (owner, 0 works): a dashed `--border-strong` box, `--radius-card`, 80 px padding, `folder-open` icon 28 px, `Works.emptyTitle` in `--type-h3`, new body copy for `Works.emptyBody`: pl „Dodaj pierwszą plusem w pasku. Nazwa i jedno zdjęcie wystarczą na start.” · en "Add the first one with the plus in the bar. A name and one photo are enough to start." Visitors with 0 works: nothing (D-PROFILE-3).
- **The new-work form**: „+ Realizacja” in the bar opens **the work landing page in edit mode with empty fields** (`/{handle}/new?edit=1` or equivalent): name, parties, description, a large „Dodaj pierwsze zdjęcie” drop tile, an R360 drop tile, the card-layout choice. „Zapisz” creates the work and lands on `/{handle}/{slug}`; „Anuluj” returns to the profile (Dawid, 14.09.2026 — replaces the old `V-WORK-FORM` panel above the list; see §5.3). Keep the form's field IDs and tests where they still apply.

### 4.3 The about panel — `AboutPanel`

**The panel has its own avatar copy** (Dawid, 14.09.2026, final) — centred, at the page avatar's height; the page avatar is the trigger, the copy closes. **The panel starts at the top of the screen** (`top: 0`, under the transparent bar at `z-index` 45 < 50) on every width — the band is always there, so there is no solid-bar case at scroll 0; its top padding (`headroom`) = cover height + avatar/2 + 24 px (16 on a phone; without a cover: bar + avatar + gap), so the content begins under the avatar. **Top-right corner: the owner's pencil** (40 px, quiet ring, vertically centred in the bar's 64 px band) — there is no collapse icon on desktop; the bar's mark/wordmark and the avatar close the panel. On a phone the X stays beside the pencil. Name, headline and the sections below are centred under the avatar.

Reference: `components/profile/AboutPanel.jsx`.

- `<aside aria-label="O nas">`, `position: fixed; left: 0`, **desktop**: `z-index: 45` (under the bar's 50), `top: 64px; bottom: 0; width: 380px`, padding `32px 32px 48px`, `--surface-card`, hairline right border, `--shadow-lift` when open; **phone**: **over the bar** — scrim `z-index: 55`, drawer `z-index: 56`, `top: 0; width: min(100% − 56px, 400px)` (percent of the layout viewport, not `vw`), padding `24px 20px 40px`, scrim `--scrim-photo` behind that closes it on press.
- Open/closed by `transform: translateX(0 | −102%)`, 280 ms `--ease-standard`; `aria-hidden` and `inert` when closed. **Desktop: open on load** (≥ 64rem); the user's collapse is remembered in `sessionStorage` (`a3d.about`). **Phone: closed on load**, always. The panel **overlays the works** — it does not push them (Dawid, 13.09.2026).
- Focus: opening on a phone moves focus to the close button; Escape closes and returns focus to the bar's avatar button; Tab is trapped inside while the scrim is up. On desktop no trap (the page is usable beside it).
- Content, top to bottom, gap 32 px:
  1. Row: avatar **96 px** (72 phone), no border (`PROFILE.card.avatar` → moved; the monogram rules D-PROFILE-5 unchanged); right-aligned buttons: owner's **pencil** (40 px round, quiet border, `aria-label` `PublicProfile.editProfile` „Edytuj profil” — **keep this exact label**, the e2e specs depend on it) and the close button (`panel-left-close` icon on desktop, `x` on phone; new key `Shell.closePanel` pl „Zamknij panel” · en "Close panel").
  2. `h1` display name in `--type-h1` (`PROFILE.card.name` → moved; the page's only `h1`); headline in `--type-lead` muted (`PROFILE.card.headline` → moved).
  3. Section „Adres profilu” (new key `PublicProfile.addressHeading`, pl „Adres profilu” · en "Profile address"; eyebrow style): the address in mono `architektow3d.pl/{handle}` + a 32 px copy button (`copy` → `check`, `aria-label` new keys `PublicProfile.copyAddress` / `PublicProfile.copiedAddress`). Owner only: under it `Works.count`.
  4. Section `PublicProfile.locationsHeading` with the place chips (`PROFILE.card.places` → moved): chips are 32 px pills, `--surface-sunken`, `map-pin` 14 px, `--type-label`.
  5. Section `PublicProfile.bioHeading` with the bio, `white-space: pre-line` (`PROFILE.card.bio` → moved).
  6. Phone only: the `LanguageChip` (card tone) — this is where the language switch lives on a phone for every viewer (resolves `F-SHELL-4`).
  7. Foot (`margin-top: auto`): the **plaque** centred, `scale 0.5` (the whole sign at half size — 22 px letters; the panel scrolls it horizontally when the name is still wider), no shadow, `aria-hidden` (`PROFILE.page.plaque` → moved; resolves `F-SHELL-15`; make „Architektów 3d” the `Brand.wordmark` key — resolves `F-SHELL-14` / `F-PROFILE-4`).
- Section headings are `h2` in `--type-eyebrow`, uppercase, `--ls-caps`, subtle. Sections are absent when empty (D-PROFILE-3).

### 4.4 Identity editing (owner) — replaces V-PROFILE-EDIT's field editing

The pencil in the panel's corner lays an **edit form over the open panel** (same box, same width, same `headroom`, `z-index: 46`; the panel underneath stays open, so cancelling does not replay the slide-in). The big avatar stays where it is and gains a 44 px camera button at its bottom-right („Zmień zdjęcie”); „Zmień tło” (`onPhoto`) sits on the cover's bottom-right. In the panel: an X in the corner (cancel), „Edytuj profil” `h2` centred, then the fields; „Zapisz” / „Anuluj” stick to the panel's foot. Original text kept for the fields below — „Edytuj profil” `h2`; avatar 72 px + „Zmień zdjęcie” (`quiet`, `camera`; existing avatar upload with `C-UPLOAD-PROGRESS`); „Zmień tło” (`quiet`, `image`; existing cover upload + remove); fields **Nazwa** (`Input`), **Nagłówek** (`Input`), **Siedziba i obszar działania** (the existing place search + chips with grips — `PROFILE-EDIT.places.*` kept whole), **O nas** (`Textarea`); then „Zapisz” (`solid`) and „Anuluj” (`ghost`) at the foot.

Behaviour: fields keep their **save-on-blur** and per-field errors from V-PROFILE-EDIT (`PROFILE-EDIT.identity.*` element IDs kept; only their place changed). „Zapisz” runs the same leave sequence as today's „Zapisz” toggle (wait for pending saves, then `router.refresh()`), shows `PublicProfile.savedProfile` „Zapisano profil” as a `role="status"` line at the panel's top for 2.5 s and returns the panel to its read form. „Anuluj” returns without waiting (saves already made stay — A12 says every change is public at once; say so in a hint under the buttons: new key `PublicProfile.editHint` pl „Każda zmiana zapisuje się od razu.” · en "Every change saves at once."). `C-LEAVE-GUARD` arms while the form is open (kept). Tests: `getByRole("button", { name: "Edytuj profil" })` now finds the pencil; `getByRole("button", { name: "Zapisz", exact: true })` finds the panel's button.

## 5. The work's landing page (#200) — new view `V-WORK`

Reference: `ui_kits/public-web/WorkPage.jsx`. Behance-shaped: words once at the top, then every picture at full column width, the orbit among them.

### 5.1 Route and data

`src/app/[locale]/(public)/[handle]/[slug]/page.tsx`, `force-dynamic`, one lookup shared with `generateMetadata`: profile by handle (same pipeline as V-PROFILE, incl. the 308 for case variants) → work by slug → 404 otherwise. `isOwnerViewing` decides `owner`. Metadata: title `{work.name} · {displayName} · Architektów 3d`; description = the work's description, else `PublicProfile.description`; canonical + hreflang; `og:type article`, `og:image` = the cover's 1600 variant.

### 5.2 Layout

1. `ProfileBar`, always solid; the avatar + name button → `/{handle}`; right slot: owner — „Edytuj” (`quiet`, `pencil`) + `AccountMenu`; others — as on the profile.
2. `<main>` `max-width: var(--measure-works)`, padding-top 104 px desktop / 80 phone, gap 40 / 24.
3. Back link „Wszystkie realizacje” (new key `Works.page.back`, en "All works"), `arrow-left` 16 px, `--type-label` muted → `/{handle}`.
4. **Header** — grid `minmax(0,1.4fr) minmax(0,1fr)`, gap 64 px, `align-items: start`, `max-width: 80rem`; phone: one column, gap 20 px. Left: `h1` in `--type-display` (h1 size on phone), `text-wrap: balance`. Right: the `dl` investor / developer, then the description in `--type-lead` muted.
5. **Pictures**, one under another, gap 24 / 16 px, each `--radius-card`, 16:9 desktop / 4:3 phone, `object-fit: cover`, `loading="lazy"` from the second on, `srcSet` 480w/1600w, `sizes="(max-width: 100rem) 100vw, 1600px"`. Order: **the orbit first when present**, then photos in `position` order (D-WORKS-1's rule, now unlimited — every picture of the work is on this page). A click opens the lightbox at that index. Two-channel photos render the `ChannelReveal` inline at this size (fix #159 here: show nothing until both channels have loaded).
6. **Orbit** (`OrbitTile` with the product's `OrbitViewer` at 1600 px): 16:9, **ring on desktop** (`D-WORKS-20` applies to the profile page; on the work page the orbit is already "enlarged"), never on `phone:`; cue buttons under it (`ORBIT.cues.*` kept); autorotate per the work's setting.
7. Footer.

### 5.3 Edit mode (owner, `?edit=1`, or „Edytuj” in the bar)

The same page, rebuilt as a form top-to-bottom (Dawid, 14.09.2026). No separate form page; **a new work is this page in edit mode with nothing in it** (see §4.2 — this replaces the old `V-WORK-FORM` for creation too).

- **Bar:** „Usuń realizację” (`ghost` in `--state-danger`, `trash-2`; icon only on a phone; existing works only, with the existing confirmation extended to name the R360 set — resolves `F-WORKS-6`; success → `/{handle}`), then „Anuluj” (`ghost`) and „Zapisz” (`solid`, disabled until a name and at least one photo or an R360 set exist). Cancelling a new work returns to the profile. Delete lives in the bar so it is one reach away whether you are editing or adding (Dawid, 14.09.2026).
- **1. Words** — the header becomes fields: „Nazwa” (`lg` input, placeholder „Nowa realizacja”), „Inwestor” and „Deweloper” side by side (stacked on a phone), „Opis” (`Textarea`, 300 chars, live counter, hint: „Widoczny na stronie realizacji i — w układzie „Okładka + opis” — na karcie”). Existing `WORK-FORM.*` validation and error lines.
- **2. „Karta na profilu”** — directly under the fields, still in the header block: label in `--type-label`; segmented control (`role="radiogroup"`, 34 px segments in a `--surface-sunken` track) „Okładka” · „Okładka + 2 miniatury” · „Okładka + opis”; beside it, when the work has an orbit, the `role="switch"` „R360 obraca się sam na profilu”; one hint line: „Jak ta realizacja pokazuje się na Twojej ścianie realizacji. Okładka i miniatury to pierwsze zdjęcia z listy poniżej.” **Options that cannot work are disabled with a title** — „Okładka + 2 miniatury” needs ≥ 3 photos („Wymaga co najmniej trzech zdjęć.”), „Okładka + opis” needs a description („Wymaga opisu.”); the hint line shows the reason while the current choice is disabled; a disabled choice falls back to „Okładka” on save.
- **3. „Widok 360° (R360)”** — a section with a one-line hint. With a set: the orbit tile (ring on desktop) carrying a white pill top-right: „360°” tag, „Wymień zip” (`refresh-cw`), „Usuń widok 360°” (`x`, danger); the existing `C-R360-PARAMS` under it. Without a set: a compact dashed drop tile „Dodaj zip R360” (`--radius-picture`, 120 px).
- **4. „Zdjęcia”** — hint: „Kolejność ustawiasz, przeciągając miniatury. Pierwsze zdjęcie jest okładką karty na profilu; drugie i trzecie — miniaturami w układzie „Okładka + 2 miniatury”.”
  - **Filmstrip** (the reorder control — #173 done here): a wrapping row of 4:3 thumbnails, 96 px tall (72 on a phone), `--radius-picture`, gap 8; the first carries an „Okładka” tag bottom-left and a 2 px ink ring; a dashed „+” tile closes the row (`Works.form.photos.add`). **Reorder by dragging a thumb** (HTML drag-and-drop with a 2 px ink drop indicator on the target, the dragged thumb at 40 %); keyboard: a focused thumb moves with ← / →; on a phone (no pointer drag) each thumb shows two 24 px chevron buttons bottom-right. There is no „set as cover” action and no star: **cover = first thumb**, that is the whole rule.
  - **Full-size tiles** under the strip, one per photo (16:9 desktop / 4:3 phone, `--radius-picture`), each with a white pill top-right (`--shadow-md`): „Okładka” tag on the first, the position number on the rest; „Wymień” (`refresh-cw`); „Usuń” (`x`, danger, `Works.form.photos.remove` with its confirmation). No arrows on the big tiles — the pictures are too tall to shuffle there (Dawid, 14.09.2026).
  - Without photos: one large dashed drop tile (260 px): `image-plus`, „Dodaj pierwsze zdjęcie”, „JPG, PNG lub WebP, do 20 MB. Najwyżej dziesięć zdjęć.”, underlined „Dodaj zdjęcia”.
- „Zapisz” posts the work (name, parties, description, `card_layout`, `r360_autorotate`, picture order) with the existing `PATCH /api/works/{id}` (or `POST /api/works` for a new one, then redirect to `/{handle}/{slug}`) extended by the three new fields; success → the same URL without `?edit=1`, status line „Zapisano”. „Anuluj” discards unsaved fields; pictures already uploaded stay (A12) — say so in a hint. The leave guard arms in edit mode.

### 5.4 Element map for the works (§8 of the spec)

| Spec element | Fate |
| --- | --- |
| `WORKS-LIST.card.article`, `.strip.photo`, `.strip.two-channel-badge`, `.strip.orbit`, `.strip.orbit-enlarge` | kept (WorkCard, §4.2) |
| `WORKS-LIST.strip.no-picture` | dropped (Dawid, 13.09.2026) — unreachable with valid data (F-WORKS-11) |
| `WORKS-LIST.body.cues` | moved to V-WORK and V-LIGHTBOX |
| `WORKS-LIST.owner.r360-badge` | dropped (Dawid, 13.09.2026) |
| `WORKS-LIST.owner.grip`, `.order.notice`, `.order.error` | kept, always on for the owner (§4.2) |
| `WORKS-LIST.owner.edit` | kept as the „Edytuj” pill → V-WORK edit mode |
| `WORKS-LIST.owner.delete`, `.confirm-yes`, `.confirm-no`, `.body.delete-error` | moved to V-WORK edit mode |
| `WORKS-LIST.list.form-slot` | dropped — a work is edited on its page |
| `V-LIGHTBOX.*` | kept; opens from the card, the work page and the orbit „+”; ring on desktop (D-WORKS-20) |
| `C-ORBIT`, `C-REVEAL`, `C-R360-PARAMS`, `C-UPLOAD-PROGRESS` | kept; R360 params live in V-WORK edit mode |
| `V-WORK-FORM` (new work) | dropped (Dawid, 14.09.2026) — a new work is V-WORK in edit mode with empty fields (§5.3) |

## 6. Everything else — re-skinned, structure kept

6.1 **Homepage V-HOME**: keep the split (D-SHELL-13), tokens do the rest. Copy fix per §3.2. The plaque in the hero photo needs nothing.
6.2 **Auth screens**: `C-AUTH-SHELL` kept; cards `--radius-card`, controls `--radius-control`, type 1:1; add the language chip (§3.2). Close `F-SHELL-2` by giving every page a `title` of `{page} · Architektów 3d` through a title template in `LocaleLayout`.
6.3 **Onboarding**: kept; plaque preview uses the #199 sign at its one size, never tilted (the plaque is always horizontal); add the bar (§3.2).
6.4 **Settings**: kept; sections in one column of cards `--radius-card`; language chip in the bar.
6.5 **Error screen** (F-SHELL-3, other half): `[locale]/error.tsx` and `global-error.tsx` in the 404's frame (D-SHELL-13 split with the facade photo), heading new key `Error.title` pl „Coś poszło nie tak” · en "Something went wrong", body `Error.body` pl „Spróbuj ponownie za chwilę. Jeśli to się powtarza, napisz do nas.” · en "Try again in a moment. If it keeps happening, write to us.", buttons „Spróbuj ponownie” (`Error.retry`, calls `reset()`) and the 404's home link. Both languages; `global-error.tsx` must not depend on the intl provider — inline both dictionaries' strings there.
6.6 **404** kept.
6.7 **Motion** everywhere: 120 / 180 / 280 ms, one curve; no entrance animations on load; dragging per #173; everything gated by `motion-safe:`/`prefers-reduced-motion` (fix F-FORM-24 while there).
6.8 **Icons**: the product's hand-authored Lucide set gains `maximize-2`, `panel-left-close`, `arrow-up`, `arrow-down`, `trash-2`, `image`, `copy`, `chevron-left`/`-right` (if missing). 1.75 stroke, sizes 16/18/20/24 only.

## 7. Findings — close on purpose (§11)

Resolved by this direction: `F-SHELL-2`, `F-SHELL-3` (both halves), `F-SHELL-4`, `F-SHELL-5` / `F-PROFILE-1`, `F-SHELL-6`, `F-SHELL-7`, `F-SHELL-8`, `F-SHELL-10`, `F-SHELL-11` / `F-PROFILE-25`, `F-SHELL-13`, `F-SHELL-14` / `F-PROFILE-4`, `F-SHELL-15`, `F-SHELL-16`, `F-PROFILE-6`, `F-WORKS-6`, `F-WORKS-8`, `F-WORKS-9` (#173), `F-WORKS-11`, `F-WORKS-12`, `F-WORKS-13`, `F-FORM-24`. Kept with a reason (write it in the spec): `F-SHELL-1` (switching accounts), `F-SHELL-18` (fonts — own issue), `F-WORKS-5` (delete error now lives only in edit mode — re-check and close if moot). Everything else in §11: resolve if the view you touch makes it trivial; otherwise list it in the PR under "kept, reason".

Decisions overturned (record in `docs/ui-specification.md` §10 with the date 13.09.2026 and "Dawid"): `D-SHELL-7` / `D-PROFILE-7` (no edit toggle), `D-SHELL-11` (plaque sizing), `D-WORKS-4` (in-place form slot), `D-PROFILE-4` (the avatar no longer shares a row with the name on the page). `D-WORKS-19` and `D-WORKS-20` **stand**.

## 8. Open for Dawid before PR 5 (ask, do not guess)

1. Should the about panel also list the works (a table of contents that scrolls to a card)? Left out of this direction.
2. Reordering works on the profile — the grip pill next to „Edytuj” (§4.2) is this direction's proposal; confirm, or move reordering to a „Kolejność” mode.
3. The description field's limit (600 chars proposed) and whether it appears on the card for `cover` layout (proposed: yes, 2 lines).

## 9. Delivery (as #195 proposes)

1. **Direction** — this document committed as `docs/ui-direction.md` with screenshots of the kit (desktop + phone, three viewers) on the private atlas page. Dawid approves.
2. **Tokens + shared elements** (§2, §3): bars, menus, chip, footer, skip link, plaque (#199).
3. **Auth screens** (§6.2), title template.
4. **Onboarding + settings** (§6.3, §6.4).
5. **Profile** (§4): ProfileBar, cover, AboutPanel, identity edit, WorkCard, reorder with #173, empty state, new-work flow. Migrations: `works.slug`, `works.card_layout`, `works.r360_autorotate`, `works.description`.
6. **Works** (§5): the landing page, edit mode, lightbox ring rule, #159.
7. **404 + error screen** (§6.5), leftovers, `docs/ui-specification.md` rewritten to describe the new UI (IDs of kept elements unchanged; moved elements keep their ID with a "moved to" note; new elements get `V-WORK.*`, `PROFILE.panel.*`, `PROFILE.bar.*` IDs), new screenshots on the atlas.

Each PR: `pnpm check`, `pnpm build`, both e2e projects green with selectors updated to the labels above, axe clean on every view it touches, Polish and English checked by hand, reduced motion checked once.

## 10. Definition of done for #195

Every acceptance box in the issue, plus: the profile at 1440 px shows the cover under a transparent bar, the about panel open, and the first work's pictures filling the column; at 390 px the panel is closed, the avatar + name sit in a 56 px bar, and cards stack with a 4:3 cover; `/{handle}/{slug}` renders for every seeded work and 404s for a made-up slug; the plaque in the panel reads the full name at 22 px however long it is, with the red band under it.
