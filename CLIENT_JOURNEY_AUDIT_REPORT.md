# End-to-End Client Lifecycle Audit & Gap Analysis Report
**BazionWeb Digital Engineering & Cloud Infrastructure Platform**  
*Requirements R1, R2, R3 Compliance Report*  
**Date**: November 2026 | **Integrity Mode**: Development / Mock Sandbox

---

## Executive Summary

An exhaustive technical and experiential audit of the BazionWeb codebase (`d:\bazionweb`) was conducted across the five core phases of the client engagement lifecycle:
1. **Stage 1: Package Selection** (Services catalog, public store, pricing tiers, feature clarity)
2. **Stage 2: Proposal Generation & Presentation** (Interactive cost estimator, formal scope presentation, deep-link persistence)
3. **Stage 3: Invoicing** (Statement presentation, line-item transparency, tax compliance, PDF generation)
4. **Stage 4: Payment Processing & Checkout** (Payment rails, sandbox isolation, transaction security, redirect safety)
5. **Stage 5: Client Onboarding & Dashboard Access** (Post-payment activation, identity claiming, first-run dashboard experience)

### Core Audit Verdict
The platform demonstrates strong backend foundations in server-side price validation, atomic database transactions, idempotency safeguards, and sandbox isolation. However, several critical structural disconnects and security vulnerabilities currently break user journey continuity:
- **Proposal Deep-Link Disconnect**: Quote summary emails link users to `/quote?proposal=${code}`, but the frontend never reads or loads the proposal parameter, landing returning prospects on a blank Step 1 form.
- **Missing Proposal Read API**: The backend possesses endpoints to accept or pay a proposal, but lacks a public `GET /proposals/:code` endpoint to retrieve saved proposal details.
- **Hardcoded Checkout Currency Bug**: Card subscription checkouts in `SubscriptionCheckout.tsx:288, 318` hardcode `currency: 'KES'`, improperly charging international clients in Kenyan Shillings instead of USD.
- **Open Redirect Vulnerability**: `SubscriptionCheckout.tsx` and `quote/page.tsx` assign `window.location.href = data.checkoutUrl` directly without URL validation, exposing users to phishing/redirection hazards.
- **The "Onboarding Paywall Illusion"**: `/portal/onboarding` functions exclusively as an activation paywall that immediately ejects paying users to `/portal`. The application features zero client intake, brand asset collection, or domain configuration, while leaving `Client.onboardedAt` perpetually unwritten in the database.
- **Ephemeral Proposal Experience**: Proposals disappear upon page reload, lacking an executive-grade commercial document format, milestone schedule, and exportable PDF.

---

## 1. Five-Stage Journey Audit & Gap Analysis

### 1.1 Stage 1: Package Selection & Catalog Clarity
- **Routes & Components**:
  - `/pricing` (`apps/web/src/components/pricing/PricingView.tsx`)
  - `/services` (`apps/web/src/app/(public)/services/page.tsx` & `ServiceFamilyView.tsx`)
  - `/store` (`apps/web/src/components/store/StoreView.tsx`)
  - `apps/web/src/lib/pricingData.ts` & `priceBooks.ts`
- **Current Architecture**:
  Multi-market pricing architecture using GeoIP/header resolution supporting Kenya (`KE` / KES) and International (`GLOBAL` / USD).
- **Identified Gaps & Friction Points**:
  1. *Services-to-Pricing Tab Disconnect*: Services cards link to `/pricing?tab=websites`, `/pricing?tab=ecommerce`, `/pricing?tab=custom`, `/pricing?tab=care`, but `PricingView.tsx` ignores `searchParams.get('tab')`, consistently defaulting to the `websites` tab.
  2. *Store Currency Localization Leak*: `StoreView.tsx:353, 368-370` hardcodes `plan.priceMonthlyKes` and `'KES'` into plan cards and cart actions, forcing Kenyan currency onto international store visitors.
  3. *Unrecognized Service Param*: Category links passing `/quote?service=ecommerce` fail to map to the e-commerce calculator tier, defaulting to generic business websites.
  4. *Missing Macro Journey Indicator*: Prospects have no visual context showing where package selection sits within the overarching 5-step journey.

