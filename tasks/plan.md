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
- Labels: `infra` (console work at OVH/Scaleway, servers and DNS), `deployment` (how code
  reaches an environment: pipeline, release procedure, infrastructure), `ux` (user experience: everything between the
  person and the product — a moved button, a bigger photo, an interface that refuses what
  the database would refuse, an error somebody can act on. Sequenced late at times, never
  optional; see §1), `compliance` (a legal obligation, not a product choice),
  `blocked` (waiting on something named in Depends on), `enhancement` (everything else).
  `decision` is retired — it described §12's open questions, and the ones still open are
  visual, so `ux` says more.
- Quality gate for every code task: **`pnpm check` green before every commit** (§7);
  written into the Verification section of every issue.
- The dev e-mail transport is a logger (#6), so the missing domain (#25) blocks no
  application code, and since 05.09.2026 it blocks nothing: the domain is decided (§12).

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

21. [#21](https://github.com/3dbdg/platform-lite/issues/21) Dockerfile (standalone) + deploy on push to the dev instance, G9 (`infra`)

- ~~[#31](https://github.com/3dbdg/platform-lite/issues/31) PR preview deployments on the dev instance~~ — **done 05.09.2026**: `pr-<n>.dev.architektow3d.pl`, named sites over HTTP-01 (no wildcard certificate, so no DNS plugin), shared dev database and a `pr-<n>/` key prefix. Two at a time — the instance has one core and no swap. Previews never send e-mail.

22. ~~[#22](https://github.com/3dbdg/platform-lite/issues/22) Scaleway TEM + SPF/DKIM/DMARC + switch email.ts to TEM~~ — **done 05.09.2026**: sending from `kontakt@dev.architektow3d.pl`, all four DNS records verified, replies routed to `kontakt@architektow3d.pl`. A registration on dev delivered a real verification e-mail (SMTP 250). Unblocks #23.
23. ~~[#23](https://github.com/3dbdg/platform-lite/issues/23) Deliverability test: Gmail / Onet / WP / Interia~~ — **done 05.09.2026**: all eight message types reach the Gmail inbox, none filtered. Scope cut to Gmail by decision; the reasoning and the method for the other three are in `docs/email-deliverability.md`.
24. [#24](https://github.com/3dbdg/platform-lite/issues/24) Production environment: instance, managed Postgres, prod bucket, CDN, G10 drill (`infra`, `blocked`)

**Checkpoint:** dev auto-deploys from `main` + PR previews; e-mail passes deliverability
tests; G10 restore procedure drilled; prod ready for manual deployment (each one — with
approval, §7).

### Open decisions (§12)

- ~~[#25](https://github.com/3dbdg/platform-lite/issues/25) Decision: product name and domain~~ — **resolved 05.09.2026**: `architektow3d.pl`, production on the apex, dev on `dev.`, previews on `*.dev.`. Unblocked #22, #24 and #31.
- ~~[#26](https://github.com/3dbdg/platform-lite/issues/26) Decision: landing page design (photo, source, license)~~ — **resolved 06.09.2026**: Dawid's own photograph of the street sign `ul. Architektów 3d`, so the licence question falls away. It fills a phone's screen below the top bar, and the slogan sits on it — on an opaque card, because contrast over a photograph cannot be measured and `e2e/axe.ts` fails on an undecided contrast result. Monochrome, light, wise.com in feel; the rest of the app is still blue. Unblocks #35.
- ~~[#27](https://github.com/3dbdg/platform-lite/issues/27) Decision: default OG image for profiles without avatar~~ — **done 05.09.2026**: one monogram, drawn the same on the page and on the square 512 px share card. Widened from the original scope, which covered only the share image: the page's own placeholder was a different one. The public brand became `Architektów 3d` at the same time — every shared link still advertised `platform-lite`.

### After the MVP

None of these block the MVP; they were found while finishing Phase 4 and are recorded so
they are not rediscovered later.

- [#34](https://github.com/3dbdg/platform-lite/issues/34) Account deletion, including the
  objects behind it (`compliance`) — opened 05.09.2026: there is no code path for
  removing a user at all. Clearing test accounts from dev meant hand-written SQL, and the
  bucket objects were left unfindable. With real users this is a legal obligation, not
  tidiness. Shares its object-removal path with sweeping preview prefixes (#31).
- [#35](https://github.com/3dbdg/platform-lite/issues/35) Transactional e-mail in the
  product's visual identity (`ux`) — was waiting on #26/#27, because the identity had to
  exist first; both are resolved, so this is unblocked. Re-run the #23 deliverability
  matrix afterwards: images and links raise the spam score against a young sending domain.
- ~~[#36](https://github.com/3dbdg/platform-lite/issues/36) The public profile showed the user's e-mail address as their name~~ — **done 05.09.2026**: registration stopped inventing a name from the address; onboarding asks for one in two steps and derives the address from it. A migration cleared what the old flow wrote, keeping handles — they may already have been shared. Found two faults of my own on the way, both recorded on the issue and generalised as #39.
- [#39](https://github.com/3dbdg/platform-lite/issues/39) Make the UI airtight against what the backend and the database will accept (`ux`) — opened 05.09.2026: a rule can live in the form, the API schema and a database constraint, and nothing keeps the three in agreement. Two instances on one screen in #36: a submit the form could not know would fail, and a `CHECK` nothing above the database could see — both surfacing as "try again".
- [#44](https://github.com/3dbdg/platform-lite/issues/44) Where personal data lives: which of it is sensitive, and does it belong in its own store (`compliance`) — opened 06.09.2026, four questions to answer in writing before production. The name is public by design; the sensitive thing is its LINK to the private address. Also carries four gaps found while surveying: disk encryption unverified, no dev backups, session tokens in plaintext, recipient address possibly reaching a log line.
- [#48](https://github.com/3dbdg/platform-lite/issues/48) Landing photo: cut a phone crop and give `public/` real cache headers (`ux`) — opened 06.09.2026 while auditing #26. On a phone `object-cover` paints only 39% of the hero's pixels; a hand-cut `<picture>` source saves about 130 kB on the page's largest paint. Separately, `public/` is served `max-age=0`, so every repeat visit revalidates before it can draw. `srcset` cannot express the first one — the element renders 2.5x wider than the viewport.

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
