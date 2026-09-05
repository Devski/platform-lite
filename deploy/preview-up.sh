#!/usr/bin/env bash
# Runs ON the instance. Starts (or replaces) the preview of one pull request
# and gives it a hostname (#31). Kept out of the workflow for the same reason
# as remote-deploy.sh: a preview nobody can start or kill by hand is one
# nobody can rescue.
#
# Expects in the environment: PR (the number), APP_IMAGE (the exact tag built
# for that pull request), GH_TOKEN and GH_ACTOR (a registry pull valid only
# for the calling CI run — the instance keeps no standing credential, G9).
set -euo pipefail

: "${PR:?PR must be the pull request number}"
: "${APP_IMAGE:?APP_IMAGE must name the image tag to run}"
: "${GH_TOKEN:?GH_TOKEN must carry a registry pull for this run}"
: "${GH_ACTOR:?GH_ACTOR must name the registry user}"

# The number reaches a container name, a hostname, a file path and an S3 key
# prefix. Anything but digits belongs in none of them.
case "$PR" in
  '' | *[!0-9]*) echo "STOP: PR must be digits, got: $PR" >&2; exit 1 ;;
esac

cd /opt/platform-lite

NAME="pr-$PR"
PREVIEWS=/opt/platform-lite/previews
mkdir -p "$PREVIEWS"

# Measured on the instance 05.09.2026: 1 vCPU, 1.9 GB, and NO SWAP. Idle, the
# app holds 66 MB, PostgreSQL 58 MB, the proxy 15 MB — so steady-state memory
# is not the binding constraint. Two things are.
#
# Without swap, running out of memory does not slow the machine down, it
# invokes the OOM killer, which picks a victim by size — and the biggest
# process here is as likely to be PostgreSQL as the preview that caused it.
# That is dev's database, shared by every preview.
#
# And there is ONE core. Avatar resizing (sharp, #12) is the CPU-heavy path in
# this application, and it spikes memory with it; two uploads at once already
# contend. A preview is idle until someone opens it, so the cap is about the
# worst case, not the average.
#
# Hence: refuse at the boundary, with a number, rather than let the kernel
# choose which container dies.
MAX_PREVIEWS=2
# Counted in a loop, not through a pipeline. `set -o pipefail` turns a grep
# that matches nothing into a failed pipeline, and "no previews running" is
# the NORMAL case — so the pipeline version killed the script exactly when it
# should have proceeded. Docker's name filter is a Go regexp, where `\+` is an
# escaped literal plus and would never match a container called pr-33.
running=0
for container in $(docker ps --filter 'name=^pr-[0-9]+$' --format '{{.Names}}'); do
  [ "$container" = "$NAME" ] || running=$((running + 1))
done
if [ "$running" -ge "$MAX_PREVIEWS" ]; then
  echo "STOP: $running previews already running (cap $MAX_PREVIEWS):" >&2
  docker ps --filter 'name=^pr-[0-9]+$' --format '  {{.Names}}  {{.Status}}' >&2
  echo "Close a pull request, or stop one with: bash preview-down.sh (PR=<n>)" >&2
  exit 1
fi

# Every setting the preview shares with dev — the database, the signing key,
# the bucket credentials — comes from the instance's own .env. Only what must
# differ is overridden below.
# `|| true` for the same reason: a missing key makes grep fail the pipeline,
# and the explicit check below reports that far better than `set -e` does.
SITE_ADDRESS=$(grep -E '^SITE_ADDRESS=' .env | tail -1 | cut -d= -f2- || true)
: "${SITE_ADDRESS:?the instance .env has no SITE_ADDRESS}"
HOSTNAME_="$NAME.$SITE_ADDRESS"

echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
docker pull "$APP_IMAGE"

docker rm --force "$NAME" >/dev/null 2>&1 || true
docker run --detach --name "$NAME" \
  --restart unless-stopped \
  --network platform \
  --memory 512m \
  --env-file /opt/platform-lite/.env \
  --env "APP_URL=https://$HOSTNAME_" \
  --env "S3_PREFIX=$NAME/" \
  --env "APP_ENV=preview" \
  --env "EMAIL_API_KEY=" \
  "$APP_IMAGE" >/dev/null

# APP_ENV=preview is load-bearing twice over. It keeps X-Robots-Tag: noindex
# on (only `production` is indexed, A7), and lib/email.ts counts `preview`
# among the environments that never send: a preview is reachable by anyone
# with the link and would otherwise mail real verification messages to any
# address typed into it, from our domain, against our quota. Blanking
# EMAIL_API_KEY on top of that is belt and braces — the key has no business
# in a throwaway container even unused.

printf '%s {\n\timport site %s\n}\n' "$HOSTNAME_" "$NAME" > "$PREVIEWS/$NAME.caddy"
docker exec platform-lite-caddy-1 caddy reload --config /etc/caddy/Caddyfile

for attempt in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    echo "preview ready: https://$HOSTNAME_ (healthy after ${attempt}s)"
    exit 0
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "the preview container reports itself unhealthy:" >&2
    docker logs --tail 50 "$NAME" >&2
    exit 1
  fi
  sleep 1
done

echo "the preview never became healthy within 60s:" >&2
docker logs --tail 50 "$NAME" >&2
exit 1
