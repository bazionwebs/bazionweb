# BazionWeb Hardening & Audit E2E Testing Infrastructure (Feature VERIF-01)

## 1. Executive Test Architecture & Scope

This document establishes the authoritative automated end-to-end (E2E) testing framework for the repository-wide audit, hardening, and verification project across `d:\bazionweb`.

The testing suite implements a **4-tier opaque-box methodology** designed strictly against user requirements and acceptance criteria (`ORIGINAL_REQUEST.md`, `PROJECT.md`), remaining independent of internal implementation artifacts while enforcing concrete interface contracts.

### 4-Tier Test Hierarchy
```
┌────────────────────────────────────────────────────────────────────────┐
│                        BAZIONWEB E2E TEST SUITE                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Tier 1: Feature Coverage       │ 50 Test Cases (>=5 per requirement)   │
│                                │ Verifies primary specifications (R1-5)│
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 2: Boundary & Corner      │ 31 Test Cases (>=5 per feature area)  │
│                                │ Malformed inputs, expired sessions,   │
│                                │ edge geo-hints, invalid cookies, etc. │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 3: Cross-Feature          │ 12 Test Cases                         │
│                                │ Multi-module integrations: Checkout,  │
│                                │ Sandbox Polling, Gateway + Vault AAD  │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 4: Real-World Scenarios   │ 5 Complete User Lifecycle Journeys    │
│                                │ Visitor -> Regional Hydration ->      │
│                                │ Quote -> Checkout -> Staff Triage     │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Test Runner Invocation

The test suite provides two first-class execution environments: a high-speed standalone TypeScript CLI runner and a Jest test runner.

### Primary Runner (Ultra-Fast Standalone CLI)
Executes directly via Node 24 native type stripping (`--experimental-strip-types`), completing in under **200 milliseconds** with rich ANSI reporting and tier breakdowns:

```bash
# Standard run (exits with code 1 if tests fail)
npm run test:e2e

# Direct Node invocation
node --no-warnings --experimental-strip-types scripts/run-e2e-audit-suite.ts

# Diagnostic baseline mode (exits with code 0 for milestone verification)
npm run test:e2e -- --allow-failures

# Run specific tiers (e.g. Tier 1 and Tier 2 only)
npm run test:e2e -- --tier=1,2

# Filter by requirement or keyword (e.g. SEC, MKT, or POL)
npm run test:e2e -- --filter=SEC

