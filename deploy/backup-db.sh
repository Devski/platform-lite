#!/usr/bin/env bash
# Runs ON the instance, once a day from platform-backup.timer, which
# remote-deploy.sh installs. Shipped as a file rather than buried in a workflow
# for the same reason as remote-deploy.sh: a copy nobody can make by hand is a
# copy nobody can make during an incident.
#
# #168: dev's PostgreSQL is a container started by cloud-init, its data in one
# Docker volume on this machine's disk, and nothing else copies it anywhere. The
# rows are not merely the data — they are the only map to the bucket, because an
# object's key is a content hash kept in the row that names it (G2). Lose the
# volume and every object stored under this environment's prefix becomes bytes
# with no path to them.
#
# What one run does: dumps every database that is not a test one, compresses the
# lot, checks each dump is whole, uploads it, READS IT BACK and compares byte for
# byte, then records the success where the next deployment can see it.
#
# Retention is the shape of the key rather than a rule someone maintains: seven
# weekday slots, each overwritten a week later. Nothing to list, nothing to
# delete, no second lifecycle rule to collide with the one the bootstrap wrote
# for staged uploads — and the number of copies cannot drift.
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/platform-lite/.env}
STATE_DIR=${STATE_DIR:-/var/lib/platform-backup}
PG_CONTAINER=${PG_CONTAINER:-postgres}

# The application's own credentials, read key by key and never evaluated: the
# file is not shell. One value in it contains a space, and `source` would try to
# run the second word as a command — quietly, because the failure looks like a
# warning.
#
# `|| [ -n "$line" ]`: a file whose last line has no newline would otherwise
# lose that line entirely — and the last line of this one is a value the copy
# cannot run without.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    S3_KEY=* | S3_SECRET=* | S3_BUCKET=* | S3_ENDPOINT=* | S3_REGION=* | S3_PREFIX=*)
      export "${line%%=*}=${line#*=}"
      ;;
  esac
done <"$ENV_FILE"

: "${S3_KEY:?$ENV_FILE carries no S3_KEY}"
: "${S3_SECRET:?$ENV_FILE carries no S3_SECRET}"
: "${S3_BUCKET:?$ENV_FILE carries no S3_BUCKET}"
: "${S3_ENDPOINT:?$ENV_FILE carries no S3_ENDPOINT}"
: "${S3_REGION:?$ENV_FILE carries no S3_REGION}"
# Empty in production, `devski/` here — and normalized, because everything below
# is built by concatenation: a prefix that lost its slash would put the copy
# under a neighbouring name rather than fail (the bug lib/storage.ts guards
# against for the application's own keys).
S3_PREFIX=$(printf '%s' "${S3_PREFIX-}" | tr -d '[:space:]')
case "$S3_PREFIX" in
  "" | */) ;;
  *) S3_PREFIX="$S3_PREFIX/" ;;
esac

# One copy at a time. A hand-run overlapping the nightly one would have each
# reading back the other's bytes and announcing that the copy is not
# trustworthy — an alarm about nothing, on the subject where a false alarm is
# most expensive.
exec 9>/var/tmp/platform-backup.lock
if ! flock -n 9; then
  echo "another copy is already running — leaving it to it"
  exit 0
fi

# mon..sun. The slot is the day the copy was MADE, so a restore knows how old it
# is without asking the bucket anything. LC_ALL=C because %a speaks the
# machine's language: a Polish locale would write `sob`, and the seven slots
# would quietly become fourteen the day someone sets one.
slot=$(LC_ALL=C date -u +%a | tr '[:upper:]' '[:lower:]')
# `backups/<environment>/`, and deliberately NOT under the environment's own
# prefix: everything that sweeps this bucket lists `<prefix>…` and deletes what
# no database row names — which is every copy here, by definition. The one
# sweeper already written down (preview-down.sh's closing note, #34) has exactly
# that shape. Out of the swept namespace is the only version of this that
# survives someone writing it without thinking of backups.
key="backups/${S3_PREFIX}pg/${slot}.sql.gz"
url="$S3_ENDPOINT/$S3_BUCKET/$key"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# /var/tmp, not /tmp: a dump must not depend on how much memory is free, and
# this file lives for the length of one run only. mktemp makes it 0700, and the
# unit adds PrivateTmp, so the dump is not readable by anything else on the host
# even for those seconds.
work=$(mktemp -d /var/tmp/platform-backup.XXXXXX)
trap 'rm -rf "$work"' EXIT
dump="$work/dump.sql.gz"

# The credentials go in a file inside that directory rather than on the command
# line: /proc/<pid>/cmdline is world-readable on this machine, so `--user
# key:secret` would show the secret to anyone with an account for as long as the
# upload runs. --upload-file leaves stdin free, but a config file is the form
# curl documents for exactly this.
umask 077
printf 'user = "%s:%s"\n' "$S3_KEY" "$S3_SECRET" >"$work/curlrc"
# --max-time as well as the unit's timeout: a transfer that stalls without
# closing has no bound of its own, and the retries exist because one transient
# 5xx would otherwise cost the whole day's copy — the next attempt is 24 hours
# away. No --output on a PUT: S3 answers an upload with an empty body, so
# nothing is printed unless it failed, and then the reason is what gets printed.
s3() { curl --config "$work/curlrc" --aws-sigv4 "aws:amz:$S3_REGION:s3" \
  --fail-with-body --silent --show-error \
  --connect-timeout 30 --max-time 600 --retry 2 --retry-delay 10 "$@"; }

psql() { docker exec "$PG_CONTAINER" psql --username postgres --no-align --tuples-only "$@"; }

