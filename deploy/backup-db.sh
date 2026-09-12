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
# warning. Reading it this way also means no secret is ever an argument to a
# process, where `ps` would show it.
while IFS= read -r line; do
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
S3_PREFIX=${S3_PREFIX-}

# mon..sun. The slot is the day the copy was MADE, so a restore knows how old it
# is without asking the bucket anything.
slot=$(date -u +%a | tr '[:upper:]' '[:lower:]')
key="${S3_PREFIX}backups/pg/${slot}.sql.gz"
url="$S3_ENDPOINT/$S3_BUCKET/$key"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# /var/tmp, not /tmp: a dump must not depend on how much memory is free, and
# this file lives for the length of one run only.
work=$(mktemp -d /var/tmp/platform-backup.XXXXXX)
trap 'rm -rf "$work"' EXIT
dump="$work/dump.sql.gz"

psql() { docker exec "$PG_CONTAINER" psql --username postgres --no-align --tuples-only "$@"; }

# Everything in this cluster connects as the bootstrap superuser, which every
# PostgreSQL cluster is born with, so the copy carries no roles — and a dump of
# them would not restore anyway: `CREATE ROLE postgres` into a fresh cluster
# fails, and that is exactly how the first restore drill of this script failed
# on 12.09.2026 (the whole point of drilling it). Rather than leave that as an
# assumption someone breaks in a year, the copy refuses to be made the day it
# stops being true.
roles=$(psql --command "select rolname from pg_roles where rolname !~ '^pg_' and rolname <> 'postgres' order by 1")
if [ -n "$roles" ]; then
  echo "this cluster now has roles the copy does not carry:" >&2
  printf '  %s\n' $roles >&2
  echo "see docs/backup-and-restore.md — the copy must grow to include them" >&2
  exit 1
fi

# The test databases are excluded: a test run recreates them from nothing, and
# copying them would double the bytes for something nobody would ever restore.
# `template1` and `postgres` hold nothing of ours.
databases=$(psql --command "select datname from pg_database where datallowconn and datname like 'platform\_%' and datname not like '%\_test\_%' order by 1")
if [ -z "$databases" ]; then
  echo "no platform_* database to copy — is this the right cluster?" >&2
  exit 1
fi
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

# A dump cut off by a full disk, a killed container or a closed pipe is still a
# valid gzip file of a plausible size. pg_dump writes this line last and only
# when it has finished, so counting them proves every database finished, not
# merely the last one.
complete=$(gzip -dc "$dump" | grep -c '^-- PostgreSQL database dump complete' || true)
if [ "$complete" != "$count" ]; then
  echo "only $complete of $count dumps ended the way a finished dump ends — not uploading" >&2
  exit 1
fi
bytes=$(stat -c %s "$dump")
echo "dump is $bytes bytes, $complete of $count complete"

# No x-amz-acl, so the object is private: OVHcloud implements no
# PutBucketPolicy, and a per-object ACL is the only thing that makes anything in
# this bucket publicly readable (src/lib/storage.ts). The dump's confidentiality
# is therefore exactly the secrecy of the S3 key — the same key that can already
# read every user file here. It carries e-mail addresses and password hashes;
# docs/backup-and-restore.md says what that means and what production must do
# differently.
echo "uploading $key"
curl --fail-with-body --silent --show-error \
  --aws-sigv4 "aws:amz:$S3_REGION:s3" --user "$S3_KEY:$S3_SECRET" \
  --upload-file "$dump" "$url" --output /dev/null

# A copy nobody has read back is not a copy — it is a request that returned 200.
echo "reading it back"
curl --fail-with-body --silent --show-error \
  --aws-sigv4 "aws:amz:$S3_REGION:s3" --user "$S3_KEY:$S3_SECRET" \
  "$url" --output "$work/readback.gz"
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
curl --fail-with-body --silent --show-error \
  --aws-sigv4 "aws:amz:$S3_REGION:s3" --user "$S3_KEY:$S3_SECRET" \
  --upload-file "$work/LATEST" "$S3_ENDPOINT/$S3_BUCKET/${S3_PREFIX}backups/pg/LATEST" \
  --output /dev/null

mkdir -p "$STATE_DIR" 2>/dev/null || true
printf '%s\n' "$record" >"$STATE_DIR/last-success" 2>/dev/null ||
  echo "note: could not write $STATE_DIR/last-success; the deployment's staleness warning will not see this run" >&2

echo "done: $record"
