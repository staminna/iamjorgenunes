# iamjorgenunes.com em Kubernetes (local, kind)

Ambiente de aprendizagem. **Não substitui o deploy de produção**
(`scripts/deploy-site.sh` continua a ser o caminho para o VPS).

```
                                            ┌─► Service web:80 ──► Pods nginx :8080 (x2)
Mac :18080 ──► kind :30080 ──► Traefik ─────┤      └─ ConfigMap nginx-conf-<hash>
               (Ingress por host)           └─► Service directus:8055 ──► Pod Directus 12 (x1)
                                                   ├─ ConfigMap directus-config-<hash>
                                                   ├─ Secret directus-secrets-<hash>
                                                   └─ PVC directus-database + directus-uploads
```

## Ficheiros

| Ficheiro | Objeto | Papel |
| --- | --- | --- |
| `../Dockerfile` | — | Build multi-stage: Node 22 gera o `dist/`, runtime `nginx-unprivileged` só com estáticos |
| `base/namespace.yaml` | Namespace | Isola a app; Pod Security `restricted` |
| `base/kustomization.yaml` + `base/nginx/*` | ConfigMap | Config do nginx, montada em `/etc/nginx/conf.d` |
| `base/deployment.yaml` | Deployment | Site: 2 réplicas, probes, limites, sem root, FS só de leitura |
| `base/service.yaml` | Service | `ClusterIP` estável à frente dos pods do site |
| `base/ingress.yaml` | Ingress | `iamjorgenunes.localhost` → site |
| `base/directus/kustomization.yaml` | ConfigMap + Secret | Config não sensível em `literals`; secrets de `directus.secret.env` (fora do git) |
| `base/directus/deployment.yaml` | Deployment | Directus 12.5.1, SQLite, `Recreate`, probes (ver abaixo) |
| `base/directus/pvc.yaml` | PVC | BD e uploads persistem quando o pod é recriado |
| `base/directus/service.yaml` | Service ×2 | `directus` (só pods Ready) e `directus-bootstrap` (inclui não-Ready) |
| `base/directus/job-probe-user.yaml` + `probe-user.sh` | Job | Cria o utilizador `probe` usado pela readiness |
| `base/directus/ingress.yaml` | Ingress | `directus.localhost` → Directus |
| `kind/cluster.yaml` | — | 1 control plane + 2 workers |
| `kind/traefik-values.yaml` | — | Traefik 42.1.3 em NodePort 30080 |

## Subir

Pré-requisitos: Docker Desktop a correr, `kind`, `kubectl`, `helm`, `openssl`, e `.env` na raiz com
`DIRECTUS_URL` e `DIRECTUS_TOKEN` (o Directus de produção, usado só no build do site).

```bash
bash k8s/kind/up.sh
open http://iamjorgenunes.localhost:18080
open http://directus.localhost:18080      # admin@example.com
```

- **Token do build do site:** só existe durante o `RUN npm run build` (BuildKit secret). Não
  fica na imagem nem no cluster: o site é estático.
- **Secrets do Directus local:** o `up.sh` gera `base/directus/directus.secret.env` com
  valores aleatórios (`chmod 600`, gitignored) e o kustomize transforma-o num `Secret`.
  A password do admin está nesse ficheiro. `ADMIN_*` só contam no 1.º bootstrap da BD:
  para os mudar, `down.sh` e voltar a subir.

> Um `Secret` é só base64 no etcd. Num cluster real: encriptação at-rest e
> External Secrets / Sealed Secrets / SOPS em vez de ficheiros locais.

## Probes do Directus

No Directus 12, `/server/health` **exige autenticação** (403 sem token).

| Probe | Endpoint | Porquê |
| --- | --- | --- |
| startup | `GET /server/ping` | Dá até 5 min ao bootstrap + migrações antes de a liveness contar |
| liveness | `GET /server/ping` | Só "o processo responde?". Se dependesse da BD, um problema no SQLite reiniciava o pod em ciclo |
| readiness | `exec wget` → `/server/health` com `Bearer $PROBE_TOKEN` | Tira o pod do Service quando BD ou storage falham. `exec` para ler o token do Secret em vez de o pôr em claro num `httpGet` |

O utilizador `probe` não tem role nem permissões (`GET /users` → 403); só vê o `status`
global do health. É criado por um Job idempotente que fala com o pod através do Service
`directus-bootstrap` (`publishNotReadyAddresses: true`): o pod só fica Ready depois de o
utilizador existir, por isso o Job não podia usar o Service normal.

`HEALTHCHECK_SERVICES=database,storage` (sem Redis nem email aqui) e
`HEALTHCHECK_CACHE_TTL=10s` (o default de 5 min tornava a readiness lenta a reagir).

## Coisas para experimentar

```bash
kubectl -n iamjorgenunes get pods -o wide            # réplicas do site em nós diferentes?
kubectl -n iamjorgenunes delete pod -l app.kubernetes.io/component=web --wait=false
kubectl -n iamjorgenunes get pods -w                 # self-healing: o ReplicaSet repõe-os

kubectl -n iamjorgenunes scale deployment/web --replicas=4

# Mudar config sem rebuild: edita base/nginx/default.conf e reaplica.
# O kustomize gera um ConfigMap com hash novo -> rolling update automático.
SKIP_BUILD=1 bash k8s/kind/up.sh

kubectl -n iamjorgenunes rollout history deployment/web
kubectl -n iamjorgenunes rollout undo deployment/web

# Persistência: o pod do Directus é recriado, os dados ficam no PVC.
kubectl -n iamjorgenunes delete pod -l app.kubernetes.io/component=cms
kubectl -n iamjorgenunes get endpoints directus -w   # vazio até a readiness passar

kubectl -n iamjorgenunes logs job/directus-probe-user
kubectl kustomize k8s/base                            # ver o YAML final gerado
```

## Desligar

```bash
bash k8s/kind/down.sh   # apaga o cluster (e os PVCs) e liberta a RAM
```

## Próximos passos

1. Postgres com `StatefulSet` + `PersistentVolumeClaim` no lugar do SQLite.
2. Empacotar em Helm e fazer deploy via Argo CD.
3. Trocar `Ingress` por Gateway API (`Gateway` + `HTTPRoute`), o sucessor oficial.
