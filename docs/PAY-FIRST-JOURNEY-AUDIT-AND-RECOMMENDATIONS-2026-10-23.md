# BazionWeb Client Journey Audit: Pay-First Architecture, Entitlement Hardening & Portal Sanitization

**Document Status:** Complete & Verified  
**Date:** 23 October 2026  
**Target Systems:** `apps/web` (Next.js 14 App Router), `apps/api` (NestJS 10, Prisma ORM, Keycloak/JWT)  
**Scope:** Plan Catalog → Payment Rail → Webhook Settlement → Email-Verified Claim → Entitled Client Workspace

---

## 1. Executive Summary

This audit and hardening program eliminates the structural loopholes, simulated auth flows, and misleading mock content in BazionWeb's commercial onboarding. 

Previously, users encountered unverified client-side session minting, divergent pricing matrices across six different files, insecure and un-scoped magic link tokens, and client workspaces populated with fictional customer data ("Acacia Healthcare") and simulated telemetry (fake Core Web Vitals and fake credentials).

The codebase has been refactored into a hardened, high-converting **Pay-First** customer journey:
1. **Public, server-driven plan catalog** (`GET /api/v1/plans`) eliminating hardcoded prices and plan IDs from client bundles.
2. **Server-priced checkout** for both M-Pesa Daraja and Paystack Card checkout, creating pre-settlement invoices and idempotent payment logs.
3. **Single-authority webhook settlement** turning subscriptions and client records `ACTIVE` upon payment confirmation.
4. **Token-bound, email-verified claim flow** (`POST /auth/claim-link` → `POST /auth/claim-account`) with separate token prefixes (`claim_` vs `magic_`), atomic consumption, anti-enumeration responses, and paid-evidence enforcement.
5. **Server-enforced workspace entitlement** via NestJS `SubscriptionGuard`, preventing unpaid or expired guests from accessing tickets, hosting, reports, or projects.
6. **Complete portal mock-content sanitization**, replacing fabricated demos with honest, data-driven states connected to real API endpoints.

---

## 2. Deep Comparative Analysis: Account-First vs. Pay-First

### 2.1 The Industry Debate

When designing onboarding for digital services, hosting, and subscription platforms, digital architects generally choose between two core paradigms:

```
[Account-First Flow]
Landing Page → Select Plan → Account Registration (Email + Password + Company) → Email Verification → Payment Checkout → Portal Access

[Pay-First (Guest Checkout) Flow]
Landing Page → Select Plan → Checkout (Billing Email + Mobile/Card) → Payment Webhook Settles → One-Click Claim Link / Password Set → Entitled Portal Access
```

### 2.2 Benchmarks & Case Studies

| Model | Representative Platforms | Pros | Cons / Challenges | Best Fit Context |
| :--- | :--- | :--- | :--- | :--- |
| **Account-First** | AWS, Google Cloud, DigitalOcean, GitHub, Linear, Slack | • Early identity capture<br>• Easy abandoned-cart marketing<br>• Simpler auth state machine | • High abandonment (19–26% drop-off per Baymard)<br>• Creates "zombie" accounts with zero billing intent<br>• High friction on mobile payment channels (M-Pesa) | Developer tools, freemium products, complex enterprise configurations requiring pre-purchase provisioning |
| **Pay-First** | Stripe Checkout, Substack, Shopify Stores, Carrd, Ghost Pro, Gumroad | • **Highest conversion rate** (eliminates pre-payment friction)<br>• Filters 100% of registrations to paying clients<br>• Optimal for mobile/STK push payments<br>• Zero zombie account bloat | • Requires robust post-payment claiming logic<br>• Webhook-to-claim race condition management<br>• Needs email-bound token security to prevent account hijacking | Paid services, curated retainers, high-intent SaaS, regional payment systems (M-Pesa) |

### 2.3 Why Pay-First is the Superior Choice for BazionWeb

1. **Regional Payment Optimization (M-Pesa Daraja):**  
   In Kenya and East Africa, mobile money represents the dominant payment mechanism. A user completing an M-Pesa STK Push wants to input their phone number, accept the prompt on their SIM toolkit, and have their service secured. Forcing an eight-field password creation form *before* the STK push generates immediate friction and card/mobile drop-off.
