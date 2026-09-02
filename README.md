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
git clone https://github.com/3dbdg/platform-lite && cd platform-lite
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
names, handles and generated avatar photos (initials on a colored square, rasterized by
sharp; nothing downloaded) — so a fresh environment has real-looking pages within a minute
(SPEC.md G7). It needs `DATABASE_URL`: from `.env`, like `pnpm db:migrate` (the tunnel per
SPEC.md §3), or pointed at the local runner while `node scripts/dev-local.mjs` is running:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/postgres pnpm db:seed
```

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5434/postgres"; pnpm db:seed
```

- Photos need the five `S3_*` variables (they land under `S3_PREFIX`); without them the
  seed still creates accounts, names and handles, and says so.
- Every seed account is `<handle>@seed.example` (verified; the domain can never receive
  mail) with the password `architekt-seed-2026`, printed at the end.
- Safe to re-run: a profile whose e-mail already exists (or whose handle another account
  holds) is skipped and reported; nothing is deleted. For a fresh set, start from a fresh
  database (delete `.pglite-data/` for the local runner).
- It refuses to run with `NODE_ENV=production`.
- G7: the seed is maintained continuously — a new profile field or a changed profile layer
  changes `scripts/seed-profiles.ts` in the same change; `src/db/seed.test.ts` fails when
  the two drift apart.

## Testing

`pnpm test` (Vitest units) · `pnpm test:e2e` (Playwright; starts its own dev server on
port 3100, so it never collides with your `pnpm dev`).

## Conventions

Everything in the repository and on GitHub is written in English (SPEC.md §5).
Per-developer naming for databases and S3 prefixes: SPEC.md §4.
