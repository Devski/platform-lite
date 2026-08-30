# platform-lite

The source of truth is **SPEC.md** — read it before any work.

- Work boundaries: SPEC.md §7 (always G1–G10 / ask first / never).
- Project commands: §3. Environments and deployments: §8.
- Per-developer convention (§4): suffix = GitHub handle, e.g. database `platform_devski`.
- Decision documents (decision card, cost calculators): links in the SPEC.md header.
- Task index: tasks/plan.md — tasks live in GitHub Issues.
- Everything in the repository and on GitHub — in English; chat with Dawid — in Polish (§5).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
