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

# The number reaches a container name, a hostname, a file path, an S3 key
# prefix and now a database name. Anything but digits belongs in none of them.
case "$PR" in
  '' | *[!0-9]*) echo "STOP: PR must be digits, got: $PR" >&2; exit 1 ;;
esac

cd /opt/platform-lite

NAME="pr-$PR"
PREVIEWS=/opt/platform-lite/previews
mkdir -p "$PREVIEWS"

# A preview needs a database of its own (#113). It used to run the pull
# request's image against DEV's database, and previews never migrate: every
# pull request adding a column its pages read previewed as a server error —
# #112 first, #170 again five days later. The preview's schema has to be the
# pull request's, and dev's has to stay `main`'s, so the only honest answer is
# a copy.
#
# The copy is taken when the preview starts and dropped with it, which also
# settles what a preview IS: dev's data as of a minute ago, plus this pull
# request's migrations. Accounts made in a preview, and the rows recording
# what was uploaded there, do not outlive it.
DB_URL=$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- || true)
: "${DB_URL:?the instance .env has no DATABASE_URL}"
# The query string is split off before the path is touched, so a future
# ?sslmode=... survives the swap of the database name instead of becoming part
# of it.
DB_BASE=${DB_URL%%\?*}
DB_QUERY=${DB_URL#"$DB_BASE"}
SOURCE_DB=${DB_BASE##*/}
CLONE="platform_pr_$PR"
PREVIEW_DB_URL="${DB_BASE%/*}/$CLONE$DB_QUERY"
DUMP="/tmp/$CLONE.sql"

# That name reaches a `create database` statement.
case "$SOURCE_DB" in
  '' | *[!a-z0-9_]*)
    echo "STOP: DATABASE_URL names no plain database: $SOURCE_DB" >&2
    exit 1
    ;;
esac

psql_pg() {
  docker exec -i postgres psql -U postgres -v ON_ERROR_STOP=1 -q -d postgres "$@"
}

# Before anything else: a copy of dev with no container is nobody's preview.
# Every failure below this line exits with the copy already made, an older
# branch's preview-down.sh knows nothing about copies at all, and a cancelled
# CI run takes its ssh with it — so the sweep, not the teardown, is what makes
# leftovers impossible to accumulate. `docker ps -a`, not `docker ps`: a
# container the OOM killer stopped is still somebody's open preview.
for left in $(psql_pg -At -c "select datname from pg_database where datname like 'platform\_pr\_%'"); do
  container="pr-${left#platform_pr_}"
  [ -z "$(docker ps -a --filter "name=^$container$" --format '{{.Names}}')" ] || continue
  echo "dropping $left — no $container container to own it"
  psql_pg -c "drop database if exists \"$left\" with (force)" || true
done
# And the dumps they were made from, which no trap catches when the process is
# killed rather than ended (this instance has no swap; the OOM killer picks by
# size, and a dump of the whole database is a fat target).
docker exec postgres sh -c 'rm -f /tmp/platform_pr_*.sql' >/dev/null 2>&1 || true

# Measured on the instance 05.09.2026: 1 vCPU, 1.9 GB, and NO SWAP. Idle, the
# app holds 66 MB, PostgreSQL 58 MB, the proxy 15 MB — so steady-state memory
# is not the binding constraint. Two things are.
#
# Without swap, running out of memory does not slow the machine down, it
# invokes the OOM killer, which picks a victim by size — and the biggest
# process here is as likely to be PostgreSQL as the preview that caused it.
# That is dev's database, and since #113 the copies every preview runs on.
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

# Every setting the preview shares with dev — the signing key, the bucket
# credentials — comes from the instance's own .env. Only what must differ is
# overridden below.
# `|| true` for the same reason: a missing key makes grep fail the pipeline,
# and the explicit check below reports that far better than `set -e` does.
SITE_ADDRESS=$(grep -E '^SITE_ADDRESS=' .env | tail -1 | cut -d= -f2- || true)
: "${SITE_ADDRESS:?the instance .env has no SITE_ADDRESS}"
HOSTNAME_="$NAME.$SITE_ADDRESS"

# Everything this run leaves behind if it does not finish. The copy goes too
# unless the preview actually came up: a copy of every dev account's rows,
# owned by nothing, is the one leftover worth being strict about.
started=0
leave_nothing() {
  docker logout ghcr.io >/dev/null 2>&1 || true
  docker exec postgres rm -f "$DUMP" >/dev/null 2>&1 || true
  [ "$started" = 1 ] ||
    psql_pg -c "drop database if exists \"$CLONE\" with (force)" >/dev/null 2>&1 ||
    true
}
echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin
trap leave_nothing EXIT INT TERM HUP
docker pull "$APP_IMAGE"

# The old container goes first, before its database is taken away from under
# it. Every step after this can fail; what must never happen is a container
# left running and serving against a database that is being replaced — the
# same invariant remote-deploy.sh is built around, which is why it migrates
# before it swaps.
docker rm --force "$NAME" >/dev/null 2>&1 || true

# WITH (FORCE) disconnects whatever is still on the old copy.
echo "copying $SOURCE_DB into $CLONE"
psql_pg -c "drop database if exists \"$CLONE\" with (force)"
psql_pg -c "create database \"$CLONE\""
# Dump to a file and restore from the file, rather than `pg_dump | psql`: a
# pipeline reports only its LAST command's status, so a failed dump would pass
# for a successful restore of nothing — and the preview would look like a
# working one with an empty database. (`create database ... template` is the
# other way to copy and is refused while anything is connected to the source;
# dev's own container is.)
#
# umask 077 because the file is every dev account's e-mail address and
# password hash in plain SQL, and VERBOSITY=terse because psql prints the
# offending ROW as context when a restore fails — into a CI log this
# repository publishes.
docker exec postgres sh -c "umask 077; pg_dump -U postgres --no-owner --no-privileges -f '$DUMP' '$SOURCE_DB'"
docker exec -i postgres psql -U postgres -v ON_ERROR_STOP=1 -q \
  --set VERBOSITY=terse -d "$CLONE" -f "$DUMP"
docker exec postgres rm -f "$DUMP"

# What must not survive the copy. A session is valid for thirty days (A2) and
# both environments sign with the same key, so a copy of dev's sessions is a
# set of credentials that signing out on dev can no longer revoke — the copy
# is frozen and nothing reaches into it. Nobody needs dev's live sessions to
# look at a preview; you sign in to it.
docker exec -i postgres psql -U postgres -v ON_ERROR_STOP=1 -q \
  --set VERBOSITY=terse -d "$CLONE" -c "truncate table sessions, verifications"

# The pull request's own migrator, against the pull request's own database.
# `set -e` ends the preview here if it fails, rather than starting a container
# whose every page will answer 500 — which is the whole of #113.
#
# Only the one variable it reads: migrate.mjs wants DATABASE_URL and nothing
# else, and a throwaway container running an unmerged branch has no business
# holding the mail key or the bucket credentials. Exported rather than written
# as --env NAME=value, because /proc/<pid>/cmdline is world-readable on this
# machine and the value carries the database password.
echo "applying this pull request's migrations to $CLONE"
export DATABASE_URL="$PREVIEW_DB_URL"
docker run --rm --network platform --memory 512m \
  --env DATABASE_URL \
  --entrypoint node "$APP_IMAGE" /app/migrate.mjs

docker run --detach --name "$NAME" \
  --restart unless-stopped \
  --network platform \
  --memory 512m \
  --env-file /opt/platform-lite/.env \
  --env DATABASE_URL \
  --env "APP_URL=https://$HOSTNAME_" \
  --env "S3_PREFIX=$NAME/" \
  --env "APP_ENV=preview" \
  --env "EMAIL_API_KEY=" \
  "$APP_IMAGE" >/dev/null
started=1

# APP_ENV=preview is load-bearing three times over. It keeps X-Robots-Tag:
# noindex on (only `production` is indexed, A7); lib/email.ts counts `preview`
# among the environments that never send — a preview is reachable by anyone
# with the link and would otherwise mail real verification messages to any
# address typed into it, from our domain, against our quota; and the R360
# collector refuses to run in one, which matters more since #113 gave the
# preview a COPY of dev's rows naming dev's objects in the shared bucket.
# Blanking EMAIL_API_KEY on top of that is belt and braces — the key has no
# business in a throwaway container even unused.

printf '%s {\n\timport site %s\n}\n' "$HOSTNAME_" "$NAME" > "$PREVIEWS/$NAME.caddy"
docker exec platform-lite-caddy-1 caddy reload --config /etc/caddy/Caddyfile

for attempt in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    echo "preview ready: https://$HOSTNAME_ (healthy after ${attempt}s) — on its own copy of $SOURCE_DB, so accounts and uploads made here die with the preview"
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
