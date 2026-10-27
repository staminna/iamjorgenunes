#!/usr/bin/env bash
# Sobe o site num cluster kind local: cluster -> imagem -> Traefik -> app.
# Idempotente: pode correr-se de novo depois de mudar código ou manifestos.
#
#   bash k8s/kind/up.sh          # tudo
#   SKIP_BUILD=1 bash k8s/kind/up.sh   # só reaplicar manifestos
set -euo pipefail

CLUSTER=iamjorgenunes
IMAGE=iamjorgenunes-web:dev
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-42.1.3}" # Traefik v3.7.16
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

need() { command -v "$1" >/dev/null || { echo "✗ falta '$1'"; exit 1; }; }
need docker; need kind; need kubectl; need helm
docker info >/dev/null 2>&1 || { echo "✗ Docker não está a correr (abre o Docker Desktop)"; exit 1; }

# 1) Cluster
if ! kind get clusters | grep -qx "$CLUSTER"; then
  echo "→ A criar cluster kind '$CLUSTER'"
  kind create cluster --config k8s/kind/cluster.yaml
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

# 2) Imagem — o token do Directus vem do .env local e entra só como BuildKit secret
if [ -z "${SKIP_BUILD:-}" ]; then
  [ -f .env ] || { echo "✗ falta .env (DIRECTUS_URL, DIRECTUS_TOKEN)"; exit 1; }
  set -a; source .env; set +a
  : "${DIRECTUS_URL:?}"; : "${DIRECTUS_TOKEN:?}"
  echo "→ A construir $IMAGE"
  DOCKER_BUILDKIT=1 docker build \
    --secret id=directus_token,env=DIRECTUS_TOKEN \
    --build-arg DIRECTUS_URL="$DIRECTUS_URL" \
    -t "$IMAGE" .
  unset DIRECTUS_TOKEN
  echo "→ A carregar a imagem nos nós do kind"
  kind load docker-image "$IMAGE" --name "$CLUSTER"
fi

# 3) Ingress controller
helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
helm repo update traefik >/dev/null
echo "→ A instalar/atualizar Traefik"
helm upgrade --install traefik traefik/traefik \
  --namespace traefik --create-namespace \
  ${TRAEFIK_CHART_VERSION:+--version "$TRAEFIK_CHART_VERSION"} \
  -f k8s/kind/traefik-values.yaml --wait

# 4) App
echo "→ A aplicar manifestos"
kubectl apply -k k8s/base
# Força novos pods quando a tag :dev é a mesma mas a imagem mudou.
if [ -z "${SKIP_BUILD:-}" ]; then
  kubectl -n iamjorgenunes rollout restart deployment/web
fi
kubectl -n iamjorgenunes rollout status deployment/web --timeout=120s

echo "✅ http://iamjorgenunes.localhost:18080"
