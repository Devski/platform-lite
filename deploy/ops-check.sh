#!/usr/bin/env bash
# Runs ON the instance, every hour, from platform-ops.timer (#167). Installed
# by remote-deploy.sh; the whole practice around it is docs/operations.md.
#
# What it is for: the design of this system leaves several decisions to a
# person — the collector's unrecorded frame sets (#156), a disk filling up
# (#119), a nightly copy that stopped (#168) — and until now every one of them
# was said into a log nobody reads. This script is the path from the saying to
# the person. It looks, writes what it saw to the journal, and mails when
# something needs a decision; once a day it mails anyway, so that a quiet inbox
# means "checked, nothing to do" rather than "nobody looked".
#
# Three tiers and no more — more than that and the channel dies of noise:
#   ACT NOW    mailed when it starts, again if it is still true a day later,
#              and once more, per condition, when it stops
#   THIS WEEK  in the daily report
#   RECORD     in the daily report, so a number has a history
#
# What it never sends: an address, a handle, a name, or a line of any log.
# The report goes to a mailbox that may well sit outside the EU (§7), so it
# carries counts and the instance's own figures, nothing about anybody.
#
# What it cannot do: report this instance's death. That is
# .github/workflows/watch.yml, from outside.
#
# Written for the moments it exists for. Docker hung, the disk full, the
# journal unreadable, the mail provider down: each has to end in a line that
# says so, never in a script that stopped before writing anything. So every
# call that can hang has a time limit, nothing is written to disk on the way
# to a mail, and the body is one function — a deploy that rewrites this file
# mid-run cannot make bash execute half of each version.
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/platform-lite/.env}
STATE_DIR=${STATE_DIR:-/var/lib/platform-ops}
BACKUP_RECORD=${BACKUP_RECORD:-/var/lib/platform-backup/last-success}
# 05 UTC is 07:00 in Warsaw in summer and 06:00 in winter: before the day
# starts, and after the nightly copy (03:17) has had its chance. The daily
# report goes at the first run AT OR AFTER this hour, so a late or failed run
# is retried the next hour rather than skipped until tomorrow.
DIGEST_HOUR_UTC=${DIGEST_HOUR_UTC:-05}
# Conditions one bad look can produce on one core: a slow answer during an
# image pull, a container being recreated by a deploy, the first run after a
# boot. They are ACT NOW only when the previous hour saw them too.
FLAKY=" docker site container-platform-lite-app-1 container-platform-lite-caddy-1 container-postgres "

act_keys=()
act=()
week=()
record=()
now_seen=()
declare -A act_line=()
declare -A was_seen=()

# say <tier> <key> <line>. The key names the CONDITION, not the numbers in the
# line: "disk" stays "disk" from 91% to 92%, so a disk that keeps filling is one
# alert, not one an hour.
say() {
  local tier=$1 key=$2
  shift 2
  case "$tier" in
    act)
      now_seen+=("$key")
      if [[ $FLAKY == *" $key "* ]] && [ -z "${was_seen[$key]:-}" ]; then
        week+=("$* — seen once; ACT NOW if it is still true next hour")
        return 0
      fi
      act_keys+=("$key")
      act+=("$*")
      act_line[$key]="$*"
      ;;
    week) week+=("$*") ;;
    *) record+=("$*") ;;
  esac
}

# A state file that cannot be written must not end the run: the report still
# has to go out. The cost of a lost write is one repeated mail.
write_state() {
  if ! printf '%s\n' "$2" >"$STATE_DIR/$1.new" 2>/dev/null ||
    ! mv -f "$STATE_DIR/$1.new" "$STATE_DIR/$1" 2>/dev/null; then
    echo "WARNING: could not write $STATE_DIR/$1 — the next run may repeat what this one sent" >&2
  fi
}

is_count() { [[ ${1:-} =~ ^[0-9]+$ ]]; }

# The mail provider. The key goes to curl through a file descriptor: not in
# argv (/proc/<pid>/cmdline is world-readable here), not in the environment of
# anything else this script starts, and not on a disk that may be full.
tem() {
  curl -sS --fail-with-body --max-time 30 \
    -K <(printf 'header = "X-Auth-Token: %s"\n' "$EMAIL_API_KEY") "$@"
}

