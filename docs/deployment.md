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

Nothing below is done by CI. Until it is, the deploy job reports itself skipped
rather than failing every push.

### 1. On the instance

```
sudo mkdir -p /opt/platform-lite && sudo chown ubuntu /opt/platform-lite
docker network create platform
docker network connect platform postgres
```

The network is what lets `app` reach the database as `postgres:5432`. It does
**not** change how Postgres is published: it stays on `127.0.0.1`, so the SSH
tunnel remains the only way in from outside.

### 2. `/opt/platform-lite/.env`

Compose reads this file twice — for its own variable substitution and as the
application's environment:

```
SITE_ADDRESS=<hostname Caddy should serve>
S3_ORIGIN=https://platform-dev.s3.waw.io.cloud.ovh.net
DATABASE_URL=postgresql://postgres:<password>@postgres:5432/platform_devski
AUTH_SECRET=<32 random bytes>
APP_URL=https://<same hostname as SITE_ADDRESS>
APP_ENV=dev
S3_ENDPOINT=  S3_REGION=  S3_BUCKET=  S3_KEY=  S3_SECRET=  S3_PREFIX=
```

`APP_ENV` must not be `production` here, or dev stops sending
`X-Robots-Tag: noindex` and Google indexes it (A7). `APP_URL` must be `https://`
— the application refuses to start otherwise, because the session cookie's
`Secure` attribute is derived from it (A2).

### 3. Open the web ports

**Read this before doing it.** The project's OpenStack `security_groups` quota
is 0 (#2), so the instance has no security group and `ufw` is the only inbound
filter — and `ufw` does not filter ports Docker publishes on `0.0.0.0`. The
moment Caddy publishes 80 and 443, the security group is the real boundary
rather than a second layer. Raise the quota first (Control Panel → Quota &
Regions → "Increase your quota!") and re-run `scripts/bootstrap-dev.sh`, which
adds the group as soon as the project allows one.

```
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

### 4. Repository secrets

Generate a **separate** key for deployments — not the one you log in with — and
add its public half to the instance's `~/.ssh/authorized_keys`:

| Secret                | Value                                 |
| --------------------- | ------------------------------------- |
| `DEV_SSH_HOST`        | `ubuntu@<instance ip>`                |
| `DEV_SSH_KEY`         | the deploy key's **private** half     |
| `DEV_SSH_KNOWN_HOSTS` | output of `ssh-keyscan <instance ip>` |

`DEV_SSH_HOST` is also the switch: with it absent the deploy job skips, so the
secrets can be added in any order and the pipeline goes live when the host does.

## Rolling back

A deployment pins the commit SHA, so rolling back is running an older one. On
the instance:

```
cd /opt/platform-lite
APP_IMAGE=ghcr.io/3dbdg/platform-lite:<older sha> docker compose up --detach
```

`deploy/remote-deploy.sh` is the same script CI runs, kept readable and
runnable by hand on purpose: a deployment nobody can execute without CI is a
deployment nobody can rescue.

## Production

Not this document yet — #24. It differs in three ways: the deployment is
manual (SPEC §8), `APP_ENV=production`, and the database is a managed one
rather than a container. The sizing is an open question recorded on that issue.
