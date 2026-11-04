# Comprehensive Codebase & Infrastructure Audit Report (Requirement R2)

**Document ID:** BAZ-DOC-2026-M1-AUDIT  
**Repository:** `d:\bazionweb`  
**Author:** worker_transition_1 (Exploration & Codebase Audit)  
**Date:** November 3, 2026  
**Status:** Complete & Authoritative  
**Scope:** Architecture, Monorepo Structure, Frontend Tier, Backend & APIs Tier, Database & ORM Tier, Authentication Tier, Storage Tier, Payments Tier, Background Tasks & Crons, Proprietary Cloud Dependencies & Vercel Limitations, Operational Constraints, and Self-Hosted Docker / Dokploy Migration Plan.

---

## Executive Summary

BazionWeb is a modern digital agency and managed website hosting platform structured as an **npm monorepo** consisting of two core workspaces:
1. `@bazionweb/web` (`apps/web`): A public-facing web application, quote calculator, and client portal built on **Next.js 14.2.0 (App Router)** and **React 18.3.0**.
2. `@bazionweb/api` (`apps/api`): A robust REST API backend built on **NestJS 10.3.0 (Express platform)**, **Prisma ORM 5.22.0**, and **PostgreSQL 16**.

The test suites for both workspaces were executed and achieved **100% pass rates with zero failures**:
- `@bazionweb/api`: 20 test suites, 249 tests passed.
- `@bazionweb/web`: 23 test suites, 280 tests passed.
- **Combined:** 43 test suites, 529 automated tests passing.

### Critical Operational & Compliance Findings
1. **Active Vercel Hobby ToS Violation:** The current deployment environment uses a Vercel Hobby plan (verified via `.env.local:2` decoded JWT token: `"plan": "hobby"`). Section 2 of Vercel Terms of Service strictly prohibits commercial usage for Hobby accounts. Operating a revenue-generating commercial agency and hosting platform on Vercel Hobby places BazionWeb at immediate risk of account suspension and abrupt service termination.
2. **Serverless Architectural Mismatch for In-Process Crons:** The backend employs `@nestjs/schedule` for vital operational jobs—including daily SSL expiry verification, daily backup triggers, monthly automated subscription billing, and critically, a **10-minute automated payment reconciliation sweep**. On serverless platforms like Vercel, ephemeral execution containers freeze or terminate between incoming HTTP requests, causing scheduled in-process cron jobs to fail silently. In a self-hosted Docker / Dokploy environment, NestJS runs as a persistent daemon process, enabling native, continuous 24/7 background job execution.
3. **Vercel Services Proprietary Coupling:** The root `vercel.json` utilizes experimental Vercel Services multi-project orchestration (`services.api` + `services.web` with service bindings and rewrites). In self-hosted Docker / Dokploy, this proprietary routing is seamlessly replaced by Dokploy's built-in **Traefik v3** reverse proxy routing `/api/v1/*` to `bazionweb-api:4000` and `/*` to `bazionweb-web:3000`, with internal container-to-container calls routed over Docker's bridge network via `API_INTERNAL_URL=http://api:4000`.

---

## 1. Architecture & Monorepo Structure

