# Spec: platform-lite — MVP

Repository: https://github.com/Devski/platform-lite
Status: **awaiting approval** · 30 August 2026 · nothing is implemented yet.
Product: **Architektów 3D**, at `architektow3d.pl` (decided 05.09.2026, §12).
`platform-lite` stays the repository and working name.

Source documents with the full rationale behind the decisions (in Polish):

- Decision card: https://claude.ai/code/artifact/e08d7ff7-26e1-4b7c-8ead-260200b040d1
- File storage and transfer costs (14 providers): https://claude.ai/code/artifact/931d4f6c-1676-44dc-8076-023883402d74
- Transactional e-mail costs (8 providers): https://claude.ai/code/artifact/70cbb3dd-5d94-42a4-90b1-2bc7f34b637a

The interface as it stands on 12.09.2026, written for the agent that implements the redesign
(#185): [docs/ui-specification.md](docs/ui-specification.md) — every view in every mode, its
controls, the design decisions behind them and the inconsistencies found; its screenshots are
on https://claude.ai/code/artifact/37a17f91-9bd7-4641-8108-448f20987ac3.

Lineage: the MVP corresponds to the `foundation → identity → profiles` modules of the approved
capability map in the `platform` repository (CAPABILITY-MAP.md). Deliberately merged here
into a single application and a single spec — that is the essence of "lite".

---

## 1. Goal

An architecture studio or a 3D artist enters the platform and within a few minutes has a
public profile page at `/handle` — look inspired by a LinkedIn company page (the visual
style only: blue accent, denser typography, cards with thin borders; without the
company-page structure — no tabs). Since 08.09.2026 the profile carries its own
sections — a cover photo, a headline, where the studio works, an "About" text and a
list of works (A12) — because a page with only a name and a photo is a business card,
not a portfolio.

**One persona:** the provider — a studio or a solo creator. Market: Poland, then Europe.

**MVP success:** a new user, with no assistance, goes from landing on the homepage to a
working public link with their name and photo in under 5 minutes.

**Experience is a foundation, not a finish.** "Without assistance" is the whole
criterion: a product nobody can use unaided is a product nobody uses. The same standard
covers moving a button, enlarging a photo, refusing what the database would refuse
anyway, and writing an error somebody can act on — they differ in urgency, never in
kind. The test is that the person is never lost and never has to guess. Work labelled
`ux` may be sequenced late; it is not optional, and "cosmetic" is not a reason to drop
it (Dawid, 06.09.2026).

### Acceptance criteria

| #   | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Registration with e-mail + password (8–128 characters, no composition rules, attempt rate limiting). Account inactive until the verification link is clicked (valid 24 h, resend max 3/h).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A2  | Login and logout. Session: `httpOnly` + `secure` + `sameSite=lax` cookie, 30 days, renewable. Password hashes exclusively in our Postgres.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A3  | Password reset: single-use link valid 60 min; after a successful change, a notification to the account address.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A4  | Profile: display name (1–80 characters) and photo (JPEG/PNG/WebP ≤ 10 MB), from which WebP variants at 512 px and 128 px are produced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A5  | Handle: 3–30 characters, `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, case-insensitive uniqueness, reserved-word list (incl. `pl`, `en`, `api`, `admin`, `login`, `settings`, `assets`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A6  | Handle change: no more than once per 30 days. The old address responds 301 to the new one, **until someone claims the old name — old handles return to circulation immediately** (decision of 30.08.2026; impersonation risk accepted consciously, see §10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A7  | Profile page `/handle`: server-rendered, correct `<title>`, description, Open Graph (image = avatar), canonical. Indexed **only in production** — dev and PR previews send `X-Robots-Tag: noindex`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A8  | Interface in Polish and English, architecture open to further languages: all texts via dictionaries, no strings in components. Polish unprefixed (`/handle`), English prefixed (`/en/...`); selection: `Accept-Language` header + a switcher stored in a cookie.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A9  | 10 GB limit per user, free of charge (the MVP has no payments; 1 GB until 09.09.2026, raised for the first real orbit archive — #115). Usage computed in the database from file sizes; an upload over the limit is rejected with a clear message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A10 | Seven transactional e-mails (verification, re-verification, reset, password-change confirmation, address change ×2, handle change) via Scaleway TEM. SPF, DKIM and DMARC configured before the first real message goes out. Zero marketing e-mail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A11 | Homepage for signed-out visitors: full-screen photo + entry to sign-up/sign-in. Visual design — open (§12); the MVP ships a style-consistent placeholder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A12 | Profile sections (decision of 08.09.2026, #72), all optional: cover photo (as A4, WebP variants 1600/480 px wide, aspect kept); headline (≤ 220 characters); places — up to 8, each a TERYT name (a voivodeship, county, commune or any locality: the GUS registers are in the database and searched on the server, #87) or free text (≤ 80); bio (≤ 1500, line breaks kept). Works: up to 10 per profile; name required (≤ 120), investor and developer (≤ 120), 1–3 photos (as A4, one of them the main photo) — or 0–3 when the work carries an R360, whose start frame is then the main picture (decision of 09.09.2026); an R360 orbit, made from a zip the owner's browser reads on their own machine and never sends (A13). Edited in place on the owner's page; public the moment it is saved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A13 | R360 (decision of 09.09.2026, #68; the zip stopped being uploaded on 10.09.2026, #120): a work's orbit zip is opened in the owner's browser, **on their own machine, and never leaves it** — the browser validates it, then reduces every frame to WebP at 1600 and 800 px wide and uploads only those; the server never sees the archive at all and verifies only the count, the sizes and a sample of headers of the frames that arrived. Frame order = the number in the file name (the last run of digits, a contiguous range, no gaps; the contract on #64). The visitor sees one frame at a time and orbits by dragging the picture — relative, discrete, wrapping past the last frame — or on an elliptical ring dial that shows the position, travels on click and fills as frames load. Five parameters per work, set in edit mode: frame count (detected, 2–360), direction, frames per picture width (1–N), start frame, ring flattening (1 = a circle). Cue points (#107, decided with Dawid on 11.09.2026): up to 12 named frames per work, each a marker on the ring — its name beside it only while it is pointed at (the mouse on it or on its button; a click or a tap goes there) — and a button in a row under the picture that goes there in one press. Motion (#153, wanted by Dawid on 11.09.2026; trimmed on 12.09.2026): an orbit thrown with the hand keeps turning and slows to a stop. A click travels at one pace — the ease in and out of its frame, and the owner's switch over it, were taken out the day after they shipped, along with the amounts #175 was to add: the product is losing functions rather than gaining them (Dawid). A visitor whose system asks for less motion is not thrown at all. A phone's public page shows no ring at all, only the buttons; the redesign will keep the ring for the enlarged view on the profile page too. A new zip with the same frame count as the orbit last in the form keeps its parameters and cue points; another count starts from the defaults, and a zip of another count picked by mistake and taken out untouched does not wipe what the one before had. Every stage of the owner's flow has a progress bar. |

---

## 2. Stack

Versions checked in August 2026 — at implementation start, verify current releases against
official documentation (source-driven rule).

| Layer       | Choice                                                         | Rationale in short                                                                                        |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Framework   | **Next.js 16 (LTS, App Router)** + TypeScript strict           | SSR for profile-page SEO; the largest corpus of good code = fewer mistakes when working with Claude Code. |
| Runtime     | Node.js 24 LTS, pnpm ≥ 11                                      |                                                                                                           |
| Database    | **PostgreSQL 17** + **Drizzle ORM**                            | Prod: OVH Managed (1 node + backups). Dev: a container on the dev instance. Migrations in files (G6).     |
| Auth        | **Better Auth** — e-mail + password, cookie sessions           | Hashes with us → zero lock-in on the most sensitive layer. Verify version and API at start.               |
| i18n        | **next-intl**                                                  | `messages/pl.json`, `messages/en.json`; prefix strategy per A8.                                           |
| Files       | **OVHcloud Object Storage (S3)** behind our own interface (G1) | Cheapest in the EU, **zero egress** (abolished Jan 2026; fair use confirmed with OVH on 30.08.2026).      |
| Images      | **sharp** at upload                                            | WebP 512/128 variants, names = content hash (G2).                                                         |
| CDN         | OVHcloud CDN                                                   | Enabled only at production launch.                                                                        |
| E-mail      | **Scaleway TEM**                                               | No fixed fee, 300 messages free, €0.25/1000; French company, Warsaw data center.                          |
| Styling     | **Tailwind CSS 4** + our own primitives                        | Small design system, full control over the LinkedIn-like style.                                           |
| Validation  | **Zod** — the same schemas client/server                       |                                                                                                           |
| Tests       | **Vitest** + **Playwright** (+ @axe-core/playwright)           |                                                                                                           |
| Deployments | **Docker + GitHub Actions**                                    | `git push` = deploy; the image is built in CI, never on the instance; rollback = redeploy an older tag.   |
| Servers     | **OVHcloud Public Cloud**                                      | Prod: `eu-west-par` (3-AZ). Dev: `waw` (lowest latency from Poland).                                      |

The overriding rule behind these choices: **no layer may have an exit cost greater than one
week of work.** Hence plain Postgres, standard S3, a Docker image, self-hosted auth.

Costs: ~€9/month during build, ~€105/month after launch (breakdown in the decision card).

---

## 3. Commands

```
pnpm dev              # dev server
pnpm build            # production build
pnpm start            # run the production build

pnpm lint             # eslint . --max-warnings 0
pnpm lint:fix
pnpm format           # prettier --write .
pnpm typecheck        # tsc --noEmit

pnpm test             # vitest run
pnpm test:watch
pnpm test:coverage    # vitest run --coverage
pnpm test:e2e         # playwright test

pnpm db:tunnel        # SSH tunnel to the dev database (docs/dev-environment.md)
pnpm db:generate      # drizzle-kit generate (schema → SQL migration)
pnpm db:migrate       # apply migrations to the DATABASE_URL database
pnpm db:seed          # test data: a dozen-plus profiles with photos (G7)
pnpm db:import-teryt  # the GUS TERYT registers into `places` (downloads them; #87)
pnpm db:studio        # drizzle-kit studio

pnpm check            # typecheck && lint && test:coverage  ← the gate before every commit
```

Locally **without Docker** — work against the remote database (through the SSH tunnel,
`pnpm db:tunnel`) and remote S3 (region `waw`).
The production image is built **in CI** from the `Dockerfile` in the repo root (Next.js
`standalone`) and published to a container registry; the instance only pulls and runs it.
Decision of 05.09.2026, replacing Coolify: a Next.js build wants more CPU and memory than the
whole dev instance has, while the running app is one Node process of ~200 MB — so the box that
comfortably _runs_ the application cannot _build_ it, and the build does not need to be there.

---

## 4. Project structure

```
src/
  app/
    [locale]/               # pl unprefixed, /en/... prefixed (A8)
      (public)/
        page.tsx            # homepage for signed-out visitors (A11)
        [handle]/page.tsx   # public profile page (A7)
      (auth)/               # sign-up, login, verification, reset
      (app)/settings/       # profile, handle, account
    api/                    # route handlers (upload confirm etc.)
  lib/
    storage.ts              # G1: the ONLY place touching S3
    email.ts                # the only place touching Scaleway TEM
    handle.ts               # validation, reserved words, cooldown
    quota.ts                # usage counting (A9)
  db/
    schema.ts               # source of truth for drizzle-kit
  i18n/                     # next-intl configuration
  proxy.ts                  # locale detection (A8); the 301 from an old handle (A6, §9)
messages/
  pl.json  en.json          # ALL interface texts
drizzle/                    # generated SQL migrations — committed
e2e/                        # Playwright tests
docs/                       # decisions, archive
  dev-environment.md        # dev infrastructure: manual console steps + scripted bootstrap
scripts/                    # bootstrap-dev.sh, cloud-init template, db-tunnel helper
README.md                   # developer onboarding: quick start, pointers to SPEC and docs
Dockerfile
.env.example                # DATABASE_URL(_TEST), S3_ENDPOINT/REGION/BUCKET/KEY/SECRET,
                            # EMAIL_* (TEM), APP_URL, APP_ENV, AUTH_SECRET, DEV_SSH_HOST
                            # — no values
```

File environments: the `platform-dev` bucket (per-developer and per-PR prefixes, e.g.
`devski/`, `pr-7/`) and a **separate** `platform-prod` bucket with separate keys — a
developer key physically cannot touch production files.

**Per-developer naming convention:** the suffix is the GitHub handle, normalized to a
Postgres identifier (lowercase, `-` → `_`): database `platform_devski`, test database
`platform_test_devski`, S3 prefix `devski/`.

---

## 5. Code style

- TypeScript strict; `any` banned (exceptions only with a justifying comment).
- Identifiers, comments and code commits — in English. UI texts — only via dictionaries (A8).
- Everything in the repository and on GitHub — documents, issues, pull requests, milestones,
  labels — always in English (decision of 30.08.2026). Chat communication — in Polish;
  the decision artifacts linked in the header remain in Polish.
- Server Components by default; `"use client"` only where there is interaction.
- Input validation at the edge (Zod), types derived from the schemas.
- Formatting: Prettier (defaults) + ESLint with zero warnings.

Pattern — the thin storage interface (G1) and naming style:

```ts
// src/lib/storage.ts — the ONLY file that talks to S3.
export interface FileStorage {
  presignUpload(
    key: string,
    opts: { maxBytes: number; contentType: string },
  ): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  // Size and type without the body — how a staged frame is checked
  // without reading it into the app (#102).
  headObject(
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string; etag: string }>;
  // A copy inside the bucket — how a staged frame reaches its final key
  // without passing through the app (#102).
  copyObject(from: string, to: string, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string; // stable, unsigned (G3)
}

// G2: content-addressed name → served with max-age=31536000, immutable.
// Since #72 the name sits under its owner — one object belongs to exactly
// one account (§9); rows written before keep the `a/` key they record (#49),
// which contentKey() still derives for them and nothing else.
export function ownerKey(
  userId: string,
  hash: string,
  ext: string,
  prefix = "",
): string {
  return `${prefix}u/${userId}/${hash}.${ext}`;
}
```

---

## 6. Test strategy

| Level       | Tool                   | Scope                                                                                                          | Where                                                                                       |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit        | Vitest                 | `lib/handle` (regex, reserved words, cooldown), `lib/quota`, `contentKey`, image variants                      | `src/**/*.test.ts` next to the code                                                         |
| Integration | Vitest + test database | auth flows, handle change with 301, usage counter                                                              | `DATABASE_URL_TEST` → a separate `platform_test_<github-handle>` database on the dev server |
| E2E         | Playwright             | happy path: sign-up → verification → profile → public profile page; login and reset smoke; axe on public pages | `e2e/` (database optional) and `e2e/db/` (needs one)                                        |

- Coverage: no percentage fetish; a hard minimum of **80% for `src/lib/`** and a test for
  every criterion A1–A13 (A11 — visual, no requirement).
- E2E splits into two Playwright projects over **one** dev server (Next takes an exclusive
  lock on its dist directory, so a second one cannot start in the same working tree):
  `chromium` runs everything outside `e2e/db/`; it proves the fail-closed behaviour in the
  runs started without `DATABASE_URL_TEST`, which is how CI invokes it — "no database" is a
  property of the **run**, not of the project. `chromium-db` runs `e2e/db/**` — the journey,
  the reset round trip and axe on a live profile — and needs `DATABASE_URL_TEST`, which the
  server's `DATABASE_URL` is taken from: without it a local run reports itself **skipped**,
  while CI fails rather than report a green suite that executed nothing.
- CI (GitHub Actions): `pnpm check` + build on every PR; Postgres as a service container;
  BOTH browser suites on every pull request and every push — the database-less `chromium`
  project, and `chromium-db` against a throwaway PostgreSQL 17, two Playwright runs so each
  project gets the server it needs. The full run depends on `check`, so the production build
  is compiled before the browser ever opens.
- The full journey runs **twice per change**, and that is deliberate (#40, 06.09.2026). On the
  pull request it is the gate: a broken journey does not get merged. On `main` it is the
  precondition for the dev deployment, which is the only place that can decide what the
  instance receives. Usually the same code both times; what the second run buys is the window
  where `main` moved in between. It used to fire only on a tag or on demand, and in that
  arrangement two faults reached dev on 05.09.2026 and were found there by a person using the
  product. Measured cost of the run: 227 seconds, in parallel with the rest.
- A bug fix starts with a test that reproduces the bug.

---

## 7. Boundaries

**Always (G1–G10 — numbering shared with the decision card):**

- **G1** Storage behind a thin interface — S3 called exclusively from `lib/storage.ts`.
- **G2** File name = content hash; served with `max-age=31536000, immutable` (two
  exception, immutable all the same and recorded in §9: the R360 frames, keyed by set and
  ordinal).
- **G3** Public photos have stable, unsigned addresses; signatures only for uploads.
- **G4** User files never pass through the application server (upload via presigned URL;
  variants generated server-side from a copy fetched over the internal network — with one
  exception, the R360 frames of A13, produced in the owner's browser because the server
  never receives the archive and the one core must not decode 120 frames; decision of
  09.09.2026, risk in §10).
- **G5** Size variants + a new-generation format for every publicly served image.
- **G6** Database schema changes exclusively via migrations in files.
- **G7** `pnpm db:seed` kept current — a fresh environment in a minute.
- **G8** SPF, DKIM, DMARC configured before the first real e-mail.
- **G9** No deployment control panel on the servers. Inbound is `80/443` for the application
  and `22` for SSH with key authentication only; deployment credentials live in the CI
  secret store, never on the instance. (The decision card's R9 named Coolify's panel — the
  rule was always "the deployment control surface is not exposed", and after 05.09.2026 the
  surface is CI, so it is protected where CI lives.)
- **G10** Instance restore procedure written down in `docs/` and drilled once.
- Additionally: `pnpm check` before every commit; all texts via dictionaries;
  descriptive commits; secrets only in environment variables.

**Ask first:**

- a new production dependency; a major version change of the framework/database;
- changes to the auth/session schema;
- anything that creates a new service or a new cost at a provider;
- every production deployment; CI configuration changes.

**Never:**

- secrets in the repository (`.env` in `.gitignore`; `.env.example` without values);
- signed URLs on public photos (G3) or files passing through the application (G4);
- deleting or skipping red tests without approval;
- services outside the EU/EEA in the personal-data path;
- marketing e-mail from the transactional infrastructure;
- `git push --force` on `main`.

---

## 8. Environments and deployments

| Environment | Where                                             | Database                                                                                                 | Deployment                                                                |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Local       | developer machine                                 | remote `waw` over an SSH tunnel (per developer: `platform_<github-handle>`, for Dawid `platform_devski`) | —                                                                         |
| PR preview  | dev instance, `*.dev.architektow3d.pl`            | a copy of dev, taken when the preview starts and dropped with it (#113)                                  | automatic on PR open, deleted after merge; `*.dev.architektow3d.pl` (#31) |
| Dev         | OVH `waw`, d2-2 (€7), `dev.architektow3d.pl`      | Postgres in a container                                                                                  | automatic from `main`                                                     |
| Prod        | OVH `eu-west-par`, b3-8 (€35), `architektow3d.pl` | Managed PostgreSQL (€59)                                                                                 | **manual**: an approval gate in the deploy workflow, or a `vX.Y.Z` tag    |

- Dev infrastructure is bootstrapped by script (`scripts/bootstrap-dev.sh`; manual console
  prerequisites and the full procedure in `docs/dev-environment.md`) — executing that
  document verbatim doubles as the G10 drill for dev. The database container binds to
  `127.0.0.1` and is reachable only through the SSH tunnel — never exposed publicly.
- **How a deployment happens** (decision of 05.09.2026): a push builds the image in CI,
  publishes it to a container registry, then connects to the instance over SSH and restarts
  the container against the new tag. On the instance itself there is only Docker: the
  application container, a reverse proxy terminating TLS, and — on dev — the Postgres
  container. Nothing is compiled on the servers.
- **A deployment migrates before it serves** (#53): between pulling the image and starting
  the new container, the deployment runs the migrations that shipped inside that image. It
  used to leave the schema to whoever remembered, and on 06.09.2026 that put dev on new
  code against an old schema — every profile page 500'd for ten minutes, with CI green and
  the container calling itself healthy. A migration that fails ends the deployment there:
  the previous container is still serving and the previous schema is untouched.
- **Rolling back is redeploying an older tag — of the CODE.** A migration that has run has
  run; pulling an older image does not undo it. That is what makes the expand-then-contract
  shape of G6 load-bearing rather than a style: a migration that only ADDS is one an older
  image can still run against. One that drops or renames removes the ability to roll back
  at all, and has to be treated as a one-way door on the day it ships.
- Nothing "moves" from dev to prod — both are built from Git; database structure travels
  via migrations, data never does.
- **Prod sizing is a launch-day estimate, not a measurement.** `b3-8` and the managed
  database were priced for a launch that has no traffic yet; the application is one Node
  process. Both can start smaller and grow — the exit cost is low by design (plain Postgres,
  plain Docker image). The one line worth paying from day one is the managed database, and
  not for performance: prod holds real accounts and photos, so someone else's backups and
  patching is the product being bought. To settle with #24.
- **A preview runs on a copy of dev, not on dev** (#113, decided 09.09.2026): when a preview
  starts, `deploy/preview-up.sh` copies dev's database into `platform_pr_<n>` with `pg_dump`,
  runs the pull request's own migrator against the copy, and points the container at it;
  closing the pull request drops it. Previews never migrated, so before this every pull
  request that added a column its pages read previewed as a server error — twice in five days
  (#112, #170), each time exactly when the preview existed to be looked at. Not "the preview
  migrates the shared database": a pull request revised after its preview ran would leave a
  migration in dev's journal whose hash no longer matched the file, and the next deployment of
  `main` would fail on it. What a preview therefore is: dev's data as of its start, plus this
  pull request's schema. Accounts created in a preview, and the rows recording what was
  uploaded there, die with it. Three things follow from the copy and are enforced rather
  than hoped for: dev's `sessions` and `verifications` are emptied in the copy (signing out
  on dev cannot reach a copy, so a copied session would be a credential nothing could
  revoke — you sign in to a preview); a delete may only touch keys under the environment's
  own prefix (`src/lib/storage.ts`), because the copy's rows name dev's objects in the
  bucket everything shares; and a copy with no container is dropped by the next
  `preview-up.sh`, since only closing the pull request would otherwise remove one.
  What stays shared: the bucket (new writes under `pr-<n>/`), the signing key, the instance.
  **The signing key being shared is the thing production must not inherit** — one
  `AUTH_SECRET` across environments plus a copy of the rows is how a session from one
  becomes a session in another; #24 gives production its own.
- **What needs a decision reaches a person by itself** (#167, `docs/operations.md`): every
  hour `deploy/ops-check.sh` looks at the instance — disk, containers, whether the site
  answers, the nightly copy, preview copies nobody owns, the R360 collector's findings,
  database deadlines, server errors, the mail provider's failures and blocks — and mails
  `OPS_EMAIL` when something needs acting on, plus a report every morning either way, so an
  empty inbox means "checked" and a missing report is itself the signal. Whether the site
  answers from outside is `.github/workflows/watch.yml`, which opens and closes an `outage`
  issue: a box cannot report its own death. Three tiers and no more. The reports carry counts,
  never an address or a log line (§7). Application logs live in the host journal, capped,
  because a log inside the container's directory died with every deploy. No new provider and
  no new cost: the mail goes through the transactional provider the application already uses.
- **Every wait on the database has a deadline, and each environment sets its own** (#172):
  the pool answers a caller it cannot give a connection to within five seconds instead of
  queueing them for ever, and the server cuts off a statement that runs past ten seconds or
  waits past three for a lock. The numbers live in `src/db/client.ts`, sized for dev's one
  core shared by dev and every preview, and each is an environment variable (`DB_POOL_MAX`,
  `DB_CONNECT_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`,
  `DB_IDLE_TX_TIMEOUT_MS`) because prod's managed database is another machine with another
  cap. They travel in the connection, not in `DATABASE_URL`, so a migration or a script is
  never cut off by a bound meant for a page — the scripts ignore those variables entirely.
  The migration runner keeps one bound of its own, and it guards the site rather than the
  migration: five seconds of waiting for a lock, because the old container is still serving
  and a migration queueing for `ACCESS EXCLUSIVE` queues every reader of that table behind
  itself.
- Outside prod (`APP_ENV` other than `production`): `X-Robots-Tag: noindex` (A7) — set on
  every response by `src/proxy.ts`; the deployment provides `APP_ENV`.
- One time zone for the whole interface: `Europe/Warsaw` (next-intl `timeZone`; decision of
  02.09.2026 with #15). Dates render identically on the server and in the browser; per-user
  zones are not a need yet.
- Resilience: cold standby (snapshot + the G10 procedure). Deliberately no load balancer
  and no second database node — they would triple the cost while protecting near-zero traffic.

---

## 9. Data model (outline — migrations are the source of truth)

- `users`, `sessions`, `verifications` — Better Auth tables (passwords: scrypt/argon2 per
  the library). `users.id`: UUID generated **in the database** (`gen_random_uuid()`); the auth
  library is configured not to generate ids on the application side (verify the exact option
  at start).
- `profiles`: `user_id PK/FK`, `display_name`, `handle` (unique on `lower()`),
  `handle_changed_at`, `avatar_file_id`; since #72 (A12) `headline`, `locations`
  (`text[]` — a place is a label, never a key), `bio`, `cover_file_id`. The A12 lengths
  are `CHECK`s as well as Zod rules, pinned to each other by a test (#39) — with one
  exception: a `CHECK` cannot measure each element of an array, so the 80 per place is
  Zod's alone and the database holds only the count (≤ 8), no NULL element, and the
  total (≤ 640).
  **A handle is an attribute, not an identifier**: despite its uniqueness it is never the
  target of a foreign key — all relations point at `users.id`, so a handle change touches
  no relation.
- `works` (#72): `id`, `user_id` (cascade — a work is profile content), `name`,
  `investor`, `developer`, timestamps. At most 10 per user, counted by the
  application under the per-user advisory lock the quota uses; a `CHECK` cannot count
  rows. Order on the page = `position`, which the owner sets by dragging (#66); `created_at`
  and `id` only break ties. Since #68 (A13) also `r360_set_id` — the prefix
  of the frame set — and `r360_params` (`jsonb`: frame count, direction, frames per picture
  width, start frame, ring flattening, and since #107 the optional cue points — up to 12
  `{ frame, label }`, one a frame, a label of 1–40 characters), Zod and `CHECK` pinned to
  each other as in #39.
- `places` (#87): reference data, not the user's — every unit and locality of the GUS
  TERYT registers (TERC, SIMC): `code` (PK, derived from the register's codes), `kind`
  (voivodeship, county, commune, city, village, settlement, part), `rank` (whole places
  before parts), `name`, `name_folded` (lowercase, no diacritics; the prefix index the
  search uses), the commune, county (with its kind) and voivodeship it lies in, `as_of`
  (the register's date). Owned by `pnpm db:import-teryt`, which upserts by code and
  drops what a newer register no longer carries; the app only reads it.
- `work_images` (#72): `work_id` (cascade), `file_id` (restrict — the bytes are an object,
  removed by code), `position` 0–2, `PK (work_id, position)`. **Position 0 is the main
  photo**; choosing another main reorders the positions rather than flipping a flag that
  could disagree with them. Reordering is a delete-and-reinsert of the work's rows in one
  transaction: the key is not deferrable, so no sequence of `UPDATE`s can swap two
  positions without passing through a duplicate. `secondary_file_id` (#99, nullable, restrict, `CHECK <> file_id`):
  the photo's second channel — the same view the other way (before/after, day/night,
  render/photograph), uploaded and freed like the photo; a file named as a channel by any
  row is in use. A channel used twice in one work, or equal to another row's photo, is
  refused by the application (the input schema); the database checks only within the row.
  Shown by the reveal slider (#100); until then the first channel shows.
- `handle_redirects`: `old_handle PK`, `target_user_id`, `created_at`.
  Resolving `/X`: profile → redirect (301 to the target's current handle, answered by
  `src/proxy.ts` with `Cache-Control: no-store`, so a released address is never served
  from a browser cache) → 404.
  The page adds two answers of its own, both 308 (a page cannot emit 301): a case variant
  such as `/Studio-Praga` settles on the canonical lowercase address, and an old address
  redirects from here when the proxy's lookup failed open or timed out. Both keep the query.
  Registration of handle `X` by anyone **deletes** the redirect row (A6).
- `files`: `id`, `user_id`, `sha256`, `size_bytes`, `kind`, `parent_file_id`, `ext`,
  `object_key`, `created_at`. `kind` names every stored representation: the avatar set
  (`avatar-original|avatar-512|avatar-128`), and since #72 the cover set
  (`cover-original|cover-1600|cover-480`), the work-photo set
  (`work-original|work-1600|work-480`). An original has no parent; a variant hangs off its
  original by `parent_file_id`, which is how the dedup indexes tell the roles apart. The
  enum still carries `r360-zip` from before #120 and nothing writes it — a Postgres enum
  value cannot be dropped, and migration 0017 deleted the last rows that used it.
  The per-user sum of `size_bytes` = quota usage (A9; #69 narrows it to the largest kept
  representation of every asset).
  The R360 frames (A13, #68, decision of 09.09.2026) are the exception to the hash-named
  key: kinds `r360-1600|r360-800`, **no parent** — the zip they were made from never
  reached us (#120), so there is no row to hang them from — and keys
  `u/<user id>/r360/<set id>/<width>/<index>.webp` — the set id minted by the server in
  one batch presign that returns every frame's URL, the index the frame's ordinal 1..N in
  sorted order, not the number from its file name. Frames are also the exception to "one
  variant per kind per original": the partial unique index on
  `(user_id, parent_file_id, kind)` excludes the `r360-*` kinds, and so does the index on
  originals, which parentless frames would otherwise fall into — two frames of one orbit
  that encode to identical bytes would collide there (#120). Since #126 they are presigned
  straight to the set's final keys under the reservation of #30, and that reservation row is
  what marks a set unfinished: the save deletes it, and a row past its window is a set
  nobody finished. The collector removes such a set's objects, then its row — lazily on
  that owner's next presign, and on its own every 12 hours on dev and in production, never
  in a preview, which shares dev's database (#127, #113). It deletes only what a record
  names and never a set a `files` row names; a set no record names at all is counted and
  named in the collector's log, and left where it is for a human (#156). A set is never rewritten — a new zip is a new set — so G2's immutable caching holds,
  and a work's set is deleted by prefix. The A9 limit and the #69 meter are one number: it
  counts the 1600 set.
  **An object has one owner** (decision of 08.09.2026): keys written since #72 are
  `u/<user id>/<sha256>.<ext>`, so identical bytes from two accounts are two objects and a
  work — or an account (#34) — is deleted by prefix. A bucket per user was ruled out:
  OVHcloud allows 100 per project (1,000 on request), names unique across OVHcloud.

---

## 10. Risks accepted consciously

| Risk                                                                                              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old handles returning to circulation immediately → possible impersonation at an abandoned address | Decision of 30.08.2026. To revisit once real profiles with reputation exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A single app instance, a single database node                                                     | Cold standby + backups. HA only once downtime starts costing more than €56/month.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A free 10 GB for everyone                                                                         | Safe thanks to OVH's zero egress; pain threshold ~~1,000 full accounts (~~€75/month; 1 GB and ~~10,000 accounts until 09.09.2026, when a 1.8 GB archive of PNG frames did not fit). Revisited on #115 after global photo processing (#71) — then a conversation about a paid model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Scaleway TEM deliverability to Polish mailboxes unverified                                        | Test on Gmail/Onet/WP/Interia before launch; plan B: EmailLabs (an SMTP configuration change).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Staged uploads are accounted only while their reservation window is open                          | The A9 quota counts bytes reserved at presign (#30). Past the window a walked-away upload stops counting and is swept on that user's next presign; the bucket's `staging/` lifecycle rule is the outer bound, and S3 expiration cannot go below one day. Decision of 05.09.2026. R360 frame sets no longer stage (#126): their reservations stop counting the same way, and the collector removes what they held within 12 hours (#127).                                                                                                                                                                                                                                                                                                                           |
| 100 MB/page-view is an estimate, not a measurement                                                | Verify with telemetry after launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R360 frames are encoded by the owner's browser, not by sharp (G4's exception, A13)                | Encoder output differs between browsers, and since #120 the server has no archive to re-derive a frame from at all — the zip stays on the owner's machine. Accepted 09.09.2026 and sharpened 10.09.2026: the one core must not decode 120 frames per work, and a set that has to be made again is made again from the owner's own file. The frames are what the platform stores; a browser that encodes no WebP (Safari) cannot produce a set, and is told so before anything is reserved.                                                                                                                                                                                                                                                                         |
| R360 frame uploads are presigned without a length (#102)                                          | A frame's size is unknowable when the set's 2N URLs are minted, so its PUT is the one upload whose Content-Length the signature does not pin. The reservation counts the set at its ceilings (1 MiB and 384 KiB per frame), the save refuses any frame past its ceiling and discards the whole staged set at once, and the collector bounds what a client that never saves can leave (every 12 hours since #127; the `staging/` lifecycle rule until #126). Residual, accepted 09.09.2026: unfinished bytes bounded by the uploader's bandwidth, for the reservation's window and up to 12 hours after it. The fix on the table is a presigned POST policy with `content-length-range`, a new dependency (§7 "ask first") to verify against the real bucket first. |
| R360 frames are published as uploaded (#102)                                                      | The frames are the first user bytes served public without passing through sharp. The save reads every frame's WebP container header (`RIFF`, a size field that agrees with the object, `WEBP`, a first chunk the format defines) — not a decode — and serves them as `image/webp` from the bucket's origin, which carries no application cookie. Residual: a frame is whatever passes that header check, at most a megabyte, at a stable public address. A server-side decode of the 800 set off the request path stays possible, as the row above says.                                                                                                                                                                                                           |
| Safari's canvas encodes no WebP                                                                   | The frame pipeline (#102) asks the browser to encode WebP; Safari answers a PNG. The form probes once before a set is presigned and tells the owner which browsers work, so no reservation is taken for nothing. Owners on Safari produce their sets in another browser until a server-side pass exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| An orbit is painted from frames kept decoded in memory (#117)                                     | A viewer that swaps an `<img>`'s address per frame stands empty until each frame is fetched and decoded, which flashes the ground on every turn (measured in Chrome, and reported by Dawid on 09.09.2026). The frames are therefore decoded once and painted onto a canvas. The owner's preview holds them as bitmaps, which keep their pixels: bounded at 128 MB, so an orbit past roughly ninety frames at 800 px shows its nearest resident frame while the far side is out of the window — a coarser turn, never a blank one. A visitor's frames cost nothing to hold: the element is a handle and the browser owns the pixels. Decision of 09.09.2026.                                                                                                        |

---

## 11. Consciously out of scope

Payments and plans · provider catalog/search · the developer persona (the other side of the
market) · the 3D-mockup engine and marketplace · profile tabs, news, team (the cover photo
and the "About" section left this list on 08.09.2026 — A12) · draft/published toggle ·
messages and a contact form · following ·
team accounts · user custom domains · an admin panel · product analytics · compliance beyond
the minimum (personal data kept separate so more can be added without a rebuild) ·
HA/multicloud/Terraform · Docker and MinIO locally.

---

## 12. Open questions

- [x] **Product name and domain** — resolved 05.09.2026. The product is
      **"Architektów 3D"**, and the canonical domain is the ASCII form
      **`architektow3d.pl`**: it serves, and it sends e-mail (G8), exactly as the
      30.08.2026 recommendation proposed. Nine domains are registered around it
      (typo and IDN variants); every one of them 301s to the canonical domain,
      and only the canonical one serves or sends. Company: **"Architectorium"**
      (architectorium.com). Per-environment hostnames are in §8.
      Note for #22: the domain already carries mailboxes (OVHcloud Zimbra), so
      there must remain exactly **one** SPF record — Scaleway is merged into the
      existing one, never added beside it. Two records fail both, taking the
      existing mail down with ours.
- [ ] Design of the signed-out homepage (A11): the full-screen photo — which one, from
      where, under what license.
- [ ] Choice of the specific OG image for profile pages without an avatar.
