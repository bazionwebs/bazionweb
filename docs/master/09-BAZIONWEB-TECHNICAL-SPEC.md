# BazionWeb Technical Architecture & Engineering Specification
## Full-Stack Architecture, Monorepo Layout, Security, Telemetry & Performance

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**System Status:** Canonical Engineering Architecture  
**Repository Structure:** npm Workspaces Monorepo (`apps/web`, `apps/api`)  

---

## 1. System Architecture Topology

The BazionWeb platform is engineered as a secure, containerized multi-tier distributed system:

```
                            ┌─────────────────────────────────────────┐
                            │           CLOUDFLARE EDGE                │
                            │  DNS · Edge Caching · WAF · SSL (TLS 1.3)│
                            └────────────────────┬────────────────────┘
                                                 │ HTTPS / WSS
                            ┌────────────────────▼────────────────────┐
                            │        NGINX PROXY MANAGER (NPM)         │
                            │  TLS Termination · HTTP Rate Limiting   │
                            │  Reverse Proxy & Upstream Load Balancing│
                            └─────────┬──────────┬──────────┬─────────┘
                                      │          │          │
                 ┌────────────────────▼──┐ ┌─────▼────┐ ┌───▼──────────────┐
                 │  Next.js 14 (Web App) │ │ NestJS   │ │ Keycloak 23      │
                 │  Port :3000           │ │ API      │ │ Identity Server  │
                 │  • Marketing Front    │ │ Port:4000│ │ Port:8080        │
                 │  • Quote Configurator │ │ REST v1  │ │ OIDC / JWT RBAC  │
                 │  • Client Portal      │ └─────┬────┘ └──────────────────┘
                 └───────────────────────┘       │
                                    ┌────────────┼─────────────┐
                                    │            │             │
                         ┌──────────▼──┐   ┌─────▼──────┐ ┌────▼───────────┐
                         │ PostgreSQL  │   │  Redis 7   │ │ Strapi 5 CMS   │
                         │ 16 Primary  │   │  Session & │ │ Headless Blog  │
                         │ Port :5432  │   │  RateLimit │ │ Port :1337     │
                         └─────────────┘   └────────────┘ └────────────────┘
```

---

## 2. Monorepo Structure & Technology Stack

```
bazionweb/
├── apps/
│   ├── web/                     # Next.js 14 App Router Frontend
│   │   ├── src/
│   │   │   ├── app/             # (public), portal, admin, api routes
│   │   │   ├── components/      # UI, layout, pricing, forms, SEO
│   │   │   ├── hooks/           # useMarketPreference, useAnalytics
│   │   │   ├── lib/             # pricingData, api client, utils
│   │   │   └── store/           # Zustand client state
│   │   ├── tailwind.config.ts   # Design tokens & typography scale
│   │   └── package.json
│   └── api/                     # NestJS 10 REST Backend
│       ├── src/
│       │   ├── modules/         # auth, quotes, tickets, billing, clients
│       │   ├── common/          # guards, interceptors, filters, decorators
│       │   └── prisma/          # Prisma database client
│       ├── prisma.schema.prisma # Canonical PostgreSQL Schema
│       └── package.json
├── docs/                        # Architecture & Master Documentation
└── package.json                 # Monorepo root workspaces config
```