### 1.2 Stage 2: Proposal Generation & Presentation
- **Routes & Components**:
  - `/quote` (`apps/web/src/app/(public)/quote/page.tsx`)
  - Next.js API: `POST /api/quote` (`apps/web/src/app/api/quote/route.ts`)
  - NestJS API: `apps/api/src/modules/pricing/pricing.service.ts` & `pricing.controller.ts`
  - Prisma Schema: `model Proposal`
- **Current Architecture**:
  A 3-step interactive calculator that submits quote parameters to `/api/quote`, locks a `Proposal` row in PostgreSQL, and dispatches a summary email.
- **Identified Gaps & Friction Points**:
  1. *Broken Email Deep-Link*: Transactional emails advise clients to "Review & Accept Proposal" at `/quote?proposal=${proposalCode}`. The page fails to check `searchParams.get('proposal')`, discarding proposal reference codes.
  2. *Missing Backend Retrieval Route*: Neither `billing.controller.ts` nor `pricing.controller.ts` implements `@Get('proposals/:code')`. No client can retrieve their proposal from the server.
  3. *Ephemeral State Trapping*: Proposal display is trapped inside local React state (`submittedQuote`), which vanishes upon page refresh, browser back/forward, or cross-device handoff.
  4. *Absence of Executive Proposal Presentation*: Proposal output is currently a plain 4-row price box. Missing: official BazionWeb verification seal, 30-day validity counter, itemized deliverable breakdown, 50/50 payment milestone terms, delivery roadmap phases, and PDF print/download capability.

### 1.3 Stage 3: Invoicing Transparency & Accounting Compliance
- **Routes & Components**:
  - Client Portal: `/portal/invoices` (`apps/web/src/app/portal/invoices/InvoicesClient.tsx`)
  - Admin Portal: `/admin/invoices` (`apps/web/src/app/admin/invoices/page.tsx`)
  - NestJS API: `apps/api/src/modules/billing/billing.controller.ts` & `billing.service.ts`
  - Prisma Schema: `model Invoice`
- **Current Architecture**:
  Invoices support statuses `DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`. Kickoff deposit invoices are generated automatically at 50% upon proposal acceptance.
- **Identified Gaps & Friction Points**:
  1. *Missing PDF Download Route*: `billing.service.ts:1381` returns `{ url: '/api/v1/invoices/${id}/pdf/download' }`, but no handler `@Get(':id/pdf/download')` exists in `billing.controller.ts`, resulting in 404 errors.
  2. *Line-Item Granularity & Tax Detail*: Invoices record single aggregate amounts without separate line items for KRA VAT (16%) or discounts. Admin-generated invoices leave `lineItems` completely `null`.
  3. *Lack of In-App Invoice Detail Modal*: Users cannot inspect full line-item breakdowns without opening the external print view.

### 1.4 Stage 4: Payment Processing, Checkout & Security Controls
- **Routes & Components**:
  - `/checkout` (`apps/web/src/components/billing/SubscriptionCheckout.tsx`)
  - `/checkout/verify` (`apps/web/src/app/(public)/checkout/verify/page.tsx`)
  - NestJS API: `payment-settlement.service.ts`, `webhooks.controller.ts`, `daraja.service.ts`, `paystack.service.ts`
- **Current Architecture**:
  Multi-rail payments supporting Paystack (Cards & M-Pesa), Safaricom Daraja (M-Pesa STK push), and B2B wire transfers.
