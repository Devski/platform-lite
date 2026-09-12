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

# #119: nothing in deploy/ or the workflows has ever removed an image; they
# only ever arrived. On 09.09.2026 that filled the instance's 24 GB root
# filesystem to 100% with 129 of them — 76 one per commit from this very
# deployment. Previews stopped starting at all (`no space left on device`),
# and dev read `unhealthy` for thirty checks in a row because Docker could
# not write the temporary file its health check needs, while the application
# served normally throughout.
#
# The obvious reflex would not have helped: every image here carries its
# commit sha as a tag, so `docker image prune` — which removes only untagged
# ones — frees exactly zero bytes. It has to be removal by name.
#
# What stays is decided by DEPLOYMENTS, not by age. Rolling back needs no
# registry (docs/deployment.md) because the instance holds no credential of
# its own (G9): an image that is not here cannot come back without CI.
# Previews pull into the same repository, so "the three newest images" is
# routinely the new dev image and two previews — with the version dev was
# running a minute ago in fourth place, removed. Caught in review.
IMAGES_KEPT=3
# The last $IMAGES_KEPT images that came up HEALTHY here, oldest first, one
# per line. A deployment whose container never became healthy is not one
# anybody would roll back to, and letting it take a place pushed the last
# good version out (review).
DEPLOYED=/opt/platform-lite/deployed-images
# Below this a pull has nowhere to unpack, so an instance that is already
# full can never fetch the deployment that would fix it. Hence clearing
# before fetching and not only after serving.
DISK_FLOOR_KB=$((5 * 1024 * 1024))

# Moves an image to the end of the list and keeps the last $IMAGES_KEPT: a
# redeploy or a rollback of the same sha counts once, as the newest.
record_deployed() {
  { grep -vxF "$1" "$DEPLOYED" 2>/dev/null || true; echo "$1"; } |
    tail -n "$IMAGES_KEPT" >"$DEPLOYED.tmp" || return 1
  # Only after the whole list was written: on a full disk the temporary file
  # is empty, and moving it over the real one would forget every rollback
  # target at the moment they matter most.
  mv "$DEPLOYED.tmp" "$DEPLOYED"
}