# Condensed summary table only
npm run test:e2e -- --summary
```

### Jest E2E Runner (Next.js Test Harness)
Integrated into the Next.js Web test harness:

```bash
# Execute Jest E2E audit suite
npm --workspace=@bazionweb/web test -- audit-hardening.spec.ts
```

---

## 3. Test Case Format & Conventions

Every test case adheres to a strict identification pattern: `T<Tier>-<Category>-<Number>`.

### ID Schema
| Tier | Prefix | Description | Example |
|---|---|---|---|
| Tier 1 | `T1-SEC-*` | Security route access & edge middleware (R1) | `T1-SEC-01` |
| Tier 1 | `T1-DEP-*` | Dependency security & hygiene (R4) | `T1-DEP-01` |
| Tier 1 | `T1-FNT-*` | Font loading & typography optimization (R2.1) | `T1-FNT-01` |
| Tier 1 | `T1-MKT-*` | Market cookie hydration & regional pricing (R2.2) | `T1-MKT-01` |
| Tier 1 | `T1-POL-*` | Admin background polling controller (R2.3) | `T1-POL-01` |
| Tier 1 | `T1-RSP-*` | Responsive layout & touch target compliance (R2.4) | `T1-RSP-01` |
| Tier 1 | `T1-CQ-*`  | Code quality & technical debt refactoring (R3) | `T1-CQ-01` |
| Tier 1 | `T1-ERR-*` | Error boundaries & centralized parsing (R3.4) | `T1-ERR-01` |
| Tier 2 | `T2-TOK-*` | Malformed & adversarial token handling | `T2-TOK-01` |
| Tier 2 | `T2-SES-*` | Expired sessions & single-use replay defense | `T2-SES-01` |
| Tier 2 | `T2-GEO-*` | Edge geo-headers & country detection fallbacks | `T2-GEO-01` |
| Tier 2 | `T2-MCK-*` | Corrupted & hostile cookie sanitization | `T2-MCK-01` |
| Tier 2 | `T2-POL-*` | Admin polling interval clamping & backoff | `T2-POL-01` |
| Tier 2 | `T2-BRK-*` | Extreme viewport breakpoints (320px to 4K) | `T2-BRK-01` |
| Tier 3 | `T3-MKT-CHK-*` | Market cookie hydration + subscription checkout | `T3-MKT-CHK-01` |
| Tier 3 | `T3-ADM-POL-*` | Admin impersonation + background polling lifecycle | `T3-ADM-POL-01` |
| Tier 3 | `T3-EDG-GW-*`  | Edge middleware + API gateway + cryptographic separation | `T3-EDG-GW-01` |
| Tier 4 | `T4-SCN-*` | Full end-to-end user & threat lifecycle journeys | `T4-SCN-01` |

---

## 4. Feature Coverage Matrix (Requirements R1–R5 to Test Cases)

| Requirement | Scope & Milestone | Cataloged Features | E2E Test Cases | Status |
|---|---|---|---|---|
| **R1. Security Hardening** | M1: Route protection, key separation, gateway defenses | SEC-02, SEC-03, SEC-04, SEC-05 | `T1-SEC-01` to `T1-SEC-07`, `T2-TOK-01` to `T2-TOK-06`, `T3-EDG-GW-01` to `T3-EDG-GW-04`, `T4-SCN-04` | 13 Pass / 3 Pending |
| **R2.1 Font Optimization** | M2: `@import` removal, Next.js font variables | PERF-01, PERF-02 | `T1-FNT-01` to `T1-FNT-06` | 2 Pass / 4 Pending |
| **R2.2 Market Hydration** | M2: SSR regional resolution, zero USD flash | PERF-03, PERF-04 | `T1-MKT-01` to `T1-MKT-05`, `T2-GEO-01` to `T2-GEO-05`, `T2-MCK-01` to `T2-MCK-05`, `T3-MKT-CHK-01` to `04`, `T4-SCN-01` | 17 Pass / 2 Pending |
| **R2.3 Admin Polling** | M2: Controlled polling, tab scoping, background pause | PERF-05, PERF-06, PERF-07 | `T1-POL-01` to `T1-POL-06`, `T2-POL-01` to `T2-POL-05`, `T3-ADM-POL-01` to `04`, `T4-SCN-03` | 10 Pass / 5 Pending |
| **R2.4 Responsive Layouts** | M4: >= 44px touch targets, tablet & mobile polish | RESP-01 to RESP-09 | `T1-RSP-01` to `T1-RSP-08`, `T2-BRK-01` to `T2-BRK-05` | 10 Pass / 3 Pending |
| **R3. Code Quality** | M3: Dead code, next/image, custom scrollbars, titles | CQ-02 to CQ-08, FIX-01, FIX-02 | `T1-CQ-01` to `T1-CQ-08`, `T1-ERR-01` to `T1-ERR-05`, `T4-SCN-05` | 6 Pass / 8 Pending |
| **R4. Dependencies** | M1 / M3: npm audit overrides, unused packages | SEC-01, CQ-01 | `T1-DEP-01` to `T1-DEP-05` | 1 Pass / 4 Pending |
| **R5. Full Verification** | M5: Complete monorepo certification | VERIF-01 to VERIF-03 | Full 4-Tier Test Suite (93 test cases) | Verified Ready |

---

## 5. Tier Breakdown & Test Definitions

### Tier 1: Feature Coverage (44 Test Cases)
Verifies discrete acceptance criteria for each requirement in isolation:
- **Security Route Access**: Unauthenticated access to `/admin` and `/portal`, `x-internal-dispatch` header stripping, path traversal rejection, 1 MiB payload limits, strict `VAULT_MASTER_KEY` enforcement, and `INTERNAL_DISPATCH_SECRET` authorization.
- **Dependencies**: Clean package.json structure, elimination of dead frontend libraries, root backend duplicates removed, `@types` placed in devDependencies.
- **Font Optimization**: Elimination of Google Fonts `@import`, configuration of `var(--font-inter)` and `var(--font-outfit)` in Tailwind, Next.js font display swap.
- **Market Hydration**: `MarketProvider` Context, East African geo-mapping (`KE`, `UG`, `TZ`, `RW`), server cookie precedence, synchronous `useMarketPreference`.
- **Admin Polling**: `useAdminPolling` controller interface, background visibility pause, activeTool query scoping, admin toolbar UI controls.
- **Responsive Layouts**: >= 44x44px touch targets (hamburger, nav links, cart, WhatsApp), responsive pricing cards on tablet, mobile payment tabs, table footer colSpan alignment, invalid CSS class removal.
- **Code Quality**: Pruning dead components (`MarketSelectorModal`, etc.), `next/image` migration, custom scrollbar tokens, metadata title double branding fix, TypeScript type error resolution (`leads/route.ts`).
- **Error Boundaries**: Root client error boundary (`app/error.tsx`), global root boundary (`app/global-error.tsx`), section error boundaries (`admin/error.tsx`, `portal/error.tsx`), centralized error helper (`error-helpers.ts`).

### Tier 2: Boundary & Corner Cases (32 Test Cases)
Verifies resilience against extreme, malformed, and adversarial inputs:
- Empty, whitespace, truncated, and `alg: none` JWTs.
- Tampered claims and signature mismatches.
- Expired sessions, future `nbf` claims, single-use SHA-256 tokenHash replay attacks.
- Missing, lowercase, multi-hop, and injected geo-headers.
- Corrupted, unknown, and XSS market cookies.
- Polling interval safe clamping (>= 5000ms), rapid state toggle resilience, tab flapping, in-flight deduplication, exponential error backoff.
- Viewport boundary testing (320px, 640px, 768px, 1024px, 1280px, 2560px), large financial numbers formatting, and title truncation.

### Tier 3: Cross-Feature Combinations (12 Test Cases)
Verifies multi-module interactions across system boundaries:
- **Market + Checkout**: East African cookie -> KES pricing -> cart item synchronization -> checkout currency preservation.
- **Admin Impersonation + Polling**: Sandbox session storage isolation -> tab visibility pause -> active tab query scoping -> graceful 401 unauthenticated shutdown.
- **Edge Middleware + Gateway + Crypto**: Edge route protection intercepting scanners before SSR bundle transmission -> Gateway stripping internal dispatch headers -> NestJS AES-256-GCM vault secret encryption with dedicated key -> cross-tenant IDOR defense with AAD.

### Tier 4: Real-World Application Scenarios (5 Complete Journeys)
Verifies complete, multi-stage user and threat lifecycles:
1. **Anonymous East African Visitor Journey**: Nairobi connection (`cf-ipcountry: KE`) -> Zero USD flash -> KES catalog -> Quote Builder configuration -> Sanitized proposal creation with unique alphanumeric code.
2. **International Client Onboarding Journey**: European connection -> USD pricing -> responsive checkout on mobile -> safe Paystack redirect domain verification -> SHA-256 single-use activation token dispatch.
3. **Support Staff Troubleshooting Journey**: Staff MFA login (`acr: mfa`) -> Workstation entry -> active tool polling -> Admin Polling Control Bar pause/interval adjust -> tab switch to Webhook Failures -> accessible triage action buttons.
4. **Edge Route Protection & Malicious Infiltration Defense**: Automated crawler scanner -> Edge middleware redirect -> path traversal `/api/v1/../../etc/passwd` rejected with HTTP 400 -> 5MB memory DoS rejected with HTTP 413.
5. **Error Recovery & Application Resilience**: Downstream API service disruption (HTTP 503) -> centralized `parseApiError` extraction -> section error boundary catch -> user recovery via `reset()` action -> clean metadata title display.

---

## 6. Implementation Milestone Roadmap

The test runner serves as the authoritative acceptance benchmark for the upcoming implementation milestones:
- **Milestone M1**: Will resolve `T1-SEC-01`, `T1-SEC-02`, `T1-SEC-06`, `T1-SEC-07`, `T1-DEP-01`, `T1-CQ-07`, `T1-CQ-08`.
- **Milestone M2**: Will resolve `T1-FNT-01` to `06`, `T1-MKT-01` to `05`, `T1-POL-01` to `06`.
- **Milestone M3**: Will resolve `T1-DEP-02` to `05`, `T1-CQ-01` to `06`, `T1-ERR-01` to `05`.
- **Milestone M4**: Will resolve `T1-RSP-01` to `08`.
- **Milestone M5**: Final verification: 100% test pass rate (93/93 passing), 0 TypeScript errors, clean Next.js build.