2. **Elimination of Unpaid Account Bloat:**  
   Under the previous account-first/simulated registration model, unregistered visitors could create dangling `Client` and `User` records in Keycloak and Prisma that had no associated revenue, cluttering support queues and database tables.
3. **High-Intent B2B Retainers:**  
   BazionWeb sells managed cloud retainers and software development services ($29–$299/mo; Care plans $75–$300/mo). Prospective clients have high purchase intent. Reducing the checkout to billing contact + payment method maximizes acquisition momentum.

### 2.4 The Pay-First Security Trade-offs & How BazionWeb Solves Them

| Risk in Pay-First | Architectural Vulnerability | BazionWeb Hardened Mitigation |
| :--- | :--- | :--- |
| **Token Hijacking / Interception** | Claim link contains token readable by network sniffers or proxy logs. | Claim tokens are single-use, 15-minute TTL, stored as SHA-256 hashes in `RefreshToken`, and strictly bound to the billing email. |
| **Cross-Endpoint Replay Attacks** | An attacker uses a magic login token at the claim endpoint or vice-versa. | Explicit token-purpose prefixes: `MAGIC_TOKEN_PREFIX = 'magic_'` and `CLAIM_TOKEN_PREFIX = 'claim_'`. Verification strictly enforces prefix match. |
| **Unpaid Account Claims** | An unauthenticated visitor calls `POST /auth/claim-account` for an arbitrary email. | `loadPaidEvidence()` check: the server refuses to claim unless the email owns an `ACTIVE` subscription or a `PAID` invoice within the past 90 days. |
| **Email Enumeration** | The `/auth/claim-link` API reveals whether an email exists or has paid. | Unified generic response: `{ success: true, message: "If this email is associated with a paid account..." }` returned regardless of outcome. |
| **Race Conditions in Claiming** | Two browser tabs attempt to consume the same claim token simultaneously. | Atomic database operation: `prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null } })` ensures only the first execution succeeds. |

---

## 3. End-to-End Architecture & Implementation Details

### 3.1 Step 1: Server-Driven Plan Catalog

- **Controller & Endpoint:** `apps/api/src/modules/billing/plans.controller.ts` exposes `GET /api/v1/plans` (public, cached).
- **Ordering & Pricing Alignment:** Plans are returned in fixed order: `Starter`, `Growth`, `Business`, `Enterprise`, `Care Essential`, `Care Business`, `Care Professional`.
- **Dynamic Math:** Annual discounts are computed server-side (`annualDiscountPct = round((1 - annual / (monthly * 12)) * 100)`).
- **Client Decoupling:** `apps/web/src/lib/plans.ts` and `usePlans()` hook fetch pricing dynamically. Hardcoded IDs and price copies have been removed from `SubscriptionCheckout.tsx`, `onboarding/page.tsx`, and marketing landing pages.

### 3.2 Step 2: Payment Rails & Pre-Settlement Invoicing

- **M-Pesa Daraja:** `BillingService.pushMpesaStk()` initiates an STK prompt directly to the client's Safaricom line. A `PaymentLog` record is created linking the Safaricom Checkout Request ID to the newly created `Invoice`.
- **Paystack Hosted Checkout:** `BillingService.subscribePaystackGuest()` and `payInvoiceCard()` initialize 3D-Secure card sessions with Paystack, recording provider reference hashes and client metadata.
- **Invoice Re-settlement:** Added `POST /invoices/:id/pay/mpesa` and `POST /invoices/:id/pay/card` so existing clients with pending or overdue invoices can settle directly via the portal without creating extraneous new subscriptions.

### 3.3 Step 3: Webhook Settlement & Entitlement

- **Single Authority:** `apps/api/src/modules/billing/webhooks.controller.ts` is the sole authority for marking invoices `PAID`.
- **Transaction Atomicity:** When a payment webhook fires:
  1. Validates cryptographic HMAC signature (Paystack `x-paystack-signature` or Daraja bearer token).
  2. Ensures idempotency via `PaymentLog.idempotencyKey`.
  3. Transitions `Invoice.status = 'PAID'` and sets `paidAt = now()`.
  4. Calls `activatePaidSubscription()`, transitioning `Subscription.status = 'ACTIVE'` and `Client.status = 'ACTIVE'`.

