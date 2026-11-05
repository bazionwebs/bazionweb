# Project: BazionWeb Admin Troubleshooting Suite & Client View-As Sandbox Hardening

## Architecture
- **Monorepo Architecture**:
  - `apps/web`: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons, Zustand state stores (`auth.store.ts`), TanStack React Query (`useAdminData.ts`), Axios client (`lib/api.ts`).
  - `apps/api`: NestJS, Prisma ORM, PostgreSQL, Passport JWT, Node crypto, Node dns/tls, Paystack SDK, Safaricom Daraja SDK, Dokploy Provider.
- **Client View-As Sandbox Data Flow**:
  1. **Admin Launch**: Admin navigates to `/admin/troubleshooting?tab=impersonation` (or `/admin/troubleshooting?impersonate=${clientId}`). Selects client -> clicks "Mint Scoped Session" -> `adminApi.impersonateClient(clientId)`.
  2. **Impersonation JWT Generation**: Backend `AdminDiagnosticsService.impersonateClient` signs 15-minute token with `sub: client.user.id`, `clientId: client.id`, `clientBusinessName: client.businessName`, `realm_access.roles: ['CLIENT']`, `impersonatedBy: staffUser.email`, `isSandbox: true`. Logs to `AuditLog`.
  3. **Tab-Isolated Handover**: Admin clicks "Open Client Portal Sandbox" -> `window.open('/portal?sandbox_token=' + encodeURIComponent(token), '_blank', 'noopener,noreferrer')`.
  4. **Isolated Storage**: Portal tab loads -> `auth.store.ts` extracts `sandbox_token`, sets `sessionStorage.setItem('bazionweb_sandbox_active', 'true')`, saves token to `sessionStorage` only, purges `sandbox_token` from URL bar via `window.history.replaceState`. Bypasses `localStorage` completely and suppresses cross-tab `storage` events. Admin tab's `localStorage` remains completely untouched.
  5. **Live Client Data Rendering**: Portal requests send `Authorization: Bearer <sandbox_token>`. Endpoints query `where: { userId: client.user.id }` and render real projects, invoices, milestones, hosting, and tickets.
  6. **Sandbox Banner & Exit**: `PortalShell` renders prominent audited Sandbox banner with client identity, staff auditor email, session countdown, and "Exit Sandbox" button that clears `sessionStorage` and closes the tab.
- **Admin Troubleshooting & One-Click Remediation Flow**:
  1. Diagnostic checks in `AdminDiagnosticsService` evaluate 6 operational issue domains: orphan payments, DNS/SSL misconfigurations, failed webhooks, unsynced invoice totals, client credential lockouts, suspended domain states.
  2. One-click transactional remediation endpoints execute resolution without manual DB intervention, record `AuditLog` entries, and return immediate structured UI feedback.
- **Proactive Intelligence Flow**:
  1. Page-load scan and on-demand "Run Proactive Health Scan" trigger `GET /admin/diagnostics/proactive-scan`.
  2. Evaluates 4 proactive anomaly rules: SSL expiry <= 7 days, failed webhook bursts (>= 3 in 60 min), unapplied payments, pending deposits with expired quotes.
  3. Surfaces actionable anomaly cards with direct one-click remediation shortcuts in the dashboard.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Sandbox Tab Isolation & Token Handover | Pass `?sandbox_token=...` on portal launch; isolate storage to `sessionStorage` only when sandbox is active; bypass `localStorage` writes and suppress cross-tab `storage` events in `auth.store.ts`; purge token from URL | M1 | R1 / Survey 1 |