load_env() {
  # Only the variables this script uses, and none of them exported: the .env
  # also holds the database password, the signing key and the bucket
  # credentials, and a report has no business carrying those, nor its own mail
  # key into every docker and journalctl it runs.
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      EMAIL_API_KEY=* | EMAIL_PROJECT_ID=* | EMAIL_REGION=* | EMAIL_FROM=* | \
        EMAIL_FROM_NAME=* | OPS_EMAIL=* | SITE_ADDRESS=* | APP_ENV=*)
        printf -v "${line%%=*}" '%s' "${line#*=}"
        ;;
    esac
  done <"$ENV_FILE"
  EMAIL_API_KEY=${EMAIL_API_KEY:-}
  EMAIL_PROJECT_ID=${EMAIL_PROJECT_ID:-}
  EMAIL_FROM=${EMAIL_FROM:-}
  EMAIL_FROM_NAME=${EMAIL_FROM_NAME:-}
  EMAIL_REGION=${EMAIL_REGION:-fr-par}
  OPS_EMAIL=${OPS_EMAIL:-}
  SITE_ADDRESS=${SITE_ADDRESS:-}
  ENVIRONMENT=${APP_ENV:-unknown}
}

check_disk() {
  # The instance's one disk holds the images, the database, the journal and
  # every preview. Full, it stops PostgreSQL writing — dev down, and every
  # preview with it.
  local used free
  used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  free=$(df -h --output=avail / | tail -1 | tr -d ' ')
  if [ "$used" -ge 90 ]; then
    say act disk "disk at ${used}%, ${free} free — when it fills, PostgreSQL stops writing and previews stop starting (#119)"
  elif [ "$used" -ge 80 ]; then
    say week disk "disk at ${used}%, ${free} free (#119)"
  else
    say record disk "disk at ${used}%, ${free} free"
  fi
}

check_docker() {
  # Docker unreachable is itself the finding — and the reason every check
  # after this one is skipped rather than reported as "missing" three times.
  if ! timeout 20 docker info >/dev/null 2>&1; then
    say act docker "Docker is not answering — the containers on this instance are in an unknown state"
    return 1
  fi
  local images name state
  images=$(timeout 15 docker images --format '{{.Repository}}' 2>/dev/null |
    awk '/platform-lite/ {n++} END {print n+0}') || images="an unknown number of"
  say record images "$images application images kept on the instance (#119)"
  for name in platform-lite-app-1 platform-lite-caddy-1 postgres; do
    state=$(timeout 15 docker inspect \
      --format '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' \
      "$name" 2>/dev/null) || state=missing
    case "$state" in
      running | running/healthy | running/starting) say record "container-$name" "$name: $state" ;;
      *) say act "container-$name" "$name is $state" ;;
    esac
  done
  return 0
}

check_site() {
  # Through the proxy, as a visitor reaches it — but resolved to this machine,
  # so the answer does not depend on the network hairpinning back in. Whether
  # the site answers from OUTSIDE is watch.yml's question.
  [ -n "$SITE_ADDRESS" ] || return 0
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    --resolve "$SITE_ADDRESS:443:127.0.0.1" "https://$SITE_ADDRESS/" || true)
  case "$code" in
    [1-4][0-9][0-9]) say record site "https://$SITE_ADDRESS/ answers $code" ;;
    *) say act site "https://$SITE_ADDRESS/ answers ${code:-nothing} from the instance itself" ;;
  esac
}

check_backup() {
  if [ ! -f "$BACKUP_RECORD" ]; then
    say act backup "no copy of the databases has ever succeeded on this instance (#168)"
    return 0
  fi
  local age_h
  age_h=$((($(date +%s) - $(stat -c %Y "$BACKUP_RECORD")) / 3600))
  # 36 hours: a night can be late (the timer has five minutes of jitter and
  # catches up after a reboot), but two nights missed is a copy that stopped.
  if [ "$age_h" -gt 36 ]; then
    say act backup "the newest copy of the databases is ${age_h} h old — the nightly copy has stopped (#168)"
  else
    say record backup "databases copied ${age_h} h ago ($(awk '{print $3}' "$BACKUP_RECORD") bytes)"
  fi
}