# Records the image dev's container runs right now — if it is serving. Read
# from the CONTAINER, not from .env: the rollback in docs/deployment.md
# changes the container and leaves the file naming the version that was
# rolled back FROM, so trusting the file removed the very image being run
# (review). Nothing is recorded without a container, or for one that is
# neither healthy nor on the list already.
record_running() {
  local container line
  container=$(docker compose ps --quiet app) || return 1
  [ -n "$container" ] || return 0
  line=$(docker inspect --format '{{.Config.Image}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container") || return 1
  # Already on the list is enough: that version once came up healthy, and dev
  # running it now means someone put it back on purpose. A health check still
  # catching up — up to 30 s after room was made, on the day the disk filled —
  # must not cost the operator that choice (review).
  if [ "${line#* }" = healthy ] || grep -qxF "${line%% *}" "$DEPLOYED" 2>/dev/null; then
    record_deployed "${line%% *}"
  fi
}

# Removes every image of ours that no container refers to and that is not
# one of the last $IMAGES_KEPT deployments. Housekeeping, so it never decides
# whether a deployment succeeded — see how it is called.
prune_old_images() {
  local in_use images id repo_tag removed=0
  # Running or stopped, ours or not. A preview (#31) sits on the sha of its
  # own pull request, which no deployment of dev ever recorded, and taking
  # its image would leave it unable to restart.
  #
  # Each read returns rather than carrying on: called with errexit off, an
  # empty list from a failed call would read as nothing to keep.
  in_use=$(docker ps -aq | xargs -r docker inspect --format '{{.Image}}') || return 1
  # A wildcard for the namespace: the registry owner has been renamed once
  # already (`3dbdg` → `devski`), and on the disk that filled 50 of the 129
  # images were still under the dead one.
  images=$(docker images --no-trunc --filter 'reference=ghcr.io/*/platform-lite' \
    --format '{{.ID}} {{.Repository}}:{{.Tag}}') || return 1
  while read -r id repo_tag; do
    [ -n "$id" ] || continue
    if grep -qxF "$id" <<<"$in_use" || grep -qxF "$repo_tag" "$DEPLOYED" 2>/dev/null; then
      continue
    fi
    # By tag, not by id: an image carried under both registry names is one id
    # with two tags, and Docker refuses to remove such an id without --force.
    # Untagging the dead name first leaves the image to the name still kept.
    # `if`, not `&&`, so a refusal is not the last word of the loop.
    if docker image rm "$repo_tag" >/dev/null 2>&1; then
      removed=$((removed + 1))
    fi
  done <<<"$images"
  echo "images: $removed removed; kept every one in use and the last $IMAGES_KEPT deployments"
}

# Only when it is tight: a deployment that changes nothing about the disk
# should not spend time on it, and the clearing after a healthy start below
# is what keeps it from getting here in the ordinary case. Unreadable reads
# as tight — `|| free_kb=0`, because under `set -euo pipefail` a failing
# `df` would otherwise end the deployment right here, fallback unreached.
#
# FIRST, before anything writes to the disk: recording the list and
# `docker login` both write a file, and on a disk at 100% — the day this
# is for — the first of them would end the run before any room was made
# (review). Nothing is lost by clearing this early: dev's container still
# runs and protects its image, and the list still holds the ones before.
free_kb=$(df --output=avail -k /var/lib/docker 2>/dev/null | tail -1) || free_kb=0
if [ "${free_kb:-0}" -lt "$DISK_FLOOR_KB" ]; then
  echo "under $((DISK_FLOOR_KB / 1024 / 1024)) GB free before the pull (or unreadable); clearing old images first"
  prune_old_images || echo "WARNING: clearing old images failed (#119); pulling anyway"
fi

# The version serving now is the one this deployment would be rolled back to,
# so it is on the list before `up` replaces its container — on the first
# deploy after #119 there is no list yet, and it would otherwise be the one
# image nothing protects.
record_running || echo "WARNING: could not record the running version (#119)"

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
# Wants, not Requires: with Requires a failed Docker would stop this check from
# starting at all — and "Docker is not answering" is one of the things it is
# there to say.
Wants=docker.service
After=docker.service

[Service]
Type=oneshot
User=ubuntu
# The application's log is in the journal (compose.yaml), and reading another
# unit's entries takes this group. Granted to the service, not to the account.
SupplementaryGroups=systemd-journal
StateDirectory=platform-ops
PrivateTmp=true
# Every call in the script has its own limit; this is the sum of them with room
# to spare, so a run is ended by its own time-outs, which report, and not by
# systemd, which does not.
TimeoutStartSec=600
# One core, no swap: a check must never be the process the OOM killer weighs
# against PostgreSQL.
MemoryMax=128M
# It reads, and writes only its own state. Nothing in it needs to become
# anyone else — the account has passwordless sudo, and this closes that path.
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateDevices=yes
RestrictSUIDSGID=yes
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
# could fill the disk being watched — and application log lines can carry an
# address or a session token, so how long they stay is a data question as much
# as a disk one. Capped at 300 MB and two weeks. MaxFileSec makes the two weeks
# true: journald deletes whole files, and at dev's volume a file otherwise
# covers a month. SystemKeepFree is set because the default is 15% of the disk,
# which a disk at 92% already breaks, and journald would then keep almost
# nothing.
cat >"$units/platform-lite.conf" <<'UNIT'
[Journal]
SystemMaxUse=300M
SystemKeepFree=500M
MaxFileSec=1day
MaxRetentionSec=14day
UNIT
# Ubuntu forwards the journal to rsyslog, which would keep a second copy of
# every application line in /var/log/syslog — rotated weekly for a month and
# capped by nothing. The containers log under a tag (compose.yaml), and lines
# with that tag stop here. Only those: auth.log and the rest are untouched.
cat >"$units/10-platform-lite.conf" <<'UNIT'
if $programname startswith 'platform-lite-' then stop
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
    echo "journal: capped at 300M and two weeks"
  fi
  if [ -d /etc/rsyslog.d ] && ! cmp -s "$units/10-platform-lite.conf" /etc/rsyslog.d/10-platform-lite.conf; then
    sudo install -m 644 "$units/10-platform-lite.conf" /etc/rsyslog.d/10-platform-lite.conf
    sudo systemctl restart rsyslog
    echo "syslog: application lines kept out of /var/log/syslog"
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
    # #119: here and nowhere earlier. Only now is this a version worth going
    # back to, and only now is everything the clearing could remove known
    # not to be needed for going back from it. Both on the left of `||`, so
    # bash runs them with errexit off: the application is already serving,
    # and housekeeping failing must not turn a healthy deployment red.
    record_deployed "$APP_IMAGE" || echo "WARNING: could not record $APP_IMAGE (#119)"
    prune_old_images || echo "WARNING: clearing old images failed (#119)"
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
