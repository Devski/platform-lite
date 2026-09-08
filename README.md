# platform-lite

Public profile pages for architecture studios and 3D artists — sign up, set a name,
photo and handle, share `/your-handle`. The source of truth for every decision is
[SPEC.md](SPEC.md) — read it before any work.

## Prerequisites

- Node.js 24 LTS and pnpm ≥ 11 (`corepack enable` gives you the pinned version)
- An SSH client — the dev database is reachable only through an SSH tunnel
- Dev infrastructure credentials (see "Where am I?" below)

## Quick start (existing dev infrastructure)

```
git clone https://github.com/Devski/platform-lite && cd platform-lite
pnpm install
cp .env.example .env      # fill in — values come from the dev infra bootstrap output
pnpm db:tunnel            # terminal 1: keep running
pnpm dev                  # terminal 2: http://localhost:3000
```

All commands: SPEC.md §3. The gate before every commit: `pnpm check`.

## Where am I?

| Situation                                             | Go to                                                  |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Daily work                                            | Quick start above                                      |
| First time on this project                            | [SPEC.md](SPEC.md) first, then quick start             |
| No `.env` values / no access yet                      | Ask whoever runs the dev infra for your per-dev values |
| Dev infrastructure from scratch (or after a disaster) | [docs/dev-environment.md](docs/dev-environment.md)     |

## Sample data

`pnpm db:seed` creates 14 sample profiles — Polish studios and 3D creators with display
names, handles, headlines, places, bios, generated avatar photos (initials on a colored
square, rasterized by sharp; nothing downloaded), covers on every second profile and a
few works with generated render photos — so a fresh environment has real-looking
pages within a minute
(SPEC.md G7). It targets `DATABASE_URL` from `.env` — the tunnelled dev database, the same
one `pnpm db:migrate` uses (SPEC.md §3). To point it elsewhere, set the variable inline:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/db pnpm db:seed
```

```powershell
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/db"; pnpm db:seed
```

In PowerShell the variable stays set for the rest of that shell session; to scope it to the
one run: `try { $env:DATABASE_URL = "…"; pnpm db:seed } finally { Remove-Item Env:DATABASE_URL }`.

- Photos need the five `S3_*` variables and land under `S3_PREFIX` — the effective prefix is
  printed before seeding; a blank one means the bucket root, which SPEC.md §4 reserves for
  production. Without `S3_*` the seed still creates accounts, names and handles, and says so.
- Every seed account is `<handle>@seed.example` (verified; the domain can never receive
  mail) with the password `architekt-seed-2026`, printed at the end.
- Safe to re-run: a profile whose e-mail already exists (or whose handle another account
  holds) is skipped and reported; nothing is deleted. Photos and profile sections are resumable: after a run
  without `S3_*`, a later run with `S3_*` adds the missing photos. For a fresh set, start
  from a fresh database (`pnpm db:migrate` first).
- Two guards: it refuses a non-loopback database unless `--allow-remote`
  (`pnpm db:seed --allow-remote`; the tunnel, a local Postgres and the CI container are all
  loopback), and it refuses `NODE_ENV=production`.
- G7: the seed is maintained continuously — a new profile field or a changed profile layer
  changes `scripts/seed-profiles.ts` in the same change; `src/db/seed.test.ts` fails when
  the two drift apart.

## Testing

`pnpm test` (Vitest units) · `pnpm test:e2e` (Playwright; starts its own dev server on
port 3100, so it never collides with your `pnpm dev`).

## Conventions

Everything in the repository and on GitHub is written in English (SPEC.md §5).
Per-developer naming for databases and S3 prefixes: SPEC.md §4.
