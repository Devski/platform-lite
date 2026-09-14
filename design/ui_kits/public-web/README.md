# UI kit — public web (architektow3d.pl, signed out)

Three surfaces an anonymous visitor can reach, recreated from
`Devski/platform-lite` on `main`:

| Screen | Source |
| --- | --- |
| `Hero.jsx` | `src/app/[locale]/(public)/page.tsx`, `session-panel.tsx`, `docs/ideas/001-warsaw-address-plaque.md` |
| `PublicProfile.jsx` | `src/app/[locale]/(public)/[handle]/page.tsx` |
| `NotFound.jsx` | `src/app/[locale]/not-found.tsx`, `messages/en.json` → `NotFound` |

## What is deliberately not here

- **No project gallery, about section or tabs.** SPEC.md §1 keeps a profile to a
  photo, a display name and an address. The public profile card leaves the
  space empty and says so on the page rather than inventing content.
- **The hero is a redesign of layout, not of content.** The product's own hero is
  a full-screen facade photograph with a card on top; the brief asked for the
  wise/revolut split, so the photograph moved into the right-hand panel and the
  plaque sits on it. Copy is verbatim from `messages/en.json` and the plaque memo,
  including both permanent 50/50 concept lines (the "Switch" link flips them).

## Copy

English strings are verbatim from `messages/en.json`. The Polish equivalents
live in `messages/pl.json`; only the two hero concept lines are wired up in
Polish here, because those exist verbatim in the memo.
