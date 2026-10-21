# Client Purchase Journey Audit — Package Selection → Payment → Account → Dashboard

Date: 21 Oct 2026 · Scope: web checkout, registration, magic link, onboarding, billing API, webhooks

## Loopholes found (honest list)

1. **Paid card customers got nothing provisioned.**
   `apps/web/src/app/api/paystack/webhook/route.ts` verified the HMAC but only `console.log`-ged
   `charge.success`. The API's `webhooks.controller.ts` Paystack branch marked the invoice PAID
   but never created/activated a `Subscription` (only the IntaSend branch did). Money in, no access.

2. **Client-side entitlement spoofing.**
   `checkout/verify/page.tsx:42` set `setSubscriptionStatus('ACTIVE')` in the browser store purely
   from a successful Paystack redirect — no server state. `portal/login/verify` decoded the magic
   token with client-side `atob` and minted a fake session (`magic-jwt-${Date.now()}`) without any
   signature check. A user could invent a session by hand.

3. **Hardcoded fallback signing secret.**
   `api/auth/magic-link` signed tokens with `JWT_SECRET || PAYSTACK_SECRET_KEY || 'bazion-magic-token-secret-2026'`
   and tokens were non-revocable HMAC blobs.

4. **Payments without invoices.**
   `api/paystack/initialize` priced in the Next process and charged Paystack directly — no invoice
   row, no client row → webhook could never match the transaction and the client could never be
   re-priced/reconciled. Prices were also copied in 6 places (checkout catalog, pricingData,
   priceBooks, quote defaults, SEO JSON-LD, seed $49/99/199 vs checkout $29/59/119/299).

5. **Simulated registration.**
   `portal/register` created an in-memory "client" that never existed server-side, while the real
   dashboard gate (`AuthGuard`) blocked anyone without `subscriptionStatus` — so new clients could
   pay, then still be locked out.

6. **Conflicting annual prices.** Onboarding showed growth annual 82,800 vs checkout 77,000;
   business 166,800 vs 155,000; enterprise/checkout plans duplicated drift.

## Best-practice benchmark (Stripe docs, Baymard Institute, Shopify Pay/Amazon patterns)

- **Guest-first checkout**: forcing account creation causes 19–26% checkout abandonment
  (Baymard: avg 4 extra fields = −160% completion). Sites that convert best collect the account
  *after* payment, in one step.
- **Webhook = source of truth.** Never treat the success redirect as entitlement (Stripe's
  documented guidance); reconciliation belongs server-side, idempotent, keyed on the provider ref.
- **Server-side pricing.** Client sends intent (plan id + cycle), server re-prices from the
  pricebook — tamper-proof amounts.
- **Single-use, expiring, revocable auth tokens** (magic links) — opaque DB-backed strings beat
  self-decoding JWTs for one-shot links.
- **Clear hand-off**: promise on the payment page exactly what happens next (password step), no
  surprise sign-up walls after success.

## What was implemented