### 1.1 Directory Hierarchy
The repository is organized as an npm workspace monorepo:
```
d:\bazionweb\
├── apps/
│   ├── api/                          # Backend NestJS REST API
│   │   ├── prisma/schema.prisma      # Mirrored Prisma schema
│   │   ├── src/                      # NestJS application modules
│   │   │   ├── common/               # Guards, interceptors, filters, decorators
│   │   │   ├── modules/              # Domain modules (auth, billing, hosting, etc.)
│   │   │   └── main.ts               # Application entrypoint & middleware setup
│   │   ├── Dockerfile                # Multi-stage API Dockerfile (node:22-alpine)
│   │   ├── package.json              # @bazionweb/api package manifest
│   │   └── tsconfig.json             # Backend TypeScript configuration
│   └── web/                          # Frontend Next.js Web App
│       ├── src/app/                  # Next.js App Router (public, portal, admin, api)
│       ├── src/components/           # Reusable UI & Layout components
│       ├── src/lib/                  # Client utilities, pricing engine, API connectors
│       ├── src/store/                # Zustand client state stores
│       ├── src/styles/               # Global CSS & Tailwind styles
│       ├── public/                   # Static assets, logos, icons
│       ├── Dockerfile                # Standalone Next.js Dockerfile
│       ├── next.config.js            # Standalone output, CSP, rewrites
│       ├── package.json              # @bazionweb/web package manifest
│       └── tsconfig.json             # Frontend TypeScript configuration
├── docs/                             # Authoritative technical documentation
├── infrastructure/
│   ├── backups/                      # Restic and shell backup scripts (Backblaze B2)
│   ├── docker/                       # Docker Compose definitions (dev, staging, prod)
│   ├── monitoring/                   # Grafana provisioning, Loki configs
│   └── nginx/                        # Reference Nginx reverse proxy configs
├── prisma/
│   ├── migrations/                   # 10 applied migration directories
│   ├── schema.prisma                 # Authoritative Prisma schema v2.0
│   └── seed.ts                       # Database seeding script
├── scripts/                          # Administration and deployment scripts
├── package.json                      # Monorepo root workspace manifest
├── vercel.json                       # Vercel Services routing specification
└── .env.example                      # Master environment variable template
```

### 1.2 Root Configuration Files
- **`package.json` (`d:\bazionweb\package.json:1-46`):**
  - Name: `"bazionweb-monorepo"`, version: `"1.0.0"`, `"private": true`.
  - Workspaces: `["apps/*"]`.
  - Orchestration scripts:
    - `"dev"`: Runs `concurrently` starting `@bazionweb/api` and `@bazionweb/web`.
    - `"build"`: `npm run prisma:generate && npm run build --workspaces`.
    - `"prisma:generate"`: `npx --yes prisma generate --schema=prisma/schema.prisma`.
    - `"prisma:push"`: `npx --yes prisma db push --schema=prisma/schema.prisma`.
    - `"db:up"`: `docker compose -f infrastructure/docker/docker-compose.dev.yml up -d db`.
  - Root dependencies: `@prisma/client: 5.22.0`, `prisma: 5.22.0`, `@nestjs/axios: ^3.1.3`, `@nestjs/terminus: ^10.3.0`, `@vercel/analytics: ^2.0.1`, `jsonwebtoken: ^9.0.3`, `jwks-rsa: ^3.2.2`.
  - Dependency overrides: Fixed security overrides for `postcss (8.5.31)`, `multer (2.4.0)`, `qs (6.16.1)`, `body-parser (1.20.8)`, `js-yaml (4.3.2)`, and `lodash (4.18.1)`.

- **`vercel.json` (`d:\bazionweb\vercel.json:1-33`):**
  - Schema: `https://openapi.vercel.sh/vercel.json`.
  - Defines two coordinated services:
    1. `services.api`: Root `apps/api`, framework `nestjs`, build command `npm run prisma:generate && npm run build`.
    2. `services.web`: Root `apps/web`, framework `nextjs`, binds to service `api` injecting `API_INTERNAL_URL`.
  - Rewrites:
    - `/api/v1/(.*)` → Destination `{ "service": "api" }`.
    - `/(.*)` → Destination `{ "service": "web" }`.

---

## 2. Detailed Codebase Audit Across Tiers

### 2.1 Frontend Tier (`apps/web`)

