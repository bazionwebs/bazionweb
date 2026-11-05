# BazionWeb Client Journey Test Infrastructure & Matrix

**Platform**: BazionWeb Digital Engineering & Cloud Infrastructure Monorepo  
**Integrity Mode**: Development / Mock Sandbox Environment  
**Document Version**: 1.0.0  
**Status**: APPROVED & PUBLISHED  

---

## 1. Executive Test Architecture & Scope

This test infrastructure specification establishes an authoritative, opaque-box testing framework for the five lifecycle stages of the BazionWeb customer journey:
1. **Stage 1: Package Selection** (Services catalog, public store, pricing tiers, feature clarity, multi-market price books)
2. **Stage 2: Proposal Generation & Presentation** (Interactive cost calculation, proposal locking, 50/50 terms, proposal deep-linking)
3. **Stage 3: Invoicing Transparency** (Kickoff deposit invoices, 16% KRA VAT line-item transparency, statement presentation, PDF route)
4. **Stage 4: Payment Processing & Checkout Security** (Daraja M-Pesa STK push, Paystack hosted card checkout, webhook signature settlement, open redirect sanitization, phone validation)
5. **Stage 5: Client Onboarding & Dashboard Access** (Identity claiming, first-run dashboard, interactive onboarding checklist, `Client.onboardedAt` timestamp persistence)

All tests are derived strictly from specifications in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `CLIENT_JOURNEY_AUDIT_REPORT.md`. All financial rails and third-party gateways are strictly constrained to sandbox/mock execution; live financial transactions are prohibited.

---

## 2. Test Harness & Framework Layout

The monorepo operates two test suites co-located within the respective workspaces:

```
bazionweb/
├── apps/
│   ├── web/
│   │   ├── __tests__/
│   │   │   └── e2e/
│   │   │       └── client-journey.spec.ts  # Frontend E2E specs (Next.js route handlers, UI components, client flow)
│   │   ├── jest.config.js                  # Jest + jsdom + testing-library
│   │   └── jest.setup.js
│   └── api/
│       ├── src/
│       │   └── modules/
│       │       └── billing/
│       │           └── __tests__/
│       │               └── client-journey.e2e.spec.ts # Backend E2E specs (NestJS TestingModule, API controllers, services, database transactions)
│       └── jest.config.js                  # Jest + ts-jest + Node.js
├── TEST_INFRA.md                           # Master Test Architecture (this file)
└── TEST_READY.md                          # Readiness Report & Verification
```

### Framework Technology Stack
- **Web Workspace (`@bazionweb/web`)**:
  - Test Runner: Jest 29.7.0
  - DOM Simulation: `jest-environment-jsdom`
  - Component Verification: `@testing-library/react` 16.0.0, `@testing-library/jest-dom` 7.0.1
  - Route Verification: Native Next.js 14 `NextRequest` and `NextResponse` route execution
- **API Workspace (`@bazionweb/api`)**:
  - Test Runner: Jest 29.7.0
  - Compilation: `ts-jest` 29.4.11
  - Container / DI: `@nestjs/testing` 10.4.22
  - Isolation: In-memory Prisma mock and mock payment service stubs

---

## 3. Opaque-Box Methodology & Output Derivation

Every test case derives inputs and expected outputs from authoritative project artifacts:

| Phase | Input Source | Expected Output Authoritative Source |
|---|---|---|
| **Stage 1 (Package Selection)** | Market code (`KE` or `GLOBAL`), category tab (`websites`, `ecommerce`, `custom`, `care`), plan slug | `priceBooks.ts` (`PRICE_BOOK_KE_2026_V1`, `PRICE_BOOK_GLOBAL_2026_V1`), `pricingData.ts` |
| **Stage 2 (Proposal Generation)** | Base package, extra pages, add-on IDs, client name/email | `POST /pricing/quote` calculation formula (Total = Base + Pages + Add-ons, Deposit = 50%), Proposal Schema |
| **Stage 3 (Invoicing)** | Proposal code, client identity | Invoice creation contract: 50% deposit, currency matching market, itemized lines, KRA VAT (16%) |
| **Stage 4 (Payment Processing)** | Phone number, billing cycle, payment method (`MPESA`, `CARD`) | STK push response contract, Paystack checkout URL with trusted domain check (`isTrustedCheckoutUrl`), webhook signature validation |
| **Stage 5 (Client Onboarding)** | Authenticated JWT, completed checklist steps (`profile`, `domain`, `vault`, `roadmap`) | `POST /api/v1/clients/me/onboard` contract: `{ success: true, onboardedAt: ISO8601 }` |

