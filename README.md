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

## Testing

`pnpm test` (Vitest units) · `pnpm test:e2e` (Playwright; starts its own dev server on
port 3100, so it never collides with your `pnpm dev`).

## Conventions

Everything in the repository and on GitHub is written in English (SPEC.md §5).
Per-developer naming for databases and S3 prefixes: SPEC.md §4.