### API (`apps/api`)
- `webhooks.controller.ts`: extracted `activatePaidSubscription(tx, invoice, opts)` — shared by
  IntaSend and Paystack branches; Paystack branch now activates the subscription (update-or-create,
  plan resolution: linked sub → echoed metadata.planId → client's assigned plan) AND flips
  `Client.status` to ACTIVE. Still idempotent keying (`PAYSTACK_EVENT_<ref>` / `INTASEND_EVENT_<ref>`).
- `billing.service.ts`: new `subscribePaystackGuest(dto)` — public guest card checkout: creates a
  passwordless `User` + 1:1 `Client` row keyed on email (schema `Client.userId` is required, so the
  claim step attaches credentials to *this* user), creates the invoice, initializes Paystack with
  `metadata {planId, billingCycle, clientId, guest:true}`. Server-priced via `planAmount()`.
  Route: `POST /api/v1/invoices/guest/subscribe/paystack` (`@Public`, 5/min).
- `auth.service.ts`:
  - `issueTokenPair` adds a `subscriptionStatus` claim (ACTIVE/PENDING, undefined for staff/no client).
  - `claimAccount(email, password, …)` — evidence-first: email must own an ACTIVE subscription or a
    paid invoice ≤90 days old; sets password on the passwordless user (403/409 otherwise); links
    Client; returns a real token pair.
  - `requestMagicLink` / `verifyMagicLink` — single-use 15-min tokens stored as hashed `RefreshToken`
    rows (no schema change), verified server-side, revoked on use.
  - `auth.controller`: `POST /auth/claim-account` (5/min), `POST /auth/magic-link` (3/min),
    `POST /auth/magic-link/verify` (10/min), all `@Public`.
- `prisma/seed.ts`: 7 plans with documented IDs and KES+USD prices — service tiers annual = 10×,
  Care tiers 10.8×. Safe on pre-seeded DBs (seeds by name, keeps existing PKs; fixed IDs on fresh DBs).

### Web (`apps/web`)
- `SubscriptionCheckout`: Care plans added, IDs aligned with the seed; card path now calls the API
  (authed OR guest endpoint); guest fields = email + first/last name only; pay-first explainer.
- `checkout/verify`: fake `setSubscriptionStatus('ACTIVE')` removed; success page promises the one
  "create password" step and points at `/portal/claim?ref=…&email=…`.
- `portal/claim` (new): the single post-payment account step → `POST /auth/claim-account` → session
  → dashboard. Handles 403 (not paid yet), 409 (already claimed), 429.
- `portal/register`: retired — server-redirect to `/checkout?plan=…` (all existing internal links
  stay valid).
- `api/auth/magic-link`: token minting delegated to the API; hardcoded fallback secret removed;
  Next only delivers the email (Resend lives here). Unknown emails answer identically.
- `api/paystack/webhook`: signature-verified relay → API `/webhooks/paystack` (raw bytes + original
  header) — single activation authority.
- `api/paystack/initialize`: retired with HTTP 410 (payments without invoices can never activate).
- `portal/onboarding`: JWT-authed IntaSend/Paystack endpoints, plan IDs from the seed, annual
  drift fixed; unauthenticated users now go to login (not the retired register page).
- `useAuth` stores the `subscriptionStatus` JWT claim; `AuthGuard` gate unchanged in policy but now
  grounded in server-issued claims.

## Payment-state machine (final)

```
pick plan → checkout (no forced account)
  ├─ card (guest) → API guest subscribe → invoice+client(email) → Paystack hosted
  ├─ card (signed-in) → API subscribe/paystack
  └─ M-Pesa (signed-in) → API subscribe/intasend (STK)
Paystack/IntaSend webhook (API only) → verify → invoice PAID → Subscription ACTIVE → client ACTIVE
success redirect → verify page (UI confirmation only, no entitlement)
  → /portal/claim (one step: email+password) → dashboard
returning clients → /portal/login · password OR magic link (single-use, server-verified)
```

## Accepted trade-offs / follow-ups

- Node runner EOL plan: Next 14.2 allowlist covers CVEs fixed only in 14.2.26+; upgrade to
  Next 15/16 + Node 20 LTS removes the entire block.
- `@nestjs/core` CVE-2026-35515 needs framework v12 — batch with the next dependency cycle.
- Plan tier enum lacks a `CARE` value (Care rows reuse existing tiers) — cosmetic, add later.
- Six pricing surfaces: this change sets the DB seed + checkout (SSOT is now the DB for charges);
  marketing pages (pricingData/priceBooks) belong to the pricing owner to reconcile against it.
- Bank transfer (WIRE) tab on onboarding shows static example bank details — wire details on the
  B2B invoice come from the API (`corporate-invoice/bank-transfer`); the tab is illustrative only.
- WhatsApp/phone verification remains out of scope (email is the verified claim identity).