| Attribute | Implementation Details | Evidence Location |
|---|---|---|
| **Framework & Version** | Next.js `14.2.0`, React `18.3.0`, React DOM `18.3.0` | `apps/web/package.json:25, 28-29` |
| **Router Architecture** | Next.js App Router (`src/app/`) | `apps/web/src/app` |
| **Route Segments** | `(public)` (marketing), `portal` (client portal), `admin` (superadmin dashboard), `api` (BFF & relays) | `apps/web/src/app/(public)`, `portal`, `admin`, `api` |
| **Build Output Mode** | `output: 'standalone'` (production node server with automated file tracing) | `apps/web/next.config.js:64` |
| **Rendering Models** | Dynamic SSR on authenticated/data routes; Static SSG on marketing pages; Client Components (`'use client'`) for modals, forms, and charts | `apps/web/src/app/(public)/quote/page.tsx`, `apps/web/src/app/portal/page.tsx` |
| **State Management** | Zustand `5.0.16` with `sessionStorage` persistence; TanStack React Query `5.104.5` | `apps/web/src/store/auth.store.ts:1-118`, `apps/web/package.json:17, 35` |
| **Styling & Design System** | Tailwind CSS `3.4.0` with `@tailwindcss/typography` | `apps/web/tailwind.config.js:1-80` |
| **Font Optimization** | Render-blocking `@import url('https://fonts.googleapis.com/css2?...')` in `globals.css` (recommend migrating to `next/font/google` for zero layout shift) | `apps/web/src/styles/globals.css:1` |
| **Image Optimization** | `next/image` with formats `['image/avif', 'image/webp']`; remote patterns allow `cms.bazionweb.com` and `images.unsplash.com` | `apps/web/next.config.js:71-77` |
| **Security Headers** | Comprehensive Helmet-equivalent headers: HSTS (2 years), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Permissions-Policy, strict Content-Security-Policy | `apps/web/next.config.js:8-60, 78-95` |
| **Public Environment Variables** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`, `NEXT_PUBLIC_TAWK_PROPERTY_ID`, `NEXT_PUBLIC_TAWK_WIDGET_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | `apps/web/src/app/layout.tsx`, `apps/web/src/lib/api-base.ts`, `.env.example:58-85` |

#### Next.js Route Handlers (`apps/web/src/app/api/*`)
Next.js API route handlers act primarily as a **Backend-for-Frontend (BFF)** and proxy relay to NestJS:
1. `api/paystack/webhook/route.ts`: Pass-through relay for Paystack webhooks. Verifies HMAC-SHA512 signature on incoming raw body bytes and forwards identical bytes and signature headers upstream to NestJS (`POST /api/v1/webhooks/paystack`).
2. `api/paystack/verify/route.ts`: Rate-limited endpoint querying NestJS `/api/v1/invoices/confirm/paystack` and rendering printable HTML payment receipts.
3. `api/paystack/initialize/route.ts`: Explicitly returns `HTTP 410 Gone` (`ENDPOINT_MIGRATED`), notifying callers that invoice-backed checkout has migrated entirely to the NestJS API.
4. `api/quote/route.ts`: Authoritative quote generation. First attempts to query NestJS `/api/v1/pricing/quote` (database SSOT); if unavailable, gracefully falls back to local pricing calculation using `marketEngine.ts` and `priceBooks.ts`, then triggers quote summary emails via Resend.
5. `api/leads/route.ts`: Captures sales leads, posts to NestJS `/api/v1/quotes/submit`, dispatches transactional notification emails, and requires bearer token authorization for GET queries to prevent customer PII exposure.
6. `api/auth/magic-link/route.ts` & `api/auth/claim-link/route.ts`: Intermediaries requesting one-time tokens from NestJS `/api/v1/auth/magic-link` and `/api/v1/auth/claim-link` (authenticated via `INTERNAL_DISPATCH_SECRET`), then dispatching branded access emails.
7. `api/health/route.ts` & `api/v1/health/route.ts`: Healthcheck endpoints returning HTTP 200 with service metadata.

---

### 2.2 Backend & API Tier (`apps/api`)

