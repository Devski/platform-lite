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
#              and once more when it stops
#   THIS WEEK  in the daily report
#   RECORD     in the daily report, so a number has a history
#
# What it never sends: an address, a handle, a name, or a line of any log.
# The report goes to a mailbox that may well sit outside the EU (§7), so it
# carries counts and the instance's own figures, nothing about anybody.
#
# What it cannot do: report this instance's death. That is
# .github/workflows/watch.yml, from outside.
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/platform-lite/.env}
STATE_DIR=${STATE_DIR:-/var/lib/platform-ops}
BACKUP_RECORD=${BACKUP_RECORD:-/var/lib/platform-backup/last-success}
# 05 UTC is 07:00 in Warsaw in summer and 06:00 in winter: before the day
# starts, and after the nightly copy (03:17) has had its chance.
DIGEST_HOUR_UTC=${DIGEST_HOUR_UTC:-05}

# Only the variables this script uses. The .env also holds the database
# password, the signing key and the bucket credentials, none of which a
# report has any business carrying into its own environment.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    EMAIL_API_KEY=* | EMAIL_PROJECT_ID=* | EMAIL_REGION=* | EMAIL_FROM=* | \
      EMAIL_FROM_NAME=* | OPS_EMAIL=* | SITE_ADDRESS=* | APP_ENV=*)
      export "${line%%=*}=${line#*=}"
      ;;
  esac
done <"$ENV_FILE"

ENVIRONMENT=${APP_ENV:-unknown}
EMAIL_REGION=${EMAIL_REGION:-fr-par}
mkdir -p "$STATE_DIR"

act_keys=()
act=()
week=()
record=()
# say <tier> <key> <line>. The key names the CONDITION, not the numbers in the
# line: "disk" stays "disk" from 91% to 92%, so a disk that keeps filling is
# one alert, not one an hour.
say() {
  local tier=$1 key=$2
  shift 2
  case "$tier" in
    act) act_keys+=("$key") && act+=("$*") ;;
    week) week+=("$*") ;;
    *) record+=("$*") ;;
  esac
}

# --- the disk --------------------------------------------------------------
# The instance's one disk holds the images, the database, the journal and
# every preview. Full, it stops PostgreSQL writing — dev down, and every
# preview with it.
used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
free=$(df -h --output=avail / | tail -1 | tr -d ' ')
if [ "$used" -ge 90 ]; then
  say act disk "disk at ${used}%, ${free} free — when it fills, PostgreSQL stops writing and previews stop starting (#119)"
elif [ "$used" -ge 80 ]; then
  say week disk "disk at ${used}%, ${free} free (#119)"
else
  say record disk "disk at ${used}%, ${free} free"
fi
images=$(docker images --format '{{.Repository}}' | awk '/platform-lite/ {n++} END {print n+0}')
say record images "$images application images kept on the instance (#119)"

# --- the containers --------------------------------------------------------
# `running/starting` is a deploy in progress, not an outage: the check runs on
# the hour and a deploy can land on it.
for name in platform-lite-app-1 platform-lite-caddy-1 postgres; do
  state=$(docker inspect --format '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null || echo missing)
  case "$state" in
    running | running/healthy | running/starting) say record "container-$name" "$name: $state" ;;
    *) say act "container-$name" "$name is $state" ;;
  esac
done

# --- the site, from here ---------------------------------------------------
# Through the proxy, as a visitor reaches it — but resolved to this machine,
# so the answer does not depend on the network hairpinning back in. Whether
# the site answers from OUTSIDE is watch.yml's question.
if [ -n "${SITE_ADDRESS:-}" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    --resolve "$SITE_ADDRESS:443:127.0.0.1" "https://$SITE_ADDRESS/" || true)
  case "$code" in
    [1-4][0-9][0-9]) say record site "https://$SITE_ADDRESS/ answers $code" ;;
    *) say act site "https://$SITE_ADDRESS/ answers ${code:-nothing} from the instance itself" ;;
  esac
fi

# --- the nightly copy of the databases (#168) ------------------------------
if [ ! -f "$BACKUP_RECORD" ]; then
  say act backup "no copy of the databases has ever succeeded on this instance (#168)"
