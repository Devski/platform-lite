#!/usr/bin/env bash
# Bootstrap of the platform-lite dev infrastructure on OVH Public Cloud (region waw).
# Manual prerequisites and the full procedure: docs/dev-environment.md.
# Requires: openstack CLI with an OpenRC file sourced, AWS CLI with S3 credentials
# in the environment, an SSH public key.
set -euo pipefail

GITHUB_HANDLE="${GITHUB_HANDLE:?Set GITHUB_HANDLE (your GitHub handle, e.g. devski)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD (e.g. openssl rand -hex 32)}"
# The value is rendered into the cloud-init template with sed — enforce a sed-safe charset.
[[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9]+$ ]] ||
  { echo "POSTGRES_PASSWORD must be alphanumeric (e.g. openssl rand -hex 32)"; exit 1; }
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}"
INSTANCE_NAME="${INSTANCE_NAME:-platform-dev}"
FLAVOR="${FLAVOR:-d2-2}"                                        # SPEC.md §8
IMAGE_NAME="${IMAGE_NAME:-Ubuntu 24.04}"
BUCKET="${BUCKET:-platform-dev}"                                # SPEC.md §4
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.waw.io.cloud.ovh.net}"
EXPECTED_REGION="${EXPECTED_REGION:-WAW1}"                      # SPEC.md §8: dev lives in waw
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-waw}"
# Key prefix scoping this environment inside the shared bucket (SPEC.md §4:
# `devski/` per developer, `pr-7/` per preview, empty in production).
S3_PREFIX="${S3_PREFIX:-$(printf '%s' "$GITHUB_HANDLE" | tr '[:upper:]' '[:lower:]')/}"
LIFECYCLE_RULE_ID="expire-staged-uploads"

# Per-developer database suffix: lowercase, "-" -> "_" (SPEC.md §4).
DB_SUFFIX="$(printf '%s' "$GITHUB_HANDLE" | tr '[:upper:]-' '[:lower:]_')"

command -v openstack >/dev/null || { echo "openstack CLI missing (pip install python-openstackclient)"; exit 1; }
command -v aws >/dev/null || { echo "aws CLI missing"; exit 1; }
: "${OS_AUTH_URL:?Source your OpenRC file first (docs/dev-environment.md, part 1)}"
: "${AWS_ACCESS_KEY_ID:?Export the S3 access key (docs/dev-environment.md, part 1)}"
# The S3 endpoint above is pinned to waw — a mismatched OpenStack region would split
# the infrastructure across regions without any error.
[ "${OS_REGION_NAME:-}" = "$EXPECTED_REGION" ] ||
  { echo "OS_REGION_NAME='${OS_REGION_NAME:-<unset>}' but the dev region is $EXPECTED_REGION (SPEC.md §8); export EXPECTED_REGION to override deliberately"; exit 1; }
[ -f "$SSH_PUBLIC_KEY_FILE" ] || { echo "SSH public key not found: $SSH_PUBLIC_KEY_FILE (override with SSH_PUBLIC_KEY_FILE)"; exit 1; }

echo "==> Preflight: flavor and image in region ${OS_REGION_NAME:-<unset>}"
openstack flavor show "$FLAVOR" >/dev/null
IMAGE_ID="$(openstack image list --name "$IMAGE_NAME" -f value -c ID | head -1)"
[ -n "$IMAGE_ID" ] || { echo "Image '$IMAGE_NAME' not found — check: openstack image list"; exit 1; }

echo "==> SSH keypair 'platform-dev' (reused if present)"
openstack keypair show platform-dev >/dev/null 2>&1 ||
  openstack keypair create --public-key "$SSH_PUBLIC_KEY_FILE" platform-dev >/dev/null

# The instance's inbound protection is ufw, configured by cloud-init: sshd is
# the only service listening publicly, and the database is published on
# 127.0.0.1 so it never reaches the network at all. A security group adds a
# second, network-level layer on top of that.
#
# It is OPTIONAL because a Public Cloud project can carry a security_groups
# quota of 0 — this one did on 04.09.2026, against OVH's documented default of
# 100 — and raising it is a manually processed support ticket. Rather than
# block the bootstrap on that ticket, boot without the group and let ufw stand
# alone; re-run once the quota clears to add the layer back.
SG_NAME=platform-dev-ssh
# Succeeds only when the group exists AND carries the port 22 rule: a group
# without it would silently lock SSH out of the instance we are creating.
ensure_ssh_group() {
  openstack security group show "$SG_NAME" >/dev/null 2>&1 ||
    openstack security group create --description "platform-lite dev: SSH only" "$SG_NAME" >/dev/null 2>&1 ||
    return 1
  openstack security group rule list "$SG_NAME" 2>/dev/null | grep -qE '[^0-9]22[^0-9]' && return 0
  openstack security group rule create --proto tcp --dst-port 22 "$SG_NAME" >/dev/null 2>&1
}

