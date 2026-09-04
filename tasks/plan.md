# Implementation plan — MVP task index

**Tasks are tracked in GitHub Issues:** https://github.com/3dbdg/platform-lite/issues
(one issue = one task with acceptance criteria and verification; this file is the index
and context, not a second list — there is no `tasks/todo.md`).

Requirements come from [SPEC.md](../SPEC.md). Plan created on 30.08.2026, approved by Dawid.

## Structural decisions

- Everything in the repository and on GitHub — documents, issues, PRs, milestones, labels —
  always in English (SPEC.md §5). Chat communication stays in Polish.
- Milestone = phase; checkpoint criteria live in the milestone description and below.
- Dependencies in the issue body ("Depends on #N"). Issue-number order = recommended work order.
- Labels: `infra` (console work at OVH/Scaleway/Coolify), `decision` (open questions from §12),
  `blocked` (waiting on the domain decision — #25).
- Quality gate for every code task: **`pnpm check` green before every commit** (§7);
  written into the Verification section of every issue.
- The dev e-mail transport is a logger (#6), so the missing domain (#25) blocks no
  application code — it only blocks #21 (final addresses), #22 and #24.

## Phases and checkpoints

### [Phase 0 - Foundation](https://github.com/3dbdg/platform-lite/milestone/1)

1. [#1](https://github.com/3dbdg/platform-lite/issues/1) Project bootstrap: Next.js 16 + TypeScript strict + Tailwind 4 + tooling
2. [#2](https://github.com/3dbdg/platform-lite/issues/2) Dev infrastructure on OVH waw: d2-2 instance, Postgres, platform-dev bucket (`infra`)
3. [#3](https://github.com/3dbdg/platform-lite/issues/3) i18n: next-intl, pl unprefixed, /en/ prefix, Accept-Language + cookie switcher
4. [#4](https://github.com/3dbdg/platform-lite/issues/4) Database schema + Drizzle + first migration
5. [#5](https://github.com/3dbdg/platform-lite/issues/5) CI: GitHub Actions - pnpm check + build on every PR
6. [#6](https://github.com/3dbdg/platform-lite/issues/6) Transactional email layer: lib/email.ts, templates (pl/en), dev log transport

**Checkpoint:** CI green on PRs; `pnpm dev` renders pl and en pages; dev database migrated.

### [Phase 1 - Accounts](https://github.com/3dbdg/platform-lite/milestone/2)

7. [#7](https://github.com/3dbdg/platform-lite/issues/7) Registration: e-mail + password with account verification
8. [#8](https://github.com/3dbdg/platform-lite/issues/8) Login, logout, sessions
9. [#9](https://github.com/3dbdg/platform-lite/issues/9) Password reset
10. [#10](https://github.com/3dbdg/platform-lite/issues/10) Account settings: change password and change e-mail

- [#29](https://github.com/3dbdg/platform-lite/issues/29) Two-factor authentication (TOTP + backup codes) — **post-MVP hardening**, added 01.09.2026; not one of the original A1–A11 criteria. Depends on #8, #10; auth/session schema change (§7 "ask first").

**Checkpoint:** full account lifecycle works on dev without assistance; auth integration tests green.

### [Phase 2 - Profile and files](https://github.com/3dbdg/platform-lite/milestone/3)

11. [#11](https://github.com/3dbdg/platform-lite/issues/11) Storage layer: FileStorage interface, S3 implementation, contentKey
12. [#12](https://github.com/3dbdg/platform-lite/issues/12) Avatar upload: presigned URL + sharp WebP 512/128 variants
13. [#13](https://github.com/3dbdg/platform-lite/issues/13) 1 GB quota: lib/quota.ts
14. [#14](https://github.com/3dbdg/platform-lite/issues/14) Profile settings: display name + avatar
15. [#15](https://github.com/3dbdg/platform-lite/issues/15) Handle: validation, reserved words, initial assignment
16. [#16](https://github.com/3dbdg/platform-lite/issues/16) Handle change: 30-day cooldown, redirects with 301, immediate release
17. [#17](https://github.com/3dbdg/platform-lite/issues/17) Seed: pnpm db:seed with sample profiles and photos

- [#30](https://github.com/3dbdg/platform-lite/issues/30) Count staged uploads against the A9 quota — **fix**, added 04.09.2026: staged bytes have no `files` row, so the 1 GB limit does not see them. A bucket lifecycle rule cannot close it (S3 expiration is day-granular; the presign TTL is 120 s), so it is a backstop only. Depends on #12, #13; scheduled after #2, before #21.

**Checkpoint:** display name, photo (WebP variants) and handle settable from the UI;
quota enforced; `src/lib/` coverage at 80% or higher.

### [Phase 3 - Public pages](https://github.com/3dbdg/platform-lite/milestone/4)

18. [#18](https://github.com/3dbdg/platform-lite/issues/18) Public profile page /[handle]: SSR, meta/OG/canonical, resolution to 301/404
19. [#19](https://github.com/3dbdg/platform-lite/issues/19) Landing page for signed-out users
20. [#20](https://github.com/3dbdg/platform-lite/issues/20) E2E: happy path, login/reset smoke, axe on public pages

**Checkpoint = the MVP success criterion:** from the homepage to a public link with a photo
in under 5 minutes (manual walkthrough); e2e green.

### [Phase 4 - Deployments and transactional email](https://github.com/3dbdg/platform-lite/milestone/5)

21. [#21](https://github.com/3dbdg/platform-lite/issues/21) Dockerfile (standalone) + Coolify on dev: auto-deploy, PR previews, G9 (`infra`)
22. [#22](https://github.com/3dbdg/platform-lite/issues/22) Scaleway TEM + SPF/DKIM/DMARC + switch email.ts to TEM (`infra`, `blocked`)
23. [#23](https://github.com/3dbdg/platform-lite/issues/23) Deliverability test: Gmail / Onet / WP / Interia (`infra`)
24. [#24](https://github.com/3dbdg/platform-lite/issues/24) Production environment: instance, managed Postgres, prod bucket, CDN, G10 drill (`infra`, `blocked`)

**Checkpoint:** dev auto-deploys from `main` + PR previews; e-mail passes deliverability
tests; G10 restore procedure drilled; prod ready for manual deployment (each one — with
approval, §7).

### Open decisions (label `decision`, §12)

- [#25](https://github.com/3dbdg/platform-lite/issues/25) Decision: product name and domain — **blocks #21 (addresses), #22, #24**; before the first dev deployment
- [#26](https://github.com/3dbdg/platform-lite/issues/26) Decision: landing page design (photo, source, license) — the placeholder in #19 does not wait for it
- [#27](https://github.com/3dbdg/platform-lite/issues/27) Decision: default OG image for profiles without avatar — #18 starts with a placeholder

## Requirements coverage

Every criterion A1–A11 and every boundary G1–G10 has its task (A11 — visual, no test
requirement). §10 risks are covered by #23 (deliverability) and inside #16/#24. §12 open
questions = #25–#27.

#30 is a fix to an A9 gap found while provisioning #2 (04.09.2026), not a new criterion.

Beyond the SPEC criteria: #29 (two-factor authentication) is a post-MVP hardening addition
(01.09.2026), not tied to an A-criterion — it addresses the "account safety rests on the
mailbox" limitation left open when #10 shipped. SPEC.md is not yet updated for it.

## Plan risks

| Risk                                                     | Mitigation                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No domain decision stalls Phase 4                        | #25 marked as blocking; Phases 0–3 fully independent of the domain (log transport in #6)                                                                                                         |
| Better Auth: API/version unverified                      | #4/#7 include an explicit verification step against official docs before implementation (§2, source-driven)                                                                                      |
| Infrastructure (#2) needs console access on Dawid's side | Manual part reduced to console prerequisites (project, credentials); the rest is scripted (`scripts/bootstrap-dev.sh`) with the procedure in `docs/dev-environment.md`, doubling as the G10 seed |
