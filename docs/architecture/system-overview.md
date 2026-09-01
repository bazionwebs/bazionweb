# BazionWeb — Architecture Overview

**Version:** 2.0  
**Date:** June 2025  
**Status:** Production

---

## System Architecture

```
                        ┌─────────────────────────────────────────┐
                        │           CLOUDFLARE EDGE                │
                        │  CDN · DDoS · WAF · DNS · SSL            │
                        └──────────────┬──────────────────────────┘
                                       │ HTTPS
                        ┌──────────────▼──────────────────────────┐
                        │        NGINX PROXY MANAGER               │
                        │  TLS termination · Rate limiting         │
                        │  Reverse proxy to internal services      │
                        └─────┬──────────┬──────────┬─────────────┘
                              │          │          │
              ┌───────────────▼──┐  ┌────▼───┐  ┌──▼──────────────┐
              │  Next.js 14 Web  │  │NestJS  │  │   Keycloak 23   │
              │  :3000           │  │API     │  │   Auth Server   │
              │  Marketing site  │  │:4000   │  │   :8080         │
              │  Client portal   │  │REST v1 │  │   OIDC/JWT      │
              │  Admin portal    │  │        │  │                 │
              └──────────────────┘  └───┬────┘  └─────────────────┘
                                        │
                         ┌──────────────┼──────────────┐
                         │              │              │
              ┌──────────▼──┐  ┌────────▼───┐  ┌──────▼────────┐
              │ PostgreSQL  │  │  Redis 7   │  │  Strapi 5 CMS │
              │ 16          │  │  Cache     │  │  :1337        │
              │ Primary DB  │  │  Sessions  │  │  Blog/Content │
              └──────────────┘  └────────────┘  └───────────────┘

                    MONITORING STACK
              ┌──────────────────────────────────────┐
              │  Uptime Kuma → site uptime checks    │
              │  Grafana + Prometheus → metrics      │
              │  Loki → log aggregation              │
              │  Zammad → support tickets            │
              └──────────────────────────────────────┘
```

---

## Service Inventory

| Service | Image | Port | Role |
|---------|-------|------|------|
| web | bazionweb-web | 3000 | Next.js app (marketing + portals) |
| api | bazionweb-api | 4000 | NestJS REST API |
| db | postgres:16-alpine | 5432 | Primary relational database |
| redis | redis:7-alpine | 6379 | Session cache, rate limiting |
| keycloak | quay.io/keycloak/keycloak:23 | 8080 | Identity provider (OIDC) |
| strapi | strapi/strapi:5 | 1337 | Headless CMS for blog/case studies |
| nginx-proxy-manager | jc21/nginx-proxy-manager | 80/443/81 | Reverse proxy + SSL |
| uptime-kuma | louislam/uptime-kuma:1 | 3001 | Uptime monitoring |
| grafana | grafana/grafana | 3000 | Metrics dashboards |
| loki | grafana/loki | 3100 | Log aggregation |
| zammad | zammad/zammad | 8080 | Support ticket system |

---

## Network Topology

Two Docker networks:
- **bazionweb-public**: Web, API, Keycloak, NPM, Uptime Kuma (externally accessible via NPM)
- **bazionweb-internal**: DB, Redis, Strapi, Grafana, Loki (never directly exposed)

All cross-service communication uses Docker internal DNS (`service_name:port`).

---

## Data Flow

### Public user request
```
Browser → Cloudflare (CDN/WAF) → Nginx Proxy Manager → Next.js web app
```

### API call from portal
```
Next.js client → Cloudflare → NPM → NestJS API → PostgreSQL/Redis
```

### Authentication flow
```
User login → NestJS /auth/login → Keycloak (ROPC grant) → JWT returned
Subsequent requests → JWT in Bearer header → JwtAuthGuard → JWKS verification
```

### CMS content fetch
```
Next.js build/ISR → Strapi REST API → PostgreSQL (strapi schema) → HTML rendered
```

---

## Database Schema Summary

**13 models across 4 domains:**

```
Auth domain:      users
Business domain:  clients, plans, subscriptions
Projects domain:  projects, project_tasks
Operations:       tickets, ticket_comments, hosting_accounts,
                  backups, invoices, audit_logs, notifications
```

All tables: UUID PKs · `created_at`/`updated_at` on every row · soft deletes where applicable · indexes on all FK + filter columns.

---

## Security Architecture

| Layer | Implementation |
|-------|---------------|
| Edge | Cloudflare WAF, DDoS protection, Bot Fight Mode |
| Transport | TLS 1.3 only, HSTS with preload, OCSP stapling |
| Application | Helmet.js CSP/HSTS headers, input validation (class-validator), rate limiting (Throttler) |
| Authentication | Keycloak OIDC, JWKS-validated JWTs, RBAC (4 roles) |
| Authorization | JwtAuthGuard + @Roles() decorator per endpoint |
| Database | Parameterized queries via Prisma (no raw SQL interpolation), row-level access control in services |
| Secrets | GitHub Actions Secrets (CI) + environment variables at runtime (never committed) |
| Audit | AuditInterceptor logs all mutating requests to append-only `audit_logs` table |
| Intrusion | Fail2Ban on SSH, Nginx 429s, and Keycloak failed logins |
| Backups | AES-256 encrypted, off-site (Backblaze B2), daily, verified monthly |

---

## CI/CD Pipeline

```
develop branch → staging branch → main branch
     │                 │               │
  Lint+Tests       +Deploy         +Manual gate
  TypeCheck       +E2E tests       +Production deploy
  Docker build    +Lighthouse      +Smoke tests
  Trivy scan      +Playwright      +Slack notification
```

All 9 stages defined in `.github/workflows/ci-cd.yml`.

---

## Scaling Considerations

**Current (Year 1 — 100 clients):**
- Single VPS (Oracle Cloud Always Free: 4 OCPU, 24GB RAM)
- Single PostgreSQL instance with connection pooling
- Cloudflare handles CDN/caching — VPS origin load is minimal

**Scale triggers:**
- 200+ clients → add Hetzner CX41 replica + PgBouncer connection pooler
- 500+ clients → PostgreSQL read replica for reports queries
- 1000+ clients → Kubernetes migration (Hetzner managed K3s)

**Bottlenecks to watch:**
- DB connections (max_connections=100, monitor via Grafana)
- Disk IOPS for backup operations (schedule between 01:00–03:00)
- Zammad search index size (archive tickets >2 years)
