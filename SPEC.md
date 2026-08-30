# Spec: platform-lite — MVP

Repository: https://github.com/3dbdg/platform-lite
Status: **awaiting approval** · 30 August 2026 · nothing is implemented yet.
Working name: _platform-lite_ (product name and domain — open, see §12).

Source documents with the full rationale behind the decisions (in Polish):

- Decision card: https://claude.ai/code/artifact/e08d7ff7-26e1-4b7c-8ead-260200b040d1
- File storage and transfer costs (14 providers): https://claude.ai/code/artifact/931d4f6c-1676-44dc-8076-023883402d74
- Transactional e-mail costs (8 providers): https://claude.ai/code/artifact/70cbb3dd-5d94-42a4-90b1-2bc7f34b637a

Lineage: the MVP corresponds to the `foundation → identity → profiles` modules of the approved
capability map in the `3dbdg/platform` repository (CAPABILITY-MAP.md). Deliberately merged here
into a single application and a single spec — that is the essence of "lite".

---

## 1. Goal

An architecture studio or a 3D artist enters the platform and within a few minutes has a
public profile page at `/handle` — look inspired by a LinkedIn company page (the visual
style only: blue accent, denser typography, cards with thin borders; without the
company-page structure — no cover photo, tabs or "About us" section).

**One persona:** the provider — a studio or a solo creator. Market: Poland, then Europe.

**MVP success:** a new user, with no assistance, goes from landing on the homepage to a
working public link with their name and photo in under 5 minutes.

### Acceptance criteria

| #   | Criterion                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Registration with e-mail + password (8–128 characters, no composition rules, attempt rate limiting). Account inactive until the verification link is clicked (valid 24 h, resend max 3/h).                                                                       |
| A2  | Login and logout. Session: `httpOnly` + `secure` + `sameSite=lax` cookie, 30 days, renewable. Password hashes exclusively in our Postgres.                                                                                                                       |
| A3  | Password reset: single-use link valid 60 min; after a successful change, a notification to the account address.                                                                                                                                                  |
| A4  | Profile: display name (1–80 characters) and photo (JPEG/PNG/WebP ≤ 10 MB), from which WebP variants at 512 px and 128 px are produced.                                                                                                                           |
| A5  | Handle: 3–30 characters, `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, case-insensitive uniqueness, reserved-word list (incl. `pl`, `en`, `api`, `admin`, `login`, `settings`, `assets`).                                                                             |
| A6  | Handle change: no more than once per 30 days. The old address responds 301 to the new one, **until someone claims the old name — old handles return to circulation immediately** (decision of 30.08.2026; impersonation risk accepted consciously, see §10).     |
| A7  | Profile page `/handle`: server-rendered, correct `<title>`, description, Open Graph (image = avatar), canonical. Indexed **only in production** — dev and PR previews send `X-Robots-Tag: noindex`.                                                              |
| A8  | Interface in Polish and English, architecture open to further languages: all texts via dictionaries, no strings in components. Polish unprefixed (`/handle`), English prefixed (`/en/...`); selection: `Accept-Language` header + a switcher stored in a cookie. |
| A9  | 1 GB limit per user, free of charge (the MVP has no payments). Usage computed in the database from file sizes; an upload over the limit is rejected with a clear message.                                                                                        |
| A10 | Six transactional e-mails (verification, re-verification, reset, password-change confirmation, address change ×2, handle change) via Scaleway TEM. SPF, DKIM and DMARC configured before the first real message goes out. Zero marketing e-mail.                 |
| A11 | Homepage for signed-out visitors: full-screen photo + entry to sign-up/sign-in. Visual design — open (§12); the MVP ships a style-consistent placeholder.                                                                                                        |

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
| Deployments | **Docker + Coolify**                                           | `git push` = deploy, a preview for every PR, rollback = previous image.                                   |
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

pnpm db:generate      # drizzle-kit generate (schema → SQL migration)
pnpm db:migrate       # apply migrations to the DATABASE_URL database
pnpm db:seed          # test data: a dozen-plus profiles with photos (G7)
pnpm db:studio        # drizzle-kit studio

pnpm check            # typecheck && lint && test  ← the gate before every commit
```

Locally **without Docker** — work against the remote database and remote S3 (region `waw`).
The production image is built by Coolify from the `Dockerfile` in the repo root (Next.js `standalone`).

---

## 4. Project structure

```
src/
  app/
    (public)/
      page.tsx              # homepage for signed-out visitors (A11)
      [handle]/page.tsx     # public profile page (A7)
    (auth)/                 # sign-up, login, verification, reset
    (app)/settings/         # profile, handle, account
    api/                    # route handlers (upload confirm etc.)
  lib/
    storage.ts              # G1: the ONLY place touching S3
    email.ts                # the only place touching Scaleway TEM
    handle.ts               # validation, reserved words, cooldown
    quota.ts                # usage counting (A9)
  db/
    schema.ts               # source of truth for drizzle-kit
  i18n/                     # next-intl configuration
messages/
  pl.json  en.json          # ALL interface texts
drizzle/                    # generated SQL migrations — committed
e2e/                        # Playwright tests
docs/                       # decisions, archive
Dockerfile
.env.example                # DATABASE_URL, S3_ENDPOINT/REGION/BUCKET/KEY/SECRET,
                            # EMAIL_* (TEM), APP_URL, AUTH_SECRET — no values
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
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string; // stable, unsigned (G3)
}

export function contentKey(hash: string, ext: string, prefix = ""): string {
  // G2: content-addressed name → served with max-age=31536000, immutable
  return `${prefix}a/${hash}.${ext}`;
}
```

