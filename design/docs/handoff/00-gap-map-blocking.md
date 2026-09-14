# Blocking contradictions — gap map #195, step 00

The 18 contradictions from section 6 of [`00-gap-map.md`](00-gap-map.md#6-contradictions) whose weight is **blocks work**, copied whole. Dawid rules on these before the pull requests they block. Section 7.4 of the map shows which rulings each pull request waits for. Nothing here is resolved.

Ids, titles, sources and wording are the same as in the map. Citations are `path:line` for commit `a8032d3` and the design export of 14.09.2026; quotes stay in their source language.

| id | contradiction | decide before |
| --- | --- | --- |
| [Q-A01](#q-a01--order-of-the-pull-requests-three-sequences) | Order of the pull requests: three sequences | tokens PR |
| [Q-A02](#q-a02--which-pull-request-builds-the-menus-language-chip-bars-footer) | Which pull request builds the menus, language chip, bars, footer | tokens PR |
| [Q-A03](#q-a03--new-work-flow-and-work-card-placed-before-the-work-page-exists) | New-work flow and work card placed before the work page exists | profile PR |
| [Q-A04](#q-a04--new-stored-fields-versus-spec-1-a1a13-stays) | New stored fields versus "SPEC §1 (A1–A13) stays" | profile PR |
| [Q-C02](#q-c02--work-page-bar-empty-right-slot-and-a-different-account-trigger) | Work page bar: empty right slot and a different account trigger | work page |
| [Q-C04](#q-c04--language-options-links-listbox-options-or-menu-items) | Language options: links, listbox options or menu items | shell |
| [Q-C06](#q-c06--footer-content-on-the-profile-and-work-pages) | Footer content on the profile and work pages | shell |
| [Q-E01](#q-e01--identity-edits-saved-on-leaving-a-field-or-held-until) | Identity edits: saved on leaving a field, or held until ✓ | profile |
| [Q-F10](#q-f10--reordering-works-on-the-profile-grip-a-mode-or-none) | Reordering works on the profile: grip, a mode, or none | profile PR |
| [Q-G04](#q-g04--photos-per-work-13-at-10-mb-versus-ten-or-unlimited-at-20-mb) | Photos per work: 1–3 at 10 MB versus ten or unlimited at 20 MB | profile (migrations, `design/docs/claude-code-prompt-195.md:208`) |
| [Q-G05](#q-g05--work-description-limit-300-versus-600-characters) | Work description limit: 300 versus 600 characters | profile (§8 asks before PR 5) |
| [Q-G15](#q-g15--pictures-uploaded-in-edit-mode-after-anuluj-kept-or-discarded) | Pictures uploaded in edit mode after „Anuluj”: kept or discarded | work page |
| [Q-G17](#q-g17--no-second-channel-control-in-the-new-edit-tiles) | No second-channel control in the new edit tiles | work page |
| [Q-H01](#q-h01--homepage-keep-the-split-versus-a-full-bleed-hero-photo) | Homepage: "keep the split" versus a full-bleed hero photo | re-skin |
| [Q-H02](#q-h02--homepage-bar-before-main-or-inside-the-scrim-wrapper) | Homepage bar: before `<main>` or inside the scrim wrapper | shell |
| [Q-H08](#q-h08--two-factor-challenge-method-chooser-and-send-button-versus-one-factor) | Two-factor challenge: method chooser and send button versus one factor | re-skin |
| [Q-H17](#q-h17--two-factor-settings-setup-and-password-guarded-disable-versus-kit-method-rows) | Two-factor settings: setup and password-guarded disable versus kit method rows | re-skin |
| [Q-J02](#q-j02--square-avatar-edit-shot-inherits-the-previous-shots-open-editor) | Square-avatar edit shot inherits the previous shot's open editor | prompt 01 (reference shots) |

## A. Process: paths, language, PR order, issue scope (backend changes), precedence between documents

### Q-A01 — Order of the pull requests: three sequences

- **Sources:**
  - `design/docs/handoff/prompt-00-rozpoznanie.md:29` — „potwierdź lub popraw kolejność: tokens → prymitywy → profil → realizacja + menu → re-skin reszty”
  - `design/docs/claude-code-prompt-195.md:202-210` — „## 9. Delivery (as #195 proposes)” … „**Auth screens**” (:206), „**Onboarding + settings**” (:207), „**Profile**” (:208)
  - `issue #195 › Proposed delivery` — „3. The sign-in screens. 4. Onboarding and settings. 5. The profile page …”
- **What differs:** prompt-00 has no direction step, a separate primitives step, and puts the profile and the work page before the re-skin of auth, onboarding and settings. prompt-195 and the issue have seven steps with auth, onboarding and settings before the profile. The decisions of 14.09 say nothing about delivery order.
- **Affects:** section 7 (the PR split) and the order of every later prompt; **decide before:** tokens PR; **weight:** blocks work

In the map: [Q-A01](00-gap-map.md#q-a01--order-of-the-pull-requests-three-sequences)

### Q-A02 — Which pull request builds the menus, language chip, bars, footer

- **Sources:**
  - `design/docs/handoff/prompt-00-rozpoznanie.md:29` — „realizacja + menu”
  - `design/docs/claude-code-prompt-195.md:205` — „**Tokens + shared elements** (§2, §3): bars, menus, chip, footer, skip link, plaque (#199).”
  - `issue #195 › Proposed delivery` — „2. Tokens and the shared elements: top bars, menus, language switch, footer.”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:14` — „**Telefon: wszystko pod jednym triggerem.**” (source: „PublicProfile.jsx `Popover`, `MenuItem`, `AccountMenu`, `VisitorMenu`”)
- **What differs:** prompt-00 ships the menu with the work page (fourth step); prompt-195 and the issue ship menus, chip, bars and footer in the second pull request with the tokens. Decision A6 of 14.09 redefines the menus (phone menu with language, visitor hamburger) from the profile kit, after prompt-195's §9 was written.
- **Affects:** `AccountMenu`, `LanguageChip`, the visitor menu, `ProfileBar`, `C-FOOTER`, the skip link; **decide before:** tokens PR; **weight:** blocks work

In the map: [Q-A02](00-gap-map.md#q-a02--which-pull-request-builds-the-menus-language-chip-bars-footer)

### Q-A03 — New-work flow and work card placed before the work page exists

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:208` — „**Profile** (§4): … WorkCard, … new-work flow. Migrations: `works.slug`, …”
  - `design/docs/claude-code-prompt-195.md:151` — „a new work is this page in edit mode with nothing in it”
  - `design/docs/claude-code-prompt-195.md:209` — „**Works** (§5): the landing page, edit mode, lightbox ring rule, #159.”
  - `design/docs/claude-code-prompt-195.md:88` — „every picture on the card is a link to the work's landing page”
  - `issue #195 › Proposed delivery` — „6. Works: gallery, lightbox, … and the work form.”
- **What differs:** prompt-195 puts the new-work flow, the work card and the works migrations in the profile pull request, but the new-work flow is the work page's edit mode and the card links to the work page, both delivered later. The issue puts the gallery and the work form in the Works step.
- **Affects:** `WorkCard`, `V-WORK` edit mode, `V-WORK-FORM` tests, the four `works.*` migrations; **decide before:** profile PR; **weight:** blocks work

In the map: [Q-A03](00-gap-map.md#q-a03--new-work-flow-and-work-card-placed-before-the-work-page-exists)

### Q-A04 — New stored fields versus "SPEC §1 (A1–A13) stays"

- **Sources:**
  - `issue #195 › What this is not` — „A screen that needs a rule changed is a SPEC change agreed with Dawid first.”
  - `design/docs/claude-code-prompt-195.md:19` — „`SPEC.md` §1 (A1–A13) — the rules; none change here.”
  - `SPEC.md:63` — A12: „Works: up to 10 per profile; name required (≤ 120), investor and developer (≤ 120), 1–3 photos”
  - `design/docs/claude-code-prompt-195.md:100` — „`works.description` — new optional text field, ≤ 600 chars, backend change”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:27` — „`profile.avatarShape: "circle" | "square"` (domyślnie koło)”
- **What differs:** A12 enumerates a work's fields and limits (pinned to database checks, `SPEC.md:469`); the direction adds a limited work description, per-work `card_layout` and `r360_autorotate`, and a per-profile avatar shape, while stating no rule changes. Whether A12 must first be amended is not stated.
- **Affects:** `works.*` and `profiles.avatar_shape` migrations, work-form validation, SPEC A12; **decide before:** profile PR; **weight:** blocks work

In the map: [Q-A04](00-gap-map.md#q-a04--new-stored-fields-versus-spec-1-a1a13-stays)

## C. Profile bar, layering, account menu, visitor menu, language chip, footer, skip link, focus management

### Q-C02 — Work page bar: empty right slot and a different account trigger

- **Sources:**
  - `design/ui_kits/public-web/WorkPage.jsx:155` — „const actions = owner ? (”, closed at `:169` — „) : null;”
  - `design/ui_kits/public-web/WorkPage.jsx:166` — „aria-label="Menu konta"” … „size={32}”
  - `design/docs/claude-code-prompt-195.md:141` — „others — as on the profile”; `:60` — „(40 px) with a 2 px `--surface-card` ring”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:13` — „na desktopie dla każdego widza, także właściciela”; `:27` — „avatar w menu konta (profil i strona realizacji)”
- **What differs:** The kit shows non-owners nothing on the right, and the owner a pencil plus a bare 32 px avatar button without ring, popover or chip. prompt-195 and decisions A5 and B5 give the work page the profile's right slot, with the chip and a 40 px ringed account menu.
- **Affects:** work page `ProfileBar` actions, `AccountMenu`, `LanguageChip`, `VisitorMenu`; **decide before:** work page; **weight:** blocks work

In the map: [Q-C02](00-gap-map.md#q-c02--work-page-bar-empty-right-slot-and-a-different-account-trigger)

### Q-C04 — Language options: links, listbox options or menu items

- **Sources:**
  - `docs/ui-specification.md:507` — „`LANGUAGE-CHIP.panel.option` — link (one per locale)”; the cookie is written by the link (`:521`)
  - `e2e/i18n.spec.ts:39` — „page.getByRole("link", { name: "English" }).click();”
  - `design/docs/claude-code-prompt-195.md:70` — „keep their behaviour and dismissal (C-DISMISSABLE)”, „arrow keys move within `role="menu"`”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:13` — „`LanguageChip` (flaga + nazwa + chevron, lista z flagami)”, source `Hero.jsx`
  - `design/ui_kits/public-web/Hero.jsx:34` — „aria-haspopup="listbox"”; `:39` — „role="listbox"”; `:41` — „role="option" aria-selected={l === locale} onClick”
  - `design/ui_kits/public-web/PublicProfile.jsx:54` — „role="menuitem"” (phone language items, `:65-66`)
- **What differs:** Today each language is a locale link that writes `NEXT_LOCALE`, and prompt-195 keeps that behaviour and adds menu keys. The chip A5 names lists languages as unfocusable `listbox` options with click handlers; A6's phone menus use `menuitem` buttons.
- **Affects:** `LanguageChip`, language items in `AccountMenu` and `VisitorMenu`, the chip nested in `MobileMenu`, `e2e/i18n.spec.ts:38-39`; **decide before:** shell; **weight:** blocks work

In the map: [Q-C04](00-gap-map.md#q-c04--language-options-links-listbox-options-or-menu-items)

### Q-C06 — Footer content on the profile and work pages

- **Sources:**
  - `design/ui_kits/public-web/PublicProfile.jsx:197` — „note="Warszawa · architektow3d.pl" links={[{ label: "Regulamin" }, { label: "Prywatność" }, { label: "Kontakt" }]}”; the same at `design/ui_kits/public-web/WorkPage.jsx:273`
  - `design/components/navigation/Footer.jsx:5` — „company = "Architectorium",”; `:36` — „href={l.href || "#"}”
  - `design/ui_kits/public-web/Hero.jsx:110` — „company="Architectorium Sp. z o.o." copyright="© 2026" links={[]}”
  - `design/docs/claude-code-prompt-195.md:81` — „Footer (`C-FOOTER`, `measure-wide`).”
  - `docs/ui-specification.md:595` — „**No** links, no language switcher (D-SHELL-9).”; `messages/pl.json:50-51` — „Architectorium Sp. z o.o.”, „© 2026”
- **What differs:** The kit's profile and work page footers show „Architectorium”, a place note and three links without targets, and no copyright. `C-FOOTER`, named by prompt-195, has the full company name, „© 2026” and no links, like the homepage kit and the dictionary. No terms, privacy or contact page exists under `src/app/[locale]`.
- **Affects:** `footer.tsx`, `Footer.*` keys, possible new routes; **decide before:** shell; **weight:** blocks work

In the map: [Q-C06](00-gap-map.md#q-c06--footer-content-on-the-profile-and-work-pages)

## E. About panel: read-only and identity editing, places, save model

### Q-E01 — Identity edits: saved on leaving a field, or held until ✓

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:129` — „fields keep their save-on-blur” … „„Anuluj” returns without waiting (saves already made stay”
  - `docs/ui-specification.md:3604` — „each field saves itself when it is left and is public at once (no draft/published state)” (D-PROFILE-8, from `SPEC.md:63`)
  - `design/docs/handoff/00-decyzje-2026-09-14.md:38` — „Draft (`draft`, `onDraftChange`) trzyma rodzic”
  - `design/ui_kits/public-web/PublicProfile.jsx:115` — „// × drops the draft and closes the panel; ✓ saves and leaves it open”
- **What differs:** prompt-195 saves each field on leaving it, so cancelling keeps what was saved. Decisions C5/C6 and the reference hold a draft that ✓ sends whole and × drops. C5 does not mention save-on-blur, D-PROFILE-8 or `PublicProfile.editHint`. C7 keeps the spec's place ordering, which saves every move at once (`docs/ui-specification.md:3272`).
- **Affects:** AboutPanel edit mode, PublicProfile, leave guard, `PublicProfile.editHint`, `e2e/db/profile-sections.spec.ts:105-112`; **decide before:** profile; **weight:** blocks work

In the map: [Q-E01](00-gap-map.md#q-e01--identity-edits-saved-on-leaving-a-field-or-held-until)

## F. Work card, orbit tile, lightbox, reordering on the profile, empty state

### Q-F10 — Reordering works on the profile: grip, a mode, or none

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:102` — „always available (no edit mode to enter). The grip is a second pill next to „Edytuj””
  - `design/docs/claude-code-prompt-195.md:199` — „is this direction's proposal; confirm, or move reordering to a „Kolejność” mode.”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:26` — „**Okrągły ołówek 40 px bez tekstu**”
  - `design/components/profile/WorkCard.jsx:71-83` — owner chrome is the pencil only; no grip
  - `docs/ui-specification.md:5308` — „Reordering: grips only while editing and only with more than one work”
- **What differs:** prompt-195 proposes an always-on grip beside the „Edytuj” pill and leaves it open for Dawid; decision E keeps §8 open (00-decyzje:50). B4 removed that pill without placing the grip, and the reference card has no reorder control. D-WORKS-5 ties grips to edit mode, and B6 brings an owner edit mode back to the profile (00-decyzje:28).
- **Affects:** `WORKS-LIST.owner.grip`, `.order.notice`, `.order.error`, `Works.card.move`, #173 on the profile, `e2e/db/works-order.spec.ts`; **decide before:** profile PR; **weight:** blocks work

In the map: [Q-F10](00-gap-map.md#q-f10--reordering-works-on-the-profile-grip-a-mode-or-none)

## G. Work page: read-only, edit mode, new work, data and migrations

### Q-G04 — Photos per work: 1–3 at 10 MB versus ten or unlimited at 20 MB

- **Sources:**
  - `SPEC.md:63` — „1–3 photos (as A4, one of them the main photo)”; `SPEC.md:55` — „photo (JPEG/PNG/WebP ≤ 10 MB)”
  - `design/docs/claude-code-prompt-195.md:19` — „the rules; none change here.”
  - `design/docs/claude-code-prompt-195.md:145` — „D-WORKS-1's rule, now unlimited”
  - `design/docs/claude-code-prompt-195.md:160` and `design/ui_kits/public-web/WorkPage.jsx:14` — „JPG, PNG lub WebP, do 20 MB. Najwyżej dziesięć zdjęć.”
  - `src/db/schema.ts:390` — „A12: at most three photos, so positions are exactly 0, 1, 2.”; `src/lib/work-schemas.ts:12` — „WORK_PHOTOS_MAX = 3”; `messages/pl.json:508` — „od 1 do 3, JPEG, PNG lub WebP do 10 MB każde”
- **What differs:** prompt-195 says no rule changes, yet names three counts (three by SPEC, ten in its copy, unlimited in §5.2) and 20 MB against 10 MB. The kit's demo work has six pictures (`design/ui_kits/public-web/data.js:17`).
- **Affects:** `work_images` position check, work schemas, upload size check, empty-tile copy, filmstrip, limit tests; **decide before:** profile (migrations, `design/docs/claude-code-prompt-195.md:208`); **weight:** blocks work

In the map: [Q-G04](00-gap-map.md#q-g04--photos-per-work-13-at-10-mb-versus-ten-or-unlimited-at-20-mb)

### Q-G05 — Work description limit: 300 versus 600 characters

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:100` — „new optional text field, ≤ 600 chars, backend change”
  - `design/docs/claude-code-prompt-195.md:154` — „„Opis” (`Textarea`, 300 chars, live counter”
  - `design/docs/claude-code-prompt-195.md:200` — „The description field's limit (600 chars proposed)”
  - `design/ui_kits/public-web/WorkPage.jsx:11` — „Do 300 znaków. Widoczny na stronie realizacji”; `:195` — „maxLength={300}”
  - `design/docs/handoff/00-decyzje-2026-09-14.md:50` — „pytania otwarte (§8)” listed as untouched
- **What differs:** prompt-195 sets the column at 600, the field at 300, and keeps the limit as an open question; the kit enforces 300 and names it in the hint, which the hint in prompt-195:154 does not.
- **Affects:** `works.description` migration, work schema, counter, `descHint` copy, card clamp; **decide before:** profile (§8 asks before PR 5); **weight:** blocks work

In the map: [Q-G05](00-gap-map.md#q-g05--work-description-limit-300-versus-600-characters)

### Q-G15 — Pictures uploaded in edit mode after „Anuluj”: kept or discarded

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:161` — „„Anuluj” discards unsaved fields; pictures already uploaded stay (A12)”; same line: „„Zapisz” posts the work (… picture order)”
  - `design/ui_kits/public-web/WorkPage.jsx:160` — „setDraft(work); setEditing(false);”
  - `docs/ui-specification.md:4848` — „whatever the form uploaded and did not save is discarded when it closes, however it closes”
  - `SPEC.md:63` — „public the moment it is saved.”
- **What differs:** prompt-195 keeps uploaded pictures after cancel although its save sends the picture list; the kit's cancel restores the saved pictures and D-FORM-1 discards unsaved uploads. A cancelled new work has no work for pictures to stay on.
- **Affects:** upload and discard flow, save request, quota, leave guard, cancel/discard tests; **decide before:** work page; **weight:** blocks work

In the map: [Q-G15](00-gap-map.md#q-g15--pictures-uploaded-in-edit-mode-after-anuluj-kept-or-discarded)

### Q-G17 — No second-channel control in the new edit tiles

- **Sources:**
  - `src/db/schema.ts:367` — „#99: the photo's second channel”
  - `docs/ui-specification.md:4550` — „`Works.form.photos.channelAdd` — pl „Dodaj drugi kanał””
  - `design/docs/claude-code-prompt-195.md:145` — „Two-channel photos render the `ChannelReveal` inline”
  - `design/docs/claude-code-prompt-195.md:159` — pill: „„Okładka” tag …; „Wymień” (`refresh-cw`); „Usuń””; `design/ui_kits/public-web/WorkPage.jsx:249`–`:251` — tag, „Wymień”, „Usuń” only
  - `design/docs/claude-code-prompt-195.md:104` — „Keep the form's field IDs and tests where they still apply.”
- **What differs:** two-channel photos stay in view, but the edit tile in prompt-195 and the kit offers no way to add or remove a second channel. Whether `WORK-FORM.photos.channel-*` stay, and where, is not stated.
- **Affects:** `WORK-FORM.photos.channel-add`, `-remove`, `-progress`, `-badge`; `Works.form.photos.channel*`; #99 test in `works.spec.ts`; **decide before:** work page; **weight:** blocks work

In the map: [Q-G17](00-gap-map.md#q-g17--no-second-channel-control-in-the-new-edit-tiles)

## H. Homepage, 404, error screen, auth, onboarding, settings

### Q-H01 — Homepage: "keep the split" versus a full-bleed hero photo

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:181` — „keep the split (D-SHELL-13), tokens do the rest”
  - `design/docs/claude-code-prompt-195.md:24` — „the hero/404 photo panel”
  - `docs/ui-specification.md:712` — „Two panels (photo beside text) from `sm`” (the 404's decision)
  - `design/ui_kits/public-web/Hero.jsx:1-2` — „the facade photograph fills the first screen behind a scrim”
  - `design/ui_kits/public-web/README.md:19` — „the photograph moved into the right-hand panel”
- **What differs:** prompt-195 tells the homepage to keep a split named after the 404's two-panel decision and speaks of a hero photo panel. Today's homepage (`docs/ui-specification.md:633`) and `Hero.jsx` are a full-bleed photo with no panel. The kit README describes a split with the photo on the right, which `Hero.jsx` does not draw.
- **Affects:** V-HOME layout, `HOME.hero.*`, `--radius-picture` on the hero, axe `landing-pl`/`landing-en`, shots `hero_desktop`/`hero_phone`; **decide before:** re-skin; **weight:** blocks work

In the map: [Q-H01](00-gap-map.md#q-h01--homepage-keep-the-split-versus-a-full-bleed-hero-photo)

### Q-H02 — Homepage bar: before `<main>` or inside the scrim wrapper

- **Sources:**
  - `design/docs/claude-code-prompt-195.md:66` — „Every bar is a `<header>` landmark and precedes `<main>`”
  - `design/ui_kits/public-web/Hero.jsx:94-97` — `<main …>` holds the photo, the scrim `<div>` and `<HomeBar …/>` (a `<header>`, `:64`)
  - `src/app/[locale]/(public)/page.tsx:89-90` — „The gradient lives on this wrapper — an actual ANCESTOR of the text below”; `<TopBar` at `:114`, inside `<main>` (`:69`)
  - `docs/ui-specification.md:676` — „the scrim gradient sits on an ancestor of the text so axe can evaluate it”
- **What differs:** prompt-195 puts every bar before `<main>`. The kit and the product keep the homepage bar inside `<main>`. The product does this on purpose: the scrim wrapper must be an ancestor of the bar's text for the axe contrast check (D-SHELL-12).
- **Affects:** homepage `TopBar` placement, skip link target (`Shell.skipToContent`), `e2e/a11y.spec.ts` landing pages, `e2e/axe.ts:53` `GRADIENT_HERO_PAGES`; **decide before:** shell; **weight:** blocks work

In the map: [Q-H02](00-gap-map.md#q-h02--homepage-bar-before-main-or-inside-the-scrim-wrapper)

### Q-H08 — Two-factor challenge: method chooser and send button versus one factor

- **Sources:**
  - `src/app/[locale]/(auth)/two-factor/modes.ts:13-15` — an authenticator account gets `totp`, `otp` (when offered) and `backup`
  - `src/app/[locale]/(auth)/two-factor/two-factor-challenge.tsx:99-103` — `role="group"`; `:142-153` send button; `:180` field `disabled={!codeReady}`
  - `e2e/two-factor.spec.ts:37-43`, `:61-62` — „Aplikacja”, „Kod e-mail”, „Kod zapasowy”, „Wyślij kod na e-mail”
  - `design/ui_kits/app/Auth.jsx:96-97` — „The factor was chosen long before this screen”; `:122` „Code sent — check your inbox.”
  - `docs/ui-specification.md:2026` — „the e-mail code is offered to, and accepted for, accounts protected by an authenticator app”
  - `design/docs/claude-code-prompt-195.md:179` — „structure kept”
- **What differs:** The product lets the user switch methods and sends an e-mail code only on request; e2e drives both. The kit shows one factor per account, treats the code as already sent and never offers e-mail to an authenticator account, which is what F-AUTH-18 (#59) asks for.
- **Affects:** `two-factor-challenge.tsx`, `modes.ts`, `TwoFactor.*`, `e2e/two-factor.spec.ts`; **decide before:** re-skin; **weight:** blocks work

In the map: [Q-H08](00-gap-map.md#q-h08--two-factor-challenge-method-chooser-and-send-button-versus-one-factor)

### Q-H17 — Two-factor settings: setup and password-guarded disable versus kit method rows

- **Sources:**
  - `src/app/[locale]/(app)/settings/account/two-factor-settings.tsx:172-200` — on view: password + disable `Button`; `:205-226` activated view with backup codes; `:273-335` setup: key, backup codes, code, `app.activate`
  - `design/ui_kits/app/AccountSettings.jsx:35-47` — `Method`: password + quiet button; `:127-129` both rows `disabled={!!twoFactor}`; `:130` muted `TextLink` turns it off
  - `design/docs/claude-code-prompt-195.md:184` — „Settings: kept”
- **What differs:** The product enables the app through a key, backup codes and a confirming code, holds an activated view, and asks for a password to turn two-factor off. The kit enables either method from its row after a password, has no key, codes or activation step, and turns it off with a link and no password.
- **Affects:** `two-factor-settings.tsx`, `Settings.account.twoFactor.*`, F-ACCOUNT-13 and F-ACCOUNT-14; **decide before:** re-skin; **weight:** blocks work

In the map: [Q-H17](00-gap-map.md#q-h17--two-factor-settings-setup-and-password-guarded-disable-versus-kit-method-rows)

## J. E2E tests and accessibility

### Q-J02 — Square-avatar edit shot inherits the previous shot's open editor

- **Sources:**
  - `design/docs/handoff/shots/matrix.json:18–19` — „…_edycja_dodaj-miejsce” (types „war”), then „…_edycja_avatar-kwadrat” with „"click": "[aria-label='Edytuj profil']"”
  - `design/ui_kits/public-web/shots.html:33` — „key={s.viewer + s.screen + s.about}”; `capture.mjs.txt:43–45` — every shot in one page, no reload
  - `design/ui_kits/public-web/PublicProfile.jsx:138` — „disabled={editing}”; `design/components/profile/AboutPanel.jsx:138` — „const d = editing && draft ? draft : profile;”
  - `design/docs/handoff/prompt-01-zrzuty.md:11` — „Popraw wyłącznie selektor/`wait`”; `:15` — „każdy przedstawia stan z `id`”
- **What differs:** Both entries get the same key, so the editor stays open and the pencil click waits on a disabled button until timeout, stopping the run before the 28 later shots. Removing the click, the only fix prompt 01 allows, still shows the previous draft (round avatar in the panel, „war” typed), not the state the id names.
- **Affects:** `profil_wlasciciel_desktop_edycja_avatar-kwadrat` and every shot after it; **decide before:** prompt 01 (reference shots); **weight:** blocks work

In the map: [Q-J02](00-gap-map.md#q-j02--square-avatar-edit-shot-inherits-the-previous-shots-open-editor)
