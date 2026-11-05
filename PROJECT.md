# Project: BazionWeb Client Journey & Security Enhancements

## Architecture
- **Monorepo Architecture**:
  - `apps/web`: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons, Zustand state stores, TanStack React Query.
  - `apps/api`: NestJS, Prisma ORM, PostgreSQL, Passport JWT, Node crypto, Paystack SDK, Safaricom Daraja SDK.
- **Client Journey Data Flow**:
  1. **Stage 1 (Package Selection)**: Visitor reviews packages on `/pricing`, `/services`, `/store`, selects package/add-ons -> navigates to `/quote?package=X` or `/checkout?plan=X`.
  2. **Stage 2 (Proposal Flow)**: Visitor customizes scope on `/quote`, enters details -> `POST /api/quote` -> creates locked `Proposal` record in PostgreSQL -> returns `proposalCode` -> renders executive `ProposalPresentationView` -> provides "Accept Proposal" CTA -> creates 50% deposit invoice in PostgreSQL.
  3. **Stage 3 (Invoicing)**: Client views deposit invoice or recurring statement on `/portal/invoices` or proposal acceptance view -> itemized lines, VAT/tax breakdown, in-app statement modal, downloadable PDF.
  4. **Stage 4 (Checkout & Payment)**: Client pays via M-Pesa STK push or Card checkout -> validated redirect to Paystack hosted checkout or polling of STK push status -> webhook verifies signature and settles payment -> creates `PaymentLog`, marks `Invoice` PAID, activates subscription, auto-provisions project roadmap.
  5. **Stage 5 (Client Onboarding & Dashboard)**: Post-payment transition -> claim account / set password -> lands on `/portal` -> interactive `ClientOnboardingChecklist` guides business profile, domain connection, encrypted vault keys, roadmap review -> marks `Client.onboardedAt = new Date()`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Macro Journey Progress Indicator | Universal 5-step progress header across public & portal screens (Package Selection -> Proposal -> Invoicing -> Payment -> Onboarding) | M1 | Survey 1 |
| 2 | Pricing Tab Deep-Link Sync | Initialize `PricingView` activeTab from `?tab=` query parameter and reflect tab changes in URL | M1 | Survey 1 |
| 3 | Store Currency Localization Fix | Replace hardcoded KES strings in `StoreView.tsx` with dynamic market currency resolution | M1 | Survey 1 |
| 4 | Quote Service Parameter Mapping | Map `/quote?service=ecommerce` and other service slugs to proper calculator defaults | M1 | Survey 1 |
| 5 | Public Proposal Read API | Implement `GET /api/v1/invoices/proposals/:code` in NestJS `billing.controller.ts` & `billing.service.ts` | M1 | Survey 1 |
| 6 | Next.js Quote GET Handler | Implement `GET /api/quote?code=...` in Next.js App Router route handler to query proposal | M1 | Survey 1 |
| 7 | Proposal Presentation View | Executive-grade commercial proposal document on `/quote?proposal=...` with scope, line items, 50/50 terms, roadmap, and print/PDF | M1 | Survey 1 |
| 8 | Open Redirect Sanitization | Wrap checkout redirects in `SubscriptionCheckout.tsx` and `quote/page.tsx` with `isTrustedCheckoutUrl()` | M2 | Survey 2 |
| 9 | Checkout Currency Fix | Replace hardcoded `'KES'` in `SubscriptionCheckout.tsx:288, 318` with active market currency | M2 | Survey 2 |
| 10 | Invoice PDF Download Route | Implement `@Get(':id/pdf/download')` route in NestJS `billing.controller.ts` to stream/serve invoice PDF | M2 | Survey 2 |
| 11 | Itemized Invoice Breakdown & Tax Lines | Itemize KRA VAT (16%) and line-item details on invoice display and settlement statements | M2 | Survey 2 |
| 12 | Checkout Phone Validation | Add client-side regex check for Kenyan mobile numbers (`^(?:254\|\+254\|0)?(7\|1)\d{8}$`) | M2 | Survey 2 |
| 13 | App Router Error Boundaries | Add Next.js `error.tsx` error boundaries on `/checkout` and `/portal/invoices` | M2 | Survey 2 |
| 14 | Interactive Onboarding Checklist | Interactive `ClientOnboardingChecklist` component on `/portal` for clients without `onboardedAt` | M2 | Survey 3 |
| 15 | Client Onboarded Timestamp Persistence | Backend endpoint `POST /api/v1/clients/me/onboard` to persist `Client.onboardedAt = new Date()` | M2 | Survey 3 |
| 16 | Streamlined Post-Payment Claim | Auto-dispatch or streamline claim link on `/checkout/verify` to eliminate double-click friction | M2 | Survey 3 |
| 17 | Multi-Tab Session Persistence | Enhance session store persistence to prevent session loss on email link clicks in new tabs | M2 | Survey 3 |
| 18 | Opaque-Box E2E Testing Suite | Comprehensive test suite covering Tiers 1-4 across all 5 stages in mock/sandbox environment | M3 / E2E | Survey 1, 2, 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Package Selection & Executive Proposal Flow | Features 1, 2, 3, 4, 5, 6, 7 (Step progress, tab sync, store currency, GET proposal API, Proposal presentation view, quote-flow.ts, proposal-cache.ts) | None | DONE |
| M2 | Invoicing Transparency, Payment Security & Client Onboarding Flow | Features 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 (Open redirect defense, currency fix, PDF download route, tax line itemization, phone validation, error boundaries, onboarding checklist, onboardedAt API, streamlined claim, multi-tab session persistence) | M1 | DONE |
| M3 | Final Milestone: E2E Test Suite Validation & Verification | Feature 18: Pass 100% of E2E tests (Tiers 1-4), adversarial coverage hardening, verify mock/sandbox payment safety, verify clean build & lint | M1, M2, E2E Track | DONE |