check_previews() {
  # Copies of dev's database that no preview container owns (#113).
  local databases db copies=0 orphans=0
  if ! databases=$(timeout 15 docker exec postgres psql -U postgres -At -d postgres \
    -c "select datname from pg_database where datname like 'platform\_pr\_%'" 2>/dev/null); then
    say week previews "PostgreSQL could not be asked which preview databases exist"
    return 0
  fi
  for db in $databases; do
    copies=$((copies + 1))
    [ -n "$(timeout 15 docker ps -a --filter "name=^pr-${db#platform_pr_}$" --format '{{.Names}}' 2>/dev/null)" ] ||
      orphans=$((orphans + 1))
  done
  if [ "$orphans" -gt 0 ]; then
    say week previews "$orphans preview database(s) with no container — copies of dev's accounts; the next preview sweeps them, or docs/dev-environment.md"
  else
    say record previews "$copies preview database(s), each with its container"
  fi
}

check_log() {
  # One pass over the last day of the application's log, counting — never
  # keeping a line. A log line can carry an address or a session token, and
  # this report leaves the instance. Matched on a field journald sets itself
  # (_SYSTEMD_UNIT) as well as the container's name, which compose keeps from
  # one deploy to the next.
  local counts lines unrecorded failed stalls errors
  if ! counts=$(timeout 60 journalctl --no-pager --output=cat \
    _SYSTEMD_UNIT=docker.service CONTAINER_NAME=platform-lite-app-1 \
    --since "24 hours ago" 2>/dev/null |
    LC_ALL=C.UTF-8 awk '
      { lines++ }
      /^\[r360\] collector: [0-9]+ frame set\(s\) no record names/ { unrecorded = $3 + 0 }
      /^\[r360\] collector: (the (run|report) failed|the schedule did not start|owner .* failed)/ { failed++ }
      /^\[db\]/ { stalls++ }
      /⨯|Uncaught|Unhandled/ { errors++ }
      END { printf "%d %d %d %d %d\n", lines, unrecorded, failed, stalls, errors }'); then
    say week log "the application's log could not be read from the journal — none of its counts are in this report"
    return 0
  fi
  read -r lines unrecorded failed stalls errors <<<"$counts"
  if ! is_count "$lines" || ! is_count "$unrecorded" || ! is_count "$failed" ||
    ! is_count "$stalls" || ! is_count "$errors"; then
    say week log "the application's log gave counts this script cannot read"
    return 0
  fi
  # An empty day is not a quiet day: the collector alone speaks every twelve
  # hours. Zero lines from a container that has been up longer than that means
  # the journal is not being read — permissions, a filter, a driver — and every
  # "none" below would be a lie.
  local started started_s
  started=$(timeout 15 docker inspect --format '{{.State.StartedAt}}' platform-lite-app-1 2>/dev/null || true)
  started_s=$(date -d "$started" +%s 2>/dev/null || date +%s)
  if [ "$lines" -eq 0 ] && [ $(($(date +%s) - started_s)) -gt $((13 * 3600)) ]; then
    say week log "the application's log is empty for a container up over 13 hours — it is not being read, so its counts are not in this report"
    return 0
  fi
  [ "$unrecorded" -eq 0 ] ||
    say week collector "the R360 collector found $unrecorded frame set(s) that no record names and left them alone — a person decides (#156); the list: journalctl CONTAINER_NAME=platform-lite-app-1 | grep collector"
  [ "$failed" -eq 0 ] || say week collector-failed "the R360 collector failed $failed time(s)"
  [ "$stalls" -eq 0 ] || say week db "$stalls database deadline(s) hit (#172)"
  if [ "$errors" -gt 0 ]; then
    say week errors "$errors unhandled server error(s) in 24 h"
  else
    say record errors "no unhandled server errors in 24 h ($lines log lines read)"
  fi
}

check_mail() {
  # What the provider did with ours (#22, #23). Counts only — the provider's
  # own console has the addresses, and that is where they stay.
  [ -n "$EMAIL_API_KEY" ] && [ -n "$EMAIL_PROJECT_ID" ] || return 0
  local base="https://api.scaleway.com/transactional-email/v1alpha1/regions/$EMAIL_REGION"
  local since stats parsed sent failed
  since=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)
  if stats=$(tem "$base/statistics?project_id=$EMAIL_PROJECT_ID&since=$since" 2>/dev/null) &&
    parsed=$(printf '%s' "$stats" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(int(d["total_count"]), int(d["failed_count"]))' 2>/dev/null) &&
    read -r sent failed <<<"$parsed" && is_count "$sent" && is_count "$failed"; then
    # A handful of failures in a small volume is a bad address; a quarter of
    # everything failing is the domain's reputation going, and the first sign
    # anyone else would notice is "I never got the e-mail".
    if [ "$sent" -ge 4 ] && [ $((failed * 4)) -ge "$sent" ]; then
      say act mail "$failed of $sent messages failed in 24 h — the sending domain's reputation, or the provider"
    elif [ "$failed" -gt 0 ]; then
      say week mail "$failed of $sent messages failed in 24 h (a bounce or a rejection)"
    else
      say record mail "$sent messages in 24 h, none failed"
    fi
  else
    say week mail "the mail provider's statistics could not be read"
  fi

  # The provider blocks an address after a hard bounce or a complaint. Only a
  # rise is news, and only a count that was actually read may become the next
  # run's baseline.
  local domains domain response blocked before
  if ! domains=$(tem "$base/domains?project_id=$EMAIL_PROJECT_ID" 2>/dev/null) ||
    ! domain=$(printf '%s' "$domains" | WANT="${EMAIL_FROM#*@}" python3 -c '
import json, os, sys
for d in json.load(sys.stdin).get("domains", []):
    if d.get("name") == os.environ["WANT"]:
        print(d["id"])
        break' 2>/dev/null) || [ -z "$domain" ]; then
    say week blocked "the provider's blocklist could not be read (no domain named ${EMAIL_FROM#*@})"
    return 0
  fi
  if response=$(tem "$base/blocklists?domain_id=$domain&page_size=1" 2>/dev/null) &&
    blocked=$(printf '%s' "$response" | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["total_count"]))' 2>/dev/null) &&
    is_count "$blocked"; then
    before=$(cat "$STATE_DIR/blocked" 2>/dev/null || true)
    if is_count "$before" && [ "$blocked" -gt "$before" ]; then
      say week blocked "the provider now blocks $blocked address(es), up from $before — a hard bounce or a complaint"
    else
      say record blocked "the provider blocks $blocked address(es)"
    fi
    write_state blocked "$blocked"
  else
    say week blocked "the provider's blocklist could not be read"
  fi
}

report() {
  local line
  if [ ${#act[@]} -gt 0 ]; then
    echo "ACT NOW"
    for line in "${act[@]}"; do echo "  - $line"; done
    echo
  fi
  if [ ${#week[@]} -gt 0 ]; then
    echo "THIS WEEK"
    for line in "${week[@]}"; do echo "  - $line"; done
    echo
  fi
  echo "RECORD"
  for line in "${record[@]}"; do echo "  - $line"; done
  echo
  echo "Checked $(date -u +%Y-%m-%dT%H:%M:%SZ) on $(hostname). What each line means and what to do: docs/operations.md"
}

# send <subject>: 0 sent, 1 failed, 2 there is nowhere to send it.
#
# Called from `||` and `case`, where bash switches `set -e` off for the whole
# function — so nothing in here relies on it: every step that can fail says
# what happens next itself. (The first version relied on it, and a mail the
# provider refused was recorded as sent.)
send() {
  local subject=$1 payload response
  if [ -z "$OPS_EMAIL" ]; then
    echo "OPS_EMAIL is not set: \"$subject\" reached this journal and nobody else"
    return 2
  fi
  if [ -z "$EMAIL_API_KEY" ] || [ -z "$EMAIL_PROJECT_ID" ] || [ -z "$EMAIL_FROM" ]; then
    echo "the mail provider is not configured in $ENV_FILE: \"$subject\" was not sent" >&2
    return 1
  fi
  payload=$(SUBJECT="$subject" BODY="$body" FROM="$EMAIL_FROM" FROM_NAME="$EMAIL_FROM_NAME" \
    PROJECT="$EMAIL_PROJECT_ID" TO="$OPS_EMAIL" python3 -c '
import json, os
sender = {"email": os.environ["FROM"]}
if os.environ["FROM_NAME"]:
    sender["name"] = os.environ["FROM_NAME"]
print(json.dumps({
    "project_id": os.environ["PROJECT"],
    "from": sender,
    "to": [{"email": os.environ["TO"]}],
    "subject": os.environ["SUBJECT"],
    "text": os.environ["BODY"],
}))') || {
    echo "the report could not be put into a message: \"$subject\" was not sent" >&2
    return 1
  }
  if ! response=$(printf '%s' "$payload" | tem -H 'Content-Type: application/json' \
    --data-binary @- "https://api.scaleway.com/transactional-email/v1alpha1/regions/$EMAIL_REGION/emails" 2>&1); then
    echo "the provider did not take \"$subject\": ${response:0:300}" >&2
    return 1
  fi
  echo "mailed: $subject"
  return 0
}

main() {
  load_env
  mkdir -p "$STATE_DIR" 2>/dev/null || echo "WARNING: $STATE_DIR could not be created" >&2

  local key
  while read -r key; do
    [ -z "$key" ] || was_seen[$key]=1
  done < <(cat "$STATE_DIR/seen" 2>/dev/null || true)

  check_disk
  if check_docker; then
    check_previews
    check_log
  fi
  check_site
  check_backup
  check_mail

  body=$(report)
  # The journal always gets the whole report, mailed or not.
  printf '%s\n' "$body"
  write_state seen "$(printf '%s\n' "${now_seen[@]}")"

  local now status=0 rc
  now=$(date +%s)

  # What was mailed as ACT NOW, and when, per condition. A condition is mailed
  # when it is new or was last mailed a day ago; a condition that has stopped
  # is mailed once as resolved. Recorded only when the mail actually went.
  declare -A mailed=()
  local k t
  while read -r k t; do
    [ -n "$k" ] && is_count "$t" && mailed[$k]=$t
  done < <(cat "$STATE_DIR/act" 2>/dev/null || true)

  local fresh=() gone=()
  for k in "${act_keys[@]}"; do
    if [ -z "${mailed[$k]:-}" ] || [ $((now - mailed[$k])) -ge 86400 ]; then
      fresh+=("$k")
    fi
  done
  for k in "${!mailed[@]}"; do
    [ -n "${act_line[$k]:-}" ] || gone+=("$k")
  done

  local changed=false subject
  if [ ${#fresh[@]} -gt 0 ]; then
    # Named after what is NEW, not whatever check happens to run first — a
    # backup that stops while the disk alert is standing must not arrive
    # looking like the disk alert again.
    subject="[$ENVIRONMENT] ACT NOW: ${act_line[${fresh[0]}]}"
    [ ${#fresh[@]} -eq 1 ] || subject="$subject (and $((${#fresh[@]} - 1)) more)"
    rc=0
    send "$subject" || rc=$?
    case $rc in
      0) for k in "${fresh[@]}"; do mailed[$k]=$now; done && changed=true ;;
      1) status=1 ;;
    esac
  fi
  if [ ${#gone[@]} -gt 0 ]; then
    rc=0
    send "[$ENVIRONMENT] resolved: ${gone[*]}" || rc=$?
    case $rc in
      0 | 2) for k in "${gone[@]}"; do unset "mailed[$k]"; done && changed=true ;;
      1) status=1 ;;
    esac
  fi
  if [ "$changed" = true ]; then
    local lines=""
    for k in "${!mailed[@]}"; do lines+="$k ${mailed[$k]}"$'\n'; done
    write_state act "${lines%$'\n'}"
  fi

  # Once a day whatever the state: the report that says "nothing to do" is what
  # makes an empty inbox mean something. Its absence by breakfast is itself the
  # signal — the instance, the timer or the mail path is broken.
  local today summary
  today=$(date -u +%F)
  if [ $((10#$(date -u +%H))) -ge $((10#$DIGEST_HOUR_UTC)) ] &&
    [ "$(cat "$STATE_DIR/digest-day" 2>/dev/null || true)" != "$today" ]; then
    if [ ${#act[@]} -gt 0 ]; then
      summary="${#act[@]} to act on"
    elif [ ${#week[@]} -gt 0 ]; then
      summary="${#week[@]} to look at this week"
    else
      summary="nothing to do"
    fi
    rc=0
    send "[$ENVIRONMENT] daily: $summary" || rc=$?
    case $rc in
      0) write_state digest-day "$today" ;;
      1) status=1 ;;
    esac
  fi

  return "$status"
}

main "$@"
exit $?