| 2 | Sandbox Live Client Data & Guard Bypass | Enrich impersonation JWT with `clientId`, `clientBusinessName`, `isSandbox`, and `impersonatedBy`; update backend `JwtAuthGuard` and `SubscriptionGuard` and frontend `AuthGuard` to honor staff impersonator bypass for pending/trial clients | M1 | R1 / Survey 1 |
| 3 | Audited Sandbox Banner & Exit Action | Implement high-contrast audited Sandbox banner in `PortalShell` with client identity, auditor identity, session countdown, and Exit Sandbox action that clears `sessionStorage` and closes tab | M1 | R1 / Survey 1 |
| 4 | Admin Troubleshooting Client Deep-Link | Read `?impersonate=${clientId}` on `/admin/troubleshooting` to auto-switch to impersonation tab and pre-select target client | M1 | R1 / Survey 1 |
| 5 | Orphan & Unapplied Payments Diagnostic & Remediation | Query orphan/unapplied payments; implement `POST /admin/diagnostics/remediate-orphan` with `LINK_AND_SETTLE` and `CREDIT_CLIENT` transactional remediation | M2 | R2 / Survey 2 |
| 6 | Fleet DNS & SSL Misconfiguration Diagnostic & Remediation | Scan `HostingAccount` domains with DNS lookups and TLS socket handshake; implement `POST /admin/diagnostics/remediate-dns-ssl` with `REFRESH_SSL` and `REISSUE_SSL` | M2 | R2 / Survey 2 |
| 7 | Failed Webhook Retries Diagnostic & Batch Remediation | Query failed/stale `PaymentLog` entries; implement `POST /admin/diagnostics/webhooks/retry-batch` and enhanced single replay with structured status feedback | M2 | R2 / Survey 2 |
| 8 | Unsynced Invoice Totals Diagnostic & Remediation | Query invoices with line-item discrepancies or payment-status mismatches; implement `POST /admin/diagnostics/remediate-invoice-sync` with `SYNC_FROM_PAYMENTS` and `RECALCULATE_FROM_ITEMS` | M2 | R2 / Survey 2 |
| 9 | Client Credential & Access Lockouts Diagnostic & Remediation | Query suspended clients and deactivated/passwordless users; implement `POST /admin/diagnostics/remediate-client-access` with `UNLOCK_ACCOUNT` and `GENERATE_RESET_LINK` | M2 | R2 / Survey 2 |
| 10 | Suspended Domain States Diagnostic & Remediation | Query inconsistent suspended domains; implement `POST /admin/diagnostics/remediate-domain-state` with `UNSUSPEND` and `NORMALIZE_STATUS` | M2 | R2 / Survey 2 |
| 11 | Admin Troubleshooting Workstation UI | Refactor `apps/web/src/app/admin/troubleshooting/page.tsx` with dedicated diagnostic tabs, live issue tables, instant one-click remediation buttons, loading spinners, and React Query cache invalidation | M2 | R2 / Survey 2 |
| 12 | Proactive Diagnostic Scanner Backend | Implement `GET /admin/diagnostics/proactive-scan` detecting SSL expiry <= 7 days, webhook bursts (>=3 failures in 60 min), unapplied payments, and pending deposits with expired quotes | M3 | R3 / Survey 3 |
| 13 | Proactive Anomaly Detection UI & Remediation Shortcuts | Integrate automatic scan on page load and on-demand "Run Proactive Health Scan" button in Admin Troubleshooting dashboard; render actionable anomaly cards with direct one-click fix triggers | M3 | R3 / Survey 3 |
| 14 | Automated Verification Suite & Standalone Test Runner | Automated tests in `apps/api` (`diagnostics.spec.ts`) and `apps/web`, plus standalone verification runner script `scripts/verify-troubleshooting-proactive.ts` covering sandbox isolation, all 6 troubleshooting tools, and all 4 proactive rules | M4 | AC / Survey 3 |
| 15 | Secure Manual Client Account Provisioning Backend | Atomic `Client` + `User` creation, invitation/claim token generation, welcome email trigger, initial project & milestone init, and audit logging via `POST /api/v1/admin/clients/provision-manual` | M2 | User Follow-up |
| 16 | Admin Manual Client Account Creation Modal UI | Modal in `apps/web/src/app/admin/clients` for entering client details (name, email, business, phone, tier, market/currency) with immediate claim link display and copy trigger | M2 | User Follow-up |
| 17 | Troubleshooting Manual Account Sync & Remediation | Diagnostic check and one-click tools to resend claim activation link, sync onboarding steps, and verify linked user record state | M2 | User Follow-up |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Client View-As Sandbox Tab Isolation & Live Client Data | Features 1, 2, 3, 4 (`auth.store.ts`, `PortalShell.tsx`, `diagnostics.service.ts`, `jwt-auth.guard.ts`, `subscription.guard.ts`, `AuthGuard.tsx`, `troubleshooting/page.tsx`) | None | DONE |
| M2 | Comprehensive Admin Troubleshooting Suite, Remediation & Synced Manual Client Provisioning | Features 5, 6, 7, 8, 9, 10, 11, 15, 16, 17 (`diagnostics.service.ts`, `diagnostics.controller.ts`, `diagnostics.dto.ts`, `clients.service.ts`, `clients.controller.ts`, `useAdminData.ts`, `api.ts`, `troubleshooting/page.tsx`, `ManualClientCreateModal.tsx`) | M1 | DONE |
| M3 | Proactive Intelligence & Anomaly Remediation | Features 12, 13 (Proactive scan service methods, `proactive-scan` endpoint, page-load trigger, anomaly cards with one-click fix buttons) | M2 | DONE |
| M4 | Final Validation Milestone: Automated Verification & Forensic Certification | Feature 14 (Automated Jest test suites, standalone verification script, Next.js build, TypeScript compilation, forensic audit verification) | M1, M2, M3 | DONE |

