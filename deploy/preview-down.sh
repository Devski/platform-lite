#!/usr/bin/env bash
# Runs ON the instance. Removes the preview of one pull request (#31): the
# container, its route, its database, and nothing else. Safe to run twice, and
# safe to run for a preview that was never started — closing a pull request
# whose preview failed to come up must still leave the instance clean.
#
# Expects in the environment: PR (the number).
set -euo pipefail

: "${PR:?PR must be the pull request number}"

case "$PR" in
  '' | *[!0-9]*) echo "STOP: PR must be digits, got: $PR" >&2; exit 1 ;;
esac

NAME="pr-$PR"
ROUTE="/opt/platform-lite/previews/$NAME.caddy"
CLONE="platform_pr_$PR"

if docker rm --force "$NAME" >/dev/null 2>&1; then
  echo "container $NAME removed"
else
  echo "container $NAME was not running"
fi

if [ -f "$ROUTE" ]; then
  rm -f "$ROUTE"
  # Reload only when something changed. Reloading is cheap but not free: it
  # re-evaluates every site, and dev's certificate is in there too.
  docker exec platform-lite-caddy-1 caddy reload --config /etc/caddy/Caddyfile
  echo "route removed and the proxy reloaded"
else
  echo "no route file to remove"
fi

# The preview's own copy of dev (#113). After the container, so nothing is
# still connected — and WITH (FORCE) for the case where something is anyway
# (a one-off `docker run`, a psql session left open). A copy left behind is
# not free: it is dev's data again on a disk that has already filled once
# (#119), and the next preview of this pull request would drop it unread.
#
# Not fatal if it fails: the container and the route are already gone, and
# closing a pull request must not end in a red job over a database nobody is
# using. It says so loudly instead.
if docker exec -i postgres psql -U postgres -v ON_ERROR_STOP=1 -q -d postgres \
  -c "drop database if exists \"$CLONE\" with (force)" >/dev/null 2>&1; then
  echo "database $CLONE dropped"
else
  echo "WARNING: database $CLONE could not be dropped — drop it by hand:" >&2
  echo "  docker exec postgres psql -U postgres -c 'drop database if exists \"$CLONE\" with (force)'" >&2
fi

# What is deliberately NOT removed: objects under the `pr-<n>/` prefix in the
# bucket. Deleting them needs the S3 credentials, which this script has no
# reason to hold, and they cost fractions of a cent — the bucket's lifecycle
# rule already expires staged uploads. Sweeping preview prefixes belongs with
# the account-deletion work, which needs the same object-removal path. Since
# #113 the rows naming those objects go with the database, so what is left is
# unreferenced by anything.

echo "remaining previews:"
docker ps --filter 'name=^pr-[0-9]+$' --format '  {{.Names}}  {{.Status}}' || true

echo "remaining preview databases:"
docker exec -i postgres psql -U postgres -At -d postgres \
  -c "select datname from pg_database where datname like 'platform\_pr\_%' order by datname" ||
  echo "  (could not ask PostgreSQL)"
