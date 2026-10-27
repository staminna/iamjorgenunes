# syntax=docker/dockerfile:1.7
#
# iamjorgenunes.com — imagem estática para Kubernetes.
#
# Build (o token NUNCA vai para a imagem; é montado só durante o RUN):
#   set -a; source .env; set +a
#   DOCKER_BUILDKIT=1 docker build \
#     --secret id=directus_token,env=DIRECTUS_TOKEN \
#     --build-arg DIRECTUS_URL="$DIRECTUS_URL" \
#     -t iamjorgenunes-web:dev .

ARG NODE_VERSION=22
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine

# ---------------------------------------------------------------------------
# Stage 1 — build: precisa das devDependencies (astro, tailwind, sharp…)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# Camada de dependências separada para aproveitar a cache.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .

ARG DIRECTUS_URL=https://nowos.varrho.com
ENV DIRECTUS_URL=${DIRECTUS_URL} \
    ASTRO_TELEMETRY_DISABLED=1

# O secret só existe neste RUN, em tmpfs; não fica em nenhuma camada.
RUN --mount=type=secret,id=directus_token,required=true \
    DIRECTUS_TOKEN="$(cat /run/secrets/directus_token)" npm run build

# ---------------------------------------------------------------------------
# Stage 2 — runtime: nginx sem root, só o dist/. Sem Node, sem node_modules.
# ---------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

LABEL org.opencontainers.image.title="iamjorgenunes-web" \
      org.opencontainers.image.source="https://github.com/staminna/iamjorgenunes" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
