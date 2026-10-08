---
title: "About Jorge"
metaDescription: "Platform & DevOps engineer with 12+ years of experience running production systems end to end — AWS, Terraform, Ansible, Kubernetes, CI/CD, DevSecOps and OAuth2 / OIDC. Ex-European Central Bank and European Commission."
draft: false
---

## Hi, I'm Jorge.

Hands-on platform and DevOps engineer with **12+ years of experience** building and running production systems end to end: infrastructure, delivery pipelines, security and the services on top. At **Co2Offset.ai** I designed and built the AWS infrastructure (ECS / Fargate, EC2, RDS, S3, Lambda, IAM; Kubernetes with Helm; Terraform multi-environment; Ansible) behind the data pipeline that passed the **Bureau Veritas** audit and unlocked **€2.5M of business**, with **SOC 2** and **ISO 27001** compliance. Three years inside the **European Central Bank**'s enterprise environment: Red Hat Linux, Bash, Python and PowerShell automation across Active Directory, CSP and TLS hardening and auditable operations; **CI/CD at the European Commission** in Brussels. Today I run my own production platforms on Docker, Linux and Terraform with test-gated pipelines, least-privilege deploys and health-checked services, and I build my own tooling — including an open-source MCP server for Docker, SSH and Kubernetes deployments.

### Platforms I run in production

- **keyprog.pt** — Directus + PostgreSQL + Redis in Docker Compose behind Nginx; GitHub Actions deploy as a non-root user with fast-forward-only merges; strict CSP with SHA-256 script hashes.
- **api.romanceinroom.com** — e-commerce backend in Docker on a Linux VPS; API gateway (token hiding, rate limiting), hardened payment webhooks and reconciliation jobs.
- **dev.mdbaudio.com · team.mdbaudio.com** — Next.js plus two Directus instances on Hetzner Linux; git-driven deploys, systemd services, Auth0 (OAuth2 / OIDC, RBAC).
- **api.after.zone** — Go API serving 58,000+ events across 3,100+ cities; test-gated `linux/amd64` Docker deploys; ingestion monitored by AI agents.
- **Exponent** — FastAPI / React / PostgreSQL / Redis / n8n microservices; Terraform-managed, health probes and SIGTERM draining.

### What I do

- **Cloud & infrastructure as code**: AWS (ECS / Fargate, EC2, RDS, S3, Lambda, IAM) designed and provisioned with Terraform across multiple environments and configured with Ansible; Hetzner Linux VPS fleets.
- **Containers & orchestration**: Docker and Compose with local/production parity; Kubernetes with Helm charts, Kustomize, Gateway API (Gloo / Envoy), auto-scaling and health probes — 400+ containerised microservice endpoints in production.
- **CI/CD & release management**: GitHub Actions, GitLab and Jenkins with test-gated builds and enforced coverage gates; runbooks, release plans and store compliance; production migrations.
- **DevSecOps & identity**: OAuth2 / OpenID Connect, JWT and RBAC (Auth0, Firebase); Active Directory; Content Security Policy, TLS, rate limiting, least-privilege deploy users and service tokens.
- **Linux platform operations**: Red Hat and Ubuntu, systemd, Nginx and multi-vhost Apache, health probes, graceful shutdown, logging, incident response and escalated-incident diagnosis.
- **Secure integrations**: payment webhooks verified against the provider's API with constant-time key comparison, anti-replay checks and fail-safe reconciliation; idempotent ERP invoicing; atomic reservations.
- **Automation & agentic ops**: 200+ workflows covering CI/CD, ETL and event-driven ingestion; AI agents running infrastructure operations through MCP, with a LangGraph agent checkpointed in PostgreSQL and an audit trail aligned with ISO/IEC 42001.

### Open-source tooling I built

- **`cicd-mcp-pipeline`** (npm) — Docker (local and SSH-remote) and Kubernetes (Kustomize, Gateway API with Gloo / Envoy) control across local, staging and production; environment diffing, health checks, API token rotation and pre-deployment CI/CD validation.
- **`@staminna/directus-mcp-server`** (npm) — 97%+ test coverage behind enforced CI coverage gates; runs on a least-privilege service token.
- **AFTER MCP** — status of pulls from event APIs and ingestion operations for after.zone.

### Security & compliance

- **ECB**: ran 20 Apache virtual hosts for my team with SHA-256 TLS; security policies, CSP against XSS and unauthorised access, rights administration and auditable logging of every operation.
- **Co2Offset.ai**: SOC 2 and ISO 27001 compliance; led the Bureau Veritas pipeline audit that secured the scientific-reliability certification and unlocked €2.5M.
- **Exponent**: audit trail aligned with ISO/IEC 42001.
- **Payment webhooks**: provider-side verification, constant-time key comparison, anti-replay and fail-safe reconciliation.

### Selected stack

**Cloud & IaC**: AWS (ECS / Fargate, EC2, RDS, S3, Lambda, IAM), Terraform (multi-environment), Ansible; Hetzner Linux VPS · **Containers & orchestration**: Docker / Compose, Kubernetes, Helm, Kustomize, Gateway API (Gloo / Envoy) · **CI/CD**: GitHub Actions, GitLab, Jenkins; test-gated builds and enforced coverage gates (Vitest, Jest) · **Security & IAM**: OAuth2 / OpenID Connect, JWT, RBAC (Auth0, Firebase), Active Directory, CSP, TLS, rate limiting, least-privilege deploy users and service tokens, SOC 2 / ISO 27001 · **Scripting & languages**: Bash, Python, PowerShell; Go, Node.js / TypeScript · **Linux & operations**: Red Hat Linux, Ubuntu, systemd, Nginx and Apache (multi-vhost), health probes, graceful shutdown, logging and incident response · **Data**: PostgreSQL / PostGIS, Redis, MongoDB, Kafka, Elasticsearch.

### Certification

**AWS Certified DevOps Engineer – Professional** — in preparation.

### Availability

Long-term engagement: freelance, B2B or contract; remote (CET), hybrid or relocation, including Brussels.

### Where I am

Pombal, Portugal — CET hours.

- Email: [stamina.nunes@gmail.com](mailto:stamina.nunes@gmail.com)
- LinkedIn: [linkedin.com/in/stamina](https://www.linkedin.com/in/stamina/)
- GitHub: [github.com/staminna](https://www.github.com/staminna)
- Phone: [+351 914 764 120](tel:+351914764120)
- CV: [Download PDF](/cv/Jorge_Nunes_CV.pdf)
