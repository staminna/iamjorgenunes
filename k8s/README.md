# iamjorgenunes.com em Kubernetes (local, kind)

Ambiente de aprendizagem. **Não substitui o deploy de produção**
(`scripts/deploy-site.sh` continua a ser o caminho para o VPS).

```
Mac :18080 ──► kind node :30080 ──► Traefik (Ingress) ──► Service web:80 ──► Pods nginx :8080 (x2)
                                                                               └─ ConfigMap nginx-conf-<hash>
```

## Ficheiros

| Ficheiro | Objeto | Papel |
| --- | --- | --- |
| `../Dockerfile` | — | Build multi-stage: Node 22 gera o `dist/`, runtime `nginx-unprivileged` só com estáticos |
| `base/namespace.yaml` | Namespace | Isola o site; Pod Security `restricted` |
| `base/kustomization.yaml` + `base/nginx/*` | ConfigMap | Config do nginx, montada em `/etc/nginx/conf.d` |
| `base/deployment.yaml` | Deployment | 2 réplicas, probes, limites, sem root, FS só de leitura |
| `base/service.yaml` | Service | `ClusterIP` estável à frente dos pods |
| `base/ingress.yaml` | Ingress | `iamjorgenunes.localhost` → Service, via Traefik |
| `kind/cluster.yaml` | — | 1 control plane + 2 workers |
| `kind/traefik-values.yaml` | — | Traefik em NodePort 30080 |

## Subir

Pré-requisitos: Docker Desktop a correr, `kind`, `kubectl`, `helm`, e `.env` na raiz com
`DIRECTUS_URL` e `DIRECTUS_TOKEN`.

```bash
bash k8s/kind/up.sh
open http://iamjorgenunes.localhost:18080
```

O token só existe durante o `RUN npm run build` (BuildKit secret). Não fica em nenhuma
camada da imagem nem no cluster: o site é estático, por isso o runtime não precisa dele.

## Coisas para experimentar

```bash
kubectl -n iamjorgenunes get pods -o wide            # 2 pods em nós diferentes?
kubectl -n iamjorgenunes delete pod -l app.kubernetes.io/component=web --wait=false
kubectl -n iamjorgenunes get pods -w                 # self-healing: o ReplicaSet repõe-os

kubectl -n iamjorgenunes scale deployment/web --replicas=4

# Mudar config sem rebuild: edita base/nginx/default.conf e reaplica.
# O kustomize gera um ConfigMap com hash novo -> rolling update automático.
SKIP_BUILD=1 bash k8s/kind/up.sh

kubectl -n iamjorgenunes rollout history deployment/web
kubectl -n iamjorgenunes rollout undo deployment/web

kubectl kustomize k8s/base                            # ver o YAML final gerado
```

## Desligar

```bash
bash k8s/kind/down.sh   # apaga o cluster e liberta a RAM
```

## Próximos passos

1. Directus como segundo serviço: `Secret` para o token, probes no `/server/health`.
2. Postgres com `StatefulSet` + `PersistentVolumeClaim`.
3. Empacotar em Helm e fazer deploy via Argo CD.
4. Trocar `Ingress` por Gateway API (`Gateway` + `HTTPRoute`), o sucessor oficial.