| Attribute | Implementation Details | Evidence Location |
|---|---|---|
| **Framework & Version** | NestJS `10.3.0` on `@nestjs/platform-express`, TypeScript `5.5.0` | `apps/api/package.json:21, 23, 25, 58` |
| **API Entry Point** | `apps/api/src/main.ts` listening on `PORT` (default 4000) | `apps/api/src/main.ts:118-121` |
| **Global Prefix & URI Versioning** | Prefix: `api`, Versioning: URI type (`/api/v1/*`) | `apps/api/src/main.ts:74-77` |
| **Request Validation** | `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` | `apps/api/src/main.ts:79-86` |
| **Webhook Raw Body Handling** | NestFactory initialized with `rawBody: true` to preserve exact incoming bytes for HMAC signature verification | `apps/api/src/main.ts:14-17` |
| **Rate Limiting** | `ThrottlerModule` with global `ThrottlerGuard` (`RATE_LIMIT_TTL=60s`, `RATE_LIMIT_MAX=100`) plus endpoint-specific overrides (`@Throttle`) | `apps/api/src/app.module.ts:36-47, 73` |
| **Security Middleware** | `helmet`, `x-powered-by` disabled, reverse proxy IP trust (`trust proxy: 1`), strict CORS whitelist with credentials support | `apps/api/src/main.ts:23-72` |
| **Interceptors & Filters** | Global `HttpExceptionFilter`, `TransformInterceptor` (response enveloping), and `AuditInterceptor` (logging mutations to `AuditLog`) | `apps/api/src/main.ts:89-93` |
| **OpenAPI / Swagger** | `SwaggerModule` enabled on `/api/docs` in non-production environments | `apps/api/src/main.ts:96-116` |
| **Health & Telemetry** | `@nestjs/terminus` healthcheck on `/api/v1/health` validating PostgreSQL connection and memory thresholds | `apps/api/src/modules/health/health.controller.ts:1-35` |

#### NestJS Module Architecture (`apps/api/src/modules/*`)
- **`AuthModule`:** Dual-provider authentication (Local scrypt/JWT + Keycloak OIDC).
- **`BillingModule`:** Comprehensive multi-rail payment processing (Paystack, Safaricom Daraja M-PESA, Wise), invoice generation, and recurring billing.
- **`ClientsModule`:** Client profile, business details, tax PINs, and plan assignments.
- **`HostingModule`:** Hosting account management, domain records, daily backup scheduling, daily SSL certificate verification with anti-SSRF protections (`isPrivateOrReservedIp`), and Dokploy PaaS container provisioning.
- **`ProjectsModule`:** Client project lifecycle, milestone completion, and task tracking.
- **`TicketsModule`:** Customer support ticketing, SLA tracking, and internal/public comments.
- **`ReportsModule`:** Automated monthly performance, SEO, security, and uptime reporting.
- **`QuotesModule`:** Public proposal capture, lead ingestion, and pricing calculation.
- **`PricingModule`:** Multi-market commercial pricing engine SSOT (Currencies, Markets, TaxRules, PriceBooks, Prices, MarketAdjustments, Proposals).
- **`VaultModule`:** Client credential vault encrypting sensitive access keys using AES-256-GCM.
- **`DiagnosticsModule`:** Superadmin telemetry, gateway webhook auditing, and cluster health monitoring.

---

### 2.3 Database & ORM Tier (`prisma/schema.prisma`)

| Attribute | Specification | Evidence Location |
|---|---|---|
| **ORM & Generator** | Prisma `5.22.0`, `prisma-client-js` | `prisma/schema.prisma:5-8` |
| **Binary Targets** | `["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]` (Fully supports Alpine Linux containers) | `prisma/schema.prisma:7` |
| **Database Engine** | PostgreSQL 16 (Neon Serverless in cloud; PostgreSQL Alpine in Docker) | `prisma/schema.prisma:10-19` |
| **Connection Pooling Strategy** | Two-tier connection strategy: Pooled URL (`DATABASE_URL`, using Neon PgBouncer `-pooler` host) for runtime queries; Direct URL (`DATABASE_URL_UNPOOLED` via `directUrl`) for `prisma migrate` and schema validation | `prisma/schema.prisma:12, 18` |
| **Migration Status** | 10 sequentially applied migrations in `prisma/migrations/`, tracked by `migration_lock.toml` | `prisma/migrations/` |
| **Primary Keys & Conventions** | UUID primary keys across all models; standard `created_at` and `updated_at` timestamps; soft-deletion pattern (`deleted_at`) | `prisma/schema.prisma:1-4, 181-195` |
| **Total Models & Enums** | 27 Models, 15 Enums (834 lines) | `prisma/schema.prisma:1-834` |

