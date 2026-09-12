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
- [#111](https://github.com/Devski/platform-lite/issues/111) Preview cleanup loses the race
  with a CI run still in flight, and the orphan blocks the two-preview cap (`bug`).
- [#119](https://github.com/Devski/platform-lite/issues/119) The dev instance keeps every
  image it ever pulled (`infra`). Filed 09.09.2026 when its root filesystem reached 100%:
  129 images, 21.8 GB, three of them in use. Previews stopped starting at all, and dev's
  own health check could not run — Docker could not write the file needed to exec it.
- ~~[#61](https://github.com/Devski/platform-lite/issues/61) Nothing requires a green pipeline
  before code reaches `main`~~ — **done 12.09.2026**: the ruleset `main: green before it lands`
  wants a pull request and five green checks (`check`, `e2e-smoke`, `e2e-full`, `image`,
  `deploy-config`), and refuses a deleted or force-pushed branch. No bypass actors — every
  commit here is pushed with the owner's account, so "admins may bypass" would have read as
  "anyone may bypass". It costs nothing while the repository is public (since 10.09.2026).
- [#163](https://github.com/Devski/platform-lite/issues/163) Take the repository private again
  (`decision`, `infra`). Measured 12.09.2026: ~30 CI runs a day at ~11.9 billable minutes each,
  ~11,000 a month. Free would leave `main` unguarded again, so it means Pro — about $52 a month
  at this tempo. Not before the registry has a retention policy: 140 images in six days, ~8 GB
  and growing by more than a gigabyte a day — the registry's side of #119.
- [#164](https://github.com/Devski/platform-lite/issues/164) Rethink CI as a whole (`infra`,
  `decision`). A merge now waits 6.2 minutes for the last required check, 2.6 of them
  `e2e-full` standing idle on `needs: [check]`; the browsers are reinstalled every run and the
  image is built with no layer cache. To be answered together with the path to prod (§8).

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
  the largest representation of every asset, show the usage. Widened 10.09.2026: a
  breakdown by kind rather than one number, and a line for the bytes the collector
  (#126) is about to free.
- [#115](https://github.com/Devski/platform-lite/issues/115) Per-account quota: decide the
  figure after global photo processing (`decision`, `enhancement`). Filed 09.09.2026 when
  the first real orbit archive (1.8 GB of PNG frames) did not fit a 1 GB account on dev;
  the quota went to 10 GB the same day as a stopgap (A9, §10). Sequenced after #71 and
  #69, which change what a gigabyte buys — which is why it sits here and not in Phase 4,
  where it was filed by mistake.
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
time from a work's orbit zip: dragged on the picture (relative, discrete, wrapping),
dialled on an elliptical ring that doubles as the visitor's progress bar, and produced in
the owner's browser — since #120 the zip never leaves that browser at all, and the
server's one core never decodes a frame: no queue and no worker on the server. The decisions, the five parameters and the ordered step
list live on [#68](https://github.com/Devski/platform-lite/issues/68); the frame contract
shared with the export instructions on #64. One step, one PR; the order and the
dependencies are as on #68. All six steps landed on `main` in one pull request (#112,
09.09.2026). **#68 closed 11.09.2026** after Dawid's trial on dev on a phone, following
his trials of every preview on a laptop: everything the visitor does passed; making a set
on the phone works and takes minutes — carried to
[#147](https://github.com/Devski/platform-lite/issues/147), the owner's upload redesigned
for mobile, outside the milestone. ~~#147~~ **closed 11.09.2026** by Dawid once #149 made
it fast on both devices.

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
  again from an archive that already reached the bucket (`ux`).~~ — **done 09.09.2026 and
  removed again 10.09.2026 by [#120](https://github.com/Devski/platform-lite/issues/120)**:
  there is no archive on the server to resume from any more, and a set that has to be made
  again is made from the owner's own file. The offer, its two routes and its claim column
  are gone.
- ~~[#106](https://github.com/Devski/platform-lite/issues/106) The ring: the ellipse dial
  that shows where you are, travels on click, fills as frames load (`ux`).~~ — **done 09.09.2026**.

[#107](https://github.com/Devski/platform-lite/issues/107) cue points — labelled frames on
the ring (`ux`) — was filed as deliberately outside the first cut. **In it as of
10.09.2026**, by Dawid's decision when the milestone's remaining work was laid out: the
milestone closes with the cue points in, as its last step.

**Checkpoint:** a work with an orbit and no photo, added from the form with the frames
counted as they are made and sent, orbits on the public page by drag and by ring on a
laptop and on a phone; e2e with axe green; the server's CPU untouched by the frames.

From the trial on a real 872 MB archive (Dawid, 09–10.09.2026):
[#117](https://github.com/Devski/platform-lite/issues/117) the canvas viewer and
[#120](https://github.com/Devski/platform-lite/issues/120) the zip that stays on the
owner's machine, both done and on dev on 10.09.2026, and seven follow-ups from the same
trial, all on this milestone. In the order agreed with Dawid on 10.09.2026:

1. ~~[#121](https://github.com/Devski/platform-lite/issues/121) show the frame at decode
   time and [#122](https://github.com/Devski/platform-lite/issues/122) stop the uplink
   stalling the encoder~~ — **done 10.09.2026** (#136). Trying #136 on its preview
   answered #122's own question: on a good connection the uplink was never the limit, and
   the frames are made on one thread while the machine has more than one. Filed as
   [#137](https://github.com/Devski/platform-lite/issues/137).
2. ~~[#126](https://github.com/Devski/platform-lite/issues/126) what a save costs~~ and
   [#127](https://github.com/Devski/platform-lite/issues/127) the bytes nobody claimed —
   **one change**, decided 10.09.2026 after a 120-frame save took 481 requests to OVH.
   The frames go straight to their final keys, the save samples headers instead of reading
   all of them, and a collector removes what a record says was never finished. Deletion
   driven by the record, not by its absence; objects with no record at all are reported,
   never deleted; and it never runs in a preview, which shares dev's database (#113).
   **Done 10.09.2026** (#139) with the collector run lazily, on the owner's next set;
   **what remains of #127 is the collector's 12-hour timer**, which Dawid put last.
   [#140](https://github.com/Devski/platform-lite/issues/140), a work that records where
   its frames are so it shows and deletes on any preview, followed on 11.09.2026 (#146).
3. ~~[#123](https://github.com/Devski/platform-lite/issues/123) load a visitor's frames
   untouched~~ — **done 10.09.2026** (#141).
4. ~~The ring: [#124](https://github.com/Devski/platform-lite/issues/124) which way the dot
   runs and [#125](https://github.com/Devski/platform-lite/issues/125) the arc going
   strange~~ — **done 10.09.2026** (#142, and #143 for the reload that loaded nothing and
   the arc that never filled on a 120-frame orbit).
5. ~~[#137](https://github.com/Devski/platform-lite/issues/137) frames made on more than one
   thread~~ — **done 11.09.2026** (#149). Dawid's pick after the phone trial, as the first
   step towards #147; tried on the same phone the same night: as fast as the laptop had
   been before it.
6. ~~[#148](https://github.com/Devski/platform-lite/issues/148) a run stopped and replaced
   by a new pick cleared the new one from the form~~ — **done 11.09.2026** (#150). Found in
   #149's review, taken before the cue points by Dawid's decision; trying it, he met the set
   presign's limit of three a minute, raised to ten at his decision.
7. ~~[#107](https://github.com/Devski/platform-lite/issues/107) the cue points~~ — **done
   11.09.2026** (#154). The layout was Dawid's pick from a sketch of three, A and B together:
   markers on the ring with the label beside them, and a row of buttons under the picture
   that works without the ring. After the preview, his two corrections: a label shows only
   while it is pointed at, and a phone's public page shows no ring at all, only the
   buttons. The redesign will keep the ring for the enlarged view on the profile page too.
   Then, at his word, a new zip of the same frame count keeps the parameters and the cue
   points (#155).
8. ~~#127's timer~~ — **done 11.09.2026** (#157): a minute after the server starts and every
   12 hours, for every owner, only where `APP_ENV` is `dev` or `production`. It proved itself
   on the deploy: three abandoned sets collected on dev, one of them from Dawid's own phone
   trial. ~~[#156](https://github.com/Devski/platform-lite/issues/156), the design's last
   point on #126 — what no record names at all~~ — **done 12.09.2026** (#158), at his word, in
   the same run: counted, named in the log, never deleted.
9. The tail the milestone's own CI run left behind, both found in one red
   [e2e-full](https://github.com/Devski/platform-lite/actions/runs/34658624150):
   ~~[#160](https://github.com/Devski/platform-lite/issues/160)~~ — a full run spent the whole
   sign-up allowance of ten an hour, so any retry reddened the suite; each identity now signs
   up from its own address. ~~[#161](https://github.com/Devski/platform-lite/issues/161)~~ — a
   travel that lost its animation frames was left standing on a frame nobody asked for; it now
   lands whatever the animation does. Both **done 12.09.2026**.

### Open decisions (§12)

- ~~[#25](https://github.com/Devski/platform-lite/issues/25) Decision: product name and domain~~ — **resolved 05.09.2026**: `architektow3d.pl`, production on the apex, dev on `dev.`, previews on `*.dev.`. Unblocked #22, #24 and #31.
- [#26](https://github.com/Devski/platform-lite/issues/26) Decision: landing page design (photo, source, license) (`ux`) — the placeholder in #19 does not wait for it. **Deferred 05.09.2026**: visual polish comes after the functionality. The licence half is not cosmetic — it must permit commercial use.
- ~~[#27](https://github.com/Devski/platform-lite/issues/27) Decision: default OG image for profiles without avatar~~ — **done 05.09.2026**: one monogram, drawn the same on the page and on the square 512 px share card. Widened from the original scope, which covered only the share image: the page's own placeholder was a different one. The public brand became `Architektów 3d` at the same time — every shared link still advertised `platform-lite`.

### After the MVP

None of these blocks the MVP; each was found while finishing something else and is
recorded so it is not rediscovered later.

- [#34](https://github.com/Devski/platform-lite/issues/34) Account deletion, including the
  objects behind it (`compliance`) — opened 05.09.2026: there is no code path for
  removing a user at all. Clearing test accounts from dev meant hand-written SQL, and the
  bucket objects were left unfindable. With real users this is a legal obligation, not
  tidiness. Shares its object-removal path with sweeping preview prefixes (#31).
- [#35](https://github.com/Devski/platform-lite/issues/35) Transactional e-mail in the
  product's visual identity (`blocked`, `ux`) — deferred with #26; waits on #26/#27, because the
  identity has to exist first. Re-run the #23 deliverability matrix afterwards: images and
  links raise the spam score against a young sending domain.
- ~~[#36](https://github.com/Devski/platform-lite/issues/36) The public profile showed the user's e-mail address as their name~~ — **done 05.09.2026**: registration stopped inventing a name from the address; onboarding asks for one in two steps and derives the address from it. A migration cleared what the old flow wrote, keeping handles — they may already have been shared. Found two faults of my own on the way, both recorded on the issue and generalised as #39.
- [#39](https://github.com/Devski/platform-lite/issues/39) Make the UI airtight against what the backend and the database will accept (`enhancement`) — opened 05.09.2026: a rule can live in the form, the API schema and a database constraint, and nothing keeps the three in agreement. Two instances on one screen in #36: a submit the form could not know would fail, and a `CHECK` nothing above the database could see — both surfacing as "try again".
- [#44](https://github.com/Devski/platform-lite/issues/44) Where personal data lives: which of it is sensitive, and does it belong in its own store (`compliance`) — opened 06.09.2026, four questions to answer in writing before production. The name is public by design; the sensitive thing is its LINK to the private address. Also carries four gaps found while surveying: disk encryption unverified, no dev backups, session tokens in plaintext, recipient address possibly reaching a log line.
- Three from Dawid on 11.09.2026, deliberately outside the R360 milestone. One is already
  settled: ~~[#151](https://github.com/Devski/platform-lite/issues/151) an orbit from a RAR
  archive~~ — **dropped 12.09.2026** at his word, we do not support RAR for now; a zip is
  what the export tools produce, and the readers RAR would need are not worth carrying
  against that. The other two stand:
  [#152](https://github.com/Devski/platform-lite/issues/152) orbits on one page loading one
  after another, because the page's frame queue is first come, first served and an orbit
  in view queues its whole set; [#153](https://github.com/Devski/platform-lite/issues/153)
  motion that eases on a ring click and coasts after a drag, with the owner's switch.

## Requirements coverage

Every criterion A1–A11 and every boundary G1–G10 has its task (A11 — visual, no test
requirement). A12 is #72 and its tails; A13 is the R360 milestone (#68, #101–#106, and the
follow-ups #117–#127 and #137 the first real archive found). §10 risks are covered by #23
(deliverability) and inside #16/#24. §12 open questions = #25–#27.

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