## Interface Contracts
### Impersonation Scoped Token Contract
- **Payload**:
  ```typescript
  {
    sub: string;               // client.user.id
    email: string;             // client.user.email
    given_name: string;
    family_name: string;
    clientId: string;          // client.id
    clientBusinessName: string;
    realm_access: { roles: ['CLIENT'] };
    subscriptionStatus: string;
    impersonatedBy: string;    // staffUser.email
    isSandbox: true;
  }
  ```

### Proactive Scan API Contract
- **Route**: `GET /api/v1/admin/diagnostics/proactive-scan`
- **Access**: `@Roles('ADMIN', 'SUPER_ADMIN')`
- **Response**:
  ```typescript
  {
    success: true,
    scannedAt: string,
    summary: {
      totalAnomalies: number,
      critical: number,
      warning: number,
      info: number
    },
    anomalies: Array<{
      id: string,
      rule: 'SSL_EXPIRING_7D' | 'WEBHOOK_BURST' | 'UNAPPLIED_PAYMENT' | 'EXPIRED_QUOTE_DEPOSIT',
      severity: 'CRITICAL' | 'WARNING' | 'INFO',
      title: string,
      description: string,
      resourceId: string,
      metadata: Record<string, any>,
      remediationAction: string,
      remediationPayload: Record<string, any>
    }>
  }
  ```

### Troubleshooting Remediation Endpoint Contracts
- `POST /api/v1/admin/diagnostics/remediate-orphan`: `{ paymentLogId: string, targetInvoiceId?: string, targetClientId?: string, action: 'LINK_AND_SETTLE' | 'CREDIT_CLIENT' }`
- `POST /api/v1/admin/diagnostics/remediate-dns-ssl`: `{ domain: string, hostingAccountId?: string, action: 'REFRESH_SSL' | 'REISSUE_SSL' }`
- `POST /api/v1/admin/diagnostics/webhooks/retry-batch`: `{ windowHours?: number }`
- `POST /api/v1/admin/diagnostics/remediate-invoice-sync`: `{ invoiceId: string, action: 'SYNC_FROM_PAYMENTS' | 'RECALCULATE_FROM_ITEMS' }`
- `POST /api/v1/admin/diagnostics/remediate-client-access`: `{ clientId: string, action: 'UNLOCK_ACCOUNT' | 'GENERATE_RESET_LINK' }`
- `POST /api/v1/admin/diagnostics/remediate-domain-state`: `{ hostingAccountId: string, action: 'UNSUSPEND' | 'NORMALIZE_STATUS' }`

## Code Layout
- Frontend:
  - `apps/web/src/store/auth.store.ts`: Sandbox tab isolation, sessionStorage persistence, cross-tab event suppression.
  - `apps/web/src/components/portal/PortalShell.tsx`: Audited Sandbox banner with countdown and Exit action.
  - `apps/web/src/components/auth/AuthGuard.tsx`: Sandbox impersonation guard bypass.
  - `apps/web/src/app/admin/troubleshooting/page.tsx`: Full troubleshooting suite UI, sandbox launcher, proactive scanner deck.
  - `apps/web/src/hooks/useAdminData.ts`: React Query hooks for diagnostics, proactive scans, and remediation mutations.
  - `apps/web/src/lib/api.ts`: Axios client endpoints for admin diagnostics and remediation.
- Backend:
  - `apps/api/src/modules/diagnostics/diagnostics.controller.ts`: Endpoints for diagnostics, proactive scans, and remediation.
  - `apps/api/src/modules/diagnostics/diagnostics.service.ts`: Diagnostic detection methods, transactional remediation logic, proactive rules scanner.
  - `apps/api/src/modules/diagnostics/dto/diagnostics.dto.ts`: Validation DTOs for remediation actions.
  - `apps/api/src/common/guards/jwt-auth.guard.ts`: Decodes `clientId`, `isSandbox`, and `impersonatedBy`.
  - `apps/api/src/common/guards/subscription.guard.ts`: Allows `isSandbox` / `impersonatedBy` sessions to view client workspaces.
- Tests & Verification:
  - `apps/api/src/modules/diagnostics/diagnostics.spec.ts`: Unit/integration tests for troubleshooting and proactive rules.
  - `scripts/verify-troubleshooting-proactive.ts`: Standalone end-to-end verification script.