#### Key Database Models Summary
1. **Core Identity:** `User` (UUID, role, password hash, MFA flag), `RefreshToken` (rotating SHA-256 token hash).
2. **Customer & Subscriptions:** `Client` (business details, tax PIN, plan), `Plan` (tiers, SLAs, USD & KES pricing), `Subscription` (cycle, status, renewal dates, dunning counts), `Invoice` (amounts, line items, status), `PaymentLog` (idempotency key, provider ref, raw payload).
3. **Hosting & Operations:** `HostingAccount` (domain, server, IP, PHP version, SSL expiry), `Backup` (type, status, size, storage path, checksum, verification timestamp), `VaultSecret` (AES-256-GCM encrypted credentials, IV, auth tag, masked hint).
4. **CRM & Support:** `Project`, `ProjectTask`, `Ticket`, `TicketComment`, `Notification`, `AuditLog`.
5. **Commercial Multi-Market Pricing Engine (SSOT):** `Currency`, `Market` (KE, GLOBAL, EA), `TaxRule` (KRA 16% VAT, zero-rate), `PriceBook` (versioned catalogs), `Price` (product rates), `MarketAdjustment` (discounts/surcharges), `Proposal` (locked customer quotes), `Lead`, `PricingAuditLog`.

---

### 2.4 Authentication Tier

| Component | Implementation Detail | Reference |
|---|---|---|
| **Primary Provider** | `AUTH_PROVIDER=local` (Default, zero external infrastructure required) | `apps/api/src/modules/auth/auth.service.ts:113-117` |
| **Password Hashing** | Node native `crypto.scrypt` (`scrypt$16384$8$1$saltHex$keyHex`) with constant-cost dummy verification preventing timing-based user enumeration | `apps/api/src/modules/auth/auth.service.ts:27-66` |
| **Access Tokens** | HS256 JWT signed with `JWT_SECRET` (enforcing min 32 chars), 15-minute expiry (`JWT_EXPIRY=15m`) | `apps/api/src/modules/auth/auth.service.ts:136-146` |
| **Refresh Tokens** | Cryptographically random hex strings, stored as SHA-256 hashes in `RefreshToken` table. Rotates on every refresh (`JWT_REFRESH_EXPIRY=7d`), atomic single-use invalidation | `apps/api/src/modules/auth/auth.service.ts:173-200` |
| **Role Hierarchy** | Role inheritance: `SUPER_ADMIN` > `ADMIN` > `SUPPORT` > `CLIENT` | `apps/api/src/modules/auth/auth.service.ts:70-79` |
| **Magic Links & Claim Accounts** | Server-minted single-use DB tokens (`magic_*`, `claim_*`), 15m TTL. BFF mailer relay authenticated via `INTERNAL_DISPATCH_SECRET` | `apps/api/src/modules/auth/auth.service.ts:124-134` |
| **Client Session Storage** | Frontend Zustand store (`apps/web/src/store/auth.store.ts`) persisted to browser `sessionStorage` (`bazionweb-auth`) | `apps/web/src/store/auth.store.ts:91-106` |
| **Token Refresh Lifecycle** | Axios response interceptor silently calls `/auth/refresh` upon receiving HTTP 401 on protected routes before redirecting to login | `apps/web/src/lib/api.ts:31-62` |
| **Optional Provider** | Keycloak OIDC (`AUTH_PROVIDER=keycloak` with `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`) | `apps/api/src/modules/auth/auth.service.ts:113-117` |

---

### 2.5 Storage Tier

1. **Object & Backup Storage:**
   - Provider: **Backblaze B2** (S3-compatible API).
   - Usage: Automated encrypted database dumps and Docker volume snapshots using **Restic** (`restic-backup.sh:24-39`) and AWS CLI S3 endpoint (`daily-db-backup.sh:61`).
   - Configuration variables: `BACKBLAZE_BUCKET`, `BACKBLAZE_REGION`, `BACKBLAZE_ENDPOINT` (`https://s3.us-west-004.backblazeb2.com`), `BACKBLAZE_KEY_ID`, `BACKBLAZE_APP_KEY`.