- **Identified Gaps & Friction Points**:
  1. *Open Redirect Risk*: `SubscriptionCheckout.tsx:297, 329` and `quote/page.tsx:298` directly assign `window.location.href = data.checkoutUrl;` without calling `isTrustedCheckoutUrl()`, introducing phishing vulnerability.
  2. *Critical Currency Override*: Lines 288 and 318 in `SubscriptionCheckout.tsx` submit `currency: 'KES'` in card subscription payloads regardless of whether the user selected USD, forcing Kenyan currency conversion on international clients.
  3. *Missing App Error Boundaries*: There are no Next.js `error.tsx` error boundaries in `apps/web/src/app`, causing unhandled exceptions to crash the entire page rather than showing a recoverable checkout error.
  4. *Client-Side Phone Validation*: Missing client-side regex check for Kenyan mobile numbers (`^(?:254|\+254|0)?(7|1)\d{8}$`), allowing invalid input before dispatching network requests.

### 1.5 Stage 5: Client Onboarding & Dashboard Access
- **Routes & Components**:
  - `/portal/onboarding` (`apps/web/src/app/portal/onboarding/page.tsx`)
  - `/portal` (`apps/web/src/app/portal/page.tsx` & `PortalShell.tsx`)
  - `/portal/claim` (`apps/web/src/app/portal/claim/page.tsx`)
  - Prisma Schema: `model Client` (`onboardedAt`)
- **Current Architecture**:
  Post-payment redirection to `/checkout/verify` with guest claim links, leading to portal authentication.
- **Identified Gaps & Friction Points**:
  1. *The Onboarding Paywall Illusion*: `/portal/onboarding` is purely an activation payment paywall. Active clients are immediately redirected to `/portal`. There is zero customer onboarding questionnaire, intake form, domain connection, or asset collection.
  2. *Unused Database Field*: `Client.onboardedAt` exists in `schema.prisma:275`, but is never written or read anywhere in the codebase.
  3. *Barren First-Run Dashboard Experience*: New paying clients enter `/portal` to find passive empty states ("No active project underway", "No service report yet", "No support requests yet"), causing confusion and support tickets.
  4. *Double-Email Claim Friction*: Guest payers on `/checkout/verify` click "Email Me a Claim Link", are redirected to `/portal/claim`, and must click it a second time to receive their activation email.
  5. *Session Tab Isolation*: `auth.store.ts` uses `sessionStorage`, causing immediate session loss whenever clients click email links (invoices, ticket updates, milestone sign-offs) in new browser tabs.

---

## 2. Industry Benchmark Comparison (SaaS & Modern Agency Best Practices)

| Dimension | Industry Benchmark Standard (Linear, Vercel, Stripe Billing, Copilot) | Current BazionWeb Baseline | Required Production Enhancement |
|---|---|---|---|
| **Journey Navigation** | Persistent visual progress stepper across onboarding stages with contextual stage awareness. | Disconnected pages; no global macro indicator connecting package selection to dashboard onboarding. | Deploy global 5-step lifecycle progress indicator across public and portal transition screens. |
| **Proposal Review** | Authoritative, shareable URL with itemized scope, SLA, payment terms, and PDF export. | Ephemeral component state; links from email break; basic 4-row price box without scope details. | Persistent proposal viewer (`/quote?proposal=...`) backed by API, featuring itemized scope, terms, and PDF export. |
| **Invoicing & Taxes** | Explicit tax breakdown (e.g. VAT/sales tax lines), transparent line items, downloadable PDF statement. | Taxes bundled without explicit line item; admin invoices have null line items; PDF route returns 404. | Itemized invoice breakdown with tax/subtotal lines, in-app statement modal, and working PDF download handler. |
| **Checkout Security** | Strict origin whitelisting on payment gateway redirects; zero client-side pricing or currency overrides. | Open redirect vulnerability; hardcoded `'KES'` override on card checkout. | Enforce `isTrustedCheckoutUrl()` across all checkout paths; dynamically bind currency to active market preference. |
| **Client Onboarding** | Interactive 4-5 step first-run checklist (Profile, Domain connection, Vault credentials, Kickoff roadmap). | Inactive paywall redirecting to empty dashboard; `onboardedAt` schema field dead. | Interactive `ClientOnboardingChecklist` on `/portal` updating `onboardedAt` on completion; links to Encrypted Vault. |
| **Session Management** | Seamless cross-tab persistence using secure storage or synchronized tabs. | `sessionStorage` causes immediate logout when opening transactional email links in new tabs. | Transition to persistent cross-tab storage with secure token refresh. |

