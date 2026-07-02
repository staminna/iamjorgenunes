#!/usr/bin/env bash
# Deploy the built Astro site (dist/) to the nginx server serving iamjorgenunes.com.
# Run from the repo root ON YOUR MAC:
#   SSH_ALIAS=varrho@78.47.109.147 bash scripts/deploy-site.sh
# Or pin the web root explicitly (skips auto-detection):
#   SSH_ALIAS=varrho@78.47.109.147 WEBROOT=/path/to/webroot bash scripts/deploy-site.sh
set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-production}"
DOMAIN="iamjorgenunes.com"

[ -d dist ] || { echo "✗ dist/ not found — run 'npm run build' first."; exit 1; }
grep -q "<title>" dist/index.html || { echo "✗ dist/index.html looks wrong — aborting."; exit 1; }

echo "→ Checking SSH connectivity to '${SSH_ALIAS}'…"
ssh -o ConnectTimeout=8 "${SSH_ALIAS}" true 2>/dev/null || {
  echo "✗ Cannot reach '${SSH_ALIAS}'. Run with SSH_ALIAS=user@server-ip"; exit 1; }

# ---------------------------------------------------------------------------
# Web-root detection: match ONLY the apex/www server_name (a token equal to
# iamjorgenunes.com or www.iamjorgenunes.com), never subdomains like
# agentic.iamjorgenunes.com.
# ---------------------------------------------------------------------------
if [ -z "${WEBROOT:-}" ]; then
  echo "→ Detecting web root for ${DOMAIN} (exact match) on the server…"
  CANDIDATES=$(ssh "${SSH_ALIAS}" DOMAIN="${DOMAIN}" 'sh -s' <<'REMOTE'
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf /etc/nginx/nginx.conf; do
  [ -f "$f" ] || continue
  if grep -qE "server_name[^;]*[[:space:]](www\.)?${DOMAIN}([[:space:]]|;)" "$f"; then
    root=$(grep -m1 -E "^[[:space:]]*root[[:space:]]" "$f" | awk "{gsub(/;/,\"\"); print \$2}")
    [ -n "$root" ] && echo "$f|$root"
  fi
done
exit 0
REMOTE
  )
  N=$(printf '%s' "${CANDIDATES}" | grep -c . || true)
  if [ "${N}" -ne 1 ]; then
    echo "✗ Expected exactly 1 vhost for ${DOMAIN}, found ${N}:"
    printf '%s\n' "${CANDIDATES:-  (none)}"
    echo "Rerun with:  WEBROOT=/path/to/webroot bash scripts/deploy-site.sh"
    exit 1
  fi
  WEBROOT=${CANDIDATES#*|}
  echo "  detected: ${WEBROOT}  (from ${CANDIDATES%%|*})"
fi

# ---------------------------------------------------------------------------
# Safety gates before any --delete:
#  1. Target must already contain THIS site (Astro build + "Jorge Nunes").
#  2. Target must be writable by the SSH user.
# ---------------------------------------------------------------------------
echo "→ Verifying ${WEBROOT} is the CV site and is writable…"
ssh "${SSH_ALIAS}" "grep -q 'Jorge Nunes' '${WEBROOT}/index.html' 2>/dev/null && [ -d '${WEBROOT}/_astro' ]" || {
  echo "✗ ${WEBROOT} does not look like the Astro CV site (marker check failed)."
  echo "  Refusing to deploy with --delete. Inspect it:  ssh ${SSH_ALIAS} ls -la ${WEBROOT}"
  exit 1; }
ssh "${SSH_ALIAS}" "[ -w '${WEBROOT}' ] && [ -w '${WEBROOT}/index.html' ]" || {
  echo "✗ ${WEBROOT} is not writable by this SSH user. Ownership:"
  ssh "${SSH_ALIAS}" "ls -ld '${WEBROOT}' '${WEBROOT}/index.html'"
  echo "  Fix on the server (as root):  chown -R \$(ssh ${SSH_ALIAS} whoami) ${WEBROOT}"
  exit 1; }

echo "→ Deploying dist/ to ${SSH_ALIAS}:${WEBROOT}"
rsync -az --delete --exclude '.DS_Store' dist/ "${SSH_ALIAS}:${WEBROOT}/"

echo "→ Verifying live site…"
sleep 2
if curl -sf "https://${DOMAIN}" | grep -q "Senior AI Engineer"; then
  echo "✅ Live: ${DOMAIN} is serving the new build."
else
  echo "⚠️  Deployed, but verification string not found — check the site manually."
fi
