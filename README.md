# BazionWeb — Managed Website Lifecycle Platform

> Enterprise-grade website lifecycle management for SMEs in Kenya and East Africa.  
> One provider · One invoice · Complete ownership.

[![CI/CD Pipeline](https://github.com/bazionwebs/bazionweb/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/bazionwebs/bazionweb/actions/workflows/ci-cd.yml)
[![Security Scan](https://github.com/bazionwebs/bazionweb/actions/workflows/security.yml/badge.svg)](https://github.com/bazionwebs/bazionweb/actions/workflows/security.yml)
[![License](https://img.shields.io/badge/license-Proprietary-red)](#license)
[![Node Version](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-0C344B)](https://www.prisma.io/)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Billing System](#billing-system)
- [Service Tiers](#service-tiers)
- [Quick Start](#quick-start-development)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline](#cicd-pipeline)
- [Database Schema](#database-schema)
- [Key URLs](#key-urls)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Overview

BazionWeb is a full-stack managed website lifecycle platform for SMEs, corporates, and institutions. It handles everything from initial design and development to ongoing hosting, maintenance, security management, and performance optimization — all under a single subscription.

**Core capabilities:**
- 🇰🇪 **M-Pesa Express** — Local Kenya subscriptions via IntaSend STK Push
- 💳 **Card Payments** — International Visa/Mastercard via IntaSend tokenization
- 🏦 **Corporate Wire Transfers** — B2B invoicing with Wise virtual IBAN/ACH accounts (USD/EUR/GBP)
- 📊 **Client Portal** — Subscription management, invoicing, project tracking, support tickets
- 🔐 **Admin Dashboard** — Full CRUD across clients, billing, hosting, and reports
- 🔔 **Webhook State Machine** — Idempotent IPN processing, dunning sequences, automated renewals

---

## Architecture

```
bazionweb/
├── apps/
│   ├── web/                        # Next.js 14 — marketing site + client portal
│   └── api/                        # NestJS 10 — REST API v1 (versioned)
├── prisma/
│   ├── schema.prisma               # Authoritative DB schema (v2.1, 15 models)
│   └── seed.ts                     # Base plans + admin user seeder
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml      # Production (9 services)
│   │   └── docker-compose.dev.yml  # Development (4 services)
│   ├── nginx/bazionweb.conf        # Reverse proxy + SSL termination
│   ├── monitoring/                 # Prometheus, Grafana, Loki configs
│   └── backups/                    # Automated backup scripts (Restic + B2)
├── docs/
│   ├── architecture/               # System overview diagrams
│   ├── runbooks/                   # P1 response, DB restore procedures
│   └── sops/                       # Client onboarding, monthly maintenance
└── .github/
    ├── workflows/                  # CI/CD (9-stage), Security scanning
    ├── ISSUE_TEMPLATE/             # Bug reports, feature requests
    └── PULL_REQUEST_TEMPLATE.md
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js, TypeScript, Tailwind CSS | 14.x / 5.5 |
| **Backend API** | NestJS, TypeScript, Prisma ORM | 10.x / 5.x |
| **Database** | PostgreSQL | 16 |
| **Cache / Queue** | Redis | 7 |
| **Authentication** | Keycloak (OIDC/JWT + MFA) | 23 |
| **CMS** | Strapi | 5 |
| **Payments (Local)** | IntaSend (M-Pesa STK + Card) | REST v1 |
| **Payments (Corporate)** | Wise (Virtual IBAN/ACH) | REST v1 |
| **Reverse Proxy** | Nginx | 1.26 |
| **Monitoring** | Uptime Kuma, Grafana, Loki | — |
| **Object Storage** | Backblaze B2 (S3-compatible) | — |
| **CDN / DDoS** | Cloudflare | — |
| **CI/CD** | GitHub Actions | — |

---

## Billing System

BazionWeb uses a **three-rail payment architecture**:

### Track A — IntaSend (M-Pesa & Cards)
- `POST /api/v1/invoices/subscribe/intasend`
- Triggers M-Pesa STK Push for local clients (KES)
- Generates secure card tokenization checkout sessions for international clients
- IntaSend IPN webhooks at `POST /api/v1/webhooks/intasend`

### Track B — Wise (Corporate Bank Transfers)
- `POST /api/v1/invoices/corporate-invoice/wise`
- Allocates a dedicated virtual receiving account (USD ACH/Wire, EUR SEPA, GBP Faster Payments)
- Generates PDF-ready B2B invoice with unique payment reference
- Wise webhooks at `POST /api/v1/webhooks/wise`

### Track C — Webhook State Machine
- HMAC-SHA256 signature verification on all incoming webhooks
- Idempotent deduplication via `payment_logs.idempotency_key`
- Automated subscription lifecycle: `TRIAL → ACTIVE → PAST_DUE → SUSPENDED`
- 3-stage dunning sequence with configurable grace periods

---

## Service Tiers

| Plan | Price (USD) | Price (KES) | Uptime SLA | P1 Response |
|------|------------|------------|-----------|-------------|
| **Starter** | $49/mo | KES 6,400/mo | 99.9% | 1 hour |
| **Growth** | $99/mo | KES 12,900/mo | 99.95% | 30 min |
| **Business** | $199/mo | KES 25,900/mo | 99.95% | 15 min |
| **Enterprise** | Custom | Custom | 99.99% | 5 min |

Annual billing available with **17% discount** (2 months free).

---

## Quick Start (Development)

### Prerequisites

- **Node.js** 20+
- **Docker** + Docker Compose
- **npm** 10+
- A `.env.local` file (copy from `.env.example`)

### 1. Clone & Install

```bash
git clone https://github.com/bazionwebs/bazionweb.git
cd bazionweb
cp .env.example .env.local
# Edit .env.local with your secrets
```

### 2. Start Infrastructure Services

```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
# PostgreSQL  → :5432
# Redis       → :6379
# MailHog     → :8025
# Adminer     → :8080
```

### 3. Set Up the Database

```bash
cd apps/api
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
# Optional: GUI browser at localhost:5555
npx prisma studio
```

### 4. Start the API

```bash
cd apps/api
npm run start:dev
# → http://localhost:4000
# → http://localhost:4000/api/docs (Swagger)
```

### 5. Start the Frontend

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required secrets. Key variables:

```ini
# Core
DATABASE_URL=postgresql://bazionweb:devpassword@localhost:5432/bazionweb_dev
REDIS_URL=redis://localhost:6379

# Authentication (Keycloak)
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=bazionweb
KEYCLOAK_CLIENT_ID=bazionweb-api
KEYCLOAK_CLIENT_SECRET=<from-keycloak-admin>

# IntaSend Payments
INTASEND_ENVIRONMENT=sandbox
INTASEND_PUBLISHABLE_KEY=ISPubKey_...
INTASEND_SECRET_KEY=ISSecretKey_...

# Wise Corporate Billing
WISE_ENVIRONMENT=sandbox
WISE_API_TOKEN=<wise-api-token>
WISE_PROFILE_ID=<wise-profile-id>
WISE_WEBHOOK_SECRET=whsec_...

# App
FRONTEND_URL=http://localhost:3000
```

See [`.env.example`](.env.example) for the full annotated list.

---

## CI/CD Pipeline

9-stage automated pipeline runs on every push to `develop`, `staging`, and `main`:

| Stage | Description |
|-------|-------------|
| **1. Lint & Type-check** | ESLint + `tsc --noEmit` on API and Web |
| **2. Unit Tests** | Jest with coverage thresholds (API + Web) |
| **3. Docker Build** | Build and push images to GHCR |
| **4. Security Scan** | Trivy container scan + `npm audit` |
| **5. Staging Deploy** | Auto-deploy to staging environment |
| **6. E2E Tests** | Playwright browser tests against staging |
| **7. Lighthouse CI** | Performance gate (score ≥ 90 required) |
| **8. Production Deploy** | Manual approval gate on `main` branch |
| **9. Post-Deploy Verify** | Health checks + Slack notification |

### Hosting without a VPS (Render + Neon, free tier)

`render.yaml` at the repo root deploys web + api (Docker) to Render with
Neon Postgres — no VPS needed:

1. Create a free project at `console.neon.tech` and copy the **pooled**
   (`-pooler`) and **direct** connection strings.
2. Render Dashboard → New → Blueprint → this repo; paste the two strings
   (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) plus other secrets when prompted.
3. After the first deploy, set web's `NEXT_PUBLIC_API_URL` to the real api URL.
4. Add repo secrets `DATABASE_URL` / `DATABASE_URL_UNPOOLED` so CI runs
   Prisma migrations; optionally add `WEB_URL` / `API_URL` for the
   business-hours keep-awake pings and `RENDER_DEPLOY_HOOK_*` for explicit
   deploys (auto-deploy covers it otherwise).

Why Neon over Render Postgres: Render's free database expires 30 days after
creation with no backups; Neon's free plan is permanent (0.5 GB, 100 CU-h/mo,
scale-to-zero). Best practice applied in code: pooled URL for runtime queries,
direct URL for migrations (`directUrl` in all Prisma schemas). Free web
services sleep after ~15 min idle — the `keep-awake` workflow warms them
08:00–18:59 EAT to stay inside the 750 free-instance-hours/month quota.

---

## Database Schema

**15 models** across 5 domains (Prisma v5, PostgreSQL):

| Domain | Models |
|--------|--------|
| **Auth** | `User` |
| **Business** | `Client`, `Plan`, `Subscription` |
| **Billing** | `Invoice`, `PaymentLog`, `WiseReceivingAccount` |
| **Projects** | `Project`, `ProjectTask` |
| **Operations** | `Ticket`, `TicketComment`, `HostingAccount`, `Backup`, `AuditLog`, `Notification` |

All tables: UUID primary keys · `created_at/updated_at` timestamps · soft deletes (`deleted_at`) · fully indexed FK columns.

---

## Key URLs

### Development

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3000 |
| Checkout Page | http://localhost:3000/checkout |
| API (NestJS) | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Prisma Studio | http://localhost:5555 |
| MailHog | http://localhost:8025 |
| Adminer | http://localhost:8080 |

### Production

| Service | URL |
|---------|-----|
| Marketing Site | https://bazionweb.com |
| Client Portal | https://bazionweb.com/portal |
| Checkout | https://bazionweb.com/checkout |
| Admin | https://bazionweb.com/admin |
| API | https://api.bazionweb.com/api/v1 |
| CMS (Strapi) | https://cms.bazionweb.com |
| Auth (Keycloak) | https://auth.bazionweb.com |
| Status | https://status.bazionweb.com |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

Quick rules:
1. Branch from `develop` — never commit directly to `main`
2. Follow TypeScript strict mode patterns
3. Write Jest tests for all new service methods
4. Ensure `npm run lint` and `npm run build` pass before opening a PR
5. PRs require 1 approving review + passing CI

---

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

Do **not** open a public GitHub Issue for security reports.

---

## License

Proprietary — © 2025–2026 BazionWeb Technologies Ltd. All rights reserved.

Unauthorized reproduction, distribution, or use of this software without express written permission is strictly prohibited.
