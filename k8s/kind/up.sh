#!/usr/bin/env bash
# Sobe o site e o Directus num cluster kind local:
# cluster -> secrets locais -> imagem -> Traefik -> manifestos.
# Idempotente: pode correr-se de novo depois de mudar código ou manifestos.
#
#   bash k8s/kind/up.sh                 # tudo
#   SKIP_BUILD=1 bash k8s/kind/up.sh    # só reaplicar manifestos
set -euo pipefail

CLUSTER=iamjorgenunes
NS=iamjorgenunes
IMAGE=iamjorgenunes-web:dev
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-42.1.3}" # Traefik v3.7.16
DIRECTUS_SECRETS=k8s/base/directus/directus.secret.env
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

need() { command -v "$1" >/dev/null || { echo "✗ falta '$1'"; exit 1; }; }
need docker; need kind; need kubectl; need helm; need openssl
docker info >/dev/null 2>&1 || { echo "✗ Docker não está a correr (abre o Docker Desktop)"; exit 1; }

# 1) Cluster
if ! kind get clusters | grep -qx "$CLUSTER"; then
  echo "→ A criar cluster kind '$CLUSTER'"
  kind create cluster --config k8s/kind/cluster.yaml
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

# 2) Secrets locais do Directus (gitignored). Gerados uma vez; os valores
#    nunca são impressos. Nota: ADMIN_* só contam no 1.º bootstrap da BD.
if [ ! -f "$DIRECTUS_SECRETS" ]; then
  echo "→ A gerar $DIRECTUS_SECRETS (valores aleatórios, chmod 600)"
  (
    umask 077
    {
      echo "SECRET=$(openssl rand -base64 32 | tr -d '\n')"
      echo "ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=\n')"
      echo "ADMIN_TOKEN=$(openssl rand -hex 32)"
      echo "PROBE_TOKEN=$(openssl rand -hex 32)"
    } > "$DIRECTUS_SECRETS"
  )
fi

# 3) Imagem do site — o token do Directus de produção vem do .env e entra
#    só como BuildKit secret
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

# 4) Ingress controller
helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
helm repo update traefik >/dev/null
echo "→ A instalar/atualizar Traefik"
helm upgrade --install traefik traefik/traefik \
  --namespace traefik --create-namespace \
  ${TRAEFIK_CHART_VERSION:+--version "$TRAEFIK_CHART_VERSION"} \
  -f k8s/kind/traefik-values.yaml --wait

# 5) App
echo "→ A aplicar manifestos"
# O spec de um Job é imutável: apagar antes de reaplicar (o Job é idempotente).
kubectl -n "$NS" delete job directus-probe-user --ignore-not-found >/dev/null 2>&1 || true
kubectl apply -k k8s/base
# Força novos pods quando a tag :dev é a mesma mas a imagem mudou.
if [ -z "${SKIP_BUILD:-}" ]; then
  kubectl -n "$NS" rollout restart deployment/web
fi
kubectl -n "$NS" rollout status deployment/web --timeout=120s

echo "→ À espera do Directus (1.º arranque: pull da imagem + migrações)"
kubectl -n "$NS" wait --for=condition=complete job/directus-probe-user --timeout=600s
kubectl -n "$NS" rollout status deployment/directus --timeout=120s

echo "✅ Site:     http://iamjorgenunes.localhost:18080"
echo "✅ Directus: http://directus.localhost:18080  (admin@example.com — password em $DIRECTUS_SECRETS)"
