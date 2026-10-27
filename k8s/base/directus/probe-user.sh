#!/bin/sh
# Cria (ou atualiza) o utilizador "probe": sem role, sem permissões, só com
# um token estático para a readinessProbe chamar /server/health.
# Idempotente — pode correr em cada deploy.
set -eu

API="http://directus-bootstrap:8055"
ADMIN="Authorization: Bearer ${ADMIN_TOKEN}"

echo "→ à espera do Directus (${API}/server/ping)"
i=0
until curl -fs -o /dev/null "${API}/server/ping"; do
  i=$((i + 1))
  [ "$i" -ge 60 ] && { echo "✗ timeout à espera do Directus"; exit 1; }
  sleep 5
done

resp=$(curl -fsS -G -H "$ADMIN" \
  --data-urlencode "filter[email][_eq]=${PROBE_EMAIL}" \
  --data-urlencode "fields=id" \
  "${API}/users")
id=$(printf '%s' "$resp" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

body=$(printf '{"email":"%s","first_name":"Probe","status":"active","token":"%s"}' \
  "$PROBE_EMAIL" "$PROBE_TOKEN")

if [ -n "$id" ]; then
  curl -fsS -o /dev/null -X PATCH -H "$ADMIN" -H "Content-Type: application/json" \
    -d "$body" "${API}/users/${id}"
  echo "✓ utilizador probe atualizado"
else
  curl -fsS -o /dev/null -X POST -H "$ADMIN" -H "Content-Type: application/json" \
    -d "$body" "${API}/users"
  echo "✓ utilizador probe criado"
fi

curl -fsS -o /dev/null -H "Authorization: Bearer ${PROBE_TOKEN}" "${API}/server/health"
echo "✓ /server/health responde 200 com o token da probe"
