#!/usr/bin/env bash
# Runs ON the instance, shipped there by the deploy job. Kept out of the
# workflow so it can be read, reviewed and run by hand — a deployment nobody
# can execute without CI is a deployment nobody can rescue.
#
# Expects in the environment: APP_IMAGE (the exact tag to run), GH_TOKEN and
# GH_ACTOR (a short-lived registry pull, valid only for the calling CI run —
# the instance keeps no standing credential of its own, G9).
set -euo pipefail

: "${APP_IMAGE:?APP_IMAGE must name the image tag to run}"
: "${GH_TOKEN:?GH_TOKEN must carry a registry pull for this run}"
: "${GH_ACTOR:?GH_ACTOR must name the registry user}"

cd /opt/platform-lite
export APP_IMAGE

echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

docker compose pull

# #53: the schema comes up BEFORE the new code serves, and before the old
# container is replaced. A deployment used to ship code and leave the schema
# to whoever remembered — on 06.09.2026 that put dev on new code against an
# old schema, and every profile page returned 500 for ten minutes while CI was
# green and the container called itself healthy.
#
# Order is the whole point. `pull` first, so the migrator is the version that
# belongs to the code about to run. Then migrate, with `set -e` making a
# failure end the deployment right here — old container still serving, old
# schema untouched, nothing half-swapped. Only then `up`.
#
# `compose run` rather than `docker run`: the service definition already
# carries the database credentials and the network, so this cannot drift away
# from what the app itself connects to. APP_IMAGE is exported above, so the
# one-off container is the image being deployed.
echo "applying migrations"
docker compose run --rm --no-deps --entrypoint node app /app/migrate.mjs

docker compose up --detach --remove-orphans

# The image declares its own HEALTHCHECK, so ask the container rather than
# guessing at a URL: at this point the hostname may not resolve yet, and a
# certificate may not exist. "The process is serving" is the claim being made.
# Record what is now running, before the health check can fail and leave the
# file describing something that is not there. Without this line `docker
# compose ps` — the first command anyone types during an incident — refuses to
# run at all, because APP_IMAGE reaches the deployment only as a variable of
# this script's own environment. Verified the hard way in the 05.09.2026
# rollback drill: the mechanism took 7 seconds, finding out what to roll back
# TO meant reading a 40-character digest out of `docker ps`.
if grep -q '^APP_IMAGE=' .env; then
  sed -i "s|^APP_IMAGE=.*|APP_IMAGE=$APP_IMAGE|" .env
else
  printf '%s
' "APP_IMAGE=$APP_IMAGE" >> .env
fi

# #168: the daily copy of the database, installed by the deployment rather than
# by hand, so it heals itself — a rebuilt instance has it after its first deploy
# from `main`, and a change to the script or the schedule arrives the way the
# application does. Written only when it differs: a deployment that changes
# nothing reloads nothing. `bash <path>`, exactly as CI invokes this file, so
# the copy never depends on an executable bit surviving a checkout and an scp.
units=$(mktemp -d)
cat >"$units/platform-backup.service" <<'UNIT'
[Unit]
Description=Copy the PostgreSQL cluster to the bucket (#168)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=ubuntu
StateDirectory=platform-backup
ExecStart=/bin/bash /opt/platform-lite/backup-db.sh
UNIT
cat >"$units/platform-backup.timer" <<'UNIT'
[Unit]
Description=Daily copy of the PostgreSQL cluster (#168)

[Timer]
# Quiet hours, and an odd minute so it shares the clock with nothing else.
OnCalendar=*-*-* 03:17:00 UTC
# An instance that was down at 03:17 copies at the next boot instead of
# skipping the day.
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
UNIT
units_changed=false
for unit in platform-backup.service platform-backup.timer; do
  if ! cmp -s "$units/$unit" "/etc/systemd/system/$unit"; then
    sudo install -m 644 "$units/$unit" "/etc/systemd/system/$unit"
    units_changed=true
  fi
done
rm -rf "$units"
if [ "$units_changed" = true ]; then
  echo "backup timer: units installed"
  sudo systemctl daemon-reload
fi
sudo systemctl enable --now platform-backup.timer >/dev/null

# Until #167 gives reports a way to reach a person, the deployment is the one
# routine that a human already watches. It only warns: a stale copy is not a
# reason to refuse to deploy, it is a reason to know.
last_copy=/var/lib/platform-backup/last-success
if [ ! -f "$last_copy" ]; then
  echo "WARNING: no database copy has ever succeeded on this instance (#168)"
elif [ $(($(date +%s) - $(stat -c %Y "$last_copy"))) -gt 172800 ]; then
  echo "WARNING: the newest database copy is over two days old (#168):"
  echo "         $(cat "$last_copy")"
  echo "         check: systemctl status platform-backup.timer"
fi

container=$(docker compose ps --quiet app)
for attempt in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    echo "healthy after ${attempt}s"
    exit 0
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "the container reports itself unhealthy:"
    docker compose logs --tail 50 app
    exit 1
  fi
  sleep 1
done

echo "never became healthy within 60s:"
docker compose logs --tail 50 app
exit 1
