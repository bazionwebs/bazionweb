# BazionWeb — Managed Website Lifecycle Platform

> Enterprise-grade website lifecycle management for SMEs in Kenya and East Africa.
> One provider · One invoice · Complete ownership.

[![CI/CD](https://github.com/bazionweb/platform/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/bazionweb/platform/actions)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

---

## Architecture Overview

```
bazionweb/
├── apps/
│   ├── web/                  # Next.js 14 marketing site + client portal
│   └── api/                  # NestJS REST API (v1)
├── prisma/
│   ├── schema.prisma         # Authoritative DB schema (13 models)
│   └── seed.ts               # Base plans + admin user
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml       # Production (9 services)
│   │   └── docker-compose.dev.yml   # Development (4 services)
│   ├── nginx/bazionweb.conf  # Reverse proxy config
│   ├── monitoring/           # Loki + Grafana config
│   └── backups/              # Automated backup scripts
└── .github/workflows/        # CI/CD (9-stage pipeline)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend API | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Keycloak 23 (OIDC/JWT) |
| CMS | Strapi 5 |
| Reverse Proxy | Nginx (via Nginx Proxy Manager) |
| Monitoring | Uptime Kuma, Grafana, Loki |
| Support | Zammad |
| Object Storage | Backblaze B2 (S3-compatible) |
| CDN / DDoS | Cloudflare |
| CI/CD | GitHub Actions (9 stages) |
| Infra | Oracle Cloud Free Tier / Hetzner Cloud |

## Service Lines

1. **Website Development** — Custom Next.js builds, Figma design, CMS integration
2. **Managed Hosting** — Cloud infra, Cloudflare CDN, auto SSL, daily backups
3. **Maintenance** — Monthly CMS updates, patches, health checks, reports
4. **Security Management** — WAF, malware scanning, SSL rotation, audit logs
5. **Performance Optimization** — Core Web Vitals, Lighthouse 95+ target
6. **24/7 Support** — SLA-backed tickets (P1–P4), Zammad, escalation matrix

## Plans

| Plan | Price | Uptime SLA | P1 Response |
|------|-------|-----------|-------------|
| Starter | $49/mo | 99.9% | 1 hour |
| Growth | $99/mo | 99.95% | 30 min |
| Business | $199/mo | 99.95% | 15 min |
| Enterprise | Custom | 99.99% | 5 min |

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- npm or pnpm

### 1. Clone and install

```bash
git clone https://github.com/bazionweb/platform.git
cd platform
cp .env.example .env.local
# Edit .env.local with your values
```

### 2. Start infrastructure services

```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
# PostgreSQL on :5432, Redis on :6379, MailHog on :8025, Adminer on :8080
```

### 3. Set up database

```bash
# Install Prisma CLI and run migrations
npm install -g prisma
cd apps/api
npm install
npx prisma migrate dev --name init
npx prisma db seed
npx prisma studio  # Optional: GUI at localhost:5555
```

### 4. Start the API

```bash
cd apps/api
npm run start:dev
# API running at http://localhost:4000
# Swagger docs at http://localhost:4000/api/docs
```

### 5. Start the frontend

```bash
cd apps/web
npm install
npm run dev
# Web running at http://localhost:3000
```

---

## Key URLs (Development)

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| Prisma Studio | http://localhost:5555 |
| MailHog (email) | http://localhost:8025 |
| Adminer (DB) | http://localhost:8080 |

## Key URLs (Production)

| Service | URL |
|---------|-----|
| Marketing Site | https://bazionweb.com |
| Client Portal | https://bazionweb.com/portal |
| Admin Portal | https://bazionweb.com/admin |
| API | https://api.bazionweb.com/api/v1 |
| CMS (Strapi) | https://cms.bazionweb.com |
| Auth (Keycloak) | https://auth.bazionweb.com |
| Status Page | https://status.bazionweb.com |
| Monitoring | https://monitoring.bazionweb.com |

---

## CI/CD Pipeline (9 Stages)

```
1. Lint & TypeScript check
2. Unit tests (Jest + coverage)
3. Docker image build + push (GHCR)
4. Security scan (Trivy + npm audit)
5. Deploy to staging
6. E2E tests (Playwright)
7. Lighthouse CI (performance gate: 90+)
8. Deploy to production (manual gate on main)
9. Post-deploy smoke tests + Slack notification
```

## Environment Variables

See `.env.example` for the complete list with descriptions. Required for development:

```bash
DATABASE_URL=postgresql://bazionweb:devpassword@localhost:5432/bazionweb_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=<min 32 chars>
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=bazionweb
KEYCLOAK_CLIENT_ID=bazionweb-api
KEYCLOAK_CLIENT_SECRET=<from keycloak admin>
```

## Database Schema

13 models across 4 domains:

- **Auth**: `User`
- **Business**: `Client`, `Plan`, `Subscription`
- **Projects**: `Project`, `ProjectTask`
- **Operations**: `Ticket`, `TicketComment`, `HostingAccount`, `Backup`, `Invoice`, `AuditLog`, `Notification`

All tables have:
- UUID primary keys
- `created_at` / `updated_at` timestamps
- Soft deletes (`deleted_at`) where applicable
- Comprehensive indexes on all FK columns and filter fields

## Contributing

1. Branch from `develop`
2. Follow the existing TypeScript strict mode patterns
3. Write tests for new service methods
4. Ensure `npm run lint` and `npm run tsc` pass
5. PR against `develop` — requires 1 review

## License

Proprietary — © 2025 BazionWeb. All rights reserved.