2. **CMS Asset Storage:**
   - Strapi local uploads persistent volume (`strapi_uploads` mounted at `/opt/app/public/uploads` in `docker-compose.yml:209`).
3. **Application File Handling:**
   - Neither Next.js nor NestJS directly executes local filesystem disk writes for user data. Neither `@vercel/blob` nor AWS S3 SDK is bundled in application runtime dependencies, preventing proprietary cloud storage lock-in.

---

### 2.6 Payments & Billing Tier

BazionWeb implements a multi-rail billing architecture designed for East Africa and international commerce:

```
                                  ┌────────────────────────┐
                                  │   Customer Checkout    │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          [Kenya / East Africa (KES)]                      [International (USD/EUR)]
                      │                                               │
             ┌────────┴────────┐                             ┌────────┴────────┐
             ▼                 ▼                             ▼                 ▼
     Safaricom Daraja       Paystack                      Paystack            Wise
     (M-Pesa STK Push)   (M-Pesa / Cards)              (Credit Cards)   (B2B Wire / Bank)
```

1. **Safaricom Daraja (M-PESA) Integration (`apps/api/src/modules/billing/daraja.service.ts`):**
   - Endpoints: `https://api.safaricom.co.ke` (production) vs `https://sandbox.safaricom.co.ke` (sandbox).
   - Functions:
     - `getAccessToken()`: OAuth client credentials flow with automatic in-memory token caching.
     - `formatPhoneNumber()`: Strict Kenyan phone formatting to `254[17]\d{8}` standard.
     - `generatePassword()`: Base64-encoded `ShortCode + PassKey + Timestamp(YYYYMMDDHHmmss)`.
     - `initiateStkPush()`: Triggers instant M-Pesa STK Push PIN prompt to handset (`/mpesa/stkpush/v1/processrequest`). Single transaction cap: KES 150,000.
     - `queryStkStatus()`: Direct status query (`/mpesa/stkpushquery/v1/query`) for verification.
   - Webhook Verification (`webhooks.controller.ts:93-151`): Confirms incoming callback token (`DARAJA_WEBHOOK_SECRET`) and actively validates finality via upstream STK Query API before invoice settlement.

2. **Paystack Integration (`apps/api/src/modules/billing/paystack.service.ts`):**
   - Endpoints: `https://api.paystack.co`.
   - Functions:
     - `initializeTransaction()`: Server-side card checkout returning hosted authorization URL.
     - `chargeMpesaStk()`: Direct M-Pesa mobile money charge.
     - `verifyTransaction()`: Server-to-server transaction query.
   - Webhook Security: HMAC-SHA512 verification over exact raw request body (`x-paystack-signature` header compared against `PAYSTACK_WEBHOOK_SECRET` using `crypto.timingSafeEqual`).
   - Settlement: Handled by `PaymentSettlementService.settlePaystackCharge()` writing to `PaymentLog` with unique idempotency keys (`PAYSTACK_{reference}`).

3. **Wise & Bank Transfers:**
   - Managed via `WiseReceivingAccount` table (`prisma/schema.prisma:408-430`) generating payment references and invoice IBAN/SWIFT instructions for manual B2B international wire reconciliation.

4. **Currency & Tax Engine:**
   - Multi-market dynamic rates supporting KES and USD.
   - Kenya 16% standard KRA VAT calculated via `TaxRule` and `Market` models.

---

### 2.7 Background Jobs & Scheduled Tasks Tier

All scheduled tasks in the application layer are managed via `@nestjs/schedule` (`ScheduleModule.forRoot()`):