---

## 3. Production Remediation Roadmap

The identified defects and enhancements are organized into five cohesive implementation tracks:

### Track 1: Package Selection & Executive Proposal Flow (Stages 1 & 2)
- Deploy universal 5-step Macro Lifecycle Progress Header (`ClientJourneyProgress.tsx`).
- Support deep-link tab selection (`/pricing?tab=...`) in `PricingView.tsx`.
- Fix currency localization leak in `StoreView.tsx`.
- Implement backend `GET /api/v1/invoices/proposals/:code` endpoint in `billing.controller.ts` & `billing.service.ts`.
- Implement Next.js `GET /api/quote` route to fetch proposal details.
- Build executive Proposal Presentation View (`ProposalPresentationView.tsx`) on `/quote?proposal=...` featuring:
  - Official BazionWeb header, proposal code, and 30-day countdown badge.
  - Itemized deliverable breakdown, extra pages, and selected add-ons.
  - 50% Kickoff Deposit / 50% Staging Sign-Off payment terms.
  - 5-phase delivery roadmap (Discovery -> Design -> Staging Build -> QA -> Production Handover).
  - Actions: "Accept & Generate Deposit Invoice", "Download / Print Official Proposal PDF", "WhatsApp Inquiry".

### Track 2: Invoicing Transparency, Checkout Security & Payment Controls (Stages 3 & 4)
- Fix open redirect vulnerability in `SubscriptionCheckout.tsx:297, 329` and `quote/page.tsx:298` by enforcing `isTrustedCheckoutUrl()`.
- Fix hardcoded `currency: 'KES'` in `SubscriptionCheckout.tsx:288, 318` to respect market currency (`isKe ? 'KES' : 'USD'`).
- Implement missing backend `@Get(':id/pdf/download')` route in `billing.controller.ts`.
- Enhance invoice line-item breakdowns with explicit KRA VAT (16%) or tax subtotal formatting.
- Add client-side phone regex validation for Kenyan numbers.
- Add Next.js App Router `error.tsx` error boundaries for checkout and portal billing.

### Track 3: Interactive Client Onboarding & Dashboard Experience (Stage 5)
- Repurpose `/portal` first-run state with an interactive `ClientOnboardingChecklist` component:
  - Step 1: Complete Organization Profile (`/portal/account`)
  - Step 2: Connect Domain & DNS Infrastructure (`/portal/assets`)
  - Step 3: Deposit Registrar / Third-Party Credentials in Encrypted Vault (`/portal/vault`)
  - Step 4: Review Delivery Roadmap & Milestones (`/portal/milestones`)
- Implement backend endpoint `POST /api/v1/clients/me/onboard` to persist `client.onboardedAt = new Date()`.
- Streamline post-payment guest claim flow on `/checkout/verify`.
- Improve auth session persistence to support multi-tab email deep links.

### Track 4: Testing & Integrity Verification
- Opaque-box E2E test suite covering all 5 stages across Tiers 1-4.
- Mock/sandbox mode enforcement for all financial rails.
- Monorepo linting, typechecking, and regression verification.

---

## 4. Verification & Baseline Metrics

The repository currently maintains a clean test and build baseline:
- `@bazionweb/web` unit test suite: **280 tests passed** (0 failures).
- `@bazionweb/api` unit test suite: **384 tests passed** (0 failures).
- TypeScript typecheck (`tsc --noEmit` across all workspaces): **0 errors**.
- ESLint code analysis (`npm run lint --workspaces`): **0 errors**.
- All payment gateway configurations (`apps/api/.env`, `apps/web/.env.local`) strictly use sandbox/mock API keys (`pk_test_...`, `sk_test_...`, Daraja sandbox shortcode `174379`). No live financial transactions are triggered.
