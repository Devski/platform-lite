# Implementation plan — MVP task index

**Tasks are tracked in GitHub Issues:** https://github.com/Devski/platform-lite/issues
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

### [Phase 0 - Foundation](https://github.com/Devski/platform-lite/milestone/1)

1. [#1](https://github.com/Devski/platform-lite/issues/1) Project bootstrap: Next.js 16 + TypeScript strict + Tailwind 4 + tooling
2. [#2](https://github.com/Devski/platform-lite/issues/2) Dev infrastructure on OVH waw: d2-2 instance, Postgres, platform-dev bucket (`infra`)
3. [#3](https://github.com/Devski/platform-lite/issues/3) i18n: next-intl, pl unprefixed, /en/ prefix, Accept-Language + cookie switcher
4. [#4](https://github.com/Devski/platform-lite/issues/4) Database schema + Drizzle + first migration
5. [#5](https://github.com/Devski/platform-lite/issues/5) CI: GitHub Actions - pnpm check + build on every PR
6. [#6](https://github.com/Devski/platform-lite/issues/6) Transactional email layer: lib/email.ts, templates (pl/en), dev log transport

**Checkpoint:** CI green on PRs; `pnpm dev` renders pl and en pages; dev database migrated.

### [Phase 1 - Accounts](https://github.com/Devski/platform-lite/milestone/2)

7. [#7](https://github.com/Devski/platform-lite/issues/7) Registration: e-mail + password with account verification
8. [#8](https://github.com/Devski/platform-lite/issues/8) Login, logout, sessions
9. [#9](https://github.com/Devski/platform-lite/issues/9) Password reset
10. [#10](https://github.com/Devski/platform-lite/issues/10) Account settings: change password and change e-mail

- [#29](https://github.com/Devski/platform-lite/issues/29) Two-factor authentication (TOTP + backup codes) — **post-MVP hardening**, added 01.09.2026; not one of the original A1–A11 criteria. Depends on #8, #10; auth/session schema change (§7 "ask first").

**Checkpoint:** full account lifecycle works on dev without assistance; auth integration tests green.

### [Phase 2 - Profile and files](https://github.com/Devski/platform-lite/milestone/3)

11. [#11](https://github.com/Devski/platform-lite/issues/11) Storage layer: FileStorage interface, S3 implementation, contentKey
12. [#12](https://github.com/Devski/platform-lite/issues/12) Avatar upload: presigned URL + sharp WebP 512/128 variants
13. [#13](https://github.com/Devski/platform-lite/issues/13) 1 GB quota: lib/quota.ts
14. [#14](https://github.com/Devski/platform-lite/issues/14) Profile settings: display name + avatar
15. [#15](https://github.com/Devski/platform-lite/issues/15) Handle: validation, reserved words, initial assignment
16. [#16](https://github.com/Devski/platform-lite/issues/16) Handle change: 30-day cooldown, redirects with 301, immediate release
17. [#17](https://github.com/Devski/platform-lite/issues/17) Seed: pnpm db:seed with sample profiles and photos

- [#30](https://github.com/Devski/platform-lite/issues/30) Count staged uploads against the A9 quota — **fix**, added 04.09.2026: staged bytes have no `files` row, so the 1 GB limit does not see them. A bucket lifecycle rule cannot close it (S3 expiration is day-granular; the presign TTL is 120 s), so it is a backstop only. Depends on #12, #13; scheduled after #2, before #21.

**Checkpoint:** display name, photo (WebP variants) and handle settable from the UI;
quota enforced; `src/lib/` coverage at 80% or higher.

### [Phase 3 - Public pages](https://github.com/Devski/platform-lite/milestone/4)

18. [#18](https://github.com/Devski/platform-lite/issues/18) Public profile page /[handle]: SSR, meta/OG/canonical, resolution to 301/404
19. [#19](https://github.com/Devski/platform-lite/issues/19) Landing page for signed-out users
20. [#20](https://github.com/Devski/platform-lite/issues/20) E2E: happy path, login/reset smoke, axe on public pages

**Checkpoint = the MVP success criterion:** from the homepage to a public link with a photo
in under 5 minutes (manual walkthrough); e2e green.

### [Phase 4 - Deployments and transactional email](https://github.com/Devski/platform-lite/milestone/5)

21. [#21](https://github.com/Devski/platform-lite/issues/21) Dockerfile (standalone) + deploy on push to the dev instance, G9 (`infra`)

- ~~[#31](https://github.com/Devski/platform-lite/issues/31) PR preview deployments on the dev instance~~ — **done 05.09.2026**: `pr-<n>.dev.architektow3d.pl`, named sites over HTTP-01 (no wildcard certificate, so no DNS plugin), shared dev database and a `pr-<n>/` key prefix. Two at a time — the instance has one core and no swap. Previews never send e-mail.
- [#113](https://github.com/Devski/platform-lite/issues/113) PR previews: a database cloned
  from dev per preview, not the shared one (`deployment`). Filed 09.09.2026 when the preview
  of #112 answered with a server error: it ran the pull request's image against dev's
  schema, and previews never migrate. Sequenced after the R360 trial on dev.

22. ~~[#22](https://github.com/Devski/platform-lite/issues/22) Scaleway TEM + SPF/DKIM/DMARC + switch email.ts to TEM~~ — **done 05.09.2026**: sending from `kontakt@dev.architektow3d.pl`, all four DNS records verified, replies routed to `kontakt@architektow3d.pl`. A registration on dev delivered a real verification e-mail (SMTP 250). Unblocks #23.
23. ~~[#23](https://github.com/Devski/platform-lite/issues/23) Deliverability test: Gmail / Onet / WP / Interia~~ — **done 05.09.2026**: all eight message types reach the Gmail inbox, none filtered. Scope cut to Gmail by decision; the reasoning and the method for the other three are in `docs/email-deliverability.md`.
24. [#24](https://github.com/Devski/platform-lite/issues/24) Production environment: instance, managed Postgres, prod bucket, CDN, G10 drill (`infra`, `blocked`)

**Checkpoint:** dev auto-deploys from `main` + PR previews; e-mail passes deliverability
tests; G10 restore procedure drilled; prod ready for manual deployment (each one — with
approval, §7).

### [Full functionality](https://github.com/Devski/platform-lite/milestone/6)

Opened by Dawid; due 15.09.2026. "Everything needed to attract users to start their
portfolio" — the profile becomes a portfolio, and the pieces around it that the
08.09.2026 discussion found. Seven of the tasks were filed that day; the CDN one moved here
from Phase 4 once its code half was split off.

- [#72](https://github.com/Devski/platform-lite/issues/72) Profile editing: cover photo,
  headline, location, bio and a list of works (A12) — the milestone's spine, in six PR-sized
  steps listed on the issue; the approved interactive sketch is linked from it.
- [#68](https://github.com/Devski/platform-lite/issues/68) R360 — **moved** on 09.09.2026:
  the milestone's "slide viewer" grew into its own milestone, [R360](#r360); #68 stays as
  the description of the whole and the index of its steps.
- [#69](https://github.com/Devski/platform-lite/issues/69) Storage meter per account: count
  the largest representation of every asset, show the usage.
- [#70](https://github.com/Devski/platform-lite/issues/70) Deliver user photos to fit the
  visitor's connection: `srcset`, hints, and evaluate probing.
- [#67](https://github.com/Devski/platform-lite/issues/67) Prepare our own images for
  delivery: hero sizes, phone crop, cache headers for `public/` — the code half of #48.
- [#48](https://github.com/Devski/platform-lite/issues/48) Deliver the hero, the assets and
  user files through a CDN — the money half; not a launch blocker (`infra`, `deployment`).
- [#71](https://github.com/Devski/platform-lite/issues/71) Decision: an on-the-fly image
  resizer (imgproxy) instead of upload-time variants (`blocked` — waits on a need).
- [#64](https://github.com/Devski/platform-lite/issues/64) Educational materials for renders
  export — the frame contract #68 builds on.

Verified for this milestone (08.09.2026): no OVHcloud CDN product transforms images, so every
size a page needs is produced at upload (G5); a bucket per user is ruled out by the
100-per-project limit, so an object's owner lives in its key (§9).

### [R360](https://github.com/Devski/platform-lite/milestone/9)

Opened 09.09.2026 from the design conversation with Dawid; no due date yet. One frame at a
time from a work's orbit archive: dragged on the picture (relative, discrete, wrapping),
dialled on an elliptical ring that doubles as the visitor's progress bar, and produced in
the owner's browser — the server never reads the archive, the one core never decodes a
frame, no queue and no worker. The decisions, the five parameters and the ordered step
list live on [#68](https://github.com/Devski/platform-lite/issues/68); the frame contract
shared with the export instructions on #64. One step, one PR; the order and the
dependencies are as on #68 (#105 waits on #101 and #103 only). All six steps landed on
`main` in one pull request (#112, 09.09.2026); the trial on dev, laptop and phone, closes #68.

- ~~[#101](https://github.com/Devski/platform-lite/issues/101) Zip reader in the browser:
  the table of contents, single frames by byte range, frame names parsed and validated —
  the technical bet, first and without UI.~~ — **done 09.09.2026**: the dev bucket still needs the CORS rule that allows GET and exposes `Content-Range` (`infra`; the JSON is in `scripts/bootstrap-dev.sh`) — the issue stays open for that.
- ~~[#102](https://github.com/Devski/platform-lite/issues/102) Frame pipeline: frames reduced
  in the owner's browser, uploaded under one set prefix, verified and recorded on save,
  cleaned up on replace and delete.~~ — **done 09.09.2026**: open decision on the issue: a presigned POST policy with `content-length-range` (a new dependency); until then SPEC §10 carries the unsigned length.
- ~~[#103](https://github.com/Devski/platform-lite/issues/103) Edit mode: pick the archive,
  see the frame count, the five parameters, one composite progress bar, a drag-only
  preview (`ux`).~~ — **done 09.09.2026**.
- ~~[#104](https://github.com/Devski/platform-lite/issues/104) The public work: drag to
  orbit, frames loaded coarse to fine, the start frame as the poster (`ux`).~~ — **done 09.09.2026**.
- ~~[#105](https://github.com/Devski/platform-lite/issues/105) Resume: derive the frames
  again from an archive that already reached the bucket (`ux`). Depends on #101 and #103,
  not on #104; listed here in filing order.~~ — **done 09.09.2026**: needs the CORS rule from #101 on dev; open decision on the issue: the seven-day ceiling on a claimed archive.
- ~~[#106](https://github.com/Devski/platform-lite/issues/106) The ring: the ellipse dial
  that shows where you are, travels on click, fills as frames load (`ux`).~~ — **done 09.09.2026**.

After the milestone: [#107](https://github.com/Devski/platform-lite/issues/107) cue points —
labelled frames on the ring (`ux`), deliberately outside the first cut.

**Checkpoint:** a work with an orbit archive and no photo, added from the form with one
progress bar, orbits on the public page by drag and by ring on a laptop and on a phone;
e2e with axe green; the server's CPU untouched by the frames.

### Open decisions (§12)

- ~~[#25](https://github.com/Devski/platform-lite/issues/25) Decision: product name and domain~~ — **resolved 05.09.2026**: `architektow3d.pl`, production on the apex, dev on `dev.`, previews on `*.dev.`. Unblocked #22, #24 and #31.
- [#26](https://github.com/Devski/platform-lite/issues/26) Decision: landing page design (photo, source, license) (`ux`) — the placeholder in #19 does not wait for it. **Deferred 05.09.2026**: visual polish comes after the functionality. The licence half is not cosmetic — it must permit commercial use.
- ~~[#27](https://github.com/Devski/platform-lite/issues/27) Decision: default OG image for profiles without avatar~~ — **done 05.09.2026**: one monogram, drawn the same on the page and on the square 512 px share card. Widened from the original scope, which covered only the share image: the page's own placeholder was a different one. The public brand became `Architektów 3d` at the same time — every shared link still advertised `platform-lite`.

### After the MVP

Neither blocks the MVP; both were found while finishing Phase 4 and are recorded so
they are not rediscovered later.

- [#34](https://github.com/Devski/platform-lite/issues/34) Account deletion, including the
- [#44](https://github.com/Devski/platform-lite/issues/44) Where personal data lives: which of it is sensitive, and does it belong in its own store (`compliance`) — opened 06.09.2026, four questions to answer in writing before production. The name is public by design; the sensitive thing is its LINK to the private address. Also carries four gaps found while surveying: disk encryption unverified, no dev backups, session tokens in plaintext, recipient address possibly reaching a log line.
- ~~[#36](https://github.com/Devski/platform-lite/issues/36) The public profile showed the user's e-mail address as their name~~ — **done 05.09.2026**: registration stopped inventing a name from the address; onboarding asks for one in two steps and derives the address from it. A migration cleared what the old flow wrote, keeping handles — they may already have been shared. Found two faults of my own on the way, both recorded on the issue and generalised as #39.
  objects behind it (`compliance`) — opened 05.09.2026: there is no code path for
  removing a user at all. Clearing test accounts from dev meant hand-written SQL, and the
  bucket objects were left unfindable. With real users this is a legal obligation, not
  tidiness. Shares its object-removal path with sweeping preview prefixes (#31).
- [#35](https://github.com/Devski/platform-lite/issues/35) Transactional e-mail in the
- [#39](https://github.com/Devski/platform-lite/issues/39) Make the UI airtight against what the backend and the database will accept (`enhancement`) — opened 05.09.2026: a rule can live in the form, the API schema and a database constraint, and nothing keeps the three in agreement. Two instances on one screen in #36: a submit the form could not know would fail, and a `CHECK` nothing above the database could see — both surfacing as "try again".
  product's visual identity (`blocked`, `ux`) — deferred with #26; waits on #26/#27, because the
  identity has to exist first. Re-run the #23 deliverability matrix afterwards: images and
  links raise the spam score against a young sending domain.

## Requirements coverage

Every criterion A1–A11 and every boundary G1–G10 has its task (A11 — visual, no test
requirement). A12 is #72 and its tails; A13 is the R360 milestone (#68, #101–#106). §10 risks are covered by #23 (deliverability) and inside #16/#24. §12 open
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