### 3.4 Step 4: Secure Email-Verified Claim Flow

1. **Trigger:** Client completes checkout → redirects to `/checkout/verify` → displays confirmation and prompt to claim account.
2. **Claim Link Request:** `POST /api/v1/auth/claim-link { email }`
   - Validates `loadPaidEvidence(email)`.
   - Generates an opaque random token prefixed with `claim_`.
   - Stores SHA-256 hash in `RefreshToken` with 15-minute TTL.
   - Dispatches transactional claim email via Resend (`sendClaimLinkEmail`).
3. **Claim Execution:** User clicks link to `/portal/claim?token=claim_...&email=...`
   - Submits password and optional name to `POST /api/v1/auth/claim-account`.
   - Verifies email matches token owner.
   - Atomically revokes claim token.
   - Sets user password (`hashPassword`), links `Client.userId`, sets `Client.status = 'ACTIVE'`.
   - Returns JWT token pair with `subscriptionStatus: 'ACTIVE'` claim.

### 3.5 Step 5: Server-Enforced Entitlement (`SubscriptionGuard`)

- **Implementation:** `apps/api/src/common/guards/subscription.guard.ts`.
- **Rule Matrix:**
  - Staff (`ADMIN`, `SUPPORT`, `SUPER_ADMIN`): **Bypass**.
  - Client Principal: Must satisfy `!client.deletedAt && (client.status === 'ACTIVE' || active_or_trial_subscription)`.
  - Deleted clients and unpaid guests (TRIAL status without active subscription): **403 Forbidden**.
- **Controllers Guarded:** Applied class-level to `TicketsController`, `HostingController`, `ReportsController`, and `ProjectsController`.
- **Client-Side UX Sync:** `AuthGuard.tsx` conducts live `GET /clients/me` validation on workspace mount, gracefully redirecting lapsed clients to `/portal/onboarding` or `/portal/invoices`.

---

## 4. Portal Sanitization & Real Data Integration

All demo mock content and placeholder artifacts have been eliminated from the client portal:

| Component | Previous Mock State | Hardened Production State |
| :--- | :--- | :--- |
| `PortalDashboard.tsx` | 1,292 lines of dead code containing fake "Acacia Healthcare" data, mock AES-256 vault credentials, and static charts. | **Deleted** via `git rm`. |
| `portal/page.tsx` | Hardcoded `webVitalsTelemetry` (0.84s LCP, 98/100 Lighthouse), fake "Doctor appointment booking" sprint, hardcoded "Peter Mwangi" engineer. | **Fully data-driven**: Connected to `useClientProjects()`, `useClientHosting()`, `useClientTickets()`, and `useClientInvoices()`. Honest empty states when no active projects exist. |
| `milestones/MilestonesClient.tsx` | Static sprint checklist, fake staging URLs, mock milestone sign-offs. | **Data-driven roadmap**: Powered by `useClientProjects()`, displaying real database tasks, completion percentages, staging/production URLs, and empty states. |
| `support/SupportClient.tsx` | Fake "Acacia Healthcare" reverse-proxy investigation text, mock triage cards, un-wired quick reply. | **Real ticket threads**: Displays client-submitted ticket descriptions, real assigned engineer names, and wires notes directly to `POST /tickets/:id/comments`. |
| `invoices/InvoicesClient.tsx` | Fictional KRA PIN `P051938291X`, fake Acacia client fallback, fake Paybill till `4082219`, simulated card charge with `•••• 4242`. | **Real settlement modal**: Settle invoices via live M-Pesa STK push (`POST /invoices/:id/pay/mpesa`) or Paystack Card redirect (`POST /invoices/:id/pay/card`). Real invoice notes and receipt tracking. |
| `vault/VaultClient.tsx` | Simulated credentials, localStorage secret storage, and misleading AES-256 claims. | **Honest disabled state**: Clearly states vault storage is not enabled; provides secure handoff guidance for credentials. |
| `assets/AssetsClient.tsx` | Hardcoded Acacia DNS records table. | **Honest empty state**: Explains managed DNS records are maintained by the engineering team. |