| Job Name | Cron Expression | Schedule | Module | Function & Purpose |
|---|---|---|---|---|
| `auto-invoice-generation` | `5 0 1 * *` | 1st of month at 00:05 UTC | `BillingService:1388` | Generates recurring monthly invoices for active subscriptions |
| `mark-overdue-invoices` | `0 6 * * *` | Daily at 06:00 UTC | `BillingService:1416` | Updates status of unpaid past-due invoices to `OVERDUE`, emitting dunning events |
| `reconcile-pending-payments` | `*/10 * * * *` | Every 10 minutes | `BillingService:1439` | **Vital reconciliation sweep:** Queries Paystack for any `PENDING` payment older than 3 minutes to settle invoices even if webhooks fail |
| `ssl-expiry-check` | `0 4 * * *` | Daily at 04:00 UTC | `HostingService:123` | Performs DNS lookup and TLS handshake for all hosted domains; emits alerts for certs expiring in < 30 days |
| `daily-backup-trigger` | `30 1 * * *` | Daily at 01:30 UTC | `HostingService:159` | Generates pending backup tracking records in database |
| `monthly-report-generation` | `0 5 2 * *` | 2nd of month at 05:00 UTC | `ReportsService:125` | Compiles monthly performance, uptime, and SEO client health reports |

#### Serverless vs Docker Daemon Evaluation
- **Vercel Serverless Reality:** Vercel functions are stateless and spin down when idle. Background timers and in-process schedulers terminate immediately upon request completion. The critical 10-minute payment reconciliation and nightly SSL monitoring jobs **cannot function reliably on Vercel**.
- **Docker / Dokploy Reality:** In Docker, NestJS runs as a persistent container process (`node dist/main`). The `@nestjs/schedule` event loop runs 24/7 with zero external trigger dependencies.

---

## 3. Proprietary Dependencies & Operational Constraints

### 3.1 External Cloud Service Dependencies Inventory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BAZIONWEB CLOUD SERVICES                           │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Service                       │ Function / Purpose                          │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Neon Cloud PostgreSQL         │ Serverless database hosting                 │
│ Resend (HTTP API & SMTP)      │ Transactional email delivery (leads, magic) │
│ Backblaze B2 (S3 API)         │ Encrypted offsite backups (Restic)          │
│ Paystack                      │ Credit card & KES/USD payments              │
│ Safaricom Daraja              │ Lipa Na M-Pesa STK Push payments            │
│ Microsoft Clarity             │ User session replay & heatmap analytics     │
│ Tawk.to                       │ Live chat customer support widget           │
│ Google Analytics / PostHog    │ Site traffic and product analytics          │
│ Sentry                        │ Application error monitoring & alerting     │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### 3.2 Vercel Proprietary Lock-In & Commercial Limitations

1. **Vercel Hobby Commercial Limitation (Violation of ToS):**
   - Evidence: Root `.env.local:2` contains decoded VERCEL_OIDC_TOKEN with `"plan": "hobby"`.
   - Violation: Section 2 of Vercel Terms of Service stipulates that Hobby accounts are strictly for non-commercial personal projects. BazionWeb is a commercial digital agency and hosting business charging clients for services and recurring subscriptions.
   - Risk: Abrupt account suspension, deployment deactivation, and loss of production DNS routing.
2. **Execution Duration Limits:**
   - Vercel Hobby enforces a strict **10-second maximum timeout** on serverless function execution. Complex database reports, PDF generation, or slow Safaricom/Daraja gateway responses risk immediate HTTP 504 Gateway Timeouts.
3. **Vercel Services Multi-Project Rewrites:**
   - Root `vercel.json` couples API and Web via Vercel's proprietary service binding (`API_INTERNAL_URL`).
4. **Vercel Edge Analytics & CSP Coupling:**
   - Frontend layout imports `@vercel/analytics/next` (`apps/web/src/app/layout.tsx:2`).
   - `next.config.js:50, 54` includes explicit CSP allowances for `vercel.live`, `va.vercel-scripts.com`, and `vitals.vercel-insights.com`.
5. **Edge Geo-Headers:**
   - Geo-detection inspects `x-vercel-ip-country`, but already incorporates fallback inspection for `cf-ipcountry` (Cloudflare) and `x-country-code` (Nginx/Traefik).

### 3.3 Operational Constraints & Runtime Environment

- **Node.js Version:**
  - Workspace runtime: Node `v24.19.0`, npm `11.17.0`.
  - Docker containers: `node:20-alpine` LTS for maximum Docker ecosystem stability.
