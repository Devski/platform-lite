#!/usr/bin/env bash
# Bootstrap of the platform-lite dev infrastructure on OVH Public Cloud (region waw).
# Manual prerequisites and the full procedure: docs/dev-environment.md.
# Requires: openstack CLI with an OpenRC file sourced, AWS CLI with S3 credentials
# in the environment, an SSH public key.
set -euo pipefail

GITHUB_HANDLE="${GITHUB_HANDLE:?Set GITHUB_HANDLE (your GitHub handle, e.g. devski)}"
# Hex/alphanumeric only — the value is injected into the cloud-init template with sed.
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD (e.g. openssl rand -hex 32)}"
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}"
INSTANCE_NAME="${INSTANCE_NAME:-platform-dev}"
FLAVOR="${FLAVOR:-d2-2}"                                        # SPEC.md §8
IMAGE_NAME="${IMAGE_NAME:-Ubuntu 24.04}"
BUCKET="${BUCKET:-platform-dev}"                                # SPEC.md §4
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.waw.io.cloud.ovh.net}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-waw}"

# Per-developer database suffix: lowercase, "-" -> "_" (SPEC.md §4).
DB_SUFFIX="$(printf '%s' "$GITHUB_HANDLE" | tr '[:upper:]-' '[:lower:]_')"

command -v openstack >/dev/null || { echo "openstack CLI missing (pip install python-openstackclient)"; exit 1; }
command -v aws >/dev/null || { echo "aws CLI missing"; exit 1; }
: "${OS_AUTH_URL:?Source your OpenRC file first (docs/dev-environment.md, part 1)}"
: "${AWS_ACCESS_KEY_ID:?Export the S3 access key (docs/dev-environment.md, part 1)}"
[ -f "$SSH_PUBLIC_KEY_FILE" ] || { echo "SSH public key not found: $SSH_PUBLIC_KEY_FILE (override with SSH_PUBLIC_KEY_FILE)"; exit 1; }

echo "==> Preflight: flavor and image in region ${OS_REGION_NAME:-<unset>}"
openstack flavor show "$FLAVOR" >/dev/null
IMAGE_ID="$(openstack image list --name "$IMAGE_NAME" -f value -c ID | head -1)"
[ -n "$IMAGE_ID" ] || { echo "Image '$IMAGE_NAME' not found — check: openstack image list"; exit 1; }

echo "==> SSH keypair 'platform-dev' (reused if present)"
openstack keypair show platform-dev >/dev/null 2>&1 ||
  openstack keypair create --public-key "$SSH_PUBLIC_KEY_FILE" platform-dev >/dev/null

echo "==> Security group 'platform-dev-ssh': inbound TCP 22 only (reused if present)"
if ! openstack security group show platform-dev-ssh >/dev/null 2>&1; then
  openstack security group create --description "platform-lite dev: SSH only" platform-dev-ssh >/dev/null
  openstack security group rule create --proto tcp --dst-port 22 platform-dev-ssh >/dev/null
fi

echo "==> Rendering cloud-init (password never touches the repo)"
TMP_USERDATA="$(mktemp)"
trap 'rm -f "$TMP_USERDATA"' EXIT
sed -e "s|@POSTGRES_PASSWORD@|$POSTGRES_PASSWORD|" -e "s|@DB_SUFFIX@|$DB_SUFFIX|" \
  "$(dirname "$0")/cloud-init.yaml.tmpl" >"$TMP_USERDATA"

echo "==> Creating instance $INSTANCE_NAME ($FLAVOR) — THIS STEP STARTS THE ~7 EUR/MONTH BILLING"
openstack server create \
  --flavor "$FLAVOR" \
  --image "$IMAGE_ID" \
  --key-name platform-dev \
  --network Ext-Net \
  --security-group platform-dev-ssh \
  --user-data "$TMP_USERDATA" \
  --wait \
  "$INSTANCE_NAME" >/dev/null

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

cat <<EOF

Done. Fill these into your .env (cp .env.example .env first if needed):

  DEV_SSH_HOST=ubuntu@$IP
  DATABASE_URL=postgresql://postgres:\$POSTGRES_PASSWORD@localhost:5433/platform_$DB_SUFFIX
  DATABASE_URL_TEST=postgresql://postgres:\$POSTGRES_PASSWORD@localhost:5433/platform_test_$DB_SUFFIX
  S3_ENDPOINT=$S3_ENDPOINT
  S3_REGION=waw
  S3_BUCKET=$BUCKET

(\$POSTGRES_PASSWORD = the value you exported; it is not echoed here.)

cloud-init keeps working ~2-3 minutes after boot. Then verify per
docs/dev-environment.md part 3 (tunnel, database list, bucket listing).
EOF
