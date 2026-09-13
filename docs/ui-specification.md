# UI specification — the interface as it stands

Tracked in #185. Describes `main` at `ae55b6c` (12.09.2026).

## 0. Read this first

- **Reader.** This document is written for the agent that will implement the new UI. The
  redesign may change layout, structure and look completely. It must not lose a function,
  rule, state, message or accessibility guarantee by accident: every one of them is listed
  here under an ID.
- **Snapshot.** Where the code has moved since `ae55b6c`, the code wins. Before relying on a
  detail, run `git log --oneline ae55b6c..HEAD -- src/app src/components messages` and
  re-read what changed.
- **Rules live in SPEC.md** (A1–A13, §8–§10). This document says where and how the UI
  enforces a rule; it does not restate the rule.
- **Three kinds of statement.**
  - _Behaviour_ — plain text. Keep it, unless the redesign drops it on purpose.
  - _Decision_ `D-AREA-n` — a deliberate design choice with its source. Keep it, or overturn
    it knowingly and record why (a SPEC.md change or an issue).
  - _Finding_ `F-AREA-n` — an inconsistency or gap in today's UI. The redesign should resolve
    it. Nothing listed was fixed, except where the entry says so (`F-WORKS-1`: a sentence
    in SPEC.md).
- **IDs.** Views `V-NAME`, shared components `C-NAME`, elements `VIEW.region.element`
  (e.g. `PROFILE-EDIT.cover.remove`). Grep for an ID to find its block.
- **Copy.** Every visible string is a dictionary key (A8), quoted as `Namespace.key` —
  pl „…” · en "…". Keep using keys; a new string goes into both `messages/pl.json` and
  `messages/en.json`.
- **Tests.** Element blocks name the e2e selectors that depend on them. A new UI that changes
  a role, an accessible name or a test id updates those tests in the same change.
- **Sources.** A file path and a symbol name, never a line number.
- **Screenshots.** Taken on dev (`https://dev.architektow3d.pl`) on 12.09.2026 with the
  profile `dawidwroblewski-a3d-1` (owner views signed in as its owner; e-mail addresses
  masked). The profile changed during the day: the owner views show two works, the later
  visitor views three. They are kept outside the repository, on a private page:
  https://claude.ai/code/artifact/37a17f91-9bd7-4641-8108-448f20987ac3. To look at one, call the Artifact tool with `action: "read_file"`,
  `url` = that page and `path: "screens/<id>.jpg"`, then Read the file it saves. Appendix A
  lists every `<id>`. A screenshot taller than 2000 px is shrunk when read and its text blurs:
  read its parts instead, `screens/<id>--part-<n>.jpg` (1600 px each, overlapping), counted in
  Appendix A and listed in `screens/manifest.json`. They show the look being replaced — use them to understand today's
  arrangement, not as the target. To see a state no screenshot shows, run the app (SPEC.md
  §3) and look.

## 1. Modes

What a view shows depends on these dimensions. The **Shown** line of every element block uses
exactly these words.

| Dimension    | Values                                                                                                                    | Where the code decides                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer       | `signed-out` · `no-handle` (signed in, no handle yet) · `owner` (own profile) · `other` (someone else's profile) · `signed-in` (any) | On the server, per request. `(app)/layout.tsx` (session gate), `isOwnerViewing` in `(public)/[handle]/page.tsx`, `signedInDestination` in `src/lib/signed-in-destination.ts`. Every read fails closed: a session that cannot be verified counts as signed out.                                              |
| Profile mode | `view` · `edit`                                                                                                           | Client state `editing` in `OwnerProfileView` (`owner-profile-view.tsx`). Not in the URL: a reload returns to `view`.                                                                                                                                                                                          |
| Screen       | `desktop` (≥ 40rem) · `phone` (< 40rem) · `phone:`                                                                         | Tailwind's `sm` breakpoint (40rem). `phone:` is the custom variant in `src/app/globals.css`: `(width < 40rem), (pointer: coarse) and (height < 32rem)` — a narrow screen, or a touch screen held sideways. Other breakpoints are named where used (`md` = 48rem).                                                |
| Locale       | `pl` · `en`                                                                                                               | next-intl middleware in `src/proxy.ts` with `localePrefix: "as-needed"` (`src/i18n/routing.ts`): the path prefix first, then the `NEXT_LOCALE` cookie, then `Accept-Language`. So an unprefixed address is Polish only for a visitor whose cookie and browser do not say English — after one visit to `/en`, `/login` redirects to `/en/login` (observed on dev). |
| Motion       | `reduced-motion`                                                                                                          | `prefers-reduced-motion: reduce`.                                                                                                                                                                                                                                                                              |
| Input        | `mouse` · `touch` · `keyboard` · `screen reader`                                                                           | —                                                                                                                                                                                                                                                                                                              |

### Index of views and components

| ID | What | Section |
| --- | --- | --- |
| `C-TOPBAR` | top bar | §3 |
| `C-ACCOUNT-MENU` | account menu | §3 |
| `C-MOBILE-MENU` | hamburger panel | §3 |
| `C-LANGUAGE-CHIP` | language switcher | §3 |
| `C-DISMISSABLE` | popover dismissal | §3 |
| `C-LOGO` | brand mark and wordmark | §3 |
| `C-FOOTER` | page footer | §3 |
| `C-PLAQUE` | street-sign graphic | §3 |
| `V-HOME` | homepage | §4 |
| `V-404` | not found | §4 |
| `C-AUTH-SHELL` | the frame of the seven auth screens | §5 |
| `V-LOGIN` | log in | §5 |
| `V-REGISTER` | create an account | §5 |
| `V-REGISTER-VERIFIED` | verification link landing | §5 |
| `V-RESET-REQUEST` | ask for a password-reset link | §5 |
| `V-RESET-NEW` | set a new password from the link | §5 |
| `V-TWO-FACTOR` | second-factor challenge after the password | §5 |
| `V-EMAIL-CHANGED` | e-mail-change link landing | §5 |
| `V-ONBOARDING` | name, then profile address | §6 |
| `C-HANDLE-FORM` | profile address picker | §6 |
| `V-SETTINGS-ACCOUNT` | account settings | §6 |
| `V-SETTINGS-PROFILE-REDIRECT` | former profile settings | §6 |
| `V-PROFILE` | public profile (visitor) | §7 |
| `V-PROFILE-OWNER` | the owner's profile, not editing | §7 |
| `V-PROFILE-EDIT` | the owner editing in place | §7 |
| `C-LEAVE-GUARD` | asking before the owner leaves mid-edit | §7 |
| `V-WORKS-LIST` | works gallery and the work card | §8 |
| `V-LIGHTBOX` | enlarged picture overlay | §8 |
| `C-ORBIT` | the R360 viewer (viewer, ring, cue buttons) | §8 |
| `C-REVEAL` | two-channel reveal slider | §8 |
| `V-WORK-FORM` | the work form (a new work / an existing work) | §8 |
| `C-R360-PARAMS` | orbit preview, parameters and cue points in the work form | §8 |
| `C-UPLOAD-PROGRESS` | upload progress bar with cancel | §8 |

## 2. Site map

- **Locales (A8):** `pl` (default, unprefixed) and `en` (prefix `/en`) — `src/i18n/routing.ts` `routing` (`localePrefix: "as-needed"`). Every page lives under `src/app/[locale]`; `[locale]/layout.tsx` `LocaleLayout` is the root layout (`<html lang={locale}>`, `NextIntlClientProvider`, `globals.css`). There is no `src/app/layout.tsx`, no `error.tsx`, `global-error.tsx`, `loading.tsx`, catch-all route or `global-not-found`.
- **Navigation helpers:** `src/i18n/navigation.ts` exports next-intl `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`. Every in-app href is written unprefixed (`/login`) and receives the current locale's form (`/en/login`).
- **Request config:** `src/i18n/request.ts` — locale from the `[locale]` segment (or an explicit one); unsupported value → `notFound()`; loads `messages/<locale>.json`; `timeZone: "Europe/Warsaw"`.
- **Requests the middleware never sees** (`/api`, Better Auth callbacks, e-mail language): `src/i18n/request-locale.ts` `localeFromRequest` — `NEXT_LOCALE` cookie → `Accept-Language` (base language, highest q, q=0 ignored) → `pl`.
- **Default `<head>`:** `LocaleLayout` `generateMetadata` — title `Metadata.title` pl „Architektów 3d” · en "Architektów 3d"; description `Metadata.description` pl „Publiczne profile dla studiów architektury i artystów 3D.” · en "Public profiles for architecture studios and 3D artists."; `metadataBase` = `APP_URL` when parsable. No title template: a page's own title replaces the default.

#### Pages

| Page | URL pl · en | Source | Reached by | Everyone else gets | `<title>` |
| --- | --- | --- | --- | --- | --- |
| V-HOME | `/` · `/en` | `(public)/page.tsx` `HomePage` | signed-out (incl. a session that cannot be verified) | signed-in with handle → 307 `/{handle}`; no-handle → 307 `/onboarding` | default |
| V-PROFILE (visitor view) | `/{handle}` · `/en/{handle}` | `(public)/[handle]/page.tsx` `PublicProfilePage` | signed-out, no-handle, other | pipeline step 8 | `{displayName} · Architektów 3d` |
| V-PROFILE-OWNER, V-PROFILE-EDIT (owner) | same | `(public)/[handle]/owner-profile-view.tsx` `OwnerProfileView` | owner | — | same |
| Login | `/login` · `/en/login` | `(auth)/login/page.tsx` | anyone (no session check) | — | `Login.title` „Logowanie” · "Log in" |
| Register | `/register` · `/en/register` | `(auth)/register/page.tsx` | anyone | — | `Register.title` „Rejestracja” · "Sign up" |
| Verification landing | `/register/verified` · `/en/register/verified` | `(auth)/register/verified/page.tsx` | anyone; Better Auth lands the A1 link here (`?error=` on a rejected token) | — | default (no `generateMetadata`) |
| Reset request | `/reset-password` · `/en/reset-password` | `(auth)/reset-password/page.tsx` | anyone | — | `ResetPassword.title` „Reset hasła” · "Password reset" |
| New password | `/reset-password/new` · `/en/reset-password/new` | `(auth)/reset-password/new/page.tsx` | anyone; the A3 link lands with `?token=` (without it: invalid-link state) | — | `ResetPassword.title` |
| Two-factor challenge | `/two-factor` · `/en/two-factor` | `(auth)/two-factor/page.tsx` | anyone; login pushes here with `?methods=` | — | `TwoFactor.title` „Weryfikacja dwuskładnikowa” · "Two-factor verification" |
| E-mail change landing | `/email-changed` · `/en/email-changed` | `(auth)/email-changed/page.tsx` | anyone; both A10 links land here (`?status=done`, `?error=`) | — | `EmailChanged.title` „Zmiana adresu” · "Address change" |
| Onboarding | `/onboarding` · `/en/onboarding` | `(app)/onboarding/page.tsx` | no-handle | signed-out → 307 `/login`; with handle → 307 `/{handle}` | `Onboarding.title` „Adres profilu” · "Profile address" |
| Account settings | `/settings/account` · `/en/settings/account` | `(app)/settings/account/page.tsx` | signed-in (with or without handle) | signed-out → 307 `/login` | `Settings.account.title` „Ustawienia konta” · "Account settings" |
| Former profile settings | `/settings/profile` · `/en/settings/profile` | `(app)/settings/profile/page.tsx` | nobody (redirect only) | signed-out → 307 `/login`; signed-in → 307 `/settings/account` | — |
| V-404 | the requested URL of any `[locale]` page that calls `notFound()` | `[locale]/not-found.tsx` | anyone | status 404 | `NotFound.title` „Nie znaleziono strony” · "Page not found" |

Every redirect answers in the request's locale form (`/en/...` for English). "The seven auth screens" = the rows Login … E-mail change landing.

#### Request pipeline (redirects and statuses, in order)

1. **Proxy matcher** — `src/proxy.ts` `config.matcher`: runs for every path except `/api`, `/_next`, `/_vercel`, `/icon`, `/apple-icon`, `/opengraph-image` and `/xx/opengraph-image` (each as a whole segment) and any path containing a dot. Excluded paths get no locale handling and no noindex header. A handle such as `apiary` still passes.
2. **Old handle → 301** (A6, §9) — `proxy` → `oldAddressRedirect`. Only a path of exactly one segment after an optional `pl`/`en` prefix that passes `checkHandle` (A5 pattern, not reserved) is looked up (`handleCandidate`, `resolveHandle`). A redirect row whose target still has a handle → `301` to `/{current}` (for `/{old}` and `/pl/{old}`) or `/en/{current}` (for `/en/{old}`), query string kept, `Cache-Control: no-store`. Lookup bound 1.5 s (`LOOKUP_TIMEOUT_MS`); timeout, error or missing `DATABASE_URL` → falls through to step 3 (logged, except the missing variable). The 301 bypasses the locale middleware (no cookie write, no `Link` header). A path with capitals never passes `checkHandle` (lowercase pattern), so its old address is answered by step 8.
3. **Locale middleware** — next-intl `createMiddleware(routing)` (`node_modules/next-intl` `middleware.js`, `resolveLocale.js`, `syncCookie.js`, `routing/config.js`). Locale = path prefix → `NEXT_LOCALE` cookie → `Accept-Language` best match → `pl`.
   - `/pl` or `/pl/...` → `307` to the unprefixed path, query kept.
   - unprefixed path resolved to `en` → `307` to `/en/...`, query kept.
   - unprefixed path resolved to `pl` → internal rewrite; URL unchanged.
   - document requests only: sets `NEXT_LOCALE=<resolved>` when the cookie differs, or when absent and the resolved locale differs from the `Accept-Language` match. Attributes `SameSite=Lax`, no `Max-Age` (session cookie).
   - non-redirect responses carry a `Link` header with `hreflang` alternates.
4. **noindex** (A7, §8) — `proxy`: unless `APP_ENV` (trimmed) is exactly `production` (`isProduction`), every response of steps 2–3 gets `X-Robots-Tag: noindex`. `/api` and matcher-excluded paths never get it.
5. **Locale layout 404** — `LocaleLayout`: a `[locale]` value other than `pl`/`en` → `notFound()`. Reachable only by paths the middleware skipped (dotted paths such as `/robots.txt`). Observed on dev (12.09.2026): `/robots.txt` answers 404 with an empty body — no page renders.
6. **Session gate** — `(app)/layout.tsx` `AppLayout`: `getAuth().api.getSession`; `null` or a thrown error → `307` `/login` (fail closed). Covers `/onboarding`, `/settings/account`, `/settings/profile`; the two real pages repeat the check.
7. **Page redirects** (`307`, Next `redirect` via next-intl):
   - `/settings/profile` → `/settings/account` (`ProfileSettingsRedirect`, #58).
   - `/onboarding` for a user with a handle → `/{handle}` (`OnboardingPage`).
   - `/` for a signed-in viewer → `signedInDestination()` (`src/lib/signed-in-destination.ts`): handle → `/{handle}`, none → `/onboarding`; the session read and the handle read share one try/catch — any failure = signed out.
8. **Profile address** — `PublicProfilePage` + `loadPublicProfile` (`src/lib/public-profile.ts`) on the trimmed, lowercased input; `resolveHandle` order profile → redirect → not found:
   - invalid shape or reserved word → 404 (no query).
   - profile row and input already canonical → render: owner view when the session's user id equals the profile's (`isOwnerViewing`; any session error = not owner), else visitor view.
   - profile row, input differs (capitals, surrounding whitespace) → `308` (`permanentRedirect`) to the lowercase address, query kept.
   - redirect row (proxy failed open or timed out, or the path had capitals) → `308` to the current handle, query kept.
   - redirect row whose target has no handle, no row, profile deleted between reads, or no `DATABASE_URL` → 404 body.
   - any other database or storage error → thrown (500; no error page — F-SHELL-3).
   - `force-dynamic`; `generateMetadata` and the render share one lookup (`cache`).
9. **404 body** — `[locale]/not-found.tsx` renders for `notFound()` thrown by a page under `[locale]`, HTTP 404 (e2e `profile.spec.ts`). An address matching no route at all never reaches it: observed on dev (12.09.2026), `/foo/bar` and `/en/settings/x` answer 404 with Next's default, unlocalized page (`<title>404: This page could not be found.</title>`) — F-SHELL-3.

Example chain: signed-out visitor with `NEXT_LOCALE=en` opens `/settings/account` → 307 `/en/settings/account` → 307 `/en/login`.

#### Non-page touchpoints

- `GET /api/og/{handle}` — `src/app/api/og/[handle]/route.tsx` `GET`: 512×512 PNG of the profile's initials (`initialsFrom`) in the stone monogram colours; og:image of a profile without an avatar (`monogramImagePath`, used by `profileMetadata`); `Cache-Control: public, max-age=86400, s-maxage=86400`; anything but a live profile (unknown, reserved, old handle) → 404 plain text "Not found"; no `DATABASE_URL` → 404 "Not configured".
- `/icon` — `src/app/icon.tsx` `Icon`: 32×32 PNG browser-tab icon, the A3D mark.
- `/apple-icon` — `src/app/apple-icon.tsx` `AppleIcon`: 180×180 PNG home-screen icon, the same mark.
- `src/app/brand-mark.tsx` — `BrandMark` (A3D mark for `next/og`: navy `#0f4eb1`, red band 12 % of the height, "A3D" in Figtree Bold at 34 %, corner radius 4/30 of the side) and `brandFont` (reads `public/figtree-bold.ttf` once per process); used by the two icons only.
- `src/app/[locale]/opengraph-image.jpg` + `opengraph-image.alt.txt` — static share picture of every `[locale]` page that declares no image of its own (homepage, auth screens, settings, onboarding, 404); alt „ul. Architektów 3d, Stara Ochota” for both locales.
- `public/hero-facade-plaque.webp` — the photo of V-HOME and V-404.

#### Decisions

- `D-SHELL-1` — Polish unprefixed, English under `/en`; locale from the path, then the `NEXT_LOCALE` cookie, then `Accept-Language`; one time zone `Europe/Warsaw`. Source: A8; `routing.ts` comment; `proxy.ts` header comment ("pathname prefix, then the NEXT_LOCALE cookie, then the Accept-Language header"); §8, `request.ts` comment.
- `D-SHELL-2` — An old handle answers 301 from the proxy with `Cache-Control: no-store`, query kept, failing open within 1.5 s; the page adds 308s for case variants and for old addresses the proxy missed. Source: A6, §9; `proxy.ts` comments ("a page can only emit 308", "no-store keeps every client re-asking", "Fail-open must also be fail-fast"); `[handle]/page.tsx` comments ("a shared link carries its campaign parameters").
- `D-SHELL-3` — `X-Robots-Tag: noindex` on every proxied response outside production, set in one place. Source: A7, §8; `proxy.ts` comment ("so no route can forget it").
- `D-SHELL-4` — Session reads fail closed: unverifiable = signed out on `/` and the 404, `(app)` pages go to `/login`, a profile shows its visitor view; `/settings/profile` stays inside `(app)` as a redirect so a signed-out visitor goes straight to login. Source: `(app)/layout.tsx` comment; `signed-in-destination.ts` comment; `isOwnerViewing` comment; `settings/profile/page.tsx` comment (#58).
- `D-SHELL-5` — The homepage is unreachable once signed in: `/` redirects to the viewer's own profile or `/onboarding`. The 404 page still renders for a signed-in viewer, but its home link points to that same destination. Source: `signed-in-destination.ts` comment ("the design routes a signed-in visitor to their own public profile instead"); `not-found.tsx` comment; #58 (`e2e/db/happy-path.spec.ts` comment).

#### Findings

- `F-SHELL-1` — The seven auth screens render the same for signed-in viewers; nothing sends a signed-in person away from `/login` or `/register`, while `/` and the 404 link do route them (D-SHELL-5). Evidence: no session read in any `(auth)` page or form; the only navigation is `router.push` after success (`login-form.tsx`, `two-factor-challenge.tsx`). May be deliberate (switching accounts); no reason recorded.
- `F-SHELL-2` — Page titles follow no single pattern: `/register/verified` has no `generateMetadata`, so its tab shows only „Architektów 3d” (same as the homepage), the other auth screens name themselves („Logowanie”) without the brand, profile pages use „{name} · Architektów 3d”. Evidence: `register/verified/page.tsx`; `LocaleLayout` (title, no template); `profileMetadata`.
- `F-SHELL-3` — No screen for failure or for unmatched multi-segment addresses: no `error.tsx`/`global-error.tsx` although the profile page deliberately throws database/storage errors ("Everything else must surface as a 500", `[handle]/page.tsx` `lookup`); no catch-all route or `global-not-found`, so `/foo/bar` cannot reach `[locale]/not-found.tsx` (Next docs `not-found.md`: only a root `app/not-found.js` or `app/global-not-found.js` handles unmatched URLs, and `global-not-found` is the documented option when the root layout sits under a top-level dynamic segment). Unmatched multi-segment addresses get Next's default, unlocalized 404 page with no way back (§1 "never lost"). Observed on dev, §2 step 9. UNVERIFIED: the screen shown when the profile page throws.

## 3. Shared elements

### C-TOPBAR — top bar

- **Screenshots:** `v-home--desktop`, `v-home--phone`, `v-profile--desktop`, `v-profile--phone`, `v-profile--other-signed-in--desktop`, `v-profile-owner--desktop`, `v-profile-owner--phone`, `v-profile-edit--desktop`, `v-settings-account--desktop` (Appendix A)
- **Source:** `src/components/ui/top-bar.tsx` — `TopBar`; width class from `layout.ts` `measureWidthClass`.
- **Props:** `left` (node); `right?` (node); `mobileMenu?` (node shown instead of `right` below `sm`); `onPhoto?` (default `false`); `maxWidth?` `"measure-wide"` (default, 78rem) · `"measure-page"` (68rem) — must equal the page's `Footer` value.
- **Frame:** plain `<div>` (no `<header>`, no landmark, no skip link); `position: sticky; top: 0; z-index: 20`. Card surface with a hairline bottom border; `onPhoto` → transparent, no border. Inner row centred at the measure: height 56 px on phone / 64 px from `sm`; side gutters 16 px / 24 px; space-between, 12 px gap; left box `min-w-0` with 20 px gap; right box 12 px gap on phone / 20 px from `sm`. With `mobileMenu`: right box `hidden sm:flex`, menu wrapper `sm:hidden` (both copies are in the DOM, one displayed).
- **Coupling:** the homepage hero text uses the same gutter expressions so it starts at the logo's x (`top-bar.tsx` and `(public)/page.tsx` comments).

#### Variants actually rendered

| Page | Viewer | Screen | Left slot | Right slot | Collapses into MobileMenu? |
| --- | --- | --- | --- | --- | --- |
| Homepage `/` (`onPhoto`, `measure-wide`) | signed-out | desktop | `Logo` default size, `onPhoto` → `/` | LanguageChip `onPhoto` · „Zaloguj się” `ButtonLink` `onPhotoQuiet` → `/login` · „Załóż konto” `ButtonLink` `onPhoto` → `/register` | — |
| Homepage `/` | signed-out | phone | same | hamburger (`onPhoto` tone); panel: LanguageChip card tone · „Zaloguj się” `quiet` · „Załóż konto” `solid` | yes |
| Profile `/{handle}` (`measure-page`) | signed-out, no-handle, other — identical | desktop | `Logo` → `/` | LanguageChip · „Załóż konto” `ButtonLink` `quiet` → `/register` | — |
| Profile `/{handle}` | signed-out, no-handle, other | phone | same | hamburger; panel: LanguageChip · „Załóż konto” `quiet` | yes |
| Profile `/{handle}` (`measure-page`) | owner, view and edit | desktop and phone | `LogoMark` → `/{handle}` (own profile) | edit toggle (`Button` `quiet`) · AccountMenu | no — row at every width |
| Settings `/settings/account` (`measure-page`) | signed-in with handle | desktop and phone | `Logo` → `/{handle}` | AccountMenu („Profil” → `/{handle}`) | no |
| Settings `/settings/account` | no-handle | desktop and phone | `Logo` → `/` (→ 307 `/onboarding`) | AccountMenu („Profil” → `/` → 307 `/onboarding`) | no |
| Seven auth screens | anyone | both | no bar — compact, non-link Logo above the card (C-LOGO) | — | — |
| Onboarding | no-handle | both | no bar, no logo | — | — |
| 404 | anyone | both | no bar, no logo | — | — |

Confirmed from code: exactly two bars collapse (homepage, visitor profile); the LanguageChip appears only in those two bars; signed-in viewers of someone else's profile get the signed-out bar.

#### Elements

##### `TOPBAR.home.logo` — link

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d" (A3D mark beside it is `aria-hidden`)
- **Where:** left slot
- **Shown:** V-HOME, signed-out, desktop and phone
- **Does:** navigates to `/` (en `/en`) — the page itself
- **A11y:** link named by the wordmark; inverse focus ring
- **Tests:** none
- **Source:** `(public)/page.tsx` — `HomePage` (`<Logo href="/" onPhoto />`); C-LOGO

##### `TOPBAR.home.language` — button + options panel

- **Label:** C-LANGUAGE-CHIP
- **Where:** first item of the action row (desktop) / of the hamburger panel (phone)
- **Shown:** V-HOME, signed-out; desktop `onPhoto` tone; phone inside `TOPBAR.home.menu`, card tone
- **Does:** C-LANGUAGE-CHIP (`/` ↔ `/en`)
- **Tests:** `e2e/i18n.spec.ts` — `getByRole("button", { name: "Polski" })`, `getByRole("link", { name: "English" })`
- **Source:** `(public)/page.tsx` — `sessionActions`

##### `TOPBAR.home.log-in` — link

- **Label:** `Session.logIn` — pl „Zaloguj się” · en "Log in"
- **Where:** second item of the action row / panel
- **Shown:** V-HOME, signed-out; desktop `ButtonLink` `onPhotoQuiet` md; phone (panel) `quiet`
- **Does:** navigates to `/login` (en `/en/login`); inside the panel it also closes the panel
- **A11y:** link, name = label
- **Tests:** `e2e/login.spec.ts` "the homepage degrades…" and `e2e/db/happy-path.spec.ts` last step — `getByRole("link", { name: "Zaloguj się" })`
- **Source:** `(public)/page.tsx` — `sessionActions`

##### `TOPBAR.home.sign-up` — link

- **Label:** `Session.register` — pl „Załóż konto” · en "Sign up"
- **Where:** last item of the action row / panel
- **Shown:** V-HOME, signed-out; desktop `onPhoto` (white fill); phone (panel) `solid`
- **Does:** navigates to `/register` (en `/en/register`)
- **A11y:** link
- **Tests:** `e2e/db/happy-path.spec.ts` step "A11" — `getByRole("link", { name: "Załóż konto" })` click → URL `/register`; `e2e/login.spec.ts`
- **Source:** `(public)/page.tsx` — `sessionActions`

##### `TOPBAR.home.menu` — button (disclosure)

- **Label:** `MobileMenu.menuLabel` — pl „Menu główne” · en "Main menu"
- **Where:** right end, instead of the action row
- **Shown:** V-HOME, signed-out, phone only; `onPhoto` trigger tone
- **Does:** C-MOBILE-MENU; panel holds `TOPBAR.home.language`, `TOPBAR.home.log-in`, `TOPBAR.home.sign-up` in on-card variants
- **Tests:** none
- **Source:** `(public)/page.tsx` — `<MobileMenu onPhoto>{sessionActions(false)}</MobileMenu>`

##### `TOPBAR.visitor.logo` — link

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d"
- **Where:** left slot
- **Shown:** public profile; signed-out, no-handle, other; desktop and phone
- **Does:** navigates to `/` (en `/en`): the hero for signed-out; for a signed-in viewer `/` answers 307 to their own profile or `/onboarding`
- **A11y:** link; standard focus ring
- **Tests:** none
- **Source:** `(public)/[handle]/page.tsx` — `PublicProfilePage` (`<Logo href="/" />`)

##### `TOPBAR.visitor.language` — button + options panel

- **Label:** C-LANGUAGE-CHIP
- **Where:** first item of the row / of the panel
- **Shown:** signed-out, no-handle, other; desktop row and phone panel; card tone in both
- **Does:** C-LANGUAGE-CHIP — the same profile in the other locale (query dropped)
- **Tests:** none (the i18n spec covers the homepage only)
- **Source:** `(public)/[handle]/page.tsx` — `actions`

##### `TOPBAR.visitor.sign-up` — link

- **Label:** `Session.register` — pl „Załóż konto” · en "Sign up"
- **Where:** after the language chip
- **Shown:** signed-out, no-handle, other (a signed-in viewer sees it too — F-SHELL-5); `ButtonLink` `quiet` in both copies
- **Does:** navigates to `/register` (en `/en/register`)
- **A11y:** link
- **Tests:** none
- **Source:** `(public)/[handle]/page.tsx` — `actions`

##### `TOPBAR.visitor.menu` — button (disclosure)

- **Label:** `MobileMenu.menuLabel` — pl „Menu główne” · en "Main menu"
- **Where:** right end
- **Shown:** phone only; card-tone trigger
- **Does:** C-MOBILE-MENU; panel holds `TOPBAR.visitor.language`, `TOPBAR.visitor.sign-up`
- **Tests:** none
- **Source:** `(public)/[handle]/page.tsx` — `<MobileMenu>{actions}</MobileMenu>`

##### `TOPBAR.owner.logo` — link

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d" (read client-side, `useTranslations("Brand")`)
- **Where:** left slot
- **Shown:** owner, view and edit, desktop and phone
- **Does:** navigates to `/{handle}` (en `/en/{handle}`) — the page the owner is on. In edit mode the leave guard does not ask (same pathname and query — `use-leave-guard.ts` click handler returns early). UNVERIFIED: whether this same-URL navigation keeps edit mode, scroll position and history unchanged.
- **A11y:** link; standard focus ring
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `OwnerProfileView` (`<LogoMark href={`/${profile.handle}`} wordmark={wordmark} />`)

##### `TOPBAR.owner.edit-toggle` — button

- **Label:** idle `PublicProfile.editProfile` — pl „Edytuj profil” · en "Edit profile" (pencil icon); editing `PublicProfile.saveProfile` — pl „Zapisz” · en "Save" (check icon); busy `PublicProfile.savingProfile` — pl „Zapisywanie…” · en "Saving…" (check icon)
- **Where:** right slot, before the account menu
- **Shown:** owner, view and edit, desktop and phone
- **Enabled:** disabled while leaving edit mode is in progress (`leaving`)
- **Does:** view → edit: `editing = true`, hides the saved notice, clears the name, avatar, cover, headline, bio, places and works-order errors, arms the leave guard (V-PROFILE-EDIT). Edit → view: runs the exit sequence specified in V-PROFILE-EDIT; success → `editing = false`, status line `PublicProfile.savedProfile` pl „Zapisano profil” · en "Profile saved" in the card (2.5 s), `router.refresh()`; a failed save or a work form that must stay open → editing stays on, label back to „Zapisz”.
- **States:** idle / editing / busy as in Label; failures are reported by the fields, not the button
- **Input:** mouse, touch, keyboard Enter/Space (native button)
- **A11y:** `<button type="button">`; name = visible label (icon `aria-hidden`); `aria-busy="true"` only while busy; no `aria-pressed` (D-SHELL-7)
- **Tests:** `getByRole("button", { name: "Edytuj profil" })` in `e2e/db/happy-path.spec.ts`, `profile-sections.spec.ts`, `leave-guard.spec.ts`, `works.spec.ts`, `works-order.spec.ts`, `avatar-upload.spec.ts`, `lightbox.spec.ts`; `getByRole("button", { name: "Zapisz", exact: true })` in happy-path, profile-sections, leave-guard, works, lightbox; `getByRole("button", { name: "Zapisywanie…" })` in `works.spec.ts`; absent for a visitor in `profile-sections.spec.ts`
- **Source:** `owner-profile-view.tsx` — `OwnerProfileView` (TopBar `right`), `toggleEditing`, `clearErrors`

##### `TOPBAR.owner.account-menu` — menu button

- **Label:** `AccountMenu.menuLabel` — pl „Menu konta” · en "Account menu"
- **Where:** right end, after the edit toggle
- **Shown:** owner, view and edit, desktop and phone
- **Does:** C-ACCOUNT-MENU with `handle` = `profile.handle`, avatar = `profile.avatar.url128`, monogram name = `profile.displayName` (the server's copy: a name saved in edit mode shows in the monogram only after the next refresh)
- **Tests:** `e2e/db/happy-path.spec.ts`, `e2e/db/leave-guard.spec.ts` (C-ACCOUNT-MENU)
- **Source:** `owner-profile-view.tsx` — `OwnerProfileView`

##### `TOPBAR.settings.logo` — link

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d"
- **Where:** left slot
- **Shown:** signed-in on `/settings/account`, desktop and phone
- **Does:** handle → `/{handle}`; no handle → `/` (→ 307 `/onboarding`)
- **A11y:** link; standard focus ring
- **Tests:** none
- **Source:** `settings/account/page.tsx` — `AccountSettingsPage`

##### `TOPBAR.settings.account-menu` — menu button

- **Label:** `AccountMenu.menuLabel` — pl „Menu konta” · en "Account menu"
- **Where:** right end (only item)
- **Shown:** signed-in on `/settings/account`
- **Does:** C-ACCOUNT-MENU with `handle ?? ""` (no handle → „Profil” goes to `/` → 307 `/onboarding`), avatar from `getProfile(...).avatar.url128`, monogram name `profile.displayName ?? session.user.email`
- **Tests:** none on this page
- **Source:** `settings/account/page.tsx` — `AccountSettingsPage`

#### Flows and rules

- The bar is identical in view and edit mode except the toggle's label; it never hides on scroll.
- Popovers opened from the bar (account menu, language chip, hamburger panel) are `z-index: 10` inside the bar's stacking context; the leave dialog is `z-index: 50`.
- Signed-in viewers reach their own profile from any bar: the owner/settings logo directly, the visitor/homepage logo through the `/` redirect.

#### Decisions

- `D-SHELL-6` — Only a bar whose actions do not fit a phone collapses into a hamburger: the homepage (chip + two buttons) and the visitor profile (393 px needed vs 328 px on a 360 px screen); other bars keep their row. Source: `top-bar.tsx`, `mobile-menu.tsx` comments; `(public)/[handle]/page.tsx` comment (measurement).
- `D-SHELL-7` — The edit control is a quiet button with an icon and a label, not a bare pencil; the label carries the state, so no `aria-pressed` ("a toggle whose name changes would read 'Zapisz, pressed'"). Source: `owner-profile-view.tsx` comment, "decision of 08.09.2026".

#### Findings

- `F-SHELL-4` — The language switcher exists only on the homepage and the visitor view of a profile. Owner profile, settings, onboarding, the seven auth screens and the 404 have none, and the footer has none; a signed-in person can switch only on someone else's profile or by editing the URL (the homepage redirects them away). A8 requires a switcher. Evidence: `<LanguageChip` only in `(public)/page.tsx` and `(public)/[handle]/page.tsx`; `footer.tsx` comment "the top bar's LanguageChip is the only switcher".
- `F-SHELL-5` — The visitor bar is the signed-out bar for every non-owner: a signed-in `other` or `no-handle` viewer is offered „Załóż konto” and has no account menu (way back only via the logo's `/` redirect); and nobody is offered „Zaloguj się” on a profile — an owner whose session ended lands on their own profile with a sign-up button only, while the homepage bar offers both. Evidence: `[handle]/page.tsx` `isOwnerViewing` → `actions` (chip + `Session.register`), comment "This screen is the signed-out visitor's view"; the width comment there explains the hamburger, not the missing log-in.
- `F-SHELL-6` — Onboarding has no bar, logo or account menu: a no-handle user cannot sign out or reach settings from the UI (the handle step offers only „Wstecz”); `/settings/account` is reachable only by typing it or from the `/email-changed` link. Evidence: `onboarding/page.tsx`, `onboarding-steps.tsx`, `handle-form.tsx` (no links). May be deliberate (one step, #15/#36); no reason recorded for the missing exit.
- `F-SHELL-7` — The owner bar does not collapse on the premise that profile bars "carry one or two icon-sized actions that fit a phone fine", but since 08.09.2026 its edit toggle is a labelled button. Estimate ≈ 361 px (logo 160 + 12 + „Edytuj profil” ≈ 147 + 12 + avatar 30) vs 328 px on a 360 px phone and 358 px on 390 px; with the left box `min-w-0` the overflow would show as the wordmark under the button, as the visitor bar's comment reports for its own case. Evidence: `top-bar.tsx` `mobileMenu` doc, `mobile-menu.tsx` comment, owner TopBar. Observed on dev (12.09.2026): at 390 px the Polish bar still fits, with little room to spare (screenshot `v-profile-owner--phone`). UNVERIFIED: 360 px, and English.
- `F-SHELL-8` — Bars are not landmarks and sit inconsistently: plain `<div>`, no `<header>`/banner and no skip link anywhere; on the homepage the bar is inside `<main>`, on profile and settings pages it precedes `<main>`. Evidence: `top-bar.tsx`; `(public)/page.tsx` vs `[handle]/page.tsx`, `settings/account/page.tsx`.
- `F-SHELL-9` — Comments that contradict the code (do not rely on them): "This is the only bar in the product that collapses into a hamburger" (`(public)/page.tsx`) and "Only the homepage hero needs one" (`mobile-menu.tsx`) — the visitor profile bar collapses too; `TopBar` `mobileMenu` doc "what the profile and settings bars want"; `use-dismissable.ts` "shared by AccountMenu and LanguageChip" (MobileMenu too); `src/components/ui/icon.tsx` "the two icons this design actually uses" (21 exist); `brand-mark.tsx` "Three route files use it — … and the share card" (`/api/og` draws a monogram); `[handle]/page.tsx` "public/og-placeholder.png" (no such file); `public-profile.ts` "monogram card (1200×630…)" (`MONOGRAM_CARD` is 512×512); `globals.css` "the product ships no font binaries" (`public/figtree-bold.ttf`).

### C-ACCOUNT-MENU — account menu

- **Screenshots:** `c-account-menu--open--desktop` (Appendix A)
- **Source:** `src/components/ui/account-menu.tsx` — `AccountMenu` (client component)
- **Props:** `handle` (string; `""` allowed), `avatarUrl` (string | null), `displayName` (monogram source)
- **Rendered in:** `TOPBAR.owner.account-menu`, `TOPBAR.settings.account-menu` only
- **State:** `open`, `signingOut`, `signOutFailed` — local to the instance
- **Server calls:** `authClient.signOut()` (`src/lib/auth-client.ts`, Better Auth) → `POST /api/auth/sign-out`

#### Elements

##### `ACCOUNT-MENU.bar.trigger` — button

- **Label:** `AccountMenu.menuLabel` — pl „Menu konta” · en "Account menu" (`aria-label` and `title`); visible content: `Avatar` 30 px — photo (`avatarUrl`, `alt=""`) or monogram of `displayName` (`aria-hidden`)
- **Where:** right end of the bar
- **Shown:** owner (profile, view and edit); signed-in on `/settings/account`
- **Does:** toggles `ACCOUNT-MENU.panel.menu`
- **Input:** mouse, touch, keyboard Enter/Space
- **A11y:** `aria-haspopup="menu"`, `aria-expanded`; round focus-visible ring; no `aria-controls`
- **Tests:** `e2e/db/happy-path.spec.ts`, `e2e/db/leave-guard.spec.ts` — `getByRole("button", { name: "Menu konta" })`
- **Source:** `account-menu.tsx` — `AccountMenu`

##### `ACCOUNT-MENU.panel.menu` — menu

- **Label:** `aria-label` `AccountMenu.menuLabel` — pl „Menu konta” · en "Account menu"
- **Where:** under the trigger, right-aligned, 170 px wide; card surface, default border, `shadow-md`
- **Shown:** while open
- **Does:** holds, in order: `ACCOUNT-MENU.panel.profile`, `ACCOUNT-MENU.panel.account`, a divider (`<hr>`), `ACCOUNT-MENU.panel.log-out`, `ACCOUNT-MENU.panel.error`
- **Input:** closes on trigger click, Escape, pointer press outside (C-DISMISSABLE), click on „Profil” or „Konto”; not on „Wyloguj”
- **A11y:** `<nav role="menu">`; no focus moved in, no arrow keys (F-SHELL-13)
- **Tests:** via its items
- **Source:** `account-menu.tsx` — `AccountMenu`

##### `ACCOUNT-MENU.panel.profile` — menu item (link)

- **Label:** `AccountMenu.profile` — pl „Profil” · en "Profile" (user icon)
- **Where:** first item
- **Shown:** while open
- **Does:** navigates to `/{handle}` (en `/en/{handle}`); `handle = ""` → `/` → 307 `/onboarding`; closes the panel. On the owner's own page it is the current URL (no leave dialog in edit mode).
- **A11y:** `<a role="menuitem">`
- **Tests:** none
- **Source:** `account-menu.tsx` — `AccountMenu`

##### `ACCOUNT-MENU.panel.account` — menu item (link)

- **Label:** `AccountMenu.account` — pl „Konto” · en "Account" (settings icon)
- **Where:** second item
- **Shown:** while open
- **Does:** navigates to `/settings/account` (en `/en/settings/account`); closes the panel. In profile edit mode the leave guard intercepts and opens the leave dialog; „Wyjdź” follows the link (V-PROFILE-EDIT).
- **A11y:** `<a role="menuitem">`
- **Tests:** `e2e/db/happy-path.spec.ts` — `getByRole("menuitem", { name: "Konto" })` visible; `e2e/db/leave-guard.spec.ts` — click → `getByRole("alertdialog")` → „Wyjdź” → URL `/settings/account`
- **Source:** `account-menu.tsx` — `AccountMenu`

##### `ACCOUNT-MENU.panel.log-out` — menu item (button)

- **Label:** idle `Session.logOut` — pl „Wyloguj” · en "Log out"; busy `Session.loggingOut` — pl „Wylogowywanie…” · en "Logging out…" (log-out icon)
- **Where:** after the divider
- **Shown:** while open
- **Enabled:** disabled while busy (text turns `--text-subtle`)
- **Does:** clears the error, `authClient.signOut()`; success → `router.push("/")` (en `/en`) → V-HOME hero; returned `error` or thrown → `ACCOUNT-MENU.panel.error`. Busy ends in `finally`, before the navigation completes (UNVERIFIED: label flashes back to „Wyloguj”). Does not close the panel.
- **States:** idle / busy / error
- **A11y:** `<button role="menuitem">`
- **Tests:** `e2e/db/happy-path.spec.ts` — `getByRole("menuitem", { name: "Wyloguj" })` click → links „Załóż konto”, „Zaloguj się” visible
- **Source:** `account-menu.tsx` — `handleLogOut`

##### `ACCOUNT-MENU.panel.error` — alert

- **Label:** `Session.error` — pl „Nie udało się wylogować. Spróbuj ponownie.” · en "Logging out failed. Try again."
- **Where:** bottom of the panel
- **Shown:** after a failed sign-out, while the panel is open; reappears on every reopening until the next attempt (F-SHELL-10)
- **A11y:** `<p role="alert">` inside `role="menu"`
- **Tests:** none
- **Source:** `account-menu.tsx` — `signOutFailed`

#### Flows and rules

- Focus: opening keeps focus on the trigger; Tab walks trigger → „Profil” → „Konto” → „Wyloguj”; no arrow-key movement; Escape or an outside press closes without moving focus (focus on an item is lost with the panel).
- In profile edit mode (leave guard, V-PROFILE-EDIT): pressing the trigger blurs the focused field, which starts its save-on-blur; „Profil” asks nothing; „Konto” asks; „Wyloguj” asks nothing (F-SHELL-11).
- After sign-out the destination `/` is rendered per request, so the hero shows for the now signed-out viewer (e2e happy-path).

#### Findings

- `F-SHELL-10` — A failed sign-out's message outlives its attempt: `signOutFailed` is reset only when the next sign-out starts, so closing and reopening the menu shows „Nie udało się wylogować…” again. Evidence: `account-menu.tsx` `handleLogOut`.
- `F-SHELL-11` — Signing out during profile edit mode is not asked about: „Wyloguj” is a button that calls `router.push("/")`, while the leave guard intercepts only `a[href]` clicks, back/forward and `beforeunload`. An open work form and its uploads are dropped without the dialog; the field save started by the trigger's blur may race the sign-out, and the guard's extra history entry may stay behind (both UNVERIFIED). Evidence: `account-menu.tsx` `handleLogOut`; `use-leave-guard.ts` `onClick`. May be deliberate (explicit action); #83 says leaving mid-edit asks.

### C-MOBILE-MENU — hamburger panel

- **Screenshots:** `v-home--phone--menu-open`, `v-profile--phone--menu-open` (Appendix A)
- **Source:** `src/components/ui/mobile-menu.tsx` — `MobileMenu` (client component)
- **Props:** `children` (the bar's actions in on-card variants); `onPhoto?` (tones the trigger only; the panel is always a card)
- **Rendered in:** `TopBar` `mobileMenu` slot of V-HOME (`onPhoto`) and of the visitor profile; displayed below `sm` only (TopBar wraps it in `sm:hidden`)

#### Elements

##### `MOBILE-MENU.bar.trigger` — button (disclosure)

- **Label:** `MobileMenu.menuLabel` — pl „Menu główne” · en "Main menu" (`aria-label` and `title`); hamburger icon 22 px
- **Where:** right end of the bar
- **Shown:** phone; homepage (white icon, 10 % white hover, inverse focus ring) and visitor profile (body colour, hover tint, standard ring)
- **Does:** toggles `MOBILE-MENU.panel.nav`
- **Input:** mouse, touch, keyboard Enter/Space
- **A11y:** `aria-haspopup="true"`, `aria-expanded`; 40×40 px; no `aria-controls`
- **Tests:** none
- **Source:** `mobile-menu.tsx` — `MobileMenu`

##### `MOBILE-MENU.panel.nav` — navigation panel

- **Label:** `aria-label` `MobileMenu.menuLabel` — pl „Menu główne” · en "Main menu"
- **Where:** under the trigger, right-aligned, 15rem wide; column, 8 px gaps, 12 px padding, card surface, border, `shadow-md`; children stretch to the panel width
- **Shown:** while open
- **Does:** shows the bar's actions (C-TOPBAR table); closes on trigger click, Escape, pointer press outside, and any click whose target is inside an `<a>` (log-in, sign-up, a language option); a click on a `<button>` inside (the language chip's trigger) keeps it open
- **A11y:** `<nav>` (not `role="menu"`, D-SHELL-8); no focus management
- **Tests:** none
- **Source:** `mobile-menu.tsx` — `MobileMenu` (`onClick` with `closest("a")`)

#### Flows and rules

- Nested chip: the chip's own panel opens inside the hamburger panel. A press inside the chip (trigger or options) keeps both open. A press anywhere else in the hamburger panel closes only the chip's panel; a click on a link there then closes the hamburger too. Escape, or a press outside the hamburger, closes both at once. Choosing a language closes both.

#### Decisions

- `D-SHELL-8` — The panel is a named `<nav>`, not `role="menu"`, because it holds whatever the bar shows (links, buttons, a nested chip); it closes on a link click, not on the chip's button. Source: `mobile-menu.tsx` comments.

### C-LANGUAGE-CHIP — language switcher

- **Screenshots:** `v-home--desktop--language-open` (Appendix A)
- **Source:** `src/components/ui/language-chip.tsx` — `LanguageChip`, `Flag` (client component)
- **Props:** `locale` (current locale); `onPhoto?` (white text, 10 % white hover; else body text, hover tint)
- **Rendered in:** `TOPBAR.home.language`, `TOPBAR.visitor.language` — nowhere else (F-SHELL-4)
- **Flags:** drawn SVG on a 60×30 field stretched to 20×14 px with a 1 px border, `aria-hidden`: `pl` white over `#dc143c`; `en` Union Jack (`#012169`, `#ffffff`, `#c8102e`, counterchanged saltire; clip id from `useId`)

#### Elements

##### `LANGUAGE-CHIP.bar.trigger` — button (disclosure)

- **Label:** the current locale's name — `LanguageSwitcher.pl` pl „Polski” · en "Polski"; `LanguageSwitcher.en` pl „English” · en "English"; flag before, chevron after (both `aria-hidden`)
- **Where:** first item of its row or panel
- **Shown:** V-HOME (signed-out); visitor profile (signed-out, no-handle, other); desktop and phone
- **Does:** toggles `LANGUAGE-CHIP.panel.option` list
- **Input:** mouse, touch, keyboard Enter/Space
- **A11y:** `aria-haspopup="menu"`, `aria-expanded`; no `aria-label`, `title` or `aria-controls` (name is only the language name); height 40 px; no focus style of its own (browser default)
- **Tests:** `e2e/i18n.spec.ts` — `getByRole("button", { name: "Polski" })`
- **Source:** `language-chip.tsx` — `LanguageChip`

##### `LANGUAGE-CHIP.panel.option` — link (one per locale)

- **Label:** `LanguageSwitcher.pl` „Polski” / `LanguageSwitcher.en` "English", each with its flag; list container `<nav aria-label>` `LanguageSwitcher.label` — pl „Wybór języka” · en "Language selection"
- **Where:** dropdown under the trigger, right-aligned, at least the trigger's width; order `pl`, `en`
- **Shown:** while open
- **Does:** navigates to the current path in that locale (Flows); closes the chip panel (and the hamburger panel)
- **States:** the current locale carries `aria-current="true"` (no visual difference)
- **A11y:** `lang` and `hrefLang` = option's locale; no focus style of its own
- **Tests:** `e2e/i18n.spec.ts` — `getByRole("link", { name: "English" })` → URL `/en`, `html[lang="en"]`, cookie `NEXT_LOCALE=en`, next visit to `/` → `/en`
- **Source:** `language-chip.tsx` — `LanguageChip`

#### Flows and rules

- **Target URL:** next-intl `usePathname()` = browser path without the locale prefix; each option is `<Link href={pathname} locale={l}>`, and next-intl forces a prefix whenever `locale` is passed (`createSharedNavigationFns` `forcePrefix`). Options therefore point to `/pl{path}` and `/en{path}` (`/` → `/pl`, `/en`; `/studio-praga` → `/pl/studio-praga`, `/en/studio-praga`). Query string and hash are not carried (F-SHELL-12).
- **Other locale chosen:** next-intl `LocaleChangingLink` writes `NEXT_LOCALE=<new>; SameSite=Lax; path=/` (no `Max-Age`) into `document.cookie`, then Next navigates client-side (`prefetch` off). `en` → renders at `/en/...`; `pl` → `/pl/...` answered 307 by the middleware → unprefixed path.
- **Current locale chosen:** plain navigation, no cookie write; `pl` still hops `/pl…` → 307 → same page.
- **Afterwards:** the middleware sends every unprefixed address to the chosen locale while the cookie lives (browser session).

#### Decisions

- `D-SHELL-9` — Collapsed, the chip shows only the current language (drawn flags, not emoji) and opens to the list; it is the product's only switcher (no footer switcher). Source: `language-chip.tsx` and `footer.tsx` comments (design-system-source).

#### Findings

- `F-SHELL-12` — The switch follows different rules from the rest of routing: it keeps only the path (query and hash dropped), while the proxy's 301 and the page's 308s keep the query on purpose; the choice is a session cookie (next-intl 4 default, `routing.ts` sets no `localeCookie`), forgotten when the browser session ends; and opening any `/en/...` link from a Polish browser sets the same cookie, after which unprefixed Polish links redirect to English for the session. Evidence: `language-chip.tsx` (`usePathname`); `[handle]/page.tsx` `queryOf` comment; next-intl `receiveLocaleCookie`, `syncCookie`. May be deliberate (library defaults); no decision recorded.

### C-DISMISSABLE — popover dismissal

- **Source:** `src/components/ui/use-dismissable.ts` — `useDismissable(open, containerRef, onDismiss)`
- **Used by:** `AccountMenu`, `LanguageChip`, `MobileMenu`; container = the component's `relative` wrapper around trigger and panel

#### Flows and rules

- Listeners exist only while `open`: `document` `pointerdown` and `keydown`.
- `pointerdown` outside the container → dismiss (mouse, touch or pen; a touch starting a scroll outside counts). A press on the trigger is inside; the trigger's own click then toggles.
- `Escape` anywhere → dismiss, wherever focus is; every open popover closes at once (nested chip + hamburger panel). No `preventDefault`/`stopPropagation`.
- Nothing else dismisses: not focus leaving (Tab), scroll, resize or window blur; navigation closes by unmounting (plus the item click handlers above).
- No focus handling: focus is neither moved into the popover on open nor returned to its trigger on dismiss.

#### Findings

- `F-SHELL-13` — Popovers fall short of their declared roles. The hook claims "the interactions ARIA authoring practices expect" but no popover moves focus in or returns it to the trigger, and Tab out leaves it open. `AccountMenu` declares `role="menu"`/`menuitem` without arrow-key, Home/End navigation and holds a non-item child (`<p role="alert">`). `LanguageChip` (`aria-haspopup="menu"`) and `MobileMenu` (`aria-haspopup="true"`, which ARIA equates with `menu`) open a `<nav>` of links — `mobile-menu.tsx` itself says that panel must not be a menu. The chip trigger and its options have no focus style of their own, and neither do the account menu's items (`itemClass`) or the V-TWO-FACTOR method pills (`MODE_PILL`). Buttons, text links, fields, the logo and the other popover triggers use `--ring-focus`. No trigger has `aria-controls`. Evidence: `use-dismissable.ts`, `account-menu.tsx`, `language-chip.tsx`, `mobile-menu.tsx`.

### C-LOGO — brand mark and wordmark

- **Screenshots:** `v-profile--desktop` (Appendix A)
- **Sources:** `src/components/ui/logo.tsx` — `Logo` (async server component, reads `Brand.wordmark` via `getTranslations`); `logo-mark.tsx` — `LogoMark` (presentational; used directly by the client owner view); `mark.tsx` — `Mark`
- **`Mark`:** square 30 px (26 px compact), `bg-plaque-navy`, red band on the bottom 12 %, "A3D" white bold at 34 % of the side, radius 4 px; `aria-hidden`
- **`LogoMark` props:** `href?`, `wordmark`, `onPhoto?`, `size?` `"default"` · `"compact"`
  - `default`: 30 px mark + `type-h3` wordmark; `compact`: 26 px mark + `type-h4`
  - `onPhoto`: wordmark `--text-on-photo`, inverse focus ring; else `--text-strong`, standard ring
  - `href` given → next-intl `Link` (locale form added) with focus ring; omitted → `<span>`, not focusable, not a link
  - one line (`whitespace-nowrap`); gap 8 px on phone, 12 px from `sm`
- **Wordmark copy:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d"

| Where | Component · variant | Link target |
| --- | --- | --- |
| Homepage bar | `Logo` default, `onPhoto` | `/` (the page itself) |
| Visitor profile bar | `Logo` default | `/` (signed-in viewers → 307 own profile / `/onboarding`) |
| Owner profile bar | `LogoMark` default | `/{handle}` — the owner's own profile |
| Settings bar | `Logo` default | `/{handle}`, or `/` without a handle (→ 307 `/onboarding`) |
| Seven auth screens, above the card | `Logo` compact | none (`<span>`) |
| Onboarding, 404 | — | — |

#### Elements

##### `LOGO.mark.link` — link (or static text without `href`)

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d"; the A3D mark is not announced
- **Where:** a bar's left slot, or centred above an auth card
- **Shown:** per the table above
- **Does:** navigates to the target in the table; the compact auth variant does nothing
- **A11y:** link named by the wordmark; focus ring (inverse on the photo); the `<span>` variant is skipped by keyboard and screen reader
- **Tests:** none select the logo
- **Source:** `logo.tsx` — `Logo`; `logo-mark.tsx` — `LogoMark`; `mark.tsx` — `Mark`

#### Decisions

- `D-SHELL-10` — The logo above the auth cards is not a link ("a visitor part-way through making an account is not offered a way out of the view", #66); in bars it leads to the hero for a signed-out visitor and to the viewer's own profile once signed in. Source: `logo-mark.tsx`, `logo.tsx` comments.

### C-FOOTER — page footer

- **Screenshots:** `v-profile--desktop` (Appendix A)
- **Source:** `src/components/ui/footer.tsx` — `Footer` (async server component)
- **Props:** `maxWidth?` — same values as `TopBar`; the page passes the bar's value so the company line sits under the logo
- **Content:** `<footer>` (contentinfo) with hairline top border on the page tint; column with the bar's gutters (16/24 px), vertical padding 24 px / 32 px from `sm`:
  - `Footer.company` — pl „Architectorium Sp. z o.o.” · en "Architectorium Sp. z o.o." (`type-label`, strong)
  - `Footer.copyright` — pl „© 2026” · en "© 2026" (`type-sm`, `--text-muted` for AA per comment; the year is fixed copy)
- **No** links, no language switcher (D-SHELL-9).
- **Rendered on:** V-HOME (`measure-wide`, after `<main>`); visitor and owner profile (`measure-page`, from `[handle]/page.tsx`). Not on settings, onboarding, the auth screens or the 404.
- **Tests:** none

### C-PLAQUE — street-sign graphic

- **Screenshots:** `v-profile--desktop` (Appendix A)
- **Source:** `src/components/ui/plaque.tsx` — `Plaque` (pure render, no `"use client"`)
- **Props:** `name?` (default literal „Architektów”), `footer?` (default literal "Architektów 3d"), `width?` (320 px), `tilt?` (0°), `shadow?` (true → `--shadow-plaque`), `className?`
- **Render:** `u = width / 320`. Navy field (`--plaque-navy`, padding `22u` top, `8u` bottom, 16 px sides, min height `84u`) with the name bottom-aligned and centred in `--font-plaque` regular, one line (`nowrap`, overrun clipped); red band (`--plaque-red`) with `footer` at `18u` px medium; frame border `max(1, 2u)` px white 55 %; radius `2u`; text `--plaque-ink`.
- **Name size:** `min(54, max(18, 680 / max(5, length))) · u`, capped at `(width − 2·border − 32) / (length · 0.46)` — no minimum (at width 150: ≈ 12.6 px for 20 characters, below 10 px past ~25, ≈ 3 px for 80).
- **Where and with what name:**
  - visitor profile: after `<main>`, centred, above the footer; `name = profile.displayName`; width 150; no shadow.
  - owner profile: same place; `name = fields.name` — live value of the name field, so it follows typing in edit mode (an emptied field gives an empty navy field); width 150; no shadow.
  - onboarding: beside the card from `md` (below it on smaller screens); `name` = the trimmed name being typed, or the default „Architektów” while empty (both locales); width 260; shadow on; caption `Onboarding.plaqueCaption` below (onboarding part).
- **A11y:** no role, no `aria-hidden` — read as text.
- **Tests:** none

#### Decisions

- `D-SHELL-11` — The plaque keeps the name on one line at any length (size derived from length, overrun clipped) with fixed 16 px side padding. Source: `plaque.tsx` comments (port of design-system-source `Plaque.jsx`, "ground truth"; padding "per Dawid's review of screen 2").

#### Findings

- `F-SHELL-14` — Visible strings outside the dictionaries (A8): `Plaque` defaults `name = "Architektów"` (shown on onboarding in English too) and `footer = "Architektów 3d"` (duplicates `Brand.wordmark`); "A3D" lettering in `Mark` and `BrandMark`; `[locale]/opengraph-image.alt.txt` „ul. Architektów 3d, Stara Ochota” served for `en`; `/api/og` 404 bodies "Not found"/"Not configured". The mark's lettering may be deliberate (a logo). Evidence: the named files.
- `F-SHELL-15` — The plaque repeats content yet is exposed to assistive technology: a screen reader reads the display name and "Architektów 3d" again after the works (on onboarding, the typed name); and its name size has no floor, so long names (A4 allows 80 characters) become unreadable. Evidence: `plaque.tsx` (no `aria-hidden`, `size` formula); `[handle]/page.tsx`, `owner-profile-view.tsx`. UNVERIFIED: rendered sizes.

## 4. Homepage and not found

### V-HOME — homepage

- **Screenshots:** `v-home--desktop`, `v-home--desktop--en`, `v-home--phone` (Appendix A)
- **Route:** `/` (en `/en`) — `src/app/[locale]/(public)/page.tsx` (`force-dynamic`)
- **Reached by:** signed-out viewers (incl. an unverifiable session). Signed-in with handle → 307 `/{handle}`; no-handle → 307 `/onboarding` (`signedInDestination`).
- **Purpose:** A11 entry — full-screen photo with the product promise and the ways to sign up and log in.
- **Arrives from → leaves to:** direct visits; `TOPBAR.home.logo`, `TOPBAR.visitor.logo`; „Przejdź na stronę główną” on `/register/verified`; `404.panel.home` (signed-out); sign-out (`router.push("/")`) → `/register` (`TOPBAR.home.sign-up`, `HOME.hero.cta-primary`), `/login` (`TOPBAR.home.log-in`, `HOME.hero.cta-secondary`), the other locale (`TOPBAR.home.language`).
- **Layout (top → bottom):**
  - `<main>` at least the viewport height (`min-h-svh`), own stacking context:
    - photo `/hero-facade-plaque.webp` covering the whole `<main>` behind everything; `alt=""`, `aria-hidden`, `fetchPriority="high"`; crop `object-position` 90 % 40 % on phone, 70 % 40 % from `sm`
    - scrim wrapper (ancestor of all text): `linear-gradient(180deg, rgba(12,17,22,.62) 0%, rgba(12,17,22,.3) 32%, rgba(12,17,22,.75) 100%)`
      - C-TOPBAR `onPhoto`, `measure-wide` (phone: hamburger)
      - hero column at the bar's measure and gutters, block max 44rem, gaps 16 px phone / 24 px from `sm`:
        - `<h1>` `HomePage.heading` — pl „Twoje portfolio pod dobrym adresem.” · en "Your portfolio, at a good address." (`type-hero`, white, balanced; size `--fs-display` on phone, `--fs-hero` from `sm`)
        - `<p>` `HomePage.lead` — pl „Sceny 3D w internecie w kilka minut. Publiczne profile dla architektów i artystów.” · en "3D scenes online in minutes. Public profiles for architects and artists." (`type-lead`, white 86 %, max 30rem)
        - CTA group: `HOME.hero.cta-primary`, `HOME.hero.cta-secondary` — phone: stacked, full width, 12 px apart; from `sm`: in a row, wrapping
      - placement: bottom-aligned with 64 px vertical padding; from `sm` with a viewport at least 44rem tall, vertically centred
  - C-FOOTER `measure-wide` (below the first screen)
- **Server calls:** none from the browser. Per request the server reads the session and, when signed in, the handle (`signedInDestination`).

#### Elements

Bar elements: `TOPBAR.home.logo`, `TOPBAR.home.language`, `TOPBAR.home.log-in`, `TOPBAR.home.sign-up`, `TOPBAR.home.menu`.

##### `HOME.hero.cta-primary` — link

- **Label:** `HomePage.ctaPrimary` — pl „Zamelduj się” · en "Check in"
- **Where:** first button under the lead
- **Shown:** V-HOME, signed-out; full width on phone, content width from `sm`
- **Does:** navigates to `/register` (en `/en/register`)
- **A11y:** link; `ButtonLink` `onPhoto` `lg` (48 px); inverse focus ring
- **Tests:** none by label
- **Source:** `(public)/page.tsx` — `HomePage`

##### `HOME.hero.cta-secondary` — link

- **Label:** `HomePage.ctaSecondary` — pl „Jestem zameldowany” · en "I'm already checked in"
- **Where:** after the primary (below it on phone)
- **Shown:** V-HOME, signed-out
- **Does:** navigates to `/login` (en `/en/login`)
- **A11y:** link; `ButtonLink` `onPhotoQuiet` `lg`; inverse focus ring
- **Tests:** none by label
- **Source:** `(public)/page.tsx` — `HomePage`

#### Flows and rules

- Rendered per request: the signed-in redirect and the absolute share-image address depend on the request (`force-dynamic` comment).
- `<title>`/description: layout defaults; share image `[locale]/opengraph-image.jpg`.
- Tests: `e2e/i18n.spec.ts` (title „Architektów 3d”, `html[lang]`, h1 and lead in pl and en, `/pl` → `/`, Accept-Language → `/en`); `e2e/a11y.spec.ts` (axe `landing-pl`, `landing-en`, with the named gradient exception in `e2e/axe.ts`); `e2e/login.spec.ts` (entry links without a backend, photo decoded, no `img` role inside `<main>`); `e2e/db/happy-path.spec.ts` (sign-up link → `/register`; signed-in `/` → own profile); `e2e/profile.spec.ts` (`X-Robots-Tag` on `/`).

#### Decisions

- `D-SHELL-12` — Hero: the photo is decorative and the scrim gradient sits on an ancestor of the text so axe can evaluate it (worst case measured 5.6:1 at the bar, 9.4:1 at the hero text; axe exception scoped to these pages); crop set per shape so the street plaque stays in frame; `svh` height so the CTAs clear the address bar; CTAs stacked full width and the heading one size down below `sm`. Source: `(public)/page.tsx` comments; `e2e/axe.ts` `GRADIENT_HERO_PAGES` comment; A11 (design open, §12).

#### Findings

- `F-SHELL-16` — The homepage names each destination twice with different words: `/register` is „Załóż konto” in the bar and „Zamelduj się” in the hero; `/login` is „Zaloguj się” and „Jestem zameldowany” (§1: "never has to guess"). May be deliberate (the address/check-in metaphor of the street sign); e2e drives only the bar's labels. Evidence: `(public)/page.tsx`; `HomePage.ctaPrimary`, `ctaSecondary`; `Session.logIn`, `register`.

### V-404 — not found

- **Screenshots:** `v-404--desktop`, `v-404--phone` (Appendix A)
- **Route:** the requested URL is kept (e.g. `/some-profile`, `/en/some-profile`, `/admin`) — `src/app/[locale]/not-found.tsx` `NotFoundPage`
- **Reached by:** anyone requesting a single-segment address that is unknown, reserved or not handle-shaped; an old handle whose target has no handle; a profile deleted mid-request; any profile address when `DATABASE_URL` is missing. HTTP 404. (Unmatched multi-segment URLs: F-SHELL-3.)
- **Purpose:** say the address leads nowhere and offer one way back.
- **Arrives from → leaves to:** typed or shared addresses → `404.panel.home`.
- **Layout (top → bottom):**
  - `<main>` at least the viewport height (`min-h-svh`), content centred on `--surface-page`, padding 16 px / 40 px from `sm`
    - card, max 560 px, 1 px `--border-default` border (not `Card`'s hairline), radius 8 px; one column on phone, two from `sm`
      - photo panel: `/hero-facade-plaque.webp` cover, `object-position` 96 % 42 %, bottom-up dark gradient; `alt=""`, `aria-hidden`; min height 160 px phone (banner above the text) / 340 px from `sm`
      - text panel (card surface, padding 24 px / 40 px): `map-pin-off` icon 24 px subtle (`aria-hidden`); `<h1>` `NotFound.heading` — pl „Zgubiliśmy się?” · en "Lost?" (`type-h2`); `404.panel.home`
  - no bar, logo, language chip or footer
- **Server calls:** none from the browser; the server reads the session and handle for the link target (`signedInDestination`).
- `<title>`: `NotFound.title` — pl „Nie znaleziono strony” · en "Page not found" (also set by the profile page's `generateMetadata` for a non-profile result).

#### Elements

##### `404.panel.home` — link

- **Label:** `NotFound.homeLink` — pl „Wróć do domu” · en "Back home"
- **Where:** text panel, under the heading
- **Shown:** every viewer, desktop and phone
- **Does:** signed-out (or unverifiable) → `/` (en `/en`); signed-in with handle → `/{handle}`; no-handle → `/onboarding` (`signedInDestination() ?? "/"`)
- **A11y:** link; `ButtonLink` `quiet` md (40 px)
- **Tests:** `e2e/profile.spec.ts` — status 404, `getByRole("heading", { level: 1, name: "Zgubiliśmy się?" })`, `getByRole("link", { name: "Wróć do domu" })` href `/`; en heading "Lost?", `getByRole("link", { name: "Back home" })` href `/en`; `e2e/a11y.spec.ts` axe `not-found-pl`, `not-found-en`; `e2e/handle.spec.ts` 404 status of `/admin`, `/some-old-address`
- **Source:** `not-found.tsx` — `NotFoundPage`

#### Decisions

- `D-SHELL-13` — Two panels (photo beside text) from `sm`; below `sm` they stack, the photo becoming a banner above the full-width text panel, because two 155 px columns on a 390 px phone broke the heading and button; `svh` height. Source: `not-found.tsx` comments.

## 5. Sign-in screens

### C-AUTH-SHELL — the frame of the seven auth screens

- **Screenshots:** `v-login--desktop`, `v-login--phone` (Appendix A)
- **Used by:** V-LOGIN, V-REGISTER, V-REGISTER-VERIFIED, V-RESET-REQUEST, V-RESET-NEW, V-TWO-FACTOR,
  V-EMAIL-CHANGED — `src/app/[locale]/(auth)/shell.ts` (`AUTH_MAIN`, `AUTH_COLUMN`, `AUTH_HEADING`,
  `AUTH_TOUCH`, `AUTH_SUBMIT`, `AUTH_SENT_BODY`). The `(auth)` group has no `layout.tsx`: each page
  composes the shell itself. Above it only `src/app/[locale]/layout.tsx` (`<html lang={locale}>`,
  `NextIntlClientProvider`, default `<title>` `Metadata.title` — pl „Architektów 3d” · en "Architektów 3d").
- **Layout (top → bottom):**
  - `<main>` (`AUTH_MAIN`): at least the smallest viewport height (`min-h-svh`), content centred
    horizontally and vertically, page background; side padding 16px on `phone`, 24px from `sm`; vertical
    padding 24px at every width.
  - column (`AUTH_COLUMN`): full width up to `--measure-form` (28rem), items centred; gap 16px on `phone`,
    20px from `sm`.
    1. compact logo — `AUTH-SHELL.header.logo`.
    2. card (`Card padding="lg"`, full column width; hairline border, 8px radius, no shadow; padding 40px on
       `phone`, 48px from `sm`) holding the `<h1>` (`AUTH_HEADING`: type-h1 at 1.375rem on `phone`, 2rem from
       `sm`) and the screen's form or result.
    3. footer line: centred muted `type-sm` paragraph with one text link — present only on V-LOGIN,
       V-REGISTER, V-RESET-REQUEST, V-TWO-FACTOR and the success state of V-REGISTER-VERIFIED (F-AUTH-1).
  - Every form ends with a full-width primary submit (`AUTH_SUBMIT`).
- **What none of the seven screens has:** no top bar (`TopBar`), no account menu, no language switch
  (`LanguageChip`), no site footer (`Footer`), no `<header>`/`<nav>`/`<footer>` landmark — `<main>` is the
  only landmark. The logo leads nowhere (D-AUTH-6).
- **Phone adjustments** (all through `sm:` = 40rem; the custom `phone:` variant is not used here): gutters
  24→16px; column gap 20→16px; card padding 48→40px; h1 2rem→1.375rem; every button (`AUTH_TOUCH`) and
  V-TWO-FACTOR method pill (`MODE_PILL`) gets `min-height` 48px below `sm`. From `sm` the floor is removed
  (`sm:min-h-0`): buttons return to the 40px control height, and text-styled buttons and pills to their
  content height; the "sent to {email}" line may break inside a long address (`AUTH_SENT_BODY`,
  `break-words`). Text fields are 48px tall at every width (`--field-h`). Text links get no touch floor
  (F-AUTH-3).
- **Server calls:** none of its own.

#### Elements

##### `AUTH-SHELL.header.logo` — static branding (not a link)

- **Label:** `Brand.wordmark` — pl „Architektów 3d” · en "Architektów 3d"; preceded by the 26px "A3D" mark
  (`aria-hidden`)
- **Where:** first item of the column, above the card
- **Shown:** every auth screen, every state, every viewer
- **Enabled:** n/a
- **Does:** nothing — rendered as a `<span>` because no `href` is passed
- **States:** none
- **Input:** none; not focusable
- **A11y:** the wordmark is read as plain text; the mark is hidden
- **Tests:** none
- **Source:** `src/components/ui/logo.tsx` — `Logo` (`size="compact"`, no `href`);
  `src/components/ui/logo-mark.tsx` — `LogoMark`

#### Flows and rules (common to every auth form)

- **Rendering:** each form is a client component inside a server page. All copy from dictionaries (A8).
  Every `TextLink`, `ButtonLink` and `router.push` goes through `@/i18n/navigation` (pl unprefixed, en
  `/en/…`); every callback URL sent to the server is built with `getPathname({ locale, href })`, so e-mailed
  links land in the locale of the page that requested them.
- **Focus on load:** none. No `autoFocus`, no refs, no `focus()` call anywhere in the route group.
- **Native validation off:** every `<form>` has `noValidate`; inputs still carry `required` and a proper
  `type`.
- **Validation timing:** on submit only, client-side, before any request; no on-blur or on-change checks.
  Field errors stay while the person types and are recomputed on the next submit. A failed client check sends
  no request (asserted in e2e for login, reset request and new password).
- **Field error pattern:** `<p id="<field>-error">` directly under the input (inside `FormField`); the input
  gets `aria-invalid="true"` and `aria-describedby="<field>-error"`. Where a field has a hint
  (`<p id="password-hint">`), the hint is removed while the error shows and `aria-describedby` switches
  between the two ids. Field errors have no live role (F-AUTH-5).
- **Form-level error pattern:** one `<p role="alert">` above the submit, cleared when the next submit starts.
- **Busy:** the submit is `disabled` and shows its busy label for the whole request; fields stay editable;
  no `aria-busy`. Enter in a field does not resubmit while the submit is disabled (HTML implicit-submission
  rule for a disabled default button).
- **Network failure:** when no HTTP response arrives, the auth client throws. Every form catches it and
  re-enables its button: submits show their `…errors.generic` copy, and the resend flows
  (`useResendVerification`) show their `…resendFailed` status line (e2e: login, register).
- **Kept on error:** every typed value, passwords included, is kept on every error.
- **E-mail normalisation:** `emailSchema` trims and lowercases before validating; the normalised address is
  what is sent and what the "sent to {email}" lines display, while the field keeps the raw text. Passwords
  are never trimmed (D-AUTH-8).
- **Result swaps:** a successful request replaces the form with a result block inside the same card; the
  `<h1>` stays and the result carries an `<h2>` (register sent, reset sent, new-password success). No focus
  move, no announcement (F-AUTH-6).
- **Signed-in visitors:** no auth page reads the session; a signed-in visitor sees and can use every screen
  (F-AUTH-4).
- **Rate limits** are counted per client IP (`x-forwarded-for`) by Better Auth; each view lists its numbers.
- **Indexing:** outside production every response carries `X-Robots-Tag: noindex` (`src/proxy.ts`; e2e
  `profile.spec.ts` checks `/login`). `e2e/global-setup.ts` warms all seven routes.

#### Decisions

- `D-AUTH-1` — The seven screens are one shell, and the phone pass lives in `shell.ts` constants instead of
  per-page class strings, "so a screen that drifts out of the family is then a visible import change".
  Source: `shell.ts` header comment.
- `D-AUTH-2` — Frame height uses `svh`, not `vh`: mobile Chrome sizes `vh` with the address bar hidden, so
  these short pages scrolled "a bar's worth with nothing underneath". Source: `shell.ts` `AUTH_MAIN` comment.
- `D-AUTH-3` — Below `sm` buttons get a 48px minimum height because the 40px control is "four short of the
  44px a thumb expects"; from `sm` the 40px control returns. The V-TWO-FACTOR method pills take the same
  floor. Source: `shell.ts` `AUTH_TOUCH` comment; `two-factor-challenge.tsx` `MODE_PILL` comment.
- `D-AUTH-4` — Below `sm` the heading size, column gap and card padding each step down one stop (2rem →
  1.375rem, 20 → 16px, 48 → 40px), and the gutters drop from 24px to 16px to match the top bar. At 2rem,
  "Create your account" and „Potwierdź logowanie” wrapped onto two lines, and 24px gutters spent an eighth of
  a 390px screen. Source: `shell.ts` `AUTH_HEADING`, `AUTH_MAIN`, `AUTH_COLUMN` comments;
  `card.tsx` `PADDING` comment.
- `D-AUTH-5` — The "sent to {email}" line may break inside the address: a 53-character address painted past
  the card on a 360px phone and scrolled the whole page sideways. Source: `shell.ts` `AUTH_SENT_BODY` comment.
- `D-AUTH-6` — The logo above the card is not a link and not focusable: "a visitor part-way through making
  an account is not offered a way out of the view". Source: #66; `logo-mark.tsx` and `logo.tsx` comments.

#### Findings

- `F-AUTH-1` — The footer line that the shell comment promises is missing on three screens, leaving some
  states with no way to log in or go back: V-RESET-NEW has no footer line in any state (its form state has no
  link at all); V-EMAIL-CHANGED has only the in-card settings link; V-REGISTER-VERIFIED's expired and invalid
  states have no link of any kind, only the resend form. With the logo not a link (D-AUTH-6) the browser is
  the only other exit. Evidence: `shell.ts` header ("a compact logo, a card with a heading and a form, and a
  footer line"); `reset-password/new/page.tsx`; `email-changed/page.tsx`; `register/verified/page.tsx`
  (`state === "success" &&` around the footer `TextLink`).
- `F-AUTH-2` — Duplicate of `F-SHELL-4` (no language switch on the auth screens, SPEC A8).
- `F-AUTH-3` — Text links have no touch floor: `AUTH_TOUCH` is applied to buttons and text-styled `<button>`s
  but never to a `TextLink`, so „Nie pamiętasz hasła?”, every footer link, „Wyślij nowy link”, „Zaloguj się”
  (reset success), „Przejdź na stronę główną” and „Przejdź do ustawień konta” keep `type-sm` line height on
  `phone`. Possibly deliberate: the constant's comment scopes it to "the buttons on these screens".
  Evidence: `shell.ts` `AUTH_TOUCH`; `TextLink` usages in `(auth)`.
- `F-AUTH-4` — Duplicate of `F-SHELL-1` (signed-in visitors are not sent away from the auth screens).
- `F-AUTH-5` — Client-side validation errors are silent for screen-reader users: after pressing submit,
  focus stays on the button, the error paragraphs have no live role, and nothing moves focus to the first
  invalid field — in V-LOGIN, V-REGISTER, V-RESET-REQUEST, V-RESET-NEW and the V-REGISTER-VERIFIED resend
  form. V-TWO-FACTOR renders its "enter the code" error in a `role="alert"` paragraph, so comparable forms
  behave differently. Evidence: error `<p>` without role in `login-form.tsx`, `register-form.tsx`,
  `request-form.tsx`, `new-password-form.tsx`, `resend-form.tsx` vs `<p id="code-error" role="alert">` in
  `two-factor-challenge.tsx`.
- `F-AUTH-6` — A result swap removes the focused submit button, so focus falls back to the document and
  nothing is announced: V-REGISTER sent state, V-RESET-REQUEST sent state, V-RESET-NEW success. Only
  V-RESET-NEW's dead-token block is `role="alert"`. Evidence: `register-form.tsx` and `request-form.tsx`
  `if (sentTo) return …`; `new-password-form.tsx` `outcome === "done"` (no role) vs
  `outcome === "invalidToken"` (`role="alert"`).

### V-LOGIN — log in

- **Screenshots:** `v-login--desktop`, `v-login--phone` (Appendix A)
- **Route:** `/login` (en `/en/login`) — `src/app/[locale]/(auth)/login/page.tsx` (`LoginPage`), form
  `login/login-form.tsx` (`LoginForm`). Title `Login.title` — pl „Logowanie” · en "Log in".
- **Reached by:** every viewer, `signed-out` and `signed-in` (no redirect, F-AUTH-4).
- **Purpose:** exchange e-mail + password for a session (A2), or for a second-factor challenge (#29).
- **Arrives from → leaves to:** from the landing page's log-in links (`(public)/page.tsx`), the V-REGISTER
  and V-RESET-REQUEST footers, V-RESET-NEW's success link, V-TWO-FACTOR's „Wróć do logowania”, and every
  server redirect of a signed-out visitor from `/onboarding` or `/settings/*` (the (app) gate — which is also
  where V-REGISTER-VERIFIED's onboarding button lands). Leaves to `/onboarding` on success (forwards a user
  with a handle to `/{handle}`), to `/two-factor?methods=…` for a 2FA account, to V-RESET-REQUEST, V-REGISTER.
- **Layout (top → bottom):** C-AUTH-SHELL; card: h1 `Login.heading`; form: e-mail field, password field,
  form error (when any), not-verified block (when any), full-width submit, "forgot password" link
  (left-aligned under the submit); footer line: `Login.registerPrompt` + register link. No `phone`
  difference beyond the shell.
- **Server calls:**
  - `authClient.signIn.email({ email, password })` → `POST /api/auth/sign-in/email`, on submit after client
    validation. No `callbackURL`, no `rememberMe` (library default: persistent 30-day session, A2).
    - 200 without `twoFactorRedirect` → session cookie set → `router.push("/onboarding")`.
    - 200 with `twoFactorRedirect: true` (the library deleted the new session and set a 600-second
      `two_factor` challenge cookie) → `router.push("/two-factor?methods=" +
      encodeURIComponent(twoFactorMethods.join(",")))`; `methods=` is empty when the field is not an array.
    - 403 `code: "EMAIL_NOT_VERIFIED"` (returned only after a correct password) → `LOGIN.not-verified.message`.
    - 429 (3 requests per 10 s per IP — Better Auth's built-in rule for `/sign-in*`) → `Login.errors.rateLimited`.
    - 401 (`INVALID_EMAIL_OR_PASSWORD` for an unknown address, an account without a password or a wrong
      password; also the rare `FAILED_TO_CREATE_SESSION`) → `Login.errors.invalidCredentials`.
    - any other status (e.g. 400 `INVALID_EMAIL`) or no response → `Login.errors.generic`.
  - `authClient.sendVerificationEmail({ email, callbackURL })` → `POST /api/auth/send-verification-email`,
    `callbackURL` `/register/verified` (en `/en/register/verified`) — the not-verified resend
    (`useResendVerification`): 200 → done; 429 (3 per hour per IP, A1) → limited; other status or no
    response → failed. Signed out, the endpoint answers 200 for unknown and already-verified addresses too
    (nothing sent) and never faster than 500 ms (library timing floor). The message sent is the distinct
    "re-verification" e-mail (A10).

#### Elements

##### `LOGIN.form.email` — text field

- **Label:** `Login.emailLabel` — pl „Adres e-mail” · en "E-mail address"
- **Where:** first field of the form
- **Shown:** always
- **Enabled:** always, also while submitting
- **Does:** holds the address; trimmed, lowercased and validated with `emailSchema` on submit
- **States:** idle; error `Login.errors.emailInvalid` — pl „Podaj poprawny adres e-mail.” · en "Enter a valid
  e-mail address." (empty or not an address)
- **Input:** `type="email"`, `autoComplete="email"`, `name="email"`, `id="email"`, `required`; Enter submits
- **A11y:** `<label for="email">`; on error `aria-invalid="true"`, `aria-describedby="email-error"`
- **Tests:** `getByLabel("Adres e-mail")` / `getByLabel("E-mail address")` — `e2e/login.spec.ts`,
  `e2e/two-factor.spec.ts`, `e2e/db/account.ts`; `getByText("Podaj poprawny adres e-mail.")`,
  `getByText("Enter a valid e-mail address.")` — `login.spec.ts`
- **Source:** `login-form.tsx` — `LoginForm`

##### `LOGIN.form.password` — text field (password)

- **Label:** `Login.passwordLabel` — pl „Hasło” · en "Password"
- **Where:** under the e-mail field
- **Shown:** always
- **Enabled:** always
- **Does:** holds the password, sent untrimmed; only emptiness is checked (D-AUTH-7)
- **States:** idle; error `Login.errors.passwordRequired` — pl „Podaj hasło.” · en "Enter your password."
- **Input:** `type="password"`, `autoComplete="current-password"`, `name="password"`, `id="password"`,
  `required`; no show-password toggle; Enter submits
- **A11y:** `<label for="password">`; on error `aria-invalid="true"`, `aria-describedby="password-error"`
- **Tests:** `getByLabel("Hasło")` / `getByLabel("Password")` — `login.spec.ts`, `two-factor.spec.ts`,
  `db/account.ts`; `getByText("Podaj hasło.")`, `getByText("Enter your password.")` — `login.spec.ts`
- **Source:** `login-form.tsx` — `LoginForm`

##### `LOGIN.form.error` — alert

- **Label:** one of `Login.errors.invalidCredentials` — pl „Nieprawidłowy e-mail lub hasło.” · en "Invalid
  e-mail or password."; `Login.errors.rateLimited` — pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj
  ponownie.” · en "Too many attempts. Wait a moment and try again."; `Login.errors.generic` — pl „Logowanie
  nie powiodło się. Spróbuj ponownie.” · en "Login failed. Try again."
- **Where:** under the password field, above the not-verified block and the submit
- **Shown:** after a failed sign-in (401, 429, other status, no response); removed when the next submit starts
- **Enabled:** n/a
- **Does:** reports the failure; fields keep their values
- **States:** hidden / one message
- **A11y:** `<p role="alert">`
- **Tests:** `getByText("Nieprawidłowy e-mail lub hasło.")`, `getByText("Zbyt wiele prób. Odczekaj chwilę i
  spróbuj ponownie.")`, `getByText("Logowanie nie powiodło się. Spróbuj ponownie.")`, `getByText("Invalid
  e-mail or password.")` — `login.spec.ts`; the first also in `db/password-reset.spec.ts`; the rate-limit
  text drives the one retry in `db/account.ts` `logIn`
- **Source:** `login-form.tsx` — `LoginForm` (`formError`)

##### `LOGIN.not-verified.message` — alert

- **Label:** `Login.errors.notVerified` — pl „Konto nie zostało jeszcze aktywowane. Sprawdź skrzynkę albo
  wyślij link ponownie.” · en "Your account is not activated yet. Check your inbox or send the link again."
- **Where:** block between the form error and the submit; holds this message, `LOGIN.not-verified.resend`
  and `LOGIN.not-verified.status`
- **Shown:** after 403 `EMAIL_NOT_VERIFIED`; removed, together with the resend outcome, when the next submit
  starts
- **Enabled:** n/a
- **Does:** explains, and fixes the resend target to the normalised address of that submit
  (`notVerifiedFor`) — editing the e-mail field afterwards does not change the target
- **States:** hidden / shown
- **A11y:** the whole block (message, button, status) is one `role="alert"` container (F-AUTH-8)
- **Tests:** `getByText("Konto nie zostało jeszcze aktywowane", { exact: false })` — `login.spec.ts`
- **Source:** `login-form.tsx` — `LoginForm` (`notVerifiedFor`)

##### `LOGIN.not-verified.resend` — button (text-link style)

- **Label:** `Login.resend` — pl „Wyślij link aktywacyjny ponownie” · en "Send the activation link again";
  busy `Login.resending` — pl „Wysyłanie…” · en "Sending…"
- **Where:** inside the not-verified block, under the message, left-aligned
- **Shown:** with `LOGIN.not-verified.message`
- **Enabled:** disabled only while its own request runs; enabled again after any outcome, so it can be
  pressed repeatedly until the hourly limit
- **Does:** `sendVerificationEmail` for the remembered address with the localized `/register/verified`
  callback
- **States:** idle / busy; outcome in `LOGIN.not-verified.status`
- **Input:** click, tap, Enter/Space; `type="button"`, never submits the form
- **A11y:** native button; disabled look = subtle text, no underline; 48px min-height on `phone`
- **Tests:** `getByRole("button", { name: "Wyślij link aktywacyjny ponownie" })` — `login.spec.ts`
- **Source:** `login-form.tsx` — `LoginForm`; `use-resend-verification.ts` — `useResendVerification`

##### `LOGIN.not-verified.status` — status line

- **Label:** done `Login.resendDone` — pl „Wysłane — sprawdź skrzynkę.” · en "Sent — check your inbox.";
  limited `Login.resendLimited` — pl „Limit 3 wysyłek na godzinę został wykorzystany. Spróbuj później.” · en
  "The limit of 3 e-mails per hour is used up. Try again later."; failed `Login.resendFailed` — pl „Wysyłka
  nie powiodła się. Spróbuj ponownie.” · en "Sending failed. Try again."
- **Where:** under the resend button
- **Shown:** after a resend finished; hidden while idle and while a (new) resend is sending
- **Enabled:** n/a
- **Does:** reports the resend outcome ("done" means only "request accepted", D-AUTH-16)
- **States:** done (success colour) / limited, failed (danger colour)
- **A11y:** `<p role="status">` nested inside the `role="alert"` block
- **Tests:** `getByText("Wysłane — sprawdź skrzynkę.")` visible after the resend, then `not.toBeVisible()`
  after resubmitting — `login.spec.ts`
- **Source:** `resend-status.tsx` — `ResendStatus`

##### `LOGIN.form.submit` — button

- **Label:** `Login.submit` — pl „Zaloguj się” · en "Log in"; busy `Login.submitting` — pl „Logowanie…” · en
  "Logging in…"
- **Where:** full width, after the error and not-verified blocks
- **Shown:** always
- **Enabled:** disabled while the sign-in request runs
- **Does:** clears the form error, the not-verified block and the resend outcome; validates both fields
  (both errors can show at once); if valid, signs in and routes as in "Server calls"
- **States:** idle / busy
- **Input:** click, tap, Enter in either field
- **A11y:** native submit button; the label change is the only busy signal
- **Tests:** `getByRole("button", { name: "Zaloguj się" })` / `{ name: "Log in" }`; `toBeEnabled()` after a
  network failure — `login.spec.ts`, `two-factor.spec.ts`, `db/account.ts`
- **Source:** `login-form.tsx` — `LoginForm.handleSubmit`

##### `LOGIN.form.forgot-password` — link

- **Label:** `Login.forgotPassword` — pl „Nie pamiętasz hasła?” · en "Forgot your password?"
- **Where:** last item inside the form, under the submit, left-aligned, muted tone
- **Shown:** always
- **Enabled:** always
- **Does:** navigates to V-RESET-REQUEST (`/reset-password`); the typed address is not carried over
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link with focus ring; no touch floor (F-AUTH-3)
- **Tests:** `getByRole("link", { name: "Nie pamiętasz hasła?" })` then `toHaveURL(/\/reset-password$/)` —
  `e2e/reset-password.spec.ts`, `e2e/db/password-reset.spec.ts`
- **Source:** `login-form.tsx` — `LoginForm`

##### `LOGIN.footer.register` — link

- **Label:** prompt `Login.registerPrompt` — pl „Nie masz konta?” · en "No account yet?", link
  `Login.registerLink` — pl „Zarejestruj się” · en "Sign up"
- **Where:** footer line under the card
- **Shown:** always
- **Enabled:** always
- **Does:** navigates to V-REGISTER
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Zarejestruj się" })` — `login.spec.ts`
- **Source:** `login/page.tsx` — `LoginPage`

#### Flows and rules

- Submit sequence: clear `formError`, `notVerifiedFor` and the resend state → validate → stop on any field
  error → request → route or show the error; `submitting` is reset in `finally`.
- Server check order: address and password first; "not verified" and the 2FA challenge are revealed only
  after a correct password (D-AUTH-13).
- An unverified sign-in does not send a new link by itself (`emailVerification.sendOnSignIn` not set); the
  person presses the resend button.
- 2FA branch: no session exists until V-TWO-FACTOR passes; the challenge lasts 10 minutes.
- The success destination is fixed; no `next`/return parameter is read or written (F-AUTH-7).
- Not offered: "remember me", show-password, social or passwordless sign-in.
- Tab order: e-mail → password → [resend button, when shown] → submit → „Nie pamiętasz hasła?” → „Zarejestruj
  się”.

#### Decisions

- `D-AUTH-7` — Login checks only that a password was typed ("the stored password decides, not the form").
  The A1 length bounds are checked by the forms that set a password: registration, the reset form and the
  settings change (D-AUTH-14). Source: `login-form.tsx` comment (A1).
- `D-AUTH-8` — Addresses are trimmed and lowercased before validation, so "what a form submits is exactly
  what the server stores"; passwords are never trimmed ("leading/trailing spaces are legal characters").
  Source: `auth-schemas.ts` comments; SPEC §2 Stack table ("Zod — the same schemas client/server").
- `D-AUTH-9` — Every successful login, with or without a second factor, lands on `/onboarding`, the one step
  between login and the app; it forwards a user who already has a handle to their profile. Source: #15;
  `login-form.tsx`, `two-factor-challenge.tsx`, `onboarding/page.tsx` comments.
- `D-AUTH-10` — The login form, not the auth client, performs the 2FA redirect "so it routes through the
  locale-aware next-intl router", and carries the offered methods in the URL so the challenge renders them
  server-side ("Not sensitive, and the server enforces what it accepts regardless"). Source: `auth-client.ts`
  comment; `login-form.tsx` comment (#29).
- `D-AUTH-11` — A resend outcome is reset whenever its context changes (a new submit, a new target, a failed
  validation), so a stale "sent" never describes another attempt. Source: `use-resend-verification.ts`
  `reset` comment; `resend-form.tsx` comment; `e2e/login.spec.ts` "its state resets on resubmit".
- `D-AUTH-12` — Sign-in keeps Better Auth's built-in 3 attempts per 10 s per IP; the e2e helper waits the
  window out rather than loosening it ("The limit is deliberate product behaviour"). Source: `e2e/db/account.ts`
  comment above `RATE_LIMITED`.
- `D-AUTH-13` — A wrong password fails before any other state is revealed, so the login never tells whether
  2FA is on. Source: #29 acceptance criteria ("A wrong password still fails first … (no oracle)").

#### Findings

- `F-AUTH-7` — No return destination: a visitor sent to `/login` by the (app) gate (from `/settings/account`,
  or V-EMAIL-CHANGED's „Przejdź do ustawień konta”) lands on `/onboarding` → `/{handle}` after signing in,
  not on the page they asked for. Evidence: `(app)/layout.tsx` and `settings/account/page.tsx`
  `redirect({ href: "/login", locale })` without a parameter; `login-form.tsx` and
  `two-factor-challenge.tsx` `router.push("/onboarding")`.
- `F-AUTH-8` — Nested live regions: `ResendStatus` (`role="status"`) sits inside the not-verified
  `role="alert"` container, so a resend outcome changes the alert's content and may re-announce the whole
  block, button label included. UNVERIFIED: actual screen-reader output. Evidence: `login-form.tsx`
  `<div role="alert">` wrapping `<ResendStatus>`.
- `F-AUTH-9` — Stale comments: `login-form.tsx` and `two-factor-challenge.tsx` say the onboarding step
  "forwards users who already have a handle to /", but `onboarding/page.tsx` forwards them to `/{handle}`
  (its own comment: going through "/" "would just add a hop"). Evidence: the three comments.

### V-REGISTER — create an account

- **Screenshots:** `v-register--desktop`, `v-register--phone` (Appendix A)
- **Route:** `/register` (en `/en/register`) — `src/app/[locale]/(auth)/register/page.tsx` (`RegisterPage`),
  form `register/register-form.tsx` (`RegisterForm`). Title `Register.title` — pl „Rejestracja” · en "Sign up".
- **Reached by:** every viewer (no redirect, F-AUTH-4).
- **Purpose:** create an inactive account and send its verification link (A1).
- **Arrives from → leaves to:** from the landing page's sign-up links (`(public)/page.tsx`), the signed-out
  sign-up button on a public profile (`(public)/[handle]/page.tsx`), V-LOGIN's footer. Leaves through the
  e-mailed link to V-REGISTER-VERIFIED; footer to V-LOGIN.
- **Layout (top → bottom):** C-AUTH-SHELL; card: h1 `Register.heading`; **form state** — e-mail field,
  password field with hint, form error (when any), full-width submit; **sent state** (replaces the form
  inside the card, h1 unchanged) — h2, body with the address, resend button, resend status; footer line in
  both states: `Register.loginPrompt` + login link. No `phone` difference beyond the shell.
- **Server calls:**
  - `authClient.signUp.email({ email, password, name: "", callbackURL })` → `POST /api/auth/sign-up/email`;
    `callbackURL` `/register/verified` (en `/en/register/verified`). 200 → sent state with the normalised
    address. 429 (10 per hour per IP, #22) → `Register.errors.rateLimited`. Any other status (400 password
    bounds or invalid e-mail — unreachable after client validation; 422 create failure) or no response →
    `Register.errors.generic`. An address that already has an account gets the same 200 (Better Auth's
    generic duplicate response, because `requireEmailVerification` is on) and no e-mail (F-AUTH-11). A new
    account gets the verification e-mail, delivered off the response path; the link is valid 24 h (A1).
  - `authClient.sendVerificationEmail({ email: sentTo, callbackURL })` → `POST /api/auth/send-verification-email`
    — the sent-state resend. 200 → done (also when nothing was sent: unknown or already-verified address);
    429 (3 per hour per IP, A1) → limited; other status or no response → failed.

#### Elements

##### `REGISTER.form.email` — text field

- **Label:** `Register.emailLabel` — pl „Adres e-mail” · en "E-mail address"
- **Where:** first field
- **Shown:** form state
- **Enabled:** always
- **Does:** holds the address; normalised and validated by `signUpSchema` on submit
- **States:** idle; error `Register.errors.emailInvalid` — pl „Podaj poprawny adres e-mail.” · en "Enter a
  valid e-mail address."
- **Input:** `type="email"`, `autoComplete="email"`, `name="email"`, `id="email"`, `required`; Enter submits
- **A11y:** `<label for="email">`; on error `aria-invalid="true"`, `aria-describedby="email-error"`
- **Tests:** `getByLabel("Adres e-mail")` — `e2e/register.spec.ts`, `e2e/db/account.ts`;
  `getByText("Podaj poprawny adres e-mail.")` — `register.spec.ts`
- **Source:** `register-form.tsx` — `RegisterForm`

##### `REGISTER.form.password` — text field (password) with hint

- **Label:** `Register.passwordLabel` — pl „Hasło” · en "Password"; hint `Register.passwordHint` — pl „Od {min}
  do {max} znaków — bez żadnych dodatkowych wymagań.” · en "{min} to {max} characters — no other
  requirements." ({min} = 8, {max} = 128)
- **Where:** under the e-mail field; hint under the input
- **Shown:** form state
- **Enabled:** always
- **Does:** holds the password (untrimmed); validated against 8–128 characters (JavaScript string length, as
  on the server), no composition rules (D-AUTH-14)
- **States:** idle (hint visible); error (hint removed) — `Register.errors.passwordTooShort` — pl „Hasło musi
  mieć co najmniej {min} znaków.” · en "The password needs at least {min} characters."; or, for a Zod
  `too_big` issue, `Register.errors.passwordTooLong` — pl „Hasło może mieć najwyżej {max} znaków.” · en "The
  password can have at most {max} characters."
- **Input:** `type="password"`, `autoComplete="new-password"`, `name="password"`, `id="password"`,
  `required`; no confirm field, no show-password toggle; Enter submits
- **A11y:** `<label for="password">`; `aria-describedby="password-hint"`, or `"password-error"` with
  `aria-invalid="true"` while an error shows
- **Tests:** `getByLabel("Hasło")` — `register.spec.ts`, `db/account.ts`; `getByText("Hasło musi mieć co
  najmniej 8 znaków.")` — `register.spec.ts`; the hint is not tested
- **Source:** `register-form.tsx` — `RegisterForm`; `src/lib/auth-schemas.ts` — `PASSWORD_MIN`,
  `PASSWORD_MAX`, `signUpSchema`

##### `REGISTER.form.error` — alert

- **Label:** `Register.errors.rateLimited` — pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.” · en
  "Too many attempts. Wait a moment and try again."; `Register.errors.generic` — pl „Rejestracja nie
  powiodła się. Spróbuj ponownie.” · en "Sign-up failed. Try again."
- **Where:** above the submit
- **Shown:** after a failed sign-up; removed when the next submit starts
- **Enabled:** n/a
- **Does:** reports the failure; both fields keep their values
- **States:** hidden / one message
- **A11y:** `<p role="alert">`
- **Tests:** `getByText("Rejestracja nie powiodła się. Spróbuj ponownie.")` — `register.spec.ts`
- **Source:** `register-form.tsx` — `RegisterForm` (`formError`)

##### `REGISTER.form.submit` — button

- **Label:** `Register.submit` — pl „Zarejestruj się” · en "Sign up"; busy `Register.submitting` — pl
  „Rejestrowanie…” · en "Signing up…"
- **Where:** full width, last in the form
- **Shown:** form state
- **Enabled:** disabled while the sign-up request runs
- **Does:** clears the form error; validates both fields (first issue per field; both errors at once); on
  success of validation clears field errors and signs up
- **States:** idle / busy
- **Input:** click, tap, Enter in either field
- **A11y:** native submit button
- **Tests:** `getByRole("button", { name: "Zarejestruj się" })`, `toBeEnabled()` after a network failure —
  `register.spec.ts`, `db/account.ts`; `getByRole("button", { name: "Sign up" })` — `register.spec.ts`
- **Source:** `register-form.tsx` — `RegisterForm.handleSubmit`

##### `REGISTER.sent.message` — result block (heading + body)

- **Label:** h2 `Register.sent.heading` — pl „Sprawdź skrzynkę” · en "Check your inbox"; body
  `Register.sent.body` — pl „Wysłaliśmy link aktywacyjny na adres {email}. Link jest ważny przez 24 godziny.”
  · en "We sent an activation link to {email}. The link is valid for 24 hours." ({email} = the normalised
  address; may break inside the address)
- **Where:** replaces the form inside the card, under the unchanged h1
- **Shown:** after a 200 from sign-up; stays until the page is reloaded
- **Enabled:** n/a
- **Does:** confirms the request; offers no way to change the address (F-AUTH-10)
- **States:** single
- **A11y:** no live role; focus is lost with the removed submit (F-AUTH-6)
- **Tests:** `getByRole("heading", { name: "Sprawdź skrzynkę" })` — `db/account.ts`
- **Source:** `register-form.tsx` — `RegisterForm` (`sentTo`)

##### `REGISTER.sent.resend` — button (text-link style)

- **Label:** `Register.sent.resend` — pl „Wyślij link ponownie” · en "Send the link again"; busy
  `Register.sent.resending` — pl „Wysyłanie…” · en "Sending…"
- **Where:** under the sent body, left-aligned
- **Shown:** sent state
- **Enabled:** disabled only while its request runs; pressable again after any outcome
- **Does:** `sendVerificationEmail` for the same address and callback
- **States:** idle / busy; outcome in `REGISTER.sent.status`
- **Input:** click, tap, Enter/Space; `type="button"`
- **A11y:** native button; 48px min-height on `phone`
- **Tests:** none
- **Source:** `register-form.tsx` — `RegisterForm`; `use-resend-verification.ts` — `useResendVerification`

##### `REGISTER.sent.status` — status line

- **Label:** done `Register.sent.resendDone` — pl „Wysłane — zajrzyj do skrzynki (także do folderu ze
  spamem).” · en "Sent — check your inbox (the spam folder too)."; limited `Register.sent.resendLimited` — pl
  „Limit 3 wysyłek na godzinę został wykorzystany. Spróbuj później.” · en "The limit of 3 e-mails per hour is
  used up. Try again later."; failed `Register.sent.resendFailed` — pl „Wysyłka nie powiodła się. Spróbuj
  ponownie.” · en "Sending failed. Try again."
- **Where:** under the resend button
- **Shown:** after a resend finished; hidden while idle or sending
- **Enabled:** n/a
- **Does:** reports the outcome
- **States:** done (success colour) / limited, failed (danger colour)
- **A11y:** `<p role="status">`
- **Tests:** none
- **Source:** `resend-status.tsx` — `ResendStatus`

##### `REGISTER.footer.login` — link

- **Label:** prompt `Register.loginPrompt` — pl „Masz już konto?” · en "Already have an account?", link
  `Register.loginLink` — pl „Zaloguj się” · en "Log in"
- **Where:** footer line under the card
- **Shown:** both states
- **Enabled:** always
- **Does:** navigates to V-LOGIN
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Zaloguj się" })` on `/register` — `e2e/login.spec.ts`
- **Source:** `register/page.tsx` — `RegisterPage`

#### Flows and rules

- Submit sequence: clear the form error → `signUpSchema.safeParse` → on failure show the first issue per field
  and stop → otherwise clear field errors → request → sent state or error.
- The account stays inactive (no session possible) until the link is clicked; the link is valid 24 h (A1).
- Not asked here: name (asked in onboarding, D-AUTH-15), password confirmation, terms consent.
- In the sent state the resend hook is never reset (its target cannot change); presses are unlimited on the
  client and capped by the server at 3 per hour.
- The sent state is component state only: a reload shows the empty form again.
- Tab order: form state — e-mail → password → submit → „Zaloguj się”; sent state — resend → „Zaloguj się”.

#### Decisions

- `D-AUTH-14` — Passwords: 8–128 characters with no composition rules; one pair of constants feeds the form
  and the server "so the server edge can never drift from the form". Source: A1; `auth-schemas.ts` comment;
  `auth.ts` `minPasswordLength` comment.
- `D-AUTH-15` — Registration sends an empty `name`: it used to hold the e-mail local part, which "became the
  display name and the proposed address, publishing the account's own address on a public page"; the real
  name is asked for in onboarding. Source: #36; `register-form.tsx` comment; `src/lib/account.ts`
  `REGISTRATION_NAME`.
- `D-AUTH-16` — "Sent"/"done" confirmations mean only "request accepted": sign-up, the verification resend
  and the reset request answer the same for known and unknown addresses (enumeration protection), and
  delivery runs off the response path so timing does not reveal existence either. Source:
  `use-resend-verification.ts`, `resend-form.tsx`, `request-form.tsx` comments; `auth.ts` `backgroundTasks`
  comment (#22).
- `D-AUTH-17` — Sign-up is capped at 10 per hour per IP (higher than the other senders because "a shared IP …
  may hold several genuine sign-ups in a day") and the verification resend at 3 per hour (the library's own
  rule was 3 per minute, "far looser than the criterion"). Source: A1; `auth.ts` `rateLimit.customRules`
  comments (#22).

#### Findings

- `F-AUTH-10` — The sent state has no way to correct a mistyped address: nothing clears `sentTo`, so the only
  way back to the form is a reload — on V-REGISTER and V-RESET-REQUEST alike. Evidence: `register-form.tsx`
  and `request-form.tsx` (`if (sentTo) return …`, no control that resets it).
- `F-AUTH-11` — The sent copy asserts delivery unconditionally („Wysłaliśmy link aktywacyjny na adres
  {email}”), but for an address that already has an account the sign-up answers the same 200 and sends
  nothing (no `onExistingUserSignUp` hook), so the person waits for a message that never comes; the resend
  then also answers "done" without sending. V-RESET-REQUEST's comparable copy is conditional („Jeśli konto o
  adresie {email} istnieje…”). A conditional sentence shown for every address would reveal nothing, so
  enumeration protection does not require the unconditional wording. Evidence: `messages/pl.json`
  `Register.sent.body` vs `ResetPassword.request.sent.body`; better-auth 1.7.2 `api/routes/sign-up.mjs`
  (`shouldReturnGenericDuplicateResponse`); `auth.ts` (no `onExistingUserSignUp`).
- `F-AUTH-12` — Three confirmations of the same resend outcome use two texts: only V-REGISTER's sent state
  mentions the spam folder (`Register.sent.resendDone`), V-LOGIN (`Login.resendDone`) and
  V-REGISTER-VERIFIED (`Register.verified.resendDone`) do not. Evidence: the three keys in `messages/*.json`.
- `F-AUTH-13` — The sign-up rate-limit message says „Odczekaj chwilę” / "Wait a moment", but the window is one
  hour (10 per hour per IP), so the wait can be up to an hour; the reset-request and resend messages name
  their hourly limits. Evidence: `auth.ts` `"/sign-up/email": { window: 60 * 60, max: 10 }`;
  `Register.errors.rateLimited` vs `ResetPassword.request.errors.rateLimited`, `Login.resendLimited`.

### V-REGISTER-VERIFIED — verification link landing

- **Screenshots:** `v-register-verified--desktop` (Appendix A)
- **Route:** `/register/verified` (en `/en/register/verified`), optional `?error=<CODE>` —
  `src/app/[locale]/(auth)/register/verified/page.tsx` (`VerifiedPage`, `verificationState`), resend form
  `register/verified/resend-form.tsx` (`ResendForm`). No title of its own: the tab shows `Metadata.title`
  „Architektów 3d” (F-AUTH-16).
- **Reached by:** anyone following a verification e-mail. The link is
  `GET /api/auth/verify-email?token=…&callbackURL=/register/verified` (en `/en/register/verified`), which
  answers 302 here: plain when the account is verified now or was already verified; `?error=TOKEN_EXPIRED`
  for a token older than 24 h; `?error=INVALID_TOKEN` for a bad or tampered token; `?error=USER_NOT_FOUND`
  for an account that no longer exists. A direct visit renders by the same rule (no `error` → success).
- **Purpose:** confirm the activation, or recover from a rejected link by requesting a new one.
- **Arrives from → leaves to:** from the verification and re-verification e-mails (requested on V-REGISTER,
  V-LOGIN or this page). Success → „Ustaw adres profilu” (`/onboarding`, which sends a signed-out visitor to
  V-LOGIN: verification creates no session) or „Przejdź na stronę główną” (`/`). Expired/invalid → the
  resend form only.
- **States (`verificationState(error)`):** `success` — `error` absent or empty · `expired` —
  `error=TOKEN_EXPIRED` · `invalid` — any other value.
- **Layout (top → bottom):** C-AUTH-SHELL; card: 48px round medallion (success: check icon on the success
  tint; expired/invalid: mail icon on the danger tint), h1, muted body; then success: full-width button link;
  expired/invalid: resend form (e-mail field, submit, status). Footer line only in `success` (home link).
  No `phone` difference beyond the shell.
- **Server calls:** none on load — the state comes from the query only. Resend form:
  `authClient.sendVerificationEmail({ email, callbackURL })` → `POST /api/auth/send-verification-email`,
  `callbackURL` `/register/verified` (en `/en/register/verified`). 200 → done (also for an unknown or
  already-verified address, nothing sent); 429 (3 per hour per IP) → limited; other status or no response →
  failed (a signed-in visitor always lands here, F-AUTH-4).

#### Elements

##### `REGISTER-VERIFIED.card.outcome` — result (medallion, heading, body)

- **Label:** success — h1 `Register.verified.successHeading` — pl „Konto aktywne” · en "Account active";
  body `Register.verified.successBody` — pl „Twój adres e-mail został potwierdzony.” · en "Your e-mail address
  is confirmed." · expired — h1 `Register.verified.expiredHeading` — pl „Link wygasł” · en "The link has
  expired"; body `Register.verified.expiredBody` — pl „Link aktywacyjny był ważny przez 24 godziny. Podaj
  adres e-mail, a wyślemy nowy.” · en "The activation link was valid for 24 hours. Enter your e-mail address
  and we will send a new one." · invalid — h1 `Register.verified.invalidHeading` — pl „Nieprawidłowy link” ·
  en "Invalid link"; body `Register.verified.invalidBody` — pl „Ten link jest niepoprawny lub został już
  użyty. Podaj adres e-mail, a wyślemy nowy.” · en "This link is invalid or has already been used. Enter your
  e-mail address and we will send a new one."
- **Where:** top of the card
- **Shown:** one of the three, per query
- **Enabled:** n/a
- **Does:** states the outcome
- **States:** success / expired / invalid
- **A11y:** medallion icon `aria-hidden`; the h1 carries the outcome in words (D-AUTH-19)
- **Tests:** h1 „Konto aktywne” — `e2e/register.spec.ts`, `e2e/db/account.ts`; h1 „Link wygasł” with
  `?error=TOKEN_EXPIRED` — `register.spec.ts`; h1 „Nieprawidłowy link” after
  `toHaveURL(/[?&]error=INVALID_TOKEN\b/)` for a tampered token — `db/account.ts`
- **Source:** `register/verified/page.tsx` — `VerifiedPage`, `verificationState`, `MEDALLION`

##### `REGISTER-VERIFIED.success.onboarding` — button link

- **Label:** `Register.verified.onboardingLink` — pl „Ustaw adres profilu” · en "Set up your profile address"
- **Where:** full width under the success body
- **Shown:** `success`
- **Enabled:** always
- **Does:** navigates to `/onboarding` (en `/en/onboarding`); with no session the (app) gate redirects to
  V-LOGIN, and the login then lands on `/onboarding` again (F-AUTH-15)
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link styled as the primary button; 48px min-height on `phone`
- **Tests:** `getByRole("link", { name: "Ustaw adres profilu" })` `toHaveAttribute("href", "/onboarding")`,
  en `{ name: "Set up your profile address" }` → `"/en/onboarding"` — `e2e/handle.spec.ts`; clicked, then
  `toHaveURL(/\/login$/)` — `e2e/db/happy-path.spec.ts`
- **Source:** `register/verified/page.tsx` — `VerifiedPage`

##### `REGISTER-VERIFIED.footer.home` — link

- **Label:** `Register.verified.homeLink` — pl „Przejdź na stronę główną” · en "Go to the homepage"
- **Where:** footer line under the card, muted tone
- **Shown:** `success` only
- **Enabled:** always
- **Does:** navigates to `/` (the landing page; `/` itself forwards a signed-in visitor to `/{handle}` or
  `/onboarding`)
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Przejdź na stronę główną" })` — `register.spec.ts`, `handle.spec.ts`
- **Source:** `register/verified/page.tsx` — `VerifiedPage`

##### `REGISTER-VERIFIED.resend.email` — text field

- **Label:** `Register.emailLabel` (reused) — pl „Adres e-mail” · en "E-mail address"
- **Where:** first field of the resend form, under the body
- **Shown:** `expired`, `invalid`
- **Enabled:** always
- **Does:** holds the address to resend to; empty on load (the page does not know the address); kept after
  every outcome
- **States:** idle; error `Register.errors.emailInvalid` (reused) — pl „Podaj poprawny adres e-mail.” · en
  "Enter a valid e-mail address."
- **Input:** `type="email"`, `autoComplete="email"`, `name="email"`, `id="resend-email"`, `required`; Enter
  submits
- **A11y:** `<label for="resend-email">`; on error `aria-invalid="true"`,
  `aria-describedby="resend-email-error"`
- **Tests:** none
- **Source:** `resend-form.tsx` — `ResendForm`

##### `REGISTER-VERIFIED.resend.submit` — button

- **Label:** `Register.verified.resendSubmit` — pl „Wyślij nowy link” · en "Send a new link"; busy
  `Register.verified.resendSending` — pl „Wysyłanie…” · en "Sending…"
- **Where:** full width under the field
- **Shown:** `expired`, `invalid`
- **Enabled:** disabled while the resend runs
- **Does:** validates the address; invalid → field error and the previous outcome is cleared, no request;
  valid → clears the field error and resends
- **States:** idle / busy; outcome in `REGISTER-VERIFIED.resend.status`
- **Input:** click, tap, Enter in the field
- **A11y:** native submit button
- **Tests:** `getByRole("button", { name: "Wyślij nowy link" })` visible — `register.spec.ts`
- **Source:** `resend-form.tsx` — `ResendForm.handleSubmit`

##### `REGISTER-VERIFIED.resend.status` — status line

- **Label:** done `Register.verified.resendDone` — pl „Wysłane — sprawdź skrzynkę.” · en "Sent — check your
  inbox."; limited `Register.verified.resendLimited` — pl „Limit 3 wysyłek na godzinę został wykorzystany.
  Spróbuj później.” · en "The limit of 3 e-mails per hour is used up. Try again later."; failed
  `Register.verified.resendFailed` — pl „Wysyłka nie powiodła się. Spróbuj ponownie.” · en "Sending failed.
  Try again."
- **Where:** last item of the resend form, under the submit
- **Shown:** after a resend finished; hidden while idle or sending
- **Enabled:** n/a
- **Does:** reports the outcome; "done" is unconditional (D-AUTH-16)
- **States:** done / limited / failed
- **A11y:** `<p role="status">`
- **Tests:** none
- **Source:** `resend-status.tsx` — `ResendStatus`

#### Flows and rules

- The page cannot tell a fresh verification from a direct visit or a repeated click: the verification token
  is a stateless JWT valid for 24 h, and the endpoint redirects without an error for an already-verified
  account (F-AUTH-14).
- Verification does not sign the person in (`autoSignInAfterVerification` not set); the next step is V-LOGIN.
- The resend e-mail is the distinct "re-verification" message (A10) and carries a new 24-hour link.
- Tab order: `success` — onboarding button → home link; `expired`/`invalid` — e-mail field → submit.

#### Decisions

- `D-AUTH-18` — The landing reads only the redirect's `?error`: none → success, `TOKEN_EXPIRED` → its own
  "expired" copy, every other code → "invalid"; both failure states offer a resend of a fresh link. Source:
  A1; `register/verified/page.tsx` comment.
- `D-AUTH-19` — The medallion is "the one place this monochrome system saturates, so the medallion carries the
  outcome before the heading is read"; it is decorative and the heading says the same in words. Source:
  `register/verified/page.tsx` `MEDALLION` comment.

#### Findings

- `F-AUTH-14` — Success-looking states render without any proof: `/register/verified` with no parameter shows
  „Konto aktywne”, and `/email-changed` with no parameter shows „Zmiana zatwierdzona”; a verification link
  clicked again within 24 h also shows success, while `Register.verified.invalidBody` tells the person that
  an "already used" link is what leads to the invalid state. Acknowledged in e2e ("The success heading renders
  for ANY visit without an ?error parameter"), with no stated product reason. Evidence: `verificationState`,
  `changeState`; better-auth 1.7.2 `api/routes/email-verification.mjs` (`if (user.user.emailVerified)` →
  plain redirect); `e2e/db/account.ts` comment.
- `F-AUTH-15` — The success button „Ustaw adres profilu” leads to the login form, and nothing on the page says
  a login comes first. May be deliberate: `e2e/db/happy-path.spec.ts` asserts the redirect ("the onboarding
  step is gated until login"). Evidence: `register/verified/page.tsx` `ButtonLink href="/onboarding"`;
  `(app)/layout.tsx` gate; `auth.ts` (no `autoSignInAfterVerification`).
- `F-AUTH-16` — The page has no `generateMetadata`, so its tab title is the site name, while the six other
  auth screens set their own title. Evidence: `register/verified/page.tsx` (no `generateMetadata`);
  `src/app/[locale]/layout.tsx` default `title: t("title")`.

### V-RESET-REQUEST — ask for a password-reset link

- **Screenshots:** `v-reset-request--desktop`, `v-reset-request--phone` (Appendix A)
- **Route:** `/reset-password` (en `/en/reset-password`) — `src/app/[locale]/(auth)/reset-password/page.tsx`
  (`ResetPasswordPage`), form `reset-password/request-form.tsx` (`RequestForm`). Title `ResetPassword.title` —
  pl „Reset hasła” · en "Password reset".
- **Reached by:** every viewer (no redirect, F-AUTH-4).
- **Purpose:** e-mail a single-use link that sets a new password (A3).
- **Arrives from → leaves to:** from V-LOGIN „Nie pamiętasz hasła?” and both "request a new link" links of
  V-RESET-NEW. Leaves through the e-mailed link to V-RESET-NEW; footer to V-LOGIN.
- **Layout (top → bottom):** C-AUTH-SHELL; card: h1 `ResetPassword.request.heading`; **form state** — muted
  intro `ResetPassword.request.body` — pl „Podaj adres e-mail swojego konta, a wyślemy link do ustawienia
  nowego hasła.” · en "Enter your account's e-mail address and we will send a link to set a new password.",
  e-mail field, form error (when any), full-width submit; **sent state** (replaces intro and form, h1
  unchanged) — h2 + body; footer line in both states: `ResetPassword.request.loginPrompt` + login link.
  No `phone` difference beyond the shell.
- **Server calls:** `authClient.requestPasswordReset({ email, redirectTo })` →
  `POST /api/auth/request-password-reset`, `redirectTo` `/reset-password/new` (en `/en/reset-password/new`).
  200 (known and unknown addresses alike; delivery off the response path) → sent state. 429 (3 per hour per
  IP) → `ResetPassword.request.errors.rateLimited`. Other status or no response →
  `ResetPassword.request.errors.generic`. The e-mail carries
  `/api/auth/reset-password/{token}?callbackURL=…`, valid 60 minutes.

#### Elements

##### `RESET-REQUEST.form.email` — text field

- **Label:** `ResetPassword.request.emailLabel` — pl „Adres e-mail” · en "E-mail address"
- **Where:** under the intro
- **Shown:** form state
- **Enabled:** always
- **Does:** holds the address; normalised and validated on submit; starts empty (the address typed on
  V-LOGIN is not carried)
- **States:** idle; error `ResetPassword.request.errors.emailInvalid` — pl „Podaj poprawny adres e-mail.” ·
  en "Enter a valid e-mail address."
- **Input:** `type="email"`, `autoComplete="email"`, `name="email"`, `id="email"`, `required`; Enter submits
- **A11y:** `<label for="email">`; on error `aria-invalid="true"`, `aria-describedby="email-error"`
- **Tests:** `getByLabel("Adres e-mail")` — `e2e/reset-password.spec.ts`, `e2e/db/password-reset.spec.ts`;
  `getByLabel("E-mail address")` — `reset-password.spec.ts`; `getByText("Podaj poprawny adres e-mail.")` with
  zero requests — `reset-password.spec.ts`
- **Source:** `request-form.tsx` — `RequestForm`

##### `RESET-REQUEST.form.error` — alert

- **Label:** `ResetPassword.request.errors.rateLimited` — pl „Limit 3 żądań na godzinę został wykorzystany.
  Spróbuj później.” · en "The limit of 3 requests per hour is used up. Try again later.";
  `ResetPassword.request.errors.generic` — pl „Wysyłka nie powiodła się. Spróbuj ponownie.” · en "Sending
  failed. Try again."
- **Where:** above the submit
- **Shown:** after a failed request; removed when the next submit starts
- **Enabled:** n/a
- **Does:** reports the failure; the address is kept
- **States:** hidden / one message
- **A11y:** `<p role="alert">`
- **Tests:** `getByText("Limit 3 żądań na godzinę został wykorzystany", { exact: false })` —
  `reset-password.spec.ts`; `getByText("Limit 3 żądań na godzinę został wykorzystany.")` `toHaveCount(0)` as a
  guard — `db/password-reset.spec.ts`
- **Source:** `request-form.tsx` — `RequestForm` (`formError`)

##### `RESET-REQUEST.form.submit` — button

- **Label:** `ResetPassword.request.submit` — pl „Wyślij link” · en "Send the link"; busy
  `ResetPassword.request.submitting` — pl „Wysyłanie…” · en "Sending…"
- **Where:** full width, last in the form
- **Shown:** form state
- **Enabled:** disabled while the request runs
- **Does:** clears the form error; validates; invalid → field error, no request; valid → clears the field
  error and requests the link
- **States:** idle / busy
- **Input:** click, tap, Enter in the field
- **A11y:** native submit button
- **Tests:** `getByRole("button", { name: "Wyślij link" })` — `reset-password.spec.ts`,
  `db/password-reset.spec.ts`; `{ name: "Send the link" }` — `reset-password.spec.ts`
- **Source:** `request-form.tsx` — `RequestForm.handleSubmit`

##### `RESET-REQUEST.sent.message` — result block (heading + body)

- **Label:** h2 `ResetPassword.request.sent.heading` — pl „Sprawdź skrzynkę” · en "Check your inbox"; body
  `ResetPassword.request.sent.body` — pl „Jeśli konto o adresie {email} istnieje, wysłaliśmy wiadomość z
  linkiem do zmiany hasła. Link działa raz i jest ważny przez 60 minut.” · en "If an account exists for
  {email}, we sent a message with a password reset link. The link works once and is valid for 60 minutes."
  ({email} = normalised address; may break inside it)
- **Where:** replaces intro and form, under the unchanged h1
- **Shown:** after a 200; stays until reload
- **Enabled:** n/a
- **Does:** confirms the request; no resend and no way to change the address (F-AUTH-10)
- **States:** single
- **A11y:** no live role; focus lost (F-AUTH-6)
- **Tests:** `getByRole("heading", { name: "Sprawdź skrzynkę" })`, `getByText("Jeśli konto o adresie
  user@example.com istnieje", { exact: false })` — `reset-password.spec.ts`; heading also
  `db/password-reset.spec.ts`
- **Source:** `request-form.tsx` — `RequestForm` (`sentTo`)

##### `RESET-REQUEST.footer.login` — link

- **Label:** prompt `ResetPassword.request.loginPrompt` — pl „Pamiętasz hasło?” · en "Remembered your
  password?", link `ResetPassword.request.loginLink` — pl „Zaloguj się” · en "Log in"
- **Where:** footer line under the card
- **Shown:** both states
- **Enabled:** always
- **Does:** navigates to V-LOGIN
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Zaloguj się" })` — `reset-password.spec.ts`
- **Source:** `reset-password/page.tsx` — `ResetPasswordPage`

#### Flows and rules

- Submit sequence: clear form error → `emailSchema` → field error and stop, or clear it → request.
- A second link needs a reload and a new submit (counts toward 3 per hour). Every request creates its own
  token; an older unused link keeps working until it expires or is used.
- A reset does not switch off two-factor: the next login of a 2FA account is still challenged.
- Tab order: form state — e-mail → submit → „Zaloguj się”; sent state — „Zaloguj się”.

#### Decisions

- `D-AUTH-20` — Reset requests are capped at 3 per hour per IP, mirroring the A1 resend cap, because the
  library's 3 per minute "would still let one IP flood a mailbox with 180 messages an hour"; the copy names
  the limit and the sent copy is conditional (D-AUTH-16). Source: A3; `auth.ts` rate-limit comment (decision
  of 01.09.2026).

#### Findings

- No finding specific to this screen beyond the shared F-AUTH-3 to F-AUTH-6 and F-AUTH-10.

### V-RESET-NEW — set a new password from the link

- **Screenshots:** `v-reset-new--desktop` (Appendix A)
- **Route:** `/reset-password/new` (en `/en/reset-password/new`), query `?token=` or `?error=INVALID_TOKEN` —
  `src/app/[locale]/(auth)/reset-password/new/page.tsx` (`NewPasswordPage`), form `new-password-form.tsx`
  (`NewPasswordForm`). Title `ResetPassword.title` — pl „Reset hasła” · en "Password reset".
- **Reached by:** the e-mailed link `GET /api/auth/reset-password/{token}?callbackURL=/reset-password/new`,
  which answers 302 here with `?token={token}` when that token is stored and unexpired, or with
  `?error=INVALID_TOKEN` when it is unknown, already used or older than 60 minutes. Any viewer, signed in or
  not; a direct visit without `token` gets the invalid state.
- **Purpose:** replace the account's password using the single-use token (A3).
- **Arrives from → leaves to:** from the password-reset e-mail. Leaves to V-LOGIN (success) or V-RESET-REQUEST
  (both "new link" links). No footer line in any state (F-AUTH-1).
- **States:** `invalid` — no `token` value (the `error` parameter itself is never read) · `form` — any
  non-empty `token` (its validity is unknown until submit) · `done` — after a 200 · `dead token` — after a
  400 `INVALID_TOKEN` at submit.
- **Layout (top → bottom):** C-AUTH-SHELL; card by state — `invalid`: h1, muted body, link; `form`: h1
  `ResetPassword.new.heading`, password field with hint, form error (when any), full-width submit; `done`:
  same h1 + h2, body, login link; `dead token`: same h1 + danger-coloured body and link in a `role="alert"`
  block. No `phone` difference beyond the shell.
- **Server calls:** `authClient.resetPassword({ newPassword, token })` → `POST /api/auth/reset-password`.
  200 → `done`: the token is consumed, every session of the account is revoked (this browser's too, if it was
  signed in), a pending e-mail change is cancelled, and a "password changed" e-mail goes to the account
  address (A3). 400 `code: "INVALID_TOKEN"` (unknown, used, or expired — expiry is checked again at submit) →
  `dead token`. 429 (Better Auth's default 100 requests per 10 s per IP) →
  `ResetPassword.new.errors.rateLimited`. Other status (400 `PASSWORD_TOO_SHORT`/`PASSWORD_TOO_LONG`,
  unreachable after client validation; 400 `USER_NOT_FOUND`) or no response → `ResetPassword.new.errors.generic`.

#### Elements

##### `RESET-NEW.invalid.message` — result (heading + body)

- **Label:** h1 `ResetPassword.new.invalid.heading` — pl „Nieprawidłowy link” · en "Invalid link"; body
  `ResetPassword.new.invalid.body` — pl „Ten link jest niepoprawny, wygasł albo został już użyty. Poproś o
  nowy.” · en "This link is invalid, has expired or has already been used. Request a new one."
- **Where:** the card
- **Shown:** `invalid`
- **Enabled:** n/a
- **Does:** explains that only a new link helps
- **States:** single
- **A11y:** static page content (no live role needed on load)
- **Tests:** h1 „Nieprawidłowy link” at `/reset-password/new?error=INVALID_TOKEN` — `e2e/reset-password.spec.ts`
- **Source:** `reset-password/new/page.tsx` — `NewPasswordPage`

##### `RESET-NEW.invalid.request-link` — link

- **Label:** `ResetPassword.new.invalid.requestLink` — pl „Wyślij nowy link” · en "Send a new link"
- **Where:** under the invalid body
- **Shown:** `invalid`
- **Enabled:** always
- **Does:** navigates to V-RESET-REQUEST (`/reset-password`)
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link; no touch floor (F-AUTH-3)
- **Tests:** `getByRole("link", { name: "Wyślij nowy link" })` click → `toHaveURL(/\/reset-password$/)` —
  `reset-password.spec.ts`
- **Source:** `reset-password/new/page.tsx` — `NewPasswordPage`

##### `RESET-NEW.form.password` — text field (password) with hint

- **Label:** `ResetPassword.new.passwordLabel` — pl „Nowe hasło” · en "New password"; hint
  `ResetPassword.new.passwordHint` — pl „Od {min} do {max} znaków — bez żadnych dodatkowych wymagań.” · en
  "{min} to {max} characters — no other requirements." ({min} = 8, {max} = 128)
- **Where:** first in the form, under the h1
- **Shown:** `form`
- **Enabled:** always
- **Does:** holds the new password (untrimmed), validated with `passwordSchema` on submit
- **States:** idle (hint visible); error (hint removed), decided by the first Zod issue —
  `ResetPassword.new.errors.passwordTooShort` — pl „Hasło musi mieć co najmniej {min} znaków.” · en "The
  password needs at least {min} characters."; for `too_big` `ResetPassword.new.errors.passwordTooLong` — pl
  „Hasło może mieć najwyżej {max} znaków.” · en "The password can have at most {max} characters."
- **Input:** `type="password"`, `autoComplete="new-password"`, `name="password"`, `id="password"`,
  `required`; no confirm field, no show-password toggle; Enter submits
- **A11y:** `<label for="password">`; `aria-describedby="password-hint"`, or `"password-error"` with
  `aria-invalid="true"`
- **Tests:** `getByLabel("Nowe hasło")`, `getByText("Hasło musi mieć co najmniej 8 znaków.")` with zero
  requests — `reset-password.spec.ts`; `getByLabel("New password")` — `reset-password.spec.ts`;
  `getByLabel("Nowe hasło")` — `db/password-reset.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm`

##### `RESET-NEW.form.error` — alert

- **Label:** `ResetPassword.new.errors.rateLimited` — pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj
  ponownie.” · en "Too many attempts. Wait a moment and try again."; `ResetPassword.new.errors.generic` — pl
  „Zmiana hasła nie powiodła się. Spróbuj ponownie.” · en "Changing the password failed. Try again."
- **Where:** above the submit
- **Shown:** after a failed request other than a dead token; removed when the next submit starts
- **Enabled:** n/a
- **Does:** reports the failure; the password is kept
- **States:** hidden / one message
- **A11y:** `<p role="alert">`
- **Tests:** none
- **Source:** `new-password-form.tsx` — `NewPasswordForm` (`formError`)

##### `RESET-NEW.form.submit` — button

- **Label:** `ResetPassword.new.submit` — pl „Zmień hasło” · en "Change the password"; busy
  `ResetPassword.new.submitting` — pl „Zapisywanie…” · en "Saving…"
- **Where:** full width, last in the form
- **Shown:** `form`
- **Enabled:** disabled while the request runs
- **Does:** clears the form error; validates; invalid → field error, no request; valid → clears the field
  error and resets the password
- **States:** idle / busy → `done` or `dead token` or form error
- **Input:** click, tap, Enter in the field
- **A11y:** native submit button
- **Tests:** `getByRole("button", { name: "Zmień hasło" })` — `reset-password.spec.ts`,
  `db/password-reset.spec.ts`; `{ name: "Change the password" }` — `reset-password.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm.handleSubmit`

##### `RESET-NEW.done.message` — result block (heading + body)

- **Label:** h2 `ResetPassword.new.success.heading` — pl „Hasło zmienione” · en "Password changed"; body
  `ResetPassword.new.success.body` — pl „Możesz teraz zalogować się nowym hasłem.” · en "You can now log in
  with your new password."
- **Where:** replaces the form, under the unchanged h1 „Ustaw nowe hasło”
- **Shown:** `done`
- **Enabled:** n/a
- **Does:** confirms; does not sign in
- **States:** single
- **A11y:** no live role; focus lost (F-AUTH-6)
- **Tests:** `getByRole("heading", { name: "Hasło zmienione" })` — `reset-password.spec.ts`,
  `db/password-reset.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm` (`outcome === "done"`)

##### `RESET-NEW.done.login` — link

- **Label:** `ResetPassword.new.success.loginLink` — pl „Zaloguj się” · en "Log in"
- **Where:** under the success body, left-aligned
- **Shown:** `done`
- **Enabled:** always
- **Does:** navigates to V-LOGIN
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Zaloguj się" })` — `reset-password.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm`

##### `RESET-NEW.dead-token.alert` — alert

- **Label:** `ResetPassword.new.invalid.body` (same copy as `RESET-NEW.invalid.message`) — pl „Ten link jest
  niepoprawny, wygasł albo został już użyty. Poproś o nowy.” · en "This link is invalid, has expired or has
  already been used. Request a new one."
- **Where:** replaces the form, under the unchanged h1 „Ustaw nowe hasło”; no heading of its own (F-AUTH-17)
- **Shown:** `dead token`
- **Enabled:** n/a
- **Does:** tells the person the link died between opening and submitting
- **States:** single
- **A11y:** container `role="alert"` (holds the body and `RESET-NEW.dead-token.request-link`)
- **Tests:** `getByText("Ten link jest niepoprawny", { exact: false })` — `reset-password.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm` (`outcome === "invalidToken"`)

##### `RESET-NEW.dead-token.request-link` — link

- **Label:** `ResetPassword.new.invalid.requestLink` — pl „Wyślij nowy link” · en "Send a new link"
- **Where:** under the dead-token body, left-aligned
- **Shown:** `dead token`
- **Enabled:** always
- **Does:** navigates to V-RESET-REQUEST
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link inside the alert container
- **Tests:** `getByRole("link", { name: "Wyślij nowy link" })` visible — `reset-password.spec.ts`
- **Source:** `new-password-form.tsx` — `NewPasswordForm`

#### Flows and rules

- Nothing is checked on load: any non-empty `token` shows the form (e2e opens `?token=test-token`); a forged,
  used or expired token is discovered only at submit.
- Submit sequence: clear the form error → `passwordSchema` → field error and stop, or clear it → request →
  `done` / `dead token` / form error.
- Two tabs opened from one link both show the form; the first successful submit consumes the token and the
  other gets `dead token`.
- The token stays in the address bar and history in every state; nothing rewrites the URL.
- Success does not sign in; a 2FA account is still challenged at the next login.
- Tab order: `form` — password → submit; `done` — „Zaloguj się”; `invalid` and `dead token` — „Wyślij nowy link”.

#### Decisions

- `D-AUTH-21` — The link is valid 60 minutes and works once; a token that dies between opening the page and
  submitting swaps the form for "request a new link", because "only a fresh link can help". Source: A3;
  `auth.ts` `resetPasswordTokenExpiresIn` comment; `new-password-form.tsx` comment.
- `D-AUTH-22` — A completed reset revokes every session of the account ("the old password may be in someone
  else's hands"; A3 is silent on sessions) and first cancels any pending e-mail change, because the change
  notice advises a reset as the recovery action. Source: `auth.ts` `revokeSessionsOnPasswordReset` and
  `onPasswordReset` comments (decision of 01.09.2026, #10).

#### Findings

- `F-AUTH-17` — One outcome, two renderings: a dead link detected on load gets an h1 „Nieprawidłowy link” with
  body and link, while the same link detected at submit keeps the h1 „Ustaw nowe hasło” above a heading-less
  alert — the page still invites setting a password that can no longer be set. Evidence:
  `reset-password/new/page.tsx` (`token ? … : <h1>{t("invalid.heading")}</h1>`) vs `new-password-form.tsx`
  (`outcome === "invalidToken"` block without a heading).

### V-TWO-FACTOR — second-factor challenge after the password

- **Screenshots:** `v-two-factor--desktop` (Appendix A)
- **Route:** `/two-factor` (en `/en/two-factor`), optional `?methods=<comma-separated list>` —
  `src/app/[locale]/(auth)/two-factor/page.tsx` (`TwoFactorPage`), `two-factor/modes.ts` (`resolveModes`,
  `Mode`), `two-factor/two-factor-challenge.tsx` (`TwoFactorChallenge`). Title `TwoFactor.title` — pl
  „Weryfikacja dwuskładnikowa” · en "Two-factor verification".
- **Reached by:** V-LOGIN, after a correct password for an account with two-factor on (`router.push`). Anyone
  can open it directly. Signed out and without a live challenge, every send and every verification fails
  (F-AUTH-20). Signed in, the endpoints use the session instead of a challenge: „Wyślij kod na e-mail” mails a
  code to that account. A correct code on an account with two-factor off turns e-mail two-factor on, with no
  password (better-auth `otp/index.mjs` `verifyTwoFactorOTP`). „Aplikacja” completes an unfinished
  authenticator setup the same way, and „Kod zapasowy” uses up a backup code.
- **Purpose:** pass the second factor and receive the session (#29).
- **Arrives from → leaves to:** from V-LOGIN. Success → `/onboarding` (→ `/{handle}` when the user has a
  handle). Footer → V-LOGIN.
- **Available modes (`resolveModes(methods)`):** split `methods` on commas and drop empty parts; absent or
  empty → treated as `["otp","totp"]`. The result has a fixed order regardless of the URL: `totp` if listed,
  `otp` if listed, `backup` if `totp` listed; nothing recognised → `["otp"]`. The sign-in response lists
  `totp` when the account has a verified authenticator and always lists `otp` (the server has an e-mail code
  sender configured), so real outcomes are: authenticator account → `totp, otp, backup` (starts on `totp`);
  e-mail-code account → `otp` only (no method row); direct visit → all three. The first mode is selected on
  load.
- **Layout (top → bottom):** C-AUTH-SHELL; card: h1 `TwoFactor.heading`; method row (only with 2+ modes):
  „Aplikacja” pill with a phone icon, „Kod e-mail” pill, „Kod zapasowy” as a muted underlined text button, in
  one wrapping row; intro line for the active mode; e-mail mode only: quiet "send code" button and its sent
  status; form: code field (monospace, at most 140px wide), error alert (when any), full-width submit. Footer
  line: „Wróć do logowania” (muted link).
  - `phone`: pills and the backup/send buttons get the 48px floor; pills have 12px side padding (8px from
    `sm`); at 360px the two pills share a line and „Kod zapasowy” wraps below (per the `MODE_PILL` comment).
- **Server calls:**
  - `authClient.twoFactor.sendOtp()` → `POST /api/auth/two-factor/send-otp` — the "send code" button. 200 →
    sent status, code field and submit enabled; a 6-digit code valid 3 minutes goes to the account address,
    and each send replaces the previous code. 429 (20 per hour per IP, #29) → `TwoFactor.errors.rateLimited`.
    Other status (401 no or expired challenge) or no response → `TwoFactor.errors.generic`.
  - Submit, by active mode: `authClient.twoFactor.verifyTotp({ code })` → `POST …/two-factor/verify-totp`;
    `verifyOtp({ code })` → `POST …/two-factor/verify-otp`; `verifyBackupCode({ code })` →
    `POST …/two-factor/verify-backup-code`. `trustDevice` is never sent.
    - 200 → session cookie set, challenge cleared → `router.push("/onboarding")`.
    - 401 → `TwoFactor.errors.invalidCode`: a wrong code or backup code — and also a missing, expired (600 s)
      or consumed challenge (`INVALID_TWO_FACTOR_COOKIE`).
    - 429 → `TwoFactor.errors.locked`: account lockout (`ACCOUNT_TEMPORARILY_LOCKED`) or the per-IP limit of
      3 requests per 10 s on `/two-factor/*`.
    - any other status or no response → `TwoFactor.errors.generic`: 400 `OTP_HAS_EXPIRED` (code older than
      3 min, or none sent in this challenge), 400 `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`, 400
      `TOTP_NOT_ENABLED` / `BACKUP_CODES_NOT_ENABLED` (no authenticator on the account), 409 (the same backup
      code used concurrently). See F-AUTH-19, F-AUTH-20.

#### Elements

##### `TWO-FACTOR.methods.group` — group

- **Label:** `TwoFactor.methodsLabel` — pl „Wybierz metodę weryfikacji” · en "Choose a verification method"
  (accessible name only, not visible)
- **Where:** first block in the card, under the h1
- **Shown:** when more than one mode is available
- **Enabled:** n/a
- **Does:** holds the method options
- **States:** none of its own
- **Input:** no roving focus or arrow keys; each option is its own Tab stop
- **A11y:** `role="group"` with `aria-label`
- **Tests:** none directly
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge`

##### `TWO-FACTOR.methods.pill` — toggle button ×2 (App, E-mail code)

- **Label:** `TwoFactor.methods.totp` — pl „Aplikacja” · en "App" (decorative 16px phone icon before it);
  `TwoFactor.methods.otp` — pl „Kod e-mail” · en "E-mail code"
- **Where:** in the group, in the order totp, otp
- **Shown:** when the group is shown and that mode is available
- **Enabled:** always, also while sending or verifying
- **Does:** `switchMode(option)` — selects the mode and clears the typed code, the error and the "code sent"
  flag; runs even when the option is already selected (F-AUTH-21)
- **States:** selected (strong border, sunken background, semibold text) / idle (default border; hover
  darkens it)
- **Input:** click, tap, Enter/Space; `type="button"`
- **A11y:** `aria-pressed` true/false
- **Tests:** `getByRole("button", { name: "Aplikacja" })`, `getByRole("button", { name: "Kod e-mail" })` —
  `e2e/two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge`, `MODE_PILL`, `MODE_PILL_SELECTED`,
  `MODE_PILL_IDLE`

##### `TWO-FACTOR.methods.backup` — toggle button (text-link style)

- **Label:** `TwoFactor.methods.backup` — pl „Kod zapasowy” · en "Backup code"
- **Where:** last in the group
- **Shown:** when the group is shown and `totp` is available
- **Enabled:** always
- **Does:** `switchMode("backup")`, same as the pills (D-AUTH-25)
- **States:** no visual selected style — selection shows only through `aria-pressed`, the intro line and the
  field label
- **Input:** click, tap, Enter/Space; `type="button"`; 48px min-height on `phone`
- **A11y:** `aria-pressed` true/false
- **Tests:** `getByRole("button", { name: "Kod zapasowy" })` — `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge`

##### `TWO-FACTOR.intro` — text (changes with the mode)

- **Label:** `TwoFactor.intro.totp` — pl „Wpisz kod z aplikacji uwierzytelniającej.” · en "Enter the code from
  your authenticator app."; `TwoFactor.intro.otp` — pl „Wyślemy 6-cyfrowy kod na adres e-mail Twojego konta.”
  · en "We will send a 6-digit code to your account's e-mail address."; `TwoFactor.intro.backup` — pl „Wpisz
  jeden ze swoich kodów zapasowych.” · en "Enter one of your backup codes."
- **Where:** under the method row (or under the h1 when there is no row)
- **Shown:** always, text per mode
- **Enabled:** n/a
- **Does:** explains the active method
- **States:** totp / otp / backup
- **A11y:** plain paragraph, not live
- **Tests:** none
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge`

##### `TWO-FACTOR.otp.send` — button (quiet)

- **Label:** `TwoFactor.otp.send` — pl „Wyślij kod na e-mail” · en "Send a code to my e-mail"; after a
  successful send `TwoFactor.otp.resend` — pl „Wyślij kod ponownie” · en "Send the code again"; busy
  `TwoFactor.otp.sending` — pl „Wysyłanie…” · en "Sending…"
- **Where:** under the intro, above the form, left-aligned
- **Shown:** mode `otp`
- **Enabled:** disabled while its request runs
- **Does:** clears the error, calls `sendOtp()`; success sets "code sent" (enables the field and submit);
  failure shows the error alert. Nothing is sent automatically when the page opens.
- **States:** send / busy / resend
- **Input:** click, tap, Enter/Space; `type="button"`, outside the form
- **A11y:** native button; 48px min-height on `phone`
- **Tests:** `getByRole("button", { name: "Wyślij kod na e-mail" })` — `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge.sendCode`

##### `TWO-FACTOR.otp.status` — status line

- **Label:** `TwoFactor.otp.sent` — pl „Kod wysłany — sprawdź skrzynkę.” · en "Code sent — check your inbox."
- **Where:** directly under the send button
- **Shown:** mode `otp` after a successful send, until the mode is switched — also during a resend and after
  a failed resend (F-AUTH-23)
- **Enabled:** n/a
- **Does:** confirms the send
- **States:** hidden / shown (success colour)
- **A11y:** `<p role="status">`
- **Tests:** `getByText("Kod wysłany — sprawdź skrzynkę.")` — `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge` (`otpSent`)

##### `TWO-FACTOR.form.code` — text field

- **Label:** `TwoFactor.codeLabel` — pl „Kod” · en "Code" (modes totp, otp); `TwoFactor.backupLabel` — pl „Kod
  zapasowy” · en "Backup code" (mode backup)
- **Where:** first in the form
- **Shown:** always
- **Enabled:** in mode `otp` disabled until a code has been sent since the mode was last selected; always
  enabled in `totp` and `backup`
- **Does:** holds the code, sent exactly as typed; only the emptiness check trims (F-AUTH-22)
- **States:** idle / disabled (sunken background) / invalid (whenever the error alert shows, including a send
  error)
- **Input:** `type="text"`, `inputMode="numeric"` (totp, otp) or `"text"` (backup),
  `autoComplete="one-time-code"`, `name="code"`, `id="code"`, `required`, monospace; no `maxLength`,
  `pattern`, `autoCapitalize`, `autoCorrect` or `spellCheck`; Enter submits. Server formats: 6 digits (TOTP
  accepts the current 30-s step ±1; e-mail code); backup codes `xxxxx-xxxxx` of mixed-case letters and digits,
  compared case-sensitively, each usable once (10 issued).
- **A11y:** `<label for="code">`; `aria-invalid="true"` and `aria-describedby="code-error"` while an error
  shows
- **Tests:** `getByLabel("Kod")` `toBeDisabled()` before sending, then `fill("123456")`; `fill("000000")` in
  App mode — `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge` (`code`, `codeReady`)

##### `TWO-FACTOR.form.error` — alert

- **Label:** `TwoFactor.errors.codeRequired` — pl „Wpisz kod.” · en "Enter the code.";
  `TwoFactor.errors.invalidCode` — pl „Nieprawidłowy kod. Spróbuj ponownie.” · en "Invalid code. Try again.";
  `TwoFactor.errors.locked` — pl „Zbyt wiele prób. Konto jest chwilowo zablokowane — spróbuj później.” · en
  "Too many attempts. The account is temporarily locked — try again later."; `TwoFactor.errors.rateLimited`
  (send only) — pl „Zbyt wiele żądań. Odczekaj chwilę i spróbuj ponownie.” · en "Too many requests. Wait a
  moment and try again."; `TwoFactor.errors.generic` — pl „Weryfikacja nie powiodła się. Spróbuj ponownie.” ·
  en "Verification failed. Try again."
- **Where:** under the code field, above the submit (inside the form)
- **Shown:** after an empty submit, a failed verification or a failed send; cleared when a send or submit
  starts and on every mode switch
- **Enabled:** n/a
- **Does:** reports the problem; the typed code is kept
- **States:** hidden / one message
- **A11y:** `<p id="code-error" role="alert">`
- **Tests:** `getByText("Nieprawidłowy kod. Spróbuj ponownie.")` — `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge` (`error`)

##### `TWO-FACTOR.form.submit` — button

- **Label:** `TwoFactor.submit` — pl „Potwierdź” · en "Confirm"; busy `TwoFactor.submitting` — pl
  „Sprawdzanie…” · en "Checking…"
- **Where:** full width, last in the form
- **Shown:** always
- **Enabled:** disabled while verifying, and in mode `otp` until a code has been sent
- **Does:** clears the error; empty code (after trim) → `codeRequired`, no request; otherwise verifies with
  the active mode's endpoint and routes as in "Server calls"
- **States:** idle / busy / disabled (otp, not sent)
- **Input:** click, tap, Enter in the code field
- **A11y:** native submit button
- **Tests:** `getByRole("button", { name: "Potwierdź" })`, then `toHaveURL(/\/login$/)` in the DB-less run —
  `two-factor.spec.ts`
- **Source:** `two-factor-challenge.tsx` — `TwoFactorChallenge.handleSubmit`

##### `TWO-FACTOR.footer.back` — link

- **Label:** `TwoFactor.backToLogin` — pl „Wróć do logowania” · en "Back to login"
- **Where:** footer line under the card, muted tone
- **Shown:** always
- **Enabled:** always
- **Does:** navigates to V-LOGIN; the pending challenge is left as it is and a new sign-in replaces it
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link
- **Tests:** `getByRole("link", { name: "Back to login" })` at `/en/two-factor` — `two-factor.spec.ts`
- **Source:** `two-factor/page.tsx` — `TwoFactorPage`

#### Flows and rules

- **Guessing limits (server):**
  - authenticator and backup codes — every wrong code is a 401 and counts twice: toward 5 per challenge (the
    sixth attempt ends the challenge with a 400, whatever the code) and toward 10 consecutive failures per
    account across challenges, which lock the second factor for 15 minutes (429); a success resets the
    account counter;
  - e-mail code — 5 wrong guesses per code (then 400 until a new code is sent); lifetime 3 minutes; sender 20
    per hour per IP; an account that also has an authenticator is subject to its account lockout here too,
    an e-mail-code-only account has no lockout;
  - all three verification endpoints — 3 requests per 10 s per IP.
- **Challenge lifetime:** 10 minutes from the password step. Afterwards every send and verification answers
  401 (verification shows „Nieprawidłowy kod”, sending shows the generic error).
- **Mode switch:** resets the code, the error and the sent flag; in `otp` the field stays disabled until
  another send, which replaces the code already sent.
- **Not offered:** "trust this device" (every login of a 2FA account is challenged), a resend countdown, and
  any recovery beyond the page's own modes. An authenticator account falls back to „Kod zapasowy” or „Kod
  e-mail”; an e-mail-code account that has lost its mailbox has no way in.
- **Success:** the same landing as a password-only login (D-AUTH-9).
- **Tab order:** „Aplikacja” → „Kod e-mail” → „Kod zapasowy” → [„Wyślij kod na e-mail” in `otp`] → code field
  → „Potwierdź” → „Wróć do logowania”.

#### Decisions

- `D-AUTH-23` — Two second factors: e-mail codes ("the easy default … zero setup") and an authenticator app
  with backup codes ("the stronger option that also survives a compromised mailbox"). This supersedes the
  TOTP-only acceptance criterion written in the #29 issue body. Source: `auth.ts` `twoFactor` plugin comment
  ("decision of 01.09.2026 — both methods"); `src/lib/auth-2fa.test.ts` header.
- `D-AUTH-24` — Modes come from the URL; backup codes "ride on `totp`" because they are issued only with an
  authenticator; an absent list offers every way "and let[s] the server reject what does not apply". Source:
  `modes.ts` comment.
- `D-AUTH-25` — „Kod zapasowy” is styled as a text link, not a pill: backup "reads as a lightweight fallback,
  not a co-equal choice", with the same button semantics and click handler. Source:
  `two-factor-challenge.tsx` comment (design-system-source's "use a backup code" link).
- `D-AUTH-26` — Guessing limits differ by method and are not to be loosened without a per-account cap for
  e-mail codes: authenticator/backup — per-account lockout (10 failures → 15 min) plus 5 per challenge;
  e-mail code — 5 guesses per code, ~3 min lifetime, sender capped at 20 per hour per IP because "every login
  of an e-mail-OTP account sends a code". Source: `auth.ts` plugin and `/two-factor/send-otp` comments (#29).

#### Findings

- `F-AUTH-18` — Security, already open as issue #59: the e-mail code is offered to, and accepted for, accounts protected by an authenticator app —
  the server lists `otp` for every 2FA account because an e-mail sender is configured, `resolveModes` passes
  it through, and `verify-otp` does not check how the account enrolled. Whoever holds the mailbox can pass
  the challenge — and since a password reset also goes by e-mail and leaves 2FA on, the mailbox alone is
  enough to take over such an account. This contradicts `auth.ts` ("the stronger option that also survives a
  compromised mailbox"), `Settings.account.twoFactor.app.description` („Silniejsza ochrona — kod z aplikacji
  działa nawet, gdy ktoś przejmie Twoją skrzynkę.” · "Stronger protection — a code from an app works even if
  someone takes over your mailbox.") and #29's reason for an authenticator. No test pins either way
  (`auth-2fa.test.ts` asserts only `toContain("totp")`). Evidence: better-auth 1.7.2
  `plugins/two-factor/index.mjs` sign-in hook (`if (options?.otpOptions?.sendOTP) twoFactorMethods.push("otp")`);
  `plugins/two-factor/otp/index.mjs` `verifyTwoFactorOTP`; `modes.ts` `resolveModes`.
- `F-AUTH-19` — Every 429 from a verification shows „Zbyt wiele prób. Konto jest chwilowo zablokowane —
  spróbuj później.”, but a 429 is also the per-IP limit of 3 verification requests per 10 s, and
  e-mail-code-only accounts are never locked — such a person is told the account is locked after four quick
  attempts. `TwoFactor.errors.rateLimited` exists but is used only for sending. Evidence:
  `two-factor-challenge.tsx` `handleSubmit` (`status === 429` → `errors.locked`); better-auth
  `plugins/two-factor/index.mjs` `rateLimit` (`/two-factor/`, window 10, max 3); `auth.ts` comment ("the
  account lockout does NOT apply to it").
- `F-AUTH-20` — Outcomes that need another action than "try again" get a wrong or vague message, against
  SPEC §1 ("writing an error somebody can act on"): (a) a missing, expired (10 min) or consumed challenge
  answers 401 → „Nieprawidłowy kod. Spróbuj ponownie.” on every attempt — including after five wrong
  authenticator/backup codes, when the sixth attempt ends the challenge with the generic error and even the
  right code is "invalid" from then on; only signing in again helps and nothing says so; (b) an e-mailed code
  that expired (3 min) or took five wrong guesses → 400 → „Weryfikacja nie powiodła się. Spróbuj ponownie.”,
  although only a new code helps; (c) „Aplikacja” or „Kod zapasowy” on an account without an authenticator
  (direct visit, edited URL) → 400 → generic; (d) a direct visit while signed out shows a working-looking
  form whose send button answers the generic error (signed in, the send succeeds and a correct code turns
  two-factor on, see "Reached by"). Evidence: `two-factor-challenge.tsx` status mapping; better-auth
  `plugins/two-factor/verify-two-factor.mjs` (`INVALID_TWO_FACTOR_COOKIE` 401, `beginAttempt` 400),
  `otp/index.mjs` (`OTP_HAS_EXPIRED`, `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`), `totp/index.mjs`,
  `backup-codes/index.mjs` (`TOTP_NOT_ENABLED`, `BACKUP_CODES_NOT_ENABLED`).
- `F-AUTH-21` — Switching the method forgets what was done: going to „Aplikacja” and back to „Kod e-mail”
  disables the field again and forces another send (a new e-mail replacing the code already in the inbox,
  counted toward 20 per hour); clicking the already-selected option also wipes the typed code and the error.
  Evidence: `two-factor-challenge.tsx` `switchMode` (`setOtpSent(false)`, no guard for the current mode).
- `F-AUTH-22` — The code is sent exactly as typed and compared exactly: a pasted code with a surrounding space
  is "invalid" (only the emptiness check trims), and a backup code altered by keyboard auto-capitalisation
  fails because backup codes are case-sensitive; the field sets no `autoCapitalize`, `autoCorrect`,
  `spellCheck` or `maxLength`. UNVERIFIED: whether phone keyboards capitalise this field. Evidence:
  `two-factor-challenge.tsx` (`code.trim().length === 0`, then `{ code }`); better-auth `otp/index.mjs`
  (hashes the raw input), `@better-auth/utils` `verifyTOTP` (exact string compare),
  `backup-codes/index.mjs` `verifyBackupCode` (`codes.includes(data.code)`).
- `F-AUTH-23` — A failed resend leaves „Kod wysłany — sprawdź skrzynkę.” next to the new error, and any send
  error marks the code field `aria-invalid` and describes it, although the typed code was not at fault. The
  first half may be intended (the earlier code can still work). Evidence: `two-factor-challenge.tsx`
  `sendCode` (sets `error`, keeps `otpSent`); `aria-invalid={error ? true : undefined}` on the input.
- `F-AUTH-26` — A signed-in visitor on `/two-factor` can turn e-mail two-factor on with only a code mailed to the account, no password, while V-SETTINGS-ACCOUNT re-asks the password before turning a method on. The page reads no session (F-SHELL-1), „Wyślij kod na e-mail” succeeds for a session, and a correct code on an account with two-factor off sets `twoFactorEnabled: true` and re-issues the session. („Aplikacja” can only complete an authenticator setup already started, which asked for the password — the same as the settings' „Aktywuj”.) Practical risk is low — the code goes to the account's own mailbox — but it breaks the rule the settings screen keeps. Evidence: better-auth 1.7.2 `dist/plugins/two-factor/verify-two-factor.mjs` `verifyTwoFactor` (falls back to `getSessionFromCtx`), `dist/plugins/two-factor/otp/index.mjs` (the `!session.user.twoFactorEnabled` branch), `dist/plugins/two-factor/totp/index.mjs` (the `twoFactor.verified !== true` branch); `src/lib/auth.ts` `hooks.before` gates only `/verify-email`. Related: #59 (open).

### V-EMAIL-CHANGED — e-mail-change link landing

- **Screenshots:** `v-email-changed--desktop` (Appendix A)
- **Route:** `/email-changed` (en `/en/email-changed`), optional `?error=<CODE>` / `?status=done` —
  `src/app/[locale]/(auth)/email-changed/page.tsx` (`EmailChangedPage`, `changeState`). Title
  `EmailChanged.title` — pl „Zmiana adresu” · en "Address change".
- **Reached by:** the two links of an e-mail change requested in account settings (A10, #10), both
  `GET /api/auth/verify-email?token=…&callbackURL=/email-changed` (en `/en/email-changed`, set by
  `settings/account/change-email-form.tsx`): step 1, sent to the current address, answers 302 plain after the
  approval; step 2, sent to the new address, answers 302 with `?status=done` after the switch; a rejected link
  answers 302 with `?error=<CODE>`. Any viewer; a direct visit renders by the same rule.
- **Purpose:** say which step of the two-step change just happened, or why the link failed.
- **Arrives from → leaves to:** from the "confirm your e-mail address change" and "confirm your new e-mail
  address" messages. Leaves to `/settings/account` (a signed-out visitor goes through V-LOGIN; the step-2 click
  signs the browser in when it had no session).
- **States (`changeState(error, status)`, first match wins):** `expired` — `error=TOKEN_EXPIRED` · `invalid` —
  any other `error` (`INVALID_TOKEN` from the pending-change gate: a newer request, a password reset, an
  expired pending-change record, a forged or legacy link; `USER_NOT_FOUND`: no account holds the link's address
  any more — the change was completed, or the account was deleted; `INVALID_USER` when the browser is signed in
  as a different account; a bad signature) · `changed` — no `error` and `status=done` · `approved` — everything
  else, including a direct visit (F-AUTH-14).
- **Layout (top → bottom):** C-AUTH-SHELL; card: h1, muted body, link. No medallion, no footer line
  (F-AUTH-1). No `phone` difference beyond the shell.
- **Server calls:** none — the state comes from the query.

#### Elements

##### `EMAIL-CHANGED.card.outcome` — result (heading + body)

- **Label:** changed — h1 `EmailChanged.changedHeading` — pl „Adres zmieniony” · en "Address changed"; body
  `EmailChanged.changedBody` — pl „Adres e-mail Twojego konta został zmieniony. Od teraz loguj się nowym
  adresem.” · en "Your account's e-mail address has been changed. From now on, log in with the new address." ·
  approved — h1 `EmailChanged.approvedHeading` — pl „Zmiana zatwierdzona” · en "Change approved"; body
  `EmailChanged.approvedBody` — pl „Dziękujemy. Wysłaliśmy link na nowy adres — otwórz go i kliknij, aby
  dokończyć zmianę. Do tego czasu adres konta pozostaje bez zmian.” · en "Thanks. We sent a link to the new
  address — open it and click to finish the change. Until then your account address stays the same." ·
  expired — h1 `EmailChanged.expiredHeading` — pl „Link wygasł” · en "The link has expired"; body
  `EmailChanged.expiredBody` — pl „Link był ważny przez 24 godziny. Zaloguj się i poproś o zmianę ponownie.” ·
  en "The link was valid for 24 hours. Log in and request the change again." · invalid — h1
  `EmailChanged.invalidHeading` — pl „Nieprawidłowy link” · en "Invalid link"; body `EmailChanged.invalidBody`
  — pl „Ten link jest niepoprawny, został unieważniony (np. przez reset hasła albo nowszą prośbę) lub już
  wykorzystany.” · en "This link is invalid, has been revoked (for example by a password reset or a newer
  request) or has already been used."
- **Where:** the card, under the logo
- **Shown:** one of the four, per query
- **Enabled:** n/a
- **Does:** states the outcome (keys are built as `` `${state}Heading` `` / `` `${state}Body` ``)
- **States:** changed / approved / expired / invalid
- **A11y:** static page content; no icon
- **Tests:** `toHaveTitle("Zmiana adresu")`; h1 „Zmiana zatwierdzona” at `/email-changed`; h1 „Adres zmieniony”
  at `?status=done`; h1 „Link wygasł” at `?error=TOKEN_EXPIRED`; h1 „Nieprawidłowy link” and
  `getByText("został unieważniony", { exact: false })` at `?error=INVALID_TOKEN`; h1 "Invalid link" at
  `/en/email-changed?error=USER_NOT_FOUND` — `e2e/settings.spec.ts`
- **Source:** `email-changed/page.tsx` — `EmailChangedPage`, `changeState`

##### `EMAIL-CHANGED.card.settings` — link

- **Label:** `EmailChanged.settingsLink` — pl „Przejdź do ustawień konta” · en "Go to the account settings"
- **Where:** under the body, inside the card
- **Shown:** all four states
- **Enabled:** always
- **Does:** navigates to `/settings/account`; signed out → the (app) gate sends the visitor to V-LOGIN, whose
  success then lands on `/onboarding`, not on settings (F-AUTH-7)
- **States:** none
- **Input:** click, tap, Enter
- **A11y:** link; no touch floor (F-AUTH-3)
- **Tests:** `getByRole("link", { name: "Przejdź do ustawień konta" })`, `getByRole("link", { name: "Go to the
  account settings" })` — `settings.spec.ts`
- **Source:** `email-changed/page.tsx` — `EmailChangedPage`

#### Flows and rules

- Step 1 (approval from the current address) sends the step-2 link to the new address and changes nothing
  yet; opening the step-1 link again while the change is pending sends another step-2 link and shows
  `approved` again.
- Step 2 switches the address, marks it verified, clears the pending-change record and signs the browser in if
  it had no session.
- Links are honoured only while the account's single pending-change record matches them (24 h from the
  request); a newer request or a password reset (V-RESET-NEW) sends every older link to `invalid`, and so does
  the completed change within 24 h (after that: `expired`, F-AUTH-24).
- Tab order: the settings link only.

#### Decisions

- `D-AUTH-27` — The change is two-step and the landing tells the steps apart only by query: the old address
  approves first, so "a stolen session alone cannot move the account"; the server appends `status=done` to
  the step-2 link "so the page says 'changed', not the approval step's 'check your new inbox'"; one
  pending-change record per user gates both links, so a newer request or a password reset kills older links.
  Source: A10; #10 (option B, decision of 01.09.2026); `email-changed/page.tsx` comment; `auth.ts`
  `withCallbackStatus`, `emailChangeMarker`, `sendChangeEmailConfirmation` comments.

#### Findings

- `F-AUTH-24` — For a change that is still pending, an aged-out link lands on „Nieprawidłowy link”, not „Link
  wygasł”: the `/verify-email` gate in `auth.ts` runs before the endpoint's own expiry check and answers
  `INVALID_TOKEN` once the pending-change record has expired, and that record — same 24-hour lifetime — is
  written a moment after the step-1 token is signed and before the step-2 token exists, so the gate answers
  first (except within that moment). „Link wygasł” then appears only when a link of an already completed change
  is opened more than 24 h later (where „Zaloguj się i poproś o zmianę ponownie” is the wrong advice) or on a
  direct visit, and the invalid body never mentions expiry. No test ages a link (`auth-account.test.ts` covers
  revoked and forged links). UNVERIFIED: settle with an integration test that moves past 24 h. Evidence:
  `auth.ts` `hooks.before` (`marker.expiresAt < new Date()` → `reject()` → `error=INVALID_TOKEN`) and
  `recordPendingEmailChange`; better-auth 1.7.2 `api/routes/update-user.mjs` (token signed before
  `sendChangeEmailConfirmation`), `api/routes/email-verification.mjs` (`JWTExpired` → `TOKEN_EXPIRED`).
- `F-AUTH-25` — A person whose browser is signed in as a different account gets `INVALID_USER`, shown as the
  generic invalid copy that blames a link which is in fact fine (signing out or another browser would work);
  the page has no copy for that case. Evidence: better-auth `api/routes/email-verification.mjs`
  (`session.user.email !== parsed.email` → `INVALID_USER`); `changeState` (every error except `TOKEN_EXPIRED`
  → `invalid`).

## 6. Onboarding and account settings

### V-ONBOARDING — name, then profile address

- **Route:** `/onboarding` (en `/en/onboarding`) — `src/app/[locale]/(app)/onboarding/page.tsx` (`OnboardingPage`). Tab title `Onboarding.title` — pl „Adres profilu” · en "Profile address" (same on both steps).
- **Reached by:** `no-handle` only. `signed-out`, or a session that cannot be verified (no database included) → server redirect to `/login` (en `/en/login`) by the `(app)` gate (`(app)/layout.tsx` `AppLayout`), repeated in the page. A signed-in user who already has a handle → server redirect to `/{handle}`.
- **Purpose:** the one step between login and the app: set the profile name, then claim the public address derived from it.
- **Arrives from → leaves to:** from a successful login (`login-form.tsx` `router.push("/onboarding")`), a passed 2FA challenge (`two-factor-challenge.tsx`), `/register/verified` link `Register.verified.onboardingLink` „Ustaw adres profilu”, `/` and the 404 page's home link for a signed-in `no-handle` visitor (`signedInDestination`), and — for `no-handle` — the settings page's logo and account-menu „Profil” (both point at `/`, which forwards here). Leaves only by a successful claim → `/{handle}` (client `router.push`, locale-aware). The page has no top bar, logo, sign-out, settings link or language switch (F-ACCOUNT-6).
- **Layout (top → bottom):**
  - `<main>`: full viewport height (`min-h-svh`), page background, padding 16px (24px from `sm`).
  - Card (full width; 420px from `md`; large padding 40px, 48px from `sm`):
    - step badge;
    - step one: h1 `Onboarding.nameStepHeading` — pl „Ustaw nazwę profilu” · en "Set your profile name"; name field with hint; „Dalej”;
    - step two: h1 `Onboarding.heading` — pl „Ustaw adres profilu” · en "Set your profile address"; intro `Onboarding.intro` — pl „To publiczny adres Twojego profilu. Zaproponowaliśmy go na podstawie nazwy konta — możesz go zmienić.” · en "This is the public address of your profile. We prefilled a proposal based on your account name — change it if you like."; C-HANDLE-FORM `mode="onboarding"`.
    - both h1s use the h2 font size below `sm`, the h1 size from `sm`.
  - Plaque column: plaque (260px) and its caption.
  - From `md` (≥ 48rem): card and plaque side by side (card left, 64px gap), the pair centred vertically. Below `md` (`phone` included): stacked — card on top, plaque under it (32px gap), top-aligned.
- **Server calls:**
  - Page render: `getHandleState` (forward when a handle exists), `suggestHandle` (the fallback proposal passed as `fallbackHandle`).
  - Step one: none.
  - Step two: see C-HANDLE-FORM — `GET /api/handle/availability`, `POST /api/profile/handle` with `{ handle, displayName }`. The display-name upsert `POST /api/profile` is NOT called by onboarding: the name rides with the claim.

#### Elements

##### `ONBOARDING.card.step-badge` — status text

- **Label:** `Onboarding.stepBadge` — pl „Krok {step} z 2” · en "Step {step} of 2"; {step} = 1 on the name step, 2 on the address step. Shown uppercase by CSS (`type-eyebrow`); DOM text is mixed case.
- **Where:** first line in the card, above the step's h1.
- **Shown:** `no-handle`, both steps.
- **Does:** tells which step is open (`handle === null` → 1).
- **A11y:** plain `<span>` (`Badge`); not a live region — the step change is not announced (F-ACCOUNT-3).
- **Tests:** none.
- **Source:** `src/app/[locale]/(app)/onboarding/onboarding-steps.tsx` — `OnboardingSteps`

##### `ONBOARDING.name.field` — text field

- **Label:** `Onboarding.nameLabel` — pl „Twoja nazwa” · en "Your name". Hint `Onboarding.nameHint` — pl „Tak podpiszemy Twój profil. Adres poniżej podpowiadamy z niej — możesz go zmienić.” · en "How your profile is signed. The address below is proposed from it — you can change it."
- **Where:** step one, under the h1; hint under the input.
- **Shown:** step one.
- **Enabled:** always.
- **Does:** holds the display name in page state; every keystroke updates the plaque (trimmed). The value survives step two and is shown again after „Wstecz”.
- **States:** empty or whitespace-only → „Dalej” disabled. No error message exists on this step.
- **Input:** typing; Enter submits step one only when the trimmed value is non-empty.
- **A11y:** `<label for="display-name">`; `input#display-name` `name="displayName"` `type="text"` `autocomplete="name"` `autofocus` `maxlength=80` (`DISPLAY_NAME_MAX`) `required`, `aria-describedby="display-name-hint"`. Focused on arrival and when step one remounts after „Wstecz”.
- **Tests:** `e2e/db/happy-path.spec.ts`, `e2e/db/account.ts` `completeOnboarding` — `getByLabel("Twoja nazwa")`; after login both wait for `getByRole("heading", { level: 1, name: "Ustaw nazwę profilu" })` (also `e2e/db/password-reset.spec.ts`).
- **Source:** `onboarding-steps.tsx` — `OnboardingSteps`; `src/lib/profile-schemas.ts` — `DISPLAY_NAME_MAX`

##### `ONBOARDING.name.next` — button (submit)

- **Label:** `Onboarding.next` — pl „Dalej” · en "Next".
- **Where:** under the name field, left-aligned; large size.
- **Shown:** step one.
- **Enabled:** only when `displayName.trim()` is non-empty (the submit handler refuses an empty name too).
- **Does:** no server call. Computes the address proposal and opens step two: `handleBaseFrom(trimmedName)` — diacritics stripped, `ł ø đ ß æ œ` transliterated, every other run of non-`[a-z0-9]` → one hyphen, cut to 30, e.g. „Pracownia Żółć” → `pracownia-zolc` — or, when that yields nothing usable (under 3 characters, or refused by `checkHandle` as reserved), the server's `fallbackHandle`. The proposal is not checked for availability here.
- **States:** disabled / enabled; no busy state.
- **Input:** click, tap, Enter in the field, Enter/Space on the button.
- **A11y:** native `<button type="submit">`. It unmounts on success and focus is not moved anywhere (F-ACCOUNT-3).
- **Tests:** `e2e/db/happy-path.spec.ts` — `getByRole("button", { name: "Dalej" })` `toBeDisabled()` before filling, `toBeEnabled()` after; `e2e/db/account.ts`. Unit: `src/lib/handle.test.ts` ("handleBaseFrom (the onboarding proposal)").
- **Source:** `onboarding-steps.tsx` — `OnboardingSteps` form `onSubmit`; `src/lib/handle.ts` — `handleBaseFrom`; `src/lib/profile-handle.ts` — `suggestHandle`

##### `ONBOARDING.plaque.sign` — decorative live preview

- **Label:** no dictionary key for the sign itself: `Plaque` defaults `name = "Architektów"` (placeholder) and `footer = "Architektów 3d"` (red band) are hard-coded (F-ACCOUNT-4). Caption `Onboarding.plaqueCaption` — pl „Twoje portfolio pod dobrym adresem.” · en "Your portfolio, at a good address."
- **Where:** right of the card from `md`; under the card below `md`; caption centred under the sign (max 16rem).
- **Shown:** both steps.
- **Does:** shows the trimmed name typed in step one, live per keystroke, in a navy field over a red band; empty name → „Architektów”. The font size shrinks with the name's length to stay on one line (overflow clipped). Width 260px, no tilt, shadow. Keeps showing the name on step two; never shows the address.
- **A11y:** plain text in `<div>`/`<span>`, not `aria-hidden`; read after the card.
- **Tests:** none.
- **Source:** `onboarding-steps.tsx` — `OnboardingSteps`; `src/components/ui/plaque.tsx` — `Plaque`

#### Flows and rules

- Step state lives only in `OnboardingSteps` (`useState`): the URL never changes between steps. Browser Back from either step leaves the page. A reload returns to step one with an empty name.
- One → two („Dalej”): the proposal is derived from the name at that moment (see the button). C-HANDLE-FORM mounts prefilled with it; its live check runs 400 ms later.
- Two → one („Wstecz”): C-HANDLE-FORM unmounts — the typed address, verdict and errors are discarded; the name is kept; the next „Dalej” derives the proposal again from the current name (F-ACCOUNT-1).
- The name sent is `displayName.trim()`. The browser checks only non-empty and 80 characters; the server's `displayNameSchema` (NFC, trim, 1–80, no control/format/line-separator characters) runs only on the claim (F-ACCOUNT-5).
- Success: the server creates the profile row with the name and the handle and leaves `handle_changed_at` NULL (a first assignment starts no A6 lock); the client pushes `/{handle}`, whose h1 is the name (happy-path.spec.ts).
- Focus: name field autofocuses on arrival and after „Wstecz”; nothing is focused after „Dalej” (F-ACCOUNT-3).

#### Decisions

- `D-ACCOUNT-1` — Every `(app)` page (onboarding, settings) is gated server-side and fails closed: a session that cannot be verified, including an environment with no database, counts as signed out and lands on the login page. Source: `(app)/layout.tsx` comment.
- `D-ACCOUNT-2` — Onboarding is its own page between login and the app, not a settings section; a user who already has a handle is forwarded to the profile; a successful claim goes straight to the new profile page because name and photo are edited there. Source: `onboarding/page.tsx` comment (#15, §1); `handle-form.tsx` `handleSubmit` comment (#58).
- `D-ACCOUNT-3` — Two steps, name first: step one cannot be left without a name, the address proposal is derived from it, and the name travels with the address claim so the profile row is created carrying it; a later address change never sends a name. Source: #36 — `onboarding-steps.tsx` header comment, `HandleFormProps.displayName` doc, `api/profile/handle/route.ts` `bodySchema` comment.
- `D-ACCOUNT-4` — Card and plaque sit side by side and centred only from `md`; below it they stack top-aligned (a centred flex item that overflows loses its top edge, making the badge and heading unreachable); height uses `svh` not `vh` (mobile Chrome's address bar); step headings drop to the h2 size below `sm` so each stays on one line. Source: `onboarding/page.tsx` and `onboarding-steps.tsx` comments.

#### Findings

- `F-ACCOUNT-1` — The address is re-derived on every pass through step one and „Wstecz” discards address edits, contrary to the code's own stated rule. Evidence: `onboarding-steps.tsx` header says "the derivation happens ONCE… going back to correct the name and returning leaves the address exactly as it was", and the `onBack` comment says "Deliberately does NOT clear the handle", but `onBack={() => setHandle(null)}` unmounts `HandleForm` (its `value` state is lost) and the step-one `onSubmit` always calls `setHandle(handleBaseFrom(trimmed) ?? fallbackHandle)`; the two lines are as in the #36 commit `5fb9025` (the file was restyled in `3729545` without changing them). Also stale: `onboarding/page.tsx` says the address "comes before the name and the photo", while #36 put the name first.
- `F-ACCOUNT-2` — Onboarding copy predates the two-step split. Evidence: `Onboarding.nameHint` refers to „Adres poniżej” / "The address below" on a step with no address; `Onboarding.intro` says the proposal is based on „nazwy konta” / "your account name", but it comes from the name typed in step one, or from the server fallback (`studio`, `studio-2`…) when that name yields no usable base; `Onboarding.title` „Adres profilu” is the tab title of the name step too.
- `F-ACCOUNT-3` — The step change is not communicated to keyboard or screen-reader users. Evidence: `ONBOARDING.name.next` unmounts on success, `HandleForm`'s input has no `autoFocus`, no heading gets focus, and the badge is not a live region — focus falls to the document. (Returning via „Wstecz” does refocus the name field.)
- `F-ACCOUNT-4` — Duplicate of `F-SHELL-14` (plaque strings outside the dictionaries) and `F-SHELL-15` (the plaque read aloud).
- `F-ACCOUNT-5` — A name the browser accepts can fail only at step two, with a message that blames saving the address. Evidence: step one checks only `trim() !== ""` and `maxLength`; `/api/profile/handle` parses the body with `displayNameSchema` (refuses `\p{Cc}\p{Cf}\p{Zl}\p{Zp}`, e.g. a zero-width joiner inside an emoji or a soft hyphen) → 400 `invalid_request` → `applyServerError` → `HandleForm.errors.generic` „Zapis nie powiódł się. Spróbuj ponownie.” under the address field; retrying can never succeed.
- `F-ACCOUNT-6` — Duplicate of `F-SHELL-6` (no way out of onboarding) and `F-SHELL-4` (no language switch on onboarding or settings).
- `F-ACCOUNT-7` — Submit edge cases in onboarding. Evidence (`handle-form.tsx` `handleSubmit`): `finally { setSubmitting(false) }` runs right after `router.push`, so „Ustaw adres” is enabled again while the profile loads (a second press repeats the POST, a server no-op); „Wstecz” stays enabled during a submit, and a success that arrives after it still navigates; a second tab still on step two that submits a different address after the first tab claimed one performs a full CHANGE in `setHandle` (the same address is a no-op) (`changing` → `handle_changed_at` stamped, redirect row, `Email.handleChanged`, name from that tab ignored) with no `cooldownAhead` warning (that note is settings-only).

### C-HANDLE-FORM — profile address picker

- **Screenshots:** `v-settings-account--desktop` (Appendix A)
- **Used by:** V-ONBOARDING step two (`mode="onboarding"`), V-SETTINGS-ACCOUNT address section (`mode="settings"`). Source: `src/app/[locale]/(app)/handle-form.tsx` — `HandleForm`.
- **Purpose:** claim (first time) or change the account's public handle under A5 (shape, reserved words, uniqueness) and A6 (30-day change limit).
- **Props:** `origin` (APP_URL origin, `appOrigin()`); `mode`; `currentHandle` (onboarding: always `null`); `initialValue` (the proposal, or the current handle); `nextChangeAt` (ISO while the A6 lock runs; onboarding: always `null`); `displayName` (onboarding only, sent with the claim); `onBack` (onboarding only).
- **Differences by mode:**

  | | onboarding | settings |
  | --- | --- | --- |
  | submit label | `submitOnboarding` „Ustaw adres” | `submitSettings` „Zmień adres” |
  | „Wstecz” | shown | absent |
  | body | `{ handle, displayName }` | `{ handle }` |
  | success | `router.push("/{handle}")` | stays; field = stored handle; saved lines; `router.refresh()` |
  | `cooldownAhead` note | never | once a different address is typed |
  | A6 lock / `own` verdict | never (props null) | from the server render |

- **Server calls:**
  - `GET /api/handle/availability?handle=<normalized>` — only for a locally valid value, 400 ms after the value last changed; a newer change clears the timer and aborts the request; an answer is used only while it matches the current value. Answer → verdict: HTTP 429 → `rateLimited`; `{ own: true }` → `own`; `{ available: true }` → `available`; `{ available: false, reason }` → `taken` / `reserved` / `invalid`; anything else (401 signed out, 400 `invalid_request`, network error, unparsable body) → `failed` (no message). Server: session required; 60 checks per 60 s per user (in-memory); query over 64 characters → 400; `own` when the normalized value equals the caller's current handle.
  - `POST /api/profile/handle` — on submit; body `handle` = the field value as typed (already lowercased, not trimmed). 200 `{ ok, handle }` → success (handle normalized). 429 (10 per 60 s per user) → `errors.rateLimited`; 409 `{ error: "taken" }` → verdict `taken`; 409 `{ error: "cooldown", retryAt }` → cooldown message + `router.refresh()`; 400 `invalid` / `reserved` → that verdict's copy; anything else — 401, 403 (cross-site `Sec-Fetch-Site` or foreign `Origin`), 400 `invalid_request` (e.g. a name failing `displayNameSchema`), 400 `displayNameRequired`, a non-JSON answer or a network failure → `errors.generic`.
  - What a success does on the server (`setHandle`, transactional, per-user lock): same as current → no-op; first assignment → profile row upserted with the name, `handle_changed_at` stays NULL; change inside the lock → `cooldown`; change → `handle_changed_at = now`, a `handle_redirects` row keeps the old address answering 301 (`src/proxy.ts`) until someone claims it; claiming any address deletes that address's redirect row; unique-index race → `taken`. After a change the route sends `Email.handleChanged` (best-effort; locale from `NEXT_LOCALE` cookie → `Accept-Language`).

#### Elements

##### `HANDLE-FORM.field.input` — text field

- **Label:** `HandleForm.label` — pl „Adres profilu” · en "Profile address". Hint (always under the preview) `HandleForm.hint` — pl „Od {min} do {max} znaków: małe litery, cyfry i myślniki.” · en "{min} to {max} characters: lowercase letters, digits and hyphens." ({min}=3, {max}=30).
- **Where:** top of the form; the field holds the handle only — no prefix inside it.
- **Shown:** both modes.
- **Enabled:** disabled while the A6 lock runs (`nextChangeAt` set; settings only).
- **Does:** every change lowercases the value as typed, clears the last submit error and the saved lines, and recomputes the verdict from `normalizeHandle` (trim + lowercase).
- **States:** prefilled with `initialValue`; locked (disabled, current handle); see `HANDLE-FORM.field.feedback` for verdicts.
- **Input:** typing, paste (the browser cuts at 30 characters, spaces included); Enter submits when the submit button is enabled.
- **A11y:** `<label for="handle">`; `input#handle` `name="handle"` `type="text"` `autocomplete="off"` `autocapitalize="none"` `spellcheck="false"` `maxlength=30` `required` (form is `noValidate`), monospace; `aria-invalid="true"` only while the feedback line is a problem; `aria-describedby="handle-hint"` plus `handle-feedback` while a feedback line exists.
- **Tests:** `e2e/db/happy-path.spec.ts` — `getByLabel("Adres profilu")`, `expect(field).not.toHaveValue("")` (prefilled), `fill(identity.handle)`; `e2e/db/account.ts` `completeOnboarding` — `getByLabel("Adres profilu")`, `fill(identity.handle)` (no prefill assertion). Settings mode: no e2e. Unit/integration: `src/lib/handle.test.ts`, `src/lib/profile-handle.test.ts`.
- **Source:** `handle-form.tsx` — `HandleForm`; `src/lib/handle.ts` — `normalizeHandle`, `HANDLE_MIN`, `HANDLE_MAX`

##### `HANDLE-FORM.field.preview` — text

- **Label:** visually hidden prefix `HandleForm.addressPreviewLabel` — pl „Twój adres profilu:” · en "Your profile address:"; then `{origin}/` + the normalized value, monospace.
- **Where:** directly under the field, above the hint.
- **Shown:** whenever the normalized value is non-empty — also when invalid, taken or locked.
- **Does:** shows the full address that would be claimed, per keystroke. Same unprefixed form in both locales (no `/en`).
- **A11y:** plain `<p>`; not live; not in `aria-describedby`. Breaks after the slash (`<wbr>`), otherwise anywhere as a last resort (`wrap-break-word`); never truncated.
- **Tests:** none.
- **Source:** `handle-form.tsx` — `HandleForm`

##### `HANDLE-FORM.field.feedback` — status line / alert

- **Label:** one message at a time; the last submit's error wins over the live verdict; nothing while locked:
  - checking — `HandleForm.checking` pl „Sprawdzanie dostępności…” · en "Checking availability…" (neutral, `role="status"`);
  - available — `HandleForm.available` pl „Ten adres jest wolny.” · en "This address is free." (success, status);
  - own — `HandleForm.own` pl „To jest Twój obecny adres.” · en "This is your current address." (neutral, status);
  - taken — `HandleForm.taken` pl „Ten adres jest już zajęty.” · en "This address is already taken." (problem, `role="alert"`);
  - reserved — `HandleForm.reserved` pl „Ta nazwa jest zarezerwowana — wybierz inną.” · en "This name is reserved — pick another one." (alert);
  - invalid — `HandleForm.invalid` pl „Adres musi mieć od {min} do {max} znaków: małe litery, cyfry i myślniki, ale bez myślnika na początku ani na końcu.” · en "The address needs {min} to {max} characters: lowercase letters, digits and hyphens, with no hyphen at the start or end." (alert);
  - rate limited (check or submit) — `HandleForm.errors.rateLimited` pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.” · en "Too many attempts. Wait a moment and try again." (alert);
  - cooldown (submit) — `HandleForm.errors.cooldown` pl „Adres można zmieniać raz na {days} dni.” · en "The address can be changed once every {days} days." ({days}=30), followed by a space and `HandleForm.cooldownNote` with the server's `retryAt` when it sent one (alert);
  - generic (submit) — `HandleForm.errors.generic` pl „Zapis nie powiódł się. Spróbuj ponownie.” · en "Saving failed. Try again." (alert);
  - empty value, or a failed check — no line (F-ACCOUNT-8).
- **Where:** under the hint.
- **Shown:** both modes; never while locked.
- **States:** as listed; submit errors clear on the next keystroke or submit.
- **A11y:** `p#handle-feedback`; its role switches between `status` and `alert` with the tone; the node mounts together with its text.
- **Tests:** `e2e/db/happy-path.spec.ts`, `e2e/db/account.ts` — `getByText("Ten adres jest wolny.")` with a 15 s timeout.
- **Source:** `handle-form.tsx` — `localVerdict`, `remoteResult`, `currentVerdict`, `feedback`, `submitErrorCopy`, `applyServerError`, `PROBLEMS`

##### `HANDLE-FORM.field.cooldown-note` — status line

- **Label:** `HandleForm.cooldownNote` — pl „Następna zmiana możliwa od {date}.” · en "The next change is possible from {date}."; {date} = `nextChangeAt` formatted `dateStyle: "long"` in `Europe/Warsaw`, no time (F-ACCOUNT-9).
- **Where:** under the feedback position.
- **Shown:** settings, while `nextChangeAt` is set: last change under 30 days ago, including right after a successful change (the refresh brings the lock) or after a refused submit (409 → refresh).
- **A11y:** `role="status"`.
- **Tests:** none.
- **Source:** `handle-form.tsx`; `src/lib/handle.ts` — `nextHandleChangeAt`; `src/lib/profile-handle.ts` — `getHandleState`

##### `HANDLE-FORM.field.cooldown-ahead` — text

- **Label:** `HandleForm.cooldownAhead` — pl „Pierwsze ustawienie było bez ograniczeń. Jeśli zmienisz adres teraz, kolejna zmiana będzie możliwa dopiero za {days} dni, a stary adres będzie przekierowywał na nowy, dopóki nie zajmie go ktoś inny.” · en "Setting it the first time was free. Change it now and the next change is only possible in {days} days, while the old address redirects here until somebody else claims it." ({days}=30)
- **Where:** under the feedback position.
- **Shown:** settings only, when not locked, no saved line, and the normalized value is non-empty and differs from the current handle — whatever the verdict. Hidden on arrival for an account with a handle (the field holds it); shown on arrival for `no-handle` (the field holds the proposal, F-ACCOUNT-10).
- **A11y:** plain `<p>`; not live; not in `aria-describedby`.
- **Tests:** none.
- **Source:** `handle-form.tsx` — `HandleForm`

##### `HANDLE-FORM.result.saved` — status line

- **Label:** `HandleForm.saved` — pl „Adres zapisany: {address}” · en "Address saved: {address}"; {address} = `{origin}/{stored handle}`.
- **Where:** under the notes, above the buttons.
- **Shown:** settings, after a successful submit, until the next keystroke or submit.
- **A11y:** `role="status"`; long addresses wrap (`wrap-break-word`).
- **Tests:** none.
- **Source:** `handle-form.tsx` — `handleSubmit`

##### `HANDLE-FORM.result.saved-redirect` — status line

- **Label:** `HandleForm.savedRedirect` — pl „Stary adres przekierowuje na nowy, dopóki ktoś inny go nie zajmie.” · en "The old address redirects to the new one until someone else claims it."
- **Where:** under the saved line.
- **Shown:** with the saved line, when the save replaced an existing handle (decided at submit time: `currentHandle !== null`).
- **A11y:** `role="status"`.
- **Tests:** none.
- **Source:** `handle-form.tsx` — `handleSubmit`

##### `HANDLE-FORM.actions.submit` — button (submit)

- **Label:** idle onboarding `HandleForm.submitOnboarding` — pl „Ustaw adres” · en "Set the address"; idle settings `HandleForm.submitSettings` — pl „Zmień adres” · en "Change the address"; busy `HandleForm.submitting` — pl „Zapisywanie…” · en "Saving…".
- **Where:** bottom row, left; „Wstecz” to its right in onboarding. Large size.
- **Enabled:** when all hold: not submitting; not locked; the normalized value is non-empty, differs from the current handle, matches A5 and is not reserved; the verdict is not `taken`, `reserved` or `invalid`. So it is enabled while checking, after a failed check and after a rate-limited check.
- **Does:** `POST /api/profile/handle` (see Server calls). Onboarding success → `router.push("/{handle}")`. Settings success → field set to the stored handle, saved lines, `router.refresh()` (the page's current-address line, the lock and the top bar's links re-render).
- **States:** disabled / idle / busy („Zapisywanie…”).
- **Input:** click, tap, Enter in the field.
- **A11y:** native `<button type="submit">`; no `aria-busy`.
- **Tests:** `e2e/db/happy-path.spec.ts` — `getByRole("button", { name: "Ustaw adres" })`, then `toHaveURL(/\/{handle}$/)` and the profile h1 equals the onboarding name; `e2e/db/account.ts`. Settings: none.
- **Source:** `handle-form.tsx` — `HandleForm` (`canSubmit`, `handleSubmit`)

##### `HANDLE-FORM.actions.back` — button

- **Label:** `HandleForm.back` — pl „Wstecz” · en "Back".
- **Where:** right of the submit button; underlined muted text style.
- **Shown:** onboarding only (`onBack` given).
- **Enabled:** always, also while submitting (F-ACCOUNT-7).
- **Does:** calls `onBack` → step one; this form unmounts (typed address, verdict and messages discarded); the name is kept.
- **Input:** click, tap, Enter/Space.
- **A11y:** `<button type="button">`; focus then lands on the step-one name field (its `autofocus`).
- **Tests:** none.
- **Source:** `handle-form.tsx`; `onboarding-steps.tsx` — `onBack={() => setHandle(null)}`

#### Flows and rules

- Local verdict first (`localVerdict`): empty → nothing; equals current handle → `own`; otherwise `handleSchema` (= `checkHandle`):
  - A5 shape `HANDLE_PATTERN` `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$` — 3–30 characters, lowercase letters, digits, hyphens, a letter or digit at both ends (inner double hyphens allowed) → else `invalid`;
  - reserved → `reserved`: exact words in `RESERVED_HANDLES` (every top-level route segment — `handle.test.ts` enforces it —, locale codes `pl en de fr es it cs sk uk ua ru nl pt sv no da fi`, system and official words such as `api`, `admin`, `login`, `settings`, `support`, `www`, the product and company names); any handle containing `architektow3d`, `architektow-3d`, `architectorium` or `architektorium` (`RESERVED_BRAND_TOKENS`); any handle starting with `admin-`, `administrator-`, `moderator-`, `staff-`, `official-`, `support-`, `security-`, `system-` or `root-` (`RESERVED_HANDLE_PREFIXES`).
  - The server re-applies the same `checkHandle`; uniqueness is case-insensitive (handles stored lowercase, unique index).
- Only a locally valid value is sent for a live check (400 ms debounce, abort on change, stale answers ignored). While it is pending the line reads „Sprawdzanie dostępności…”.
- Proposal: the form never suggests alternatives (not even when `taken`). The only proposal is the prefilled value — onboarding: `handleBaseFrom(name)` or the server `fallbackHandle`; settings without a handle: `suggestHandle`. `suggestHandle`: base = slug of the profile's display name, else `studio`; the first free of base, base-2 … base-9, else base-<4 random hex characters>; the base is shortened so the suffix fits 30 characters.
- A6 lock: field disabled, cooldown note with the date, no feedback, no `cooldownAhead`, submit disabled. A submit refused with 409 (the page was rendered before the lock began — another tab or device) shows the cooldown message and calls `router.refresh()`; after the refresh the field locks and the note replaces the message.
- Settings success sequence: the stored, normalized handle replaces what was typed; the saved line (and the redirect line on a change) appear; `router.refresh()` re-renders the server props — after a change the lock is on at once, so the cooldown note shows next to the saved lines.
- During a submit the field stays editable; a settings success overwrites anything typed meanwhile.
- The A10 notice e-mail and the old address's 301 happen server-side; the form only mentions them (`cooldownAhead`, `savedRedirect`).

#### Decisions

- `D-ACCOUNT-5` — The A5 rules run in the browser first, with the same schema the server enforces; only a value that passes asks the server whether it is free, debounced per keystroke; a check still in flight, or one that failed, does not disable the submit — the server is the final judge. Source: `handle-form.tsx` header and `canSubmit` comments; SPEC §2 Stack table ("Zod — the same schemas client/server").
- `D-ACCOUNT-6` — The field holds only the handle, lowercased as typed (trimming is left to the server so a space mid-typing is not fought). The full address is shown below it, never truncated. It has a break opportunity after the slash (`<wbr>`; a hyphen in the handle can still win) and breaks anywhere as a last resort (`wrap-break-word`). A prefix inside the field hid the typed address on a phone. Source: `handle-form.tsx` comments (seen 05.09.2026, reported 07.09.2026).
- `D-ACCOUNT-7` — A6/A10: the first assignment is free; a change locks the next one for 30 days, keeps the old address redirecting until someone claims it, and sends a notice e-mail (best-effort — the change stands if delivery fails). The settings form warns before the change, and only once a different address is typed (shown on arrival beside the greyed-out button it read as "you are blocked for 30 days"); onboarding has nothing to warn about. Source: A6, A10, #16; `handle-form.tsx` `cooldownAhead` comment; `api/profile/handle/route.ts` `notifyChange` comment.
- `D-ACCOUNT-8` — Both handle endpoints need a session and are limited per user — availability 60/min ("taken or free" is an enumeration oracle), claim 10/min — and the claim refuses cross-site requests. Source: `api/handle/availability/route.ts` comment (#15); `api/profile/handle/route.ts`; `src/lib/api-route.ts` `rejectCrossSite` comment (#15 review).

#### Findings

- `F-ACCOUNT-8` — A failed availability check is silent, and a rate-limited one sends mixed signals. Evidence: `feedback()` returns `null` for `failed` (401 after the session expired, network error), so the user sees nothing while the submit stays enabled; `rateLimited` shows a red `role="alert"` with `aria-invalid` but is not in `PROBLEMS`, so the submit stays enabled. The gap is acknowledged in `e2e/db/happy-path.spec.ts` ("the form shows no message at all when the check fails"). Enabling the button is deliberate (D-ACCOUNT-5); the missing message is not explained.
- `F-ACCOUNT-9` — The cooldown date omits the time, so on the named day the address can still be locked under a date that reads as "today". Evidence: `nextHandleChangeAt` = last change + exactly 30 × 24 h (compared to the millisecond, also in `setHandle`), while `formatDate` uses `dateStyle: "long"` only; a page loaded on that day before the hour of the last change shows the disabled field with „Następna zmiana możliwa od {today}”, and nothing unlocks it without a reload (no timer).

### V-SETTINGS-ACCOUNT — account settings

- **Screenshots:** `v-settings-account--desktop`, `v-settings-account--phone` (Appendix A)
- **Route:** `/settings/account` (en `/en/settings/account`) — `src/app/[locale]/(app)/settings/account/page.tsx` (`AccountSettingsPage`). Tab title `Settings.account.title` — pl „Ustawienia konta” · en "Account settings".
- **Reached by:** `signed-in` (with or without a handle). `signed-out` / unverifiable session → server redirect to `/login` (`(app)` gate, repeated in the page) with no return address (F-ACCOUNT-16).
- **Purpose:** change the profile address, password, account e-mail and two-factor authentication.
- **Arrives from → leaves to:** from the account menu item `AccountMenu.account` „Konto” (C-ACCOUNT-MENU — the only link to it from a signed-in page), the `/email-changed` link `EmailChanged.settingsLink` „Przejdź do ustawień konta”, and the `/settings/profile` redirect. Leaves by: logo and account menu „Profil” → `/{handle}` (for `no-handle`: `/` → `/onboarding`); account menu „Wyloguj” → `/`; the current-address link → `/{handle}`; e-mail links from the change messages → V-EMAIL-CHANGED. No save on this page navigates away; no back/cancel link, breadcrumb or footer.
- **Layout (top → bottom):**
  - C-TOPBAR settings variant (specified elsewhere).
  - `<main>`: centred column, max 28rem (`--measure-form`); gutters 16px below `sm` / 24px from `sm` (matching the top bar so the card lines up with the logo on a phone); top/bottom padding 24/48px below `sm`, 48/80px from `sm`.
  - One card (padding 24px below `sm`, 32px from `sm`; 20px between children):
    1. h1 `Settings.account.heading` — pl „Ustawienia konta” · en "Account settings"; divider.
    2. Address: h2 `Settings.profile.handle.heading` — pl „Adres profilu” · en "Profile address"; current-address line; C-HANDLE-FORM `mode="settings"`; divider.
    3. Password: h2 `Settings.account.password.heading` — pl „Zmiana hasła” · en "Change password"; form; divider.
    4. E-mail: h2 `Settings.account.email.heading` — pl „Zmiana adresu e-mail” · en "Change e-mail address"; form or sent block; divider.
    5. Two-factor: h2 `Settings.account.twoFactor.heading` — pl „Weryfikacja dwuskładnikowa” · en "Two-factor authentication" with a status badge at the row's right end; then one of three views (off / activated / on).
  - Not on this page: display name and photo (edited on the profile since #58), language switch, sessions list, account deletion.
  - `phone`: the same single column with the smaller paddings; 2FA method rows keep icon beside text; backup codes stay a 2-column grid.
- **Server calls:**
  - Render: `getSession`; `getProfile` (account menu avatar/name); `getHandleState` (handle, lock); `suggestHandle` only when there is no handle.
  - Address: see C-HANDLE-FORM.
  - Password: `authClient.changePassword` → `POST /api/auth/change-password`.
  - E-mail: `authClient.changeEmail` → `POST /api/auth/change-email`.
  - Two-factor: `authClient.twoFactor.enable` → `POST /api/auth/two-factor/enable`; `authClient.twoFactor.verifyTotp` → `POST /api/auth/two-factor/verify-totp`; `authClient.twoFactor.disable` → `POST /api/auth/two-factor/disable`.
  - Per-element success/failure mapping is in the element blocks.

#### Elements

##### `SETTINGS-ACCOUNT.address.current` — text with link

- **Label:** with a handle `Settings.profile.handle.current` — pl „Twój adres: <link>{address}</link>” · en "Your address: <link>{address}</link>"; the link text is `{origin}/` + `<wbr>` + handle. Without a handle `Settings.profile.handle.empty` — pl „Nie masz jeszcze adresu profilu.” · en "You have no profile address yet."
- **Where:** directly under the address h2, above the form.
- **Shown:** always; link only when a handle exists.
- **Does:** the link opens the live profile `/{handle}` (locale-aware, `/en/{handle}` in `en`); the visible text is always unprefixed. Re-renders after a successful change (`router.refresh()`).
- **Input:** click, tap, Enter on the link.
- **A11y:** `TextLink` (`<a>`), underlined; line wraps anywhere as a last resort.
- **Tests:** none.
- **Source:** `settings/account/page.tsx` — `AccountSettingsPage`

##### `SETTINGS-ACCOUNT.password.current` — password field

- **Label:** `Settings.account.password.currentLabel` — pl „Bieżące hasło” · en "Current password". Errors: `…password.errors.currentRequired` pl „Podaj bieżące hasło.” · en "Enter your current password."; `…password.errors.wrongCurrent` pl „Bieżące hasło jest nieprawidłowe.” · en "The current password is incorrect."
- **Where:** first field of the password section.
- **Shown:** always.
- **Enabled:** always (also while submitting).
- **Does:** holds the current password; cleared after a successful change.
- **States:** empty on submit → `currentRequired`; server `INVALID_PASSWORD` → `wrongCurrent` (value kept). Error stays until the next submit.
- **Input:** typing; Enter submits the password form.
- **A11y:** `input#current-password` `name="currentPassword"` `type="password"` `autocomplete="current-password"` `required`; with an error: `aria-invalid="true"`, `aria-describedby="current-password-error"` → `p#current-password-error` (no live role).
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("rejects a wrong current password and sends nothing").
- **Source:** `settings/account/change-password-form.tsx` — `ChangePasswordForm`

##### `SETTINGS-ACCOUNT.password.new` — password field

- **Label:** `Settings.account.password.newLabel` — pl „Nowe hasło” · en "New password". Hint `…password.newHint` — pl „Od {min} do {max} znaków — bez żadnych dodatkowych wymagań.” · en "{min} to {max} characters — no other requirements." ({min}=8, {max}=128). Errors: `…password.errors.passwordTooShort` pl „Hasło musi mieć co najmniej {min} znaków.” · en "The password needs at least {min} characters."; `…password.errors.passwordTooLong` pl „Hasło może mieć najwyżej {max} znaków.” · en "The password can have at most {max} characters."
- **Where:** under the current-password field.
- **Shown:** always.
- **Enabled:** always.
- **Does:** holds the new password (never trimmed; `passwordSchema` 8–128); cleared after success.
- **States:** hint shown; on a length error the hint is replaced by the error until the next submit.
- **Input:** typing; Enter submits.
- **A11y:** `input#new-password` `name="newPassword"` `type="password"` `autocomplete="new-password"` `required`; `aria-describedby="new-password-hint"`, or `new-password-error` with `aria-invalid="true"` while an error shows.
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("enforces the A1 bounds on the new password").
- **Source:** `change-password-form.tsx` — `ChangePasswordForm`; `src/lib/auth-schemas.ts` — `passwordSchema`, `PASSWORD_MIN`, `PASSWORD_MAX`

##### `SETTINGS-ACCOUNT.password.form-error` — alert

- **Label:** `Settings.account.password.errors.rateLimited` — pl „Limit 10 prób na godzinę został wykorzystany. Spróbuj później.” · en "The limit of 10 attempts per hour is used up. Try again later." (HTTP 429); `…password.errors.generic` — pl „Zmiana hasła nie powiodła się. Spróbuj ponownie.” · en "Changing the password failed. Try again." (any other error, network failure).
- **Where:** under the fields, above the submit button.
- **Shown:** after a failed request; cleared when the next submit starts.
- **A11y:** `role="alert"`.
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("allows at most 10 attempts per hour from one IP").
- **Source:** `change-password-form.tsx` — `ChangePasswordForm`

##### `SETTINGS-ACCOUNT.password.done` — status line

- **Label:** `Settings.account.password.done` — pl „Hasło zmienione. Pozostałe urządzenia zostały wylogowane.” · en "Password changed. Your other devices have been signed out."
- **Where:** above the submit button.
- **Shown:** after a successful change; stays while typing; cleared when the next submit starts.
- **A11y:** `role="status"`.
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("changes the password, confirms by e-mail and keeps only this session").
- **Source:** `change-password-form.tsx` — `ChangePasswordForm`

##### `SETTINGS-ACCOUNT.password.submit` — button (submit)

- **Label:** `Settings.account.password.submit` — pl „Zmień hasło” · en "Change the password"; busy `…password.submitting` — pl „Zapisywanie…” · en "Saving…".
- **Where:** bottom of the password section, left.
- **Enabled:** disabled only while submitting.
- **Does:** clears the form error and the success line; validates both fields (any field error → stop, no request); then `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`. Success: server deletes every session of the account and sets a new one for this browser (other devices signed out, this tab stays signed in); sends `Email.passwordChanged` to the account address (best-effort, request locale); UI clears both fields and shows `done`. `INVALID_PASSWORD` → current-password field error. 429 (10/h per IP) → `rateLimited`. Anything else → `generic`.
- **States:** idle / busy.
- **Input:** click, tap, Enter in either field.
- **A11y:** native `<button type="submit">`; focus is not moved after validation errors or success.
- **Tests:** e2e none.
- **Source:** `change-password-form.tsx` — `handleSubmit`; `src/lib/auth.ts` — `hooks.after` (`/change-password`), `rateLimit.customRules`

##### `SETTINGS-ACCOUNT.email.new` — e-mail field

- **Label:** `Settings.account.email.newLabel` — pl „Nowy adres e-mail” · en "New e-mail address". Errors: `…email.errors.emailInvalid` pl „Podaj poprawny adres e-mail.” · en "Enter a valid e-mail address."; `…email.errors.sameEmail` pl „To jest obecny adres tego konta.” · en "This is already the account's address."
- **Where:** first element of the e-mail section. The current account address is not shown anywhere on the page (F-ACCOUNT-12).
- **Shown:** until a request is accepted (then replaced by the sent block).
- **Enabled:** always.
- **Does:** holds the new address; validated on submit with `emailSchema` (trim, lowercase, e-mail format) and compared with the session's address (lowercased).
- **States:** field error until the next submit that passes validation.
- **Input:** typing (e-mail keyboard on touch); Enter submits.
- **A11y:** `input#new-email` `name="newEmail"` `type="email"` `autocomplete="email"` `required` (form `noValidate`); with an error `aria-invalid="true"`, `aria-describedby="new-email-error"` → `p#new-email-error` (no live role).
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("rejects the unchanged address and a missing session").
- **Source:** `settings/account/change-email-form.tsx` — `ChangeEmailForm`; `src/lib/auth-schemas.ts` — `emailSchema`

##### `SETTINGS-ACCOUNT.email.form-error` — alert

- **Label:** `Settings.account.email.errors.rateLimited` — pl „Limit 3 żądań na godzinę został wykorzystany. Spróbuj później.” · en "The limit of 3 requests per hour is used up. Try again later." (HTTP 429); `…email.errors.generic` — pl „Wysyłka nie powiodła się. Spróbuj ponownie.” · en "Sending failed. Try again." (other errors, e.g. 400 or 401, and network failure).
- **Where:** under the field, above the submit button.
- **Shown:** after a failed request; cleared when the next submit starts.
- **A11y:** `role="alert"`.
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` ("allows at most 3 requests per hour from one IP").
- **Source:** `change-email-form.tsx` — `ChangeEmailForm`

##### `SETTINGS-ACCOUNT.email.submit` — button (submit)

- **Label:** `Settings.account.email.submit` — pl „Wyślij link potwierdzający” · en "Send the confirmation link"; busy `…email.submitting` — pl „Wysyłanie…” · en "Sending…".
- **Where:** bottom of the e-mail form, left.
- **Enabled:** disabled only while submitting.
- **Does:** clears the form error; validates (see field); then `authClient.changeEmail({ newEmail, callbackURL })` with `callbackURL` = `/email-changed` (en `/en/email-changed`). 200 → sent block. 429 → `rateLimited`; other errors → `generic`.
- **States:** idle / busy.
- **Input:** click, tap, Enter in the field.
- **A11y:** native `<button type="submit">`; unmounts on success, focus is not moved.
- **Tests:** e2e none. Server: `src/lib/auth-account.test.ts` (whole "change e-mail (A10)" block).
- **Source:** `change-email-form.tsx` — `handleSubmit`; `src/lib/auth.ts` — `user.changeEmail`, `hooks.before`

##### `SETTINGS-ACCOUNT.email.sent` — status block

- **Label:** h3 `Settings.account.email.sent.heading` — pl „Sprawdź nową skrzynkę” · en "Check the new inbox"; body `…email.sent.body` — pl „Jeśli adres {email} jest dostępny, wysłaliśmy na niego link potwierdzający (ważny 24 godziny), a na obecny adres — powiadomienie. Do czasu potwierdzenia nic się nie zmienia.” · en "If {email} is available, we sent it a confirmation link (valid for 24 hours) and a notice to your current address. Nothing changes until it is confirmed."; {email} = the normalized new address. The wording does not match the real flow (F-ACCOUNT-11).
- **Where:** replaces the e-mail form.
- **Shown:** after any 200 — free and taken addresses alike — for the rest of the visit; a reload brings the empty form back.
- **Does:** nothing interactive: no resend, no "use another address", no cancel.
- **A11y:** plain `<h3>` and `<p>`, no live role; the address wraps anywhere (`wrap-break-word`).
- **Tests:** none.
- **Source:** `change-email-form.tsx` — `ChangeEmailForm` (`sentTo`)

##### `SETTINGS-ACCOUNT.two-factor.status` — badge and status line

- **Label:** badge `Settings.account.twoFactor.status.badgeOn` — pl „wł.” · en "on" (success tone) / `…status.badgeOff` — pl „wył.” · en "off" (neutral); shown uppercase by CSS. Line: on `…status.on` — pl „Weryfikacja dwuskładnikowa jest włączona.” · en "Two-factor authentication is on." (success colour); off `…status.off` — pl „Weryfikacja dwuskładnikowa jest wyłączona. Włącz drugi składnik, aby lepiej chronić konto.” · en "Two-factor authentication is off. Turn on a second factor to better protect your account."
- **Where:** badge at the right end of the h2 row; line under it, followed by a divider. The activated view shows the badge but no status line.
- **Shown:** always; the badge follows the server prop `enabled` (`session.user.twoFactorEnabled`), so it still reads „wył.” in the activated view (F-ACCOUNT-13).
- **A11y:** badge is a `<span>` outside the h2; nothing is live.
- **Tests:** none.
- **Source:** `settings/account/two-factor-settings.tsx` — `TwoFactorSettings` (`heading`)

##### `SETTINGS-ACCOUNT.two-factor.email-password` — password field

- **Label:** `Settings.account.twoFactor.passwordLabel` — pl „Potwierdź hasłem” · en "Confirm with your password" (same label as the app-setup and disable fields).
- **Where:** off view, e-mail method row („Kody e-mailowe”), under its description.
- **Shown:** off view.
- **Enabled:** always.
- **Does:** holds the password for enabling e-mail codes; not cleared after success.
- **Input:** typing; Enter submits this row's form only.
- **A11y:** `input#tf-email-password` `type="password"` `autocomplete="current-password"`; no `name`, `required`, `aria-invalid` or `aria-describedby`.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings`

##### `SETTINGS-ACCOUNT.two-factor.email-error` — alert

- **Label:** `…twoFactor.errors.passwordRequired` pl „Podaj hasło.” · en "Enter your password." (empty, no request); `…errors.wrongPassword` pl „Nieprawidłowe hasło.” · en "Incorrect password." (HTTP 400); `…errors.rateLimited` pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.” · en "Too many attempts. Wait a moment and try again." (429); `…errors.generic` pl „Operacja nie powiodła się. Spróbuj ponownie.” · en "The operation failed. Try again." (other, network).
- **Where:** under the password field, above the button.
- **Shown:** after a failed attempt; cleared when the next attempt starts.
- **A11y:** `role="alert"`; not linked to the field.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `enableEmail`, `mapError`

##### `SETTINGS-ACCOUNT.two-factor.email-enable` — button (submit)

- **Label:** `…twoFactor.email.enable` — pl „Włącz kody e-mail” · en "Turn on e-mail codes"; busy `…email.enabling` — pl „Włączanie…” · en "Turning on…". Row copy: h3 `…email.title` pl „Kody e-mailowe” · en "E-mail codes"; `…email.description` pl „Przy każdym logowaniu wysyłamy 6-cyfrowy kod na e-mail konta. Nic do instalowania.” · en "At each login we send a 6-digit code to your account's e-mail. Nothing to install."; mail icon (`aria-hidden`).
- **Where:** off view, e-mail row, under the field; quiet (outlined) style.
- **Shown:** off view.
- **Enabled:** disabled only while this request runs.
- **Does:** empty password → `passwordRequired`. Else `authClient.twoFactor.enable({ password, method: "otp" })`: the server turns 2FA on at once (no code to confirm) and re-issues the session cookie → `router.refresh()` → on view. From then on login goes through the e-mail-code challenge (V-TWO-FACTOR).
- **States:** idle / busy / error (email-error).
- **Input:** click, tap, Enter in the field.
- **A11y:** native button; after success the view swaps with no focus move or announcement.
- **Tests:** e2e none. Server: `src/lib/auth-2fa.test.ts` ("enrolls instantly, then a login needs a code mailed to the account"; "enabling requires the current password").
- **Source:** `two-factor-settings.tsx` — `enableEmail`

##### `SETTINGS-ACCOUNT.two-factor.app-password` — password field

- **Label:** `…twoFactor.passwordLabel` — pl „Potwierdź hasłem” · en "Confirm with your password".
- **Where:** off view, authenticator row („Aplikacja uwierzytelniająca”), under its description.
- **Shown:** off view, before setup starts.
- **Enabled:** always.
- **Does:** holds the password for starting setup; cleared when setup starts.
- **Input:** typing; Enter submits this row's form.
- **A11y:** `input#tf-app-password` `type="password"` `autocomplete="current-password"`; no error association.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings`

##### `SETTINGS-ACCOUNT.two-factor.app-error` — alert

- **Label:** same keys and mapping as `SETTINGS-ACCOUNT.two-factor.email-error` (`passwordRequired`; 400 → `wrongPassword`; 429 → `rateLimited`; other or missing data → `generic`).
- **Where:** under the app password field.
- **Shown:** after a failed attempt; cleared when the next attempt starts.
- **A11y:** `role="alert"`.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `startApp`, `mapError`

##### `SETTINGS-ACCOUNT.two-factor.app-setup` — button (submit)

- **Label:** `…twoFactor.app.setup` — pl „Skonfiguruj” · en "Set up"; busy `…app.settingUp` — pl „Przygotowywanie…” · en "Preparing…". Row copy: h3 `…app.title` pl „Aplikacja uwierzytelniająca” · en "Authenticator app"; `…app.description` pl „Silniejsza ochrona — kod z aplikacji działa nawet, gdy ktoś przejmie Twoją skrzynkę.” · en "Stronger protection — a code from an app works even if someone takes over your mailbox."; smartphone icon (`aria-hidden`).
- **Where:** off view, authenticator row, under the field; quiet style.
- **Shown:** off view, before setup.
- **Enabled:** disabled only while this request runs.
- **Does:** empty password → `passwordRequired`. Else `authClient.twoFactor.enable({ password, method: "totp" })`: the server stores a new secret and 10 backup codes (replacing any unfinished setup); 2FA is still OFF. UI takes the `secret` query parameter of the returned `otpauth://` URI as the key, keeps the codes, clears the password and swaps the password form for the setup block (key, codes, confirm form). No QR code, no cancel (F-ACCOUNT-15).
- **States:** idle / busy / error (app-error).
- **Input:** click, tap, Enter in the field.
- **A11y:** native button; the swap moves no focus.
- **Tests:** e2e none. Server: `src/lib/auth-2fa.test.ts` ("enrolls with a QR secret + backup codes, confirms, then challenges on login").
- **Source:** `two-factor-settings.tsx` — `startApp`

##### `SETTINGS-ACCOUNT.two-factor.app-key` — text (secret)

- **Label:** `…twoFactor.app.keyLabel` — pl „Wpisz ten klucz w aplikacji uwierzytelniającej:” · en "Enter this key in your authenticator app:"; then the key in a `<code>` box (base32).
- **Where:** setup block, first.
- **Shown:** off view after „Skonfiguruj” succeeds, until a reload. It is hidden while another view renders and back when the off view renders again (F-ACCOUNT-13).
- **Does:** display only; no copy button (select-to-copy by hand).
- **A11y:** plain `<p>` + `<code>`; the key breaks anywhere (`break-all`).
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings` (`setup.key`)

##### `SETTINGS-ACCOUNT.two-factor.backup-codes` — list

- **Label:** `…twoFactor.app.backupTitle` — pl „Kody zapasowe” · en "Backup codes"; `…app.backupNote` — pl „Zapisz je w bezpiecznym miejscu — pozwolą się zalogować, gdy nie masz dostępu do aplikacji. Każdy działa raz.” · en "Save these somewhere safe — they let you log in when you can't reach the app. Each one works once."; then the codes.
- **Where:** setup block under the key; activated view under the activation note.
- **Shown:** setup block and activated view. After „Gotowe” the on view hides them, but they stay in client state until a reload, and a disable in the same visit shows them again (F-ACCOUNT-13).
- **Does:** shows the 10 codes returned by setup (format `xxxxx-xxxxx`, letters and digits) in a 2-column grid, monospace. No copy, download or print control.
- **A11y:** `<ul>`/`<li>`; the title is a `<p>`, not a heading.
- **Tests:** none (server: `src/lib/auth-2fa.test.ts` "lets a backup code stand in for the authenticator, once").
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings` (`setup.backupCodes`)

##### `SETTINGS-ACCOUNT.two-factor.app-code` — text field

- **Label:** `…twoFactor.app.confirmLabel` — pl „Wpisz kod z aplikacji, aby zakończyć” · en "Enter a code from the app to finish".
- **Where:** setup block, under the backup codes; narrow (max 140px), monospace.
- **Shown:** setup block.
- **Enabled:** always.
- **Does:** holds the 6-digit code; sent exactly as typed (a code typed with a space fails as invalid).
- **Input:** typing (numeric keypad on touch); Enter submits.
- **A11y:** `input#tf-app-code` `type="text"` `inputmode="numeric"` `autocomplete="one-time-code"`; no error association.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings`

##### `SETTINGS-ACCOUNT.two-factor.app-code-error` — alert

- **Label:** `…twoFactor.errors.codeRequired` pl „Wpisz kod.” · en "Enter the code." (empty after trim, no request); `…errors.invalidCode` pl „Nieprawidłowy kod. Spróbuj ponownie.” · en "Invalid code. Try again." (HTTP 401); `…errors.generic` pl „Operacja nie powiodła się. Spróbuj ponownie.” · en "The operation failed. Try again." (everything else, including 429 — F-ACCOUNT-14).
- **Where:** under the code field.
- **Shown:** after a failed attempt; cleared when the next attempt starts.
- **A11y:** `role="alert"`.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `confirmApp`

##### `SETTINGS-ACCOUNT.two-factor.app-activate` — button (submit)

- **Label:** `…twoFactor.app.activate` — pl „Aktywuj” · en "Activate"; busy `…app.activating` — pl „Aktywowanie…” · en "Activating…".
- **Where:** setup block, under the code field; solid style.
- **Shown:** setup block.
- **Enabled:** disabled only while this request runs.
- **Does:** `authClient.twoFactor.verifyTotp({ code })` (30-second codes, one step either side accepted). Success: server turns 2FA on, marks the secret verified, re-issues the session cookie; UI switches to the activated view WITHOUT refreshing, so the codes stay visible.
- **States:** idle / busy / error (app-code-error).
- **Input:** click, tap, Enter in the field.
- **A11y:** native button; the swap moves no focus and announces nothing.
- **Tests:** e2e none. Server: `src/lib/auth-2fa.test.ts`.
- **Source:** `two-factor-settings.tsx` — `confirmApp`

##### `SETTINGS-ACCOUNT.two-factor.activated-note` — text

- **Label:** `…twoFactor.app.activatedHeading` — pl „Aplikacja włączona. Zapisz kody zapasowe, zanim przejdziesz dalej.” · en "Authenticator on. Save your backup codes before you continue."
- **Where:** activated view, under the h2 row; followed by the backup codes.
- **Shown:** after „Aktywuj” succeeds, until „Gotowe” or a reload — and again after a disable in the same visit (F-ACCOUNT-13).
- **A11y:** plain `<p>` in success colour (not a heading, not live).
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings` (`activated && setup`)

##### `SETTINGS-ACCOUNT.two-factor.done` — button

- **Label:** `…twoFactor.app.done` — pl „Gotowe” · en "Done".
- **Where:** activated view, under the codes, left; solid style.
- **Shown:** activated view.
- **Enabled:** always.
- **Does:** `router.refresh()` → the server renders `enabled` and the on view replaces the codes; `setup` and `activated` survive the refresh (F-ACCOUNT-13).
- **Input:** click, tap, Enter/Space.
- **A11y:** `<button type="button">`.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings`

##### `SETTINGS-ACCOUNT.two-factor.off-password` — password field

- **Label:** `…twoFactor.passwordLabel` — pl „Potwierdź hasłem” · en "Confirm with your password".
- **Where:** on view, under the status line and a divider.
- **Shown:** on view (either method; the view does not say which).
- **Enabled:** always.
- **Does:** holds the password for turning 2FA off; not cleared after success.
- **Input:** typing; Enter submits.
- **A11y:** `input#tf-off-password` `type="password"` `autocomplete="current-password"`; no error association.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `TwoFactorSettings`

##### `SETTINGS-ACCOUNT.two-factor.off-error` — alert

- **Label:** same keys and mapping as `SETTINGS-ACCOUNT.two-factor.email-error`.
- **Where:** under the disable password field.
- **Shown:** after a failed attempt; cleared when the next attempt starts.
- **A11y:** `role="alert"`.
- **Tests:** none.
- **Source:** `two-factor-settings.tsx` — `disable`, `mapError`

##### `SETTINGS-ACCOUNT.two-factor.disable` — button (submit)

- **Label:** `…twoFactor.disable.button` — pl „Wyłącz weryfikację dwuskładnikową” · en "Turn off two-factor authentication"; busy `…disable.disabling` — pl „Wyłączanie…” · en "Turning off…".
- **Where:** on view, under the field; solid style.
- **Shown:** on view.
- **Enabled:** disabled only while this request runs.
- **Does:** empty password → `passwordRequired`. Else `authClient.twoFactor.disable({ password })`: server turns 2FA off, deletes the secret and backup codes, forgets a trusted device, re-issues the session cookie → `router.refresh()` → off view. No confirmation step beyond the password.
- **States:** idle / busy / error (off-error).
- **Input:** click, tap, Enter in the field.
- **A11y:** native button; the swap moves no focus.
- **Tests:** e2e none. Server: `src/lib/auth-2fa.test.ts` ("disabling clears the record and restores plain password login").
- **Source:** `two-factor-settings.tsx` — `disable`

#### Flows and rules

- Section order: address → password → e-mail → two-factor. Each section is an independent form; nothing is shared between them; no guard warns about unsaved input when leaving (the profile editor has one, #83).
- Address section: the field opens on the current handle (verdict `own`, submit disabled; if locked, disabled with the date) or — `no-handle` — on the `suggestHandle` proposal, with `Settings.profile.handle.empty` above. Rules in C-HANDLE-FORM. For `no-handle` the save cannot succeed in practice (F-ACCOUNT-10).
- Password: validation only on submit. Current: presence only. New: 8–128 characters, untrimmed. Server rules: session required (401 → `generic`), same bounds, 10 requests/hour per IP. Success signs out every other session, keeps this tab signed in and mails `Email.passwordChanged`. The 2FA state is unaffected.
- E-mail (two confirmations, A10 "address change ×2"):
  1. Request → 200 for any well-formed different address; a taken address gets no e-mail at all; 3 requests/hour per IP. For a free address the server records one pending change (24 h; a newer request replaces it) and sends `Email.emailChangeConfirmation` with an approval link to the CURRENT address.
  2. Approval click → V-EMAIL-CHANGED (approved state); the server sends `Email.emailChangeVerification` with a link to the NEW address.
  3. Verification click → the account address switches; V-EMAIL-CHANGED `?status=done`. A password reset or a newer request kills pending links (`INVALID_TOKEN`). Both clicks work signed out.
  - The settings page never shows a pending change; after a reload the form is empty again.
- Two-factor state machine (`TwoFactorSettings`):
  - `enabled` (server) → on view (status + disable form);
  - else `activated && setup` (client) → activated view (note + codes + „Gotowe”);
  - else off view: e-mail row (password + „Włącz kody e-mail”) and authenticator row (password + „Skonfiguruj”, or after it the setup block: key, codes, code field, „Aktywuj”).
  - Every state change except „Aktywuj” re-asks the current password; „Aktywuj” needs the session only.
  - Leaving or reloading during setup (before „Aktywuj”) leaves 2FA off; a later „Skonfiguruj” issues a new key and codes. Reloading after „Aktywuj” but before „Gotowe” leaves 2FA on and the codes gone from the screen.
  - Busy: only the pressed button is disabled and relabelled; every field and the other method's form stay usable.
  - Rate limit on `/api/auth/two-factor/*`: 3 requests per 10 s per IP (plugin default) → `errors.rateLimited` (enable, disable) or `errors.generic` (verify).
  - `router.refresh()` keeps the component's client state (Next `useRouter` docs), which matters after multi-step sequences (F-ACCOUNT-13).
  - No 2FA change sends an e-mail.

#### Decisions

- `D-ACCOUNT-9` — The address section comes first — the address is the point of the product and the rest of the page protects it; it moved here when #58 folded the profile-settings screen away and kept its `Settings.profile.handle.*` keys; the current-address line links to the live profile so the owner sees exactly what a visitor sees; an account without a handle opens the form on `suggestHandle`'s proposal — onboarding's server fallback, not the name-derived proposal onboarding makes since #36. Source: `settings/account/page.tsx` comments (§1, #58, #18).
- `D-ACCOUNT-10` — Password change: the browser checks only that a current password was typed (the stored password decides, as at login); a change signs out every other device while this session continues on a fresh token; a confirmation e-mail goes to the account address. Source: `change-password-form.tsx` comments ("Decision of 01.09.2026"); A10 "password-change confirmation"; `auth.ts` `hooks.after` comment.
- `D-ACCOUNT-11` — E-mail change needs the current mailbox's approval before the new address is verified, so a stolen session alone cannot move the account; the request answers 200 whether or not the address is free (enumeration protection), so the UI can only say "request accepted". Source: `auth.ts` `user.changeEmail` comment (#10, decision of 01.09.2026, option B); `change-email-form.tsx` comment; A10 "address change ×2".
- `D-ACCOUNT-12` — Two-factor is opt-in with both methods: e-mail codes (the easy default, nothing to install) and an authenticator app with backup codes (survives a compromised mailbox), the app confirmed by a code; turning a method on and turning two-factor off re-authenticate with the password, while the confirming code („Aktywuj”) needs only the session; after activation the backup codes stay on screen until „Gotowe”, because refreshing to the on view would wipe the only copy. Source: `two-factor-settings.tsx` comments; `auth.ts` plugin comment (#29, decision of 01.09.2026).

#### Findings

- `F-ACCOUNT-10` — For an account without a handle the address form cannot save and shows copy that is false for a first assignment. Evidence: settings mode sends no `displayName`; with no profile row (the normal case before onboarding: rows are created only by the onboarding claim or a direct `POST /api/profile`) `setHandle` throws `displayNameRequired` → route 400 → `applyServerError` → `HandleForm.errors.generic`; the form has no name field. Meanwhile the button reads „Zmień adres” and `cooldownAhead` says the next change will wait 30 days, but `setHandle` starts no lock on a first assignment. The page comment presents this path as the fallback for "an account from before #15, or onboarding left early".
- `F-ACCOUNT-11` — The e-mail "sent" copy contradicts the two-step flow. Evidence: `Settings.account.email.sent.heading` „Sprawdź nową skrzynkę” and `sent.body` say the link went to the NEW address and only a notice to the current one; `auth.ts` `sendChangeEmailConfirmation` mails the approval link to the CURRENT address, and the new address gets its link only after approval (`src/lib/auth-account.test.ts` "step one sends only the approval, to the CURRENT address"); `EmailChanged.approvedBody` and `Email.emailChangeConfirmation` describe the real order.
- `F-ACCOUNT-12` — E-mail section gaps. Evidence: `currentEmail` is used only for the `sameEmail` check, so the page never shows the account's current address; the sent block has no resend, correction or cancel (only a reload restores the form); on success the focused button unmounts and the block has no live role.
- `F-ACCOUNT-13` — Two-factor views go stale across `router.refresh()`. Evidence: `router.refresh()` preserves `useState` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`); render order is `enabled` → `activated && setup` → off. After „Skonfiguruj” → „Aktywuj” → „Gotowe” → disable in one visit, the section falls back to the activated view (the note says the app is on, dead backup codes, and „Gotowe” cannot leave it) instead of the off view. A setup started, then e-mail codes enabled and disabled, leaves the old key on screen and „Aktywuj” fails with `errors.generic` (the disable deleted the secret). Typed passwords stay in the hidden forms (`emailPassword`, `offPassword` never cleared). The activated view's badge reads „wył.” next to „Aplikacja włączona”.
- `F-ACCOUNT-14` — Two-factor accessibility and error handling differ from the rest of the page. Evidence: its inputs have no `aria-invalid` / `aria-describedby` (the password and e-mail forms have both); the off view shows two inputs with the same accessible name „Potwierdź hasłem”; view swaps (setup, activation, enable, disable) move no focus and announce nothing; `confirmApp` maps only 401, so a 429 shows `errors.generic` while `mapError` shows `errors.rateLimited` elsewhere; the code is checked trimmed but sent untrimmed (`verifyTotp({ code: appCode })`, exact comparison in `@better-auth/utils` `verifyTOTP`).
- `F-ACCOUNT-15` — Authenticator management is minimal. Evidence: no QR code — only the manual key (`package.json` has no QR library; a new dependency is §7 "ask first"); no copy or download for the key or the codes; the on view does not say which method is active and offers no switch; no way to view or regenerate backup codes although better-auth 1.7.2 exposes `/two-factor/generate-backup-codes`; no cancel during setup. The component comment names "manual key + backup codes" as the intended scope (#29) without a reason.
- `F-ACCOUNT-16` — Duplicate of `F-AUTH-7` (no return destination after the `(app)` gate sends a signed-out visitor to `/login`, including from the `/email-changed` settings link after either change-e-mail click, both of which work signed out).
- `F-ACCOUNT-17` — The page's forms give feedback in different ways. Evidence: `HandleForm` clears its submit error and saved lines on every keystroke and uses `role="alert"`/`"status"`; the password and e-mail field errors are plain `<p>` (announced only via `aria-describedby` on focus) and persist until the next submit; the password `done` line stays while new values are typed; 2FA errors persist until the next attempt.
- `F-ACCOUNT-18` — No browser test covers the settings forms or runs axe on these screens. Evidence: in `e2e/` no spec interacts with the address, password, e-mail or 2FA sections — `/settings/account` is only a history stop (`e2e/db/leave-guard.spec.ts`, `e2e/db/lightbox.spec.ts`) or a gate check (`e2e/settings.spec.ts`); `e2e/a11y.spec.ts` covers neither `/onboarding` nor `/settings/account`; onboarding is exercised only along its happy path.

### V-SETTINGS-PROFILE-REDIRECT — former profile settings

- `/settings/profile` (en `/en/settings/profile`) — `src/app/[locale]/(app)/settings/profile/page.tsx` (`ProfileSettingsRedirect`): renders nothing, redirects server-side to `/settings/account` in the same locale; a signed-out visitor meets the `(app)` gate first and lands on `/login` (`e2e/settings.spec.ts` "/settings/profile without a session lands on the login page").
- `D-ACCOUNT-13` — Kept only as a redirect since #58 folded the screen away (name and photo are edited on the owner's profile, the address moved to account settings), so bookmarks and old e-mails land somewhere; left inside `(app)` so a signed-out visitor goes to login instead of bouncing through a settings address. Source: `settings/profile/page.tsx` comment, #58.

## 7. Profile page

### V-PROFILE — public profile (visitor)

- **Screenshots:** `v-profile--desktop`, `v-profile--desktop--en`, `v-profile--phone`, `v-profile--other-signed-in--desktop`, `v-profile--other-signed-in--phone` (Appendix A)
- **Route:** `/{handle}` (en `/en/{handle}`) — `src/app/[locale]/(public)/[handle]/page.tsx` (`PublicProfilePage`, `generateMetadata`). Rendered on the server for every request (`dynamic = "force-dynamic"`, A7).
- **Reached by:** `signed-out`, `no-handle`, `other` — one identical render. The page reads the session only to ask "is this viewer the owner?" (`isOwnerViewing`); nothing in the visitor branch depends on who is signed in. `owner` gets V-PROFILE-OWNER instead. A session that cannot be verified counts as "not the owner" → this view (D-PROFILE-1).
  - Address resolution (`loadPublicProfile` in `src/lib/public-profile.ts`): input normalized (`normalizeHandle` = trim + lowercase) → live profile → old handle → nothing.
  - Unknown handle, account deleted between reads, or no `DATABASE_URL` → 404 body (`src/app/[locale]/not-found.tsx`, part SHELL). Any other lookup failure → 500.
  - Case/whitespace variant (e.g. `/Studio-Praga`) → 308 to the canonical lowercase address. Old handle → normally a 301 from `src/proxy.ts` before the page runs; if that lookup failed open, the page itself answers 308 to the current handle. Both redirects keep the query string (D-PROFILE-2).
- **Purpose:** the studio's one public page: identity card, optional sections, works.
- **Arrives from → leaves to:** shared links, search results, the 301/308 from an old or mis-cased address. Leaves via: logo → `/` (`signed-out`: landing page; `signed-in`: `/` redirects to the viewer's own `/{handle}` or `/onboarding` — `signedInDestination`); „Załóż konto” → `/register`; language chip → same path in the other locale; the works gallery (lightbox, orbit — V-WORKS-LIST).
- **Layout (top → bottom):**
  - C-TOPBAR (sticky, `measure-page` column): left the logo (→ `/`); right C-LANGUAGE-CHIP + „Załóż konto”. `phone`: the two actions move into the C-MOBILE-MENU hamburger (same elements).
  - `main`:
    - Profile card (`article`, no padding): cover band (only with a cover) → body: identity row [avatar | name column: h1 name, headline] → places section → bio section.
    - Works section (only with ≥ 1 work): h2 + gallery (V-WORKS-LIST, visitor variant).
  - Plaque (centred, 150 px wide).
  - C-FOOTER (`measure-page`).
  - `phone`: identity row stacks (avatar above the name column, avatar 96 px, card padding 40 px); from `sm` it is a row with a 128 px avatar, vertically centred without a cover and top-aligned with one. Cover image: `srcSet` 480w/1600w with `sizes="(max-width: 640px) 100vw, 68rem"` — the browser chooses by width × pixel density, so most phones load the 1600 px variant; the 480 px one serves only a slot of at most 480 device pixels.
- **Server calls:** none from the browser (except what V-WORKS-LIST and C-LANGUAGE-CHIP do). Per request on the server: session read (owner check), one §9 lookup shared by `generateMetadata` and the page (`cache()`), the works list.

#### Elements

##### `PROFILE.topbar.actions` — link + language menu (top-bar variant)

- **Label:** `Session.register` — pl „Załóż konto” · en "Sign up"; language chip `LanguageSwitcher.pl` „Polski” / `LanguageSwitcher.en` "English"; hamburger `MobileMenu.menuLabel` — pl „Menu główne” · en "Main menu"; logo `Brand.wordmark` — „Architektów 3d” (both locales)
- **Where:** top bar, right side (logo left); below `sm` inside the hamburger panel
- **Shown:** `signed-out`, `no-handle`, `other`; never `owner`; no log-in link (the landing page's bar has one — F-PROFILE-1)
- **Enabled:** always
- **Does:** „Załóż konto” (quiet button-link) → `/register`; chip → same page in the other locale (C-LANGUAGE-CHIP); logo → `/`
- **States:** —
- **Input:** mouse, touch, keyboard (links and menu triggers)
- **A11y:** see C-TOPBAR, C-LANGUAGE-CHIP, C-MOBILE-MENU
- **Tests:** none on this page (happy-path clicks „Załóż konto” on the landing page only)
- **Source:** `page.tsx` — `actions`, `TopBar`, `MobileMenu`, `Logo href="/"`

##### `PROFILE.card.cover` — image

- **Label:** alt `PublicProfile.coverAlt` — pl „Zdjęcie w tle profilu {name}” · en "{name}'s cover photo"
- **Where:** top edge of the profile card, full card width, rounded top corners
- **Shown:** all visitor modes, only when the profile has a cover; otherwise absent (no band, no placeholder)
- **Enabled:** —
- **Does:** nothing (not clickable). A 3:1 box; the stored variant (aspect kept, A12) is centre-cropped by CSS (`object-cover`); `srcSet` 480w/1600w, `sizes="(max-width: 640px) 100vw, 68rem"`; not lazy-loaded
- **States:** present / absent
- **Input:** —
- **A11y:** `img` with the alt above
- **Tests:** none
- **Source:** `profile-sections.tsx` — `CoverView`; `page.tsx`

##### `PROFILE.card.avatar` — image | monogram

- **Label:** photo alt `PublicProfile.avatarAlt` — pl „Zdjęcie profilowe {name}” · en "{name}'s profile photo"; monogram: no text alternative (decorative)
- **Where:** card body, first in the identity row. With a cover it is pulled up to straddle the cover's lower edge (−80 px `phone`, −96 px from `sm`) with a 4 px ring in the card colour
- **Shown:** always
- **Enabled:** —
- **Does:** nothing
- **States:** photo — the 128 px variant, displayed 96 px (`phone`) / 128 px (`sm`+), round, cover-cropped · no photo — monogram disc: background `#e7e5e4`, letters `#57534e`, font 34 % of the side, up to two initials (`initialsFrom`: split on spaces, `.`, `_`, `+`, `-`; first letter of each part, a leading digit/symbol skipped; uppercased `pl-PL`; diacritics kept); no letters → plain disc
- **Input:** —
- **A11y:** photo = `img` with alt; monogram = `div aria-hidden="true"`
- **Tests:** happy-path — `locator("article img")` alt „Zdjęcie profilowe {name}”, `naturalWidth > 0`; without storage `locator('article div[aria-hidden="true"]')` count 1
- **Source:** `components/ui/avatar.tsx` — `Avatar`; `lib/monogram.ts` — `initialsFrom`, `MONOGRAM_BACKGROUND`, `MONOGRAM_FOREGROUND`; `page.tsx`

##### `PROFILE.card.name` — heading

- **Label:** the display name (1–80 characters, A4)
- **Where:** name column, first
- **Shown:** always
- **Enabled:** —
- **Does:** —; wraps a single over-long word (`break-words`); display type size shrinks by `clamp()` on narrow screens
- **States:** —
- **Input:** —
- **A11y:** the page's only `h1`
- **Tests:** profile-sections, happy-path — `getByRole("heading", { level: 1, name })`
- **Source:** `page.tsx`

##### `PROFILE.card.headline` — text

- **Label:** the stored headline (≤ 220 characters, one line of text)
- **Where:** name column, under the name
- **Shown:** only when the profile has a headline; absent otherwise
- **Enabled:** —
- **Does:** —
- **States:** present / absent
- **Input:** —
- **A11y:** plain `p`
- **Tests:** profile-sections — `getByText(HEADLINE)`
- **Source:** `profile-sections.tsx` — `HeadlineView`

##### `PROFILE.card.places` — section with list

- **Label:** heading `PublicProfile.locationsHeading` — pl „Siedziba i obszar działania” · en "Based in and working across"
- **Where:** card body, under the identity row
- **Shown:** only when the profile has ≥ 1 place; otherwise the whole section (heading included) is absent
- **Enabled:** —
- **Does:** one chip per place in the stored order (the owner's order, #66): map-pin icon + the label (TERYT name or free text, ≤ 80). Chips are not links
- **States:** present / absent
- **Input:** —
- **A11y:** `section` > `h2` (styled as an eyebrow) > `ul` > `li`
- **Tests:** profile-sections — `getByRole("heading", { name: "Siedziba i obszar działania" })`; `locator("section", { has: heading }).locator("li")` toHaveText in order; `getByText("Warszawa", { exact: true })`
- **Source:** `profile-sections.tsx` — `LocationsView`, `PlaceChip` (without grip/remove), `SectionHeading`

##### `PROFILE.card.bio` — section with text

- **Label:** heading `PublicProfile.bioHeading` — pl „O nas” · en "About"
- **Where:** card body, last
- **Shown:** only when the profile has a bio; otherwise the whole section is absent
- **Enabled:** —
- **Does:** shows the bio with its stored line breaks (`white-space: pre-line`); text only, no markup is ever rendered
- **States:** present / absent
- **Input:** —
- **A11y:** `section` > `h2` > one `p`
- **Tests:** profile-sections — `getByRole("heading", { name: "O nas" })`; visitor `getByText("Pierwszy akapit o pracowni.")` toContainText the second paragraph and toHaveCSS `white-space: pre-line`
- **Source:** `profile-sections.tsx` — `BioView`

##### `PROFILE.works.section` — section

- **Label:** heading `Works.heading` — pl „Realizacje” · en "Works"
- **Where:** below the profile card
- **Shown:** only when the profile has ≥ 1 work; otherwise absent (no heading, no count, no empty state)
- **Enabled:** —
- **Does:** the gallery — V-WORKS-LIST, visitor variant (photos, orbit, lightbox; never the R360 status, grips or edit controls)
- **States:** present / absent
- **Input:** see V-WORKS-LIST
- **A11y:** `section` > `h2`; each card is an `article` with an `h3`
- **Tests:** works-order — visitor `locator("article h3")` order, `getByRole("button", { name: /^Przesuń realizację/ })` count 0; happy-path — `getByRole("heading", { level: 3, name })`, `getByRole("img", { name: "{work}, zdjęcie 1" })`
- **Source:** `page.tsx`; `works-gallery.tsx` — `WorksGallery` (part WORKS)

##### `PROFILE.page.plaque` — decorative sign

- **Label:** the display name on a navy field; a red band underneath reading "Architektów 3d" (the component's hard-coded default, not a dictionary key — F-PROFILE-4)
- **Where:** between `main` and the footer, centred
- **Shown:** always
- **Enabled:** —
- **Does:** —; 150 px wide, no tilt, no shadow; the name's font size is computed from its length so it stays on one line (overrun clipped)
- **States:** —
- **Input:** —
- **A11y:** plain text, not hidden from assistive technology (the name is read a second time)
- **Tests:** none
- **Source:** `components/ui/plaque.tsx` — `Plaque`; `page.tsx`

#### Flows and rules

- **Same render for every non-owner.** `signed-out`, `no-handle` and `other` receive the same page and the same controls; only where the logo's `/` ends up differs (landing page vs. the redirect to the viewer's own profile or onboarding).
- **Empty sections.** Every A12 section is optional and renders nothing when empty. A profile with only a name shows: top bar, card with the monogram and the h1, plaque, footer — no section headings, no "empty" messages, no works heading.
- **Head metadata (A7)** — `generateMetadata` + `profileMetadata`:
  - `<title>`: `{displayName} · {Metadata.title}` — brand `Metadata.title` „Architektów 3d” (identical in pl/en). For a redirect or a miss: `NotFound.title` — pl „Nie znaleziono strony” · en "Page not found".
  - `description`: the headline when set; else `PublicProfile.description` — pl „Profil {name} na {brand}” · en "{name}'s profile on {brand}".
  - Canonical: `{APP_URL}/{handle}` (pl) or `{APP_URL}/en/{handle}` (en) for the requested locale; hreflang alternates for `pl` and `en` (no `x-default`).
  - Open Graph: type `profile`, username = handle, title = display name (not the brand), description = headline else the brand, url = canonical, site name = brand, locale `pl_PL` / `en_US`, image = the avatar's 512 px variant (512×512) or, without a photo, `{APP_URL}/api/og/{handle}` — the same monogram drawn square 512×512 (cached one day). Image alt = `PublicProfile.avatarAlt` in both cases.
  - Twitter: card `summary` (other fields fall back to Open Graph).
  - Indexing: no robots meta tag. `src/proxy.ts` adds the header `X-Robots-Tag: noindex` to every page response when `APP_ENV` is not production; production responses carry no such header (A7, §8).
- **Metadata tests:** profile-sections — `meta[name="description"]` and `meta[property="og:description"]` equal the headline; happy-path — `toHaveTitle("{name} · Architektów 3d")`; profile.spec — `x-robots-tag: noindex` on `/`, `/login`, `/{unknown}`, 404 status and localized 404 heading („Zgubiliśmy się?” / "Lost?").

#### Decisions

- `D-PROFILE-1` — The owner check fails closed: a session that cannot be verified (including a preview with no database) renders the visitor view, never the owner's. Source: `page.tsx` `isOwnerViewing` comment.
- `D-PROFILE-2` — One profile, one URL: a case/whitespace variant and an old handle whose proxy lookup failed open answer 308 from the page (a page cannot emit 301), keeping the query; a missing `DATABASE_URL` reads as 404 but every other failure stays a 500. Source: SPEC §9, A6; `page.tsx` comments (#18 review).
- `D-PROFILE-3` — Sections are optional and absent when empty (no heading, no placeholder); visitor and owner out of edit mode render them with the same components so they cannot drift; the cover is a CSS 3:1 centre crop over variants that keep their aspect (480/1600); the bio keeps line breaks and renders no markup. Source: A12; `profile-sections.tsx` comments (#72).
- `D-PROFILE-4` — Below `sm` the avatar stacks above the name and steps down to 96 px: a 128 px avatar and a display-size name cannot share the 248 px a 360 px phone leaves inside the card. Source: `page.tsx` and `owner-profile-view.tsx` comments.
- `D-PROFILE-5` — No photo → monogram in one stone palette for everyone (no per-handle hue), ≤ 2 initials, diacritics kept; the share image is the same monogram, square 512×512, so both look alike in a chat tile. Source: `monogram.ts` (decision of 05.09.2026, #27); `api/og/[handle]/route.tsx`.
- `D-PROFILE-6` — Head: og:title names the person, not the product; description and og:description use the headline when there is one; og:image is the 512 avatar else the monogram card with the avatar alt; noindex is a response header outside production, set in one place so no route can forget it. Source: A7, §8; `public-profile.ts` (decision of 05.09.2026, #72); `proxy.ts` comment.

#### Findings

- `F-PROFILE-1` — Duplicate of `F-SHELL-5` (a signed-in non-owner gets the signed-out bar; no „Zaloguj się” on any profile bar).
- `F-PROFILE-2` — Stale share-image statements: `page.tsx` still describes "The committed 1200×630 share image … (public/og-placeholder.png)" (the file does not exist) and `public-profile.ts` calls the monogram card "1200×630", and `monogram.ts`'s header speaks of "the 1200×630 card a chat client shows", while `MONOGRAM_CARD` there is 512×512; SPEC §12 still lists "Choice of the specific OG image for profile pages without an avatar" as open although #27 shipped the monogram card. Evidence: those comments; `monogram.ts`; `api/og/[handle]/route.tsx`.
- `F-PROFILE-3` — Duplicate of `F-WORKS-1` (fixed with this document: SPEC §9 now orders works by `position`).
- `F-PROFILE-4` — Duplicate of `F-SHELL-14` (the plaque's default strings are not dictionary keys).

### V-PROFILE-OWNER — the owner's profile, not editing

- **Screenshots:** `v-profile-owner--desktop`, `v-profile-owner--phone` (Appendix A)
- **Route:** same as V-PROFILE. `page.tsx` renders the client component `OwnerProfileView` (plus C-FOOTER) when `isOwnerViewing` is true.
- **Reached by:** `owner`, profile mode `view` — the state every page load starts in. Pressing the edit toggle → V-PROFILE-EDIT.
- **Purpose:** the owner's own public page, same content as a visitor's, plus the entry to editing and the owner's works status.
- **Arrives from → leaves to:** the handle claim at the end of onboarding lands here; `/` and the 404 "home" link send a signed-in owner here; account menu „Profil”; the logo. Leaves via the account menu („Konto” → `/settings/account`, „Wyloguj” → `/`), the gallery (lightbox), or the edit toggle (→ V-PROFILE-EDIT).
- **Layout — differences from V-PROFILE only:**
  - Top bar: left the logo mark linking to `/{own handle}`, not `/`; right the edit toggle + C-ACCOUNT-MENU. No language chip, no „Załóż konto”, no hamburger: the right side stays visible at every width (`TopBar` without `mobileMenu`).
  - Card: same sections and the same read components, fed from the page's field state, which out of edit mode equals the server copy. Under the headline, possibly: the saved notice, and — left over from edit mode — upload progress bars and the cover / name-avatar error lines (F-PROFILE-9).
  - Works section always present: heading + count; gallery in the owner variant (R360 status badge on every card, no controls — V-WORKS-LIST) or the empty state.
  - Plaque shows the page's name field (equal to the server's name out of edit mode).
  - `main` top padding 24/48 px (visitor 32/64 px); identity-row gap from `sm` 32 px (visitor 40 px); name-column gap 12 px (visitor 16 px) — cosmetic.
  - Head metadata identical to V-PROFILE.
- **Server calls:** none in view mode (sign-out belongs to C-ACCOUNT-MENU). A `router.refresh()` started in edit mode (leaving, a photo) re-renders the server part here.

#### Elements

##### `PROFILE-OWNER.topbar.logo` — link

- **Label:** mark + `Brand.wordmark` — „Architektów 3d” (both locales)
- **Where:** top bar, left
- **Shown:** `owner`, `view` and `edit`
- **Enabled:** always
- **Does:** link to `/{own handle}` — this same page (the visitor bar's logo goes to `/`). In `edit` it is not questioned while the address has no query string; with one, C-LEAVE-GUARD asks (the link drops the query)
- **States:** —
- **Input:** mouse, touch, keyboard
- **A11y:** link named by the wordmark (C-TOPBAR)
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `LogoMark href`

##### `PROFILE-OWNER.topbar.edit-toggle` — button

- **Label:** `view`: `PublicProfile.editProfile` — pl „Edytuj profil” · en "Edit profile", pencil icon · `edit`: `PublicProfile.saveProfile` — pl „Zapisz” · en "Save", check icon · while leaving edit mode: `PublicProfile.savingProfile` — pl „Zapisywanie…” · en "Saving…", check icon
- **Where:** top bar, right, before the account-menu avatar
- **Shown:** `owner`, `view` and `edit`, every screen width (`phone` included — no hamburger)
- **Enabled:** disabled while the leave sequence runs (`leaving`)
- **Does:** `view` → enters edit mode (V-PROFILE-EDIT › Flows › Entering edit mode); `edit` → the leave sequence (V-PROFILE-EDIT › Flows › Leaving edit mode)
- **States:** idle `view` · idle `edit` · busy (disabled, `aria-busy="true"`, „Zapisywanie…”)
- **Input:** mouse, touch, keyboard (Enter/Space)
- **A11y:** `button` named by its visible label; no `aria-pressed` (D-PROFILE-7); icons `aria-hidden`. Entering edit mode keeps focus on it. Leaving does not: the sequence disables it and blurs `document.activeElement`, which after a keyboard press (or a click in Chromium) is the toggle itself, so focus falls to the document (F-PROFILE-27).
- **Tests:** happy-path, profile-sections, avatar-upload, leave-guard, works-order, works, lightbox — `getByRole("button", { name: "Edytuj profil" })`, `getByRole("button", { name: "Zapisz", exact: true })`; works — `getByRole("button", { name: "Zapisywanie…" })` visible and disabled while an open form's uploads are held
- **Source:** `owner-profile-view.tsx` — `toggleEditing`

##### `PROFILE-OWNER.topbar.account-menu` — menu

- **Label:** trigger `AccountMenu.menuLabel` — pl „Menu konta” · en "Account menu"; items `AccountMenu.profile` „Profil” / "Profile", `AccountMenu.account` „Konto” / "Account", `Session.logOut` „Wyloguj” / "Log out"
- **Where:** top bar, far right (30 px avatar)
- **Shown:** `owner`, `view` and `edit`
- **Enabled:** always
- **Does:** specified by part SHELL as C-ACCOUNT-MENU. This page passes the server copy of the avatar (128 px) and display name, so the avatar here changes only after a refresh. In `edit`: „Konto” is questioned by C-LEAVE-GUARD; „Profil” is this same page (not questioned unless the address carries a query); „Wyloguj” is not questioned (F-PROFILE-25)
- **States:** see C-ACCOUNT-MENU
- **Input:** see C-ACCOUNT-MENU
- **A11y:** see C-ACCOUNT-MENU
- **Tests:** leave-guard — `getByRole("button", { name: "Menu konta" })`, `getByRole("menuitem", { name: "Konto" })`
- **Source:** `owner-profile-view.tsx`; `components/ui/account-menu.tsx`

##### `PROFILE-OWNER.card.saved-notice` — status line

- **Label:** `PublicProfile.savedProfile` — pl „Zapisano profil” · en "Profile saved"
- **Where:** name column, under the headline and any upload progress bars, above the error lines
- **Shown:** `owner` `view`, for 2.5 s after a successful leave sequence; removed at once when edit mode is entered again
- **Enabled:** —
- **Does:** confirms that edit mode ended with every waited-for save done (see F-PROFILE-8 for the gaps)
- **States:** shown / hidden
- **Input:** —
- **A11y:** `p role="status"`, inserted together with its text (announcement UNVERIFIED)
- **Tests:** profile-sections — `getByText("Zapisano profil")`
- **Source:** `owner-profile-view.tsx` — `savedNotice` (timer 2500 ms)

##### `PROFILE-OWNER.works.count` — text

- **Label:** `Works.count` — pl „{count} z {max}” · en "{count} of {max}" — count = works the server holds, max = 10
- **Where:** works header row, right after the heading, same line
- **Shown:** `owner`, `view` and `edit`, also at zero („0 z 10”); never for visitors
- **Enabled:** —
- **Does:** —; counts the server's list (changes after a refresh — a work added or deleted — never on a drag)
- **States:** —
- **Input:** —
- **A11y:** plain text outside the heading
- **Tests:** none
- **Source:** `owner-profile-view.tsx` (`works.length`, `WORKS_MAX`)

##### `PROFILE-OWNER.works.empty` — empty state

- **Label:** title `Works.emptyTitle` — pl „Jeszcze bez realizacji” · en "No works yet"; body `Works.emptyBody` — pl „Włącz edycję i dodaj pierwszą plusem. Nazwa i jedno zdjęcie wystarczą na start.” · en "Switch on editing and add the first one with the plus. A name and one photo are enough to start."; folder-open icon
- **Where:** in place of the gallery
- **Shown:** `owner` with 0 works, in `view` and in `edit` with the same text (F-PROFILE-6); hidden while a work form is open
- **Enabled:** —
- **Does:** —
- **States:** —
- **Input:** —
- **A11y:** icon + two `p` (no heading)
- **Tests:** works — `getByText("Jeszcze bez realizacji")` (asserted in edit mode after cancelling a form)
- **Source:** `owner-profile-view.tsx`; `components/ui/empty-state.tsx` — `EmptyState`

##### `PROFILE-OWNER.works.gallery` — gallery (owner variant)

- **Label:** see V-WORKS-LIST (R360 badge `Works.card.r360Ready` „R360 gotowy” / "R360 ready", `Works.card.r360None` „Bez R360” / "No R360")
- **Where:** works section, under the header row
- **Shown:** `owner` with ≥ 1 work; `view`: badges only; `edit`: see `PROFILE-EDIT.works.card-controls`
- **Enabled:** —
- **Does:** V-WORKS-LIST with `owner={{ editing }}`, fed the page's `orderedWorks` (the server order, or an unsaved drag order)
- **States:** see V-WORKS-LIST
- **Input:** see V-WORKS-LIST
- **A11y:** see V-WORKS-LIST
- **Tests:** works-order — `article h3` order before/after reload
- **Source:** `owner-profile-view.tsx`; `works-gallery.tsx` (part WORKS)

#### Flows and rules

- **Server copy out of edit mode.** While not editing, every new `profile` object from the server (page load, any `router.refresh()`) re-seeds the name, headline, bio and places on screen and the page's "last saved" copy (`synced` check during render). The works list re-seeds from the server whenever no order save is waiting or unanswered, in both modes.
- **Owner check failure** → the owner sees V-PROFILE (D-PROFILE-1).
- **Saved notice:** set when a leave sequence completes; auto-hides after 2500 ms; hidden when edit mode is entered.

#### Decisions

- `D-PROFILE-7` — The edit control is a quiet button with an icon AND a label that names what it does now („Edytuj profil” → „Zapisz”), not a bare pencil, and carries no `aria-pressed` (a toggle whose name changes would read "Zapisz, pressed"). Source: `owner-profile-view.tsx` comment (decision of 08.09.2026).

#### Findings

- `F-PROFILE-5` — Duplicate of `F-SHELL-4` (no language switch for the owner, SPEC A8).
- `F-PROFILE-6` — Copy that names the wrong mode: `PublicProfile.ownerScopeNote` („Kliknij „Edytuj profil”, aby zmieniać dane…”) is rendered only in edit mode, where that button reads „Zapisz”; `Works.emptyBody` („Włącz edycję i dodaj pierwszą plusem…”) is also shown in edit mode. Evidence: `owner-profile-view.tsx` `{editing && <Card …>{t("ownerScopeNote")}}`; the empty state has no `editing` condition; works.spec asserts it in edit mode.

### V-PROFILE-EDIT — the owner editing in place

- **Screenshots:** `v-profile-edit--desktop`, `v-profile-edit--phone`, `v-profile-edit--place-search--desktop` (Appendix A)
- **Route:** same URL; entering edit mode does not change the address, but C-LEAVE-GUARD pushes a same-URL history entry.
- **Reached by:** `owner` pressing „Edytuj profil”. No other viewer can reach it.
- **Purpose:** change the cover, avatar, name, headline, places, bio and works right on the public page; every change saves itself and is public at once (A12).
- **Arrives from → leaves to:** V-PROFILE-OWNER → back to V-PROFILE-OWNER through „Zapisz” when every waited-for save succeeded; or off the page through C-LEAVE-GUARD („Wyjdź”, or the browser's own dialog).
- **Layout (top → bottom):**
  - Top bar: toggle reads „Zapisz” / „Zapisywanie…”; account menu.
  - Profile card:
    - Cover band (always in edit): the photo or an empty 3:1 slot „Dodaj zdjęcie w tle”; bottom-right corner: „Usuń tło” (only with a cover) then the camera picker.
    - Identity row (the avatar always straddles the band in edit mode): avatar with its camera picker at the bottom-right | name column: name input → headline field → avatar progress → cover progress → (saved notice, normally absent here) → cover error → name/avatar error.
    - Places section: heading → chip list (or „Nie podano miejsca.”) → place combobox (label, input, suggestions, hint, error) → visually hidden status line.
    - Bio field.
  - Scope note card (sunken).
  - Works section: header row [heading, count, limit note | „+”] → new-work form (when open) → gallery with an in-place form replacing the edited card, or the empty state → order error → visually hidden status line → visually hidden move hint.
  - Plaque — shows the name as it is being typed.
  - C-LEAVE-GUARD dialog (when asked).
  - `phone`: same order; the identity row stacks; the cover controls stay at the band's bottom-right; the gallery is one column; text fields fill the width up to 40 rem, the combobox up to 28 rem.
- **Server calls:**

| Call | Trigger | On success | On failure → copy |
| --- | --- | --- | --- |
| `POST /api/profile` `{displayName}` | name blur/Enter, value changed and valid | last-saved copy advanced; field set to the normalized value | 429 → `Settings.profile.name.errors.rateLimited`; any other status or a thrown request → `name.errors.generic` |
| `POST /api/profile/sections` `{headline}` or `{bio}` | field blur, value changed and valid | last-saved copy advanced | 429 → `Settings.profile.sections.errors.rateLimited`; else `sections.errors.generic` |
| `POST /api/profile/sections` `{locations}` (whole array) | place added, removed or moved | last-saved copy advanced | same keys; the list on screen is restored |
| `GET /api/places?q=…&exclude=…` | 250 ms after the place text changes, ≥ 2 characters | suggestion list | nothing shown, no message |
| `POST /api/uploads/presign` → `PUT {uploadUrl}` (XHR) → `POST /api/uploads/confirm` `{stagingKey, purpose}` | avatar or cover file picked | → assign call below | `Settings.profile.upload.errors.*` (Flows › Photo uploads) |
| `POST /api/uploads/abandon` `{stagingKey}` | PUT failed or cancelled | — | ignored (best-effort) |
| `POST /api/profile/avatar` `{fileId}` | confirm succeeded (avatar) | `router.refresh()` | 429 → `upload.errors.rate_limited`; `invalid_avatar` → `Settings.profile.avatar.errors.invalid_avatar`; else `upload.errors.generic` |
| `POST /api/profile/cover` `{fileId}` / `{fileId: null}` | confirm succeeded (cover) / „Usuń tło” | `router.refresh()` | 429 → `upload.errors.rate_limited`; `invalid_cover` → `Settings.profile.cover.errors.invalid_cover`; else `upload.errors.generic` |
| `POST /api/works/order` `{workIds}` | 300 ms after the last work move, or at once on „Zapisz” | nothing (order already on screen) | 429 → `Works.card.moveRateLimited`; any other status → `card.moveStale`; thrown → `card.moveFailed`; then `router.refresh()` |
| `DELETE /api/works/{id}` | delete confirmed on a card | its in-place form closed if open; `router.refresh()` | the card shows `Works.card.deleteFailed` (V-WORKS-LIST) |
| `POST /api/works`, `PATCH /api/works/{id}`, work uploads | V-WORK-FORM | form closes; `router.refresh()` | V-WORK-FORM |

  Server-side per-user limits per minute: name 20, sections 40, avatar assign 10, cover assign 10, place search 300, works order 60, presign 20, confirm 15. 401 `unauthorized`, 403 `forbidden` (cross-site) and 400 `invalid_request` are not worded separately: they fall into each call's generic copy (the order save: `moveStale`).

#### Elements

##### `PROFILE-EDIT.cover.band` — image | placeholder slot

- **Label:** photo alt `PublicProfile.coverAlt` (V-PROFILE); empty slot text `Settings.profile.cover.add` — pl „Dodaj zdjęcie w tle” · en "Add a cover photo"
- **Where:** top of the profile card, full width, 3:1
- **Shown:** `owner` `edit` always (with or without a cover); in `view` only with a cover
- **Enabled:** —
- **Does:** nothing by itself — the slot is not a button; only the camera picks a file
- **States:** photo · empty slot (sunken background, muted text) · no busy overlay (progress shows under the headline)
- **Input:** —
- **A11y:** photo `img` with alt; the slot text is plain text
- **Tests:** none
- **Source:** `owner-profile-view.tsx`; `profile-sections.tsx` — `CoverView`

##### `PROFILE-EDIT.cover.picker` — file picker

- **Label:** with a cover `Settings.profile.cover.change` — pl „Zmień zdjęcie w tle” · en "Change cover photo"; without `cover.add` — pl „Dodaj zdjęcie w tle” · en "Add a cover photo" (visually hidden text + `title` tooltip); camera icon
- **Where:** bottom-right corner of the cover band (16 px inset), to the right of „Usuń tło”; a round 36 px badge
- **Shown:** `owner` `edit`
- **Enabled:** disabled while the cover slot is busy (a cover upload or a cover removal in flight)
- **Does:** opens the system file picker (`accept="image/jpeg,image/png,image/webp"`); a picked file runs the photo chain with purpose `cover` (Flows › Photo uploads), then `POST /api/profile/cover {fileId}` and `router.refresh()`: the new cover appears, edit mode continues. The input is reset after every pick, so the same file can be picked again
- **States:** idle · busy (input disabled; `PROFILE-EDIT.card.upload-progress`) · error → `PROFILE-EDIT.cover.error`
- **Input:** click/tap on the badge (a `label` wrapping a visually hidden `input type="file"`); keyboard: Tab reaches the hidden input, the focus ring is drawn on the badge (`focus-within`); Enter/Space open the picker (native, UNVERIFIED)
- **A11y:** named by the hidden text; `aria-invalid="true"` and `aria-describedby="profile-cover-error"` while a cover error is set
- **Tests:** avatar-upload — `locator("#owner-cover-file").setInputFiles(…)`; confirm body `{stagingKey, purpose: "cover"}`, assign body `{fileId}`
- **Source:** `owner-profile-view.tsx` — `handleImageFile("cover", …)`, `coverInputRef`, `id="owner-cover-file"`

##### `PROFILE-EDIT.cover.remove` — button

- **Label:** `Settings.profile.cover.remove` — pl „Usuń tło” · en "Remove cover"; busy `cover.removing` — pl „Usuwanie tła…” · en "Removing the cover…" (the busy label also shows while a new cover uploads — F-PROFILE-10)
- **Where:** cover band bottom-right, left of the camera (white on-photo button)
- **Shown:** `owner` `edit`, only when a cover exists
- **Enabled:** disabled while the cover slot is busy
- **Does:** at once, without confirmation (F-PROFILE-11): `POST /api/profile/cover {fileId: null}`; success → `router.refresh()` → the band becomes the empty slot (the server removes the old files); failure → `PROFILE-EDIT.cover.error`: 429 → `upload.errors.rate_limited`, `invalid_cover` → `cover.errors.invalid_cover`, other status or thrown → `upload.errors.generic`
- **States:** idle · busy · error
- **Input:** mouse, touch, keyboard
- **A11y:** `button` named by its label
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `removeCover`

##### `PROFILE-EDIT.cover.error` — alert

- **Label:** a photo-chain key from `Settings.profile.upload.errors.*` (Flows › Photo uploads), or `Settings.profile.cover.errors.invalid_cover` — pl „Nie udało się ustawić tego tła. Wgraj je ponownie.” · en "Setting this cover failed. Upload it again.", or `upload.errors.rate_limited` / `upload.errors.generic`
- **Where:** name column, under the progress bars (and saved notice), above the name/avatar error
- **Shown:** while set, in any mode (it survives leaving edit mode — F-PROFILE-9); cleared when the next cover upload or removal starts and on entering edit mode
- **Enabled:** —
- **Does:** —
- **States:** shown / hidden
- **Input:** —
- **A11y:** `p id="profile-cover-error" role="alert"`; the cover input points at it
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `coverError`

##### `PROFILE-EDIT.avatar.picker` — file picker

- **Label:** `Settings.profile.avatar.change` — pl „Zmień zdjęcie profilowe” · en "Change profile photo" (visually hidden text + `title`; same wording with or without a photo); camera icon
- **Where:** bottom-right of the avatar circle (36 px badge overlapping it)
- **Shown:** `owner` `edit`
- **Enabled:** disabled while an avatar upload is in flight
- **Does:** as the cover picker, purpose `avatar`; then `POST /api/profile/avatar {fileId}` and `router.refresh()`: the new photo appears on the card and in the account menu
- **States:** idle · busy (`PROFILE-EDIT.card.upload-progress`) · error → the shared line `PROFILE-EDIT.card.name-avatar-error`: photo-chain key, or `Settings.profile.avatar.errors.invalid_avatar` — pl „Nie udało się ustawić tego zdjęcia. Wgraj je ponownie.” · en "Setting this photo failed. Upload it again.", 429 → `upload.errors.rate_limited`, else `upload.errors.generic`
- **Input:** as the cover picker
- **A11y:** named by the hidden text; `aria-invalid="true"` and `aria-describedby="profile-edit-error"` while an AVATAR error is set (that line may be showing the name's error — F-PROFILE-7)
- **Tests:** avatar-upload — `locator("#owner-avatar-file")` toBeAttached only after „Edytuj profil”; `setInputFiles`; request order presign `{sizeBytes, contentType}` → PUT to the returned URL with `content-type` and `cache-control` → confirm `{stagingKey, purpose: "avatar"}` → assign `{fileId}`; PUT 500 → `getByText("Wysyłka pliku nie powiodła się. Spróbuj ponownie.")` and no confirm; presign 429 → `getByText("Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.")` and no PUT; `text/plain` file → `getByText("Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.")` and no presign. happy-path — real upload, `article img` alt „Zdjęcie profilowe {name}”
- **Source:** `owner-profile-view.tsx` — `handleImageFile("avatar", …)`, `fileInputRef`, `id="owner-avatar-file"`

##### `PROFILE-EDIT.card.upload-progress` — progress bar + cancel button (one per slot)

- **Label:** bar name: avatar `Settings.profile.avatar.change` „Zmień zdjęcie profilowe” / "Change profile photo"; cover `Settings.profile.cover.change` „Zmień zdjęcie w tle” / "Change cover photo" (also for a first cover). Value text `Settings.profile.upload.progress` — pl „Wysyłanie {percent}%” · en "Uploading {percent}%"; then `upload.processing` — pl „Przetwarzanie…” · en "Processing…". Cancel `upload.cancel` — pl „Przerwij wysyłanie” · en "Cancel the upload" (`aria-label` + `title`, "×" icon)
- **Where:** name column under the headline: the avatar bar first, then the cover bar (both can run at once)
- **Shown:** from the moment a file is picked (0 %) until the chain ends (assigned, failed or cancelled). Rendered regardless of mode, so a running upload's bar stays after leaving edit mode (F-PROFILE-9)
- **Enabled:** cancel only while the bytes are still moving (fraction < 1), including while presign is still answering
- **Does:** fills with the bytes sent (floor of the percentage); when the last byte lands it switches to "processing" (full bar, pulsing unless `reduced-motion`) while the server confirms and the page assigns. Cancel aborts the transfer → the staged bytes are abandoned → the bar disappears, no message, the picker is enabled again. A cancel that lands after the last byte but before the confirm is still a cancel
- **States:** uploading n % with cancel · processing (no cancel) · gone
- **Input:** cancel: mouse, touch, keyboard
- **A11y:** `role="progressbar"`, `aria-label` = bar name, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` (absent while processing), `aria-valuetext`; a visually hidden `role="status"` announces the bar name at the start and „Przetwarzanie…” once; the visible percentage is `aria-hidden`
- **Tests:** none for avatar/cover; the same component in the work form — works: `getByRole("progressbar")`, `getByRole("button", { name: "Przerwij wysyłanie" })`
- **Source:** `components/ui/upload-progress.tsx` — `UploadProgress`; `owner-profile-view.tsx` — `avatarProgress`, `coverProgress`, `uploadAborts`

##### `PROFILE-EDIT.card.name` — text field

- **Label:** accessible name only: `Settings.profile.name.label` — pl „Nazwa (studia albo Twoja)” · en "Name (your studio's or your own)" (`aria-label`; no visible label, placeholder, hint or counter — F-PROFILE-12)
- **Where:** name column, first — in place of the h1, in display type with an underline (the page has no h1 while editing)
- **Shown:** `owner` `edit`
- **Enabled:** disabled while its own save is in flight
- **Does:** edits the display name; saves itself when left (Flows › How each field saves)
- **States:** idle · saving (disabled) · error → `PROFILE-EDIT.card.name-avatar-error` with `Settings.profile.name.errors.invalid` — pl „Nazwa musi mieć od 1 do {max} znaków.” · en "The name needs 1 to {max} characters." ({max} = 80), `name.errors.rateLimited` — pl „Zbyt wiele zapisów. Odczekaj chwilę i spróbuj ponownie.” · en "Too many saves. Wait a moment and try again.", `name.errors.generic` — pl „Zapis nie powiódł się. Spróbuj ponownie.” · en "Saving failed. Try again."
- **Input:** typing (browser stops at 80 UTF-16 units, `maxLength`); Enter → default prevented, the field blurs (= save; focus goes to the document); Tab or a click elsewhere → blur (= save)
- **A11y:** `aria-invalid="true"` and `aria-describedby="profile-edit-error"` while a NAME error is set
- **Tests:** happy-path — `getByLabel("Nazwa (studia albo Twoja)")` toHaveValue(draft), `fill`, `blur`, then „Zapisz” and `getByRole("heading", { level: 1, name })`
- **Source:** `owner-profile-view.tsx` — name `input`, `saveName`

##### `PROFILE-EDIT.card.name-avatar-error` — alert (shared)

- **Label:** the name error if set, otherwise the avatar error (`nameError ?? avatarError`) — keys under `PROFILE-EDIT.card.name` and `PROFILE-EDIT.avatar.picker`
- **Where:** name column, last
- **Shown:** while either error is set, in any mode (survives leaving edit mode — F-PROFILE-8, F-PROFILE-9). Name error cleared at the start of every name save pass (every blur of the name field, changed or not); avatar error when the next avatar upload starts; both on entering edit mode
- **Enabled:** —
- **Does:** —; a set name error hides a newer avatar error (F-PROFILE-7)
- **States:** shown / hidden
- **Input:** —
- **A11y:** `p id="profile-edit-error" role="alert"`; referenced by the name input and the avatar input
- **Tests:** avatar-upload — `getByText(…)` for the three upload failures above
- **Source:** `owner-profile-view.tsx`

##### `PROFILE-EDIT.card.headline` — textarea

- **Label:** `Settings.profile.sections.headline.label` — pl „Nagłówek” · en "Headline" (visible label); placeholder `headline.placeholder` — pl „Jednym zdaniem: co robisz i dla kogo” · en "One sentence: what you do and for whom"; hint `headline.hint` — pl „Widoczny pod nazwą, na profilu i w podglądzie linku.” · en "Shown under the name, on the profile and in link previews."; counter `sections.counter` — „{count} / {max}” (both locales)
- **Where:** name column under the name input; hint (left) and counter (right) under the textarea; error under them. Max width 40 rem
- **Shown:** `owner` `edit`
- **Enabled:** always (no saving state)
- **Does:** saves itself on blur (Flows › How each field saves); an emptied headline is stored as none and disappears from the page and the description
- **States:** counter muted below 198 characters; at ≥ 198 (90 % of 220) warning colour and a polite live region · error: `sections.errors.invalid` — pl „Tekst jest za długi albo zawiera niedozwolone znaki.” · en "The text is too long or contains characters that are not allowed."; `sections.errors.rateLimited` — pl „Zbyt wiele zapisów. Odczekaj chwilę i spróbuj ponownie.” · en "Too many saves. Wait a moment and try again."; `sections.errors.generic` — pl „Zapis nie powiódł się. Spróbuj ponownie.” · en "Saving failed. Try again."
- **Input:** 2 rows, vertical resize; typing stops at 220 (`maxLength`); Enter inserts a line break — inside the text the save refuses it (F-PROFILE-13), at either end the save trims it away; blur by Tab or pointer saves
- **A11y:** `label for`; `aria-describedby` = the hint block (hint + counter) plus the error while set; `aria-invalid` while set; counter `aria-live="polite"` only when near the limit, otherwise `off`; error `p role="alert"`
- **Tests:** profile-sections — `getByLabel("Nagłówek")` `fill`/`blur`; `getByText("53 / 220")`; emptied → `getByLabel("Nagłówek")` count 0 after „Zapisz” and the text gone
- **Source:** `owner-profile-view.tsx` — `TextSectionField`, `nearLimit`, `saveText("headline")`

##### `PROFILE-EDIT.places.list` — list

- **Label:** heading `PublicProfile.locationsHeading` — pl „Siedziba i obszar działania” · en "Based in and working across"; empty item `Settings.profile.sections.locations.empty` — pl „Nie podano miejsca.” · en "No place given."
- **Where:** card body, under the identity row
- **Shown:** `owner` `edit` — always, also with no places (then the empty item only)
- **Enabled:** —
- **Does:** one chip per place, in order: grip, label, remove "×"
- **States:** a chip being dragged at 60 % opacity; the chip it would land on gets a stronger border and a focus-ring shadow
- **Input:** see grip and remove
- **A11y:** `section` > `h2` > `ul` > `li`
- **Tests:** profile-sections — `locator("li:has(button[aria-label^='Przesuń miejsce'])")` toHaveText(["Warszawa", "Nowa Wieś"]); `getByText("Warszawa", { exact: true })`
- **Source:** `owner-profile-view.tsx`; `profile-sections.tsx` — `PlaceChip`

##### `PROFILE-EDIT.places.grip` — button + drag gesture

- **Label:** `Settings.profile.sections.locations.grip` — pl „Przesuń miejsce {place}, {position} z {count}” · en "Move {place}, {position} of {count}" (`aria-label` + `title`); described by `Works.card.moveHint` — pl „Strzałkami przesuniesz w przód i w tył listy.” · en "Use the arrow keys to move it forward and back."; grip icon
- **Where:** first in each chip (replaces the map-pin icon of the read view)
- **Shown:** `owner` `edit`, on every chip — also when it is the only one (F-PROFILE-19)
- **Enabled:** always
- **Does:** moves the place; every decided move saves the whole list at once (no debounce — F-PROFILE-16) and sets the status line to `locations.moved` — pl „Miejsce {place} jest teraz na pozycji {position}” · en "{place} is now number {position}"
- **States:** idle · held (chip at 60 %) · landing target (on another chip)
- **Input:** keyboard ArrowLeft/ArrowUp = one place back, ArrowRight/ArrowDown = one forward, nothing past either end, focus stays on the moved chip's grip; Enter/Space do nothing. Mouse (primary button), touch, pen: drag per Flows › Reordering
- **A11y:** `button`, `aria-describedby` → move hint; `touch-action: none`
- **Tests:** profile-sections — `getByRole("button", { name: "Przesuń miejsce Nowa Wieś" }).focus()`, `keyboard.press("ArrowLeft")`, `waitForResponse(/api/profile/sections)` status 200, `getByText("Miejsce Nowa Wieś jest teraz na pozycji 1")` count 1, reload keeps the order, visitor sees it
- **Source:** `profile-sections.tsx` — `PlaceChip`; `components/ui/use-reorder.ts` — `useReorder`; `owner-profile-view.tsx` — `movePlace`

##### `PROFILE-EDIT.places.remove` — button

- **Label:** `Settings.profile.sections.locations.remove` — pl „Usuń {place}” · en "Remove {place}" (`aria-label` + `title`; "×" icon)
- **Where:** last in each chip
- **Shown:** `owner` `edit`
- **Enabled:** always
- **Does:** removes the chip at once (no confirmation) and saves the list; status line `locations.removed` — pl „Usunięto miejsce: {place}” · en "Place removed: {place}"
- **States:** on a refused save the chip comes back and `PROFILE-EDIT.places.error` shows
- **Input:** mouse, touch, keyboard
- **A11y:** `button` named by its label
- **Tests:** profile-sections — `getByRole("button", { name: "Usuń cała Polska" })`, chip text count 0, gone after reload
- **Source:** `profile-sections.tsx` — `PlaceChip`; `owner-profile-view.tsx` — `removePlace`

##### `PROFILE-EDIT.places.combobox` — combobox

- **Label:** `Settings.profile.sections.locations.label` — pl „Dodaj miejsce” · en "Add a place" (visible label); placeholder `locations.placeholder` — pl „Miasto, województwo albo własny opis” · en "City, voivodeship or your own words"; hint `locations.hint` — pl „Podpowiedzi z rejestru TERYT: województwa, powiaty, gminy i wszystkie miejscowości. Enter — albo Tab na klawiaturze telefonu — dodaje własny tekst, np. „cała Polska” albo „Berlin”.” · en "Suggestions come from the TERYT register. Enter — or Tab on a phone keyboard — adds your own text, e.g. “all of Poland” or “Berlin”."
- **Where:** under the chip list; max width 28 rem; hint under the input, error under the hint
- **Shown:** `owner` `edit`
- **Enabled:** disabled while 8 places are on the list (no visible reason — F-PROFILE-14)
- **Does:** type to get suggestions (Flows › Place search); Enter or Tab adds the highlighted suggestion, or the typed text when none is highlighted; the field then empties
- **States:** empty · < 2 characters (no list) · list shown · no match or a failed search (no list, no message) · error
- **Input:** typing (opens the list, clears the highlight; max 80 characters); focus (reopens the list for the current text); ArrowDown/ArrowUp (only while the list has entries; wrap around both ends; default prevented); Enter (default always prevented; adds highlighted suggestion or typed text; blank text adds nothing but still clears); Tab (only with non-blank text: adds like Enter, focus moves on normally); Escape (closes the list, keeps the text); blur (closes the list after 120 ms, adds nothing — F-PROFILE-18). Phone keyboards label the return key "done" (`enterKeyHint`)
- **A11y:** `role="combobox"`, `aria-autocomplete="list"`, `aria-controls` → the listbox id (always set), `aria-expanded` = the list has entries, `aria-activedescendant` → the highlighted option, `aria-describedby` → hint (+ error), `aria-invalid` with an error; `autocomplete="off"`
- **Tests:** profile-sections — `getByRole("combobox", { name: "Dodaj miejsce" })` `fill("warsz")`, `fill("cała Polska")` + `press("Enter")`, toHaveValue("") after a choice
- **Source:** `owner-profile-view.tsx` — `PlaceCombobox`, `addPlace`

##### `PROFILE-EDIT.places.suggestions` — listbox

- **Label:** `aria-label` `Settings.profile.sections.locations.suggestions` — pl „Podpowiedzi” · en "Suggestions". Each option = place name + a detail line built by `placeDetail` from: `locations.kind.voivodeship` „województwo” / "voivodeship", `kind.county` „powiat” / "county", `kind.cityCounty` „miasto na prawach powiatu” / "city county", `kind.commune` „gmina” / "commune", `kind.city` „miasto” / "city", `kind.village` „wieś” / "village", `kind.settlement` „osada” / "settlement", `kind.part` „część miejscowości” / "part of a locality"; `locations.inCommune` — pl „gm. {commune}” · en "commune {commune}"; `locations.inCounty` — pl „pow. {county}” · en "county {county}"; `locations.inCityCounty` — pl „m. {county}” · en "city {county}"
- **Where:** dropdown directly under the input, overlaying the content below; max height 14 rem with its own scroll; the detail is right-aligned and truncated with an ellipsis
- **Shown:** while the input is focused (or within 120 ms of blur) and the server's answer for exactly the current text holds ≥ 1 place
- **Enabled:** —
- **Does:** choosing adds the place's NAME only (the detail is not stored), empties the input, closes the list. Detail rules: voivodeship → kind only; county → „powiat, {voivodeship}” or „miasto na prawach powiatu, {voivodeship}”; any other place → kind, then — inside a city county — „m. {county}” unless the place's name equals the county's (the city itself); elsewhere „gm. {commune}” (not for a commune) and „pow. {county}”; nothing added → the voivodeship
- **States:** one highlighted option (by arrows or hover), others plain
- **Input:** mouse down on an option chooses it (on mousedown, so the input's blur cannot close the list first); hover highlights; keyboard through the combobox
- **A11y:** `ul role="listbox"`; `li role="option" id="{listId}-{index}"`, `aria-selected="true"` on the highlighted option only
- **Tests:** profile-sections — `getByRole("option", { name: /^Warszawa miasto, mazowieckie/ })` and `/^Warszawa miasto na prawach powiatu/` visible; „nowa w” → `getByRole("option")` count 3 in order `/Nowa Wieś.*wieś, m\. Kraków/`, `/Nowa Wieś.*wieś, gm\. Kęty, pow\. oświęcimski/`, `/Nowa Wieś Górna.*część miejscowości/`; `.click()` adds „Nowa Wieś”. Seed rows: `e2e/db/seed-places.ts`
- **Source:** `owner-profile-view.tsx` — `PlaceCombobox`, `placeDetail`; `lib/places.ts` — `searchPlaces`; `api/places/route.ts`

##### `PROFILE-EDIT.places.error` — alert

- **Label:** `Settings.profile.sections.locations.duplicate` — pl „To miejsce już jest na liście.” · en "That place is already on the list."; `locations.tooMany` — pl „Maksymalnie {max} miejsc.” · en "At most {max} places." ({max} = 8; not reachable from the UI — F-PROFILE-14); `sections.errors.invalid` / `rateLimited` / `generic` (copy under `PROFILE-EDIT.card.headline`)
- **Where:** under the combobox hint
- **Shown:** `owner` `edit` while set; cleared when the next place save starts and on entering edit mode; typing does not clear it
- **Enabled:** —
- **Does:** —
- **States:** shown / hidden
- **Input:** —
- **A11y:** `p id="{id}-error" role="alert"`; the combobox becomes `aria-invalid` and describes itself with it
- **Tests:** profile-sections — `getByText("To miejsce już jest na liście.")`
- **Source:** `owner-profile-view.tsx` — `PlaceCombobox`, `addPlace`, `saveLocations`

##### `PROFILE-EDIT.places.status` — status line (visually hidden)

- **Label:** `Settings.profile.sections.locations.added` — pl „Dodano miejsce: {place}” · en "Place added: {place}"; `locations.removed` — pl „Usunięto miejsce: {place}” · en "Place removed: {place}"; `locations.moved` — pl „Miejsce {place} jest teraz na pozycji {position}” · en "{place} is now number {position}"
- **Where:** end of the places section
- **Shown:** `owner` `edit` (the element exists only in edit mode; its last text is kept between edit sessions)
- **Enabled:** —
- **Does:** tells a screen reader what the last place action did; the text is set before the save answers (F-PROFILE-15)
- **States:** —
- **Input:** —
- **A11y:** `p role="status"` (polite), `sr-only`
- **Tests:** profile-sections — `getByText("Miejsce Nowa Wieś jest teraz na pozycji 1")` count 1
- **Source:** `owner-profile-view.tsx` — `locationsNotice`

##### `PROFILE-EDIT.card.bio` — textarea

- **Label:** `Settings.profile.sections.bio.label` — pl „Bio” · en "Bio"; placeholder `bio.placeholder` — pl „Kim jesteście, co robicie, z kim pracujecie” · en "Who you are, what you do, who you work with"; hint `bio.hint` — pl „Zapis po opuszczeniu pola. Podziały akapitów zostają.” · en "Saved when you leave the field. Paragraph breaks are kept."; counter `sections.counter` „{count} / {max}”
- **Where:** card body, last (under the places section); max width 40 rem
- **Shown:** `owner` `edit`
- **Enabled:** always (no saving state)
- **Does:** saves itself on blur; line breaks allowed and kept; an emptied bio removes the „O nas” section
- **States:** counter warns at ≥ 1350 (90 % of 1500); errors as the headline (`sections.errors.*`)
- **Input:** 6 rows, vertical resize; typing stops at 1500 (`maxLength`); Enter inserts a line break
- **A11y:** as the headline field
- **Tests:** profile-sections — `getByLabel("Bio")` `fill`/`blur`
- **Source:** `owner-profile-view.tsx` — `TextSectionField`, `saveText("bio")`

##### `PROFILE-EDIT.page.scope-note` — note

- **Label:** `PublicProfile.ownerScopeNote` — pl „Kliknij „Edytuj profil”, aby zmieniać dane bezpośrednio na profilu. Każde pole zapisuje się, gdy je opuścisz.” · en "Click “Edit profile” to change things right on the profile. Each field saves when you leave it."
- **Where:** between the profile card and the works section (sunken card)
- **Shown:** `owner` `edit` only (F-PROFILE-6)
- **Enabled:** —
- **Does:** —
- **States:** —
- **Input:** —
- **A11y:** plain `p`
- **Tests:** none
- **Source:** `owner-profile-view.tsx`

##### `PROFILE-EDIT.works.limit-note` — text

- **Label:** `Works.limitReached` — pl „Limit {max} realizacji. Usuń jedną, aby dodać nową.” · en "The limit is {max} works. Remove one to add another." ({max} = 10)
- **Where:** works header row, after the heading and the count
- **Shown:** `owner` `edit` when the server holds 10 works
- **Enabled:** —
- **Does:** explains the disabled „+”
- **States:** —
- **Input:** —
- **A11y:** `span id="works-limit"`, the description of the „+” button
- **Tests:** none
- **Source:** `owner-profile-view.tsx`

##### `PROFILE-EDIT.works.add` — button (icon)

- **Label:** `Works.add` — pl „Dodaj realizację” · en "Add a work" (`aria-label` + `title`; "+" icon)
- **Where:** works header row, right end
- **Shown:** `owner` `edit`
- **Enabled:** disabled at 10 works; then `aria-describedby="works-limit"`
- **Does:** toggles the new-work form: closed → opens it above the list (an open in-place edit form is replaced; its typed data and unsaved uploads are discarded — F-PROFILE-22); open → closes it (discarded, like „Anuluj”)
- **States:** `aria-expanded="true"` while the new-work form is open, otherwise `false`
- **Input:** mouse, touch, keyboard
- **A11y:** icon button named by `aria-label`
- **Tests:** happy-path, works, leave-guard — `getByRole("button", { name: "Dodaj realizację" })`
- **Source:** `owner-profile-view.tsx` — `setWorkForm`

##### `PROFILE-EDIT.works.new-form` — region

- **Label:** the form's own title `Works.form.newTitle` „Nowa realizacja” / "New work" (V-WORK-FORM)
- **Where:** directly under the works header row, above the gallery (with 0 works nothing follows it — the empty state is hidden while a form is open)
- **Shown:** `owner` `edit` while opened by „+”
- **Enabled:** —
- **Does:** V-WORK-FORM for a new work (its fields, uploads and focus on open are specified there). Its save → form closed + `router.refresh()` (the new card appears, count updates); its „Anuluj” → form closed. Focus is not returned anywhere on close (F-PROFILE-21). Settled by „Zapisz” (Flows › Leaving edit mode)
- **States:** see V-WORK-FORM
- **Input:** see V-WORK-FORM
- **A11y:** see V-WORK-FORM
- **Tests:** happy-path, works, leave-guard — `getByRole("heading", { name: "Nowa realizacja" })`, `getByLabel("Nazwa", { exact: true })`, `getByTestId("work-photos")`, `getByRole("button", { name: "Zapisz realizację" })`
- **Source:** `owner-profile-view.tsx` — `WorkForm key="new"`; `work-form.tsx` (part FORM)

##### `PROFILE-EDIT.works.in-place-form` — region

- **Label:** the form's own title `Works.form.editTitle` „Edytuj realizację” / "Edit work" (V-WORK-FORM)
- **Where:** inside the gallery grid at the edited work's position, in place of its card, spanning both columns from `sm`
- **Shown:** `owner` `edit` after a card's „Edytuj”
- **Enabled:** —
- **Does:** V-WORK-FORM for that work. Opening it replaces any other open form (discarded — F-PROFILE-22). While it stands the gallery shows no grips (no reordering, V-WORKS-LIST). Its save → closed, focus to that card's „Edytuj” in the next frame, `router.refresh()`; its „Anuluj” → closed, same focus return. (`onDelete` also clears the form of a deleted work, but that work's Delete is not rendered while its form stands, so this is unreachable; a deletion elsewhere unmounts the form on the next refresh and leaves `workForm` set.)
- **States:** see V-WORK-FORM
- **Input:** see V-WORK-FORM
- **A11y:** focus return via `[data-work-edit="{id}"]`
- **Tests:** works — `locator("section", { has: getByRole("heading", { name: "Realizacje" }) }).locator("ul > li")` count stays 2; `items.nth(1).getByRole("heading", { name: "Edytuj realizację" })`; `getByRole("button", { name: "Edytuj: {name}" })` toBeFocused after „Anuluj”; PATCH body after „Zapisz zmiany”
- **Source:** `owner-profile-view.tsx` — `inPlace`, `closeInPlaceForm`; `works-gallery.tsx`

##### `PROFILE-EDIT.works.card-controls` — grips, edit and delete on cards

- **Label:** grip `Works.card.move` — pl „Przesuń realizację {name}, {position} z {count}” · en "Move {name}, {position} of {count}", described by `Works.card.moveHint`; edit/delete labels and the delete confirmation are specified in V-WORKS-LIST
- **Where:** each card's footer row (V-WORKS-LIST)
- **Shown:** `owner` `edit`; grips only with ≥ 2 works and no in-place form open
- **Enabled:** see V-WORKS-LIST
- **Does (this view's handlers):** a grip move → `moveWork`: the list reorders on screen at once, the order error clears, the status line says `Works.card.moved`, the order save is queued (Flows › Works order); „Edytuj” → opens the in-place form; a confirmed delete → `DELETE /api/works/{id}`: network error or non-2xx → reported as failed (card shows `Works.card.deleteFailed`); success → `router.refresh()`
- **States:** see V-WORKS-LIST
- **Input:** grips per Flows › Reordering
- **A11y:** see V-WORKS-LIST
- **Tests:** works-order — `getByRole("button", { name: /^Przesuń realizację/ })` count 0 out of edit, 3 in edit; `getByRole("button", { name: "Przesuń realizację Dom w lesie" }).focus()` + `ArrowUp` twice, each `waitForResponse(/api/works/order)` 200; pointer drag `mouse.down` → `mouse.move(…, { steps: 8 })` → `mouse.up`; `article h3` order survives reload
- **Source:** `owner-profile-view.tsx` — `order`, `workOrder`, `moveWork`, `onEdit`, `onDelete`; `works-gallery.tsx` — `WorkCard` (part WORKS)

##### `PROFILE-EDIT.works.order-error` — alert

- **Label:** `Works.card.moveStale` — pl „Lista realizacji zmieniła się gdzie indziej. Odświeżamy ją — ustaw kolejność jeszcze raz.” · en "The list of works changed elsewhere. Reloading it — set the order again."; `card.moveRateLimited` — pl „Za dużo zmian kolejności naraz. Odczekaj chwilę.” · en "Too many changes at once. Wait a moment."; `card.moveFailed` — pl „Nie udało się zapisać kolejności. Spróbuj jeszcze raz.” · en "The order could not be saved. Try again."
- **Where:** under the gallery / empty state
- **Shown:** `owner` `edit` while set; cleared by the next work move and on entering edit mode; hidden (not cleared) out of edit mode
- **Enabled:** —
- **Does:** —
- **States:** shown / hidden
- **Input:** —
- **A11y:** `p role="alert"`
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `worksOrderError`, `saveWorkOrder`

##### `PROFILE-EDIT.works.status` — status line (visually hidden)

- **Label:** `Works.card.moved` — pl „Realizacja {name} jest teraz na pozycji {position}” · en "{name} is now number {position}"
- **Where:** end of the works section
- **Shown:** `owner` (element present in both modes; text set only by moves in `edit`)
- **Enabled:** —
- **Does:** announces each decided work move (before the save answers)
- **States:** —
- **Input:** —
- **A11y:** `p role="status"`, `sr-only`
- **Tests:** works-order — `getByText("Realizacja Dom w lesie jest teraz na pozycji 2")` count 1
- **Source:** `owner-profile-view.tsx` — `worksNotice`

##### `PROFILE-EDIT.works.move-hint` — description (visually hidden)

- **Label:** `Works.card.moveHint` — pl „Strzałkami przesuniesz w przód i w tył listy.” · en "Use the arrow keys to move it forward and back."
- **Where:** end of the works section
- **Shown:** `owner` (both modes)
- **Enabled:** —
- **Does:** the `aria-describedby` target of every work grip AND every place grip (a grip is a button, whose own keys Enter/Space move nothing)
- **States:** —
- **Input:** —
- **A11y:** `p id={useId()} class="sr-only"`
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `moveHintId`

#### Flows and rules

**Entering edit mode** (`toggleEditing`, not editing):

- `editing` = true; the saved notice is removed; all seven error states are cleared (name, avatar, cover, headline, bio, places, works order) — D-PROFILE-15.
- C-LEAVE-GUARD arms at once (history entry, `beforeunload`, link listener) — even before anything changes.
- The fields start from the last server copy. Not reset: the hidden status texts, the progress of an upload still running.
- Focus stays on the toggle (now „Zapisz”); nothing is focused inside the card.
- Cover band appears (slot if no cover), avatar straddles it, h1 → name input, headline/bio → labelled textareas, chips gain grips and "×", combobox appears, scope note appears, „+” and card controls appear.

**The field model** (`fields`, `saved`, `synced`, `pending`):

- `fields` — what is on screen. While editing it is the truth; a server render never overwrites it.
- `saved` — what the page believes the server holds: seeded from the server, advanced by every successful save; name, headline and bio skip the request when their new value equals it.
- `synced` — the server `profile` object the fields were last seeded from. "Synced" out of edit mode = whenever a different server object arrives and `editing` is false, `fields` and `saved` are re-seeded from it. Photos (avatar, cover) always render straight from the server object, so they change mid-edit after a refresh.
- `pending` — the set of saves in flight (name, headline, bio, places, works order), each resolving to success/failure; a save leaves the set as soon as it settles.

**How each field saves:**

| Field | Saves when | Checked in the browser first | Skips the request when | On screen before the answer | On success | On failure |
| --- | --- | --- | --- | --- | --- | --- |
| Name | blur (Enter blurs) | `displayNameSchema`: NFC, trim, 1–80, no control/format/line-separator characters → `name.errors.invalid` | trimmed value = saved name | typed text; input disabled | saved advanced; field replaced by the normalized value | error in the shared line; typed text stays (no rollback) |
| Headline | blur | `headlineSchema`: NFC, trim, ≤ 220, no control/format characters (line breaks refused) → `sections.errors.invalid` | normalized value = saved headline | typed text | saved advanced (field keeps what was typed) | error under the field; text stays |
| Bio | blur | `bioSchema`: CR/CRLF → LF, NFC, trim, ≤ 1500, line breaks allowed | normalized value = saved bio | typed text | saved advanced | error under the field; text stays |
| Places | add, remove, move | add: blank → ignored silently; same place ignoring case (`pl` lowercase) → `locations.duplicate`, no request; ≥ 8 → `locations.tooMany`; then `locationsSchema` (each NFC, trim, 1–80, no control chars; ≤ 8; no case-insensitive duplicates) → `sections.errors.invalid` | never (always sent) | the new list at once (optimistic) | saved advanced | list restored to the one captured when this change started; error under the combobox |
| Works order | 300 ms after the last move | — | nothing waiting | new order at once (optimistic) | unsaved flag cleared | error + `router.refresh()`: the server's order comes back (no local snapshot) |
| Avatar, cover | file picked | type JPEG/PNG/WebP, size 1 B–10 MB | — | old photo + progress bar | `router.refresh()` → new photo | error; photo unchanged |
| Cover removal | „Usuń tło” | — | — | „Usuwanie tła…” | `router.refresh()` → slot | error; cover unchanged |

- An empty headline or bio is a valid save meaning "none" (the section disappears for visitors).
- Nothing shows "saving" for headline, bio or places; nothing confirms a successful field save on screen.

**Place search** (`PlaceCombobox`):

- Text trimmed to fewer than 2 characters → no request, no list.
- 250 ms after the text (or the chip list) last changed: `GET /api/places?q={trimmed text}&exclude={chip}&exclude={chip}…`, `cache: "no-store"`; a newer change cancels the older timer and aborts its request.
- Server (`api/places/route.ts`, `lib/places.ts`): session required (401); 300 requests/min per user (429); `q` cut to 80 characters; first 16 `exclude` values, each cut to 80; match = the folded name starts with the folded query (lowercase, diacritics removed, ł → l: "lodz" finds Łódź); places whose folded name equals a chip's folded name are excluded (a chip „Warszawa” hides both the city and the city county); order: voivodeship, county, city, commune, village, settlement, part of a locality, then by name, voivodeship, county, register code; at most 10; response `cache-control: private, no-store`.
- The list shows only the answer for exactly the current text: while a newer answer is on its way there is no list. A refused (non-2xx) or failed request changes nothing and says nothing (F-PROFILE-17).
- Adding (Enter, Tab, option mousedown) → `addPlace(name or typed text)`, then — whatever the outcome, duplicate included — the input empties, the stored answer is dropped, the list closes, the highlight resets.

**Reordering** (`useReorder`, shared by place chips and work cards):

- The handle is the grip button (`touch-action: none`, so a touch drag starting on a grip never scrolls the page).
- Start: `pointerdown` — mouse only with the primary button; touch and pen any contact — and only if no other drag is active (a second finger cannot take over) and every item's box can be measured. Boxes are measured once; the pointer is captured by the grip, so the drag keeps reporting outside the list.
- Move: the target is the item whose box contains the point; failing that, the item whose centre is nearest (ties → the earlier item). Re-renders only when the target changes.
- Drop: `pointerup` — target ≠ start → exactly one move (the item goes to the target index, the rest close up); target = start → nothing. No distance threshold.
- Cancel: `pointercancel` (the browser took the gesture: scroll, back-swipe) or lost capture (grip unmounted, e.g. edit mode ended or the list shrank) → drag ends, nothing moves.
- While dragging: held item 60 % opacity; landing item focus-ring shadow (chips also a stronger border). No floating copy, no live shifting, no auto-scroll.
- Keyboard: ArrowLeft/ArrowUp one back, ArrowRight/ArrowDown one forward (default prevented), nothing at the ends; after the list re-renders focus is put back on the moved item's grip.
- Each decided move → places: status line + immediate save; works: status line + queued order save.

**Works order save** (`moveWork`, `queueOrderSave`, `saveWorkOrder`):

- A move keeps the newest full order as "waiting", marks the list unsaved and restarts a 300 ms timer.
- The timer (or „Zapisz”) sends the waiting order once: `POST /api/works/order {workIds: [...all ids in order]}`. The server refuses an order that is not exactly the owner's current works (`stale_order`, e.g. a work added/deleted in another tab).
- Success → unsaved flag cleared. Failure → error (`moveRateLimited` for 429, `moveStale` for any other status — F-PROFILE-20, `moveFailed` when the request throws), unsaved flag cleared, `router.refresh()`; the server's order then replaces the list.
- While the list is unsaved, a refresh from elsewhere does not replace it; its payload waits as the current prop, and the list re-seeds from it as soon as the order save succeeds — a refresh rendered before the order committed therefore puts the old order back on screen (the server keeps the new one) until the next refresh.

**Photo uploads** (`handleImageFile`, `uploadImage`):

1. Picked → the slot's error cleared, the input reset, busy on, progress 0 %, a cancel controller stored.
2. Browser guards, before any request: type not JPEG/PNG/WebP → `file_type`; size 0 or > 10 MB → `file_size`.
3. `POST /api/uploads/presign {sizeBytes, contentType}` — the server reserves the bytes against the 10 GB limit atomically (A9: stored + still-staged bytes) → refused → 400 `quota_exceeded`.
4. `PUT` the file to the returned URL (XHR, headers `content-type` and an immutable `cache-control`), reporting upload progress; 100 % → "processing". Non-2xx or network error → `upload_failed` + abandon; cancelled → no message + abandon.
5. `POST /api/uploads/confirm {stagingKey, purpose}` — the server decodes, checks (> 10 MB or > 64 megapixels → `too_large`; not decodable → `not_an_image`; other format → `unsupported_format`; bytes missing → `not_found`; A9 re-check → `quota_exceeded`) and publishes the variants (avatar 512/128 square, cover 1600/480 wide).
6. `POST /api/profile/{avatar|cover} {fileId}` → success → `router.refresh()`.
7. Always at the end: controller dropped, bar removed (right after `router.refresh()` is issued, before the new photo arrives — UNVERIFIED gap), busy off, input reset.

Error copy (`Settings.profile.upload.errors.*`), mapping: presign/confirm answer 429 → `rate_limited`; a known server code → that key; anything else, or any thrown request → `generic`:
- `file_type` — pl „Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.” · en "That format is not supported — choose JPEG, PNG or WebP."
- `file_size` — pl „Plik musi mieć od 1 bajta do 10 MB.” · en "The file needs to be between 1 byte and 10 MB."
- `upload_failed` — pl „Wysyłka pliku nie powiodła się. Spróbuj ponownie.” · en "The file upload failed. Try again."
- `quota_exceeded` — pl „Brak miejsca: to zdjęcie przekroczyłoby Twój limit 10 GB.” · en "No space left: this photo would exceed your 10 GB limit." (A9's over-limit message)
- `too_large` — pl „Zdjęcie jest za duże (limit 10 MB i 64 megapiksele).” · en "The photo is too large (10 MB and 64 megapixels are the limits)."
- `not_an_image` — pl „Ten plik nie wygląda na poprawny obraz.” · en "This file does not look like a valid image."
- `unsupported_format` — pl „Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.” · en "That format is not supported — choose JPEG, PNG or WebP."
- `not_found` — pl „Plik nie dotarł do magazynu. Spróbuj ponownie.” · en "The file did not reach storage. Try again."
- `rate_limited` — pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.” · en "Too many attempts. Wait a moment and try again."
- `generic` — pl „Coś poszło nie tak. Spróbuj ponownie.” · en "Something went wrong. Try again."

Upload abort: only the progress bar's cancel aborts (`AbortController` → XHR abort → `POST /api/uploads/abandon`). Nothing aborts an avatar/cover upload when edit mode ends or the page component unmounts (F-PROFILE-9, F-PROFILE-26).

**Work forms and cards:**

- One form at a time: `+` opens the new-work form above the list; a card's „Edytuj” puts that work's form in place of its card; opening either replaces the other (the replaced form unmounts, discarding its uploads).
- No grips while an in-place form stands in the list.
- The empty state hides while any form is open.

**Leaving edit mode** (`toggleEditing`, editing — the top-bar „Zapisz”):

1. `leaving` = true → toggle disabled, `aria-busy`, „Zapisywanie…”.
2. The focused element is blurred. After a keyboard press, or a click or tap in Chromium, that is the toggle itself — a text field was already blurred by the press, which started its save; where a press leaves focus in a text field (Safari), this blur starts its save (added to `pending`). A focused place combobox only closes its list — typed text not yet added is dropped (F-PROFILE-18).
3. If a work form is open → `await settle()` (V-WORK-FORM):
   - waits, repeatedly, until the form has no photo or archive work in flight;
   - the form went away meanwhile (its „Anuluj”, another „Edytuj”) → `closed`;
   - the form is untouched (new: all text blank, no photos, no orbit; edit: equal to the saved work) → `closed` → the page closes it (its unmount discards its files);
   - otherwise the form saves itself: success → `saved` (its `onSaved` already closed it and called `router.refresh()`); refused but the form went away meanwhile → `closed`;
   - its save refused with the form still open → the form scrolls into view (smooth), focuses its name field, keeps its error → `kept` → **the page stays in edit mode** (steps 4–6 skipped), the toggle returns to „Zapisz”.
4. `await saveWorkOrder()` — an order still waiting for its timer is sent now.
5. `await Promise.all(pending)` — every save still in the set. Any failure → **stay in edit mode**, each failed field showing its error.
6. Otherwise: `editing` = false (C-LEAVE-GUARD disarms and removes its history entry), the saved notice „Zapisano profil” shows for 2.5 s, `router.refresh()`. The fields re-seed from the server copy as soon as a new server object arrives — at once if a photo refresh happened during editing, and then from that older copy: a field saved after the photo briefly shows its previous value until the step-6 refresh lands.
7. In every case `leaving` = false.

- Not waited for: avatar/cover uploads and a cover removal (F-PROFILE-9); a save that already failed before „Zapisz”; a save that settled before step 5 read the set — including the order save sent in step 4 and any save that finished during steps 3–4; a save started after step 5 began (F-PROFILE-8).
- „Zapisano” is shown only when step 6 runs; edit mode is kept open only for `kept` (step 3) or a failure still in the set at step 5.
- Focus: entering keeps it on the toggle; leaving drops it to the document in every outcome except `kept`, which focuses the form's name field. After `saved` for an in-place form, its focus return targets the card's „Edytuj”, which disappears when edit mode ends.

**`router.refresh()` — every use on this page:**

- avatar assigned; cover assigned; cover removed — immediately, also mid-edit;
- a work saved (new or in place) — the form's `onSaved`;
- a work deleted;
- a works order refused or failed;
- a successful leave (step 6).
- Never after a name, headline, bio or places save (D-PROFILE-8).

**Stale errors on re-entering edit mode:** every error state is cleared on entry (list above). Out of edit mode only the cover error and the name/avatar line can still be visible (their elements render in any mode); headline, bio, places and order errors are inside edit-only elements and simply disappear until re-entry clears them.

**Live regions on this page:**

- polite, persistent, visually hidden: places status (edit only), works status;
- polite, inserted with text: saved notice (visible);
- per upload: hidden status announcing the bar's name at start and „Przetwarzanie…”;
- text counters: polite only at ≥ 90 % of the limit;
- alerts: cover error, name/avatar error, headline error, bio error, places error, works order error (plus the work form's and card's own — V-WORK-FORM, V-WORKS-LIST).

**Timers and limits (summary):** saved notice 2500 ms; works order 300 ms after the last move; place search 250 ms after typing pauses; suggestion list closes 120 ms after blur; progress bar width transition 200 ms. Name 80, headline 220, bio 1500, places 8 × 80, works 10 (`WORKS_MAX`), photo 10 MB / 64 MP, account 10 GB.

#### Decisions

- `D-PROFILE-8` — Profile editing happens in place on the public page; each field saves itself when it is left and is public at once (no draft/published state); while editing, the fields on screen are the truth and no refresh follows a field save — a refresh per field raced the next field and a stale server copy wiped optimistic changes — with one refresh when editing ends. Source: A12 ("Edited in place on the owner's page; public the moment it is saved"), §11; `owner-profile-view.tsx` comment (#72 step 2 review); #58.
- `D-PROFILE-9` — A photo change refreshes the page at once because its URLs exist only on the server; bytes go from the browser straight to storage by a presigned PUT and never through the app; type and size are refused in the browser before any request (keeps the presign rate limit for uploads that can succeed); every upload shows one progress look, announced at start and at "processing" only, with cancel only while bytes move. Source: G4, A4, A9; `handleImageFile` comment; `upload-client.ts` (#12, #80); `avatar-upload.spec.ts` comment; `upload-progress.tsx` (#80).
- `D-PROFILE-10` — Places: free text is allowed beside TERYT suggestions; suggestions are searched on the server (the registers are 100 000 rows) 250 ms after typing pauses, from 2 characters, 10 at most, excluding chips already chosen; Tab adds like Enter and the return key reads "done", because a phone keyboard offers "next" (= Tab) where a desktop offers Enter; a duplicate (ignoring case) is refused with a reason; the order of places is the array itself, saved like an add. Source: A12, #87, #66; `owner-profile-view.tsx`, `places.ts`, `profile-schemas.ts` comments; profile-sections e2e ("refused with a reason, not silently dropped").
- `D-PROFILE-11` — Reordering uses pointer events rather than HTML5 drag-and-drop (`dragstart` never fires on touch), and the same grip answers the arrow keys one step per press with no grab mode; focus follows the moved item. Source: `use-reorder.ts` comments (#66).
- `D-PROFILE-12` — The works order is sent once the moving stops (300 ms), not per move (arrow-key repeat would fire concurrent requests committed in arbitrary order and hit the rate limit); a refused order is repaired by the server's own answer (refresh), never by a local snapshot that could resurrect a work deleted in another tab. Source: `owner-profile-view.tsx` comments (#66); `lib/works.ts` `reorderWorks`.
- `D-PROFILE-13` — A text counter turns to a warning at 90 % of the limit and only then becomes a polite live region, so a screen reader is not read every keystroke's count. Source: `nearLimit` comment.
- `D-PROFILE-14` — „Zapisz” settles an open work form instead of closing it over its uploads: it waits, closes an untouched form, saves a filled one, or keeps editing with the form's reason on screen; an edited work's form stands where its card was and focus returns to that card's „Edytuj”. Source: #85, #86; `work-form.tsx` `WorkFormHandle` comment; `closeInPlaceForm` comment.
- `D-PROFILE-15` — Re-entering edit mode clears every old error ("a failed save shouldn't keep shouting once the owner has stepped back in"). Source: `clearErrors` comment.

#### Findings

- `F-PROFILE-7` — Name and avatar share one error line showing `nameError ?? avatarError`: a stale name error hides a fresh avatar error, and the avatar input's `aria-describedby="profile-edit-error"` then points at the name's message. A name error clears only at the next blur of the name field (or on re-entry), an avatar error when the next avatar upload starts. Evidence: `owner-profile-view.tsx` shared `p#profile-edit-error`. The code comment accepts it as "rare enough in one editing pass not to warrant two separate slots" — possibly deliberate; the comment sits above the cover error, not the shared line.
- `F-PROFILE-8` — „Zapisano profil” can be shown over a failed save, contrary to the `toggleEditing` comment ("'Zapisano' is never claimed for a save that did not happen"): (a) the order save that the leave sequence itself sends is awaited but its result is discarded — `track()` removes a save from `pending` in a `.finally` registered before the `await`, so it is gone when `Promise.all([...pending.current])` reads the set; a refused order ends editing, its error (edit-only) disappears and the notice shows; (b) any field save that settles while the sequence awaits `settle()` or the order request is likewise gone from the set; (c) a save that failed before „Zapisz” is not retried or checked: editing ends, the refused value is replaced by the server copy, headline/bio/places errors vanish, a name error stays visible under the h1; (d) saves started after the set was read are not waited for. Evidence: `owner-profile-view.tsx` — `track`, `saveWorkOrder`, `toggleEditing`. (a)/(b) follow from promise reaction order; to be reproduced on the app.
- `F-PROFILE-9` — Leaving edit mode does not wait for avatar/cover uploads or a cover removal (`handleImageFile`, `removeCover` are not tracked), while the progress bars, the cover error and the name/avatar error render outside the `editing` condition: after „Zapisz” a running bar (with its cancel) stays in view mode, a later failure appears there, and „Zapisano profil” was shown before the photo was saved. Evidence: `owner-profile-view.tsx` JSX (`avatarProgress !== null && …`, `coverError && …`, `(nameError || avatarError) && …`).
- `F-PROFILE-10` — While a new cover uploads over an existing one, the remove button reads „Usuwanie tła…” ("Removing the cover…"): one `coverBusy` flag drives both the upload and the removal label. Evidence: `handleImageFile("cover", …, setCoverBusy, …)`; `coverBusy ? tCover("removing") : tCover("remove")`.
- `F-PROFILE-11` — Removing the cover acts at once, with no confirmation, and the server deletes the old files, while deleting a work asks „Usunąć razem ze zdjęciami?” first. Evidence: `removeCover`; `api/profile/cover/route.ts` comment; `works-gallery.tsx` `confirming`. May be deliberate (a cover is one re-uploadable photo).
- `F-PROFILE-12` — The name input is unlike the other text fields: no visible label (aria-label only), no hint, no counter; its invalid message „Nazwa musi mieć od 1 do {max} znaków.” names only the length although `displayNameSchema` also refuses control/format characters (the sections' message names both); it is disabled while saving, while headline, bio and places show no saving state at all; and the page has no h1 while editing. Evidence: `owner-profile-view.tsx` name `input` vs `TextSectionField`; `profile-schemas.ts`. May be deliberate: the input stands in for the heading (#58).
- `F-PROFILE-13` — The headline is a 2-row textarea that accepts Enter and pasted line breaks, but `headlineSchema` refuses a break between characters (`\p{Cc}` includes the newline; a leading or trailing one is trimmed and saves silently), so the blur save fails with the generic „Tekst jest za długi albo zawiera niedozwolone znaki.” Evidence: `TextSectionField` (no key handling, `rows={2}`); `profile-schemas.ts` `NO_CONTROL_OR_FORMAT`.
- `F-PROFILE-14` — At 8 places the combobox is simply disabled with no visible reason, so `locations.tooMany` („Maksymalnie {max} miejsc.”) can never be shown; at the works limit the „+” is disabled AND explained by `Works.limitReached` via `aria-describedby`. Evidence: `PlaceCombobox disabled={fields.locations.length >= LOCATIONS_MAX}`; `addPlace`; works header.
- `F-PROFILE-15` — A place's status line and the input's emptying happen before its save: `addPlace` sets „Dodano miejsce: {place}” and `choose()` empties the input; if the save is refused (rate limit, network, schema) the chip is rolled back with an error, yet the status line still says "added" and the typed text is gone. A refused duplicate also empties the input (without a status line). A duplicate differing only in Unicode composition (e.g. a decomposed "Łódź") passes the browser's case check and is refused by `locationsSchema`'s refine with the generic `errors.invalid` wording instead of `locations.duplicate`. Evidence: `addPlace`, `PlaceCombobox` `choose`, `saveLocations`; `profile-schemas.ts` NFC comment.
- `F-PROFILE-16` — Place moves are saved once per move with no debounce, unlike works (`moveWork` → `queueOrderSave`, `ORDER_SAVE_AFTER_MS`; the comment above `moveWork` gives the reasons: key repeat, concurrent requests committed in arrival order, the rate limit — 40/min here); requests are not serialized, and a failure restores the list captured when that request started, which can overwrite a later successful move on screen. Evidence: `movePlace` → `saveLocations` (`previous = fields.locations`) vs `moveWork` → `queueOrderSave`.
- `F-PROFILE-17` — A refused or failed place search shows no suggestions and no message; the comment "A refusal (the rate limit, say) keeps the last list rather than leaving the owner with none" is contradicted by `hits = open && found.query === query ? found.places : []`, which hides any answer that is not for the current text. Evidence: `PlaceCombobox` search effect and `hits`.
- `F-PROFILE-18` — Text typed in the place field but not confirmed with Enter or Tab is dropped without a word when focus leaves by pointer or when „Zapisz” is pressed (blur only closes the list; leaving edit mode unmounts the field). Evidence: `PlaceCombobox` `onBlur`; `toggleEditing`. May be deliberate: the hint names Enter/Tab, and Tab-to-add exists for phones (#66).
- `F-PROFILE-19` — A single place chip still gets a grip announced „Przesuń miejsce {place}, 1 z 1” that can never move, whereas works get grips only when there are ≥ 2. Evidence: `owner-profile-view.tsx` passes `grip={placeOrder.handleProps(index)}` unconditionally; `works-gallery.tsx` `reorder && works.length > 1`.
- `F-PROFILE-20` — Duplicate of `F-WORKS-10` (every non-429 refusal of the works order, 401/403/400 included, is worded `Works.card.moveStale`).
- `F-PROFILE-21` — Duplicate of `F-FORM-12` (closing the new-work form returns focus nowhere).
- `F-PROFILE-22` — Duplicate of `F-FORM-14` (switching or closing a work form discards it without asking).
- `F-PROFILE-23` — Duplicate of `F-FORM-7` (dead `Settings.profile.upload.errors.archive_*` copy).
- `F-PROFILE-27` — Leaving edit mode drops keyboard focus to the document: „Zapisz” disables itself (`leaving`) and `toggleEditing` blurs `document.activeElement`, which after a keyboard press — or a click or tap in Chromium — is the toggle itself; nothing restores focus when editing ends or when a failed save keeps editing open. The one exception is `settle()` "kept", which focuses the work form's name field. Evidence: `owner-profile-view.tsx` `toggleEditing` (`setLeaving(true)`, `active.blur()`), the toggle's `disabled={leaving}`.

### C-LEAVE-GUARD — asking before the owner leaves mid-edit

- **Screenshots:** `c-leave-guard--dialog--desktop` (Appendix A)
- **Used by:** V-PROFILE-EDIT only (`useLeaveGuard(editing, () => setEditing(false))` and `<LeaveDialog>` in `OwnerProfileView`).
- **Purpose:** while the owner is in edit mode, no way off the page happens without a question.
- **Source:** `src/app/[locale]/(public)/[handle]/use-leave-guard.ts` — `useLeaveGuard`; `leave-dialog.tsx` — `LeaveDialog` (#83).
- **Armed:** for the whole of edit mode, from the moment „Edytuj profil” is pressed — not only when something is unsaved (D-PROFILE-16). Disarmed when edit mode ends (normal „Zapisz”, or a confirmed leave).

#### Elements

##### `LEAVE-GUARD.browser.prompt` — system dialog (beforeunload)

- **Label:** the browser's own wording (the app cannot set it)
- **Where:** browser chrome
- **Shown:** `owner` `edit` — reload, closing the tab/window, a typed address, a link to another origin or another scheme (e.g. `blob:`), any full unload
- **Enabled:** —
- **Does:** the `beforeunload` listener calls `preventDefault()` and sets `returnValue = true`. Leaving there unloads the page: requests in flight die with it
- **States:** —
- **Input:** browser's own buttons
- **A11y:** browser-native
- **Tests:** leave-guard — dispatches a cancelable `beforeunload` Event and reads `defaultPrevented`: false before editing, true right after „Edytuj profil”, false after „Zapisz”
- **Source:** `use-leave-guard.ts` — `onBeforeUnload`

##### `LEAVE-GUARD.dialog.panel` — alertdialog

- **Label:** title `Settings.profile.leave.title` — pl „Opuścić stronę w trakcie edycji?” · en "Leave the page while editing?"; body `leave.body` — pl „To, co już zapisane, zostaje. Otwarty formularz realizacji i wgrywane pliki przepadną.” · en "What is saved stays. An open work form and the files it is uploading will be lost."
- **Where:** centred panel (max 28 rem) over a dark full-viewport backdrop (above the sticky top bar); buttons right-aligned, „Wyjdź” then „Zostań”, wrapping on narrow screens
- **Shown:** `owner` `edit`, after back/forward leaves the guard's history entry, or after a guarded link click
- **Enabled:** —
- **Does:** holds the navigation until answered
- **States:** open / closed
- **Input:** Escape anywhere (document listener) = Stay; a click on the backdrop outside the panel = Stay
- **A11y:** `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` → `h2` title, `aria-describedby` → body; focus moves to „Zostań” once when it opens (not again on later renders — an upload landing cannot pull focus off „Wyjdź”); no focus trap and no focus return on close (F-PROFILE-24)
- **Tests:** leave-guard, lightbox — `getByRole("alertdialog")` visible / count 0, `toContainText("Opuścić stronę w trakcie edycji?")`
- **Source:** `leave-dialog.tsx` — `LeaveDialog`; `owner-profile-view.tsx` (`open={leaveGuard.pending !== null}`)

##### `LEAVE-GUARD.dialog.stay` — button (primary)

- **Label:** `Settings.profile.leave.stay` — pl „Zostań” · en "Stay"
- **Where:** dialog, right (last)
- **Shown:** with the dialog
- **Enabled:** always
- **Does:** closes the dialog. After back/forward: steps forward onto the guard entry again (the address never changed; no second question). After a link: nothing (the click was cancelled). Edit mode, typed text and an open form remain untouched
- **States:** —
- **Input:** mouse, touch, keyboard; Escape and backdrop click do the same
- **A11y:** receives focus when the dialog opens
- **Tests:** leave-guard — `getByRole("button", { name: "Zostań" })`; then dialog count 0, `getByLabel("Nazwa", { exact: true })` still „W toku”, URL still `/{handle}`; after a refresh mid-edit one „Zostań” is enough (no second dialog after 300 ms)
- **Source:** `use-leave-guard.ts` — `stay`

##### `LEAVE-GUARD.dialog.leave` — button (quiet)

- **Label:** `Settings.profile.leave.leave` — pl „Wyjdź” · en "Leave"
- **Where:** dialog, left of „Zostań”
- **Shown:** with the dialog
- **Enabled:** always
- **Does:** ends edit mode at once WITHOUT the leave sequence (no blur save, no `settle()`, no order flush), then completes the navigation — back/forward: one more `history.back()` to where the owner was heading; link: the guard's entry is popped, then one tick later `router.push(the link's absolute URL)`
- **States:** —
- **Input:** mouse, touch, keyboard
- **A11y:** —
- **Tests:** leave-guard — `getByRole("button", { name: "Wyjdź" })` → `toHaveURL(/\/settings\/account$/)` (both after back and after the account menu's „Konto”)
- **Source:** `use-leave-guard.ts` — the `pending` actions; `owner-profile-view.tsx` `onLeave`

#### Flows and rules

**Arming (edit mode starts):**

- `history.pushState` of a same-URL entry whose state is Next's current state plus `__leaveGuard: true`.
- `beforeunload` listener on `window`; capturing `click` listener on `document`.
- On every render while the page is on that entry, the marker is written back (`replaceState`) if Next rewrote `history.state` (e.g. after `router.refresh()`).
- One `popstate` listener lives for the whole page life (the pop that removes the entry arrives after disarming).

**Which navigations are asked about:**

| Way off the page | Guard | Result |
| --- | --- | --- |
| Reload, close, typed address, other-origin or other-scheme link | `beforeunload` | browser dialog |
| Back (or forward) off the guard entry | `popstate` while armed, not already leaving, and the new entry lacks the marker | our dialog |
| Left-click on an `a[href]` to another path or query on this origin | capturing click: default prevented (React handlers on the link still run, e.g. a menu closing) | our dialog |
| Link with Ctrl/Meta/Shift/Alt, non-primary button, `target="_blank"`, `download` | none | new tab/window or download; page stays |
| Link to the same path and query (hash only; the owner's logo and account menu „Profil” when the address has no query) | none | "nothing to leave" (behaviour of Next on a same-URL link UNVERIFIED) |
| A click already default-prevented by someone else | none | — |
| Code-driven navigation (`router.push`), e.g. account menu „Wyloguj” | none | leaves without asking (F-PROFILE-25) |
| Back from a history entry pushed above the guard entry (the work lightbox, #84) | the landing entry still carries the marker | lightbox closes, no dialog; the next back asks |

**Disarming (edit mode ends normally with „Zapisz”):** listeners removed, any pending question dropped, and — if the page is still on the guard entry — `history.back()` removes it (that pop is ignored). A later back leaves the page as it always did, a reload asks nothing.

**What "leave" does to unsaved data:**

- Already-saved fields, places, order and photos stay (they were saved when left).
- Not done: the guard runs no save of its own and does not settle an open work form. A focused name, headline or bio field is nevertheless saved: a press on a link or on the menu trigger blurs it, and in every case — back/forward included — the dialog's initial focus on „Zostań” does, so its save starts before the answer and is not stopped by „Wyjdź”. Text typed in the place field but not added is lost on „Wyjdź”.
- The open work form unmounts: its photo uploads are aborted, photos uploaded but not saved are discarded (`/api/uploads/discard`), an unsaved R360 set is abandoned (V-WORK-FORM).
- Not stopped: field saves already in flight; avatar/cover uploads (they can still assign the photo); a works order waiting for its 300 ms timer (it is still sent) — F-PROFILE-26.

#### Decisions

- `D-PROFILE-16` — The guard covers the whole of edit mode with three mechanisms: the browser's dialog where ours cannot show (reload, close, typed address), our dialog for back/forward through a same-URL history entry, and our dialog for in-app links through a capturing click listener; the entry is removed when editing ends normally so a later back behaves as before; a history entry pushed above it (the lightbox) pops without a question. Source: #83, #84; `use-leave-guard.ts` header comment; `works-gallery.tsx` lightbox comment.
- `D-PROFILE-17` — „Zostań” is the safe answer: it takes focus when the dialog opens — once, so a re-render cannot steal focus — and answers Escape. Source: `leave-dialog.tsx` comments (#83).
- `D-PROFILE-18` — A confirmed leave ends editing without the save-on-exit pass: what was saved stays; an open work form and its uploads are let go (the form's unmount discards them). Source: `owner-profile-view.tsx` comment (#83).

#### Findings

- `F-PROFILE-24` — The leave dialog has no focus trap (Tab reaches the page behind the backdrop) and does not restore focus when it closes: „Zostań” unmounts the focused button and focus drops to the document, although the dialog declares `aria-modal="true"`. Evidence: `leave-dialog.tsx` (only an initial-focus effect and an Escape listener).
- `F-PROFILE-25` — Duplicate of `F-SHELL-11` (signing out while editing is not asked about).
- `F-PROFILE-26` — The dialog says files being uploaded will be lost, but after „Wyjdź” (an in-app navigation) an avatar/cover upload keeps running and still assigns the photo, and a works order waiting for its timer is still sent: nothing aborts `uploadAborts` or clears `orderTimer` when `OwnerProfileView` unmounts. Evidence: `owner-profile-view.tsx` (no unmount cleanup for either); `Settings.profile.leave.body`. To be confirmed on the app.

## 8. Works

### V-WORKS-LIST — works gallery and the work card

- **Screenshots:** `c-work-card--orbit--desktop`, `c-work-card--two-channel--desktop`, `c-work-card--three-photos--desktop`, `c-work-card--three-photos--phone`, `c-work-card--delete-confirm--desktop` (Appendix A)
- **Route:** none of its own — the works section of `/{handle}` (en `/en/{handle}`), rendered by `src/app/[locale]/(public)/[handle]/page.tsx` (visitor) and `src/app/[locale]/(public)/[handle]/owner-profile-view.tsx` (owner); component `src/app/[locale]/(public)/[handle]/works-gallery.tsx` — `WorksGallery`, `WorkCard`.
- **Reached by:** `signed-out` · `no-handle` · `other` on a profile with ≥ 1 work (`page.tsx` passes only `works`; with 0 works the section is absent — V-PROFILE). `owner` in `view` and `edit` with ≥ 1 work (`OwnerProfileView` passes `owner={{ editing }}`, `order` only in `edit`, `inPlace`, `onEdit`, `onDelete`; with 0 works an empty state instead — V-PROFILE-EDIT).
- **Purpose:** show a profile's works (≤ 10, A12) as cards; anyone enlarges a picture or turns an orbit; the owner edits, deletes and reorders while editing.
- **Arrives from → leaves to:** photo tile or orbit „+” → V-LIGHTBOX (focus returns to that control on close); Edit → the work form in the card's slot (work-form part) → back to the card with focus on its Edit; confirmed delete → the card leaves after `router.refresh()`.
- **Layout (top → bottom):**
  - `ul` grid: 1 column on `phone`, 2 on `desktop` (`sm:grid-cols-2`); cards in one row share its height; order = `works.position` (`lib/works.ts` `listWorks`).
  - An `li` holding the in-place form spans both columns on `desktop`.
  - Card (`article`):
    - Picture strip = the work's picture list cut to 3 (`picturesOf(work).slice(0, 3)`): the orbit first if the work has one, then photos in display order (first = main). 1 picture → one 16:9 tile; 2 → main tile ⅔ wide over two rows (4:3), the second beside it over both rows; 3 → main as for 2, the other two stacked (4:3 each); 0 → placeholder.
    - Body: cue-button row (orbit with cues only) → name (`h3`) → `dl` investor/developer (a row only when set; no `dl` when both empty) → delete error → owner row (owner only, at the card's foot): left grip + R360 badge; right Edit + Delete, or the delete confirmation.
  - Photo tiles: `srcSet` 480w/1600w, `sizes` main `(max-width: 640px) 100vw, 30rem`, others `12rem`, `loading="lazy"`.
- **Server calls:** (made by `owner-profile-view.tsx` through the card's callbacks)
  - `DELETE /api/works/{id}` — „Tak, usuń” — ok → `router.refresh()`; any non-ok (401 `unauthorized`, 403 `forbidden` cross-site, 400, 404 `not_found`, 429 `rate_limited`) or network error → `Works.card.deleteFailed`.
  - `POST /api/works/order` `{ workIds }` (every work, first to last) — 300 ms after the last move — ok → nothing shown; 429 → `Works.card.moveRateLimited`; any other non-ok → `Works.card.moveStale`; network error → `Works.card.moveFailed`; after every failure `router.refresh()`.
  - Orbit frames: plain image GETs from public storage (C-ORBIT).

#### Elements

##### `WORKS-LIST.card.article` — article (state carrier)

- **Label:** the work's name as `h3` (owner's text, wraps long words)
- **Where:** one per work, in list order
- **Shown:** all viewers, `view` and `edit`
- **States:** held (this card's grip is being dragged, `reorder.dragging === index`) → whole card at 60 % opacity; landing (the held card would drop here, `reorder.over === index`, not the held one) → focus-ring shadow round the card; nothing moves until the drop (#173)
- **A11y:** `article`, heading level 3
- **Tests:** `works-order.spec.ts` `locator("article h3")` (order); `r360.spec.ts`, `works.spec.ts` `getByRole("article").filter({ hasText: name })`
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.strip.photo` — button (enlarge a photo)

- **Label:** accessible name `Works.card.enlarge` — pl „Powiększ zdjęcie {index} z {count}: {name}” · en "Enlarge photo {index} of {count}: {name}" ({index} = the photo's number among photos, {count} = number of photos, orbit not counted); with a second channel `, ` + `Works.reveal.badge` — pl „Dwa kanały” · en "Two channels" is appended. Image alt `Works.photoAlt` — pl „{name}, zdjęcie {index}” · en "{name}, photo {index}" (replaced by the button's name for a screen reader)
- **Where:** a strip tile (main or side position)
- **Shown:** all viewers and modes, for each of the first 3 pictures that is a photo
- **Enabled:** always
- **Does:** opens V-LIGHTBOX at this tile's index in the work's picture list (the orbit, when present, is index 0); remembers this button for focus return
- **Input:** click, tap, Enter, Space; zoom-in cursor
- **A11y:** `button` with `aria-label`; inset focus-visible ring
- **Tests:** `lightbox.spec.ts` `getByRole("button", { name: "Powiększ zdjęcie 1 z 1: {WORK}" })`, `getByRole("button", { name: /Dwa kanały/ })`; `happy-path.spec.ts` `getByRole("img", { name: "{WORK_NAME}, zdjęcie 1" })` (decoded `naturalWidth`)
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.strip.two-channel-badge` — status mark

- **Label:** icon `layers` only; native tooltip (`title`) `Works.reveal.badge` — pl „Dwa kanały” · en "Two channels"
- **Where:** top-right corner of a photo tile
- **Shown:** the photo has a second channel (#99)
- **A11y:** `aria-hidden`; the meaning is in the tile button's name
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.strip.orbit` — slider (composite, see C-ORBIT)

- **Label:** viewer `Works.orbit.cardLabel` — pl „Widok 360° realizacji {name}: przeciągnij po obrazie, by go obrócić” · en "360° view of {name}: drag across the picture to turn it"; frame alt `Works.orbit.frameAlt` — pl „{name}, widok 360°” · en "{name}, 360° view"; corner mark `Works.orbit.mark` — pl „360°” · en "360°"
- **Where:** first strip tile; mark top-left; ring over the tile's foot, centred, 38 % of the tile's width (max 10rem), with the frame counter under it
- **Shown:** all viewers and modes when the work has an orbit; ring hidden on `phone:`
- **Does:** C-ORBIT at 800 px; the frames start loading once the tile is at least half in view AND the page's `load` has fired; the tile's orbit hand is shared with this card's cue buttons
- **Input:** see `ORBIT.viewer.picture`, `ORBIT.ring.band`; a tap on the picture does not open the lightbox
- **A11y:** see C-ORBIT; the mark is `aria-hidden`; the tile clips a cue label to itself (`data-orbit-bounds`)
- **Tests:** `r360.spec.ts` `getByTestId("orbit-viewer")`, `getByText("360°", { exact: true })`; `works.spec.ts` owner's card `card.getByTestId("orbit-viewer").locator("img")` src `/(^|\/)800\/003\.webp$/`
- **Source:** `works-gallery.tsx` — `OrbitTile`, `PublicOrbit`, `useInView`, `usePageLoaded`

##### `WORKS-LIST.strip.orbit-enlarge` — button

- **Label:** `Works.orbit.enlarge` — pl „Powiększ widok 360°: {name}” · en "Enlarge the 360° view: {name}" (`aria-label` and `title`); icon plus
- **Where:** bottom-right corner of the orbit tile (36 px)
- **Shown:** all viewers and modes, work has an orbit
- **Enabled:** always
- **Does:** opens V-LIGHTBOX at index 0 (the orbit); remembers this button for focus return
- **Input:** click, tap, Enter, Space
- **A11y:** `button`; focus-visible ring
- **Tests:** `r360.spec.ts` `getByRole("button", { name: "Powiększ widok 360°: Dom na skarpie" })` (`click()`, and `tap()` on iPhone 13)
- **Source:** `works-gallery.tsx` — `OrbitTile`

##### `WORKS-LIST.strip.no-picture` — placeholder

- **Label:** `Works.card.orbit` — pl „Widok 360°” · en "360° view"
- **Where:** the whole strip (16:9)
- **Shown:** the card has 0 pictures: no photos and no orbit (see F-WORKS-11)
- **Tests:** `data-testid="work-card-no-photo"` — used by no test
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.body.cues` — list of buttons (see `ORBIT.cues.list`)

- **Label:** `Works.orbit.cues` — pl „Punkty widoku 360°: {name}” · en "Points of the 360° view: {name}"
- **Where:** first in the card body, under the strip, above the name
- **Shown:** all viewers, modes and screens when the orbit has ≥ 1 cue (on `phone:` the only way to a cue)
- **Does:** see `ORBIT.cues.button`; turns the tile's orbit; shares the pointed-at cue with the tile's ring
- **Tests:** `r360.spec.ts` `card.getByRole("list", { name: "Punkty widoku 360°: Dom na skarpie" })`
- **Source:** `works-gallery.tsx` — `WorkCard`, `useCueHand`; `orbit-cues.tsx` — `OrbitCueButtons`

##### `WORKS-LIST.owner.r360-badge` — status badge

- **Label:** orbit present → `Works.card.r360Ready` — pl „R360 gotowy” · en "R360 ready" (success tone); none → `Works.card.r360None` — pl „Bez R360” · en "No R360" (neutral)
- **Where:** owner row, left, after the grip
- **Shown:** `owner`, `view` and `edit`; never to a visitor
- **Tests:** none (see F-WORKS-2)
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.owner.grip` — button (reorder handle)

- **Label:** `Works.card.move` — pl „Przesuń realizację {name}, {position} z {count}” · en "Move {name}, {position} of {count}" ({position} = current place, 1-based; `aria-label` and `title`); description `Works.card.moveHint` — pl „Strzałkami przesuniesz w przód i w tył listy.” · en "Use the arrow keys to move it forward and back." (sr-only paragraph in the owner view)
- **Where:** owner row, first on the left (32 px, icon grip-vertical)
- **Shown:** `owner` + `edit`, the list has > 1 work, and no work's form stands in the list (`inPlace` unset); an open new-work form above the list does not hide it
- **Enabled:** always when shown
- **Does:** moves the work; the owner view reorders the list on screen at once, announces the move and posts the whole order 300 ms after the last move
- **States:** after a move → status `Works.card.moved` (see `WORKS-LIST.order.notice`); save failures → `WORKS-LIST.order.error`
- **Input:**
  - Pointer (mouse primary button; any touch or pen contact): the press starts the drag at once, no distance threshold; every card's box is measured once, at the press; the pointer is captured by the grip; while moving, the landing place = the card whose box contains the pointer, else the card whose centre is nearest (a tie → the earlier card); release → move when landing ≠ start; `pointercancel` or lost capture → no move; a second pointer on any grip during a drag is ignored; `touch-action: none` (a touch on the grip never scrolls); other mouse buttons ignored
  - Keyboard (grip focused): ArrowLeft or ArrowUp → one place earlier; ArrowRight or ArrowDown → one place later; at the first/last place the key does nothing and is not consumed; Enter and Space do nothing; after a move focus is put back on the moved work's grip at its new place
- **A11y:** `button`, `aria-label` with position, `aria-describedby` → the hint; announcement through a `role="status"` region
- **Tests:** `works-order.spec.ts` — `getByRole("button", { name: /^Przesuń realizację/ })` count 0 in `view` and for a visitor, 3 in `edit`; `getByRole("button", { name: "Przesuń realizację {THIRD}" })` focus + ArrowUp ×2, `waitForResponse` `/api/works/order` 200; mouse drag from the grip's centre to the first `article`'s centre in 8 steps; order kept after reload
- **Source:** `works-gallery.tsx` — `WorksGallery`, `WorkCard`; `use-reorder.ts` — `useReorder`; `lib/reorder.ts` — `indexAtPoint`, `moveItem`; `owner-profile-view.tsx` — `moveWork`, `queueOrderSave`, `saveWorkOrder`, `ORDER_SAVE_AFTER_MS`

##### `WORKS-LIST.owner.edit` — button

- **Label:** visible `Works.card.edit` — pl „Edytuj” · en "Edit"; accessible `{Works.card.edit}: {name}` — pl „Edytuj: {name}” · en "Edit: {name}"
- **Where:** owner row, right, before Delete
- **Shown:** `owner` + `edit`, while the delete confirmation is not open
- **Enabled:** always
- **Does:** `onEdit(work)` → the owner view shows this work's form in this card's slot; any other open work form (new or another work's) is replaced without asking (F-WORKS-7); on the form's cancel or save the card returns and focus goes, on the next animation frame, to `[data-work-edit="{work id}"]` = this button
- **A11y:** `data-work-edit={work.id}` is the focus-return hook
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Edytuj: {name}" })`, `toBeFocused()` after „Anuluj”; `card.getByRole("button", { name: "Edytuj" })`
- **Source:** `works-gallery.tsx` — `WorkCard`; `owner-profile-view.tsx` — `onEdit`, `closeInPlaceForm`

##### `WORKS-LIST.owner.delete` — button

- **Label:** visible `Works.card.delete` — pl „Usuń” · en "Delete"; accessible pl „Usuń: {name}” · en "Delete: {name}"; danger colour
- **Where:** owner row, right, after Edit
- **Shown:** `owner` + `edit`, confirmation not open
- **Enabled:** always
- **Does:** no server call; replaces Edit/Delete with the confirmation; focus moves to „Tak, usuń”
- **Tests:** none
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.owner.confirm-yes` — button (with the question)

- **Label:** question (plain text before the buttons) `Works.card.confirmDelete` — pl „Usunąć razem ze zdjęciami?” · en "Delete it with its photos?"; button `Works.card.confirmYes` — pl „Tak, usuń” · en "Yes, delete"; busy `Works.card.deleting` — pl „Usuwanie…” · en "Deleting…"; danger colour
- **Where:** owner row, right, in place of Edit/Delete
- **Shown:** `owner` + `edit`, after Delete, until „Nie”, a failure, or the card disappears
- **Enabled:** disabled while deleting
- **Does:** clears the previous error, sets busy, `onDelete(work)` → `DELETE /api/works/{id}`; ok → `router.refresh()` and the card stays busy until the refreshed list drops it; non-ok or network error → busy off, confirmation closed, `WORKS-LIST.body.delete-error` shown
- **States:** idle „Tak, usuń” · busy „Usuwanie…” (both buttons disabled) · success (card gone) · error (see delete-error)
- **A11y:** focused when the confirmation opens; the question is not linked to the button; after a failure focus is not placed anywhere (F-WORKS-4)
- **Tests:** none
- **Source:** `works-gallery.tsx` — `WorkCard`; `owner-profile-view.tsx` — `onDelete`

##### `WORKS-LIST.owner.confirm-no` — button

- **Label:** `Works.card.confirmNo` — pl „Nie” · en "No"
- **Where:** after „Tak, usuń”
- **Shown:** with the confirmation
- **Enabled:** disabled while deleting
- **Does:** closes the confirmation, no call; Edit/Delete come back; focus is not placed anywhere (F-WORKS-4)
- **Tests:** none
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.body.delete-error` — alert

- **Label:** `Works.card.deleteFailed` — pl „Nie udało się usunąć. Spróbuj ponownie.” · en "Deleting failed. Try again."
- **Where:** card body, above the owner row
- **Shown:** after a failed delete; stays — also after `edit` ends — until the next „Tak, usuń” (F-WORKS-5)
- **A11y:** `role="alert"`
- **Tests:** none
- **Source:** `works-gallery.tsx` — `WorkCard`

##### `WORKS-LIST.list.form-slot` — list item holding the work form

- **Where:** the edited work's own place in the grid; both columns on `desktop`
- **Shown:** `owner` + `edit` while a work's edit form is open
- **Does:** renders the form (work-form part) instead of the card; the other cards stay; every grip is hidden meanwhile
- **Tests:** `works.spec.ts` `locator("section", { has: getByRole("heading", { name: "Realizacje" }) }).locator("ul > li")` count stays 2; `items.nth(1).getByRole("heading", { name: "Edytuj realizację" })`; no „Nowa realizacja” heading
- **Source:** `works-gallery.tsx` — `WorksGallery` (`inPlace`)

##### `WORKS-LIST.order.notice` — status line (screen reader only)

- **Label:** `Works.card.moved` — pl „Realizacja {name} jest teraz na pozycji {position}” · en "{name} is now number {position}"
- **Where:** after the list (sr-only)
- **Shown:** `owner`; text set on every move (pointer or keyboard); present in `view` too (last text kept)
- **A11y:** `role="status"`
- **Tests:** `works-order.spec.ts` `getByText("Realizacja {THIRD} jest teraz na pozycji 2")`
- **Source:** `owner-profile-view.tsx` — `worksNotice`, `moveWork`

##### `WORKS-LIST.order.error` — alert

- **Label:** 429 → `Works.card.moveRateLimited` — pl „Za dużo zmian kolejności naraz. Odczekaj chwilę.” · en "Too many changes at once. Wait a moment."; other non-ok → `Works.card.moveStale` — pl „Lista realizacji zmieniła się gdzie indziej. Odświeżamy ją — ustaw kolejność jeszcze raz.” · en "The list of works changed elsewhere. Reloading it — set the order again."; network error → `Works.card.moveFailed` — pl „Nie udało się zapisać kolejności. Spróbuj jeszcze raz.” · en "The order could not be saved. Try again."
- **Where:** under the list
- **Shown:** `owner` + `edit`, after a failed order save; cleared by the next move or by switching editing on again (`clearErrors`)
- **Does:** the list is re-read from the server at the same time (`router.refresh()`)
- **A11y:** `role="alert"`
- **Tests:** none
- **Source:** `owner-profile-view.tsx` — `saveWorkOrder`, `worksOrderError`

#### Flows and rules

- Per context: visitor → strip, cue buttons, name, parties, lightbox; `owner` `view` → the same + R360 badge; `owner` `edit` → + grip (> 1 work, no form in the list), Edit, Delete, confirmation, errors.
- Card identity: `WorkCard` is keyed by the orbit's set id (`"no-orbit"` without one). A new set remounts the card: its orbit starts again at the start frame, the delete confirmation and error reset. New parameters on the same set do not move the card's orbit (the hand takes the start frame once).
- Reorder: a move reorders the list on screen immediately, announces `card.moved`, clears the order error and restarts a 300 ms timer; when it fires the newest full order is posted; while an order is unsaved, refreshed props do not re-seed the list; on failure the error shows and the server's list comes back (nothing restored from a snapshot); leaving `edit` sends a waiting order at once and awaits it, but stays in edit mode only if an order request that was already in flight before „Zapisz” fails — the one it sends itself is not checked (F-PROFILE-8).
- One form at a time: Edit on another card, or the add button, replaces the open form (its unsaved uploads are discarded by its unmount); cancel/save returns the card and focuses its Edit.
- Delete: Delete → confirmation (focus on „Tak, usuń”) → call; busy disables both buttons; success keeps the card busy until the refreshed list drops it; failure closes the confirmation and shows the error.
- Lightbox entry points: a photo tile opens at its own index; the orbit's „+” at index 0; photos past the strip's three (orbit + 3 photos) are reached only by stepping in the lightbox.

#### Decisions

- `D-WORKS-1` — The strip holds at most 3 pictures, the orbit first (its start frame is the work's main picture), then the photos numbered among themselves; an orbit plus 3 photos leaves the third photo to the lightbox, "one arrow away". Source: A12; `works-gallery.tsx` `picturesOf` comment (#104) and `WorkCard` comment ("would break its two-row grid", #104 review).
- `D-WORKS-2` — On an orbit tile the picture is the drag control, so the lightbox opens from a separate „+” button. Source: `works-gallery.tsx` `OrbitTile` comment.
- `D-WORKS-3` — One component for visitor and owner; the owner's page adds the R360 badge and the edit/delete row through props; a visitor never sees the R360 state. Source: `works-gallery.tsx` header comment (#72); `page.tsx` comment ("never the R360 state").
- `D-WORKS-4` — Editing a work shows its form in its card's slot while the other cards stay ("three cards for two works was the wrong picture"), and nothing can be reordered while that form stands in the list (the form's row is not a measured box, so a drag would answer the wrong index). Source: `WorksGallery` `inPlace` doc and reorder comment (#86, #66).
- `D-WORKS-5` — Reordering: grips only while editing and only with more than one work; pointer events, not HTML5 drag-and-drop (`dragstart` never fires on touch); arrows move one place with no grab mode to enter or leave; focus stays on the moved work's grip; the keys are said out loud in a hint every grip names, because a button's own keys (Enter, Space) move nothing. Source: `use-reorder.ts` comments; `WorkCard` grip comment; `owner-profile-view.tsx` hint comment (#66).
- `D-WORKS-6` — The whole order is sent once moving stops, not per move (an arrow repeats about 25 times a second); the server refuses an order about any other list; a refused save is not reverted from a snapshot, the server's list is the way back. Source: `owner-profile-view.tsx` `moveWork` / `saveWorkOrder` comments (#66).
- `D-WORKS-7` — Cancel or save of an in-place form gives focus back to the „Edytuj” that opened it. Source: `owner-profile-view.tsx` `closeInPlaceForm` comment (#86 review).

#### Findings

- `F-WORKS-1` — Fixed with this document: SPEC.md §9 said "Order on the page = `created_at`" while `lib/works.ts` `listWorks` has ordered by `works.position` (then `created_at`, `id`) since #66; §9 now says `position`. Kept so the ID stays stable.
- `F-WORKS-2` — The test that a visitor sees no R360 state checks copy that no longer exists, so a leaked badge would pass. Evidence: `e2e/db/r360.spec.ts` (poster test) asserts `getByText("R360 wgrany")` count 0; that string left `messages/pl.json` in 8c87bfe (#118); today's badge reads „R360 gotowy” / „Bez R360”.
- `F-WORKS-3` — A failed delete shows one message for every cause. Evidence: `owner-profile-view.tsx` `onDelete` returns false for any non-ok or network error; `api/works/[id]/route.ts` answers 401, 403, 400, 404 `not_found` (already deleted elsewhere — retrying fails until a reload), 429 (30/min, one bucket with POST and PATCH); all read „Nie udało się usunąć. Spróbuj ponownie.”, while the order save on the same page tells 429 apart (`saveWorkOrder`).
- `F-WORKS-4` — The delete confirmation drops the keyboard and says too little. Evidence: `WorkCard` — after „Nie” (`setConfirming(false)`) or a failed delete the focused button unmounts and focus is not moved (not back to „Usuń”); the question „Usunąć razem ze zdjęciami?” is plain text not linked to „Tak, usuń” (no `aria-describedby`); neither confirm button carries the work's name, unlike „Usuń: {name}”.
- `F-WORKS-5` — The delete error outlives editing. Evidence: `WorkCard` renders the `deleteFailed` alert outside the `owner.editing` block and clears it only on the next „Tak, usuń”, so it stays on the card in `view` with nothing to act on. May be deliberate (no reason stated either way).
- `F-WORKS-6` — The confirmation names only the photos, but a work with an R360 loses its frame set too. Evidence: `Works.card.confirmDelete` „razem ze zdjęciami” / "with its photos"; SPEC.md §9 "a work's set is deleted by prefix".
- `F-WORKS-7` — Duplicate of `F-FORM-14` (another work's „Edytuj” discards an open form without asking).
- `F-WORKS-8` — A pointer drag cannot reach a place off screen. Evidence: `use-reorder.ts` `onPointerDown` measures the boxes once and nothing scrolls during the drag (grip `touch-action: none`, no edge auto-scroll); a wheel scroll during a mouse drag leaves the boxes stale; `works-order.spec.ts` comment "Both ends of the drag have to be on screen at the same time". The arrow keys reach every place.
- `F-WORKS-9` — Dragging does not look like dragging (#173, open). Evidence: `WorkCard` `held` → `opacity-60`, `landing` → ring; nothing moves until the drop; a keyboard move re-renders the list with no motion.
- `F-WORKS-10` — Order-save failures are mislabelled. Evidence: `owner-profile-view.tsx` `saveWorkOrder` shows `card.moveStale` ("the list of works changed elsewhere") for every non-ok answer except 429 — including 401, 403 and 400 `invalid_request` (`api/works/order/route.ts`); a 429 also re-reads the list, throwing the unsaved order away, though its copy says only „Odczekaj chwilę”.
- `F-WORKS-11` — The picture-less placeholder is reachable only with data A12 forbids, and it is labelled as an orbit. Evidence: `WorkCard` `count === 0` needs no photos and `orbit === null`; `lib/works.ts` `listWorks` makes `orbit` null when `r360_set_id` or `r360_params` is missing; A12 allows 0 photos only with an R360; the copy is `Works.card.orbit` „Widok 360°” with nothing to turn; `work-card-no-photo` is used by no test.
- `F-WORKS-12` — Card and lightbox count pictures differently. Evidence: `WorkCard` `card.enlarge` gets {count} = `work.images.length` (photos only) while `LightboxOverlay` counts every picture incl. the orbit — „Powiększ zdjęcie 1 z 2” opens at „2 / 3”. May be deliberate: photos are "numbered from one among themselves" (`picturesOf` comment).
- `F-WORKS-13` — Accessible names are assembled with literal punctuation in the component (A8: no strings in components), so order and punctuation cannot differ per language. Evidence: `WorkCard` `` `${t("card.edit")}: ${work.name}` ``, `` `${t("card.delete")}: ${work.name}` ``, and `, ${t("reveal.badge")}` appended to `card.enlarge`.

### V-LIGHTBOX — enlarged picture overlay

- **Screenshots:** `v-lightbox--orbit--desktop`, `v-lightbox--orbit--phone`, `v-lightbox--orbit--phone-landscape`, `v-lightbox--photo--desktop`, `v-lightbox--photo--phone`, `v-lightbox--three-photos--desktop`, `v-lightbox--three-photos--desktop--next`, `v-lightbox--three-photos--phone` (Appendix A)
- **Route:** none — an overlay on `/{handle}` (en `/en/{handle}`); no URL change, one history entry of its own; `src/app/[locale]/(public)/[handle]/works-gallery.tsx` — `LightboxOverlay` (state and history in `WorksGallery`).
- **Reached by:** every viewer and mode that sees V-WORKS-LIST (also `owner` in `edit`, incl. while a work form is open).
- **Purpose:** show one work's pictures at their largest, one at a time — the orbit to turn, photos, two-channel photos to compare.
- **Arrives from → leaves to:** `WORKS-LIST.strip.photo` (its index) or `WORKS-LIST.strip.orbit-enlarge` (index 0) → back to the profile page, focus on the control that opened it.
- **Layout (top → bottom):**
  - Full-screen dark ground (fixed, above the page, scrolls vertically when its content is taller than the screen, content centred with safe centring).
  - Close button top-right; previous / next buttons at the left and right edges, vertically centred (only with > 1 picture).
  - Stage: the picture — plain photo, two-channel reveal (C-REVEAL), or orbit (C-ORBIT: viewer → ring below it → cue buttons).
  - Caption: work name · counter · keyboard hint (hint from `desktop` up).
- **Server calls:** none (images from storage).

#### Elements

##### `LIGHTBOX.overlay.dialog` — dialog

- **Label:** `Works.lightbox.label` — pl „Podgląd zdjęcia” · en "Photo preview" (same for an orbit)
- **Where:** covers the viewport
- **Shown:** after a photo tile or orbit „+” press; until closed
- **Does:** shows `picturesOf(work)[index]` — every picture of the work (not only the card's three), the orbit first; a click on the dark ground itself (not on the picture, buttons or caption) closes
- **States:** one picture at a time; stepping replaces the stage (an orbit remounts at its start frame; a reveal remounts at 50 %, along)
- **Input:**
  - Escape → close (from anywhere inside, a focused slider included)
  - ArrowLeft / ArrowRight → previous / next with wrap-around, only with > 1 picture and only when focus is not inside a `[role=slider]` (the orbit viewer or the reveal handle keep their arrows)
  - Tab / Shift+Tab → cycle through the overlay's buttons and sliders only; from the last to the first and back; a focus outside the overlay is pulled in
  - No swipe, no pinch handling of its own: on a phone a horizontal swipe turns an orbit and does nothing on a plain photo; any touch on a two-channel picture moves the divide to the finger (`touch-action: none` there — no scroll or pinch on it); vertical swipes on an orbit or a plain photo scroll the overlay when it overflows
  - Browser Back (phone back gesture) → close (see Flows)
- **A11y:** `role="dialog"`, `aria-modal="true"`, `aria-label`; focus → Close on opening; body scroll locked (`document.body.style.overflow = "hidden"`, restored on close); not rendered in a portal, page behind not `inert` (F-WORKS-17)
- **Tests:** `lightbox.spec.ts` `getByRole("dialog")` visible / count 0; `page.goBack()`, `page.goForward()`, `window.history.length`; `keyboard.press("Escape")`; owner: `getByRole("alertdialog")` count 0 after the first Back, visible after the second, „Zostań”; `r360.spec.ts` Escape closes the orbit dialog
- **Source:** `works-gallery.tsx` — `LightboxOverlay`, `WorksGallery` (`openLightbox`, `closeLightbox`, popstate effect, `LIGHTBOX`)

##### `LIGHTBOX.controls.close` — button

- **Label:** `Works.lightbox.close` — pl „Zamknij podgląd” · en "Close the preview" (`aria-label`); icon x
- **Where:** top-right corner (44 px)
- **Shown:** always while open
- **Enabled:** always
- **Does:** focus → the control that opened the lightbox; overlay closed; if the lightbox's history entry is current, `history.back()` pops it
- **Input:** click, tap, Enter, Space
- **A11y:** receives focus once on opening, and again when a step removes the focused control
- **Tests:** `lightbox.spec.ts` `getByRole("button", { name: "Zamknij podgląd" })`
- **Source:** `works-gallery.tsx` — `LightboxOverlay`, `closeLightbox`

##### `LIGHTBOX.controls.prev` — button

- **Label:** `Works.lightbox.prev` — pl „Poprzednie zdjęcie” · en "Previous photo" (also when the previous picture is the orbit); icon chevron-left
- **Where:** left edge, vertical centre (44 px)
- **Shown:** > 1 picture
- **Enabled:** always (wraps from the first to the last)
- **Does:** index − 1; no history entry
- **Input:** click, tap, Enter, Space; keyboard ArrowLeft does the same (see dialog)
- **A11y:** focus stays on it after a step
- **Tests:** none
- **Source:** `works-gallery.tsx` — `LightboxOverlay`

##### `LIGHTBOX.controls.next` — button

- **Label:** `Works.lightbox.next` — pl „Następne zdjęcie” · en "Next photo"; icon chevron-right
- **Where:** right edge, vertical centre (44 px)
- **Shown:** > 1 picture
- **Enabled:** always (wraps from the last to the first)
- **Does:** index + 1; no history entry
- **Input:** click, tap, Enter, Space; ArrowRight
- **Tests:** none
- **Source:** `works-gallery.tsx` — `LightboxOverlay`

##### `LIGHTBOX.stage.photo` — image

- **Label:** alt `Works.photoAlt` — pl „{name}, zdjęcie {index}” · en "{name}, photo {index}"
- **Where:** stage centre; at most viewport height − 140 px and min(96vw, 1600 px) wide, whole picture visible
- **Shown:** current picture is a photo without a second channel
- **Does:** the 1600 px variant on every screen (never the original)
- **Tests:** none specific
- **Source:** `works-gallery.tsx` — `LightboxOverlay`

##### `LIGHTBOX.stage.reveal` — slider (composite, see C-REVEAL)

- **Label:** `Works.reveal.label` — pl „Porównanie kanałów: {name}, zdjęcie {index}” · en "Channel comparison: {name}, photo {index}"
- **Where:** stage centre; picture at most viewport height − 180 px, min(96vw, 1600 px) wide; hint and axis button under it
- **Shown:** current picture is a photo with a second channel
- **Does:** C-REVEAL with both channels at 1600 px; remounted for every photo (position 50, along)
- **Tests:** `lightbox.spec.ts` (see C-REVEAL)
- **Source:** `works-gallery.tsx` — `LightboxOverlay`; `channel-reveal.tsx`

##### `LIGHTBOX.stage.orbit` — slider (composite, see C-ORBIT)

- **Label:** viewer `Works.orbit.lightboxLabel` — pl „Widok 360° realizacji {name} w powiększeniu: przeciągnij po obrazie, by go obrócić” · en "360° view of {name}, enlarged: drag across the picture to turn it"; frame alt `Works.orbit.frameAlt`; cue row `Works.orbit.cues`
- **Where:** stage: viewer min(96vw, 1600 px) wide; ring under it (10rem, no frame counter); cue buttons under the ring, centred, dark tone, at most min(96vw, 48rem) wide
- **Shown:** current picture is the orbit; ring hidden on `phone:`
- **Does:** its own orbit hand, starting at the start frame (not the card's frame, F-WORKS-15); frames at 1600 px when `window.innerWidth > 900` at opening, else 800 px (not re-read on resize); painted at once from the 800 px start frame the card already fetched; frames load immediately; closing or stepping away cancels frames in flight
- **States:** viewer height cap — with cues: `max(10rem, 100vh − 140px − 17rem)`, on `phone:` `max(10rem, 100vh − 140px − 5rem)`; without cues: `max(10rem, 100vh − 140px − 12rem)`, on `phone:` `max(10rem, 100vh − 140px)`; where that leaves less than 10rem the overlay scrolls instead
- **Input:** see C-ORBIT; its arrows turn it while it has focus
- **Tests:** `r360.spec.ts` `dialog.getByTestId("orbit-viewer")` `data-frame="3"`, `dialog.getByText("1 / 1")`, focus + ArrowRight → 4, `dialog.getByRole("list", { name: "Punkty widoku 360°: Dom na skarpie" }).getByRole("button", { name: "Wejście główne" })` → 1, axe `public-r360-lightbox`; iPhone 13: `dialog.getByTestId("orbit-ring")` hidden, `getByRole("button", { name: "Taras" }).tap()` → 4, axe `public-r360-phone`
- **Source:** `works-gallery.tsx` — `OrbitFull`, `PublicOrbit`

##### `LIGHTBOX.caption.counter` — status text (with the work name)

- **Label:** work name (owner's text), then `Works.lightbox.counter` — pl „{index} / {count}” · en "{index} / {count}" ({index} 1-based, {count} = all pictures incl. the orbit)
- **Where:** under the picture
- **Shown:** always, also for 1 / 1
- **A11y:** plain text, not a live region
- **Tests:** `r360.spec.ts` `dialog.getByText("1 / 1")`
- **Source:** `works-gallery.tsx` — `LightboxOverlay`

##### `LIGHTBOX.caption.hint` — text

- **Label:** `Works.lightbox.hint` — pl „Esc zamyka, strzałki przewijają” · en "Esc closes, arrows move"
- **Where:** end of the caption line
- **Shown:** `desktop` only (hidden below 40rem width; also shown for a single picture)
- **Source:** `works-gallery.tsx` — `LightboxOverlay`

#### Flows and rules

- History (#84), marker key `__lightbox` merged into the current `history.state` (the editing guard's own marker rides along):
  1. Page mount: "on the lightbox's entry" = the current state carries the marker.
  2. Open: if not on the entry, `history.pushState` a copy of the state plus the marker, same URL (one entry per opening, never two).
  3. Step (buttons or arrows): no history change.
  4. Close by Close, Escape or the dark ground: focus to the opener, overlay closed, `history.back()` when on the entry; the resulting popstate does nothing more.
  5. Back while open: popstate onto an entry without the marker → focus to the opener, overlay closed, no extra back.
  6. Forward onto the marked entry: overlay stays closed; the next opening reuses the entry.
  7. Reload while on the marked entry: the page comes back with the overlay closed and the entry still current; the next opening reuses it; closing then pops to the same-URL entry below. UNVERIFIED: what the first Back visibly does if the picture is not reopened. If the owner then switches editing on, the guard's entry inherits the lightbox marker: the next picture reuses it, and closing that picture or Back pops the guard entry — the leave dialog opens (after Back, over the still-open picture). UNVERIFIED on the app.
  8. Owner in `edit` (#83): Back that closes the picture does not open the leave dialog; the next Back does.
- Focus: on opening → Close (once); on a step, if focus is no longer inside the overlay (the focused control went with the previous picture, e.g. a cue button) → Close; on any close → the photo tile or „+” that opened it; Tab trapped inside.
- Scroll lock: body overflow hidden while open, the previous inline value restored on close.
- Two-channel photo inside: arrows belong to the focused reveal handle; the handle is focused by any press on the picture; Escape still closes (C-REVEAL).
- Orbit inside: drag, ring, cue buttons and keys as in C-ORBIT; the lightbox arrows step pictures only while focus is outside the viewer.
- Reduced motion: the overlay has no open, close or step animation in any mode; inside, an orbit's travel jumps and a throw does not coast (C-ORBIT).
- Phone: same buttons (44 px) and counter; hint hidden; ring hidden (`phone:`); orbit frames at 800 px when the window was ≤ 900 px wide at opening.

#### Decisions

- `D-WORKS-8` — Back closes the picture (on a phone it used to leave the site): opening pushes one marked entry, Back pops it and closes, closing by button or Escape pops it itself so the next Back goes where it always went, stepping adds nothing, a reload or a forward onto the entry makes the next opening reuse it, and the editing guard ignores this pop — except after a reload on the entry (V-LIGHTBOX step 7). Source: `WorksGallery` comments (#84, #84 review, #83); `e2e/db/lightbox.spec.ts`.
- `D-WORKS-9` — Focus goes to Close once on opening, not on every step (or the arrows would lose focus the moment they are used); Tab cycles inside so "Zapisz" or another card's button cannot move history under the picture; a step that takes the focused control away returns focus to Close, not to the page. Source: `LightboxOverlay` comments (#84 review, #107 review).
- `D-WORKS-10` — A photo is shown at the 1600 px variant, never the original (G3); the orbit uses its 1600 px set on a wide screen and the 800 px set on a phone, painting the card's cached 800 px start frame at once. Source: `LightboxOverlay` and `OrbitFull` comments (#104 review).
- `D-WORKS-11` — A focused slider owns the arrow keys; Escape still closes. Source: `LightboxOverlay` comment ("The reveal slider (#100) has the arrows while it holds the focus").
- `D-WORKS-12` — The overlay scrolls when what it holds is taller than the screen (an orbit with a dozen cue buttons on a short one) and keeps the top reachable; the enlarged orbit never shrinks below 10rem; its ring shows no frame counter because the caption's counter is right under it. Source: `LightboxOverlay`, `OrbitFull`, `PublicOrbit` comments (#107 review, #106 review).

#### Findings

- `F-WORKS-14` — The lightbox calls every picture a photo. Evidence: `WorksGallery` passes `lightbox.label` „Podgląd zdjęcia” for every picture; `LightboxOverlay` prev/next „Poprzednie zdjęcie” / „Następne zdjęcie” also when the current or adjacent picture is the orbit.
- `F-WORKS-15` — The enlarged orbit does not continue from the card. Evidence: `OrbitFull` creates its own `useOrbit(orbit.params)`, so it opens at the start frame whatever frame the card was turned to, a turn there is not carried back to the card (`WorkCard` `hand`), and stepping away and back resets it. May be deliberate: its poster is the card's cached 800 px start frame (`OrbitFull` comment).
- `F-WORKS-16` — "Phone" is decided three ways in one overlay. Evidence: the hint is hidden by width only (`hidden sm:inline`); the ring by the `phone:` variant (also coarse pointer + height < 32rem, `PublicOrbit`); the orbit's frame width by `window.innerWidth > 900` read once (`OrbitFull`); a phone held sideways ≥ 40rem wide shows „Esc zamyka, strzałki przewijają” but no ring; the reveal's own hint „…albo użyj strzałek” shows on every phone (`ChannelReveal`).
- `F-WORKS-17` — Modality rests on `aria-modal` and the Tab trap only. Evidence: `WorksGallery` renders `LightboxOverlay` in place (no portal) and nothing sets `inert` or `aria-hidden` on the page behind, so a screen reader's reading cursor may still reach it. UNVERIFIED impact per screen reader.

### C-ORBIT — the R360 viewer (viewer, ring, cue buttons)

- **Screenshots:** `c-work-card--orbit--desktop`, `v-lightbox--orbit--desktop`, `v-lightbox--orbit--phone`, `v-lightbox--orbit--phone-landscape` (Appendix A)
- **Used in:** `WORKS-LIST.strip.orbit` (800 px, ring over the picture's foot with a counter, hidden on `phone:`); `LIGHTBOX.stage.orbit` (1600/800 px, ring under the picture without counter, hidden on `phone:`, dark cue buttons); the owner's work form preview (work-form part: its own hand, ring `tone="light"`, kept on `phone:`, poster `eager`, own labels).
- **Purpose:** let anyone turn a work's orbit one frame at a time (A13).
- **Parts:** `src/components/ui/orbit-viewer.tsx` — `OrbitViewer`; `orbit-ring.tsx` — `OrbitRing`; `orbit-cues.tsx` — `OrbitCueButtons`; hand `use-orbit.ts` — `useOrbit`; loader `use-frame-loader.ts` — `useFrameLoader`; rules `src/lib/r360/orbit.ts`, `ring.ts`, `cues.ts`, `frame-loading.ts`. Element IDs below use `ORBIT.`.
- **Data:** `R360Params` (`frame-set-shared.ts`): `frameCount` 2–360 · `direction` +1/−1 (+1: a drag to the right moves up the numbers) · `framesPerWidth` 1–N (frames a drag across the whole picture turns) · `startFrame` 1–N · `flattening` 0.15–1 (1 = circle) · `cues` ≤ 12 `{ frame, label }`, one per frame, label 1–40 characters. Frame address `{frameBase}{800|1600}/{NNN}.webp`.
- **Server calls:** none to the app; image GETs of frames from public storage.

#### Elements

##### `ORBIT.viewer.picture` — slider (the picture)

- **Label:** `aria-label` from the caller (`Works.orbit.cardLabel`, `Works.orbit.lightboxLabel`; owner form `Works.form.r360.previewLabel`); `aria-valuetext` `Works.orbit.frameOf` — pl „Klatka {frame} z {total}” · en "Frame {frame} of {total}"; when the frame painted is not the one asked for (still loading): `Works.orbit.frameOfShowing` — pl „Klatka {frame} z {total}, w trakcie wczytywania pokazana klatka {shown}” · en "Frame {frame} of {total}, showing frame {shown} while it loads"
- **Where:** the picture area itself
- **Shown:** wherever C-ORBIT is used; all viewers, modes, screens
- **Enabled:** always
- **Does:** shows one frame (1..N, starts at the start frame); drag and keys change it
- **States:** poster image → painted canvas → (owner form only) loading text; cursor grab, grabbing while dragged
- **Input:**
  - Drag: mouse primary button only; any touch or pen contact. The press ends any travel or throw, remembers the frame, the x and the picture's width, and captures the pointer (the drag continues outside the picture). Each move: ignored while |x − press x| < 6 px; otherwise frame = start frame of the drag + direction × round((x − press x) / width × framesPerWidth), wrapped into 1..N (relative, discrete, wrapping). Vertical motion is ignored; `touch-action: pan-y` leaves vertical swipes to the page (a diagonal swipe the browser claims ends as a cancel).
  - Release: a lift while the hand is still moving throws the orbit on (see Flows); a lift after resting, `pointercancel` or lost capture stops where it is.
  - Keys (focused): ArrowRight, ArrowUp → frame + direction; ArrowLeft, ArrowDown → frame − direction; PageDown / PageUp → ± direction × max(1, round(N / 12)); Home → start frame; End → start frame + floor(N / 2) (the opposite side); all wrap; each key ends a travel or throw; other keys pass through
- **A11y:** `role="slider"`, `tabIndex=0`, `aria-valuemin=1`, `aria-valuemax=N`, `aria-valuenow=frame`, `aria-orientation="horizontal"`; inset focus-visible ring; no text selection; on touch it takes no focus on iOS (#182)
- **Tests:** `data-testid="orbit-viewer"`, `data-frame`; `r360.spec.ts`: start `data-frame="3"` and `aria-valuetext="Klatka 3 z 4"`; drag half the width at k = 2 → 4, again → 1 (wrap); ArrowRight → 2, ArrowLeft ×2 → 4, Home → 3, End → 1; reduced motion: a thrown drag stays put for 1.4 s; axe `public-r360-card`; `works.spec.ts` owner preview drag
- **Source:** `orbit-viewer.tsx` — `OrbitViewer`; `use-orbit.ts` — `useOrbit` (`DRAG_SLOP_PX`); `orbit.ts` — `frameAfterDrag`, `frameAfterKey`, `pageStep`, `wrapFrame`

##### `ORBIT.viewer.poster` — image

- **Label:** alt = the caller's frame alt (`Works.orbit.frameAlt` — pl „{name}, widok 360°” · en "{name}, 360° view")
- **Where:** fills the viewer
- **Shown:** until the asked frame or a frame near it has been decoded; rendered by the server, so present without JavaScript and for crawlers
- **Does:** shows the start frame at 800 px (card: the set's own address; lightbox: the same 800 px file while the 1600 px set loads); not draggable
- **States:** `loading="lazy"` in the gallery (F-WORKS-24), `decoding="async"`
- **Tests:** `r360.spec.ts` (JavaScript disabled) `getByTestId("orbit-viewer").locator("img")` src `/(^|\/)800\/003\.webp$/`, alt „Dom na skarpie, widok 360°”; after drags with nothing loaded the `img` src still ends `/003.webp`
- **Source:** `orbit-viewer.tsx` — `OrbitViewer`; `works-gallery.tsx` — `PublicOrbit`, `OrbitFull`

##### `ORBIT.viewer.canvas` — image (painted frame)

- **Label:** `role="img"`, `aria-label` = frame alt
- **Where:** in place of the poster, laid out like it
- **Shown:** once the store holds the asked frame or the nearest decoded one (searched round the orbit both ways; a tie goes the work's direction)
- **Does:** paints the frame before the browser paints the update (cleared first, so a transparent frame never shows the one before)
- **Tests:** `data-testid="orbit-canvas"` (`works.spec.ts`, owner preview only)
- **Source:** `orbit-viewer.tsx` — `OrbitViewer`; `orbit.ts` — `nearestLoaded`

##### `ORBIT.viewer.loading` — status placeholder

- **Label:** `Works.orbit.loading` — pl „Wczytywanie klatek…” · en "Loading frames…"
- **Shown:** no poster address and nothing painted — never in the public gallery (it always passes a poster); owner form only
- **Source:** `orbit-viewer.tsx` — `OrbitViewer`

##### `ORBIT.ring.band` — dial (pointer target)

- **Label:** none — the whole ring is `aria-hidden="true"`
- **Where:** card: over the picture's foot, centred, 38 % of the tile (max 10rem); lightbox: under the picture, 10rem; owner form: under the preview
- **Shown:** card and lightbox except on `phone:`; owner form on every screen
- **Enabled:** always
- **Does:** an ellipse (width : height = 1 : flattening) with the start frame at the bottom; frames laid anticlockwise on screen for direction +1, clockwise for −1; only a band ~36/200 of the ring's width around the line, and the dot, take the pointer (see F-WORKS-19)
- **Input:**
  - Press (mouse primary button; any touch or pen): ends any travel or throw; captures the pointer; `touch-action: none`
  - Click or tap (moved < 6 px from the press, completed by `pointerup`): travel to the cue whose marker is within 14 screen px (the nearest), else to the frame at the pointer's angle — along the shorter arc; exactly half the orbit either way goes the work's direction; reduced motion jumps
  - Drag (≥ 6 px): the frame follows the pointer's angle directly (absolute), no travel and no throw on release; a drag clears a hovered cue label
  - `pointercancel` or lost capture: nothing
- **States:** pointer cursor; grabbing while held; tone dark in the gallery (white lines with a dark halo), light in the owner form
- **A11y:** hidden; the viewer carries the value
- **Tests:** `getByTestId("orbit-ring").locator("svg")` bounding box; `r360.spec.ts` clicks at x = (100 ± 92)/200 of the width (start 3 of 4: right end → 4, left → 2), a click at the centre leaves the frame at 3; phone `toBeHidden()`; `data-testid="orbit-ring-band"` unused; ring `data-frame`
- **Source:** `orbit-ring.tsx` — `OrbitRing` (`HIT_BAND`, `TAP_SLOP_PX`, `CUE_REACH_PX`); `ring.ts` — `ringRadii`, `angleOfPoint`, `frameAtAngle`, `travelPath`, `RING_SENSE`

##### `ORBIT.ring.dot` — position indicator

- **Where:** on the ring at the current frame's angle
- **Shown:** with the ring
- **Does:** follows the frame, frame by frame during a travel or throw; takes the pointer like the band
- **Source:** `orbit-ring.tsx` — `OrbitRing`; `ring.ts` — `angleOfFrame`, `ringPoint`

##### `ORBIT.ring.loaded-arc` — progress indicator

- **Where:** a thick line drawn over the thin translucent ring
- **Shown:** with the ring; empty until the first frame decodes (on a card: until the tile is half in view and the page has loaded)
- **Does:** every run of consecutive decoded frames is an arc (a lone frame a dot), runs across the wrap joined; gaps narrower on screen than twice the line are closed; the whole set is a closed ring; grows as frames decode (at most one update per animation frame)
- **Tests:** `data-testid="orbit-ring-loaded"` `d` (`works.spec.ts`: 3 frames = one path, two segments)
- **Source:** `orbit-ring.tsx` — `OrbitRing`; `ring.ts` — `loadedRuns`, `loadedRunsPath`, `joinInvisibleGaps`

##### `ORBIT.ring.cue-marker` — marker (pointer target)

- **Where:** a diamond on the ring at each cue's frame
- **Shown:** the work has cues, wherever the ring is
- **States:** lit (its cue is pointed at) → 1.45× larger, `data-lit="true"`
- **Input:** mouse over the band within 14 screen px of a marker (the nearest wins) → points at that cue; off it or out of the band → clears; touch and pen never point; click or tap → travel to the cue (see band)
- **Tests:** `r360.spec.ts` `[data-testid="orbit-ring-cue"][data-cue-frame="4"]` `data-lit="true"`; mouse on / off the right end; touch `tap` on the top marker → frame 1, no label
- **Source:** `orbit-ring.tsx` — `OrbitRing` (`hover`, `leave`, `cueUnder`); `cues.ts` — `cueNear`

##### `ORBIT.ring.cue-label` — label

- **Label:** the cue's label (owner's text, not a dictionary key)
- **Where:** beside its marker, outward: above on the far arc, to the right or left near the ends, never below; moved sideways back inside the card's picture (or the page) with a 4 px margin, again when the ring resizes
- **Shown:** only while its cue is pointed at — mouse on the marker, mouse on its button, or its button focused from the keyboard; never because the orbit stands on the cue; never after a tap
- **A11y:** inside the hidden ring
- **Tests:** `r360.spec.ts` `getByTestId("orbit-ring-cue-label")` count 0 off every cue, text while pointed at, count 0 after `mouse.move(5, 5)`, after a drag off a marker, after taps
- **Source:** `orbit-ring.tsx` — `OrbitRing`, `keepInside`; `cues.ts` — `cueLabelSide`, `shiftIntoBounds`

##### `ORBIT.ring.counter` — status text

- **Label:** `Works.orbit.counter` — pl „{frame} / {total}” · en "{frame} / {total}"
- **Where:** under the ring (dark chip in the gallery)
- **Shown:** under the card's ring (dark chip) and the owner form's preview ring (muted text, every screen incl. `phone:`); not in the lightbox. On the public page, therefore, never on `phone:`.
- **A11y:** inside the hidden ring; the viewer announces the frame
- **Tests:** `r360.spec.ts` `getByTestId("orbit-counter")` „4 / 4”
- **Source:** `orbit-ring.tsx` — `OrbitRing` (`counter`); `works-gallery.tsx` — `PublicOrbit`

##### `ORBIT.cues.list` — list

- **Label:** caller's `aria-label`: `Works.orbit.cues` — pl „Punkty widoku 360°: {name}” · en "Points of the 360° view: {name}" (owner form `Works.form.r360.previewCues`)
- **Where:** card: top of the body; lightbox: under the ring, centred; wraps onto more lines
- **Shown:** ≥ 1 cue; every screen, `phone:` included
- **Tests:** `data-testid="orbit-cues"` (unused); found by role and name
- **Source:** `orbit-cues.tsx` — `OrbitCueButtons`

##### `ORBIT.cues.button` — button

- **Label:** the cue's label (owner's text), after a small diamond (aria-hidden)
- **Where:** in the order a turn from the start frame meets the cues (by (frame − start) mod N)
- **Shown:** one per cue
- **Enabled:** always
- **Does:** press → travel from the current frame to the cue's frame along the shorter arc (a tie goes the work's direction), one pace; reduced motion jumps
- **States:** here — the orbit's frame is the cue's frame, however it got there (travel, drag, key): solid tone + `aria-current="true"`; lit — pointed at: stronger border/background; rest. Colours switch without transition; light tone on the card, dark in the lightbox
- **Input:** click, tap, Enter, Space; mouse enter → points at the cue (marker lit, label on the ring), mouse leave → clears; focus that is `:focus-visible` (keyboard) → points at it, blur → clears; touch never points
- **A11y:** `button`, `aria-current`; focus ring (inverse on dark)
- **Tests:** `r360.spec.ts` — `cues.getByRole("button")` `toHaveText(["Taras", "Wejście główne"])`; click „Wejście główne” → `data-frame="1"`, `aria-current="true"` (other button none); label shown while the mouse is still on it; `hover()` on „Taras” lights `data-cue-frame="4"`; Shift+Tab focus shows „Taras”, Enter → 4; `tap()` → 4 with no label; with `requestAnimationFrame` stubbed a press still arrives within 2 s and a key on the way wins (#161)
- **Source:** `orbit-cues.tsx` — `OrbitCueButtons`, `focusVisible`; `cues.ts` — `cuesInOrder`; `ring.ts` — `travelPath`

#### Flows and rules

- Hands: a card holds one orbit hand shared by its tile, ring and cue buttons, plus one "pointed-at cue" shared by its ring and buttons (`WorkCard` `useOrbit`, `useCueHand`); the lightbox (`OrbitFull`) holds its own pair, starting at the start frame; the owner form its own.
- Throw (#153): on a lift, the pointer's readings from the last 100 ms, the lift point included (the press itself never counts), give a speed = direction × (Δx / width × framesPerWidth) / Δt frames/ms, capped at 0.1 frames/ms. With a constant slowing of 1/12 000 frames/ms², the orbit coasts round(speed × duration / 2) frames over duration = |speed| × 12 000 ms (≤ 1 200 ms, ≤ 60 frames, may pass a full turn), fast at first and slowing to a stop. Under one frame → no throw (a hand at rest before lifting stops dead). Never after `pointercancel` or lost capture; never with `reduced-motion`. A press on the picture or ring, or a key, ends it where it is.
- Travel (ring click, marker, cue button): the frames along the shorter arc, destination last; duration = 28 ms × frames, within 250–1 200 ms; every frame gets an equal share (one pace, no ease); a press on the picture or ring, or a key, ends it where it is; a timer puts the orbit on the destination at duration + 200 ms even when animation frames stop (tab in the background); `reduced-motion` → jump straight there.
- Loading (visitor frames, `useFrameLoader`):
  - Card: nothing beyond the poster until the tile is ≥ 50 % in view (once; stays on after scrolling away; at once without IntersectionObserver) AND `document.readyState === "complete"`. Lightbox: at once.
  - Then the whole set at the viewer's width, in the order start frame, every 8th, every 4th, every 2nd, the rest. `navigator.connection.saveData` or an effective type of 2g/3g (incl. slow-2g) → only the first ⌈N / 8⌉ of that order, never widened (F-WORKS-23).
  - One queue for the whole page, 3 requests at a time, first come first served (#152, F-WORKS-18). A frame counts once decoded. Unmount (lightbox closed, stepped away) cancels frames in flight.
  - Per set, for the page's life: frames already decoded are remembered (reopening starts from them; a frame whose picture is gone is fetched again); pictures of up to 20 sets kept, the oldest dropped; a set that fails 3 times in a row before any of its frames has ever loaded is not asked again (poster stays, arc empty).
  - While loading the viewer paints the nearest decoded frame (round the orbit; a tie goes the work's direction), else the poster; the valuetext names the frame shown; the ring's arc shows what has decoded.
- Screens: `phone:` (width < 40rem, or coarse pointer and height < 32rem) → no ring on the card or in the lightbox; cue buttons stay; the owner form keeps its ring. A tablet wider than 40rem gets the ring with no hover labels (touch).
- What a visitor never sees: the parameter values (frame count as a setting, direction, frames per width, start frame, flattening), the R360 badge, the archive and its progress, cue editing, "use this frame". A visitor sees only the frames, the ring (not on `phone:`), the card's „{frame} / {total}”, the cue buttons and the valuetext.

#### Decisions

- `D-WORKS-13` — One frame at a time, the picture is the control: a horizontal drag is relative to the press, discrete (framesPerWidth frames per picture width) and wraps past the last frame; vertical swipes stay the page's; a 6 px slop keeps a diagonal swipe from jittering a frame; the keyboard steps the same frames. Source: A13; #68 decisions; `use-orbit.ts`, `orbit-viewer.tsx`, `orbit.ts` comments (#103, #104).
- `D-WORKS-14` — Frames are painted onto a canvas from decoded pictures, not swapped into an `<img>` (which flashed the ground between frames); the `<img>` stays as the server-rendered poster for crawlers, visitors without script, and the first moment. Source: SPEC §10 "An orbit is painted from frames kept decoded in memory" (#117); `orbit-viewer.tsx` comment.
- `D-WORKS-15` — Loading: a card fetches nothing past its poster until half in view and the page has loaded (a profile may carry ten orbits; the page's own pictures first); in view it loads its whole set untouched (#123), start frame then every 8th/4th/2nd/rest so it turns after a dozen requests; one page queue of 3; a frame counts once decoded; a set that never answers is given up after 3 failures (#140); what loaded is remembered for the page's life, so a reopened lightbox loads again (#143). Source: `use-frame-loader.ts`, `frame-loading.ts`, `works-gallery.tsx` `useInView` / `usePageLoaded` comments.
- `D-WORKS-16` — The ring is a dial and the visitor's progress bar: an ellipse flattened to the render camera's elevation, the start frame at the bottom (nearest the viewer), frames anticlockwise for direction +1 (#124, Dawid 10.09.2026), what has decoded drawn as arcs whose invisible gaps are joined (#117, #125); a click travels the shorter arc, a tie going the work's direction; only the band takes the pointer; hidden from assistive technology because the viewer is the same value. Source: A13; `ring.ts`, `orbit-ring.tsx` comments (#106, #68 decision 2).
- `D-WORKS-17` — A cue's label shows only while it is pointed at (mouse on its marker or its button, or that button focused from the keyboard); nothing leaves it standing — not the orbit on the cue's frame, not a tap; a click or tap on a marker goes to its cue. Source: A13; #107 comment of 11.09.2026; `orbit-ring.tsx` comment.
- `D-WORKS-18` — Cue buttons stand on their own — everything a cue does is reachable without the ring, and they are the keyboard's and screen reader's way to the cues — in the order a turn from the start frame meets them; the button of the cue the orbit stands on is marked (a readout of arrival; #175's "light on the press" was closed unmerged); no colour transition (axe caught an unreadable mid-fade); only the keyboard's focus points at a cue (a pressed button keeps its focus). Source: A13; #107 decision (layouts A and B together); `orbit-cues.tsx`, `cues.ts` comments; PR #177.
- `D-WORKS-19` — On `phone:` the public page shows no ring, on the card or in the lightbox — only the cue buttons; the owner's form keeps its ring. Source: A13; #107 comment of 11.09.2026; `globals.css` `phone` variant comment; `PublicOrbit` comment.
- `D-WORKS-20` — Target for the redesign: on the desktop profile page the ring appears only once the work is enlarged; phones keep only the buttons. Source: A13 ("the redesign will keep the ring for the enlarged view on the profile page too"); #107 decision comment ("on the desktop profile page the ring shows only once the work is enlarged. The UI redesign at the end gives the ring and the buttons their final place"); `orbit-cues.tsx` and `cues.ts` header comments.
- `D-WORKS-21` — An orbit thrown with the hand keeps turning and slows to a stop at a constant rate; a hand that came to rest before letting go stops the orbit (the lift is one of the readings, no second threshold); a cancelled pointer never coasts; a visitor whose system asks for less motion is not thrown at all; a grab or a key ends a coast. Source: A13 (#153); `orbit.ts` `coastOnRelease` / `coastAfterDrag` comments; `r360.spec.ts`.
- `D-WORKS-22` — A travel runs at one pace. The ease from #153 and the owner's Motion switch over it were removed on 12.09.2026 by #177, the same day #171 merged them, and #175's owner-set ease-in / ease-out amounts never reached `main` — "the product is losing functions rather than gaining them" (Dawid); a stored `glide` key is dropped on read. Source: A13; PR #177; #175 (closed); `orbit.ts` `TravelCurve` comment; `frame-set-shared.ts` `r360ParamsSchema` comment.
- `D-WORKS-23` — Under reduced motion a travel jumps; a travel always arrives even where animation frames stop coming, and a hand on the way still wins. Source: A13; `use-orbit.ts` (#161); `orbit-ring.tsx` comment (#106).

#### Findings

- `F-WORKS-18` — Orbits on one page load one after another (#152, open). Evidence: `use-frame-loader.ts` `pageQueue` (3, shared); `frame-loading.ts` `FrameQueue.pump` is first in, first out and `startFrameLoading` `fill` enqueues a whole set at once — a second orbit, and the lightbox's 1600 px set on `desktop`, wait behind every frame already queued, their coarse tier included.
- `F-WORKS-19` — On a card, a press inside the ring's box but off its band (e.g. the ring's middle) likely turns nothing. Evidence: `PublicOrbit` renders the ring beside `OrbitViewer`, not inside it, stacked above the picture (`z-10`); in `OrbitRing` only the `svg` is `pointer-events: none`, its wrapper `div`s take the press, which reaches neither the viewer's handlers nor the ring's. Contradicts the `orbit-ring.tsx` comment "Only the band of the ring is the target: the picture under the rest keeps its drag"; the e2e "a tap on the ring's centre falls through" cannot tell (a press without motion changes nothing either way). UNVERIFIED on the running app.
- `F-WORKS-20` — Comparable sliders take focus on touch differently (#182, open). Evidence: `channel-reveal.tsx` `onPointerDown` focuses the handle (`focus({ preventScroll: true })`); `use-orbit.ts` `onPointerDown` does not (per #182, Android focuses the `div` itself, iOS does not); cue buttons get no focus on iOS.
- `F-WORKS-21` — Code comments describe removed or superseded behaviour, which a redesign reading them could bring back. Evidence: `use-orbit.ts` header "#153: the motion eases, on a work whose owner has left it to. A travel gathers pace and settles onto its frame" (removed by #177); `frame-loading.ts` header "only the coarse tier … and the rest once the visitor touches it" (superseded by #123); `OrbitTile` "a button of its own beside the 360° mark" (mark top-left, button bottom-right).
- `F-WORKS-22` — For a work with direction −1 the keys run against the value. Evidence: `orbit.ts` `frameAfterKey` adds `direction` for ArrowRight/ArrowUp, so `aria-valuenow` falls on Right/Up and rises on Left/Down, against the slider convention (Right/Up = more). May be deliberate: the keys follow the picture (a rightward drag).
- `F-WORKS-23` — A Save-Data or 2g/3g visitor never gets more than every 8th frame. Evidence: `use-frame-loader.ts` passes `tier: "coarse"` for such a connection and never calls `setTier` (`frame-loading.ts`), so the orbit turns in jumps of about 8 for good while the arc shows gaps. May be deliberate ("the escape hatch for a connection that asked for little").
- `F-WORKS-24` — The poster is always lazy in the gallery, against its own prop doc. Evidence: `OrbitViewerProps.posterLoading` "lazy below the fold, eager for the page's first" defaults to `"lazy"`; `PublicOrbit` never passes it, so a first-screen orbit's poster waits for lazy loading (only the owner form passes `eager`).

### C-REVEAL — two-channel reveal slider

- **Screenshots:** `c-work-card--two-channel--desktop`, `v-lightbox--photo--desktop`, `v-lightbox--photo--phone` (Appendix A)
- **Used in:** `LIGHTBOX.stage.reveal` only, for a photo with a second channel (#99). The card shows the first channel alone plus `WORKS-LIST.strip.two-channel-badge`.
- **Purpose:** compare two channels of one photo by revealing the second under the first (#100).
- **Parts:** `src/components/ui/channel-reveal.tsx` — `ChannelReveal`; rules `src/lib/channel-reveal.ts` — `positionFromPointer`, `positionAfterKey`, `secondChannelClip`, `REVEAL_STEP`. Element IDs below use `REVEAL.`.
- **Server calls:** none; two images at 1600 px.

#### Elements

##### `REVEAL.picture.drag` — gesture

- **Where:** the whole picture box
- **Shown:** with the reveal
- **Does:** press (primary button; a touch counts) → the handle jumps to the pointer's position (absolute, not relative) and follows while held; the pointer is captured; the handle takes focus without scrolling; release or `pointercancel` stops
- **Input:** along → the pointer's x across the box width; across → its y down the box height; position rounded, 0–100; `touch-action: none` and no selection on the box (no page scroll starts on the picture); images not draggable
- **Tests:** `lightbox.spec.ts` mouse down at 90 % of the width, moved to 25 % in 5 steps → `aria-valuenow="25"` (box = `slider.locator("..")`, images sized by an injected style)
- **Source:** `channel-reveal.tsx` — `ChannelReveal`; `channel-reveal.ts` — `positionFromPointer`

##### `REVEAL.picture.handle` — slider

- **Label:** `aria-label` `Works.reveal.label` — pl „Porównanie kanałów: {name}, zdjęcie {index}” · en "Channel comparison: {name}, photo {index}"; `aria-valuetext` `Works.reveal.valueText` — pl „{percent}% drugiego kanału” · en "{percent}% of the second channel"; described by `REVEAL.footer.hint`
- **Where:** on the divide — at mid-height when along, mid-width when across (44 px, double chevron ←→ or ↑↓)
- **Shown:** with the reveal
- **Enabled:** always
- **Does:** position 0–100: 0 = first channel only, 100 = second channel only, 50 = half and half
- **States:** starts at 50, along; reset for every photo stepped to; resize cursor ew/ns
- **Input:** keys when focused — along: ArrowLeft −5, ArrowRight +5; across: ArrowUp −5, ArrowDown +5; both: PageUp −20, PageDown +20, Home → 0, End → 100; clamped; the other axis's arrows do nothing (and do not step the lightbox); Escape closes the lightbox
- **A11y:** `role="slider"`, `tabIndex=0`, `aria-orientation` horizontal (along) / vertical (across), `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, `aria-valuetext`, `aria-describedby`; white focus-visible ring
- **Tests:** `lightbox.spec.ts` `getByRole("slider", { name: "Porównanie kanałów: {PAIR}, zdjęcie 1" })` — `aria-valuenow` 50, `aria-orientation` horizontal; ArrowRight → 55, End → 100, Home → 0; after „W poprzek” vertical and ArrowDown 25 → 30; axe `lightbox-reveal`
- **Source:** `channel-reveal.tsx` — `ChannelReveal`; `channel-reveal.ts` — `positionAfterKey`, `clampPosition`

##### `REVEAL.picture.first-channel` — image

- **Label:** alt `Works.photoAlt` — pl „{name}, zdjęcie {index}” · en "{name}, photo {index}"
- **Where:** base layer; sets the box's size
- **Shown:** as soon as it arrives (nothing waits, #159)
- **Source:** `channel-reveal.tsx` — `ChannelReveal`

##### `REVEAL.picture.second-channel` — image

- **Label:** alt `Works.reveal.secondAlt` — pl „{name}, zdjęcie {index}, drugi kanał” · en "{name}, photo {index}, second channel"
- **Where:** laid over the first channel, same box, whole picture fitted
- **Shown:** as soon as it arrives; before the first channel sizes the box it has no room and shows nothing (#159)
- **Does:** clipped to the handle: along → visible from the left edge to the handle (`inset(0 {100 − p}% 0 0)`); across → from the top edge down to the handle (`inset(0 0 {100 − p}% 0)`); the pair is assumed to share proportions (otherwise it letterboxes and the divide drifts off it)
- **Tests:** `lightbox.spec.ts` `getByRole("img", { name: "{PAIR}, zdjęcie 1, drugi kanał" })` `toHaveCSS("clip-path", …)` for 50 %, 0 % and 70 % (across)
- **Source:** `channel-reveal.tsx` — `ChannelReveal`; `channel-reveal.ts` — `secondChannelClip`

##### `REVEAL.picture.divide` — indicator

- **Where:** a thin light line through the box at the position — vertical when along, horizontal when across
- **Shown:** always with the reveal, from before either channel has loaded
- **A11y:** `aria-hidden`
- **Source:** `channel-reveal.tsx` — `ChannelReveal`

##### `REVEAL.footer.hint` — text

- **Label:** `Works.reveal.hint` — pl „Przeciągnij po zdjęciu albo użyj strzałek” · en "Drag across the picture or use the arrow keys"
- **Where:** under the picture, before the axis button
- **Shown:** always, every screen
- **A11y:** the handle's `aria-describedby`
- **Source:** `channel-reveal.tsx` — `ChannelReveal`

##### `REVEAL.footer.axis` — button (toggle)

- **Label:** along → `Works.reveal.axisAcross` — pl „W poprzek” · en "Across"; across → `Works.reveal.axisAlong` — pl „Wzdłuż” · en "Along" (names the axis it switches to)
- **Where:** after the hint
- **Shown:** always with the reveal
- **Enabled:** always
- **Does:** flips the axis, keeps the position; not stored anywhere
- **Input:** click, tap, Enter, Space
- **A11y:** plain `button` (no `aria-pressed`); the current axis is the handle's `aria-orientation`
- **Tests:** `lightbox.spec.ts` `getByRole("button", { name: "W poprzek" })`
- **Source:** `channel-reveal.tsx` — `ChannelReveal`

#### Flows and rules

- Orientation rule: along = x axis = horizontal slider, vertical divide, second channel from the left; across = y axis = vertical slider, horizontal divide, second channel from the top; each arrow moves the handle the way it points.
- Before both channels load: nothing waits — the handle, divide, hint and axis button are drawn at once; the first channel shows whole until the second lands, or the second shows nothing until the first sizes the box (#159).
- Touch: a finger anywhere on the picture moves the divide; the press focuses the handle (see F-WORKS-20).
- Stepping to another photo in the lightbox remounts the reveal: position 50, along.

#### Decisions

- `D-WORKS-24` — Drag anywhere on the picture or take the handle with the keyboard; the axis is the viewer's choice, per look, never stored; one box for both channels because they are the same view. Source: `channel-reveal.tsx` comments (#100).
- `D-WORKS-25` — On the across axis ArrowDown shows more of the second channel — "a conscious step away from the APG's 'up is more'", with `aria-valuetext` saying what the value means. Source: `lib/channel-reveal.ts` `positionAfterKey` comment.

#### Findings

- `F-WORKS-25` — A two-channel photo flashes when enlarged (#159, open). Evidence: `ChannelReveal` renders two plain `<img>` with no load handling — the first channel shows undivided until the second lands, or the second shows nothing until the first sizes the box; the controls are drawn over whatever box exists; a channel that never loads has no fallback.

### V-WORK-FORM — the work form (a new work / an existing work)

- **Screenshots:** `v-work-form--new--desktop`, `v-work-form--new--phone`, `v-work-form--edit-orbit--desktop`, `v-work-form--edit-orbit--phone`, `v-work-form--edit-two-channel--desktop` (Appendix A)
- **Route:** no route of its own, no history entry. Lives on `/{handle}` (en `/en/{handle}`) — `src/app/[locale]/(public)/[handle]/page.tsx` → `OwnerProfileView` (`owner-profile-view.tsx`) → `WorkForm` (`work-form.tsx`).
- **Reached by:** `owner` in `edit` mode only (`page.tsx` `isOwnerViewing`; `OwnerProfileView` renders a form only while `editing`). `signed-out`, `other`, `no-handle`, `view` mode: never rendered. One form at a time — `OwnerProfileView` state `workForm`: `{ kind: "new" }` | `{ kind: "edit", work }` | `null`; one shared `workFormRef`.
  - **New placement:** a card between the works header row (`Works.heading` h2 + count + "+") and the list, `key="new"`. While it is open the empty state (`Works.emptyTitle`) is not rendered.
  - **Edit placement:** the form replaces the work's card inside its own list item (`WorksGallery` prop `inPlace`; the `li` spans both grid columns on `desktop`), `key={work.id}`; the other cards stay where they are; the list's drag grips are withdrawn while a form stands in the list (`works-gallery.tsx` `reorder = inPlace ? undefined : order`, #66). The new placement does not withdraw them.
- **Purpose:** create or replace one work — name, investor, developer, 0–3 photos (each with an optional second channel), an optional R360 orbit with its parameters and cue points.
- **Arrives from → leaves to:**
  - from the header "+" (`Works.add` „Dodaj realizację” · "Add a work", `aria-expanded`, disabled at 10 works) — pressing it again closes the new form; from a card's „Edytuj” (`Works.card.edit`, aria-label „Edytuj: {name}”, `data-work-edit={id}`). Opening the new form or another work's form unmounts the open one.
  - leaves by: own save success (new → closes + `router.refresh()`; edit → `closeInPlaceForm`: card back in place, focus to its „Edytuj”, `router.refresh()`), „Anuluj”, the top bar's „Zapisz” (via `settle()`), editing ended by the leave guard (#83), "+" again, another „Edytuj”, client navigation.
- **Layout (top → bottom):**
  1. Title (h3).
  2. Text fields: Name (full width) · then Investor | Developer (two columns on `desktop`, stacked on `phone`); each = label, input, counter under it right-aligned.
  3. Photos: header line (label · rule … count at the right); tile grid (2 columns on `phone`, 3 on `desktop`): photo tiles in position order, then the dashed "add" tile; hint line.
  4. R360: header line (label · rule); either the picker row or the orbit row (ready chip, summary, then progress + stage counters OR the remove button); hint line; preview block (`C-R360-PARAMS`).
  5. Actions row: Save, Cancel; the alert line below them, full width.
- **Server calls:** (uploads happen when files are picked, never at save)
  - `POST /api/uploads/presign` `{ sizeBytes, contentType }` — per photo/channel file that passed the browser checks — 200 `{ stagingKey, uploadUrl }`; 400 `quota_exceeded` / `invalid_request`; 429 (20/min); 401; 403 cross-site. Reserves the declared bytes against A9 for 7 min (URL valid 120 s).
  - `PUT {uploadUrl}` (XMLHttpRequest; `content-type`, `cache-control` immutable; upload progress; abortable) — failure or abort → `POST /api/uploads/abandon { stagingKey }`.
  - `POST /api/uploads/confirm` `{ stagingKey, purpose: "work" }` — 200 `{ original: { fileId }, variants: [{ kind, url }] }` (the tile takes the `*-480` URL); 400 `not_an_image` / `unsupported_format` / `too_large` / `not_found` / `invalid_key` / `quota_exceeded` (A9 re-check); 429 (15/min).
  - `POST /api/uploads/discard` `{ fileId }` — best effort, answer ignored — a photo/channel uploaded in this form and then removed, replaced, or left unsaved when the form closes; a file landing after the form closed. The route leaves alone a file a work names (30/min).
  - `POST /api/uploads/presign-r360-set` `{ frameCount }` — once per zip run, after the WebP probe — 200 `{ setId, keyPrefix, urls: { 1600: [], 800: [] } }`; 400 `quota_exceeded`; 429 (10/min); anything else → `presign_failed`.
  - `PUT` ×2N frame URLs (6 in the air; `content-type: image/webp`, `cache-control` immutable, `x-amz-acl: public-read`).
  - `POST /api/uploads/abandon` `{ stagingKey: keyPrefix }` — a run that fails or is stopped (by the pipeline), a produced set removed or left unsaved, a replaced run that returns late.
  - Save: new → `POST /api/works`; edit → `PATCH /api/works/{id}` (one 30/min bucket shared by POST, PATCH and DELETE). Answers mapped in Flows → Save.
  - Edit placement with a saved orbit: `GET` of the saved 800 px frames (the visitor's loader) and the start frame's 800 px file as the poster.

#### Elements

##### `WORK-FORM.header.title` — heading

- **Label:** new: `Works.form.newTitle` — pl „Nowa realizacja” · en "New work"; edit: `Works.form.editTitle` — pl „Edytuj realizację” · en "Edit work"
- **Where:** first in the card.
- **Shown:** both placements.
- **A11y:** `h3` under the section's `h2`. The `<form>` itself (`Card as="form"`) has no accessible name, so it is not a landmark.
- **Tests:** `e2e/db/works.spec.ts` `getByRole("heading", { name: "Nowa realizacja" })` (open / `toHaveCount(0)` after save or cancel); `items.nth(1).getByRole("heading", { name: "Edytuj realizację" })`.
- **Source:** `work-form.tsx` — `WorkForm`

##### `WORK-FORM.fields.name` — text field

- **Label:** `Works.form.name.label` — pl „Nazwa” · en "Name"; placeholder `Works.form.name.placeholder` — pl „np. Osiedle Nowe Żerniki, etap II” · en "e.g. Nowe Żerniki estate, stage II"
- **Where:** first row, spans both columns on `desktop`.
- **Shown:** both placements; initial value `work.name` (edit) or empty.
- **Enabled:** always (not disabled while saving).
- **Does:** holds the name; sent NFC-normalised and trimmed.
- **States:** counter (`WORK-FORM.fields.counter`). Errors only at save: blank after trim → `Works.form.errors.nameRequired` — pl „Podaj nazwę realizacji.” · en "Give the work a name."; schema refusal (control/format/line/paragraph separator characters `\p{Cc}\p{Cf}\p{Zl}\p{Zp}`) → `Works.form.errors.nameInvalid` — pl „Nazwa jest za długa albo zawiera niedozwolone znaki.” · en "The name is too long or contains characters that are not allowed."
- **Input:** `maxLength` 120 (the browser stops typing and truncates a paste); Enter submits the form (= Save) unless Save is disabled.
- **A11y:** `<label for>`; focused on mount in both placements (focus scrolls it into view); focused again when `settle()` answers "kept". No `required`/`aria-required`, no `aria-invalid`/`aria-describedby` (F-FORM-10).
- **Tests:** `works.spec.ts`, `happy-path.spec.ts`, `leave-guard.spec.ts` `getByLabel("Nazwa", { exact: true })` (`fill`, `toHaveValue`, `toBeFocused()` after "kept"); `getByText("Podaj nazwę realizacji.")`.
- **Source:** `work-form.tsx` — `WorkForm`, `Field`; `src/lib/work-schemas.ts` — `WORK_NAME_MAX`, `workInputSchema`

##### `WORK-FORM.fields.investor` — text field

- **Label:** `Works.form.investor.label` — pl „Inwestor” · en "Investor", followed by „· ” + `Works.form.optional` — pl „opcjonalnie” · en "optional"; placeholder `Works.form.investor.placeholder` — pl „Kto zamówił projekt” · en "Who commissioned the project"
- **Where:** second row, left on `desktop`; under Name on `phone`.
- **Shown:** both placements; initial `work.investor ?? ""`.
- **Enabled:** always.
- **Does:** optional; sent trimmed/NFC, `""` when empty (the server stores NULL).
- **States:** counter; save-time schema refusal (disallowed characters) → `Works.form.errors.partyInvalid` — pl „Tekst jest za długi albo zawiera niedozwolone znaki.” · en "The text is too long or contains characters that are not allowed."
- **Input:** `maxLength` 120; Enter = Save.
- **A11y:** as Name, without initial focus.
- **Tests:** `works.spec.ts` `getByLabel("Inwestor")`.
- **Source:** `WorkForm`, `Field`; `work-schemas.ts` — `WORK_PARTY_MAX`, `partySchema`

##### `WORK-FORM.fields.developer` — text field

- **Label:** `Works.form.developer.label` — pl „Deweloper” · en "Developer" + „· ” + `Works.form.optional`; placeholder `Works.form.developer.placeholder` — pl „Kto buduje i sprzedaje” · en "Who builds and sells"
- **Where:** second row, right on `desktop`; last on `phone`.
- **Shown / Enabled / Does / States / Input / A11y:** as Investor (initial `work.developer ?? ""`).
- **Tests:** none.
- **Source:** `WorkForm`, `Field`

##### `WORK-FORM.fields.counter` — status line (one under each text field)

- **Label:** `Settings.profile.sections.counter` — pl „{count} / {max}” · en "{count} / {max}" — `count` = raw `value.length` (untrimmed UTF-16 units), `max` 120
- **Where:** under its input, right-aligned.
- **States:** muted; warning colour at ≥ 90 % of max (≥ 108).
- **A11y:** plain text, not live, not linked to the input.
- **Tests:** none.
- **Source:** `work-form.tsx` — `Field`

##### `WORK-FORM.photos.header` — status line

- **Label:** `Works.form.photos.label` — pl „Zdjęcia” · en "Photos", then „· ” + `Works.form.photos.rule` — pl „od 1 do 3, JPEG, PNG lub WebP do 10 MB każde; możesz wybrać kilka naraz” · en "1 to 3, JPEG, PNG or WebP up to 10 MB each; pick several at once"; right side `Works.form.photos.count` — pl „{count} / {max}” · en "{count} / {max}" (`count` = tiles including uploading ones, `max` 3)
- **Where:** top of the photos group.
- **Shown:** always. The rule text does not change when an orbit is attached (F-FORM-9).
- **A11y:** a `<p>`, not a group label; not referenced by any file input.
- **Tests:** `works.spec.ts` `getByText("1 / 3")`.
- **Source:** `WorkForm`

##### `WORK-FORM.photos.add` — file picker

- **Label:** visible text of the wrapping `<label>`: 0 tiles → `Works.form.photos.add` — pl „Dodaj zdjęcia” · en "Add photos" plus corner badge `Works.form.photos.required` — pl „wymagane” · en "required"; 1–2 tiles → `Works.form.photos.addMore` — pl „Dodaj” · en "Add"
- **Where:** last cell of the tile grid (dashed 4:3 tile with a plus icon).
- **Shown:** while tiles < 3; gone at 3. The „wymagane” badge shows at 0 tiles even when an orbit set is attached (F-FORM-9).
- **Enabled:** always, also while saving (F-FORM-13).
- **Does:** `pickPhotos`: resets the input, clears the alert; `room = 3 − tiles`; more files than `room` → nothing uploads and `Works.form.errors.tooManyPhotos` — pl „Wybrano {offered, plural, one {# zdjęcie} few {# zdjęcia} many {# zdjęć} other {# zdjęcia}}, a {room, plural, one {zmieści się jedno} other {zmieszczą się #}}. Wybierz najwyżej {room}.” · en "You picked {offered} photos and {room, plural, one {one fits} other {# fit}}. Pick at most {room}."; otherwise every file starts its own upload in parallel (Flows → Photo upload).
- **States:** see `WORK-FORM.photos.tile`.
- **Input:** `accept="image/jpeg,image/png,image/webp"`; `multiple` while 2 or more places are free (0 or 1 tiles), single-file for the last place; keyboard: Tab reaches the visually hidden input (focus ring drawn on the label), Enter/Space opens the OS picker.
- **A11y:** name from the label's text content (UNVERIFIED: „Dodaj zdjęcia wymagane” at 0 tiles, „Dodaj” later); rule and hint not linked.
- **Tests:** `works.spec.ts`, `happy-path.spec.ts`, `leave-guard.spec.ts` `getByTestId("work-photos")` (`setInputFiles`, `toHaveAttribute("multiple", "")`, `not.toHaveAttribute("multiple")`, `toHaveCount(0)` when full); `getByText("Wybrano 3 zdjęcia, a zmieszczą się 2. Wybierz najwyżej 2.")`.
- **Source:** `work-form.tsx` — `pickPhotos`, `addPhoto`; `src/lib/image-upload-shared.ts` — `IMAGE_CONTENT_TYPES`

##### `WORK-FORM.photos.tile` — image tile (state)

- **Label:** none (picture only).
- **Where:** tile grid, in position order; position 0 first.
- **Shown:** one per photo: the work's saved photos that carry a `fileId` (edit), then picked ones.
- **Does:** shows the saved photo's 480 px variant; a picked photo shows its local object URL at 50 % opacity while uploading, then the server's `*-480` variant from confirm (the local URL if confirm named none).
- **States:**
  - main (index 0): 2 px action-colour border, also while uploading;
  - uploading: `WORK-FORM.photos.tile-progress` over the bottom of the picture; no controls under the tile;
  - broken preview (image `error`): switches to the local file when there is one and it is not what failed; otherwise a neutral tile with a camera icon and `Works.form.photos.noPreview` — pl „Bez podglądu” · en "No preview";
  - channel uploading: `WORK-FORM.photos.channel-progress`; channel landed: `WORK-FORM.photos.channel-badge`.
- **A11y:** `<img alt="">` — nothing identifies a tile to a screen reader (F-FORM-11).
- **Tests:** `works.spec.ts` `page.locator("form img").first()` `toHaveAttribute("src", "/__stub-storage/thumb-1.webp")`.
- **Source:** `work-form.tsx` — `Slot`, `markBroken`

##### `WORK-FORM.photos.tile-progress` — progress bar (`C-UPLOAD-PROGRESS`, compact)

- **Label:** `Works.form.photos.label` — pl „Zdjęcia” · en "Photos" (the same name on every tile)
- **Where:** dark strip across the bottom of the tile picture.
- **Shown:** while the tile's photo (new or replacement) uploads.
- **Does:** fraction = upload progress 0..1; at 1 (bytes landed, server confirming) shows "…" and hides cancel. Cancel (×) aborts: a new tile disappears; a replacement gives the tile its previous photo back (with the channel as it is now); no message.
- **A11y:** see `C-UPLOAD-PROGRESS`.
- **Tests:** none specific to the tile.
- **Source:** `WorkForm`; `src/components/ui/upload-progress.tsx` — `UploadProgress`

##### `WORK-FORM.photos.main-badge` — status

- **Label:** `Works.form.photos.main` — pl „Główne” · en "Main"
- **Where:** first control row under tile 0.
- **Shown:** tile at index 0 once it is not uploading.
- **A11y:** plain `span`.
- **Tests:** `works.spec.ts`, `happy-path.spec.ts` `getByText("Główne", { exact: true })`. (A comment in `happy-path.spec.ts` says the badge is there "from the moment it is picked"; the code shows it only after the upload.)
- **Source:** `WorkForm`

##### `WORK-FORM.photos.set-main` — button

- **Label:** `Works.form.photos.setMain` — pl „Ustaw jako główne” · en "Set as main"
- **Where:** first control row under tiles 1–2, full tile width.
- **Shown:** tiles at index > 0 that are not uploading.
- **Enabled:** always (also while saving).
- **Does:** `setMain` — moves the tile to position 0; the others keep their relative order. No request; the order travels at save as `imageFileIds`.
- **A11y:** same name on every tile (F-FORM-11); the pressed button unmounts (the tile now shows the badge) → focus lost (F-FORM-12).
- **Tests:** none.
- **Source:** `work-form.tsx` — `setMain`

##### `WORK-FORM.photos.replace` — file picker

- **Label:** visible `Works.form.photos.replaceShort` — pl „Wymień” · en "Replace"; input `aria-label` `Works.form.photos.replace` — pl „Wymień zdjęcie” · en "Replace photo"
- **Where:** second control row, first.
- **Shown:** tile not uploading.
- **Enabled:** always.
- **Does:** `replacePhoto` → `addPhoto(file, old)`: the tile becomes a pending tile in the same position (a replaced main stays main) and keeps its second channel; success → the old photo is discarded if it was uploaded in this form (a saved photo is only dropped from the form); same bytes as the old photo → the old tile comes back, no message; same bytes as another tile's photo → old tile back + `Works.form.errors.duplicatePhoto` — pl „To zdjęcie jest już na liście.” · en "That photo is already on the list."; failure → old tile back + upload message; abort → old tile back.
- **Input:** single file, same `accept`.
- **A11y:** visible word contained in the name; the tile remounts under a new key → focus lost (F-FORM-12).
- **Tests:** `works.spec.ts` `getByLabel("Wymień zdjęcie").first().setInputFiles(…)`; `data-testid="work-photo-replace-{index}"` exists, unused by tests.
- **Source:** `work-form.tsx` — `replacePhoto`, `addPhoto`

##### `WORK-FORM.photos.remove` — button

- **Label:** visible `Works.form.photos.removeShort` — pl „Usuń” · en "Remove"; `aria-label` `Works.form.photos.remove` — pl „Usuń zdjęcie” · en "Remove photo"
- **Where:** second control row, middle.
- **Shown:** tile not uploading.
- **Enabled:** always.
- **Does:** `removePhoto` — clears the alert; aborts the tile's channel upload or discards its landed channel (if uploaded in this form); removes the tile; discards the photo if uploaded in this form. A saved photo leaves the work only when the work is saved. No confirmation.
- **A11y:** same name on every tile; focus lost after press.
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Usuń zdjęcie" })` (counts; `nth(2).click()` → discard body `{ fileId }`); `happy-path.spec.ts`, `leave-guard.spec.ts` wait for it as "upload confirmed".
- **Source:** `work-form.tsx` — `removePhoto`, `discard`

##### `WORK-FORM.photos.channel-add` — file picker (icon)

- **Label:** `layers` icon; `title` and input `aria-label` `Works.form.photos.channelAdd` — pl „Dodaj drugi kanał” · en "Add a second channel"
- **Where:** second control row, last, square.
- **Shown:** tile not uploading and without a channel.
- **Enabled:** always.
- **Does:** `pickChannel` — clears the alert; a pending channel on the tile uploads through the photo chain (purpose "work"); success → channel set; same bytes as any tile's photo (its own included) or another tile's channel → channel removed again + `Works.form.errors.duplicatePhoto`; failure → channel removed + upload message; tile removed or form closed meanwhile → the landed file is discarded; if the tile's photo was replaced meanwhile, the channel lands on the replacing tile (D-FORM-4). There is no "replace channel" control (F-FORM-17).
- **Input:** single file, same `accept`.
- **A11y:** icon-only control named by `aria-label`.
- **Tests:** `works.spec.ts` `getByTestId("work-photo-channel-0")`.
- **Source:** `work-form.tsx` — `pickChannel`

##### `WORK-FORM.photos.channel-progress` — progress bar (`C-UPLOAD-PROGRESS`, compact)

- **Label:** `Works.form.photos.channel` — pl „Drugi kanał” · en "Second channel"
- **Where:** the same bottom strip as the photo bar (F-FORM-15).
- **Shown:** while the channel uploads; the tile's controls stay visible.
- **Does:** cancel (×) → `removeChannel` (abort; the channel is gone at once).
- **Tests:** none.
- **Source:** `WorkForm`, `removeChannel`

##### `WORK-FORM.photos.channel-badge` — status

- **Label:** `layers` icon + `Works.form.photos.channelBadge` — pl „2 kanały” · en "2 channels"
- **Where:** top-right corner of the tile picture.
- **Shown:** the tile has a landed channel.
- **Tests:** `works.spec.ts` `getByText("2 kanały")` (visible / `toHaveCount(0)`).
- **Source:** `WorkForm`

##### `WORK-FORM.photos.channel-remove` — button (icon)

- **Label:** `layers` icon; `aria-label` and `title` `Works.form.photos.channelRemove` — pl „Usuń drugi kanał” · en "Remove the second channel"
- **Where:** in place of `channel-add`.
- **Shown:** tile not uploading and with a channel (landed or uploading).
- **Enabled:** always.
- **Does:** `removeChannel` — clears the alert; uploading → abort; landed → discard if uploaded in this form; removes the channel.
- **A11y:** replaced by the add picker after press → focus lost.
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Usuń drugi kanał" })` (count 1; click → discard `{ fileId }`).
- **Source:** `work-form.tsx` — `removeChannel`

##### `WORK-FORM.photos.hint` — status line

- **Label:** tiles < 3: `Works.form.photos.hint` — pl „Zdjęcie główne otwiera kartę realizacji i jest w niej największe. Pierwsze dodane staje się głównym, dopóki nie wskażesz innego.” · en "The main photo opens the work's card and is the largest on it. The first one added is main until you pick another."; 3 tiles: `Works.form.photos.full` — pl „Komplet: {max} zdjęcia. Żeby dodać inne, usuń któreś albo je wymień.” · en "All {max} in place. To add another, remove one or replace it."
- **Where:** under the tile grid.
- **Tests:** `works.spec.ts` `getByText("Komplet: 3 zdjęcia. Żeby dodać inne, usuń któreś albo je wymień.")`.
- **Source:** `WorkForm`

##### `WORK-FORM.r360.header` — status line

- **Label:** `Works.form.r360.label` — pl „Render 360” · en "Render 360", then „· ” + `Works.form.r360.rule` — pl „zip z klatkami orbity — czytany na Twoim komputerze, nie wysyłany” · en "a zip of orbit frames — read on your own machine, never uploaded"
- **Where:** top of the R360 group.
- **Source:** `WorkForm`

##### `WORK-FORM.r360.picker` — file picker

- **Label:** `upload` icon + `Works.form.r360.add` — pl „Dodaj zip R360” · en "Add an R360 zip"
- **Where:** under the R360 header, dashed row.
- **Shown:** while the form holds no orbit: a new form, after remove/stop, after a refusal or failure, and during the read of a pick (the orbit row appears only once the read succeeds).
- **Enabled:** always, also while saving.
- **Does:** `pickArchive` (Flows → R360).
- **States:** reading: no visible change (F-FORM-3); refusal/failure: alert; success: replaced by the orbit row.
- **Input:** `accept=".zip,application/zip,application/x-zip-compressed"` (a hint only; anything picked is read), single file; the input is reset on every pick, so the same file can be picked again.
- **A11y:** name from the label text; rule and hint not linked.
- **Tests:** `works.spec.ts` `getByTestId("work-r360")` (`setInputFiles`; `toBeAttached()` after a refused set presign).
- **Source:** `work-form.tsx` — `pickArchive`, `readArchive`, `runFrames`

##### `WORK-FORM.r360.ready` — status

- **Label:** `Works.form.r360.ready` — pl „Gotowy” · en "Ready"
- **Where:** first in the orbit row.
- **Shown:** an orbit in the form that is not working (a finished run, or the work's saved set).
- **A11y:** `role="status"` — announced when it appears after a run; present from mount for a saved set.
- **Tests:** `works.spec.ts` `getByText("Gotowy", { exact: true })`.
- **Source:** `WorkForm`

##### `WORK-FORM.r360.summary` — status line

- **Label:** the zip's file name (monospace, truncated) — or, for a saved set, `Works.form.r360.attached` — pl „Widok 360°” · en "360 view"; then „ · {size}” when the zip's size is known (`formatBytes`: B / kB / MB / GB by 1024, one decimal below 10, the locale's decimal separator, e.g. "412 MB", „3,2 GB”); then „ · ” + `Works.form.r360.framesDone` — pl „Klatki gotowe: {total}” · en "Frames ready: {total}" when a set exists and no run is working.
- **Where:** orbit row, after the chip, takes the remaining width.
- **Tests:** `works.spec.ts` `getByTestId("work-r360-frames")` `toHaveText("· Klatki gotowe: 3")`; `getByText("second.zip")`.
- **Source:** `WorkForm`, `formatBytes`

##### `WORK-FORM.r360.progress` — progress bar (`C-UPLOAD-PROGRESS`, full)

- **Label:** `Works.form.r360.progressLabel` — pl „Przygotowywanie klatek 360” · en "Preparing the 360 frames"
- **Where:** own line in the orbit row.
- **Shown:** while the run is working — from the successful read to the end of the run.
- **Does:** fraction = (frames encoded + frames landed) / (2 × N); moves per frame event (not per byte), only grows; stays at 0 % during the WebP probe and the set presign. Cancel (×, `Settings.profile.upload.cancel` — pl „Przerwij wysyłanie” · en "Cancel the upload") → `removeArchive` (stop).
- **States:** value text „Wysyłanie {percent}%” / „Przetwarzanie…” at 1 (see `C-UPLOAD-PROGRESS`; F-FORM-6).
- **Tests:** `works.spec.ts` `getByRole("progressbar")` visible; `getByRole("button", { name: "Przerwij wysyłanie" })` visible and `.click()` (#148 test).
- **Source:** `WorkForm`, `framesFraction`

##### `WORK-FORM.r360.stages` — status line (two counters)

- **Label:** `Works.form.r360.stageFrames` — pl „Klatki {done} z {total}” · en "Frames {done} of {total}" (frames decoded and encoded) · `Works.form.r360.stageUpload` — pl „Klatki wysłane {landed} z {total}” · en "Frames uploaded {landed} of {total}" (frames whose two WebPs both landed)
- **Where:** under the progress bar.
- **Shown:** while working.
- **A11y:** plain list, not live.
- **Tests:** `data-testid="work-r360-stages"` (unused by tests); its first item carries `data-testid="work-r360-frames"` (the same id the summary uses once ready).
- **Source:** `WorkForm`

##### `WORK-FORM.r360.remove` — button

- **Label:** `Works.form.r360.remove` — pl „Usuń” · en "Remove"
- **Where:** end of the orbit row.
- **Shown:** an orbit in the form, not working.
- **Enabled:** disabled while saving.
- **Does:** `removeArchive` — aborts a run, advances the run counter (a late callback of the old run writes nothing), abandons a set produced in this form and not saved, clears the orbit and frees its decoded frames, remembers non-default parameters (Flows → Re-pick). A saved set is only dropped from the form; the work loses it when saved. Does not clear the alert. No confirmation.
- **A11y:** replaced by the picker → focus lost.
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Usuń", exact: true })`.
- **Source:** `work-form.tsx` — `removeArchive`, `abandonUnsavedSet`, `commitR360`

##### `WORK-FORM.r360.hint` — static text

- **Label:** `Works.form.r360.hint` — pl „Klatki powstają tutaj, w Twojej przeglądarce — pierwsza pojawia się w podglądzie po kilku sekundach. Gotowy widok 360° zobaczą goście na Twojej stronie.” · en "The frames are made here, in your own browser — the first appears in the preview within seconds. Visitors get the finished 360° view on your page."
- **Where:** under the picker / orbit row. **Shown:** always.
- **Source:** `WorkForm`

##### `WORK-FORM.r360.preview` — region

- **Where:** under the R360 hint.
- **Shown:** an orbit in the form AND (frames made here exist, or a run reports progress, or the work has a saved set) — i.e. from the successful read on.
- **Does:** see `C-R360-PARAMS`.
- **Tests:** `works.spec.ts` `getByTestId("work-r360-preview")` (`toHaveCount(0)` after a refusal or failure).
- **Source:** `WorkForm` — `previewShown`

##### `WORK-FORM.actions.save` — button (submit)

- **Label:** new `Works.form.save` — pl „Zapisz realizację” · en "Save work"; edit `Works.form.saveChanges` — pl „Zapisz zmiany” · en "Save changes"; busy `Works.form.saving` — pl „Zapisywanie…” · en "Saving…"
- **Where:** actions row, first (solid).
- **Shown:** always.
- **Enabled:** disabled while `busy` = saving OR any tile's photo uploading OR the orbit run working. Not disabled during a second-channel upload or an archive read (F-FORM-1).
- **Does:** form submit → `save()` (Flows → Save).
- **Input:** click; Enter in any text field of the form (name, investor, developer, a cue name) — implicit submission, none while disabled.
- **A11y:** the only `type="submit"` in the form (every `Button` defaults to `type="button"`).
- **Tests:** `works.spec.ts`, `happy-path.spec.ts`, `leave-guard.spec.ts` `getByRole("button", { name: "Zapisz realizację" })`; `works.spec.ts` `getByRole("button", { name: "Zapisz zmiany" })`.
- **Source:** `work-form.tsx` — `busy`, `save`, `performSave`

##### `WORK-FORM.actions.cancel` — button

- **Label:** `Works.form.cancel` — pl „Anuluj” · en "Cancel"
- **Where:** actions row, second (quiet).
- **Enabled:** disabled while saving.
- **Does:** `onCancel` → the host closes the form (new: `setWorkForm(null)`; edit: `closeInPlaceForm` → card back, focus on its „Edytuj” after one animation frame). The unmount discards (Flows → Close). No confirmation (F-FORM-14).
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Anuluj" })`; after it, discard body `{ fileId }`, no POST, empty state `getByText("Jeszcze bez realizacji")`, and in the edit placement `getByRole("button", { name: "Edytuj: …" })` `toBeFocused()`.
- **Source:** `WorkForm` `cancel`; `owner-profile-view.tsx` — `closeInPlaceForm`

##### `WORK-FORM.actions.error` — alert

- **Label:** one message at a time; every key in Flows → Messages.
- **Where:** full-width line under Save/Cancel — for photo, zip and save errors alike.
- **Shown:** when an error is set. Cleared by: a photo pick, a replace pick, a channel pick, removing a channel, removing a photo, a zip pick, and the start of every save. Not cleared by typing, set main, R360 remove/stop, parameter or cue edits.
- **A11y:** `role="alert"`; not linked to any field (F-FORM-10).
- **Tests:** `works.spec.ts` `getByText` of: „Podaj nazwę realizacji.”, „Dodaj przynajmniej jedno zdjęcie.”, „To nie jest archiwum zip.”, „Jedna klatka to nie orbita: potrzeba co najmniej 2.”, „Wybrano 3 zdjęcia, a zmieszczą się 2. Wybierz najwyżej 2.”, „Numery klatek nie tworzą ciągu: orbit/render_0002.png, orbit/render_0004.png.”, „Brak miejsca: klatki przekroczyłyby Twój limit 10 GB.”, „Nazwij każdy punkt na pierścieniu albo go usuń.”
- **Source:** `work-form.tsx` — `error`, `fail`, `uploadFail`

##### `WORK-FORM.handle.settle` — imperative handle

- **Label:** none — `WorkFormHandle.settle(): Promise<"saved" | "closed" | "kept">`.
- **Shown:** the one open form, through `workFormRef`; called by the top bar's „Zapisz” in `OwnerProfileView.toggleEditing`.
- **Does:** Flows → settle().
- **States:** while it waits the top bar shows „Zapisywanie…” disabled (another part).
- **Tests:** `works.spec.ts` "the page's Zapisz waits for the frames, then saves the open form (#85)" and "Zapisz keeps editing when the open form cannot be saved, and closes an untouched one (#85)": `getByRole("button", { name: "Zapisz", exact: true })`, `getByRole("button", { name: "Zapisywanie…" })` `toBeDisabled()`, name `toBeFocused()`, `getByRole("button", { name: "Edytuj profil" })`.
- **Source:** `work-form.tsx` — `useImperativeHandle`, `untouched`, `latest`; `owner-profile-view.tsx` — `toggleEditing`

#### Flows and rules

**Open**

- "+" sets the new form (or clears it if open); „Edytuj” sets the edit form. A new `key` remounts: nothing carries over between opens.
- Initial state (edit): name/investor/developer from the work (`null` → ""); tiles = `work.images` that carry `fileId` (channel included when it carries `fileId`), in saved order; orbit = `work.orbit` (no file name, size 0, the saved `params`, `set: { id: setId }` with no key prefix).
- On mount focus goes to Name.

**Validation timing**

- Nothing is validated while typing or on blur; `maxLength` is the only live constraint (120 name/investor/developer, 40 cue name).
- At pick time: photo type/size (browser), zip structure and file names (browser).
- At save time: the client checks in Flows → Save, then the server re-parses the same `workInputSchema`.

**Photo upload (per file, `addPhoto` + `uploadImage`)**

1. A pending tile appears at once (local preview, progress 0, no controls); a replacement takes the old tile's place and keeps its channel. The cap is re-checked here: a fourth tile is never made (silently).
2. Browser checks, before any request: type not JPEG/PNG/WebP → `file_type`; size 0 or over 10 MiB (`IMAGE_MAX_BYTES`) → `file_size`.
3. Presign (A9 reservation) → PUT with progress → at 100 % the bar shows processing → confirm (server decode, WebP variants, dedupe by content).
4. Result: failure → tile removed (new) or old photo restored (replace) + message (none for an abort); a file id already on another tile → restored + `duplicatePhoto`; a replacement with the same bytes → restored silently; success → tile takes the file id and the 480 px variant, the id joins the form's "unsaved" set; a replaced photo uploaded in this form is discarded.
5. Several files of one pick run in parallel; each failure overwrites the alert, so only the last message stays.
6. Upload messages (`Settings.profile.upload.errors.*`, via `uploadFail`):
   - `file_type` — pl „Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.” · en "That format is not supported — choose JPEG, PNG or WebP."
   - `file_size` — pl „Plik musi mieć od 1 bajta do 10 MB.” · en "The file needs to be between 1 byte and 10 MB."
   - `quota_exceeded` (presign or confirm refused, A9) — pl „Brak miejsca: to zdjęcie przekroczyłoby Twój limit 10 GB.” · en "No space left: this photo would exceed your 10 GB limit."
   - `upload_failed` (PUT failed) — pl „Wysyłka pliku nie powiodła się. Spróbuj ponownie.” · en "The file upload failed. Try again."
   - `not_an_image` — pl „Ten plik nie wygląda na poprawny obraz.” · en "This file does not look like a valid image."
   - `unsupported_format` — pl „Ten format nie jest obsługiwany — wybierz JPEG, PNG lub WebP.” · en "That format is not supported — choose JPEG, PNG or WebP."
   - `too_large` (over 10 MB or 64 megapixels on the server) — pl „Zdjęcie jest za duże (limit 10 MB i 64 megapiksele).” · en "The photo is too large (10 MB and 64 megapixels are the limits)."
   - `not_found` — pl „Plik nie dotarł do magazynu. Spróbuj ponownie.” · en "The file did not reach storage. Try again."
   - `rate_limited` (any 429) — pl „Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.” · en "Too many attempts. Wait a moment and try again."
   - `generic` (network exception, non-JSON answer, 401, 403, `invalid_key`, `invalid_request`) — pl „Coś poszło nie tak. Spróbuj ponownie.” · en "Something went wrong. Try again."
   - `aborted` — no message.

**Photo rules**

- 0–3 tiles (`WORK_PHOTOS_MAX`); position 0 is the main photo (A12, SPEC §9); `imageFileIds` order = tile order.
- 0 tiles is allowed only when the orbit has a set (A12 as amended 09.09.2026); otherwise `Works.form.errors.photoRequired` — pl „Dodaj przynajmniej jedno zdjęcie.” · en "Add at least one photo."
- A second channel belongs to the tile: it survives a replacement of the photo and goes with a removal of the tile. `secondaryFileIds` is sent only if at least one tile has a channel — one entry per tile, `null` where none.
- A file may appear only once across all photos and channels of the work (schema). Caught by the form before save: a new or replacement photo equal to another tile's photo; a channel equal to any tile's photo or another tile's channel. Not caught: a photo equal to an existing channel (F-FORM-4).

**R360 flow (`pickArchive` → `readArchive` → `runFrames` → `produceFrameSet`)**

1. **Pick:** clears the alert; the pick counter advances — the pick made last owns the form, whatever read ends last.
2. **Read, in the browser, nothing sent** (`openZip(fileSource(file))`; no indicator — F-FORM-3):
   - reads the size, the tail (up to 22 + 65,535 bytes), the ZIP64 locator and record when the plain record says so, and the central directory (at most 16 MiB);
   - refusals → `Works.form.r360.refused.{reason}`:
     - `not_a_zip` (under 22 bytes, or no end record) — pl „To nie jest archiwum zip.” · en "This is not a zip archive."
     - `encrypted` (an entry's encryption flag) — pl „Archiwum jest zaszyfrowane. Wyeksportuj je bez hasła.” · en "The archive is encrypted. Export it without a password."
     - `multi_part` (disk numbers not 0) — pl „Archiwum jest podzielone na części. Wyeksportuj je jako jeden plik.” · en "The archive is split into parts. Export it as one file."
     - `corrupt` (a signature or length that disagrees, a directory past the end or over 16 MiB, a ZIP64 marker without its field) — pl „Archiwum jest uszkodzone lub ucięte.” · en "The archive is damaged or cut short."
     - `network` (the local file cannot be read: moved, deleted, not readable — the only case for a cloud-drive file that fails to read; there is no dedicated message) — pl „Nie udało się odczytać archiwum. Spróbuj ponownie.” · en "The archive could not be read. Try again."
   - then the file-name contract (`orderFrames`, the #64 contract): ignored silently — directory records, anything under `__MACOSX`, dot-files and dot-folders, `Thumbs.db`, any other extension; frames = `jpg`, `jpeg`, `png`, `webp` (case-insensitive). Refusals, checked in this order:
     - `unsupported_format` (any `exr`, `tif`, `tiff`, `tga`; `{files}` = up to two names) — pl „Przeglądarka nie pokaże EXR, TIFF ani TGA ({files}). Wyeksportuj JPEG, PNG lub WebP.” · en "A browser cannot show EXR, TIFF or TGA ({files}). Export JPEG, PNG or WebP."
     - `no_frames` (0 frames) — pl „W archiwum nie ma klatek — JPEG, PNG lub WebP.” · en "No frames found in the archive — JPEG, PNG or WebP."
     - `too_few` (1 frame) — pl „Jedna klatka to nie orbita: potrzeba co najmniej 2.” · en "One frame is not an orbit: at least 2 are needed."
     - `too_many` (over 360; `{count}`) — pl „{count} klatek to więcej niż 360, które przyjmuje przeglądarka.” · en "{count} frames is more than the 360 the viewer accepts."
     - `folders` (frames not all at the top level or all in one folder one level deep; `{files}` = two names) — pl „Klatki muszą leżeć bezpośrednio w archiwum albo w jednym folderze ({files}).” · en "The frames must sit directly in the archive or in one folder ({files})."
     - `unnumbered` (a frame without digits in its name; `{files}` = that name) — pl „Klatka bez numeru w nazwie: {files}.” · en "A frame without a number in its name: {files}."
     - `numbering` — the frame number is the last run of digits of the name without its extension, or the first run when the last does not order them; the numbers must form a contiguous range starting at 0 or 1 with no duplicate; `{files}` = the first frame when the range starts above 1, else the two names around the gap or duplicate (the last-run rule's clash) — pl „Numery klatek nie tworzą ciągu: {files}.” · en "The frame numbers do not form a sequence: {files}."
   - `{files}` is joined with ", " and shows the entry path (e.g. `orbit/render_0002.png`).
   - A refusal reserves nothing and leaves the orbit state as it was (the picker stays). A read overtaken by a newer pick is dropped (its refusal text may still show — F-FORM-16).
3. **Run shown:** a previous run still going is aborted; the orbit row appears working with N = frame count; parameters = the remembered ones if their frame count is N, otherwise `defaultR360Params(N)`; the preview (empty, „Wczytywanie klatek…”), ring and parameter controls appear; the preview goes to frame 1.
4. **WebP probe** (`openFrameEncoder`): a pool of frame workers whose probe must answer "WebP" within 10 s, else the page's own thread (`canEncodeWebp`: a 1×1 canvas encoded as `image/webp` must come back as `image/webp`); neither → the run ends with `webp_unsupported` before any request (SPEC §10).
5. **Presign:** `presign-r360-set` with N; the reservation counts N × (1 MiB + 384 KiB) against A9 for 2 h + 5 s × N + 5 min.
6. **Frames, in orbit order:** read the entry (≤ 64 MiB; stored or deflate) → decode (the picture goes to the preview at once; the first frame alone, then up to min(4, cores − 1) at once within a memory budget) → encode 1600 px and 800 px WebP (each must be `image/webp`, non-empty, ≤ 1 MiB / ≤ 384 KiB) → "Klatki" counter +1 → both PUTs queued (6 in the air; making pauses while 16 frames wait) → "Klatki wysłane" +1 when both landed.
7. **Done:** not working; chip „Gotowy”; summary with „Klatki gotowe: N”; parameters stay as the owner set them during the run.
8. **Failure** at steps 4–6: the pipeline abandons the set prefix if one was presigned; the form drops the orbit (row, preview, controls gone; picker back) and shows `Works.form.r360.failed.{failure}`; a stop (abort) shows nothing:
   - `webp_unsupported` — pl „Ta przeglądarka nie koduje WebP. Użyj aktualnego Chrome, Firefoksa, Edge lub Safari.” · en "This browser cannot encode WebP. Use a current Chrome, Firefox, Edge or Safari." (F-FORM-8)
   - `quota_exceeded` (presign refused, A9) — pl „Brak miejsca: klatki przekroczyłyby Twój limit 10 GB.” · en "No space left: the frames would exceed your 10 GB limit."
   - `rate_limited` (429) — pl „Za dużo prób. Odczekaj chwilę i spróbuj ponownie.” · en "Too many attempts. Wait a moment and try again."
   - `presign_failed` (any other presign answer or network error) — pl „Nie udało się przygotować klatek. Spróbuj ponownie.” · en "The frames could not be prepared. Try again."
   - `read_failed` (an entry that cannot be read — including an unsupported compression method, a broken local header, a failed inflate) — pl „Nie udało się odczytać klatki z archiwum.” · en "A frame could not be read from the archive."
   - `encode_failed` (a frame the browser cannot decode or encode) — pl „Nie udało się zdekodować klatki. Wyeksportuj JPEG, PNG lub WebP.” · en "A frame could not be decoded. Export JPEG, PNG or WebP."
   - `frame_too_large` — pl „Klatka jest zbyt szczegółowa, by zmieścić się w limicie. Wyeksportuj mniejsze klatki.” · en "A frame is too detailed to encode within the limit. Export smaller frames."
   - `upload_failed` (a frame PUT failed) — pl „Nie udało się wysłać klatki. Spróbuj ponownie.” · en "A frame failed to upload. Try again."

**Re-pick and remembered parameters (`lastParams`, `commitR360`)**

- The picker is available only while the form holds no orbit: to replace an orbit the owner removes or stops it first.
- Whenever an orbit leaves the form (removed, stopped, refused by the presign, failed) its parameters are remembered — unless they equal the defaults for their count with no cue points.
- A run starts with the remembered parameters (cue points included) if their frame count equals the new zip's; otherwise with the defaults. The memory is never cleared, so a wrong-count zip taken out untouched leaves the earlier parameters in place for the next zip of the right count (A13; tested).
- Parameters changed while a run works are kept when it finishes.

**Stop and remove**

- While working: the bar's × (stop) → `removeArchive`. When ready or saved: „Usuń” → `removeArchive`.
- Effect: run aborted (the pipeline abandons what it presigned), unsaved produced set abandoned, orbit cleared, decoded frames freed, parameters remembered. A run the owner stopped or replaced may return later: its set is abandoned and the form is not touched (#148).

**Save (`save` → `performSave`)**

1. Checks, in order:
   1. any photo or channel uploading, or the orbit working → `Works.form.errors.uploading` — pl „Poczekaj, aż zdjęcia się wgrają.” · en "Wait for the photos to finish uploading."
   2. name blank → `nameRequired`
   3. no tiles and no orbit set → `photoRequired`
   4. orbit set with a cue whose name is blank after trim → `Works.form.errors.cueUnnamed` — pl „Nazwij każdy punkt na pierścieniu albo go usuń.” · en "Name every point on the ring, or remove it."
   5. `workInputSchema.safeParse`; the first issue's top-level path decides: `name` → `nameInvalid`; `imageFileIds` → `duplicatePhoto`; `r360Params` → `Works.form.errors.cueInvalid` — pl „Nazwa punktu zawiera niedozwolone znaki.” · en "A point's name contains characters that are not allowed."; any other path (investor, developer, `secondaryFileIds`, `r360SetId`) → `partyInvalid`.
2. Body = the parsed data: `{ name, investor, developer, imageFileIds, secondaryFileIds?, r360SetId, r360Params }` — texts NFC + trimmed; `r360SetId`/`r360Params` both `null` without an orbit set; `r360Params` = `{ frameCount, direction, framesPerWidth, startFrame, flattening, cues? }` with trimmed cue names, cues in the order they were added.
3. Request: new → `POST /api/works`; edit → `PATCH /api/works/{id}`. The button shows „Zapisywanie…”; Cancel, R360 „Usuń”, parameter controls and cue fields are disabled; photo controls and pickers are not (F-FORM-13).
4. Answers:
   - 429 → `Works.form.errors.rateLimited` — pl „Zbyt wiele zapisów. Odczekaj chwilę i spróbuj ponownie.” · en "Too many saves. Wait a moment and try again."
   - `limit` (10 works, A12) → `Works.form.errors.limit` — pl „Limit {max} realizacji. Usuń jedną, aby dodać nową.” · en "The limit is {max} works. Remove one to add another." (`max` 10)
   - `invalid_image` (a named file is not the owner's confirmed work photo) → `Works.form.errors.invalidImage` — pl „Jedno ze zdjęć nie jest już dostępne. Wgraj je ponownie.” · en "One of the photos is no longer available. Upload it again."
   - `invalid_archive` → `Works.form.errors.invalidArchive` — pl „Archiwum R360 nie jest już dostępne. Wgraj je ponownie.” · en "The R360 archive is no longer available. Upload it again." (never sent — F-FORM-7)
   - `set_expired` (the set's reservation ran out before the save) → `Works.form.errors.framesExpired` — pl „Klatki straciły ważność przed zapisem. Dodaj archiwum ponownie.” · en "The frames ran out of time before the save. Add the archive again."
   - `quota_exceeded` (the frames' real bytes do not fit) → `Settings.profile.upload.errors.quota_exceeded` (photo wording — F-FORM-5)
   - `invalid_set`, `incomplete_set`, `frame_too_large`, `not_webp` → `Works.form.errors.invalidSet` — pl „Klatki archiwum nie są już dostępne. Dodaj archiwum ponownie.” · en "The frames of the archive are no longer available. Add the archive again."
   - anything else (400 `invalid_request`, 401, 403, 404 `not_found`, a non-JSON body, a network error) → `Works.form.errors.generic` — pl „Zapis nie powiódł się. Spróbuj ponownie.” · en "Saving failed. Try again."
   - After any refusal the form stays as it was (a refused set still reads „Gotowy” — F-FORM-18).
5. Success: the unsaved set is emptied (nothing will be discarded), the set's key prefix is forgotten (not abandoned), `onSaved()` → host closes the form and refreshes.
6. One save at a time: a call while one is in flight returns that same promise (the top bar's „Zapisz” joins the form's own).

**Close (unmount) — whatever closes the form**

- Triggers: „Anuluj”, own save success, "+" again, another work's „Edytuj”, `settle()` "closed", editing ended (top bar, leave guard), client navigation away.
- Effects: marks the form closed; aborts the frame run (the pipeline abandons its prefix); abandons a produced, unsaved set; aborts photo and channel uploads (aborted before or during the PUT → the PUT is skipped or cut and the staging key abandoned; a confirm already under way completes and its file is discarded on arrival); revokes local object URLs; frees decoded frames; discards every confirmed, unsaved file (`POST /api/uploads/discard`). The work's saved photos and set are untouched.
- A zip still being read when the form closes is not stopped (F-FORM-2).
- Page unload (reload, closing the tab) runs none of this — the cleanup lives only in the unmount effect; the form has no `pagehide`/`beforeunload` handler (UNVERIFIED that no request leaves). While editing, the leave guard (#83) asks first. A staged photo or an unfinished set is bounded by its reservation window and, for sets, the collector (SPEC §9, §10); a photo already confirmed stays on the owner's quota (F-FORM-25).

**settle() (the top bar's „Zapisz”, #85)**

1. Waits until no tracked pick is in flight — photo picks, replace picks, channel picks and zip picks (the whole read and frame run) — looping while new ones start.
2. The form closed meanwhile → `"closed"`.
3. Untouched → `"closed"` (the host then removes the form). Untouched = new form: name, investor, developer blank after trim, no tiles, no orbit set; edit form: trimmed texts equal the work's, the same photo/channel ids in the same order, the same set id, and the same parameters (JSON equality; adding and removing a cue again counts as untouched).
4. Otherwise `save()`: success → `"saved"` (the form already closed itself through `onSaved`); failure but the form closed meanwhile → `"closed"`; failure → scrolls the form into view (`block: "nearest"`, smooth — F-FORM-19), focuses Name → `"kept"`; the host keeps the page in editing with the alert on screen.

**Limits and windows**

- Photos: 3 per work, JPEG/PNG/WebP, ≤ 10 MiB, ≤ 64 MP (server); presign URL 120 s, reservation 7 min.
- Works: 10 per profile.
- Frames: 2–360; each frame's WebP ≤ 1 MiB at 1600 px and ≤ 384 KiB at 800 px; a produced set must be saved within 2 h + 5 s × N (+ 5 min) of its presign, or the save answers `set_expired`; the form shows no clock (F-FORM-18).
- Rate limits per minute: presign 20, confirm 15, discard 30, abandon 30, set presign 10, works save/delete 30.

#### Decisions

- `D-FORM-1` — Photos upload the moment they are picked and are named by id at save; whatever the form uploaded and did not save is discarded when it closes, however it closes. Source: `work-form.tsx` header comment (#72: "a photo uploaded and then abandoned … is discarded so it does not sit on the quota"), unmount comment ("however the form went away", #80 review).
- `D-FORM-2` — One picker for several files, all or none: a pick of more than fit uploads nothing and says so. Source: #79, #93; `pickPhotos` comment ("the form does not quietly take part of it").
- `D-FORM-3` — The photo picker allows many files only while two or more places are free. Source: `work-form.tsx` comment ("The web cannot tell a phone's picker 'at most N'").
- `D-FORM-4` — A replacement takes its tile's place (a replaced main stays main) and keeps the tile's second channel. Source: `replacePhoto` comment; `addPhoto` comment (#99: "the channel is the tile's, not the picture's"); e2e #99 test.
- `D-FORM-5` — Identical bytes are one photo: a duplicate is refused with a message, a photo replaced by itself changes nothing. Source: `addPhoto` comment ("a photo picked twice is one photo, not two tiles").
- `D-FORM-6` — A tile's controls sit under the picture, not on it; only the upload bar stays on the picture. Source: #95, comment in the tile markup.
- `D-FORM-7` — A preview that does not decode falls back to the local file, else a neutral „Bez podglądu” tile instead of a broken-image icon. Source: #79, `Slot.broken` comment.
- `D-FORM-8` — A work with an R360 set needs no photo; its start frame is the main picture. Source: A12 (decision of 09.09.2026), #104, `performSave` comment.
- `D-FORM-9` — The zip is opened only in the owner's browser and never sent; a zip the reader refuses is refused before any request. Source: A13, #120, #101; `readArchive` comment.
- `D-FORM-10` — A browser whose canvas encodes no WebP is told so before a set is presigned, so no reservation is taken. Source: SPEC §10 rows "R360 frames are encoded by the owner's browser" and "Safari's canvas encodes no WebP"; `runFrames` comment.
- `D-FORM-11` — A new zip with the frame count of the orbit last taken out keeps its parameters and cue points; another count starts from the defaults; untouched defaults are not remembered, so a wrong zip taken out untouched wipes nothing. Source: A13; Dawid 11.09.2026 (`runFrames` comment); `lastParams` comment (#107 follow-up).
- `D-FORM-12` — The zip picked last owns the form; a run the owner stopped or replaced returns in its own time, abandons its set and leaves the form alone. Source: #148; `pickArchive` comment (#107 follow-up review).
- `D-FORM-13` — The progress is frames only — made and landed, one bar and two counters — because there is no archive transfer any more. Source: #120 comments in `framesFraction` and the stage list.
- `D-FORM-14` — The preview appears as soon as frames are coming, and a frame is shown at decode time, before its WebPs exist. Source: #121 (`showFrame` comment), #117 (`previewShown` comment, "caught by e2e").
- `D-FORM-15` — An unnamed cue point is refused by the form with its own message instead of an unexplained schema refusal. Source: #107, `performSave` comment.
- `D-FORM-16` — The page's „Zapisz” settles an open form: waits for uploads, closes an untouched form, saves a savable one, keeps an unsavable one on screen with its reason and stays in editing. Source: #85, `WorkFormHandle` doc comment.
- `D-FORM-17` — One save at a time: a second caller joins the request in flight. Source: #85 review, `saveInFlight` comment.
- `D-FORM-18` — An edited work's form stands where its card was; closing it puts the card back and returns focus to that card's „Edytuj”. Source: #86; `closeInPlaceForm` comment (#86 review); e2e "editing a work puts its form where its card was".
- `D-FORM-19` — A photo whose upload finishes after the form is gone is discarded; discard is best effort ("an orphan set is the quota's problem, not the owner's"). Source: `closed` ref comment, `discardFile` comment.

#### Findings

- `F-FORM-1` — Save is enabled in two waiting states. `busy` counts photo uploads, the frame run and saving, but not a second-channel upload nor an archive read. During a channel upload a press only yields `errors.uploading` („Poczekaj, aż zdjęcia się wgrają.”). During a read (before the orbit row exists) a press with a name and a photo saves the work without the orbit and closes the form — then F-FORM-2 follows. The top bar's „Zapisz” waits for both (`settle` awaits every tracked pick). Evidence: `work-form.tsx` `busy`, `performSave`, `settle`.
- `F-FORM-2` — A zip read that ends after the form closed starts a full frame run nobody sees: WebP probe, `presign-r360-set` (reservation), every frame encoded and PUT, and only then `abandon`. `pickArchive` checks `pick !== picks.current` after `readArchive` but not `closed.current`, and the unmount cleanup aborts `framesAbort.current`, which is still `null` during a read. Reachable by „Anuluj”, "+", another „Edytuj” or a save during a slow read (a cloud-drive zip, #147 comment). Evidence: `pickArchive`, unmount effect in `WorkForm`, `runFrames` (`live()` guards only callbacks).
- `F-FORM-3` — The archive read has no progress bar, status or busy state: the form looks idle until the read ends, which the code itself calls "a long wait for one picked from a cloud drive (#147)". A13: "Every stage of the owner's flow has a progress bar." (The save stage too has only the button's „Zapisywanie…”.) Evidence: `pickArchive` sets no state before `await readArchive`.
- `F-FORM-4` — A photo (new or replacement) whose bytes equal an existing second channel is not caught by the form (`addPhoto` checks tile photos only); the schema then refuses on `secondaryFileIds`, which `performSave` maps to `partyInvalid` („Tekst jest za długi albo zawiera niedozwolone znaki.”) — a message about the investor/developer text. When that channel was uploaded in this form, removing the duplicate tile afterwards discards (`discard` → `discardWorkFile` frees it, no work names it yet) the file the other tile still uses as its channel, and the next save fails with `invalidImage`. Evidence: `addPhoto` (`elsewhere`), `performSave` path mapping, `work-schemas.ts` last `refine`.
- `F-FORM-5` — A quota refusal at save comes only from the frame set (`verifyFrameSet` → `FrameSetError("quota_exceeded")`), but the form shows the photo message „Brak miejsca: to zdjęcie przekroczyłoby Twój limit 10 GB.”; the frames' own `r360.failed.quota_exceeded` („…klatki przekroczyłyby…”) exists. Evidence: `performSave` `uploadFail("quota_exceeded")`; `src/lib/r360/frame-set.ts` `verifyFrameSet`.
- `F-FORM-6` — Upload wording where frames are being made: `errors.uploading` („Poczekaj, aż zdjęcia się wgrają.”) is also the answer when the orbit run is working, while `errors.framesUploading` („Poczekaj, aż klatki się przygotują.”) is unused; the frames bar's value text is „Wysyłanie {percent}%” and its stop button „Przerwij wysyłanie” although it also stops encoding. Evidence: `performSave` first check; `UploadProgress` shared copy.
- `F-FORM-7` — Dead or unreachable copy and codes: unused `Works.form.r360.frames`, `Works.form.errors.framesUploading`, `Works.form.r360.failed.resume`, `Settings.profile.upload.errors.archive_type` / `archive_size` (and `UploadFailure` members `archive_type`/`archive_size` that nothing returns); unreachable `Works.form.r360.refused.expired` (only `urlSource` throws `http`, and the form uses `fileSource`), `Works.form.r360.refused.unsupported_method` (`openZip` never checks methods; an unsupported method surfaces per entry as `failed.read_failed`, after the presign), `Works.form.errors.invalidArchive` (`WorksError` declares `invalid_archive`, nothing throws it). Evidence: grep of `src/`; `zipRefusal`; `zip-reader.ts` `readEntry`; `works.ts` `WorksError`. May be deliberate leftovers of #105/#120.
- `F-FORM-8` — `r360.failed.webp_unsupported` tells the owner to use „…Edge lub Safari” / "…Edge or Safari", while SPEC §10 says Safari's canvas encodes no WebP and that the form "tells the owner which browsers work". Evidence: `messages/pl.json`, `messages/en.json`; SPEC §10.
- `F-FORM-9` — The photo copy ignores the "0–3 with an orbit" rule of A12: `photos.rule` says „od 1 do 3” and the empty add tile shows „wymagane” even when an orbit set is attached and no photo is required. Evidence: `WorkForm` photos header and add tile; `performSave` `photoRequired` condition.
- `F-FORM-10` — Errors are not tied to fields: no `aria-invalid`, `aria-describedby` or `aria-required` on name/investor/developer or the file inputs; one `role="alert"` line under the buttons. The auth forms, `handle-form.tsx`, the change-password and change-email forms and `owner-profile-view.tsx` (name, headline, bio, places, avatar, cover) link their field errors; the two-factor settings forms (`two-factor-settings.tsx`) do not either. Evidence: `Field`, alert markup.
- `F-FORM-11` — Per-tile controls carry the same accessible name on every tile („Usuń zdjęcie”, „Wymień zdjęcie”, „Ustaw jako główne”, „Dodaj drugi kanał”, „Usuń drugi kanał”, and every photo bar is „Zdjęcia”), and tile images are `alt=""`, so a screen-reader user cannot tell tiles apart. Comparable controls name their object: cue rows „Usuń punkt w klatce {frame}”, card buttons „Edytuj: {name}”. Evidence: tile markup in `WorkForm`; `r360-params.tsx` `CueControls`; `works-gallery.tsx` `WorkCard`.
- `F-FORM-12` — Focus is lost when a pressed control removes itself: set main, remove photo, replace (tile remounts), remove/cancel channel, upload cancel ×, R360 remove and stop, cue remove. Closing the new-work form (save or cancel) returns focus nowhere, whereas the edit form returns it to „Edytuj” (#86 review) and adding a cue moves focus into its field. Evidence: `WorkForm` markup keys/conditions; `owner-profile-view.tsx` `onSaved`/`onCancel` of the new form vs `closeInPlaceForm`.
- `F-FORM-13` — While saving, tile controls (set main, replace, remove, channel add/remove) and all three pickers stay enabled; only Cancel, R360 „Usuń”, parameters and cue fields are disabled. A photo picked during the request that confirms before the answer is wiped from `unsaved` by `unsaved.current.clear()` on success and is never discarded (an orphan on the quota); a photo uploaded in this form and removed during the request may be discarded before the save commits (→ `invalidImage`). Evidence: tile markup (no `disabled`), `performSave` success branch.
- `F-FORM-14` — An open form — even with uploads done or a frame run of minutes in progress — is discarded without asking by „Anuluj”, by "+" pressed again, and by another work's „Edytuj”; leaving the page asks first (#83, whose dialog body warns „Otwarty formularz realizacji i wgrywane pliki przepadną.”). May be deliberate: these are explicit in-page actions. Evidence: `owner-profile-view.tsx` `setWorkForm` calls; `use-leave-guard.ts`.
- `F-FORM-15` — Two progress bars can occupy the same strip of one tile: start a channel upload, then replace the photo (its controls stay visible while only the channel uploads); both bars are `absolute bottom-0`, the channel's covers the photo's and its cancel. Evidence: `WorkForm` tile markup; `pending` keeps `replacing.secondary`.
- `F-FORM-16` — A superseded zip pick still writes its refusal: `readArchive` calls `setError` before `pickArchive` checks `pick !== picks.current`, so a slow first pick refused after a second pick began shows its message beside the second pick's working or ready orbit (the run never clears the alert). Evidence: `readArchive`, `pickArchive`.
- `F-FORM-17` — A second channel cannot be replaced: with a channel present only its remove button renders, so `pickChannel`'s branches for an existing channel (stop one in flight, discard the replaced one, same-bytes no-op) are unreachable. May be deliberate ("#99: the second channel — one file, added or taken away"). Evidence: tile markup, `pickChannel`.
- `F-FORM-18` — After the save refuses the set (`invalidSet` or `framesExpired`, both saying „Dodaj archiwum ponownie.”) the orbit row still reads „Gotowy · Klatki gotowe: N” and a second save repeats the refusal; the owner must find „Usuń” and pick the zip again. Nothing warns before the set's window (2 h + 5 s × N) ends. Evidence: `performSave` error branches leave `r360` unchanged; `frame-set.ts` `frameSetUrlSeconds`.
- `F-FORM-19` — `settle()` "kept" scrolls with `behavior: "smooth"` regardless of `prefers-reduced-motion`; the orbit hand checks reduced motion (`use-orbit.ts`), and there is no global reduced-motion rule in `globals.css`. Evidence: `work-form.tsx` `settle`.
- `F-FORM-20` — Limits are written into copy as literals rather than interpolated from the constants: „od 1 do 3” (`WORK_PHOTOS_MAX`), „10 MB” (`IMAGE_MAX_BYTES`), „10 GB” (`QUOTA_BYTES`; hand-edited when A9 went from 1 GB to 10 GB, #115), „co najmniej 2” / „360” (`R360_MIN_FRAMES` / `R360_MAX_FRAMES`), „64 megapiksele” (`IMAGE_MAX_PIXELS`). May be deliberate for readable copy. Evidence: `messages/*.json` keys named above.
- `F-FORM-25` — A photo or channel confirmed in a form that is then left by a page unload (reload, closed tab, crash) is never discarded: the discard runs only from React's unmount cleanup, and nothing else frees an unreferenced work photo — `freeUnreferenced` is called only by `updateWork`, `deleteWork` and the discard route. The file keeps counting against A9. The leave guard (#83) asks before such an unload while editing, which may be why this was accepted. Evidence: `work-form.tsx` unmount effect; `src/lib/works.ts` `freeUnreferenced` call sites.

### C-R360-PARAMS — orbit preview, parameters and cue points in the work form

- **Screenshots:** `v-work-form--edit-orbit--desktop`, `v-work-form--edit-orbit--phone` (Appendix A)
- **Used by:** `V-WORK-FORM` only, inside `WORK-FORM.r360.preview`. `work-form.tsx` renders the viewer, ring, cue buttons and hint line; `r360-params.tsx` `R360ParamControls` renders the parameters and `CueControls`.
- **Shown:** `owner` · `edit` · both form placements · whenever the preview region is shown (from the successful zip read, for a saved set from mount). Controls are offered while frames are still being made. `desktop`: parameters in two columns (direction | frames per width, start frame | flattening), cue points span both; `phone`: one column. The ring is rendered on `phone` too (no `phone:hidden` here, unlike the public card and lightbox).
- **Props (`R360ParamControls`):** `params` (the form's orbit parameters), `frameInView` (the preview's frame 1..N), `disabled` (= the form is saving), `onChange(partial)` (merged into the form's parameters; a no-op if the orbit left meanwhile).
- **Purpose:** let the owner set the five A13 parameters and the cue points against a live preview of the orbit.
- **Layout (top → bottom):** viewer (16:9) · ring (centred, narrow) · cue buttons (centred, only with cues) · hint + frame count · parameters grid · cue points fieldset.

| Parameter | Control | Range / step | Default `defaultR360Params(N)` | Live effect on the preview |
| --- | --- | --- | --- | --- |
| frame count | read-only „Klatki: N” | 2–360, detected from the zip | N | length of the orbit; max of the frames-per-width slider; bound of start frame and cues |
| direction | two toggle buttons | `1` „Jak w eksporcie” / `-1` „Odwrotnie” | `1` | flips which way a drag, a throw, the arrow and Page keys turn, and which way frames are laid round the ring; decides a half-orbit tie on a ring click; the frame in view does not change |
| frames per picture width | range slider | 1..N, step 1 | `max(1, round(N / 2))` | frames turned by a drag across the full picture width (`round(dx / width × k)`), and a throw's speed; frame in view unchanged |
| start frame | value + „Użyj tej klatki” (takes the frame in view) | 1..N | `1` | the ring's bottom point; Home goes to it, End to the frame opposite; order of cue buttons and cue rows; for a saved set the poster until frames load; the published poster; frame in view unchanged |
| ring flattening | range slider + „Okrąg” | 0.15..1, step 0.01 (shown with 2 decimals); „Okrąg” sets 1 | `1` | the ring's vertical radius = horizontal × value (1 = a circle) |
| cue points | list editor | 0–12, one per frame, name 1–40 | none (`cues` absent) | diamonds on the ring and buttons under the picture |

#### Elements

##### `R360-PARAMS.preview.viewer` — slider (the orbit viewer)

- **Label:** `aria-label` `Works.form.r360.previewLabel` — pl „Podgląd orbity: przeciągnij po obrazie, by go obrócić” · en "Orbit preview: drag across the picture to turn it"; picture `alt` `Works.form.r360.previewAlt` — pl „Klatka orbity” · en "Orbit frame"; value text `Works.orbit.frameOf` — pl „Klatka {frame} z {total}” · en "Frame {frame} of {total}", or `Works.orbit.frameOfShowing` — pl „Klatka {frame} z {total}, w trakcie wczytywania pokazana klatka {shown}” · en "Frame {frame} of {total}, showing frame {shown} while it loads"; before any picture: `Works.orbit.loading` — pl „Wczytywanie klatek…” · en "Loading frames…"
- **Where:** top of the preview, 16:9 box.
- **Shown:** with the preview region.
- **Does:** paints the frame in view, or its nearest frame already decoded. Frames made in this form: decoded bitmaps at 800 px painted on a canvas (no network, no object URLs), kept within 128 MB — the far side of a long orbit is dropped and decoded again from the kept 800 px WebP when the orbit turns back to it; a frame the browser cannot decode is skipped (its neighbour shows). A saved set with no new pick: its published 800 px frames loaded as a visitor's are (whole set, coarse frames first, #123), poster = the start frame's 800 px file (eager).
- **States:** loading (text), poster (saved set), canvas; frame in view = 1 at the start of every run; for a saved set the start frame at mount; a count change keeps the frame within N.
- **Input:** `mouse`/`touch`: horizontal drag, relative to where it started, 6 px slop, wraps; release while moving coasts (not under `reduced-motion`); vertical pan stays the page's (`touch-action: pan-y`). `keyboard`: ← ↓ / → ↑ one frame (by direction), PageUp/PageDown a twelfth of the orbit (≥ 1), Home start frame, End the opposite frame. A grab or key ends a travel.
- **A11y:** `role="slider"`, `tabIndex=0`, `aria-valuemin=1`, `aria-valuemax=N`, `aria-valuenow`, `aria-valuetext`, `aria-orientation="horizontal"`; canvas `role="img"`.
- **Tests:** `works.spec.ts` `getByTestId("orbit-viewer")` (`data-frame` 1 → 2 after a half-width drag at k = 2; `data-frame` "3" for a saved set with start frame 3; focus + `ArrowRight` → 4), `viewer.getByTestId("orbit-canvas")` visible, `viewer.locator("img")` `toHaveCount(0)`; axe `expectNoAxeViolations(…, "work-form-r360-preview")`.
- **Source:** `work-form.tsx` — `preview`, `keepFrame`, `showFrame`, recovery effect; `src/components/ui/orbit-viewer.tsx` — `OrbitViewer`; `use-orbit.ts` — `useOrbit` (shared component, specified in the orbit part)

##### `R360-PARAMS.preview.ring` — dial (gesture)

- **Label:** none (hidden from assistive technology); counter under it `Works.orbit.counter` — pl „{frame} / {total}” · en "{frame} / {total}"
- **Where:** under the viewer, centred, `w-48`, light tone.
- **Shown:** with the preview region, on `desktop` and `phone`.
- **Does:** ellipse flattened by the flattening value, start frame at the bottom, a dot at the frame in view; the thicker arc = frames made in this form (a count that only grows) or, for a saved set, frames loaded; cue diamonds, a cue's name beside its marker only while it is pointed at (mouse on the marker or its button, or the button focused from the keyboard). Click/tap on the band travels the shorter arc (`reduced-motion` jumps); a drag on the band follows the pointer; a click on a marker goes to its cue. Labels are kept inside the page width (no `data-orbit-bounds` ancestor here).
- **A11y:** `aria-hidden="true"`; the viewer and cue buttons are the accessible way.
- **Tests:** `works.spec.ts` `getByTestId("orbit-ring-loaded")` `toHaveAttribute("d", /^M[^M]*L[^M]*L[^M]*$/)` (one arc for three frames). The ring on `phone` in the form: no test.
- **Source:** `work-form.tsx` — `OrbitRing` props (`loaded`, `flattening`, `cues`, `cuePreview`); `src/components/ui/orbit-ring.tsx`

##### `R360-PARAMS.preview.cue-buttons` — button list

- **Label:** list `aria-label` `Works.form.r360.previewCues` — pl „Punkty w podglądzie” · en "Points in the preview"; each button = the cue's name, or `Works.form.r360.cueFrame` — pl „Klatka {frame}” · en "Frame {frame}" while unnamed
- **Where:** under the ring, centred.
- **Shown:** at least one cue.
- **Does:** a press travels the orbit to the cue's frame; the button of the cue in view is marked; `mouse` hover or keyboard focus lights its ring marker and shows its name there (touch: press only).
- **A11y:** `aria-current="true"` on the cue in view; `type="button"`.
- **Tests:** `works.spec.ts` `getByTestId("work-r360-preview").getByRole("list", { name: "Punkty w podglądzie" }).getByRole("button")` `toHaveText(["Front", "Klatka 4"])`, then `["Front", "Taras"]`; axe `"work-form-r360-cues"`.
- **Source:** `work-form.tsx` — `previewCues`; `src/components/ui/orbit-cues.tsx` — `OrbitCueButtons`

##### `R360-PARAMS.preview.hint` — status line

- **Label:** `Works.form.r360.previewHint` — pl „Przeciągnij po obrazie, by obrócić budynek.” · en "Drag across the picture to turn the building." + „ · ” + `Works.form.r360.paramFrameCount` — pl „Klatki” · en "Frames" + „: {N}”
- **Where:** under the cue buttons.
- **Does:** shows the detected frame count (the one parameter the owner cannot set).
- **Tests:** `works.spec.ts` `getByTestId("work-r360-frame-count")` `toHaveText("Klatki: 3")` / `"Klatki: 4"`.
- **Source:** `WorkForm`

##### `R360-PARAMS.params.direction` — toggle buttons (two)

- **Label:** legend `Works.form.r360.paramDirection` — pl „Kierunek” · en "Direction"; buttons `Works.form.r360.directionForward` — pl „Jak w eksporcie” · en "As exported" (`1`) and `Works.form.r360.directionReverse` — pl „Odwrotnie” · en "Reversed" (`-1`)
- **Where:** parameters grid, first cell.
- **Enabled:** disabled while saving.
- **Does:** sets `direction`; the pressed one is solid, the other quiet; pressing the active one changes nothing.
- **A11y:** `fieldset` + `legend`; `aria-pressed` on each button; no hint text.
- **Tests:** none.
- **Source:** `r360-params.tsx` — `R360ParamControls`, `TwoWayParam`

##### `R360-PARAMS.params.frames-per-width` — slider

- **Label:** `<label for>` `Works.form.r360.paramFramesPerWidth` — pl „Klatek na szerokość obrazu” · en "Frames per picture width", then „: {value}”
- **Where:** parameters grid, second cell.
- **Enabled:** disabled while saving.
- **Does:** sets `framesPerWidth` on every input event.
- **Input:** native range, min 1, max N, step 1 (arrow keys ±1).
- **A11y:** name = the label only; `aria-describedby` → the shown value; not live.
- **Tests:** `works.spec.ts` `getByTestId("work-r360-frames-per-width")` `toHaveValue("2")` (saved 4-frame set).
- **Source:** `r360-params.tsx` — `RangeParam`

##### `R360-PARAMS.params.start-frame` — status line (live)

- **Label:** `Works.form.r360.paramStartFrame` — pl „Klatka startowa” · en "Start frame" + „: {startFrame}”
- **Where:** parameters grid, third cell, above its button.
- **A11y:** plain text name; only the number is in an `aria-live="polite"` span, so the announcement is the bare number (F-FORM-23).
- **Tests:** `works.spec.ts` `getByTestId("work-r360-start-frame")` `toHaveText("2")` / `"3"` / `"1"`.
- **Source:** `r360-params.tsx` — `ParamLabel`

##### `R360-PARAMS.params.use-this-frame` — button

- **Label:** `Works.form.r360.useThisFrame` — pl „Użyj tej klatki” · en "Use this frame"
- **Where:** under the start-frame value.
- **Enabled:** disabled only while saving (stays enabled when the start frame already equals the frame in view).
- **Does:** `startFrame = frameInView`. There is no other way to set the start frame (no field, no slider).
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Użyj tej klatki" })`.
- **Source:** `r360-params.tsx` — `R360ParamControls`

##### `R360-PARAMS.params.flattening` — slider

- **Label:** `<label for>` `Works.form.r360.paramFlattening` — pl „Spłaszczenie pierścienia” · en "Ring flattening", then „: {value with 2 decimals}”
- **Where:** parameters grid, fourth cell.
- **Enabled:** disabled while saving.
- **Does:** sets `flattening`; the ring reshapes live.
- **Input:** native range, min 0.15, max 1, step 0.01.
- **A11y:** as frames per width.
- **Tests:** `data-testid="work-r360-flattening"` exists; unused by tests.
- **Source:** `r360-params.tsx` — `RangeParam`

##### `R360-PARAMS.params.circle` — button

- **Label:** `Works.form.r360.flatteningCircle` — pl „Okrąg” · en "Circle"
- **Where:** under the flattening slider.
- **Enabled:** disabled while saving or when flattening is already 1.
- **Does:** `flattening = 1`.
- **A11y:** becomes disabled under the pointer/keyboard after its own press (UNVERIFIED where focus goes).
- **Tests:** none.
- **Source:** `r360-params.tsx` — `R360ParamControls`

##### `R360-PARAMS.cues.group` — fieldset

- **Label:** legend `Works.form.r360.paramCues` — pl „Punkty na pierścieniu” · en "Points on the ring"; hint `Works.form.r360.cuesHint` — pl „Obróć podgląd do wybranej klatki i dodaj w niej punkt. Goście przejdą do niego jednym kliknięciem — na pierścieniu albo przyciskiem pod zdjęciem. Najwyżej {max} punktów.” · en "Turn the preview to a frame and add a point there. Visitors reach it with one click — on the ring, or with a button under the picture. At most {max} points." (`max` 12)
- **Where:** last in the parameters grid, full width.
- **Does:** lists the cues in orbit order from the start frame (`cuesInOrder`), then the add row. The hint is not linked to any control.
- **Tests:** `works.spec.ts` `getByTestId("work-r360-cues")`.
- **Source:** `r360-params.tsx` — `CueControls`

##### `R360-PARAMS.cues.name` — text field (one per cue)

- **Label:** `aria-label` `Works.form.r360.cueLabel` — pl „Klatka {frame}, nazwa punktu” · en "Frame {frame}, name of the point"; visible frame tag before it `Works.form.r360.cueFrame` — pl „Klatka {frame}” · en "Frame {frame}"; placeholder `Works.form.r360.cuePlaceholder` — pl „np. Wejście główne” · en "e.g. Main entrance"
- **Where:** a row per cue: frame tag, field, remove button.
- **Enabled:** disabled while saving.
- **Does:** edits the cue's name; the preview's button and ring label follow at once (blank → „Klatka {frame}”).
- **States:** at save: blank after trim → `Works.form.errors.cueUnnamed`; control/format characters → `Works.form.errors.cueInvalid`; the name is sent trimmed + NFC.
- **Input:** `maxLength` 40; Enter submits the whole work form (= Save).
- **A11y:** focused automatically once, right after its cue is added.
- **Tests:** `works.spec.ts` `form.getByLabel("Klatka 3, nazwa punktu")` `toBeFocused()`, `fill("Front")`; `getByLabel("Klatka 4, nazwa punktu").fill("  Taras ")` → PATCH carries `"Taras"`; `getByLabel(/nazwa punktu/)` `toHaveCount(0)` after a zip of another count; `getByLabel("Klatka 2, nazwa punktu")` `toHaveValue("Taras")` after a same-count re-pick.
- **Source:** `r360-params.tsx` — `CueControls`; `frame-set-shared.ts` — `cueSchema`, `R360_CUE_LABEL_MAX`

##### `R360-PARAMS.cues.remove` — button (one per cue)

- **Label:** visible `Works.form.r360.cueRemove` — pl „Usuń” · en "Remove"; `aria-label` `Works.form.r360.cueRemoveLabel` — pl „Usuń punkt w klatce {frame}” · en "Remove the point at frame {frame}"
- **Where:** end of the cue's row.
- **Enabled:** disabled while saving.
- **Does:** removes the cue; removing the last one removes the `cues` list itself.
- **A11y:** the row unmounts → focus lost (F-FORM-12).
- **Tests:** none.
- **Source:** `r360-params.tsx` — `CueControls` (`commit`)

##### `R360-PARAMS.cues.add` — button

- **Label:** `Works.form.r360.cueAdd` — pl „Dodaj punkt w klatce {frame}” · en "Add a point at frame {frame}" (`frame` = the frame in view; the name changes as the orbit turns)
- **Where:** under the cue list.
- **Enabled:** disabled while saving, when a cue already sits on the frame in view, or when 12 cues exist.
- **Does:** appends `{ frame: frameInView, label: "" }`; its name field takes the focus. No reorder control: order is derived from the start frame; the list is sent in the order cues were added.
- **Tests:** `works.spec.ts` `form.getByRole("button", { name: "Dodaj punkt w klatce 3" })` click, then `toBeDisabled()`; `"Dodaj punkt w klatce 4"` after `ArrowRight` on the viewer.
- **Source:** `r360-params.tsx` — `CueControls`; `frame-set-shared.ts` — `R360_CUES_MAX`

##### `R360-PARAMS.cues.note` — status line

- **Label:** 12 cues: `Works.form.r360.cuesFull` — pl „To już {max} punktów — więcej praca nie pomieści.” · en "That is {max} points — a work holds no more." (takes precedence); a cue on the frame in view: `Works.form.r360.cueTaken` — pl „Ta klatka ma już punkt.” · en "This frame already has a point."
- **Where:** beside the add button.
- **Shown:** when either condition holds.
- **A11y:** plain text, not live, not linked to the disabled button.
- **Tests:** `works.spec.ts` `form.getByText("Ta klatka ma już punkt.")`.
- **Source:** `r360-params.tsx` — `CueControls`

#### Flows and rules

- Parameters belong to the form's orbit from the moment the frame count is known — before any frame exists — and are edited in place (`setParams` merges); the run finishing does not reset them. `disabled` = saving only.
- Any parameter or cue change makes an edit form "touched" for `settle()`; adding a cue and removing it again returns to untouched (`cues` becomes absent, as on a work saved without cues).
- Cue rules: one per frame; at most 12 (`R360_CUES_MAX`); name 1–40 after trim; frame within 1..N; order everywhere = a turn from the start frame (`cuesInOrder`: `(frame − start + 1)` wrapped into 1..N); no "go to" in the editor rows — going to a cue is its preview button or ring marker.
- A zip of another count drops all cues and resets every parameter; a same-count zip restores the remembered ones (`V-WORK-FORM` → Re-pick).
- The server refuses a kept set whose frame count changed (`works.ts` `updateWork` → `invalid_set`); the UI cannot produce that because N is detected.
- The saved set loader stays enabled while no new pick has made frames here; after a new pick the preview never falls back on the saved set (its start frame is another building).

#### Decisions

- `D-FORM-20` — The parameters are offered while the frames are still being made, not only once the set has landed. Source: `R360.params` comment (Dawid, 10.09.2026) and "#103, widened 10.09.2026" comment in `WorkForm`.
- `D-FORM-21` — The owner's preview paints decoded frames onto a canvas, bounded at 128 MB, re-decoding evicted frames from the kept encodings instead of re-reading the zip. Source: #117; SPEC §10 "An orbit is painted from frames kept decoded in memory"; `localEncodings` comment.
- `D-FORM-22` — The ring's arc shows frames MADE, not frames still held in memory, so it fills on long orbits. Source: `localLoaded` comment (Dawid, 10.09.2026: „przy 120 klatkach koło nigdy się nie zapełnia”).
- `D-FORM-23` — The form's preview keeps the ring on phones; the no-ring rule covers the public page only. Source: A13 ("A phone's public page shows no ring at all"); `globals.css` `phone` variant comment ("The public orbit shows no ring there").
- `D-FORM-24` — A cue point is added at the frame in view and named in place, its field taking the focus; one per frame, twelve at most; buttons ordered as a turn from the start frame meets them. Source: #107 (A13, decided 11.09.2026); `CueControls` doc comment; `cues.ts` `cuesInOrder` comment.
- `D-FORM-25` — A slider's name alone is its label and its value its description; the start frame's value is announced as a status when the button changes it. Source: #103 review comments in `RangeParam` and `R360ParamControls`.

#### Findings

- `F-FORM-21` — Stale comments describe controls that no longer exist: the `r360-params.tsx` header still lists "the motion (#153) a two-way toggle like the direction", `TwoWayParam`'s doc names "the motion (#153)" and its `hint`/`testId` props are unused; comments count the owner's parameters as "four" (`R360.params`), "five" (`setParams`) and "five … the sixth, the frame count" (header). There is no motion switch (SPEC A13: taken out 12.09.2026). Evidence: `r360-params.tsx`, `work-form.tsx`, `frame-set-shared.ts` `r360ParamsSchema` comment.
- `F-FORM-22` — Parameters deliberately reset to exactly the defaults (and cues removed) are not remembered when the orbit is taken out, so a same-count re-pick brings back older parameters the owner had undone. May be acceptable: the rule targets untouched defaults of a wrong zip. Evidence: `commitR360` (`!isDefaultR360Params(previous.params)`), `runFrames` `kept`.
- `F-FORM-23` — The start frame's live region contains only the number, so a screen reader hears "2" with no parameter name; „Użyj tej klatki” has no programmatic link to „Klatka startowa”. Evidence: `ParamLabel` (`aria-live` on the value span), `R360ParamControls`.

### C-UPLOAD-PROGRESS — upload progress bar with cancel

- **Used by:** `V-WORK-FORM` — photo tile (compact, label `Works.form.photos.label`), second channel (compact, `Works.form.photos.channel`), R360 frames (full, `Works.form.r360.progressLabel`); owner profile page — avatar (full, `Settings.profile.avatar.change` — pl „Zmień zdjęcie profilowe” · en "Change profile photo") and cover (full, `Settings.profile.cover.change` — pl „Zmień zdjęcie w tle” · en "Change cover photo") in `owner-profile-view.tsx`.
- **Props:** `fraction` 0..1; `label` (the bar's accessible name); `onCancel?` (offers the cancel button); `compact` (inside a tile: white bar on a dark strip, number only); `className`.
- **Derived:** `percent = floor(fraction × 100)` clamped to 0–100; `processing = fraction >= 1` (bytes landed, the server or the pipeline finishing).
- **Purpose:** one look for every upload — a bar while bytes move, then "processing".

#### Elements

##### `UPLOAD-PROGRESS.bar` — progress bar

- **Label:** `aria-label` = `label`; value text `Settings.profile.upload.progress` — pl „Wysyłanie {percent}%” · en "Uploading {percent}%"; processing `Settings.profile.upload.processing` — pl „Przetwarzanie…” · en "Processing…"
- **Where:** flexible width, first in the row (after the hidden status).
- **States:** progress: fill width = percent, 200 ms width transition; processing: fill 100 %, pulsing only under `motion-safe:`. Compact: white fill on a translucent white track; full: action-colour fill on a sunken track.
- **A11y:** `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow=percent` (absent while processing → indeterminate), `aria-valuetext`. Not a live region itself.
- **Tests:** `works.spec.ts` `getByRole("progressbar")` visible during a frame run.
- **Source:** `src/components/ui/upload-progress.tsx` — `UploadProgress`

##### `UPLOAD-PROGRESS.value` — status line (visual)

- **Label:** „{percent}%”; processing: compact "…", full `Settings.profile.upload.processing` „Przetwarzanie…” · "Processing…"
- **Where:** right of the bar, monospace, tabular digits.
- **A11y:** `aria-hidden="true"` (the bar carries the value).
- **Source:** `UploadProgress`

##### `UPLOAD-PROGRESS.announce` — live status (screen reader only)

- **Label:** `label` while `fraction < 1`; `Settings.profile.upload.processing` at 1.
- **Where:** visually hidden, first child.
- **Does:** gives a screen reader the upload's name once and "processing" once — never each percent.
- **A11y:** `role="status"`. UNVERIFIED: whether its initial text is announced when the component mounts already filled.
- **Tests:** none.
- **Source:** `UploadProgress`

##### `UPLOAD-PROGRESS.cancel` — button (icon)

- **Label:** × icon; `aria-label` and `title` `Settings.profile.upload.cancel` — pl „Przerwij wysyłanie” · en "Cancel the upload"
- **Where:** end of the row.
- **Shown:** `onCancel` given and not processing.
- **Does:** calls `onCancel` (work form: abort the photo upload / remove the channel / stop the frame run; profile page: abort avatar or cover upload).
- **Input:** `type="button"`; compact 28 px round dark button, full 32 px round quiet button.
- **A11y:** focus-visible ring; unmounts with the bar → focus lost after use (F-FORM-12).
- **Tests:** `works.spec.ts` `getByRole("button", { name: "Przerwij wysyłanie" })` visible, click (#148).
- **Source:** `UploadProgress`

#### Flows and rules

- The cancel is offered only while bytes can still be stopped; at `fraction >= 1` it disappears and the bar turns indeterminate.
- For photos the fraction is the XHR upload progress, which reaches 1 when the last byte is sent — before the PUT answers, so the cancel disappears then; `onload` sets 1 again on a 2xx; for the frame run it is (encoded + landed) / 2N, which reaches 1 only as the run ends.

#### Decisions

- `D-FORM-26` — One progress look for every upload on the platform (avatar, cover, work photo, R360), with "processing" after the bytes land and a cancel only while they move. Source: #80, `upload-progress.tsx` header comment; `upload-client.ts` `putWithProgress` comment ("'Wysyłanie…' with no number and no way out is not a state to leave an owner in").
- `D-FORM-27` — The bar is announced once at the start and once when the bytes have landed, not every percent. Source: `upload-progress.tsx` comment ("not every percent, which would chatter").

#### Findings

- `F-FORM-24` — The fill's 200 ms width transition runs under `reduced-motion`; only the processing pulse is gated with `motion-safe:`. Minor. Evidence: `UploadProgress` class names.

## 9. Component catalogue and design tokens

### Component catalogue

All files in `src/components/ui`. "Used in" from imports under `src`.

- **`account-menu.tsx` — `AccountMenu`:** C-ACCOUNT-MENU.
- **`avatar.tsx` — `Avatar`:**
  - Round photo or monogram. Props `src?` (string | null), `name` (monogram source), `size?` (128; px fallback), `alt?` (`""`), `className?`.
  - `src` → `<img>` round `object-cover`, `width`/`height` attributes = `size`, displayed side `var(--avatar-size, {size}px)` (profiles set 96 px on phone, 128 px from `sm`). No `src` → `<div>` with `initialsFrom(name)` (`src/lib/monogram.ts`: up to two letters, split on space `.` `_` `+` `-`, first letter of each part, diacritics kept, uppercased `pl-PL`; none → plain disc) on `#e7e5e4`, text `#57534e`, 34 % of the side, semibold.
  - A11y: photo alt from the caller (profiles `PublicProfile.avatarAlt` pl „Zdjęcie profilowe {name}” · en "{name}'s profile photo"; account menu `""`); monogram `aria-hidden`.
  - Used in: AccountMenu (30 px), visitor and owner profile cards.
- **`badge.tsx` — `Badge`:**
  - Pill `<span>`. Props `children`, `uppercase?` (`type-eyebrow`, uppercase; else `type-label`), `tone?` `neutral` (bordered, muted text) · `success` (green on green tint) · `danger` (red on red tint; unused), `className?`. No role.
  - Used in: onboarding step badge (neutral, uppercase); two-factor settings status (success/neutral, uppercase); works gallery R360 badge (success/neutral, uppercase).
- **`button.tsx` — `Button`, `ButtonLink`, `buttonClassName`:**
  - Variants: `solid` (default — near-black fill, white text, darker hover/active) · `quiet` (1 px `--action-quiet-border`, transparent, body text, light hover) · `onPhoto` (white fill, strong text, grey hover/active, inverse focus ring) · `onPhotoQuiet` (55 % white border, transparent, white text, 10 % white hover, inverse ring).
  - Sizes: `md` (default, 40 px `--control-h`) · `lg` (48 px `--control-h-lg`). All: inline-flex, 8 px gap, 16 px side padding, radius 6 px, `type-label`, focus-visible ring, disabled → not-allowed cursor + 50 % opacity.
  - `Button` = `<button>` (`type="button"` unless given; accepts `ref`). `ButtonLink` = next-intl `Link` with the same classes. `buttonClassName(variant, size, className)` styles other elements (work form file-picker labels).
  - A11y: native semantics; no built-in busy state.
  - Used in: `Button` — owner profile (edit toggle `quiet`, cover remove `onPhoto`, add work `quiet`), works gallery, work form, R360 params, leave dialog, onboarding (`lg`), handle form (`lg`), auth and settings forms; `ButtonLink` — homepage bar and hero, visitor profile bar, 404 (`quiet`), verification landing (solid, onboarding link).
- **`card.tsx` — `Card`:**
  - Props `padding?` `none` · `sm` (12 px phone / 16 px from `sm`) · `default` (24 / 32) · `lg` (40 / 48); `tone?` `default` (white) · `sunken` (grey); `as?` element (default `div`); div props. Radius 8 px, hairline border, no shadow.
  - Used in: auth screens and onboarding (`lg`); settings and work form (`default`); profile article and work cards (`none`); owner scope note (`sm`, `sunken`).
- **`channel-reveal.tsx` — `ChannelReveal`:** #100 two-channel reveal slider over a photo (drag, arrow/Page/Home/End keys, axis toggle) — specified in part WORKS.
- **`divider.tsx` — `Divider`:** `<hr>` with hairline top border (implicit separator); `className?`. Used in: settings page sections, two-factor settings, AccountMenu.
- **`empty-state.tsx` — `EmptyState`:** props `icon`, `title`, `body`; centred bordered card (padding 32 px phone / 48 px), 28 px subtle icon (`aria-hidden`), `type-label` title, `type-sm` muted body; no role or heading. Used in: owner works section without works — specified in part PROFILE.
- **`footer.tsx` — `Footer`:** C-FOOTER.
- **`form-field.tsx` — `FormField`:** props `label`, `htmlFor`, `hint?` (node), `hintId?`, `children`; `<label for>` (`type-label`) + control + hint `<p id={hintId}>` (`type-sm` muted), 4 px apart. Does not set `aria-describedby` on the control (callers do); no error slot. Used in: login, register, verification resend, reset request, new password, two-factor challenge, settings password/e-mail/two-factor, onboarding name step.
- **`icon-button.tsx` — `IconButton`:** 36 px square `<button>` with an 18 px Icon; props `icon`, `label` (→ `aria-label`, `title`), `pressed?` (→ `aria-pressed`, solid border + sunken fill). Unused.
- **`icon.tsx` — `Icon`:**
  - Props `name`, `size?` (24), `className?`; 24×24 view box, `currentColor` stroke 1.75, round caps/joins; always `aria-hidden`. Hand-authored Lucide shapes.
  - Names and users: `map-pin-off` (404) · `log-out`, `user`, `settings` (account menu) · `smartphone` (two-factor challenge, settings) · `pencil`, `check` (edit toggle; `check` also verification success) · `mail` (verification failure, two-factor settings) · `folder-open` (owner works empty state) · `camera` (avatar/cover pickers, work form) · `menu` (mobile menu) · `map-pin` (places) · `x` (place chip remove, works gallery, upload cancel) · `plus` (add work, works gallery, work form) · `chevron-left`, `chevron-right` (works gallery, channel reveal) · `chevron-up`, `chevron-down` (channel reveal vertical axis) · `upload` (R360 slot) · `layers` (second channel) · `grip-vertical` (reorder grips).
- **`input.tsx` — `Input`:** `forwardRef` `<input>`; prop `mono?` (IBM Plex Mono). Height 48 px, 16 px side padding, radius 6 px, default border, white; placeholder `--text-subtle`; focus: `--action-solid` border + focus-visible ring; disabled: sunken fill, subtle text. Used in: every form (handle form and two-factor codes `mono`), owner place field, work form, R360 params.
- **`language-chip.tsx` — `LanguageChip`:** C-LANGUAGE-CHIP.
- **`layout.ts` — `measureWidthClass`, `MeasureWidth`:** `"measure-wide"` → `max-w-(--measure-wide)`, `"measure-page"` → `max-w-(--measure-page)`; shared by TopBar and Footer.
- **`logo-mark.tsx` — `LogoMark`; `logo.tsx` — `Logo`; `mark.tsx` — `Mark`:** C-LOGO.
- **`mobile-menu.tsx` — `MobileMenu`:** C-MOBILE-MENU.
- **`orbit-cues.tsx` — `OrbitCueButtons`:** #107 row of R360 cue-point buttons that travel the orbit — specified in part WORKS.
- **`orbit-ring.tsx` — `OrbitRing`:** #106/#107 elliptical ring dial (loaded arc, position dot, cue markers, counter; `aria-hidden`) — specified in part WORKS.
- **`orbit-viewer.tsx` — `OrbitViewer`:** #103/#104/#117 canvas orbit viewer, `role="slider"`, turned by drag and keys — specified in parts WORKS and FORM.
- **`plaque.tsx` — `Plaque`:** C-PLAQUE.
- **`text-link.tsx` — `TextLink`, `textButtonClassName`:** `TextLink` = next-intl `Link`, `type-sm` medium, underline (removed on hover), focus ring, `tone?` `default` (strong) · `muted`. `textButtonClassName(tone, className)` gives a `<button>` the same look plus a disabled style. Used in: auth screens' footer lines and link states, login „Nie pamiętasz hasła?” (`muted`), two-factor back link and verification home link (`muted`), settings current address; class in register, login, two-factor, handle form buttons.
- **`textarea.tsx` — `Textarea`:** `forwardRef` `<textarea>`, Input's look, 12 px vertical padding, vertical resize only. Used in: owner headline and bio — specified in part PROFILE.
- **`top-bar.tsx` — `TopBar`:** C-TOPBAR.
- **`upload-progress.tsx` — `UploadProgress`:** #80 upload bar (percent, then processing, optional cancel; `role="progressbar"` + status line) — specified in parts PROFILE and FORM.
- **`use-dismissable.ts` — `useDismissable`:** C-DISMISSABLE.
- **`use-frame-loader.ts` — `useFrameLoader`:** #104/#117 coarse-to-fine R360 frame loading through one page-wide queue of three — specified in part WORKS.
- **`use-orbit.ts` — `useOrbit`:** #103/#153 orbit state (drag, keys, travel, coast, reduced motion) — specified in part WORKS.
- **`use-reorder.ts` — `useReorder`:** #66 pointer and arrow-key reordering (place chips, work cards) — specified in parts PROFILE and WORKS.

#### Decisions

- `D-SHELL-14` — The no-photo placeholder is one restrained stone palette for everyone, and its share card is square 512 px so it renders like an avatar in chat previews. Source: `src/lib/monogram.ts` comments ("decision of 05.09.2026", WhatsApp observation), #27.

#### Findings

- `F-SHELL-17` — Dead code: `IconButton` is imported nowhere; `Badge` tone `danger` is never passed. Evidence: grep of `src` for `icon-button`/`IconButton` and `tone=`.

### Design tokens

- **Location:** `src/app/globals.css` only; no dark theme. Order: Google Fonts `@import` → `@import "tailwindcss"` → `@custom-variant phone` → `@theme` → `:root` → `@layer components`.
- **Fonts** (`@theme`): `--font-sans` Figtree (fallback Helvetica Neue, Helvetica, Arial); `--font-mono` IBM Plex Mono (addresses, handles, codes); `--font-plaque` Fira Sans Condensed (plaque only). Loaded from `fonts.googleapis.com` (weights Figtree 300–900 + italics, Fira 400/500, Plex Mono 400/500/600). Icons use `public/figtree-bold.ttf`.
- **Colour scales** (`@theme`, generate utilities such as `bg-n-100`): `--color-n-0`, `-25`, `-50`, `-100`, `-150`, `-200`, `-300` … `-900`, `-950`; `--color-plaque-navy`, `-navy-deep`, `-red`, `-hairline`, `-ink`; `--color-state-success`, `-success-bg`, `-danger`, `-danger-bg`, `-warning`, `-warning-bg`, `-info`, `-info-bg`. Bare aliases in `:root`: `--plaque-*`, `--state-*`.
- **Semantic colours** (`:root`, used as `text-(--text-body)`): `--text-strong`, `--text-body`, `--text-muted`, `--text-subtle`, `--text-inverse`, `--text-on-photo`; `--surface-page`, `--surface-card`, `--surface-sunken`, `--surface-inverse`, `--surface-hover`, `--surface-active`; `--border-hairline`, `--border-default`, `--border-strong`, `--border-inverse`; `--action-solid`, `--action-solid-hover`, `--action-solid-active`, `--action-solid-text`, `--action-quiet-border`, `--action-quiet-hover`; `--focus-ring`, `--focus-ring-inverse`; `--scrim-photo`, `--scrim-photo-strong` (pages use inline gradient literals instead).
- **Focus rings:** `--ring-focus` (2 px card-colour gap + 2 px `--focus-ring`), `--ring-focus-inverse` (dark gap + white ring); applied as `focus-visible:shadow-[var(--ring-focus)]` with `outline-none`.
- **Radii:** `--radius-xs` 4 · `-sm` 6 (controls) · `-md` 8 (cards) · `-lg` 12 · `-xl` 20 · `-2xl` 28 · `-full`; aliases `--radius-control`, `--radius-card`, `--radius-panel`, `--radius-avatar`.
- **Shadows:** `--shadow-xs`, `--shadow-sm`, `--shadow-md` (popovers), `--shadow-lift` (dialog), `--shadow-plaque`; `--shadow-none`, `--shadow-inset-hairline`; `--blur-panel`.
- **Spacing** (4 px base; not Tailwind's scale): `--sp-0`, `--sp-1` … `--sp-12`, `--sp-14`, `--sp-16`, `--sp-20`, `--sp-24` = 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128, 160 px; `--card-pad`, `--card-pad-lg`, `--field-gap`, `--stack-gap`, `--section-gap`.
- **Measures:** `--measure-form` 28rem, `--measure-prose` 40rem, `--measure-page` 68rem, `--measure-wide` 78rem.
- **Control heights:** `--control-h` 40 px, `--control-h-lg` 48 px, `--field-h` 48 px, `--field-h-lg` 56 px; `--control-pad-x` 16 px.
- **Type variables:** `--fs-hero` (clamp 2.5–4.25rem), `--fs-display` (clamp 2–3rem), `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-h4`, `--fs-lead`, `--fs-body`, `--fs-sm`, `--fs-xs`, `--fs-micro`; `--lh-tight`, `--lh-snug`, `--lh-heading`, `--lh-body`, `--lh-relaxed`; `--ls-hero`, `--ls-display`, `--ls-heading`, `--ls-body`, `--ls-caps`; `--fw-light` … `--fw-black`; shorthands `--type-hero`, `--type-display`, `--type-h1` … `--type-h4`, `--type-lead`, `--type-body`, `--type-sm`, `--type-label`, `--type-mono`, `--type-eyebrow`.
- **Type classes** (`@layer components`): `.type-hero`, `.type-display`, `.type-h1`, `.type-h2`, `.type-h3`, `.type-h4`, `.type-lead`, `.type-body`, `.type-sm`, `.type-label`, `.type-mono`, `.type-eyebrow` (uppercase, caps tracking). A size utility such as `text-(length:--fs-h2)` overrides a class's size.
- **Variants:** Tailwind defaults (`sm` 40rem, `md` 48rem, `lg` 64rem); custom `phone:` = `(width < 40rem), (pointer: coarse) and (height < 32rem)` — used only in `works-gallery.tsx`.

#### Decisions

- `D-SHELL-15` — Tokens are plain CSS custom properties used through arbitrary-value utilities (`p-(--sp-8)`), leaving Tailwind's numeric spacing and `--text-*` namespaces untouched; the `phone` variant exists for #107 (no ring on a phone's public page). Source: `globals.css` comments; A13.

#### Findings

- `F-SHELL-18` — Fonts load at runtime from Google Fonts (`@import url("https://fonts.googleapis.com/…")`), so every page view sends the visitor's browser to `fonts.googleapis.com`/`fonts.gstatic.com`, a provider outside the EU/EEA that sees the visitor's IP address — §7 "Never: services outside the EU/EEA in the personal-data path". May be deliberate (comment "webfonts served from Google Fonts"); no §7 assessment recorded. Evidence: `globals.css` line 1 comment and `@import`.

## 10. Decisions — index

Every decision in one list; the full statement and its source are in the section named.

| ID | Decision | Section |
| --- | --- | --- |
| `D-SHELL-1` | Polish unprefixed, English under `/en`; locale from the path, then the `NEXT_LOCALE` cookie, then `Accept-Language`; one time zone `Europe/Warsaw`. | §2 |
| `D-SHELL-2` | An old handle answers 301 from the proxy with `Cache-Control: no-store`, query kept, failing open within 1.5 s; the page adds 308s for case variants and for old addresses the proxy missed. | §2 |
| `D-SHELL-3` | `X-Robots-Tag: noindex` on every proxied response outside production, set in one place. | §2 |
| `D-SHELL-4` | Session reads fail closed: unverifiable = signed out on `/` and the 404, `(app)` pages go to `/login`, a profile shows its visitor view; `/settings/profile` stays inside `(app)` as a redirect so a signed-out visitor goes straight to login. | §2 |
| `D-SHELL-5` | The homepage is unreachable once signed in: `/` redirects to the viewer's own profile or `/onboarding`. | §2 |
| `D-SHELL-6` | Only a bar whose actions do not fit a phone collapses into a hamburger: the homepage (chip + two buttons) and the visitor profile (393 px needed vs 328 px on a 360 px screen); other bars keep their row. | §3 |
| `D-SHELL-7` | The edit control is a quiet button with an icon and a label, not a bare pencil; the label carries the state, so no `aria-pressed` ("a toggle whose name changes would read 'Zapisz, pressed'"). | §3 |
| `D-SHELL-8` | The panel is a named `<nav>`, not `role="menu"`, because it holds whatever the bar shows (links, buttons, a nested chip); it closes on a link click, not on the chip's button. | §3 |
| `D-SHELL-9` | Collapsed, the chip shows only the current language (drawn flags, not emoji) and opens to the list; it is the product's only switcher (no footer switcher). | §3 |
| `D-SHELL-10` | The logo above the auth cards is not a link ("a visitor part-way through making an account is not offered a way out of the view", #66); in bars it leads to the hero for a signed-out visitor and to the viewer's own profile once signed in. | §3 |
| `D-SHELL-11` | The plaque keeps the name on one line at any length (size derived from length, overrun clipped) with fixed 16 px side padding. | §3 |
| `D-SHELL-12` | Hero: the photo is decorative and the scrim gradient sits on an ancestor of the text so axe can evaluate it (worst case measured 5.6:1 at the bar, 9.4:1 at the hero text; axe exception scoped to these pages); crop set per shape so the street plaque stays in frame; `svh` height so the CTAs clear the address bar; CTAs stacked full width and the heading one size down below `sm`. | §4 |
| `D-SHELL-13` | Two panels (photo beside text) from `sm`; below `sm` they stack, the photo becoming a banner above the full-width text panel, because two 155 px columns on a 390 px phone broke the heading and button; `svh` height. | §4 |
| `D-SHELL-14` | The no-photo placeholder is one restrained stone palette for everyone, and its share card is square 512 px so it renders like an avatar in chat previews. | §9 |
| `D-SHELL-15` | Tokens are plain CSS custom properties used through arbitrary-value utilities (`p-(--sp-8)`), leaving Tailwind's numeric spacing and `--text-*` namespaces untouched; the `phone` variant exists for #107 (no ring on a phone's public page). | §9 |
| `D-AUTH-1` | The seven screens are one shell, and the phone pass lives in `shell.ts` constants instead of per-page class strings, "so a screen that drifts out of the family is then a visible import change". | §5 |
| `D-AUTH-2` | Frame height uses `svh`, not `vh`: mobile Chrome sizes `vh` with the address bar hidden, so these short pages scrolled "a bar's worth with nothing underneath". | §5 |
| `D-AUTH-3` | Below `sm` buttons get a 48px minimum height because the 40px control is "four short of the 44px a thumb expects"; from `sm` the 40px control returns. | §5 |
| `D-AUTH-4` | Below `sm` the heading size, column gap and card padding each step down one stop (2rem → 1.375rem, 20 → 16px, 48 → 40px), and the gutters drop from 24px to 16px to match the top bar. | §5 |
| `D-AUTH-5` | The "sent to {email}" line may break inside the address: a 53-character address painted past the card on a 360px phone and scrolled the whole page sideways. | §5 |
| `D-AUTH-6` | The logo above the card is not a link and not focusable: "a visitor part-way through making an account is not offered a way out of the view". | §5 |
| `D-AUTH-7` | Login checks only that a password was typed ("the stored password decides, not the form"). | §5 |
| `D-AUTH-8` | Addresses are trimmed and lowercased before validation, so "what a form submits is exactly what the server stores"; passwords are never trimmed ("leading/trailing spaces are legal characters"). | §5 |
| `D-AUTH-9` | Every successful login, with or without a second factor, lands on `/onboarding`, the one step between login and the app; it forwards a user who already has a handle to their profile. | §5 |
| `D-AUTH-10` | The login form, not the auth client, performs the 2FA redirect "so it routes through the locale-aware next-intl router", and carries the offered methods in the URL so the challenge renders them server-side ("Not sensitive, and the server enforces what it accepts regardless"). | §5 |
| `D-AUTH-11` | A resend outcome is reset whenever its context changes (a new submit, a new target, a failed validation), so a stale "sent" never describes another attempt. | §5 |
| `D-AUTH-12` | Sign-in keeps Better Auth's built-in 3 attempts per 10 s per IP; the e2e helper waits the window out rather than loosening it ("The limit is deliberate product behaviour"). | §5 |
| `D-AUTH-13` | A wrong password fails before any other state is revealed, so the login never tells whether 2FA is on. | §5 |
| `D-AUTH-14` | Passwords: 8–128 characters with no composition rules; one pair of constants feeds the form and the server "so the server edge can never drift from the form". | §5 |
| `D-AUTH-15` | Registration sends an empty `name`: it used to hold the e-mail local part, which "became the display name and the proposed address, publishing the account's own address on a public page"; the real name is asked for in onboarding. | §5 |
| `D-AUTH-16` | "Sent"/"done" confirmations mean only "request accepted": sign-up, the verification resend and the reset request answer the same for known and unknown addresses (enumeration protection), and delivery runs off the response path so timing does not reveal existence either. | §5 |
| `D-AUTH-17` | Sign-up is capped at 10 per hour per IP (higher than the other senders because "a shared IP … may hold several genuine sign-ups in a day") and the verification resend at 3 per hour (the library's own rule was 3 per minute, "far looser than the criterion"). | §5 |
| `D-AUTH-18` | The landing reads only the redirect's `?error`: none → success, `TOKEN_EXPIRED` → its own "expired" copy, every other code → "invalid"; both failure states offer a resend of a fresh link. | §5 |
| `D-AUTH-19` | The medallion is "the one place this monochrome system saturates, so the medallion carries the outcome before the heading is read"; it is decorative and the heading says the same in words. | §5 |
| `D-AUTH-20` | Reset requests are capped at 3 per hour per IP, mirroring the A1 resend cap, because the library's 3 per minute "would still let one IP flood a mailbox with 180 messages an hour"; the copy names the limit and the sent copy is conditional (D-AUTH-16). | §5 |
| `D-AUTH-21` | The link is valid 60 minutes and works once; a token that dies between opening the page and submitting swaps the form for "request a new link", because "only a fresh link can help". | §5 |
| `D-AUTH-22` | A completed reset revokes every session of the account ("the old password may be in someone else's hands"; A3 is silent on sessions) and first cancels any pending e-mail change, because the change notice advises a reset as the recovery action. | §5 |
| `D-AUTH-23` | Two second factors: e-mail codes ("the easy default … zero setup") and an authenticator app with backup codes ("the stronger option that also survives a compromised mailbox"). | §5 |
| `D-AUTH-24` | Modes come from the URL; backup codes "ride on `totp`" because they are issued only with an authenticator; an absent list offers every way "and let[s] the server reject what does not apply". | §5 |
| `D-AUTH-25` | „Kod zapasowy” is styled as a text link, not a pill: backup "reads as a lightweight fallback, not a co-equal choice", with the same button semantics and click handler. | §5 |
| `D-AUTH-26` | Guessing limits differ by method and are not to be loosened without a per-account cap for e-mail codes: authenticator/backup — per-account lockout (10 failures → 15 min) plus 5 per challenge; e-mail code — 5 guesses per code, ~3 min lifetime, sender capped at 20 per hour per IP because "every login of an e-mail-OTP account sends a code". | §5 |
| `D-AUTH-27` | The change is two-step and the landing tells the steps apart only by query: the old address approves first, so "a stolen session alone cannot move the account"; the server appends `status=done` to the step-2 link "so the page says 'changed', not the approval step's 'check your new inbox'"; one pending-change record per user gates both links, so a newer request or a password reset kills older links. | §5 |
| `D-ACCOUNT-1` | Every `(app)` page (onboarding, settings) is gated server-side and fails closed: a session that cannot be verified, including an environment with no database, counts as signed out and lands on the login page. | §6 |
| `D-ACCOUNT-2` | Onboarding is its own page between login and the app, not a settings section; a user who already has a handle is forwarded to the profile; a successful claim goes straight to the new profile page because name and photo are edited there. | §6 |
| `D-ACCOUNT-3` | Two steps, name first: step one cannot be left without a name, the address proposal is derived from it, and the name travels with the address claim so the profile row is created carrying it; a later address change never sends a name. | §6 |
| `D-ACCOUNT-4` | Card and plaque sit side by side and centred only from `md`; below it they stack top-aligned (a centred flex item that overflows loses its top edge, making the badge and heading unreachable); height uses `svh` not `vh` (mobile Chrome's address bar); step headings drop to the h2 size below `sm` so each stays on one line. | §6 |
| `D-ACCOUNT-5` | The A5 rules run in the browser first, with the same schema the server enforces; only a value that passes asks the server whether it is free, debounced per keystroke; a check still in flight, or one that failed, does not disable the submit — the server is the final judge. | §6 |
| `D-ACCOUNT-6` | The field holds only the handle, lowercased as typed (trimming is left to the server so a space mid-typing is not fought). | §6 |
| `D-ACCOUNT-7` | A6/A10: the first assignment is free; a change locks the next one for 30 days, keeps the old address redirecting until someone claims it, and sends a notice e-mail (best-effort — the change stands if delivery fails). | §6 |
| `D-ACCOUNT-8` | Both handle endpoints need a session and are limited per user — availability 60/min ("taken or free" is an enumeration oracle), claim 10/min — and the claim refuses cross-site requests. | §6 |
| `D-ACCOUNT-9` | The address section comes first — the address is the point of the product and the rest of the page protects it; it moved here when #58 folded the profile-settings screen away and kept its `Settings.profile.handle.*` keys; the current-address line links to the live profile so the owner sees exactly what a visitor sees; an account without a handle opens the form on `suggestHandle`'s proposal — onboarding's server fallback, not the name-derived proposal onboarding makes since #36. | §6 |
| `D-ACCOUNT-10` | Password change: the browser checks only that a current password was typed (the stored password decides, as at login); a change signs out every other device while this session continues on a fresh token; a confirmation e-mail goes to the account address. | §6 |
| `D-ACCOUNT-11` | E-mail change needs the current mailbox's approval before the new address is verified, so a stolen session alone cannot move the account; the request answers 200 whether or not the address is free (enumeration protection), so the UI can only say "request accepted". | §6 |
| `D-ACCOUNT-12` | Two-factor is opt-in with both methods: e-mail codes (the easy default, nothing to install) and an authenticator app with backup codes (survives a compromised mailbox), the app confirmed by a code; turning a method on and turning two-factor off re-authenticate with the password, while the confirming code („Aktywuj”) needs only the session; after activation the backup codes stay on screen until „Gotowe”, because refreshing to the on view would wipe the only copy. | §6 |
| `D-ACCOUNT-13` | Kept only as a redirect since #58 folded the screen away (name and photo are edited on the owner's profile, the address moved to account settings), so bookmarks and old e-mails land somewhere; left inside `(app)` so a signed-out visitor goes to login instead of bouncing through a settings address. | §6 |
| `D-PROFILE-1` | The owner check fails closed: a session that cannot be verified (including a preview with no database) renders the visitor view, never the owner's. | §7 |
| `D-PROFILE-2` | One profile, one URL: a case/whitespace variant and an old handle whose proxy lookup failed open answer 308 from the page (a page cannot emit 301), keeping the query; a missing `DATABASE_URL` reads as 404 but every other failure stays a 500. | §7 |
| `D-PROFILE-3` | Sections are optional and absent when empty (no heading, no placeholder); visitor and owner out of edit mode render them with the same components so they cannot drift; the cover is a CSS 3:1 centre crop over variants that keep their aspect (480/1600); the bio keeps line breaks and renders no markup. | §7 |
| `D-PROFILE-4` | Below `sm` the avatar stacks above the name and steps down to 96 px: a 128 px avatar and a display-size name cannot share the 248 px a 360 px phone leaves inside the card. | §7 |
| `D-PROFILE-5` | No photo → monogram in one stone palette for everyone (no per-handle hue), ≤ 2 initials, diacritics kept; the share image is the same monogram, square 512×512, so both look alike in a chat tile. | §7 |
| `D-PROFILE-6` | Head: og:title names the person, not the product; description and og:description use the headline when there is one; og:image is the 512 avatar else the monogram card with the avatar alt; noindex is a response header outside production, set in one place so no route can forget it. | §7 |
| `D-PROFILE-7` | The edit control is a quiet button with an icon AND a label that names what it does now („Edytuj profil” → „Zapisz”), not a bare pencil, and carries no `aria-pressed` (a toggle whose name changes would read "Zapisz, pressed"). | §7 |
| `D-PROFILE-8` | Profile editing happens in place on the public page; each field saves itself when it is left and is public at once (no draft/published state); while editing, the fields on screen are the truth and no refresh follows a field save — a refresh per field raced the next field and a stale server copy wiped optimistic changes — with one refresh when editing ends. | §7 |
| `D-PROFILE-9` | A photo change refreshes the page at once because its URLs exist only on the server; bytes go from the browser straight to storage by a presigned PUT and never through the app; type and size are refused in the browser before any request (keeps the presign rate limit for uploads that can succeed); every upload shows one progress look, announced at start and at "processing" only, with cancel only while bytes move. | §7 |
| `D-PROFILE-10` | Places: free text is allowed beside TERYT suggestions; suggestions are searched on the server (the registers are 100 000 rows) 250 ms after typing pauses, from 2 characters, 10 at most, excluding chips already chosen; Tab adds like Enter and the return key reads "done", because a phone keyboard offers "next" (= Tab) where a desktop offers Enter; a duplicate (ignoring case) is refused with a reason; the order of places is the array itself, saved like an add. | §7 |
| `D-PROFILE-11` | Reordering uses pointer events rather than HTML5 drag-and-drop (`dragstart` never fires on touch), and the same grip answers the arrow keys one step per press with no grab mode; focus follows the moved item. | §7 |
| `D-PROFILE-12` | The works order is sent once the moving stops (300 ms), not per move (arrow-key repeat would fire concurrent requests committed in arbitrary order and hit the rate limit); a refused order is repaired by the server's own answer (refresh), never by a local snapshot that could resurrect a work deleted in another tab. | §7 |
| `D-PROFILE-13` | A text counter turns to a warning at 90 % of the limit and only then becomes a polite live region, so a screen reader is not read every keystroke's count. | §7 |
| `D-PROFILE-14` | „Zapisz” settles an open work form instead of closing it over its uploads: it waits, closes an untouched form, saves a filled one, or keeps editing with the form's reason on screen; an edited work's form stands where its card was and focus returns to that card's „Edytuj”. | §7 |
| `D-PROFILE-15` | Re-entering edit mode clears every old error ("a failed save shouldn't keep shouting once the owner has stepped back in"). | §7 |
| `D-PROFILE-16` | The guard covers the whole of edit mode with three mechanisms: the browser's dialog where ours cannot show (reload, close, typed address), our dialog for back/forward through a same-URL history entry, and our dialog for in-app links through a capturing click listener; the entry is removed when editing ends normally so a later back behaves as before; a history entry pushed above it (the lightbox) pops without a question. | §7 |
| `D-PROFILE-17` | „Zostań” is the safe answer: it takes focus when the dialog opens — once, so a re-render cannot steal focus — and answers Escape. | §7 |
| `D-PROFILE-18` | A confirmed leave ends editing without the save-on-exit pass: what was saved stays; an open work form and its uploads are let go (the form's unmount discards them). | §7 |
| `D-WORKS-1` | The strip holds at most 3 pictures, the orbit first (its start frame is the work's main picture), then the photos numbered among themselves; an orbit plus 3 photos leaves the third photo to the lightbox, "one arrow away". | §8 |
| `D-WORKS-2` | On an orbit tile the picture is the drag control, so the lightbox opens from a separate „+” button. | §8 |
| `D-WORKS-3` | One component for visitor and owner; the owner's page adds the R360 badge and the edit/delete row through props; a visitor never sees the R360 state. | §8 |
| `D-WORKS-4` | Editing a work shows its form in its card's slot while the other cards stay ("three cards for two works was the wrong picture"), and nothing can be reordered while that form stands in the list (the form's row is not a measured box, so a drag would answer the wrong index). | §8 |
| `D-WORKS-5` | Reordering: grips only while editing and only with more than one work; pointer events, not HTML5 drag-and-drop (`dragstart` never fires on touch); arrows move one place with no grab mode to enter or leave; focus stays on the moved work's grip; the keys are said out loud in a hint every grip names, because a button's own keys (Enter, Space) move nothing. | §8 |
| `D-WORKS-6` | The whole order is sent once moving stops, not per move (an arrow repeats about 25 times a second); the server refuses an order about any other list; a refused save is not reverted from a snapshot, the server's list is the way back. | §8 |
| `D-WORKS-7` | Cancel or save of an in-place form gives focus back to the „Edytuj” that opened it. | §8 |
| `D-WORKS-8` | Back closes the picture (on a phone it used to leave the site): opening pushes one marked entry, Back pops it and closes, closing by button or Escape pops it itself so the next Back goes where it always went, stepping adds nothing, a reload or a forward onto the entry makes the next opening reuse it, and the editing guard ignores this pop — except after a reload on the entry (V-LIGHTBOX step 7). | §8 |
| `D-WORKS-9` | Focus goes to Close once on opening, not on every step (or the arrows would lose focus the moment they are used); Tab cycles inside so "Zapisz" or another card's button cannot move history under the picture; a step that takes the focused control away returns focus to Close, not to the page. | §8 |
| `D-WORKS-10` | A photo is shown at the 1600 px variant, never the original (G3); the orbit uses its 1600 px set on a wide screen and the 800 px set on a phone, painting the card's cached 800 px start frame at once. | §8 |
| `D-WORKS-11` | A focused slider owns the arrow keys; Escape still closes. | §8 |
| `D-WORKS-12` | The overlay scrolls when what it holds is taller than the screen (an orbit with a dozen cue buttons on a short one) and keeps the top reachable; the enlarged orbit never shrinks below 10rem; its ring shows no frame counter because the caption's counter is right under it. | §8 |
| `D-WORKS-13` | One frame at a time, the picture is the control: a horizontal drag is relative to the press, discrete (framesPerWidth frames per picture width) and wraps past the last frame; vertical swipes stay the page's; a 6 px slop keeps a diagonal swipe from jittering a frame; the keyboard steps the same frames. | §8 |
| `D-WORKS-14` | Frames are painted onto a canvas from decoded pictures, not swapped into an `<img>` (which flashed the ground between frames); the `<img>` stays as the server-rendered poster for crawlers, visitors without script, and the first moment. | §8 |
| `D-WORKS-15` | Loading: a card fetches nothing past its poster until half in view and the page has loaded (a profile may carry ten orbits; the page's own pictures first); in view it loads its whole set untouched (#123), start frame then every 8th/4th/2nd/rest so it turns after a dozen requests; one page queue of 3; a frame counts once decoded; a set that never answers is given up after 3 failures (#140); what loaded is remembered for the page's life, so a reopened lightbox loads again (#143). | §8 |
| `D-WORKS-16` | The ring is a dial and the visitor's progress bar: an ellipse flattened to the render camera's elevation, the start frame at the bottom (nearest the viewer), frames anticlockwise for direction +1 (#124, Dawid 10.09.2026), what has decoded drawn as arcs whose invisible gaps are joined (#117, #125); a click travels the shorter arc, a tie going the work's direction; only the band takes the pointer; hidden from assistive technology because the viewer is the same value. | §8 |
| `D-WORKS-17` | A cue's label shows only while it is pointed at (mouse on its marker or its button, or that button focused from the keyboard); nothing leaves it standing — not the orbit on the cue's frame, not a tap; a click or tap on a marker goes to its cue. | §8 |
| `D-WORKS-18` | Cue buttons stand on their own — everything a cue does is reachable without the ring, and they are the keyboard's and screen reader's way to the cues — in the order a turn from the start frame meets them; the button of the cue the orbit stands on is marked (a readout of arrival; #175's "light on the press" was closed unmerged); no colour transition (axe caught an unreadable mid-fade); only the keyboard's focus points at a cue (a pressed button keeps its focus). | §8 |
| `D-WORKS-19` | On `phone:` the public page shows no ring, on the card or in the lightbox — only the cue buttons; the owner's form keeps its ring. | §8 |
| `D-WORKS-20` | Target for the redesign: on the desktop profile page the ring appears only once the work is enlarged; phones keep only the buttons. | §8 |
| `D-WORKS-21` | An orbit thrown with the hand keeps turning and slows to a stop at a constant rate; a hand that came to rest before letting go stops the orbit (the lift is one of the readings, no second threshold); a cancelled pointer never coasts; a visitor whose system asks for less motion is not thrown at all; a grab or a key ends a coast. | §8 |
| `D-WORKS-22` | A travel runs at one pace. | §8 |
| `D-WORKS-23` | Under reduced motion a travel jumps; a travel always arrives even where animation frames stop coming, and a hand on the way still wins. | §8 |
| `D-WORKS-24` | Drag anywhere on the picture or take the handle with the keyboard; the axis is the viewer's choice, per look, never stored; one box for both channels because they are the same view. | §8 |
| `D-WORKS-25` | On the across axis ArrowDown shows more of the second channel — "a conscious step away from the APG's 'up is more'", with `aria-valuetext` saying what the value means. | §8 |
| `D-FORM-1` | Photos upload the moment they are picked and are named by id at save; whatever the form uploaded and did not save is discarded when it closes, however it closes. | §8 |
| `D-FORM-2` | One picker for several files, all or none: a pick of more than fit uploads nothing and says so. | §8 |
| `D-FORM-3` | The photo picker allows many files only while two or more places are free. | §8 |
| `D-FORM-4` | A replacement takes its tile's place (a replaced main stays main) and keeps the tile's second channel. | §8 |
| `D-FORM-5` | Identical bytes are one photo: a duplicate is refused with a message, a photo replaced by itself changes nothing. | §8 |
| `D-FORM-6` | A tile's controls sit under the picture, not on it; only the upload bar stays on the picture. | §8 |
| `D-FORM-7` | A preview that does not decode falls back to the local file, else a neutral „Bez podglądu” tile instead of a broken-image icon. | §8 |
| `D-FORM-8` | A work with an R360 set needs no photo; its start frame is the main picture. | §8 |
| `D-FORM-9` | The zip is opened only in the owner's browser and never sent; a zip the reader refuses is refused before any request. | §8 |
| `D-FORM-10` | A browser whose canvas encodes no WebP is told so before a set is presigned, so no reservation is taken. | §8 |
| `D-FORM-11` | A new zip with the frame count of the orbit last taken out keeps its parameters and cue points; another count starts from the defaults; untouched defaults are not remembered, so a wrong zip taken out untouched wipes nothing. | §8 |
| `D-FORM-12` | The zip picked last owns the form; a run the owner stopped or replaced returns in its own time, abandons its set and leaves the form alone. | §8 |
| `D-FORM-13` | The progress is frames only — made and landed, one bar and two counters — because there is no archive transfer any more. | §8 |
| `D-FORM-14` | The preview appears as soon as frames are coming, and a frame is shown at decode time, before its WebPs exist. | §8 |
| `D-FORM-15` | An unnamed cue point is refused by the form with its own message instead of an unexplained schema refusal. | §8 |
| `D-FORM-16` | The page's „Zapisz” settles an open form: waits for uploads, closes an untouched form, saves a savable one, keeps an unsavable one on screen with its reason and stays in editing. | §8 |
| `D-FORM-17` | One save at a time: a second caller joins the request in flight. | §8 |
| `D-FORM-18` | An edited work's form stands where its card was; closing it puts the card back and returns focus to that card's „Edytuj”. | §8 |
| `D-FORM-19` | A photo whose upload finishes after the form is gone is discarded; discard is best effort ("an orphan set is the quota's problem, not the owner's"). | §8 |
| `D-FORM-20` | The parameters are offered while the frames are still being made, not only once the set has landed. | §8 |
| `D-FORM-21` | The owner's preview paints decoded frames onto a canvas, bounded at 128 MB, re-decoding evicted frames from the kept encodings instead of re-reading the zip. | §8 |
| `D-FORM-22` | The ring's arc shows frames MADE, not frames still held in memory, so it fills on long orbits. | §8 |
| `D-FORM-23` | The form's preview keeps the ring on phones; the no-ring rule covers the public page only. | §8 |
| `D-FORM-24` | A cue point is added at the frame in view and named in place, its field taking the focus; one per frame, twelve at most; buttons ordered as a turn from the start frame meets them. | §8 |
| `D-FORM-25` | A slider's name alone is its label and its value its description; the start frame's value is announced as a status when the button changes it. | §8 |
| `D-FORM-26` | One progress look for every upload on the platform (avatar, cover, work photo, R360), with "processing" after the bytes land and a cancel only while they move. | §8 |
| `D-FORM-27` | The bar is announced once at the start and once when the bytes have landed, not every percent. | §8 |

## 11. Findings — index

Every finding in one list; the evidence is in the section named. None of them is fixed, except `F-WORKS-1` (a sentence in SPEC.md). A "Duplicate of" entry points at the finding that carries the evidence.

| ID | Finding | Section |
| --- | --- | --- |
| `F-SHELL-1` | The seven auth screens render the same for signed-in viewers; nothing sends a signed-in person away from `/login` or `/register`, while `/` and the 404 link do route them (D-SHELL-5). | §2 |
| `F-SHELL-2` | Page titles follow no single pattern: `/register/verified` has no `generateMetadata`, so its tab shows only „Architektów 3d” (same as the homepage), the other auth screens name themselves („Logowanie”) without the brand, profile pages use „{name} · Architektów 3d”. | §2 |
| `F-SHELL-3` | No screen for failure or for unmatched multi-segment addresses: no `error.tsx`/`global-error.tsx` although the profile page deliberately throws database/storage errors ("Everything else must surface as a 500", `[handle]/page.tsx` `lookup`); no catch-all route or `global-not-found`, so `/foo/bar` cannot reach `[locale]/not-found.tsx` (Next docs `not-found.md`: only a root `app/not-found.js` or `app/global-not-found.js` handles unmatched URLs, and `global-not-found` is the documented option when the root layout sits under a top-level dynamic segment). | §2 |
| `F-SHELL-4` | The language switcher exists only on the homepage and the visitor view of a profile. | §3 |
| `F-SHELL-5` | The visitor bar is the signed-out bar for every non-owner: a signed-in `other` or `no-handle` viewer is offered „Załóż konto” and has no account menu (way back only via the logo's `/` redirect); and nobody is offered „Zaloguj się” on a profile — an owner whose session ended lands on their own profile with a sign-up button only, while the homepage bar offers both. | §3 |
| `F-SHELL-6` | Onboarding has no bar, logo or account menu: a no-handle user cannot sign out or reach settings from the UI (the handle step offers only „Wstecz”); `/settings/account` is reachable only by typing it or from the `/email-changed` link. | §3 |
| `F-SHELL-7` | The owner bar does not collapse on the premise that profile bars "carry one or two icon-sized actions that fit a phone fine", but since 08.09.2026 its edit toggle is a labelled button. | §3 |
| `F-SHELL-8` | Bars are not landmarks and sit inconsistently: plain `<div>`, no `<header>`/banner and no skip link anywhere; on the homepage the bar is inside `<main>`, on profile and settings pages it precedes `<main>`. | §3 |
| `F-SHELL-9` | Comments that contradict the code (do not rely on them): "This is the only bar in the product that collapses into a hamburger" (`(public)/page.tsx`) and "Only the homepage hero needs one" (`mobile-menu.tsx`) — the visitor profile bar collapses too; `TopBar` `mobileMenu` doc "what the profile and settings bars want"; `use-dismissable.ts` "shared by AccountMenu and LanguageChip" (MobileMenu too); `src/components/ui/icon.tsx` "the two icons this design actually uses" (21 exist); `brand-mark.tsx` "Three route files use it — … and the share card" (`/api/og` draws a monogram); `[handle]/page.tsx` "public/og-placeholder.png" (no such file); `public-profile.ts` "monogram card (1200×630…)" (`MONOGRAM_CARD` is 512×512); `globals.css` "the product ships no font binaries" (`public/figtree-bold.ttf`). | §3 |
| `F-SHELL-10` | A failed sign-out's message outlives its attempt: `signOutFailed` is reset only when the next sign-out starts, so closing and reopening the menu shows „Nie udało się wylogować…” again. | §3 |
| `F-SHELL-11` | Signing out during profile edit mode is not asked about: „Wyloguj” is a button that calls `router.push("/")`, while the leave guard intercepts only `a[href]` clicks, back/forward and `beforeunload`. | §3 |
| `F-SHELL-12` | The switch follows different rules from the rest of routing: it keeps only the path (query and hash dropped), while the proxy's 301 and the page's 308s keep the query on purpose; the choice is a session cookie (next-intl 4 default, `routing.ts` sets no `localeCookie`), forgotten when the browser session ends; and opening any `/en/...` link from a Polish browser sets the same cookie, after which unprefixed Polish links redirect to English for the session. | §3 |
| `F-SHELL-13` | Popovers fall short of their declared roles. | §3 |
| `F-SHELL-14` | Visible strings outside the dictionaries (A8): `Plaque` defaults `name = "Architektów"` (shown on onboarding in English too) and `footer = "Architektów 3d"` (duplicates `Brand.wordmark`); "A3D" lettering in `Mark` and `BrandMark`; `[locale]/opengraph-image.alt.txt` „ul. Architektów 3d, Stara Ochota” served for `en`; `/api/og` 404 bodies "Not found"/"Not configured". | §3 |
| `F-SHELL-15` | The plaque repeats content yet is exposed to assistive technology: a screen reader reads the display name and "Architektów 3d" again after the works (on onboarding, the typed name); and its name size has no floor, so long names (A4 allows 80 characters) become unreadable. | §3 |
| `F-SHELL-16` | The homepage names each destination twice with different words: `/register` is „Załóż konto” in the bar and „Zamelduj się” in the hero; `/login` is „Zaloguj się” and „Jestem zameldowany” (§1: "never has to guess"). | §4 |
| `F-SHELL-17` | Dead code: `IconButton` is imported nowhere; `Badge` tone `danger` is never passed. | §9 |
| `F-SHELL-18` | Fonts load at runtime from Google Fonts (`@import url("https://fonts.googleapis.com/…")`), so every page view sends the visitor's browser to `fonts.googleapis.com`/`fonts.gstatic.com`, a provider outside the EU/EEA that sees the visitor's IP address — §7 "Never: services outside the EU/EEA in the personal-data path". | §9 |
| `F-AUTH-1` | The footer line that the shell comment promises is missing on three screens, leaving some states with no way to log in or go back: V-RESET-NEW has no footer line in any state (its form state has no link at all); V-EMAIL-CHANGED has only the in-card settings link; V-REGISTER-VERIFIED's expired and invalid states have no link of any kind, only the resend form. | §5 |
| `F-AUTH-2` | Duplicate of `F-SHELL-4` (no language switch on the auth screens, SPEC A8). | §5 |
| `F-AUTH-3` | Text links have no touch floor: `AUTH_TOUCH` is applied to buttons and text-styled `<button>`s but never to a `TextLink`, so „Nie pamiętasz hasła?”, every footer link, „Wyślij nowy link”, „Zaloguj się” (reset success), „Przejdź na stronę główną” and „Przejdź do ustawień konta” keep `type-sm` line height on `phone`. | §5 |
| `F-AUTH-4` | Duplicate of `F-SHELL-1` (signed-in visitors are not sent away from the auth screens). | §5 |
| `F-AUTH-5` | Client-side validation errors are silent for screen-reader users: after pressing submit, focus stays on the button, the error paragraphs have no live role, and nothing moves focus to the first invalid field — in V-LOGIN, V-REGISTER, V-RESET-REQUEST, V-RESET-NEW and the V-REGISTER-VERIFIED resend form. | §5 |
| `F-AUTH-6` | A result swap removes the focused submit button, so focus falls back to the document and nothing is announced: V-REGISTER sent state, V-RESET-REQUEST sent state, V-RESET-NEW success. | §5 |
| `F-AUTH-7` | No return destination: a visitor sent to `/login` by the (app) gate (from `/settings/account`, or V-EMAIL-CHANGED's „Przejdź do ustawień konta”) lands on `/onboarding` → `/{handle}` after signing in, not on the page they asked for. | §5 |
| `F-AUTH-8` | Nested live regions: `ResendStatus` (`role="status"`) sits inside the not-verified `role="alert"` container, so a resend outcome changes the alert's content and may re-announce the whole block, button label included. | §5 |
| `F-AUTH-9` | Stale comments: `login-form.tsx` and `two-factor-challenge.tsx` say the onboarding step "forwards users who already have a handle to /", but `onboarding/page.tsx` forwards them to `/{handle}` (its own comment: going through "/" "would just add a hop"). | §5 |
| `F-AUTH-10` | The sent state has no way to correct a mistyped address: nothing clears `sentTo`, so the only way back to the form is a reload — on V-REGISTER and V-RESET-REQUEST alike. | §5 |
| `F-AUTH-11` | The sent copy asserts delivery unconditionally („Wysłaliśmy link aktywacyjny na adres {email}”), but for an address that already has an account the sign-up answers the same 200 and sends nothing (no `onExistingUserSignUp` hook), so the person waits for a message that never comes; the resend then also answers "done" without sending. | §5 |
| `F-AUTH-12` | Three confirmations of the same resend outcome use two texts: only V-REGISTER's sent state mentions the spam folder (`Register.sent.resendDone`), V-LOGIN (`Login.resendDone`) and V-REGISTER-VERIFIED (`Register.verified.resendDone`) do not. | §5 |
| `F-AUTH-13` | The sign-up rate-limit message says „Odczekaj chwilę” / "Wait a moment", but the window is one hour (10 per hour per IP), so the wait can be up to an hour; the reset-request and resend messages name their hourly limits. | §5 |
| `F-AUTH-14` | Success-looking states render without any proof: `/register/verified` with no parameter shows „Konto aktywne”, and `/email-changed` with no parameter shows „Zmiana zatwierdzona”; a verification link clicked again within 24 h also shows success, while `Register.verified.invalidBody` tells the person that an "already used" link is what leads to the invalid state. | §5 |
| `F-AUTH-15` | The success button „Ustaw adres profilu” leads to the login form, and nothing on the page says a login comes first. | §5 |
| `F-AUTH-16` | The page has no `generateMetadata`, so its tab title is the site name, while the six other auth screens set their own title. | §5 |
| `F-AUTH-17` | One outcome, two renderings: a dead link detected on load gets an h1 „Nieprawidłowy link” with body and link, while the same link detected at submit keeps the h1 „Ustaw nowe hasło” above a heading-less alert — the page still invites setting a password that can no longer be set. | §5 |
| `F-AUTH-18` | Security, already open as issue #59: the e-mail code is offered to, and accepted for, accounts protected by an authenticator app — the server lists `otp` for every 2FA account because an e-mail sender is configured, `resolveModes` passes it through, and `verify-otp` does not check how the account enrolled. | §5 |
| `F-AUTH-19` | Every 429 from a verification shows „Zbyt wiele prób. Konto jest chwilowo zablokowane — spróbuj później.”, but a 429 is also the per-IP limit of 3 verification requests per 10 s, and e-mail-code-only accounts are never locked — such a person is told the account is locked after four quick attempts. | §5 |
| `F-AUTH-20` | Outcomes that need another action than "try again" get a wrong or vague message, against SPEC §1 ("writing an error somebody can act on"): (a) a missing, expired (10 min) or consumed challenge answers 401 → „Nieprawidłowy kod. Spróbuj ponownie.” on every attempt — including after five wrong authenticator/backup codes, when the sixth attempt ends the challenge with the generic error and even the right code is "invalid" from then on; only signing in again helps and nothing says so; (b) an e-mailed code that expired (3 min) or took five wrong guesses → 400 → „Weryfikacja nie powiodła się. Spróbuj ponownie.”, although only a new code helps; (c) „Aplikacja” or „Kod zapasowy” on an account without an authenticator (direct visit, edited URL) → 400 → generic; (d) a direct visit while signed out shows a working-looking form whose send button answers the generic error (signed in, the send succeeds and a correct code turns two-factor on, see "Reached by"). | §5 |
| `F-AUTH-21` | Switching the method forgets what was done: going to „Aplikacja” and back to „Kod e-mail” disables the field again and forces another send (a new e-mail replacing the code already in the inbox, counted toward 20 per hour); clicking the already-selected option also wipes the typed code and the error. | §5 |
| `F-AUTH-22` | The code is sent exactly as typed and compared exactly: a pasted code with a surrounding space is "invalid" (only the emptiness check trims), and a backup code altered by keyboard auto-capitalisation fails because backup codes are case-sensitive; the field sets no `autoCapitalize`, `autoCorrect`, `spellCheck` or `maxLength`. | §5 |
| `F-AUTH-23` | A failed resend leaves „Kod wysłany — sprawdź skrzynkę.” next to the new error, and any send error marks the code field `aria-invalid` and describes it, although the typed code was not at fault. | §5 |
| `F-AUTH-24` | For a change that is still pending, an aged-out link lands on „Nieprawidłowy link”, not „Link wygasł”: the `/verify-email` gate in `auth.ts` runs before the endpoint's own expiry check and answers `INVALID_TOKEN` once the pending-change record has expired, and that record — same 24-hour lifetime — is written a moment after the step-1 token is signed and before the step-2 token exists, so the gate answers first (except within that moment). | §5 |
| `F-AUTH-25` | A person whose browser is signed in as a different account gets `INVALID_USER`, shown as the generic invalid copy that blames a link which is in fact fine (signing out or another browser would work); the page has no copy for that case. | §5 |
| `F-AUTH-26` | A signed-in visitor on `/two-factor` can turn e-mail two-factor on with only a code mailed to the account, no password, while V-SETTINGS-ACCOUNT re-asks the password before turning a method on. | §5 |
| `F-ACCOUNT-1` | The address is re-derived on every pass through step one and „Wstecz” discards address edits, contrary to the code's own stated rule. | §6 |
| `F-ACCOUNT-2` | Onboarding copy predates the two-step split. | §6 |
| `F-ACCOUNT-3` | The step change is not communicated to keyboard or screen-reader users. | §6 |
| `F-ACCOUNT-4` | Duplicate of `F-SHELL-14` (plaque strings outside the dictionaries) and `F-SHELL-15` (the plaque read aloud). | §6 |
| `F-ACCOUNT-5` | A name the browser accepts can fail only at step two, with a message that blames saving the address. | §6 |
| `F-ACCOUNT-6` | Duplicate of `F-SHELL-6` (no way out of onboarding) and `F-SHELL-4` (no language switch on onboarding or settings). | §6 |
| `F-ACCOUNT-7` | Submit edge cases in onboarding. | §6 |
| `F-ACCOUNT-8` | A failed availability check is silent, and a rate-limited one sends mixed signals. | §6 |
| `F-ACCOUNT-9` | The cooldown date omits the time, so on the named day the address can still be locked under a date that reads as "today". | §6 |
| `F-ACCOUNT-10` | For an account without a handle the address form cannot save and shows copy that is false for a first assignment. | §6 |
| `F-ACCOUNT-11` | The e-mail "sent" copy contradicts the two-step flow. | §6 |
| `F-ACCOUNT-12` | E-mail section gaps. | §6 |
| `F-ACCOUNT-13` | Two-factor views go stale across `router.refresh()`. | §6 |
| `F-ACCOUNT-14` | Two-factor accessibility and error handling differ from the rest of the page. | §6 |
| `F-ACCOUNT-15` | Authenticator management is minimal. | §6 |
| `F-ACCOUNT-16` | Duplicate of `F-AUTH-7` (no return destination after the `(app)` gate sends a signed-out visitor to `/login`, including from the `/email-changed` settings link after either change-e-mail click, both of which work signed out). | §6 |
| `F-ACCOUNT-17` | The page's forms give feedback in different ways. | §6 |
| `F-ACCOUNT-18` | No browser test covers the settings forms or runs axe on these screens. | §6 |
| `F-PROFILE-1` | Duplicate of `F-SHELL-5` (a signed-in non-owner gets the signed-out bar; no „Zaloguj się” on any profile bar). | §7 |
| `F-PROFILE-2` | Stale share-image statements: `page.tsx` still describes "The committed 1200×630 share image … (public/og-placeholder.png)" (the file does not exist) and `public-profile.ts` calls the monogram card "1200×630", and `monogram.ts`'s header speaks of "the 1200×630 card a chat client shows", while `MONOGRAM_CARD` there is 512×512; SPEC §12 still lists "Choice of the specific OG image for profile pages without an avatar" as open although #27 shipped the monogram card. | §7 |
| `F-PROFILE-3` | Duplicate of `F-WORKS-1` (fixed with this document: SPEC §9 now orders works by `position`). | §7 |
| `F-PROFILE-4` | Duplicate of `F-SHELL-14` (the plaque's default strings are not dictionary keys). | §7 |
| `F-PROFILE-5` | Duplicate of `F-SHELL-4` (no language switch for the owner, SPEC A8). | §7 |
| `F-PROFILE-6` | Copy that names the wrong mode: `PublicProfile.ownerScopeNote` („Kliknij „Edytuj profil”, aby zmieniać dane…”) is rendered only in edit mode, where that button reads „Zapisz”; `Works.emptyBody` („Włącz edycję i dodaj pierwszą plusem…”) is also shown in edit mode. | §7 |
| `F-PROFILE-7` | Name and avatar share one error line showing `nameError ?? avatarError`: a stale name error hides a fresh avatar error, and the avatar input's `aria-describedby="profile-edit-error"` then points at the name's message. | §7 |
| `F-PROFILE-8` | „Zapisano profil” can be shown over a failed save, contrary to the `toggleEditing` comment ("'Zapisano' is never claimed for a save that did not happen"): (a) the order save that the leave sequence itself sends is awaited but its result is discarded — `track()` removes a save from `pending` in a `.finally` registered before the `await`, so it is gone when `Promise.all([...pending.current])` reads the set; a refused order ends editing, its error (edit-only) disappears and the notice shows; (b) any field save that settles while the sequence awaits `settle()` or the order request is likewise gone from the set; (c) a save that failed before „Zapisz” is not retried or checked: editing ends, the refused value is replaced by the server copy, headline/bio/places errors vanish, a name error stays visible under the h1; (d) saves started after the set was read are not waited for. | §7 |
| `F-PROFILE-9` | Leaving edit mode does not wait for avatar/cover uploads or a cover removal (`handleImageFile`, `removeCover` are not tracked), while the progress bars, the cover error and the name/avatar error render outside the `editing` condition: after „Zapisz” a running bar (with its cancel) stays in view mode, a later failure appears there, and „Zapisano profil” was shown before the photo was saved. | §7 |
| `F-PROFILE-10` | While a new cover uploads over an existing one, the remove button reads „Usuwanie tła…” ("Removing the cover…"): one `coverBusy` flag drives both the upload and the removal label. | §7 |
| `F-PROFILE-11` | Removing the cover acts at once, with no confirmation, and the server deletes the old files, while deleting a work asks „Usunąć razem ze zdjęciami?” first. | §7 |
| `F-PROFILE-12` | The name input is unlike the other text fields: no visible label (aria-label only), no hint, no counter; its invalid message „Nazwa musi mieć od 1 do {max} znaków.” names only the length although `displayNameSchema` also refuses control/format characters (the sections' message names both); it is disabled while saving, while headline, bio and places show no saving state at all; and the page has no h1 while editing. | §7 |
| `F-PROFILE-13` | The headline is a 2-row textarea that accepts Enter and pasted line breaks, but `headlineSchema` refuses a break between characters (`\p{Cc}` includes the newline; a leading or trailing one is trimmed and saves silently), so the blur save fails with the generic „Tekst jest za długi albo zawiera niedozwolone znaki.” | §7 |
| `F-PROFILE-14` | At 8 places the combobox is simply disabled with no visible reason, so `locations.tooMany` („Maksymalnie {max} miejsc.”) can never be shown; at the works limit the „+” is disabled AND explained by `Works.limitReached` via `aria-describedby`. | §7 |
| `F-PROFILE-15` | A place's status line and the input's emptying happen before its save: `addPlace` sets „Dodano miejsce: {place}” and `choose()` empties the input; if the save is refused (rate limit, network, schema) the chip is rolled back with an error, yet the status line still says "added" and the typed text is gone. | §7 |
| `F-PROFILE-16` | Place moves are saved once per move with no debounce, unlike works (`moveWork` → `queueOrderSave`, `ORDER_SAVE_AFTER_MS`; the comment above `moveWork` gives the reasons: key repeat, concurrent requests committed in arrival order, the rate limit — 40/min here); requests are not serialized, and a failure restores the list captured when that request started, which can overwrite a later successful move on screen. | §7 |
| `F-PROFILE-17` | A refused or failed place search shows no suggestions and no message; the comment "A refusal (the rate limit, say) keeps the last list rather than leaving the owner with none" is contradicted by `hits = open && found.query === query ? found.places : []`, which hides any answer that is not for the current text. | §7 |
| `F-PROFILE-18` | Text typed in the place field but not confirmed with Enter or Tab is dropped without a word when focus leaves by pointer or when „Zapisz” is pressed (blur only closes the list; leaving edit mode unmounts the field). | §7 |
| `F-PROFILE-19` | A single place chip still gets a grip announced „Przesuń miejsce {place}, 1 z 1” that can never move, whereas works get grips only when there are ≥ 2. | §7 |
| `F-PROFILE-20` | Duplicate of `F-WORKS-10` (every non-429 refusal of the works order, 401/403/400 included, is worded `Works.card.moveStale`). | §7 |
| `F-PROFILE-21` | Duplicate of `F-FORM-12` (closing the new-work form returns focus nowhere). | §7 |
| `F-PROFILE-22` | Duplicate of `F-FORM-14` (switching or closing a work form discards it without asking). | §7 |
| `F-PROFILE-23` | Duplicate of `F-FORM-7` (dead `Settings.profile.upload.errors.archive_*` copy). | §7 |
| `F-PROFILE-24` | The leave dialog has no focus trap (Tab reaches the page behind the backdrop) and does not restore focus when it closes: „Zostań” unmounts the focused button and focus drops to the document, although the dialog declares `aria-modal="true"`. | §7 |
| `F-PROFILE-25` | Duplicate of `F-SHELL-11` (signing out while editing is not asked about). | §7 |
| `F-PROFILE-26` | The dialog says files being uploaded will be lost, but after „Wyjdź” (an in-app navigation) an avatar/cover upload keeps running and still assigns the photo, and a works order waiting for its timer is still sent: nothing aborts `uploadAborts` or clears `orderTimer` when `OwnerProfileView` unmounts. | §7 |
| `F-PROFILE-27` | Leaving edit mode drops keyboard focus to the document: „Zapisz” disables itself (`leaving`) and `toggleEditing` blurs `document.activeElement`, which after a keyboard press — or a click or tap in Chromium — is the toggle itself; nothing restores focus when editing ends or when a failed save keeps editing open. | §7 |
| `F-WORKS-1` | Fixed with this document: SPEC.md §9 said "Order on the page = `created_at`" while `lib/works.ts` `listWorks` has ordered by `works.position` (then `created_at`, `id`) since #66; §9 now says `position`. | §8 |
| `F-WORKS-2` | The test that a visitor sees no R360 state checks copy that no longer exists, so a leaked badge would pass. | §8 |
| `F-WORKS-3` | A failed delete shows one message for every cause. | §8 |
| `F-WORKS-4` | The delete confirmation drops the keyboard and says too little. | §8 |
| `F-WORKS-5` | The delete error outlives editing. | §8 |
| `F-WORKS-6` | The confirmation names only the photos, but a work with an R360 loses its frame set too. | §8 |
| `F-WORKS-7` | Duplicate of `F-FORM-14` (another work's „Edytuj” discards an open form without asking). | §8 |
| `F-WORKS-8` | A pointer drag cannot reach a place off screen. | §8 |
| `F-WORKS-9` | Dragging does not look like dragging (#173, open). | §8 |
| `F-WORKS-10` | Order-save failures are mislabelled. | §8 |
| `F-WORKS-11` | The picture-less placeholder is reachable only with data A12 forbids, and it is labelled as an orbit. | §8 |
| `F-WORKS-12` | Card and lightbox count pictures differently. | §8 |
| `F-WORKS-13` | Accessible names are assembled with literal punctuation in the component (A8: no strings in components), so order and punctuation cannot differ per language. | §8 |
| `F-WORKS-14` | The lightbox calls every picture a photo. | §8 |
| `F-WORKS-15` | The enlarged orbit does not continue from the card. | §8 |
| `F-WORKS-16` | "Phone" is decided three ways in one overlay. | §8 |
| `F-WORKS-17` | Modality rests on `aria-modal` and the Tab trap only. | §8 |
| `F-WORKS-18` | Orbits on one page load one after another (#152, open). | §8 |
| `F-WORKS-19` | On a card, a press inside the ring's box but off its band (e.g. the ring's middle) likely turns nothing. | §8 |
| `F-WORKS-20` | Comparable sliders take focus on touch differently (#182, open). | §8 |
| `F-WORKS-21` | Code comments describe removed or superseded behaviour, which a redesign reading them could bring back. | §8 |
| `F-WORKS-22` | For a work with direction −1 the keys run against the value. | §8 |
| `F-WORKS-23` | A Save-Data or 2g/3g visitor never gets more than every 8th frame. | §8 |
| `F-WORKS-24` | The poster is always lazy in the gallery, against its own prop doc. | §8 |
| `F-WORKS-25` | A two-channel photo flashes when enlarged (#159, open). | §8 |
| `F-FORM-1` | Save is enabled in two waiting states. | §8 |
| `F-FORM-2` | A zip read that ends after the form closed starts a full frame run nobody sees: WebP probe, `presign-r360-set` (reservation), every frame encoded and PUT, and only then `abandon`. | §8 |
| `F-FORM-3` | The archive read has no progress bar, status or busy state: the form looks idle until the read ends, which the code itself calls "a long wait for one picked from a cloud drive (#147)". | §8 |
| `F-FORM-4` | A photo (new or replacement) whose bytes equal an existing second channel is not caught by the form (`addPhoto` checks tile photos only); the schema then refuses on `secondaryFileIds`, which `performSave` maps to `partyInvalid` („Tekst jest za długi albo zawiera niedozwolone znaki.”) — a message about the investor/developer text. | §8 |
| `F-FORM-5` | A quota refusal at save comes only from the frame set (`verifyFrameSet` → `FrameSetError("quota_exceeded")`), but the form shows the photo message „Brak miejsca: to zdjęcie przekroczyłoby Twój limit 10 GB.”; the frames' own `r360.failed.quota_exceeded` („…klatki przekroczyłyby…”) exists. | §8 |
| `F-FORM-6` | Upload wording where frames are being made: `errors.uploading` („Poczekaj, aż zdjęcia się wgrają.”) is also the answer when the orbit run is working, while `errors.framesUploading` („Poczekaj, aż klatki się przygotują.”) is unused; the frames bar's value text is „Wysyłanie {percent}%” and its stop button „Przerwij wysyłanie” although it also stops encoding. | §8 |
| `F-FORM-7` | Dead or unreachable copy and codes: unused `Works.form.r360.frames`, `Works.form.errors.framesUploading`, `Works.form.r360.failed.resume`, `Settings.profile.upload.errors.archive_type` / `archive_size` (and `UploadFailure` members `archive_type`/`archive_size` that nothing returns); unreachable `Works.form.r360.refused.expired` (only `urlSource` throws `http`, and the form uses `fileSource`), `Works.form.r360.refused.unsupported_method` (`openZip` never checks methods; an unsupported method surfaces per entry as `failed.read_failed`, after the presign), `Works.form.errors.invalidArchive` (`WorksError` declares `invalid_archive`, nothing throws it). | §8 |
| `F-FORM-8` | `r360.failed.webp_unsupported` tells the owner to use „…Edge lub Safari” / "…Edge or Safari", while SPEC §10 says Safari's canvas encodes no WebP and that the form "tells the owner which browsers work". | §8 |
| `F-FORM-9` | The photo copy ignores the "0–3 with an orbit" rule of A12: `photos.rule` says „od 1 do 3” and the empty add tile shows „wymagane” even when an orbit set is attached and no photo is required. | §8 |
| `F-FORM-10` | Errors are not tied to fields: no `aria-invalid`, `aria-describedby` or `aria-required` on name/investor/developer or the file inputs; one `role="alert"` line under the buttons. | §8 |
| `F-FORM-11` | Per-tile controls carry the same accessible name on every tile („Usuń zdjęcie”, „Wymień zdjęcie”, „Ustaw jako główne”, „Dodaj drugi kanał”, „Usuń drugi kanał”, and every photo bar is „Zdjęcia”), and tile images are `alt=""`, so a screen-reader user cannot tell tiles apart. | §8 |
| `F-FORM-12` | Focus is lost when a pressed control removes itself: set main, remove photo, replace (tile remounts), remove/cancel channel, upload cancel ×, R360 remove and stop, cue remove. | §8 |
| `F-FORM-13` | While saving, tile controls (set main, replace, remove, channel add/remove) and all three pickers stay enabled; only Cancel, R360 „Usuń”, parameters and cue fields are disabled. | §8 |
| `F-FORM-14` | An open form — even with uploads done or a frame run of minutes in progress — is discarded without asking by „Anuluj”, by "+" pressed again, and by another work's „Edytuj”; leaving the page asks first (#83, whose dialog body warns „Otwarty formularz realizacji i wgrywane pliki przepadną.”). | §8 |
| `F-FORM-15` | Two progress bars can occupy the same strip of one tile: start a channel upload, then replace the photo (its controls stay visible while only the channel uploads); both bars are `absolute bottom-0`, the channel's covers the photo's and its cancel. | §8 |
| `F-FORM-16` | A superseded zip pick still writes its refusal: `readArchive` calls `setError` before `pickArchive` checks `pick !== picks.current`, so a slow first pick refused after a second pick began shows its message beside the second pick's working or ready orbit (the run never clears the alert). | §8 |
| `F-FORM-17` | A second channel cannot be replaced: with a channel present only its remove button renders, so `pickChannel`'s branches for an existing channel (stop one in flight, discard the replaced one, same-bytes no-op) are unreachable. | §8 |
| `F-FORM-18` | After the save refuses the set (`invalidSet` or `framesExpired`, both saying „Dodaj archiwum ponownie.”) the orbit row still reads „Gotowy · Klatki gotowe: N” and a second save repeats the refusal; the owner must find „Usuń” and pick the zip again. | §8 |
| `F-FORM-19` | `settle()` "kept" scrolls with `behavior: "smooth"` regardless of `prefers-reduced-motion`; the orbit hand checks reduced motion (`use-orbit.ts`), and there is no global reduced-motion rule in `globals.css`. | §8 |
| `F-FORM-20` | Limits are written into copy as literals rather than interpolated from the constants: „od 1 do 3” (`WORK_PHOTOS_MAX`), „10 MB” (`IMAGE_MAX_BYTES`), „10 GB” (`QUOTA_BYTES`; hand-edited when A9 went from 1 GB to 10 GB, #115), „co najmniej 2” / „360” (`R360_MIN_FRAMES` / `R360_MAX_FRAMES`), „64 megapiksele” (`IMAGE_MAX_PIXELS`). | §8 |
| `F-FORM-21` | Stale comments describe controls that no longer exist: the `r360-params.tsx` header still lists "the motion (#153) a two-way toggle like the direction", `TwoWayParam`'s doc names "the motion (#153)" and its `hint`/`testId` props are unused; comments count the owner's parameters as "four" (`R360.params`), "five" (`setParams`) and "five … the sixth, the frame count" (header). | §8 |
| `F-FORM-22` | Parameters deliberately reset to exactly the defaults (and cues removed) are not remembered when the orbit is taken out, so a same-count re-pick brings back older parameters the owner had undone. | §8 |
| `F-FORM-23` | The start frame's live region contains only the number, so a screen reader hears "2" with no parameter name; „Użyj tej klatki” has no programmatic link to „Klatka startowa”. | §8 |
| `F-FORM-24` | The fill's 200 ms width transition runs under `reduced-motion`; only the processing pulse is gated with `motion-safe:`. | §8 |
| `F-FORM-25` | A photo or channel confirmed in a form that is then left by a page unload (reload, closed tab, crash) is never discarded: the discard runs only from React's unmount cleanup, and nothing else frees an unreferenced work photo — `freeUnreferenced` is called only by `updateWork`, `deleteWork` and the discard route. | §8 |

## Appendix A. Screenshots

On https://claude.ai/code/artifact/37a17f91-9bd7-4641-8108-448f20987ac3 — fetch `screens/<id>.jpg` (or `screens/manifest.json`) with the Artifact tool's `read_file`.

| Screenshot | Shows | Viewer | Screen | Address | Specified in |
| --- | --- | --- | --- | --- | --- |
| `v-home--desktop` | Hero photo, the top bar floating over it (language chip, „Zaloguj się”, „Załóż konto”), heading, lead and two calls to action. | signed-out | desktop 1280×800, full page, 1280×909 px | `/` | V-HOME, C-TOPBAR |
| `v-home--desktop--language-open` | The language chip opened in the homepage bar. | signed-out | desktop 1280×800, viewport, 1280×800 px | `/` | C-LANGUAGE-CHIP |
| `v-home--desktop--en` | The homepage in English at /en. | signed-out | desktop 1280×800, full page, 1280×909 px | `/en` | V-HOME |
| `v-home--phone` | The bar's actions collapse into the menu button; the calls to action stack at full width. | signed-out | phone 390×844, touch, full page, 780×1874 px | `/` | V-HOME, C-TOPBAR |
| `v-home--phone--menu-open` | The mobile menu open: language chip, „Zaloguj się”, „Załóż konto”. | signed-out | phone 390×844, touch, viewport, 780×1688 px | `/` | C-MOBILE-MENU |
| `v-login--desktop` | Login, empty. | signed-out | desktop 1280×800, full page, 1280×800 px | `/login` | V-LOGIN, C-AUTH-SHELL |
| `v-login--phone` | Login on a phone. | signed-out | phone 390×844, touch, full page, 780×1688 px | `/login` | V-LOGIN, C-AUTH-SHELL |
| `v-register--desktop` | Registration, empty. | signed-out | desktop 1280×800, full page, 1280×800 px | `/register` | V-REGISTER |
| `v-register--phone` | Registration on a phone. | signed-out | phone 390×844, touch, full page, 780×1688 px | `/register` | V-REGISTER |
| `v-register-verified--desktop` | /register/verified opened directly, with no link: it shows the success state „Konto aktywne” and „Ustaw adres profilu”. | signed-out | desktop 1280×800, full page, 1280×800 px | `/register/verified` | V-REGISTER-VERIFIED |
| `v-reset-request--desktop` | Password reset request, empty. | signed-out | desktop 1280×800, full page, 1280×800 px | `/reset-password` | V-RESET-REQUEST |
| `v-reset-request--phone` | Password reset request on a phone. | signed-out | phone 390×844, touch, full page, 780×1688 px | `/reset-password` | V-RESET-REQUEST |
| `v-reset-new--desktop` | /reset-password/new without a token: „Nieprawidłowy link” and „Wyślij nowy link”. | signed-out | desktop 1280×800, full page, 1280×800 px | `/reset-password/new` | V-RESET-NEW |
| `v-two-factor--desktop` | /two-factor opened directly: all three ways offered — „Aplikacja”, „Kod e-mail”, „Kod zapasowy”. | signed-out | desktop 1280×800, full page, 1280×800 px | `/two-factor` | V-TWO-FACTOR |
| `v-email-changed--desktop` | /email-changed opened directly: „Zmiana zatwierdzona” and a link to account settings. | signed-out | desktop 1280×800, full page, 1280×800 px | `/email-changed` | V-EMAIL-CHANGED |
| `v-profile--desktop` | dawidwroblewski-a3d-1: cover, avatar, name, places, three works (an orbit card with its ring and counter, a two-channel photo card, a card at the three-photo limit), plaque, footer. | signed-out | desktop 1280×800, full page, 1280×1754 px | `/dawidwroblewski-a3d-1` | V-PROFILE, C-TOPBAR, C-LOGO, C-PLAQUE, C-FOOTER |
| `v-profile--desktop--en` | The same profile in English. | signed-out | desktop 1280×800, full page, 1280×1754 px | `/en/dawidwroblewski-a3d-1` | V-PROFILE |
| `v-profile--phone` | On a phone: menu button in the bar, one column of works, no ring and no counter on the orbit card; the three-photo card keeps its strip. | signed-out | phone 390×844, touch, full page, 780×3122 px, 3 parts | `/dawidwroblewski-a3d-1` | V-PROFILE, C-TOPBAR |
| `v-profile--phone--menu-open` | The visitor bar's mobile menu open. | signed-out | phone 390×844, touch, viewport, 780×1688 px | `/dawidwroblewski-a3d-1` | C-MOBILE-MENU |
| `v-profile--other-signed-in--desktop` | Signed in as the owner of dawidwroblewski-a3d-1, looking at studio-praga: the visitor bar with „Załóż konto” and no account menu. | signed-in other | desktop 1280×800, full page, 1280×1349 px | `/studio-praga` | V-PROFILE, C-TOPBAR |
| `v-profile--other-signed-in--phone` | The same on a phone. | signed-in other | phone 390×844, touch, full page, 780×3488 px, 3 parts | `/studio-praga` | V-PROFILE |
| `c-work-card--orbit--desktop` | A work card with an R360 orbit: 360° badge, ring dial with its dot, frame counter, enlarge button. | signed-out | desktop 1280×800, element, 512×349 px | `/dawidwroblewski-a3d-1` | V-WORKS-LIST, C-ORBIT |
| `c-work-card--two-channel--desktop` | A work card whose photo has two channels (the layers badge). | signed-out | desktop 1280×800, element, 512×349 px | `/dawidwroblewski-a3d-1` | V-WORKS-LIST, C-REVEAL |
| `c-work-card--three-photos--desktop` | A work card at the photo limit of A12 (three): the main photo large on the left, the other two stacked on the right; each picture opens the lightbox at its own position („Powiększ zdjęcie 2 z 3: Dawid”). | signed-out | desktop 1280×800, element, 512×318 px | `/dawidwroblewski-a3d-1` | V-WORKS-LIST |
| `c-work-card--three-photos--phone` | The same card on a phone: the strip keeps all three pictures. | signed-out | phone 390×844, touch, element, 716×474 px | `/dawidwroblewski-a3d-1` | V-WORKS-LIST |
| `v-lightbox--orbit--desktop` | The lightbox on the orbit: ring under the picture, name, position counter, keyboard hint, close button. | signed-out | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX, C-ORBIT |
| `v-lightbox--orbit--phone` | The lightbox on a phone: no ring, no keyboard hint. | signed-out | phone 390×844, touch, viewport, 780×1688 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX, C-ORBIT |
| `v-lightbox--orbit--phone-landscape` | A touch screen held sideways — the phone: variant: no ring. | signed-out | touch, sideways 844×390, viewport, 1688×780 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX, C-ORBIT |
| `v-lightbox--photo--desktop` | The lightbox on the two-channel photo. | signed-out | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX, C-REVEAL |
| `v-lightbox--photo--phone` | The two-channel photo in the lightbox on a phone. | signed-out | phone 390×844, touch, viewport, 780×1688 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX, C-REVEAL |
| `v-lightbox--three-photos--desktop` | The three-photo work enlarged at 1 / 3: previous and next arrows at the sides — both shown on the first photo too — close button, counter, keyboard hint. | signed-out | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX |
| `v-lightbox--three-photos--desktop--next` | After ArrowRight: photo 2 / 3. | signed-out | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX |
| `v-lightbox--three-photos--phone` | The three-photo lightbox on a phone. | signed-out | phone 390×844, touch, viewport, 780×1688 px | `/dawidwroblewski-a3d-1` | V-LIGHTBOX |
| `v-profile-owner--desktop` | Not editing: „Edytuj profil” and the account avatar in the bar, the works count „2 z 10”, the R360 state badge on each card. | owner | desktop 1280×800, full page, 1280×1436 px | `/dawidwroblewski-a3d-1` | V-PROFILE-OWNER, C-TOPBAR |
| `v-profile-owner--phone` | The owner's view on a phone. | owner | phone 390×844, touch, full page, 780×2726 px, 2 parts | `/dawidwroblewski-a3d-1` | V-PROFILE-OWNER, C-TOPBAR |
| `c-account-menu--open--desktop` | The account menu open: „Profil”, „Konto”, „Wyloguj”. | owner | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | C-ACCOUNT-MENU |
| `v-profile-edit--desktop` | Editing: „Zapisz” in the bar; cover with „Usuń tło” and a camera; avatar camera; name field; headline and bio with counters; place chips with grips and remove; place search; the scope note; works with „+”; each card with a grip, its R360 badge, „Edytuj” and „Usuń”. | owner | desktop 1280×800, full page, 1280×2091 px, 2 parts | `/dawidwroblewski-a3d-1` | V-PROFILE-EDIT, C-TOPBAR |
| `v-profile-edit--phone` | Editing on a phone: the name field clips a long name and the counters wrap. | owner | phone 390×844, touch, full page, 780×4200 px, 3 parts | `/dawidwroblewski-a3d-1` | V-PROFILE-EDIT |
| `v-profile-edit--place-search--desktop` | The place search after typing „Warsz”: register suggestions with their kind and region. | owner | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | V-PROFILE-EDIT |
| `c-work-card--delete-confirm--desktop` | „Usuń” asks first: „Usunąć razem ze zdjęciami?” — „Tak, usuń” or „Nie”. | owner | desktop 1280×800, element, 512×401 px | `/dawidwroblewski-a3d-1` | V-WORKS-LIST |
| `c-leave-guard--dialog--desktop` | Leaving while editing (account menu → „Konto”): „Opuścić stronę w trakcie edycji?” — „Wyjdź” or „Zostań”. | owner | desktop 1280×800, viewport, 1280×800 px | `/dawidwroblewski-a3d-1` | C-LEAVE-GUARD |
| `v-work-form--new--desktop` | A new work: the form above the list. | owner | desktop 1280×800, full page, 1280×2916 px, 2 parts | `/dawidwroblewski-a3d-1` | V-WORK-FORM |
| `v-work-form--new--phone` | A new work on a phone. | owner | phone 390×844, touch, full page, 780×6094 px, 5 parts | `/dawidwroblewski-a3d-1` | V-WORK-FORM |
| `v-work-form--edit-orbit--desktop` | The orbit work edited in place of its card: name, investor, developer, the photo tile marked „wymagane”, the ready R360 set, the preview with its ring, the five parameters, cue points, „Zapisz zmiany” and „Anuluj”. | owner | desktop 1280×800, full page, 1280×3910 px, 3 parts | `/dawidwroblewski-a3d-1` | V-WORK-FORM, C-R360-PARAMS |
| `v-work-form--edit-orbit--phone` | The same form on a phone — the form keeps the ring. | owner | phone 390×844, touch, full page, 780×7072 px, 5 parts | `/dawidwroblewski-a3d-1` | V-WORK-FORM, C-R360-PARAMS |
| `v-work-form--edit-two-channel--desktop` | The photo work edited in place: a tile with „2 kanały”, „Główne”, „Wymień”, „Usuń” and the channel button; the add tile; „Dodaj zip R360”. | owner | desktop 1280×800, full page, 1280×3004 px, 2 parts | `/dawidwroblewski-a3d-1` | V-WORK-FORM |
| `v-settings-account--desktop` | Settings: profile address, password change, e-mail change, two-factor (off) with e-mail codes and an authenticator app. | owner | desktop 1280×800, full page, 1280×1956 px | `/settings/account` | V-SETTINGS-ACCOUNT, C-HANDLE-FORM, C-TOPBAR |
| `v-settings-account--phone` | Settings on a phone. | owner | phone 390×844, touch, full page, 780×3796 px, 3 parts | `/settings/account` | V-SETTINGS-ACCOUNT |
| `v-404--desktop` | /no-such-profile-ui-spec: the 404 page, photo beside the heading and the way home. | signed-out | desktop 1280×800, full page, 1280×800 px | `/no-such-profile-ui-spec` | V-404 |
| `v-404--phone` | The 404 page on a phone: the photo becomes a banner above the text. | signed-out | phone 390×844, touch, full page, 780×1688 px | `/no-such-profile-ui-spec` | V-404 |

## Appendix B. Dictionary namespaces

Where each namespace and group of `messages/pl.json` is specified (the same keys exist in `messages/en.json`).

| Namespace or group | Sections |
| --- | --- |
| `Metadata` | §2, §5, §7 |
| `Email` | — (transactional e-mails, out of scope) |
| `Brand` | §3, §5, §7 |
| `HomePage` | §4 |
| `Footer` | §3, §9 |
| `Login` | §2, §5 |
| `Login.errors` | §5 |
| `Session` | §3, §4, §7 |
| `Onboarding` | §2, §3, §6 |
| `HandleForm` | §6 |
| `HandleForm.errors` | §6 |
| `Settings` | §2, §5, §6, §7, §8 |
| `Settings.account` | §2, §5, §6 |
| `Settings.profile` | §6, §7, §8 |
| `EmailChanged` | §2, §5, §6 |
| `Register` | §2, §5, §6 |
| `Register.errors` | §5 |
| `Register.sent` | §5 |
| `Register.verified` | §5, §6 |
| `ResetPassword` | §2, §5 |
| `ResetPassword.request` | §5 |
| `ResetPassword.new` | §5 |
| `TwoFactor` | §2, §5 |
| `TwoFactor.methods` | §5 |
| `TwoFactor.intro` | §5 |
| `TwoFactor.otp` | §5 |
| `TwoFactor.errors` | §5 |
| `PublicProfile` | §3, §7, §9 |
| `AccountMenu` | §3, §6, §7, §9 |
| `MobileMenu` | §3, §7 |
| `NotFound` | §2, §4, §7 |
| `LanguageSwitcher` | §3, §7 |
| `Works` | §7, §8 |
| `Works.card` | §7, §8 |
| `Works.form` | §7, §8 |
| `Works.lightbox` | §8 |
| `Works.orbit` | §8 |
| `Works.reveal` | §8 |

## Appendix C. Server endpoints

Every route under `src/app/api` and the sections whose elements call it. Sign-in, registration, reset, two-factor and e-mail change go through the Better Auth client (`src/lib/auth-client.ts`) to `/api/auth/*`; their calls are named in §5 and §6.

| Endpoint | Sections |
| --- | --- |
| `/api/auth/[...all]` | §3, §5, §6 |
| `/api/handle/availability` | §6 |
| `/api/og/[handle]` | §2 |
| `/api/places` | §7 |
| `/api/profile` | §6, §7 |
| `/api/profile/avatar` | §7 |
| `/api/profile/cover` | §7 |
| `/api/profile/handle` | §6 |
| `/api/profile/sections` | §7 |
| `/api/uploads/abandon` | §7, §8 |
| `/api/uploads/confirm` | §7, §8 |
| `/api/uploads/discard` | §7, §8 |
| `/api/uploads/presign` | §7, §8 |
| `/api/uploads/presign-r360-set` | §8 |
| `/api/works` | §7, §8 |
| `/api/works/[id]` | §7, §8 |
| `/api/works/order` | §7, §8 |

## Appendix D. End-to-end tests

Every Playwright spec and the sections whose elements it drives. A new UI that renames a role, an accessible name or a test id updates the specs named in the element's **Tests** line.

| Spec | Sections |
| --- | --- |
| `e2e/a11y.spec.ts` | §4, §6 |
| `e2e/avatar.spec.ts` | no UI: the avatar routes answer 401 to a signed-out caller |
| `e2e/db/avatar-upload.spec.ts` | §3, §7 |
| `e2e/db/happy-path.spec.ts` | §2, §3, §4, §5, §6, §8 |
| `e2e/db/leave-guard.spec.ts` | §3, §6, §8 |
| `e2e/db/lightbox.spec.ts` | §3, §6, §8 |
| `e2e/db/password-reset.spec.ts` | §5, §6 |
| `e2e/db/profile-sections.spec.ts` | §3 |
| `e2e/db/r360.spec.ts` | §8 |
| `e2e/db/works-order.spec.ts` | §3, §8 |
| `e2e/db/works.spec.ts` | §3, §8 |
| `e2e/handle.spec.ts` | §4, §5 |
| `e2e/i18n.spec.ts` | §3, §4 |
| `e2e/login.spec.ts` | §3, §4, §5 |
| `e2e/profile.spec.ts` | §2, §4, §5 |
| `e2e/register.spec.ts` | §5 |
| `e2e/reset-password.spec.ts` | §5 |
| `e2e/settings.spec.ts` | §5, §6 |
| `e2e/two-factor.spec.ts` | §5 |