echo "==> Security group '$SG_NAME': inbound TCP 22 only (optional, reused if present)"
SECURITY_GROUP_ARGS=()
if ensure_ssh_group; then
  SECURITY_GROUP_ARGS=(--security-group "$SG_NAME")
  echo "    in place"
else
  echo "    SKIPPED — this project cannot create one (security_groups quota is 0)."
  echo "    The instance boots into 'default' and ufw on the host is the only layer"
  echo "    denying inbound traffic. Raise the quota (Control Panel -> Quota & Regions,"
  echo "    'Increase your quota!') and re-run this script to add the group."
fi

echo "==> Rendering cloud-init (password never touches the repo)"
TMP_USERDATA="$(mktemp)"
LIFECYCLE_JSON=""
trap 'rm -f "$TMP_USERDATA" ${LIFECYCLE_JSON:+"$LIFECYCLE_JSON"}' EXIT
sed -e "s|@POSTGRES_PASSWORD@|$POSTGRES_PASSWORD|" -e "s|@DB_SUFFIX@|$DB_SUFFIX|" \
  "$(dirname "$0")/cloud-init.yaml.tmpl" >"$TMP_USERDATA"

# OpenStack does not enforce unique instance names: a plain re-run of this
# script would happily boot a SECOND platform-dev and start a second bill.
# Every other step here is re-runnable, so this one has to be too.
echo "==> Instance $INSTANCE_NAME ($FLAVOR)"
if openstack server show "$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "    already exists — reusing it (no second instance, no second bill)"
else
  echo "    creating — THIS STEP STARTS THE ~7 EUR/MONTH BILLING"
  openstack server create \
    --flavor "$FLAVOR" \
    --image "$IMAGE_ID" \
    --key-name platform-dev \
    --network Ext-Net \
    ${SECURITY_GROUP_ARGS[@]+"${SECURITY_GROUP_ARGS[@]}"} \
    --user-data "$TMP_USERDATA" \
    --wait \
    "$INSTANCE_NAME" >/dev/null
fi

IP="$(openstack server show "$INSTANCE_NAME" -f value -c addresses | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)"
[ -n "$IP" ] || { echo "Could not read the instance IP — check: openstack server show $INSTANCE_NAME"; exit 1; }

echo "==> Bucket $BUCKET at $S3_ENDPOINT (SPEC.md §4)"
if ! aws --endpoint-url "$S3_ENDPOINT" s3api create-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  if aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$BUCKET" >/dev/null 2>&1; then
    echo "    bucket already exists and is accessible — reusing"
  else
    echo "    FAILED — if the name is taken region-wide, pick another (BUCKET=...) and update SPEC.md §4"
    exit 1
  fi
fi

# The avatar flow (#12) has the browser PUT to <prefix>staging/... and the server
# delete that object once it has verified the bytes and published them. An upload
# the user abandons — tab closed between the PUT and the confirm — leaves an object
# with no `files` row, invisible to the A9 quota. This rule sweeps those.
#
# It is a BACKSTOP, not the defence: S3 expiration is expressed in whole days
# (minimum 1) while the presign TTL is 120 s, so the earliest sweep is up to a day
# late — long enough to park a lot of unaccounted bytes. Issue #30 makes the
# application account for staged bytes and sweep them in minutes; this rule then
# only catches what the application can never reach (a crash between the client's
# PUT and the row write). The day granularity is also why it can never race a live
# upload. Verified against OVHcloud docs on 04.09.2026: lifecycle is supported on
# the `.io` endpoints only — which is what SPEC §2 pins.
#
# A lifecycle filter is a LITERAL prefix, no wildcards, so `staging/` alone would
# not match `devski/staging/`: the rule is written per environment prefix.
if [ -n "${SKIP_LIFECYCLE:-}" ]; then
  echo "==> Lifecycle rule skipped (SKIP_LIFECYCLE set) — staged residue is on you"