### Stack Details:
* **Frontend Framework:** Next.js 14 (React 18, TypeScript 5.5, Tailwind CSS 3.4).
* **State Management:** Zustand for client-side state (active market preference, quote builder selections).
* **Forms & Validation:** React Hook Form with Zod schemas for strict client and server validation.
* **Backend Framework:** NestJS 10 (Node.js LTS, TypeScript) with modular REST controllers.
* **ORM & Database:** Prisma ORM 5.22 with PostgreSQL 16 (hosted on Docker / Render / Neon).
* **Authentication:** Keycloak 23 OpenID Connect (OIDC) issuing RS256 signed JWTs with Role-Based Access Control (`SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `CLIENT`).

---

## 3. Digital Project Configurator & Lead Pipeline Engine

The interactive configurator (`/quote`) is powered by a shared TypeScript business logic engine:

```typescript
// Calculation Pipeline Flow:
// 1. Base Package Cost (by Market: KES vs USD)
// 2. Add-on Line Items Aggregation
// 3. Expedited Rush Surcharge Multiplier (None: 1.0, Priority: 1.25, Rush: 1.50)
// 4. Delivery Working Days Calculation
// 5. Zod Lead Schema Validation & Dispatch to NestJS /api/v1/quotes
```

### Lead Pipeline Dispatch Protocol:
When a prospect submits their configuration:
1. **Validation:** Server verifies schema, phone format, and spam honeypots.
2. **Persistence:** Quote record saved to PostgreSQL (`Quote` model with unique reference `BWQ-XXXXXX`).
3. **Notification Hooks:**
   * Automated branded email confirmation dispatched to prospect with itemized PDF quote summary.
   * Priority notification dispatched to BazionWeb operations via Telegram Bot / Zammad ticket.
   * Lead record synchronized to internal sales CRM pipeline.

---

## 4. Security Architecture & Threat Defense

BazionWeb implements **Defense in Depth**:

### 4.1 Application Security
* **HTTP Security Headers:** Injected via `next.config.mjs` / Nginx:
  * `Content-Security-Policy (CSP)`: Strict script-src and connect-src policies.
  * `Strict-Transport-Security (HSTS)`: `max-age=63072000; includeSubDomains; preload`.
  * `X-Frame-Options`: `DENY` (prevents clickjacking).
  * `X-Content-Type-Options`: `nosniff`.
  * `Referrer-Policy`: `strict-origin-when-cross-origin`.
* **Input Validation & Sanitization:** All inbound API requests validated using NestJS `ValidationPipe` with `class-validator` and `class-transformer` with `whitelist: true, forbidNonWhitelisted: true`.
* **Rate Limiting:** Redis-backed sliding window rate limiter (`@nestjs/throttler`):
  * Public APIs (Quotes/Contact): Max 5 requests per minute per IP.
  * Authenticated Portal APIs: Max 120 requests per minute per token.

### 4.2 Edge & Infrastructure Defense
* **Cloudflare Edge WAF:** Managed OWASP rule set, DDoS mitigation, and Cloudflare Turnstile bot verification on all forms.
* **Database Isolation:** PostgreSQL is housed on an internal Docker network (`bazionweb-internal`) with no public IP or external port binding.
* **Secrets Management:** Environment variables managed via Render / Docker secrets; no credentials committed to git (`.env.example` audited).

---

## 5. Performance Engineering & Core Web Vitals Targets

BazionWeb sites are engineered to achieve green performance metrics on real-world mobile connections:

| Metric | Target Benchmark | Architectural Implementation |
| :--- | :--- | :--- |
| **LCP** (Largest Contentful Paint) | **< 1.8 seconds** | Next.js Server Components, self-hosted fonts (`next/font`), preloaded hero assets, AVIF/WebP image optimization. |
| **INP** (Interaction to Next Paint) | **< 100 milliseconds** | Lightweight client components, debounce on search inputs, avoiding heavy third-party tracking scripts. |
| **CLS** (Cumulative Layout Shift) | **< 0.02** | Explicit width/height attributes on all media, font display `swap` with size-adjust fallbacks, zero layout pop-in. |
| **TTFB** (Time to First Byte) | **< 250 milliseconds** | Cloudflare Edge caching for static pages, ISR (Incremental Static Regeneration) for blogs and case studies. |

---

## 6. Telemetry & Conversion Analytics Taxonomy

All user interactions emit privacy-respecting telemetry events via a custom lightweight analytics wrapper:

```typescript
export type BazionEvent =
  | { name: 'market_switched'; properties: { from: Market; to: Market } }
  | { name: 'quote_configurator_started'; properties: { initialCategory: string } }
  | { name: 'quote_addon_toggled'; properties: { addonId: string; selected: boolean } }
  | { name: 'quote_submitted'; properties: { quoteId: string; totalAmount: number; currency: string } }
  | { name: 'cta_clicked'; properties: { label: string; location: string } }
  | { name: 'whatsapp_opened'; properties: { sourcePage: string } }
  | { name: 'sla_document_viewed'; properties: { plan: string } };
```
