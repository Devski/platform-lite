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
#
# In a subshell of its own, so that a machine where this cannot be installed —
# no passwordless sudo, a read-only /etc, systemd missing — gets a warning and
# a working deployment rather than a failed one. The copy matters; it does not
# matter more than being able to ship a fix.
install_backup_timer() (
  set -e
  units=$(mktemp -d)
  trap 'rm -rf "$units"' EXIT
cat >"$units/platform-backup.service" <<'UNIT'
[Unit]
Description=Copy the PostgreSQL cluster to the bucket (#168)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=ubuntu
StateDirectory=platform-backup
# The dump passes through /var/tmp. With a private one, it is not merely
# unreadable to other accounts on the host — it is not there at all.
PrivateTmp=true
# A oneshot service has NO timeout unless it is given one, and a transfer that
# hangs without closing leaves the unit activating for ever: every later timer
# elapse merges into that job and does nothing. One hung night would stop every
# copy after it, silently. Fifteen minutes is forty times the longest run so far.
TimeoutStartSec=900
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
  if [ "$units_changed" = true ]; then
    echo "backup timer: units installed"
    sudo systemctl daemon-reload
  fi
  sudo systemctl enable --now platform-backup.timer >/dev/null
)
# NOT `if ! install_backup_timer`: calling it as a condition puts the whole
# function in bash's "errexit ignored" context, and the `set -e` inside does not
# re-arm it — a failed `install` would run on to the next line and the function
# would return the status of whatever came last. Verified on the instance's bash
# 5.2.21: under `if !` a failing step is invisible; captured this way it is not.
set +e
install_backup_timer
timer_status=$?
set -e
if [ "$timer_status" -ne 0 ]; then
  echo "WARNING: the database copy's timer could not be installed (#168);"
  echo "         the deployment continues — see docs/backup-and-restore.md"
fi

# The hourly check (#167) mails this when it is true; the deployment says it too,
# because a deploy log is read at the moment someone is already paying
# attention. It only warns: a stale copy is not a reason to refuse to deploy,
# it is a reason to know.
last_copy=/var/lib/platform-backup/last-success
if [ ! -f "$last_copy" ]; then
  echo "WARNING: no database copy has ever succeeded on this instance (#168)"
elif [ $(($(date +%s) - $(stat -c %Y "$last_copy"))) -gt 172800 ]; then
  echo "WARNING: the newest database copy is over two days old (#168):"
  echo "         $(cat "$last_copy")"
  echo "         check: systemctl status platform-backup.timer"
fi

# #167: the hourly look at this instance, and the one place its findings are
# turned into a message to a person — deploy/ops-check.sh, docs/operations.md.
# Installed the same way as the copy above and for the same reasons, including
# the subshell and the captured status; it must never stop a deployment.
install_ops_timer() (
  set -e
  units=$(mktemp -d)
  trap 'rm -rf "$units"' EXIT
cat >"$units/platform-ops.service" <<'UNIT'
[Unit]
Description=Look at this instance and tell a person what needs a decision (#167)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=ubuntu
# The application's log is in the journal (compose.yaml), and reading another
# unit's entries takes this group. Granted to the service, not to the account.
SupplementaryGroups=systemd-journal
StateDirectory=platform-ops
PrivateTmp=true
TimeoutStartSec=300
ExecStart=/bin/bash /opt/platform-lite/ops-check.sh
UNIT
cat >"$units/platform-ops.timer" <<'UNIT'
[Unit]
Description=Hourly look at this instance (#167)

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
UNIT
# The journal is where the application's log now lives, so it is also what
# could fill the disk being watched. Capped here rather than left to journald's
# default, which is a tenth of the filesystem.
cat >"$units/platform-lite.conf" <<'UNIT'
[Journal]
SystemMaxUse=300M
MaxRetentionSec=30day
UNIT
  units_changed=false
  for unit in platform-ops.service platform-ops.timer; do
    if ! cmp -s "$units/$unit" "/etc/systemd/system/$unit"; then
      sudo install -m 644 "$units/$unit" "/etc/systemd/system/$unit"
      units_changed=true
    fi
  done
  if [ "$units_changed" = true ]; then
    echo "ops timer: units installed"
    sudo systemctl daemon-reload
  fi
  sudo systemctl enable --now platform-ops.timer >/dev/null
  if ! cmp -s "$units/platform-lite.conf" /etc/systemd/journald.conf.d/platform-lite.conf; then
    sudo install -d -m 755 /etc/systemd/journald.conf.d
    sudo install -m 644 "$units/platform-lite.conf" /etc/systemd/journald.conf.d/platform-lite.conf
    sudo systemctl restart systemd-journald
    echo "journal: capped at 300M"
  fi
)
set +e
install_ops_timer
ops_status=$?
set -e
if [ "$ops_status" -ne 0 ]; then
  echo "WARNING: the hourly operations check could not be installed (#167);"
  echo "         the deployment continues — see docs/operations.md"
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
