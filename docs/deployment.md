# Deploying platform-lite

How a commit becomes a running application, and what has to exist on the
instance for that to work. Decision of 05.09.2026 (#21): **the image is built
in CI and never on the machine it runs on** — a Next.js build wants more CPU
and memory than the dev instance has, while the running application is one Node
process of about 200 MB.

## The pipeline

A push to `main` runs the gate, builds the image, checks that the container
actually serves, publishes it to `ghcr.io/3dbdg/platform-lite`, then connects to
the instance over SSH and restarts the container against that exact commit.

Two properties worth stating, because both are easy to lose:

- **The image is published only after it has served a request.** The `image`
  job starts the container with no database and no bucket and fetches the
  landing page before pushing. An image that cannot serve never becomes
  something a deployment can reach for.
- **The instance holds no registry credential.** The deploy hands it a token
  that lives for the length of the CI run and logs out afterwards (G9).

## What runs on the instance

Three containers, nothing else:

| Container  | What it does                                            |
| ---------- | ------------------------------------------------------- |
| `caddy`    | the only thing the world reaches; TLS, security headers |
| `app`      | the Next.js server, **not** published to the host       |
| `postgres` | started by cloud-init (#2), bound to `127.0.0.1`        |

`app` is deliberately unpublished. Every rate limit in the application keys on
`x-forwarded-for`, and Caddy **overwrites** that header with the real peer
address — a directly reachable port would let anyone set it themselves and
guess passwords without limit (the #8 review's trust contract). CI greps for
that one line, because losing it is silent.

## Wiring it up (one time)

Seven steps, about twenty minutes of work plus one wait. Nothing here is done
by CI; until it is, the deploy job reports itself skipped rather than failing
every push. **Run everything in Git Bash**, from the repository root — in
PowerShell, `bash` is WSL, not Git Bash.

Have to hand: nothing. Every value is read from your local `.env`.

---

### Step 1 — Ask OVH to raise the security-group quota

Do this first because it is a support ticket and the answer is not immediate.
Nothing else waits for it; only step 5 has a note attached.

**The self-service page does not cover this.** Public Cloud → **Quota &
Regions** lists compute quotas only — instances, vCPU, RAM — and its _Increase
your quota!_ button cannot raise a network quota. Use **Contact Support** on
that same page instead (corrected 05.09.2026, after the documented path turned
out not to exist for this resource).

What makes the request unarguable is that the project is over its own limit
from birth, which no customer action can produce. Three independent readings,
all worth pasting in:

| Where                               | What it says                                                             |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `openstack quota show`              | `security_groups: 0`, against a documented default of 100                |
| Horizon → Project / Overview        | `Security Groups: Used 1 of 0`                                           |
| Horizon → Network / Security Groups | the _Create Security Group_ button disabled, labelled `(Quota exceeded)` |

The one group in use is `default`, which OpenStack creates itself when the
project is made. Ask for the documented defaults: `security_groups = 100`,
`security_group_rules = 1000`.

Horizon (`horizon.cloud.ovh.net`) is the standard OpenStack dashboard, hosted
by OVHcloud alongside their own panel. It talks to the same API as the
`openstack` command, which is why it shows quotas OVH's panel does not — and
why it is the quickest place to check whether the request has landed.

> **Do not tighten the `default` group instead.** The rule quota is 0 as well
> (`Used 20 of 0`), so rules can be deleted but not created. OVH's default
> group admits all inbound traffic; deleting its ingress rules to harden it
> would cut SSH off with no way to add it back, and the instance would have to
> be rebuilt. Until the quota is raised, `ufw` on the host is the filter.

**Done when:** the ticket is submitted. Carry on with step 2 immediately.

---

### Step 2 — Create a deploy key and authorize it

A key of its own, not the one you log in with: it lives in GitHub's secret
store, and a key that can deploy should not also be a key that is you.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/platform-deploy -N "" -C "platform-lite deploy"
```

```bash
ssh ubuntu@54.37.130.136 "cat >> ~/.ssh/authorized_keys" < ~/.ssh/platform-deploy.pub
```

**Done when** this prints `ok`:

```bash
ssh -i ~/.ssh/platform-deploy ubuntu@54.37.130.136 "echo ok"
```

---

### Step 3 — Prepare the instance

One script. It creates `/opt/platform-lite`, creates the `platform` docker
network, joins the existing Postgres container to it, and writes the
instance's `.env` derived from your local one — rewriting the database host
from the tunnel's `localhost:5433` to the container's `postgres:5432`.

Joining that network does **not** change how Postgres is published: it stays
on `127.0.0.1`, so the SSH tunnel remains the only way in from outside.

```bash
./scripts/wire-dev-deploy.sh
```

**Done when** it prints the network members including `postgres`, and the line
count of the written `.env`. It never echoes a secret.

Your local `.env` must already carry the e-mail settings (#22), because the
script only copies what is there:

```
EMAIL_API_KEY=       # Scaleway calls this SCW_SECRET_KEY
EMAIL_PROJECT_ID=    # Scaleway calls this SCW_DEFAULT_PROJECT_ID
EMAIL_FROM=          # an address on a domain verified in TEM
EMAIL_FROM_NAME=     # optional display name, e.g. Architektów 3d
EMAIL_REGION=        # optional, defaults to fr-par
EMAIL_REPLY_TO=      # optional; a mailbox someone reads (see below)
```

A deployed environment (`APP_ENV` anything but `local`/`ci`/`test`) **requires**
the first three and refuses to start a send without them. That is deliberate:
the fallback it replaced wrote the verification and password-reset links into
the container log, where anyone with log access could redeem them. The script
also stops if a key appears twice in your `.env` — it would otherwise splice
both lines into the instance file and leave the value empty.

Set `EMAIL_REPLY_TO`. The sending subdomain's MX record points at Scaleway,
which discards incoming mail, so without it a reply to a verification e-mail
disappears with no bounce and no trace. Point it at a mailbox on the apex
domain — the one on OVHcloud Zimbra — which keeps its own MX untouched.

The address it configures comes from `SITE_ADDRESS` in your `.env` — for dev,
`dev.architektow3d.pl` (SPEC §8), which needs one `A` record pointing at the
instance. Leave the variable empty and it falls back to `<ip>.nip.io`, which
resolves to the instance with no DNS of your own, so Let's Encrypt can still
issue a real certificate. That is what a rebuilt instance should use until its
record exists.

---

### Step 4 — Add the three repository secrets

```bash
gh secret set DEV_SSH_HOST --body "ubuntu@54.37.130.136"
```

```bash
gh secret set DEV_SSH_KEY < ~/.ssh/platform-deploy
```

```bash
gh secret set DEV_SSH_KNOWN_HOSTS --body "$(ssh-keyscan 54.37.130.136 2>/dev/null)"
```

The last one is why the deploy never uses `StrictHostKeyChecking=no`: it pins
the instance's host key, so a deploy cannot be taken over by whatever answers
at that address.

**Done when** `gh secret list` shows all three.

---

### Step 5 — Read this before opening the ports

The instance has **no security group** — the project's quota is 0 (step 1) —
so `ufw` is the only inbound filter. And `ufw` does not filter ports Docker
publishes: Docker writes its own iptables rules, below ufw. So from the moment
Caddy publishes 80 and 443, **the security group is the real boundary, and
there isn't one.**

What is actually exposed then: Caddy, and through it the application. The
database stays on `127.0.0.1` regardless, so it is not part of this.

Two honest options:

- **Wait** for the quota, re-run `scripts/bootstrap-dev.sh` — it adds the
  group as soon as the project allows one — and then open the ports.
- **Go ahead now** and add the group when the ticket clears. A dev instance
  serving a placeholder site, with a patched Ubuntu and one Node process
  behind Caddy, is a thin but not reckless target.

**This is your call, not mine.** If you choose the second, step 6.

---

### Step 6 — Open the web ports

```bash
ssh ubuntu@54.37.130.136 "sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw status"
```

**Done when** `ufw status` lists 22, 80 and 443, and nothing else.

---

### Step 7 — Deploy, and check it actually deployed

Any push to `main` now deploys. To trigger one without a code change:

```bash
git commit --allow-empty -m "Deploy: wire the dev instance (#21)" && git push
```

**Done when** the run's `deploy-dev` job reports `healthy after Ns` — and when
this answers `200` with both headers:

```bash
curl -I https://dev.architektow3d.pl/
```

`x-robots-tag: noindex` proves `APP_ENV` is not `production` (A7).
`strict-transport-security` proves the response came through Caddy rather than
from somewhere unexpected.

If the certificate is not ready yet, give it a minute — Caddy fetches it on
first request and port 80 has to be reachable for the challenge.

## Rolling back

A deployment pins the commit SHA, so rolling back is running an older one. The
image is already on the instance if it was ever deployed there, so this needs
no registry access:

```
cd /opt/platform-lite
APP_IMAGE=ghcr.io/3dbdg/platform-lite:<older sha> docker compose up --detach
```

**Drilled 05.09.2026**, two deployments back and forward again: seven seconds
to a healthy container each way, the site answering 200 throughout. The
mechanism is fast and it works.

What the drill actually found was the part around it. `docker compose ps` — the
first command anyone types when something is wrong — **failed outright**,
because `APP_IMAGE` reached the deployment only as a variable of the deploy
script's environment and was written down nowhere. Finding out what was running
meant reading a 40-character digest out of `docker ps`, and finding out what to
go back to meant reading the CI history. The deploy now records the tag in
`/opt/platform-lite/.env`, so `ps`, `logs` and `restart` work by hand and the
running version is legible on the machine itself.

`deploy/remote-deploy.sh` is the same script CI runs, kept readable and
runnable by hand on purpose: a deployment nobody can execute without CI is a
deployment nobody can rescue.

## Pull request previews

Opening a pull request starts a copy of that branch on the same instance, at
`pr-<n>.dev.architektow3d.pl`. Closing or merging it removes the copy. Both
happen in CI; the scripts live on the instance so either can be done by hand.

```bash
PR=7 APP_IMAGE=ghcr.io/3dbdg/platform-lite:<sha> \
  GH_TOKEN=<token> GH_ACTOR=<user> bash /opt/platform-lite/preview-up.sh
PR=7 bash /opt/platform-lite/preview-down.sh
```

**Two at a time, and that is a real ceiling.** Measured on the instance
(05.09.2026): **1 vCPU, 1.9 GB of memory, no swap**. Idle, the app holds 66 MB,
PostgreSQL 58 MB and the proxy 15 MB, so steady-state memory is not what limits
this. Two other things are.

With no swap, exhausting memory does not make the machine slow — it invokes the
OOM killer, which picks its victim by size. The biggest process here is as
likely to be PostgreSQL as the preview that caused the pressure, and that is
*dev's* database, shared by every preview.

And there is one core. Avatar resizing is the CPU-heavy path in this
application: measured on this instance, a 2.8 MB photo at 4000×3000 costs about
**220 ms** of pure computation to turn into both variants. That is a fifth of a
second during which the single core is doing nothing else, so uploads queue
behind one another while ordinary page requests — which mostly wait on the
database rather than compute — interleave freely. It is a real limit but a
modest one at this scale; it becomes the binding constraint long before memory
does. A preview sits idle until somebody opens it, so the ceiling is set for the
worst case rather than the average — each preview is additionally capped at
512 MB so one cannot take the machine on its own.

Raising the ceiling means a larger instance, which is a cost decision, and the
next thing to buy is a second core rather than more memory.

A preview shares the dev database and writes to its own `pr-<n>/` key prefix in
the bucket (SPEC §4). It runs with `APP_ENV=preview`, which does two things:
it keeps `X-Robots-Tag: noindex` on (A7), and it stops the application sending
real e-mail. That second one matters more than it looks — a preview is
reachable by anyone holding the link, and would otherwise mail verification
messages to any address typed into it, from our domain and against our quota.

Each preview is a **named** site in the proxy, not a wildcard one: a wildcard
certificate would need the DNS-01 challenge and a Caddy built with the DNS
provider's plugin, while a named host is issued over HTTP-01 by the binary
already running. The wildcard `A` record still has to exist so the name
resolves — `*.dev` pointing at the instance.

Previews reuse one site definition with dev (the `(site)` snippet in the
Caddyfile), so the security headers and the CSP cannot drift between the
environment a change is reviewed in and the one it lands in. CI greps for that.

Objects under `pr-<n>/` are deliberately left in the bucket when a preview is
torn down: removing them needs the S3 credentials, which the teardown script
has no reason to hold. They cost fractions of a cent.

## Production

Not this document yet — #24. It differs in three ways: the deployment is
manual (SPEC §8), `APP_ENV=production`, and the database is a managed one
rather than a container. The sizing is an open question recorded on that issue.
