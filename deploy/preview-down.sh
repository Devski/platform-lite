#!/usr/bin/env bash
# Runs ON the instance. Removes the preview of one pull request (#31): the
# container, its route, and nothing else. Safe to run twice, and safe to run
# for a preview that was never started — closing a pull request whose preview
# failed to come up must still leave the instance clean.
#
# Expects in the environment: PR (the number).
set -euo pipefail

: "${PR:?PR must be the pull request number}"

case "$PR" in
  '' | *[!0-9]*) echo "STOP: PR must be digits, got: $PR" >&2; exit 1 ;;
esac

NAME="pr-$PR"
ROUTE="/opt/platform-lite/previews/$NAME.caddy"

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

# What is deliberately NOT removed: objects under the `pr-<n>/` prefix in the
# bucket. Deleting them needs the S3 credentials, which this script has no
# reason to hold, and they cost fractions of a cent — the bucket's lifecycle
# rule already expires staged uploads. Sweeping preview prefixes belongs with
# the account-deletion work, which needs the same object-removal path.

echo "remaining previews:"
docker ps --filter 'name=^pr-[0-9]+$' --format '  {{.Names}}  {{.Status}}' || true