## Streamlined Gate Protocol (Approved Process Directive)
To accelerate execution while guaranteeing quality:
1. **Milestones Merged**: Milestone 2 and Milestone 3 are unified into a single combined milestone (Features 8–17) with one implementation → gate cycle.
2. **Exploration Overhead**: At most 1 exploratory agent per cycle (`explorer_m2_onboarding` for M2+M3; 0 for M3 where covered).
3. **Gate Review**: 2 verifiers total per cycle (1 Reviewer `teamwork_reviewer` + 1 Forensic Auditor `teamwork_auditor`) instead of 5.
4. **Hard Quality Gates (Unchanged)**:
   - TypeScript: 0 errors (`npm --workspace=@bazionweb/web run tsc`, `npm --workspace=@bazionweb/api run tsc`).
   - Next.js 14 Build: Clean compilation and static prerendering of all 75+ routes (`npm --workspace=@bazionweb/web run build`).
   - ESLint: Clean pass across monorepo (`npm run lint`).
   - Automated Tests: 100% of 95 opaque-box E2E tests pass.
   - Financial Security: Strict sandbox/mock isolation (Daraja Sandbox, Paystack Test Mode); zero live financial charges.
   - Secret Leaks: Zero client-side credentials or exposed private keys.

## Interface Contracts
### Public Proposal Read API (`apps/api` -> `apps/web`)
- **Route**: `GET /api/v1/invoices/proposals/:code`
- **Access**: `@Public()`, throttled (30 req / min)
- **Response**:
  ```typescript
  {
    success: true,
    data: {
      proposalCode: string;
      currency: string;
      currencySymbol: string;
      totalAmount: number;
      depositAmount: number;
      finalAmount: number;
      status: 'LOCKED' | 'ACCEPTED' | 'EXPIRED';
      clientName: string;
      clientCompany: string;
      clientEmail: string;
      marketCode: 'KE' | 'GLOBAL';
      lineItems: Array<{ title: string; subtitle?: string; price: number; quantity?: number }>;
      expiresAt: string;
      createdAt: string;
    }
  }
  ```
- **Error**: `404 Not Found` if proposalCode not found or invalid format.

### Client Onboarding Completion API (`apps/api` -> `apps/web`)
- **Route**: `POST /api/v1/clients/me/onboard`
- **Access**: `@UseGuards(JwtAuthGuard)`, Client role
- **Request Body**: `{ completedSteps?: string[] }`
- **Response**: `{ success: true, onboardedAt: string }`

### Safe Checkout Redirection Contract
- `isTrustedCheckoutUrl(url: string): boolean`
  - Validates protocol is `https:`
  - Validates hostname belongs to `paystack.com`, `checkout.paystack.com`, or local configured proxy.

## Code Layout
- Public Stage 1 & 2:
  - `apps/web/src/components/navigation/ClientJourneyProgress.tsx`
  - `apps/web/src/components/pricing/PricingView.tsx`
  - `apps/web/src/components/store/StoreView.tsx`
  - `apps/web/src/app/(public)/quote/page.tsx`
  - `apps/web/src/components/quote/ProposalPresentationView.tsx`
  - `apps/web/src/app/api/quote/route.ts`
  - `apps/api/src/modules/billing/billing.controller.ts`
  - `apps/api/src/modules/billing/billing.service.ts`
- Public & Portal Stage 3 & 4:
  - `apps/web/src/components/billing/SubscriptionCheckout.tsx`
  - `apps/web/src/app/portal/invoices/InvoicesClient.tsx`
  - `apps/web/src/app/(public)/checkout/error.tsx`
  - `apps/web/src/app/portal/invoices/error.tsx`
- Portal Stage 5:
  - `apps/web/src/components/portal/ClientOnboardingChecklist.tsx`
  - `apps/web/src/app/portal/page.tsx`
  - `apps/api/src/modules/clients/clients.controller.ts`
  - `apps/api/src/modules/clients/clients.service.ts`
  - `apps/web/src/store/auth.store.ts`
- E2E Tests:
  - `apps/web/__tests__/e2e/client-journey.spec.ts`
  - `apps/api/src/modules/billing/__tests__/client-journey.e2e.spec.ts`