---

## 4. Multi-Tiered Test Matrix

### Tier 1: Feature Coverage (>=5 test cases per stage across 5 stages)
- **Stage 1: Package Selection**
  1. TC-1.1: Multi-market price book resolution (KES for Kenya domestic, USD for International).
  2. TC-1.2: Pricing catalog tab synchronization (`websites`, `ecommerce`, `custom`, `care`).
  3. TC-1.3: Store catalog item and add-on pricing alignment with market currency.
  4. TC-1.4: Website plan deliverables and feature inclusions integrity.
  5. TC-1.5: E-commerce package pricing and product tier limits verification.
- **Stage 2: Proposal Generation & Presentation**
  1. TC-2.1: Centralized real-time quote calculation with dynamic add-ons and extra page counts.
  2. TC-2.2: Proposal locking with unique proposal code generation (`BZ-KE-...` or `BZ-GL-...`).
  3. TC-2.3: 50/50 payment split commercial term generation (50% Kickoff Deposit, 50% Handover).
  4. TC-2.4: Proposal presentation view rendering with executive verification badges.
  5. TC-2.5: Proposal URL deep-linking and state recovery (`/quote?proposal=${proposalCode}`).
- **Stage 3: Invoicing Transparency & Accounting Compliance**
  1. TC-3.1: Automatic kickoff deposit invoice creation at exactly 50% of build gross.
  2. TC-3.2: Itemized line-item breakdown with explicit tax line items (16% VAT for Kenya).
  3. TC-3.3: Invoicing status progression (`SENT`/`PENDING` -> `PAID`).
  4. TC-3.4: Invoice PDF download stream endpoint resolution (`/invoices/:id/pdf/download`).
  5. TC-3.5: Invoice error boundary fallback resilience.
- **Stage 4: Payment Processing & Checkout Security**
  1. TC-4.1: M-Pesa STK push initialization with valid Kenyan phone number.
  2. TC-4.2: Paystack card checkout initiation returning trusted payment gateway URL.
  3. TC-4.3: Open redirect protection rejecting untrusted checkout URLs.
  4. TC-4.4: Webhook transaction signature verification (HMAC SHA512).
  5. TC-4.5: Payment status polling and settlement confirmation.
- **Stage 5: Client Onboarding & Dashboard Access**
  1. TC-5.1: Post-payment guest claim token generation and account claiming.
  2. TC-5.2: Client portal first-run onboarding checklist presentation.
  3. TC-5.3: Step-by-step checklist progress tracking (Profile, Domain, Vault, Roadmap).
  4. TC-5.4: Onboarding completion API `POST /api/v1/clients/me/onboard` writing `onboardedAt`.
  5. TC-5.5: Multi-tab authenticated session persistence.

### Tier 2: Boundary, Adversarial & Corner Cases (>=5 test cases per stage)
- **Stage 1 (Package Selection Boundaries)**:
  1. TC-B1.1: Invalid/empty market code defaults safely to default market.
  2. TC-B1.2: Unrecognized service slug gracefully falls back to default calculator.
  3. TC-B1.3: Tampered price book IDs or missing currency codes rejection.
  4. TC-B1.4: Zero-price or unpriced catalog add-on handling.
  5. TC-B1.5: Geo-detection conflict resolution between edge headers and browser cookie.