# Everything in this cluster connects as the bootstrap superuser, which every
# PostgreSQL cluster is born with, so the copy carries no roles — and a dump of
# them would not restore anyway: `CREATE ROLE postgres` into a fresh cluster
# fails, and that is exactly how the first restore drill of this script failed
# on 12.09.2026 (the whole point of drilling it). The day that assumption stops
# holding, the run must say so — but it is checked at the END, after the copy
# exists. A copy missing its roles is two minutes of CREATE ROLE away from
# whole; no copy at all is the thing this file exists to prevent.
roles=$(psql --command "select rolname from pg_roles where rolname !~ '^pg_' and rolname <> 'postgres' order by 1")

# The test databases are excluded: a test run recreates them from nothing, and
# copying them would double the bytes for something nobody would ever restore.
# `template1` and `postgres` hold nothing of ours.
databases=$(psql --command "select datname from pg_database where datallowconn and datname like 'platform\_%' and datname not like '%\_test\_%' order by 1")
if [ -z "$databases" ]; then
  echo "no platform_* database to copy — is this the right cluster?" >&2
  exit 1
fi
# -f while these go unquoted: word splitting is wanted, pathname expansion is
# not, and a database named `platform_*` would otherwise expand against the
# working directory.
set -f
count=$(printf '%s\n' $databases | wc -l | tr -d '[:space:]')
echo "dumping $count database(s): $(printf '%s ' $databases)"

# --create so a restore builds the database it is restoring, and --clean
# --if-exists so it can be replayed over one that exists — into an empty cluster
# the drops are no-ops rather than errors, which is what lets the restore run
# with ON_ERROR_STOP and mean something.
for database in $databases; do
  docker exec "$PG_CONTAINER" pg_dump \
    --username postgres --create --clean --if-exists "$database"
done | gzip -9 >"$dump"
set +f

# A dump cut off by a full disk, a killed container or a closed pipe is still a
# valid gzip file of a plausible size. `gzip -t` answers whether the file is
# whole; pg_dump writes its last line only when it has finished, so counting
# those proves every database finished, not merely the last one. Separate
# commands on purpose: one `|| true` over both would report a failed
# decompression as a clean zero.
gzip -t "$dump"
complete=$(gzip -dc "$dump" | grep -c '^-- PostgreSQL database dump complete' || true)
if [ "$complete" != "$count" ]; then
  echo "only $complete of $count dumps ended the way a finished dump ends — not uploading" >&2
  exit 1
fi
bytes=$(stat -c %s "$dump")
echo "dump is $bytes bytes, $complete of $count complete"

# A dump can be whole and still be wrong. A botched migration, a mistaken DROP,
# a database restored half-empty: all of that produces a perfectly complete,
# perfectly verifiable little file, and uploading it would overwrite this
# weekday's good copy with the evidence of the accident. Seven days later the
# last copy predating it is gone too. So the run compares itself with the last
# one that succeeded and refuses to shrink by more than half; ALLOW_SHRINK=1 is
# for the day the shrinking is the intended change.
previous=$(awk '{print $3}' "$STATE_DIR/last-success" 2>/dev/null || true)
case "$previous" in
  '' | *[!0-9]*) previous=0 ;;
esac
if [ "$previous" -gt 0 ] && [ "$bytes" -lt $((previous / 2)) ] && [ -z "${ALLOW_SHRINK:-}" ]; then
  echo "this dump is $bytes bytes against $previous last time — less than half." >&2
  echo "refusing to overwrite a good copy with it; ALLOW_SHRINK=1 if that is the change" >&2
  exit 1
fi

# No x-amz-acl, so the object is private: OVHcloud implements no
# PutBucketPolicy, and a per-object ACL is the only thing that makes anything in
# this bucket publicly readable (src/lib/storage.ts). The dump's confidentiality
# is therefore exactly the secrecy of the S3 key — the same key that can already
# read every user file here. It carries e-mail addresses and password hashes;
# docs/backup-and-restore.md says what that means and what production must do
# differently.
echo "uploading $key"
s3 --upload-file "$dump" "$url"

# A copy nobody has read back is not a copy — it is a request that returned 200.
echo "reading it back"
s3 "$url" --output "$work/readback.gz"
if ! cmp -s "$dump" "$work/readback.gz"; then
  echo "what came back differs from what was sent — the copy is not trustworthy" >&2
  exit 1
fi

# Written last and only on success, so it can never name a copy that is not
# there: LATEST in the bucket for whoever is restoring, and a local file for the
# deployment, which warns when it goes stale (#168; #167 is where this stops
# depending on someone reading a deploy log).
record="$started $key $bytes bytes"
printf '%s\n' "$record" >"$work/LATEST"
s3 --upload-file "$work/LATEST" \
  "$S3_ENDPOINT/$S3_BUCKET/backups/${S3_PREFIX}pg/LATEST"

mkdir -p "$STATE_DIR" 2>/dev/null || true
printf '%s\n' "$record" >"$STATE_DIR/last-success" 2>/dev/null ||
  echo "note: could not write $STATE_DIR/last-success; the deployment's staleness warning will not see this run" >&2

echo "done: $record"

# Last, with the copy already in the bucket: the assumption this file is built
# on, checked out loud. systemd marks the run failed and `systemctl status`
# says why, while what exists is a copy of every table — missing only roles
# that did not exist when it was written.
if [ -n "$roles" ]; then
  echo "the copy is made, but this cluster now has roles it does not carry:" >&2
  set -f
  printf '  %s\n' $roles >&2
  set +f
  echo "see docs/backup-and-restore.md — the copy must grow to include them" >&2
  exit 1
fi
