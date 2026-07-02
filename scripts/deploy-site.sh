#!/usr/bin/env bash
# Deploy the built Astro site (dist/) to the nginx server serving iamjorgenunes.com.
# Run from the repo root ON YOUR MAC:
#   bash scripts/deploy-site.sh
#
# Uses the `production` SSH alias if you have one, otherwise set SSH_ALIAS:
#   SSH_ALIAS=varrho@78.47.109.147 bash scripts/deploy-site.sh
# Optionally pin the web root (skips auto-detection):
#   WEBROOT=/var/www/iamjorgenunes.com bash scripts/deploy-site.sh
set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-production}"
DOMAIN="iamjorgenunes.com"

[ -d dist ] || { echo "✗ dist/ not found — run 'npm run build' first."; exit 1; }
grep -q "<title>" dist/index.html || { echo "✗ dist/index.html looks wrong — aborting."; exit 1; }

echo "→ Checking SSH connectivity to '${SSH_ALIAS}'…"
if ! ssh -o ConnectTimeout=8 -o BatchMode=no "${SSH_ALIAS}" true 2>/dev/null; then
  cat <<EOF
✗ Cannot reach '${SSH_ALIAS}'.

If you don't have the alias configured, either run with an explicit target:

    SSH_ALIAS=user@your-server-ip bash scripts/deploy-site.sh

or add this once to ~/.ssh/config and rerun:

    Host production
      HostName <your-server-ip>
      User <your-user>

EOF
  exit 1
fi

# Auto-detect the web root from the server's nginx config unless WEBROOT is set.
if [ -z "${WEBROOT:-}" ]; then
  echo "→ Detecting web root for ${DOMAIN} on the server…"
  WEBROOT=$(ssh "${SSH_ALIAS}" "grep -rhA6 'server_name.*${DOMAIN}' /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null | grep -m1 -oE 'root[[:space:]]+[^;]+' | awk '{print \$2}'" || true)
  if [ -z "${WEBROOT}" ]; then
    echo "✗ Could not auto-detect the web root. Candidates on the server:"
    ssh "${SSH_ALIAS}" "ls -d /var/www/*/ /srv/www/*/ 2>/dev/null" || true
    echo "Rerun with:  WEBROOT=/path/to/webroot bash scripts/deploy-site.sh"
    exit 1
  fi
  echo "  detected: ${WEBROOT}"
fi

# Never rsync --delete into a directory that doesn't already exist / isn't a webroot.
ssh "${SSH_ALIAS}" "[ -f '${WEBROOT}/index.html' ]" || {
  echo "✗ ${WEBROOT} has no index.html — refusing to --delete into it. Check the path."; exit 1; }

echo "→ Deploying dist/ to ${SSH_ALIAS}:${WEBROOT}"
rsync -az --delete dist/ "${SSH_ALIAS}:${WEBROOT}/"

echo "→ Verifying live site…"
sleep 2
if curl -sf "https://${DOMAIN}" | grep -q "Senior AI Engineer"; then
  echo "✅ Live: ${DOMAIN} is serving the new build."
else
  echo "⚠️  Deployed, but verification string not found — check the site manually."
fi