else
  echo "==> Lifecycle rule '$LIFECYCLE_RULE_ID' on ${S3_PREFIX}staging/ (expire after 1 day)"
  # put-bucket-lifecycle-configuration REPLACES the whole configuration, so refuse
  # to run over rules this script did not write (a PR-preview prefix, say).
  UNKNOWN_RULES="$(aws --endpoint-url "$S3_ENDPOINT" s3api get-bucket-lifecycle-configuration \
    --bucket "$BUCKET" 2>/dev/null |
    grep -oE '"ID"[[:space:]]*:[[:space:]]*"[^"]*"' |
    sed -E 's/.*"([^"]*)"$/\1/' |
    grep -vx "$LIFECYCLE_RULE_ID" || true)"
  if [ -n "$UNKNOWN_RULES" ]; then
    echo "    Bucket already carries lifecycle rules this script did not write:"
    printf '      %s\n' $UNKNOWN_RULES
    echo "    Writing ours would delete them. Merge by hand, or re-run with SKIP_LIFECYCLE=1."
    exit 1
  fi
  LIFECYCLE_JSON="$(mktemp)"
  cat >"$LIFECYCLE_JSON" <<JSON
{
  "Rules": [
    {
      "ID": "$LIFECYCLE_RULE_ID",
      "Status": "Enabled",
      "Filter": { "Prefix": "${S3_PREFIX}staging/" },
      "Expiration": { "Days": 1 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
JSON
  # Nothing in the application starts a multipart upload, but a stray one from a
  # manual `aws s3 cp` of a large file would linger just as invisibly.
  # Git Bash hands native Windows programs a converted path for arguments that
  # look like paths — but not for one hidden inside a file:// URL, where aws
  # then fails to open /tmp/tmp.XXXX. cygpath -m yields C:/... with forward
  # slashes, which is both a valid Windows path and a valid URL; on Linux
  # cygpath does not exist and the path is already correct.
  LIFECYCLE_PARAM="$LIFECYCLE_JSON"
  if command -v cygpath >/dev/null 2>&1; then
    LIFECYCLE_PARAM="$(cygpath -m "$LIFECYCLE_JSON")"
  fi
  aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET" --lifecycle-configuration "file://$LIFECYCLE_PARAM"
fi

# CORS on the bucket. The avatar flow has the BROWSER PUT straight to a
# presigned URL (G4), which is a cross-origin request: without this the
# preflight is refused with 403 and the upload never leaves the page, while
# every server-side call keeps working — so it stays invisible until a real
# browser tries. Found exactly that way on 05.09.2026.
#
# The signature, not the origin, is what authorizes the write: an allowed
# origin without a valid presigned URL still gets nothing. That is why the
# dev bucket can accept any origin — developer machines, PR previews and
# phones on the LAN all differ, and CORS is not the access control here.
# Production (#24) should still narrow this to its own domain.
#
# GET with a Range header, and Content-Range exposed, is for R360 (#101,
# A13): the owner's browser reads single frames out of an archive that
# already reached the bucket, through a presigned GET, without downloading
# the whole of it. Range is not a header the browser sends unasked, so it
# has to be allowed for the preflight, and Content-Range has to be exposed
# or the script never learns the archive's size.
echo "==> CORS on $BUCKET: browser PUT to presigned URLs (G4), ranged GET (A13)"
CORS_JSON="$(mktemp)"
cat >"$CORS_JSON" <<JSON
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type", "cache-control", "content-length", "range"],
      "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length", "ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
CORS_PARAM="$CORS_JSON"
if command -v cygpath >/dev/null 2>&1; then
  CORS_PARAM="$(cygpath -m "$CORS_JSON")"
fi
aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-cors \
  --bucket "$BUCKET" --cors-configuration "file://$CORS_PARAM"
rm -f "$CORS_JSON"
cat <<EOF

Done. Fill these into your .env (cp .env.example .env first if needed):

  DEV_SSH_HOST=ubuntu@$IP
  DATABASE_URL=postgresql://postgres:\$POSTGRES_PASSWORD@localhost:5433/platform_$DB_SUFFIX
  DATABASE_URL_TEST=postgresql://postgres:\$POSTGRES_PASSWORD@localhost:5433/platform_test_$DB_SUFFIX
  S3_ENDPOINT=$S3_ENDPOINT
  S3_REGION=waw
  S3_BUCKET=$BUCKET
  S3_PREFIX=$S3_PREFIX
  S3_KEY=<the S3 access key you exported>
  S3_SECRET=<the S3 secret key you exported>

(\$POSTGRES_PASSWORD and the two S3 keys = the values you exported; none of the
three is echoed here, so nothing secret lands in your terminal scrollback.)

cloud-init keeps working ~2-3 minutes after boot. Then verify per
docs/dev-environment.md part 3 (tunnel, database list, bucket listing).
EOF
