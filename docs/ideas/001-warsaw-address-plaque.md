# Memo 001 — Warsaw address plaque

- **Status:** refining (idea-refine session of 2026-08-30 — Phase 1 done, convergence pending)
- **Feeds:** [#19](https://github.com/Devski/platform-lite/issues/19) (landing page),
  [#25](https://github.com/Devski/platform-lite/issues/25) (name/domain — structure decided),
  [#26](https://github.com/Devski/platform-lite/issues/26) (landing design),
  optionally [#27](https://github.com/Devski/platform-lite/issues/27) (default OG image)

## Raw idea (Dawid, verbatim, PL)

> Architektów 3d - tabliczka jak na budynku warszawskiej ulicy: nazwa, nr
>
> Podejścia A/B wdrażane 50/50:
>
> Tabliczka na biurowcu: Tu pracuje Twoje portfolio.
>
> Tabliczka na bloku wielorodzinnym: Twoje portfolio pod dobrym adresem

## Concept

The signed-out hero (A11: full-screen photo + entry to sign-up) shows a building facade
with a Warsaw-style address plaque — navy enamel, white lettering, red district band on
top (the city's MSI plaque style). The plaque reads **"Architektów 3D"**, which parses
two ways at once: _"3D architects"_ and a street address (_"Architektów St., no. 3D"_).

Two concepts run side by side, permanently:

| Concept         | Photo           | Copy (PL)                           | Copy (EN, draft)                   |
| --------------- | --------------- | ----------------------------------- | ---------------------------------- |
| A — office      | office building | Tu pracuje Twoje portfolio.         | Your portfolio works here.         |
| B — residential | apartment block | Twoje portfolio pod dobrym adresem. | A good address for your portfolio. |

## Decisions so far (2026-08-30)

- Debut location: **landing hero** (#19/#26).
- **Naming structure decided (2026-08-30, Dawid):** product = **"Architektów 3D"** —
  the platform for 3D artists, domain architektów3d.pl (ASCII twin architektow3d.pl
  is registered too; both delegated at OVH). Company = **"Architectorium"**
  (architectorium.com — note the _c_). **architektorium.pl / architektorium.com**
  (with _k_) = typo fallbacks, also guarding global expansion; all typo domains
  should 301 to the product's canonical host.
- The 50/50 split is **permanent by design** — two equal faces of the brand, not a
  short-lived experiment. Revisit after a quarter only if one variant clearly attracts
  more sign-ups.
- Consequence for the concept: the **street pun runs at full strength** — the hero
  plaque carries the product name as street + number. The earlier _-orium_
  ("a place for", as in _auditorium_) building-plaque reading belongs to the
  **company layer** (Architectorium): footer, legal, investor contexts — not the hero.
- **To settle (feeds G8/e-mail):** the canonical form of the product domain.
  Recommendation: ASCII `architektow3d.pl` serves the site and sends all e-mail
  (IDN sender domains render as punycode `xn--…` in many clients — deliverability
  and trust risk); the IDN form 301s to it. Observed 2026-08-30: both product forms
  and architectorium.com are delegated (OVH); the two architektorium typo domains
  show no DNS delegation yet — check the order status.

## Method notes (assumptions stated explicitly)

- The unit under comparison is the **whole concept** — photo and copy bound together.
  A quarterly readout can only say "concept A vs concept B", never which half did the
  work. If copy-level learning is ever needed, that is a separate one-variable test.
- "Unless one converts better after a quarter" requires instrumentation **from day 1**:
  a sticky variant cookie (assigned once in middleware) plus one column stamped at
  sign-up (e.g. `signup_landing_variant`). With an honest 50/50 assignment the expected
  denominators are equal, so comparing sign-up counts per variant is enough — no
  page-view counting, no external analytics. This is a conscious, minimal exception to
  §11 (product analytics out of scope): one column, zero new services.
- Reading a real difference needs volume — on the order of hundreds of sign-ups per
  quarter. At dozens, it is noise; the split then simply stays 50/50, which is fine
  by design.
- The metaphor is strongest in Polish (Warsaw plaques are instantly readable); in
  English it degrades to aesthetics, so the EN copy must stand on its own (A8 requires
  pl + en dictionaries either way).
- The MSI plaque system is the city's design work — stylize, don't clone the exact
  typeface and layout 1:1; verify before commercial use.

## Variations on the table (Phase 1)

1. **Straight execution** — as specified above. Design note: the red district band is a
   free slot for a second-level message (in the original it names the district).
2. **Inverted plaque** — the hero plaque shows the _visitor's_ future address
   ("Your Studio · /your-studio") instead of the brand; copy like "Twoja tabliczka
   czeka." Sells the product's core promise (your own address in 5 minutes) rather
   than the brand's metaphor.
3. **Plaque as the default link preview (#27)** — profiles without an avatar get a
   generated plaque (display name + /handle) as the Open Graph image; the hero then
   _quotes the product_ instead of decorating the page.
4. **Empty state as a construction site** — after sign-up, before photo/name: a
   construction-board screen "Tu powstaje portfolio" (echoing Polish "Tu powstanie
   osiedle…" boards). The metaphor carries the funnel: construction board → plaque.
5. **Decoupled copy pool** — treat the two lines as the first entries of a copy pool
   (dictionaries per A8 make this natural) and extend in both registers, PL+EN, e.g.
   "Portfolio z adresem, nie w załączniku." / "Od zera do adresu w 5 minut."
6. **Name-as-address, full consequence (#25)** — the domain itself reads as an address:
   `architektow3d.pl/your-studio` ≈ "Architektów 3D, unit _your-studio_".
   **No longer hypothetical (2026-08-30):** this is the plan of record — the product
   lives at architektów3d.pl and the typo domains 301 there. Still open from the
   original list: how the Polish genitive name works for the "then Europe" market —
   possibly answered by the company brand _Architectorium_ carrying international
   contexts; not blocking the MVP (market is Poland first).

## Open questions

- Which variations survive convergence (Phase 2 of the session)?
- Photo sourcing and license for both facades (#26 decides; A11 placeholder ships first).
- Plaque rendering: drawn (SVG component) vs photographed-and-retouched.
- Canonical product-domain form (recommended: ASCII serves + sends, IDN 301s) — the
  e-mail sender domain (G8) depends on it; see #25.

_(This file will be extended into a one-pager — recommended direction, MVP scope,
"Not doing" list — after the session converges.)_
