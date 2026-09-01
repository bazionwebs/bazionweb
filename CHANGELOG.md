# Changelog

All notable changes to BazionWeb are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Three-rail billing system: IntaSend (M-Pesa + Card) and Wise (Corporate Wire)
- `SubscriptionCheckout` React component with M-Pesa, Card, and Invoice tabs
- `/checkout` public page integrated with billing API
- `BillingService`, `IntaSendService`, `WiseService` in NestJS API
- `WebhooksController` with HMAC-SHA256 verification and idempotency deduplication
- `PaymentLog` and `WiseReceivingAccount` Prisma models
- GitHub community health files: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, PR template, issue templates
- Lighthouse CI configuration (`.lighthouserc.json`)
- Comprehensive `.env.example` with all required variables annotated

### Changed
- Updated `Subscription` and `Invoice` Prisma models with billing relations
- Updated CI/CD workflow to use conditional `npm ci` / `npm install` fallback
- Updated README with correct repository URL, billing system docs, and updated badge URLs
- Updated `/pricing` page CTAs to link to `/checkout`

### Fixed
- CI error: `npm ci` failing when `apps/web/package-lock.json` was missing

---

## [1.0.0] — 2026-09-01

### Added
- Initial platform release
- Next.js 14 marketing site with 7 public pages: Home, Services, Pricing, About, Contact, Portal, Checkout
- NestJS 10 REST API v1 with Swagger documentation at `/api/docs`
- Prisma 5 schema with 15 models across Auth, Business, Billing, Projects, and Operations domains
- PostgreSQL 16 + Redis 7 infrastructure via Docker Compose
- Keycloak 23 OIDC/JWT authentication (MFA-ready)
- Strapi 5 CMS integration
- 9-stage GitHub Actions CI/CD pipeline (Lint → Unit Tests → Build → Security Scan → Staging → E2E → Lighthouse → Production → Smoke Tests)
- Trivy container security scanning
- Nginx reverse proxy configuration
- Loki + Grafana monitoring stack
- Automated backup scripts (Restic + Backblaze B2)
- Uptime Kuma status page integration
- Zammad ticketing system integration
- Four subscription tiers: Starter ($49), Growth ($99), Business ($199), Enterprise (Custom)
- Architecture documentation, SOPs, and runbooks

[Unreleased]: https://github.com/bazionwebsites/bazionweb/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/bazionwebsites/bazionweb/releases/tag/v1.0.0
