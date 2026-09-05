#!/usr/bin/env bash
# Prepares the dev instance to receive deployments (#21, docs/deployment.md).
# Run from the repo root on your own machine; it works over the SSH access you
# already have and needs nothing from the OVH console.
#
# What it does NOT do, on purpose: open the web ports. That is a deliberate
# decision with a security note attached — see docs/deployment.md step 6.
set -euo pipefail

[ -f .env ] || { echo "STOP: no .env here — run from the repo root"; exit 1; }

# A key repeated in .env is ambiguous — dotenv keeps one occurrence and the
# helpers below would splice BOTH into the instance file, writing an empty
# value plus an orphan line. Seen for real on 05.09.2026 when a new EMAIL_FROM
# was added while the old empty one was still there, which would have left the
# deployment silently logging e-mail instead of sending it. Fail here instead.
DUPLICATES=$(grep -oE "^[A-Za-z0-9_]+=" .env | sort | uniq -d | tr -d "=" | tr "
" " ")
[ -z "$DUPLICATES" ] || { echo "STOP: .env defines these twice: $DUPLICATES"; exit 1; }

value() { grep -E "^$1=" .env | cut -d= -f2- ; }
# Same, but an absent key yields an empty string instead of aborting the run
# (set -o pipefail turns grep's "no match" into a failed pipeline). For
# settings a working instance may legitimately not have yet.
optional() { grep -E "^$1=" .env | cut -d= -f2- || true ; }

HOST=$(value DEV_SSH_HOST)
[ -n "$HOST" ] || { echo "STOP: DEV_SSH_HOST is empty in .env"; exit 1; }
IP=${HOST#*@}

# The hostname this environment answers on, from .env (SPEC §8). The fallback
# is the address used before the naming decision (#25) landed: nip.io resolves
# <ip>.nip.io to that ip, so Let's Encrypt can issue a real certificate over
# the HTTP-01 challenge with no domain at all — still the right answer for a
# rebuilt instance whose DNS is not in place yet.
SITE_ADDRESS=$(optional SITE_ADDRESS)
SITE_ADDRESS=${SITE_ADDRESS:-${IP}.nip.io}

DB_URL=$(value DATABASE_URL)
[ -n "$DB_URL" ] || { echo "STOP: DATABASE_URL is empty in .env"; exit 1; }
# Locally the database is reached through the SSH tunnel on localhost:5433.
# From inside the instance it is a container on a shared docker network.
REMOTE_DB_URL=$(printf '%s' "$DB_URL" | sed -E 's#@localhost:5433/#@postgres:5432/#')
[ "$REMOTE_DB_URL" != "$DB_URL" ] || {
  echo "STOP: DATABASE_URL does not look like the tunnelled one (@localhost:5433)"; exit 1; }

S3_ENDPOINT=$(value S3_ENDPOINT)
S3_BUCKET=$(value S3_BUCKET)
S3_ORIGIN="https://${S3_BUCKET}.${S3_ENDPOINT#https://}"
# Uploads go somewhere else: a presigned PUT is signed path-style, so the
# browser sends it to the endpoint itself rather than the bucket subdomain.
S3_UPLOAD_ORIGIN="$S3_ENDPOINT"

echo "==> Instance:   $HOST"
echo "==> Serving at: https://$SITE_ADDRESS"
echo "==> Bucket:     $S3_ORIGIN"
echo "==> Uploads to: $S3_UPLOAD_ORIGIN"
echo

echo "==> Directory, network, and the database container joined to it"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
sudo mkdir -p /opt/platform-lite
sudo chown "$USER:$USER" /opt/platform-lite
# Idempotent: both commands are no-ops the second time round.
docker network inspect platform >/dev/null 2>&1 || docker network create platform
docker network inspect platform --format '{{range .Containers}}{{.Name}} {{end}}' | grep -qw postgres ||
  docker network connect platform postgres
echo "    network members: $(docker network inspect platform --format '{{range .Containers}}{{.Name}} {{end}}')"
REMOTE

# This file is rewritten wholesale below, and APP_IMAGE is not ours to invent
# — the deployment writes it (deploy/remote-deploy.sh) with the tag it just
# rolled out. Carry the running value across so `docker compose` on the
# instance keeps working between a re-wire and the next deploy.
APP_IMAGE_LINE=$(ssh "$HOST" 'grep -E "^APP_IMAGE=" /opt/platform-lite/.env 2>/dev/null' || true)

echo "==> Writing /opt/platform-lite/.env (0600, never echoed here)"
{
  echo "# Written by scripts/wire-dev-deploy.sh from the local .env."
  echo "# Compose reads this twice: for its own substitution and as the app's"
  echo "# environment. Secrets live here and nowhere else (SPEC §7)."
  echo "SITE_ADDRESS=$SITE_ADDRESS"
  echo "S3_ORIGIN=$S3_ORIGIN"
  echo "S3_UPLOAD_ORIGIN=$S3_UPLOAD_ORIGIN"
  echo "APP_URL=https://$SITE_ADDRESS"
  # Not `production`: that is what keeps X-Robots-Tag: noindex on dev (A7).
  echo "APP_ENV=dev"
  echo "DATABASE_URL=$REMOTE_DB_URL"
  echo "AUTH_SECRET=$(value AUTH_SECRET)"
  echo "S3_ENDPOINT=$S3_ENDPOINT"
  echo "S3_REGION=$(value S3_REGION)"
  echo "S3_BUCKET=$S3_BUCKET"
  echo "S3_KEY=$(value S3_KEY)"
  echo "S3_SECRET=$(value S3_SECRET)"
  echo "S3_PREFIX=$(value S3_PREFIX)"
  # #22: with EMAIL_API_KEY empty the app logs every message instead of
  # sending it, so a half-filled .env degrades to the old behaviour rather
  # than erroring at boot.
  echo "EMAIL_API_KEY=$(optional EMAIL_API_KEY)"
  echo "EMAIL_PROJECT_ID=$(optional EMAIL_PROJECT_ID)"
  echo "EMAIL_FROM=$(optional EMAIL_FROM)"
  echo "EMAIL_REGION=$(optional EMAIL_REGION)"
  echo "EMAIL_REPLY_TO=$(optional EMAIL_REPLY_TO)"
  if [ -n "$APP_IMAGE_LINE" ]; then echo "$APP_IMAGE_LINE"; fi
} | ssh "$HOST" 'umask 077 && cat > /opt/platform-lite/.env && echo "    written: $(wc -l < /opt/platform-lite/.env) lines"'

echo
echo "Done. Still to do by hand (docs/deployment.md):"
echo "  - the deploy key and the three DEV_SSH_* repository secrets"
echo "  - opening ports 80/443 — read the security-group note first"