else
  age_h=$((($(date +%s) - $(stat -c %Y "$BACKUP_RECORD")) / 3600))
  # 36 hours: a night can be late (the timer has five minutes of jitter and
  # catches up after a reboot), but two nights missed is a copy that stopped.
  if [ "$age_h" -gt 36 ]; then
    say act backup "the newest copy of the databases is ${age_h} h old — the nightly copy has stopped (#168): $(cat "$BACKUP_RECORD")"
  else
    say record backup "databases copied ${age_h} h ago: $(cat "$BACKUP_RECORD")"
  fi
fi

# --- preview copies nobody owns (#113) -------------------------------------
orphans=0
copies=0
for db in $(docker exec postgres psql -U postgres -At -d postgres \
  -c "select datname from pg_database where datname like 'platform\_pr\_%'" 2>/dev/null || true); do
  copies=$((copies + 1))
  [ -n "$(docker ps -a --filter "name=^pr-${db#platform_pr_}$" --format '{{.Names}}')" ] ||
    orphans=$((orphans + 1))
done
if [ "$orphans" -gt 0 ]; then
  say week previews "$orphans preview database(s) with no container — copies of dev's accounts; the next preview sweeps them, or docs/dev-environment.md"
else
  say record previews "$copies preview database(s), each with its container"
fi

# --- what the application said in the last day ------------------------------
# Read from the journal by container NAME, which compose keeps across a
# deploy — `docker logs` would only see the container started by the last one.
app_log() {
  journalctl --quiet --no-pager --output=cat \
    CONTAINER_NAME=platform-lite-app-1 --since "24 hours ago" 2>/dev/null || true
}
log=$(app_log)
unrecorded=$(printf '%s\n' "$log" |
  sed -n 's/^\[r360\] collector: \([0-9][0-9]*\) frame set(s) no record names.*/\1/p' | tail -1)
if [ -n "$unrecorded" ] && [ "$unrecorded" -gt 0 ]; then
  say week collector "the R360 collector found $unrecorded frame set(s) that no record names and left them alone — a person decides (#156); the list: journalctl CONTAINER_NAME=platform-lite-app-1 | grep collector"
fi
collector_failed=$(printf '%s\n' "$log" | awk '/^\[r360\] collector: the (run|report) failed/ {n++} END {print n+0}')
[ "$collector_failed" -eq 0 ] || say week collector-failed "the R360 collector failed $collector_failed time(s)"
# Counts by kind, never the lines: a log line can carry an address or a path
# with a handle in it, and this report leaves the instance.
stalls=$(printf '%s\n' "$log" | awk '/^\[db\]/ {n++} END {print n+0}')
[ "$stalls" -eq 0 ] || say week db "$stalls database deadline(s) hit (#172) — which ones: journalctl CONTAINER_NAME=platform-lite-app-1 | grep '\[db\]'"
errors=$(printf '%s\n' "$log" | LC_ALL=C.UTF-8 awk '/⨯|Uncaught|Unhandled/ {n++} END {print n+0}')
if [ "$errors" -gt 0 ]; then
  say week errors "$errors unhandled server error(s) — journalctl CONTAINER_NAME=platform-lite-app-1 --since '24 hours ago'"
else
  say record errors "no unhandled server errors"
fi

# --- mail: what the provider did with ours (#22, #23) -----------------------
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT
chmod 600 "$headers"
tem() {
  curl -sS --fail-with-body --max-time 30 -H @"$headers" "$@"
}
tem_base="https://api.scaleway.com/transactional-email/v1alpha1/regions/$EMAIL_REGION"
if [ -n "${EMAIL_API_KEY:-}" ] && [ -n "${EMAIL_PROJECT_ID:-}" ]; then
  # Through a file, not argv: /proc/<pid>/cmdline is world-readable here.
  printf 'X-Auth-Token: %s\n' "$EMAIL_API_KEY" >"$headers"
  since=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)
  if stats=$(tem "$tem_base/statistics?project_id=$EMAIL_PROJECT_ID&since=$since"); then
    read -r sent failed <<<"$(printf '%s' "$stats" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("total_count",0), d.get("failed_count",0))' || true)"
    sent=${sent:-0}
    failed=${failed:-0}
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
  # The provider blocks an address after a hard bounce or a complaint. Only the
  # count is read, and only a rise is news.
  domain=$(tem "$tem_base/domains?project_id=$EMAIL_PROJECT_ID" 2>/dev/null |
    python3 -c 'import json,sys; ds=json.load(sys.stdin).get("domains",[]); print(ds[0]["id"] if ds else "")' 2>/dev/null || true)
  if [ -n "$domain" ]; then
    blocked=$(tem "$tem_base/blocklists?domain_id=$domain&page_size=1" 2>/dev/null |
      python3 -c 'import json,sys; print(json.load(sys.stdin).get("total_count",0))' 2>/dev/null || echo "")
    before=$(cat "$STATE_DIR/blocked" 2>/dev/null || echo "")
    if [ -n "$blocked" ]; then
      if [ -n "$before" ] && [ "$blocked" -gt "$before" ]; then
        say week blocked "the provider now blocks $blocked address(es), up from $before — a hard bounce or a complaint"
      else
        say record blocked "the provider blocks $blocked address(es)"
      fi
      printf '%s\n' "$blocked" >"$STATE_DIR/blocked"
    fi
  fi
fi

# --- the report --------------------------------------------------------------
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
body=$(report)
# The journal always gets the whole report, mailed or not.
printf '%s\n' "$body"

send() {
  local subject=$1
  if [ -z "${OPS_EMAIL:-}" ]; then
    echo "OPS_EMAIL is not set: \"$subject\" reached this journal and nobody else"
    return 0
  fi
  if [ -z "${EMAIL_API_KEY:-}" ] || [ -z "${EMAIL_PROJECT_ID:-}" ] || [ -z "${EMAIL_FROM:-}" ]; then
    echo "the mail provider is not configured in $ENV_FILE: \"$subject\" was not sent" >&2
    return 1
  fi
  local payload
  payload=$(SUBJECT="$subject" BODY="$body" python3 -c '
import json, os
sender = {"email": os.environ["EMAIL_FROM"]}
if os.environ.get("EMAIL_FROM_NAME"):
    sender["name"] = os.environ["EMAIL_FROM_NAME"]
print(json.dumps({
    "project_id": os.environ["EMAIL_PROJECT_ID"],
    "from": sender,
    "to": [{"email": os.environ["OPS_EMAIL"]}],
    "subject": os.environ["SUBJECT"],
    "text": os.environ["BODY"],
}))')
  tem -H 'Content-Type: application/json' --data-binary "$payload" "$tem_base/emails" >/dev/null
  echo "mailed: $subject"
}

# What was last mailed as ACT NOW, as condition keys — so an alert goes out
# when the SET of problems changes, not when a number inside one does.
now_keys=$(printf '%s\n' "${act_keys[@]}" | sort -u | tr '\n' ' ')
now_keys=${now_keys% }
last_keys=$(sed -n 1p "$STATE_DIR/act" 2>/dev/null || true)
last_sent=$(sed -n 2p "$STATE_DIR/act" 2>/dev/null || echo 0)
now=$(date +%s)
status=0

if [ -n "$now_keys" ]; then
  if [ "$now_keys" != "$last_keys" ] || [ $((now - last_sent)) -ge 86400 ]; then
    if send "[$ENVIRONMENT] ACT NOW: ${act[0]}"; then
      printf '%s\n%s\n' "$now_keys" "$now" >"$STATE_DIR/act"
    else
      status=1
    fi
  fi
elif [ -n "$last_keys" ]; then
  if send "[$ENVIRONMENT] resolved: $last_keys"; then
    rm -f "$STATE_DIR/act"
  else
    status=1
  fi
fi

# Once a day whatever the state: the report that says "nothing to do" is what
# makes an empty inbox mean something. Its absence by breakfast is itself the
# signal — the instance, the timer or the mail path is broken.
today=$(date -u +%F)
if [ "$(date -u +%H)" = "$DIGEST_HOUR_UTC" ] && [ "$(cat "$STATE_DIR/digest-day" 2>/dev/null || true)" != "$today" ]; then
  if [ ${#act[@]} -gt 0 ]; then
    summary="${#act[@]} to act on"
  elif [ ${#week[@]} -gt 0 ]; then
    summary="${#week[@]} to look at this week"
  else
    summary="nothing to do"
  fi
  if send "[$ENVIRONMENT] daily: $summary"; then
    printf '%s\n' "$today" >"$STATE_DIR/digest-day"
  else
    status=1
  fi
fi

exit "$status"
