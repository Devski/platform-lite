repo: Devski/platform-lite
branch: main

## Last sync

date: 2026-09-13T18:36:10Z

### Updated in this project

- Read issues #195, #199, #200, #173 and copied `docs/ui-specification.md` (#185) into `docs/`.
- Redesigned the profile as a wall of work: `ProfileBar`, `AboutPanel`, `WorkCard`, `OrbitTile`; a work's landing page (#200); plaque grows with the name (#199).
- Wrote the implementation direction for #195 as `docs/claude-code-prompt-195.md`.

## Sync history

- 2026-09-06T18:57:02Z — first version of the design system from the repository's screens, dictionaries and the address-plaque memo; tokens, two UI kits, flagged substitutions (Google Fonts, Lucide).

## Screen map

| Screen | Repo files |
| --- | --- |
| `ui_kits/public-web/Hero.jsx` | `src/app/[locale]/(public)/page.tsx`, `src/app/[locale]/(public)/session-panel.tsx`, `docs/ideas/001-warsaw-address-plaque.md`, `messages/en.json` |
| `ui_kits/public-web/PublicProfile.jsx` | `src/app/[locale]/(public)/[handle]/page.tsx`, `owner-profile-view.tsx`, `profile-sections.tsx`, `works-gallery.tsx`, `docs/ui-specification.md` §3, §7, §8 |
| `ui_kits/public-web/WorkPage.jsx` | new view for #200; `works-gallery.tsx` (lightbox, orbit), `src/components/ui/orbit-*.tsx`, `docs/ui-specification.md` §8 |
| `ui_kits/public-web/NotFound.jsx` | `src/app/[locale]/not-found.tsx`, `messages/en.json` |
| `ui_kits/app/Auth.jsx` | `src/app/[locale]/(auth)/login/*`, `(auth)/register/*`, `(auth)/two-factor/*` |
| `ui_kits/app/Onboarding.jsx` | `src/app/[locale]/(app)/onboarding/*`, `src/app/[locale]/(app)/handle-form.tsx` |
| `ui_kits/app/ProfileEditor.jsx` | `src/app/[locale]/(app)/settings/profile/*` (superseded by panel editing — see `docs/claude-code-prompt-195.md` §4.4) |
| `ui_kits/app/AccountSettings.jsx` | `src/app/[locale]/(app)/settings/account/*` |
| `components/profile/*` | `src/components/ui/top-bar.tsx`, `plaque.tsx`, `works-gallery.tsx`, `docs/ui-specification.md` C-TOPBAR, C-PLAQUE, V-WORKS-LIST |
| `tokens/*.css`, `guidelines/*` | `src/app/globals.css` (Tailwind v4), `docs/ui-specification.md` §9 |
