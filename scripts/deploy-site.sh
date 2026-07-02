#!/usr/bin/env bash
# Deploy the built Astro site (dist/) to the nginx server serving iamjorgenunes.com.
# Run from the repo root ON YOUR MAC (needs your `production` SSH alias):
#   bash scripts/deploy-site.sh
#
# Override the web root if different:
#   WEBROOT=/var/www/iamjorgenunes.com bash scripts/deploy-site.sh
set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-production}"
WEBROOT="${WEBROOT:-/var/www/iamjorgenunes.com}"

[ -d dist ] || { echo "dist/ not found — run 'npm run build' first."; exit 1; }
grep -q "<title>" dist/index.html || { echo "dist/index.html looks wrong — aborting."; exit 1; }

echo "→ Deploying dist/ to ${SSH_ALIAS}:${WEBROOT}"
rsync -az --delete --exclude='.htaccess' dist/ "${SSH_ALIAS}:${WEBROOT}/"

echo "→ Verifying live site…"
sleep 2
if curl -sf https://iamjorgenunes.com | grep -q "Senior AI Engineer"; then
  echo "✅ Live: iamjorgenunes.com is serving the new build."
else
  echo "⚠️  Deployed, but verification string not found — check the site manually."
fi
