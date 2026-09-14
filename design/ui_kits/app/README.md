# UI kit — app (signed in)

The click-through starts on the login form: log in → 2FA challenge → two-step
onboarding → the profile editor, with account settings and a preview of the
public page reachable from the header. The bottom switcher jumps to any screen.

| Screen | Source |
| --- | --- |
| `Auth.jsx` | `(auth)/login/*`, `(auth)/register/*`, `(auth)/two-factor/*` |
| `Onboarding.jsx` | `(app)/onboarding/*`, `(app)/handle-form.tsx`, `src/lib/handle.ts` |
| `ProfileEditor.jsx` | `(app)/settings/profile/*` (page, `avatar-section.tsx`, `display-name-form.tsx`) |
| `AccountSettings.jsx` | `(app)/settings/account/*` (page, password, e-mail, `two-factor-settings.tsx`) |

## Departures from the current product, and why

- **Profile editing is one page, not a stack of four cards.** The brief asked for a
  LinkedIn-shaped profile: photo, name and address sit in one header card with
  inline editing, and the per-concern cards follow underneath. Every field,
  hint, limit and message is still the product's own.
- **The plaque panel** on the right is the product's own share-card idea (#27)
  surfaced in the editor, not a new feature.
- **Nothing was added.** Projects, galleries, an about section, tabs, follows —
  none of them exist in the product, so the editor shows one dashed empty state
  saying so instead of mocking them up.

State is faked in the browser: handle availability checks a small local list
(`studio`, `praga`, `admin`, `kowalski` are "taken"), the photo upload swaps in
a bundled image after a delay, and no request leaves the page.
