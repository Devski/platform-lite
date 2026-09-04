# Dev environment: bootstrap and restore

How to stand up the complete platform-lite dev infrastructure on OVH Public Cloud
(region `waw`) — from an empty project to a working `pnpm dev`. **Executing this document
verbatim is the drill required by G10** (SPEC.md §7); after any real run, correct the
document wherever reality disagreed with it.

Target state (SPEC.md §8):

- one `d2-2` instance (~€7/month) running Docker with PostgreSQL 17 bound to
  `127.0.0.1` — reachable only through an SSH tunnel, never exposed publicly
- object storage bucket `platform-dev` (S3 endpoint `https://s3.waw.io.cloud.ovh.net`)
- per-developer databases `platform_<handle>` and `platform_test_<handle>` (SPEC.md §4)

## Part 1 — manual console steps (one-time, ~15 minutes)

These cannot be scripted from zero (they create the credentials everything else uses)
or they touch payment:

1. **Public Cloud project** — OVH Control Panel → Public Cloud → create a project
   (requires a payment method).
2. **OpenStack user** (drives the `openstack` CLI) — in the project: Project Management →
   Users & Roles → create a user with the Administrator role (simplest for a solo dev
   project) → download the **OpenRC file** for region `WAW1`. Store it outside the repo,
   e.g. `~/.ovh/openrc.sh` — it is a credential.
3. **S3 credentials** — Object Storage → the users list → **Create user** → select the
   OpenStack user from step 2 (it needs the **Administrator** or **ObjectStore operator**
   role; being one is a precondition for the keys, not the keys themselves). The access
   key and secret key are shown once; afterwards the access key stays visible in the
   user's row and the secret is behind the row's **“…”** menu → _View the secret key_.
   Corrected 04.09.2026 against the console and the OVHcloud documentation: an earlier
   version of this document pointed at a separate “S3 users” section, which is not
   where the console puts it. Equivalent without the console, once the OpenRC
   file works: `openstack ec2 credentials list` (or `create` if the list is empty) —
   OVH stores these in Keystone.

Nothing from this part ever goes into the repo or the chat: credentials live in the
OpenRC file and in your `.env` (gitignored).

## Part 2 — scripted bootstrap

Run from the repo root in bash (Git Bash on Windows). One-time tools — install them
into their own virtual environment, not the system Python: on Windows a
`pip install` into `C:\Python310` fails part-way with a locked-file `OSError`,
leaving the CLIs half-installed (seen 04.09.2026).

```
python -m venv ~/.venvs/ovh
~/.venvs/ovh/Scripts/python.exe -m pip install python-openstackclient awscli
export PATH="$HOME/.venvs/ovh/Scripts:$PATH"   # every shell that runs the bootstrap
```

```
source ~/.ovh/openrc.sh                            # OpenStack credentials
export AWS_ACCESS_KEY_ID=<s3 access key>
export AWS_SECRET_ACCESS_KEY=<s3 secret key>
export GITHUB_HANDLE=<your-github-handle>
export POSTGRES_PASSWORD=$(openssl rand -hex 32)   # hex only — safe for the template
echo "$POSTGRES_PASSWORD"                          # store it in your password manager
./scripts/bootstrap-dev.sh
```

The script reuses the keypair and security group if they already exist, and is loud
about the one expensive step: **creating the instance starts the ~€7/month billing.**
What it does:

1. verifies the `d2-2` flavor and the Ubuntu 24.04 image exist in the region,
2. uploads your SSH public key as keypair `platform-dev`,
3. creates security group `platform-dev-ssh` — inbound TCP 22 only,
4. renders `scripts/cloud-init.yaml.tmpl` (Docker, `postgres:17` on `127.0.0.1`, the two
   per-developer databases) and boots instance `platform-dev` with it,
5. creates the `platform-dev` bucket,
6. writes the bucket lifecycle rule `expire-staged-uploads`: objects under
   `<prefix>staging/` expire after 1 day. Abandoned avatar uploads (#12) leave objects
   with no `files` row, invisible to the A9 quota. The rule is a **backstop only** — S3
   expiration is expressed in whole days while the presign TTL is 120 s, so issue #30
   makes the application itself account for and sweep staged bytes. The script refuses
   to overwrite lifecycle rules it did not write; `SKIP_LIFECYCLE=1` opts out,
7. prints the exact values for your `.env`.

## Part 3 — verify (this is the drill)

1. `cp .env.example .env` (if you have none) and fill in the printed values.
2. `pnpm db:tunnel` in a separate terminal — uses `DEV_SSH_HOST` from `.env` and maps
   `localhost:5433` to the instance's `127.0.0.1:5432`.
3. Databases exist (cloud-init needs 2–3 minutes after boot — retry before assuming
   failure). Without a local `psql`, over SSH:

   ```
   ssh <DEV_SSH_HOST> sudo docker exec postgres psql -U postgres -c '\l'
   ```

   With a local `psql`, through the tunnel (this also proves the exact path the app
   will use): `psql "<DATABASE_URL>" -c '\l'`. Both `platform_<handle>` and
   `platform_test_<handle>` must be listed.

4. `aws --endpoint-url https://s3.waw.io.cloud.ovh.net s3 ls s3://platform-dev` —
   empty listing, no error.
5. `pnpm db:migrate`, then `pnpm db:seed` — both go through the tunnel; the seed reports
   14 created profiles and prints the password. `pnpm dev` then renders
   http://localhost:3000; sign in with a seed account (`<handle>@seed.example`) and the
   settings pages show the seeded profile (the public page arrives with #18).

## Restore after a disaster (G10 direction)

Dev data is disposable: on a fresh database, `pnpm db:migrate && pnpm db:seed` recreates it
(G7); the seed adds, it never resets. Restore = delete and re-run with the same inputs,
then rebuild the data through the tunnel (Part 3, steps 1–2):

```
openstack server delete platform-dev
./scripts/bootstrap-dev.sh
pnpm db:migrate
pnpm db:seed
```

The bucket and its objects live independently of the instance and survive its loss.
Prod restore (managed database, snapshots) is defined by task #24 and will extend this
document.

## Decisions behind this setup

- **SSH tunnel instead of an allow-listed IP** (30.08.2026) — survives home-IP rotation,
  and the database is never internet-facing; even a security-group mistake exposes
  nothing, because Postgres binds to `127.0.0.1`.
- **No Terraform** — consciously out of scope (SPEC.md §11); one instance and one bucket
  do not justify the tooling or its exit cost.
- **Manual part kept minimal** — only project creation, payment and initial credentials;
  everything repeatable lives in `scripts/` so the restore drill stays honest.