---

## 6. Test strategy

| Level       | Tool                   | Scope                                                                                                          | Where                                                                                       |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit        | Vitest                 | `lib/handle` (regex, reserved words, cooldown), `lib/quota`, `contentKey`, image variants                      | `src/**/*.test.ts` next to the code                                                         |
| Integration | Vitest + test database | auth flows, handle change with 301, usage counter                                                              | `DATABASE_URL_TEST` → a separate `platform_test_<github-handle>` database on the dev server |
| E2E         | Playwright             | happy path: sign-up → verification → profile → public profile page; login and reset smoke; axe on public pages | `e2e/`                                                                                      |

- Coverage: no percentage fetish; a hard minimum of **80% for `src/lib/`** and a test for
  every criterion A1–A10 (A11 — visual, no requirement).
- CI (GitHub Actions): `pnpm check` + build on every PR; Postgres as a service container;
  e2e smoke on PRs, full e2e before a prod deployment.
- A bug fix starts with a test that reproduces the bug.

---

## 7. Boundaries

**Always (G1–G10 — numbering shared with the decision card):**

- **G1** Storage behind a thin interface — S3 called exclusively from `lib/storage.ts`.
- **G2** File name = content hash; served with `max-age=31536000, immutable`.
- **G3** Public photos have stable, unsigned addresses; signatures only for uploads.
- **G4** User files never pass through the application server (upload via presigned URL;
  variants generated server-side from a copy fetched over the internal network).
- **G5** Size variants + a new-generation format for every publicly served image.
- **G6** Database schema changes exclusively via migrations in files.
- **G7** `pnpm db:seed` kept current — a fresh environment in a minute.
- **G8** SPF, DKIM, DMARC configured before the first real e-mail.
- **G9** Coolify panel: 2FA + IP restriction; never open to the world.
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

| Environment | Where                         | Database                                                                              | Deployment                                        |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Local       | developer machine             | remote `waw` (per developer: `platform_<github-handle>`, for Dawid `platform_devski`) | —                                                 |
| PR preview  | dev instance                  | shared dev                                                                            | automatic on PR open, deleted after merge         |
| Dev         | OVH `waw`, d2-2 (€7)          | Postgres in a container                                                               | automatic from `main`                             |
| Prod        | OVH `eu-west-par`, b3-8 (€35) | Managed PostgreSQL (€59)                                                              | **manual**: a button in Coolify or a `vX.Y.Z` tag |

- Nothing "moves" from dev to prod — both are built from Git; database structure travels
  via migrations, data never does.
- Outside prod: `X-Robots-Tag: noindex` (A7).
- Resilience: cold standby (snapshot + the G10 procedure). Deliberately no load balancer
  and no second database node — they would triple the cost while protecting near-zero traffic.

---

## 9. Data model (outline — migrations are the source of truth)

- `users`, `sessions`, `verifications` — Better Auth tables (passwords: scrypt/argon2 per
  the library). `users.id`: UUID generated **in the database** (`gen_random_uuid()`); the auth
  library is configured not to generate ids on the application side (verify the exact option
  at start).
- `profiles`: `user_id PK/FK`, `display_name`, `handle` (unique on `lower()`),
  `handle_changed_at`, `avatar_file_id`.
  **A handle is an attribute, not an identifier**: despite its uniqueness it is never the
  target of a foreign key — all relations point at `users.id`, so a handle change touches
  no relation.
- `handle_redirects`: `old_handle PK`, `target_user_id`, `created_at`.
  Resolving `/X`: profile → redirect (301 to the target's current handle) → 404.
  Registration of handle `X` by anyone **deletes** the redirect row (A6).
- `files`: `id`, `user_id`, `sha256`, `size_bytes`, `kind` (`avatar-original|avatar-512|avatar-128`),
  `created_at`. The per-user sum of `size_bytes` = quota usage (A9).

---

## 10. Risks accepted consciously

| Risk                                                                                              | Decision                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Old handles returning to circulation immediately → possible impersonation at an abandoned address | Decision of 30.08.2026. To revisit once real profiles with reputation exist.                                               |
| A single app instance, a single database node                                                     | Cold standby + backups. HA only once downtime starts costing more than €56/month.                                          |
| A free 1 GB for everyone                                                                          | Safe thanks to OVH's zero egress; pain threshold ~~10,000 accounts (~~€75/month) — then a conversation about a paid model. |
| Scaleway TEM deliverability to Polish mailboxes unverified                                        | Test on Gmail/Onet/WP/Interia before launch; plan B: EmailLabs (an SMTP configuration change).                             |
| 100 MB/page-view is an estimate, not a measurement                                                | Verify with telemetry after launch.                                                                                        |

---

## 11. Consciously out of scope

Payments and plans · provider catalog/search · the developer persona (the other side of the
market) · the 3D-mockup engine and marketplace · profile cover photo, tabs, "About us"
section, news, team · draft/published toggle · messages and a contact form · following ·
team accounts · user custom domains · an admin panel · product analytics · compliance beyond
the minimum (personal data kept separate so more can be added without a rebuild) ·
HA/multicloud/Terraform · Docker and MinIO locally.

---

## 12. Open questions

- [ ] **Product name and domain** — blocks the e-mail sender address (G8), the panel and
      profile-page addresses. To resolve before the first dev deployment.
- [ ] Design of the signed-out homepage (A11): the full-screen photo — which one, from
      where, under what license.
- [ ] Choice of the specific OG image for profile pages without an avatar.