---

## 5. Residual Risks & Future Roadmap

1. **Webhook Settlement Propagation Latency:**  
   M-Pesa STK push authorization can take 5–15 seconds depending on Safaricom gateway latency. If a customer clicks "Claim Account" before Safaricom's webhook hits the BazionWeb API, `loadPaidEvidence()` will return false.  
   *Current mitigation:* Clear UI notice explaining webhook reconciliation and auto-polling on the invoices page.  
   *Future enhancement:* Introduce a short-polling status check on the claim page (`GET /auth/claim-status?email=...`) that automatically refreshes once the invoice settles.
2. **Dedicated Vault Backend:**  
   Clients currently share secrets via secure single-use links or direct communication with their assigned systems engineer.  
   *Future enhancement:* Implement an encrypted vault module backed by AWS KMS or HashiCorp Vault.
3. **Legacy Token Invalidation:**  
   The introduction of the `claim_` and `magic_` token prefixes intentionally invalidates any outstanding legacy magic links issued prior to this deployment. This is standard and acceptable given the 15-minute TTL.

---

## 6. Verification & Test Matrix

Both the API and Web applications compile cleanly with zero TypeScript errors and pass all automated tests:

### 6.1 Test Execution Results

```bash
# 1. Web application typecheck
apps/web > npm run typecheck
> @bazionweb/web@1.0.0 typecheck
> tsc --noEmit
# Result: Clean (exit code 0)

# 2. API application typecheck
apps/api > npx tsc --noEmit -p tsconfig.json
# Result: Clean (exit code 0)

# 3. Guard unit tests
apps/api > npm test -- --runInBand src/common/guards/__tests__/subscription.guard.spec.ts
PASS src/common/guards/__tests__/subscription.guard.spec.ts
  SubscriptionGuard
    √ returns false when no user is attached to the request
    √ bypasses client entitlement checks for ADMIN staff
    √ bypasses client entitlement checks for SUPPORT staff
    √ bypasses client entitlement checks for SUPER_ADMIN staff
    √ allows an ACTIVE client without active subscriptions
    √ allows a client with a live ACTIVE subscription
    √ denies a deleted client even if status was ACTIVE
    √ denies an unclaimed/unpaid guest without active subscriptions
    √ denies a user with no matching client record
# Result: 9 passed, 9 total

# 4. Auth & pay-first unit tests
apps/api > npm test -- --runInBand src/modules/auth/__tests__/auth.service.spec.ts
PASS src/modules/auth/__tests__/auth.service.spec.ts
  AuthService (local provider) ... [PASS]
  AuthService (keycloak provider) ... [PASS]
  AuthService.setUserPassword() ... [PASS]
  AuthService.pay-first flows (claim + magic link)
    √ claimAccount consumes the emailed token, sets a password, and returns a session
    √ claimAccount refuses to run without an emailed claim token
    √ claimAccount refuses an invalid, expired, or reused token
    √ claimAccount refuses a token issued for a different email
    √ claimAccount refuses emails without paid evidence
    √ claimAccount refuses an email that already has a password
    √ claimAccount refuses when another tab already consumed the token
    √ requestClaimLink only emails paid, unclaimed accounts
    √ requestMagicLink only mints a token for claimed accounts
    √ verifyMagicLink consumes the token and returns a real session
    √ verifyMagicLink revokes and rejects a token for an unclaimed guest
    √ verifyMagicLink rejects unknown, revoked, expired, or claim-purpose tokens
    √ login embeds the subscriptionStatus claim
# Result: 28 passed, 28 total

# 5. Full API test suite
apps/api > npm test -- --runInBand
# Result: 17 Test Suites passed, 207 Tests passed (exit code 0)
```

---

## 7. Conclusion

BazionWeb's client journey is now robust, secure, and production-ready. The payment-first flow minimizes customer acquisition friction while guaranteeing that access to engineering services, hosting infrastructure, and support workflows is strictly gated by verified financial settlement and cryptographic token proofs.