- **Package Manager & Workspaces:**
  - Standard npm workspaces (`npm ci` must be used with locked dependencies).
- **Native Binary Dependencies:**
  - Prisma query engine requires Linux musl and debian binaries (`linux-musl-openssl-3.0.x`, `debian-openssl-3.0.x`) specified in `prisma/schema.prisma:7`.
- **Memory & CPU Thresholds:**
  - Backend Terminus healthcheck explicitly configures memory thresholds:
    - Heap memory threshold: **512 MB** (`apps/api/src/modules/health/health.controller.ts:30`).
    - RSS memory threshold: **1024 MB (1 GB)** (`apps/api/src/modules/health/health.controller.ts:31`).
  - Container resource allocation in Dokploy / Docker Compose must assign minimum 1.5 GB RAM and 1.0 vCPU to `@bazionweb/api` to prevent OOM termination.
- **Port Allocations:**
  - Web: Port `3000`.
  - API: Port `4000`.

---

## 4. Self-Hosted Docker & Dokploy Adaptation Plan

To transition seamlessly from Vercel to a self-hosted Docker / Dokploy platform on Contabo or Hetzner VPS:

```
                                  INTERNET
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    Dokploy Traefik v3 Proxy       │
                   │    (Automatic Let's Encrypt SSL)  │
                   └───────────────┬───────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │ Host: bazionweb.com                     │ Host: api.bazionweb.com
              │ or Path: /*                             │ or Path: /api/v1/*
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │    bazionweb-web      │                 │    bazionweb-api      │
   │    (Next.js:3000)     │──Internal Net──▶│    (NestJS:4000)      │
   │  Standalone Container │                 │  Persistent Daemon    │
   └───────────────────────┘                 └───────────┬───────────┘
                                                         │
                                             ┌───────────┴───────────┐
                                             ▼                       ▼
                                  ┌────────────────────┐  ┌────────────────────┐
                                  │   bazionweb-db     │  │  bazionweb-redis   │
                                  │  (PostgreSQL 16)   │  │    (Redis 7)       │
                                  └────────────────────┘  └────────────────────┘
```

### Key Adaptations Required:
1. **Next.js Standalone Containerization:**
   - Multi-stage Dockerfile leveraging `output: 'standalone'` copying `.next/standalone` and `.next/static`.
   - Strip non-essential build tools (`npm`, `corepack`) from final image, running as unprivileged user `nextjs` (UID 1001).
2. **Reverse Proxy & Domain Routing (Dokploy Traefik):**
   - Configure Traefik routing rules in Dokploy:
     - `bazionweb.com` / `www.bazionweb.com` → `bazionweb-web:3000`.
     - `api.bazionweb.com` OR path `/api/v1/*` → `bazionweb-api:4000`.
   - In Next.js web container, set `API_INTERNAL_URL=http://api:4000` so server-side route handlers make direct internal network calls without traversing external DNS.
3. **Database Migration to Self-Hosted Postgres:**
   - Switch from external Neon PostgreSQL to internal `bazionweb-db` (Postgres 16 Alpine with tuned parameters: `shared_buffers=256MB`, `max_connections=100`).
   - Run `prisma migrate deploy` during deployment lifecycle.
4. **Daemonized Cron Operation:**
   - Allow NestJS `@nestjs/schedule` to handle all 6 cron tasks natively inside the container.
5. **Automated Restic Backup Pipeline:**
   - Maintain the existing `infrastructure/backups/restic-backup.sh` pipeline running via host systemd timer or cron, writing encrypted snapshots to Backblaze B2.

---

## Conclusion
The BazionWeb codebase demonstrates high architectural maturity, robust TypeScript typing, comprehensive test coverage (529 passing tests), and thoughtful separation of concerns between Next.js and NestJS. The primary bottleneck is the fragile operational coupling to Vercel Hobby. Migrating to a self-hosted Docker / Dokploy platform directly resolves commercial licensing risks, unlocks reliable background job scheduling, and establishes a sovereign foundation for multi-tenant customer hosting.

---
*Verified and authoritative documentation by worker_transition_1.*