- **Stage 2 (Proposal Boundaries)**:
  1. TC-B2.1: Quote calculation with zero extra pages and empty add-ons array.
  2. TC-B2.2: Extreme page counts (>100 pages) bounded by commercial maximums.
  3. TC-B2.3: Rejection of negative extra pages or invalid add-on identifiers.
  4. TC-B2.4: Invalid, expired, or malformed coupon code handling without pricing corruption.
  5. TC-B2.5: Rejection of quote submission when client name or email is blank/whitespace.
- **Stage 3 (Invoicing Boundaries)**:
  1. TC-B3.1: Zero-amount or negative invoice generation attempts rejected.
  2. TC-B3.2: Malformed UUID handling on invoice retrieval returning 400/404.
  3. TC-B3.3: Prevention of duplicate kickoff deposit invoices for already accepted proposals.
  4. TC-B3.4: Overdue invoice date calculations and grace period boundaries.
  5. TC-B3.5: Missing line items handling on legacy/admin-generated invoices.
- **Stage 4 (Payment Security & Gateway Boundaries)**:
  1. TC-B4.1: Rejection of malformed Kenyan phone numbers (invalid prefix, letters, too short/long).
  2. TC-B4.2: Open redirect adversary: URLs with deceptive subdomains (e.g. `paystack.com.evil.com`) rejected.
  3. TC-B4.3: Paystack webhook signature tampering rejected with 401/400.
  4. TC-B4.4: Webhook idempotency: duplicate delivery of `charge.success` ignores re-settlement.
  5. TC-B4.5: M-Pesa STK push timeout / cancellation webhook handling.
- **Stage 5 (Onboarding Boundaries)**:
  1. TC-B5.1: Unauthenticated request to `POST /api/v1/clients/me/onboard` rejected with 401.
  2. TC-B5.2: Re-submission of onboarding for already onboarded client retains original timestamp.
  3. TC-B5.3: Onboarding submission with empty or malformed `completedSteps` array.
  4. TC-B5.4: Expired or tampered claim token rejection.
  5. TC-B5.5: Non-existent client record handling during portal initialization.

### Tier 3: Cross-Feature Integration Pipelines
- **Pipeline 1 (Kenya Domestic Journey)**:
  1. Visitor selects Kenya Business Website package ->
  2. Calculates quote with 2 add-ons and locks Proposal `BZ-KE-2026-TEST` ->
  3. Accepts proposal to trigger 50% Kickoff Deposit Invoice `INV-KE-001` with 16% VAT ->
  4. Initiates Daraja M-Pesa STK push to `254712345678` ->
  5. Simulates mock M-Pesa success callback ->
  6. Invoice transitions to `PAID`, activates project roadmap ->
  7. Client claims portal access, completes checklist, and records `onboardedAt`.
- **Pipeline 2 (International Enterprise Journey)**:
  1. Visitor selects Global Enterprise E-commerce package ($USD) ->
  2. Locks Proposal `BZ-GL-2026-TEST` with USD pricing ->
  3. Generates 50% USD deposit invoice ->
  4. Validates Paystack card checkout redirect against trusted domain whitelist ->
  5. Simulates mock Paystack `charge.success` webhook with valid HMAC signature ->
  6. Account provisioned, lands on `/portal` with onboarding checklist.

### Tier 4: Real-World Workload & Stress Scenarios
- TC-W1: High-concurrency proposal generation stress (rapid sequential calculations without state leakage).
- TC-W2: Duplicate webhook re-delivery and race condition resilience.
- TC-W3: Multi-tab session resilience (token preserved when opening email links in new tabs).
- TC-W4: Error boundary recovery under transient network failures.

---

## 5. Execution & CI Verification Commands

```bash
# Run web workspace client journey E2E test suite
npm --workspace=@bazionweb/web test -- client-journey.spec.ts

# Run api workspace client journey E2E test suite
npm --workspace=@bazionweb/api test -- client-journey.e2e.spec.ts

# Run monorepo entire test suite (all packages)
npm test
```

All tests execute in mock/sandbox mode without external network dependencies, ensuring 100% reproducible local and CI/CD verification.
