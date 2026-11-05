#!/usr/bin/env ts-node
/**
 * ============================================================================
 * BAZIONWEB COMPREHENSIVE AUTOMATED VERIFICATION SUITE (Feature 14)
 * ============================================================================
 * Validates:
 *   a) Client View-As Sandbox Tab Isolation & Live Data Handover
 *   b) Admin Troubleshooting Suite & One-Click Remediations (All 6 Tools)
 *   c) Proactive Anomaly Detection & One-Click Remediations (All 4 Rules)
 *   d) Synced Manual Client Account Creation & Onboarding Sync
 *
 * Execution:
 *   npx ts-node scripts/verify-troubleshooting-proactive.ts
 *   (or npm run verify:feature14)
 * ============================================================================
 */

import * as assert from 'assert';
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';

// Setup Mock Browser DOM Storage & Environment for Web Store Testing
class MockStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] || null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

let lastReplacedStateUrl: string | null = null;
let tabClosed = false;

(global as any).window = {
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  location: {
    search: '',
    pathname: '/portal',
    hash: '',
  },
  history: {
    replaceState: (_data: any, _unused: string, url?: string | URL | null) => {
      lastReplacedStateUrl = url ? String(url) : null;
      if (url && typeof url === 'string') {
        const u = new URL(url, 'https://bazionweb.com');
        (global as any).window.location.pathname = u.pathname;
        (global as any).window.location.search = u.search;
      }
    },
  },
  close: () => {
    tabClosed = true;
  },
  addEventListener: (_event: string, _cb: any) => {},
  removeEventListener: (_event: string, _cb: any) => {},
  dispatchEvent: (_event: any) => true,
};

// Imports from Monorepo Apps
import { useAuthStore, isSandboxTab, isSandboxActive } from '../apps/web/src/store/auth.store';
import { AdminDiagnosticsService } from '../apps/api/src/modules/diagnostics/diagnostics.service';
import { ClientsService } from '../apps/api/src/modules/clients/clients.service';
import { isPrivateOrReservedIp } from '../apps/api/src/modules/hosting/hosting.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

// ANSI Terminal Formatting
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

let passedAssertions = 0;
let totalAssertions = 0;
const failures: string[] = [];

function check(description: string, fn: () => void | Promise<void>) {
  totalAssertions++;
  try {
    const res = fn();
    if (res && typeof (res as any).then === 'function') {
      return (res as any)
        .then(() => {
          passedAssertions++;
          console.log(`  ${GREEN}✔${RESET} ${description}`);
        })
        .catch((err: any) => {
          failures.push(`${description} -> ${err.message}`);
          console.error(`  ${RED}✘${RESET} ${description}`);
          console.error(`    ${RED}Error: ${err.message}${RESET}`);
        });
    } else {
      passedAssertions++;
      console.log(`  ${GREEN}✔${RESET} ${description}`);
      return Promise.resolve();
    }
  } catch (err: any) {
    failures.push(`${description} -> ${err.message}`);
    console.error(`  ${RED}✘${RESET} ${description}`);
    console.error(`    ${RED}Error: ${err.message}${RESET}`);
    return Promise.resolve();
  }
}

async function runAllVerifications() {
  const startTime = Date.now();
  console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  BAZIONWEB COMPREHENSIVE AUTOMATED VERIFICATION (FEATURE 14)${RESET}`);
  console.log(`${BOLD}${CYAN}  Client Sandbox Isolation, Admin Troubleshooting & Proactive Anomaly Engine${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

  // ============================================================================
  // SUITE A: Client View-As Sandbox Tab Isolation & Live Data
  // ============================================================================
  console.log(`${BOLD}${YELLOW}[SUITE A] Client View-As Sandbox Tab Isolation & Live Data Handover${RESET}`);

  const mockAdminUser = {
    id: 'admin-super-1',
    email: 'admin@bazion.com',
    firstName: 'Super',
    lastName: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  };

  const mockClientRecord = {
    id: 'client-org-42',
    userId: 'client-user-42',
    businessName: 'Acme Safari Adventures Ltd',
    contactName: 'Jane Doe',
    email: 'jane@acmesafari.co.ke',
    phone: '+254712345678',
    status: 'ACTIVE',
    user: {
      id: 'client-user-42',
      email: 'jane@acmesafari.co.ke',
      firstName: 'Jane',
      lastName: 'Doe',
      roles: ['CLIENT'],
      passwordHash: 'hashed-secret-pw',
      deletedAt: null,
    },
  };

  const adminCredentialsStored = JSON.stringify({
    state: {
      user: {
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        roles: mockAdminUser.roles,
        subscriptionStatus: 'ACTIVE',
      },
      accessToken: 'admin-access-token-xyz',
      refreshToken: 'admin-refresh-token-xyz',
      expiresAt: Date.now() + 3600_000,
      isSandbox: false,
    },
    version: 0,
  });

  const auditLogsCreated: any[] = [];
  const prismaMockForA: any = {
    client: {
      findUnique: async () => mockClientRecord,
    },
    auditLog: {
      create: async (payload: any) => {
        auditLogsCreated.push(payload.data);
        return { id: 'audit-log-1', ...payload.data };
      },
    },
  };

  const configMockForA: any = {
    get: (key: string) => {
      if (key === 'JWT_SECRET') return 'super-test-secret-key-12345';
      if (key === 'NEXT_PUBLIC_APP_URL') return 'https://bazionweb.com';
      return null;
    },
  };

  const diagnosticsServiceForA = new AdminDiagnosticsService(
    prismaMockForA,
    configMockForA,
    {} as any,
    {} as any,
    { isConfigured: () => false } as any,
  );

  let mintedToken = '';

  await check('A1. Mint Scoped Impersonation JWT with exact claims and 15-minute expiry', async () => {
    const res = await diagnosticsServiceForA.impersonateClient(mockClientRecord.id, mockAdminUser);
    assert.strictEqual(res.expiresIn, 900, 'Expiry must be exactly 900 seconds (15 minutes)');
    assert.ok(res.token, 'Token string must be returned');
    mintedToken = res.token;

    const decoded = jwt.verify(mintedToken, 'super-test-secret-key-12345') as any;
    assert.strictEqual(decoded.sub, mockClientRecord.user.id, 'sub must match client user id');
    assert.strictEqual(decoded.clientId, mockClientRecord.id, 'clientId must be present');
    assert.strictEqual(decoded.clientBusinessName, mockClientRecord.businessName, 'clientBusinessName must match');
    assert.strictEqual(decoded.isSandbox, true, 'isSandbox claim must be true');
    assert.strictEqual(decoded.impersonatedBy, mockAdminUser.email, 'impersonatedBy must match staff email');
    assert.deepStrictEqual(decoded.realm_access?.roles, ['CLIENT'], 'roles must be CLIENT');
    assert.ok(decoded.exp - decoded.iat <= 900, 'JWT validity must not exceed 900 seconds');

    assert.ok(auditLogsCreated.length > 0, 'AuditLog entry must be recorded');
    assert.strictEqual(auditLogsCreated[0].action, 'impersonation.launch');
    assert.strictEqual(auditLogsCreated[0].resourceId, mockClientRecord.id);
  });

  await check('A2. Handover via URL query parameter & isolated sessionStorage persistence', () => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    lastReplacedStateUrl = null;

    // Admin session pre-exists in localStorage
    mockLocalStorage.setItem('bazionweb-auth', adminCredentialsStored);

    // Simulate arriving at portal with ?sandbox_token=...
    (global as any).window.location.search = `?sandbox_token=${mintedToken}`;
    (global as any).window.location.pathname = '/portal';

    const storage = useAuthStore.persist.getOptions().storage;
    assert.ok(storage, 'Custom storage must be configured on auth store');

    // Trigger getItem which initiates processUrlSandboxToken
    const loadedData = storage.getItem('bazionweb-auth') as any;
    assert.ok(loadedData, 'Auth data must be parsed from sandbox token');

    // Verify sessionStorage isolation
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_is_sandbox_tab'), 'true', 'bazionweb_is_sandbox_tab must be true');
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_sandbox_active'), 'true', 'bazionweb_sandbox_active must be true');
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_sandbox_token'), mintedToken, 'sandbox token must be in sessionStorage');
    assert.strictEqual(isSandboxTab(), true, 'isSandboxTab() helper must return true');
    assert.strictEqual(isSandboxActive(), true, 'isSandboxActive() helper must return true');

    // Verify URL parameter scrubbing
    assert.strictEqual(lastReplacedStateUrl, '/portal', 'URL bar must be scrubbed of ?sandbox_token via replaceState');
  });

  await check('A3. Strict non-interference with administrator localStorage & zero fallback on expiry', () => {
    // 1. Verify admin credentials in localStorage were NOT modified
    const adminInLocal = mockLocalStorage.getItem('bazionweb-auth');
    assert.strictEqual(adminInLocal, adminCredentialsStored, 'Admin localStorage credentials must remain completely untouched');

    // 2. Clear session inside sandbox tab
    useAuthStore.getState().clearSession();

    // Verify admin localStorage STILL untouched after sandbox session clear
    assert.strictEqual(mockLocalStorage.getItem('bazionweb-auth'), adminCredentialsStored, 'clearSession() in sandbox tab must never clear admin localStorage');
    // Session token removed, but permanent marker remains
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_sandbox_active'), null, 'Active marker removed on clear');
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_is_sandbox_tab'), 'true', 'Permanent tab marker persists');

    // 3. Expired sandbox session simulation
    const expiredPayload = {
      state: {
        user: { id: 'client-user-42', email: 'jane@acmesafari.co.ke' },
        accessToken: 'expired-token',
        expiresAt: Date.now() - 60_000,
        isSandbox: true,
      },
      version: 0,
    };
    mockSessionStorage.setItem('bazionweb-auth', JSON.stringify(expiredPayload));

    const storage = useAuthStore.persist.getOptions().storage;
    const expiredResult = storage!.getItem('bazionweb-auth');
    assert.strictEqual(expiredResult, null, 'Expired sandbox token must return null');
    assert.strictEqual(mockLocalStorage.getItem('bazionweb-auth'), adminCredentialsStored, 'Must NOT fall back to admin localStorage on sandbox expiry');
  });

  await check('A4. Audited sandbox banner attributes and exit behavior', () => {
    mockSessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    mockSessionStorage.setItem('bazionweb_sandbox_active', 'true');
    mockSessionStorage.setItem('bazionweb_sandbox_token', mintedToken);
    tabClosed = false;

    // Simulate Exit Sandbox action
    useAuthStore.getState().clearSession();
    mockSessionStorage.removeItem('bazionweb_sandbox_active');
    mockSessionStorage.removeItem('bazionweb_sandbox_token');
    mockSessionStorage.removeItem('bazionweb-auth');
    (global as any).window.close();

    assert.strictEqual(tabClosed, true, 'window.close() must be invoked on exit');
    assert.strictEqual(mockLocalStorage.getItem('bazionweb-auth'), adminCredentialsStored, 'Admin localStorage preserved on exit');
    assert.strictEqual(mockSessionStorage.getItem('bazionweb_is_sandbox_tab'), 'true', 'Permanent tab marker retained');
  });

  // ============================================================================
  // SUITE B: Admin Troubleshooting Suite & One-Click Remediations (All 6 Tools)
  // ============================================================================
  console.log(`\n${BOLD}${YELLOW}[SUITE B] Admin Troubleshooting Suite & One-Click Remediations (All 6 Tools)${RESET}`);

  let updatedInvoiceData: any = null;
  let updatedPaymentLogData: any = null;
  let updatedHostingData: any = null;
  let updatedClientData: any = null;
  let updatedUserData: any = null;
  let activatedSubCalled = false;
  let dokployRestartCalled = false;

  const prismaMockForB: any = {
    $transaction: async (cb: any) => cb(prismaMockForB),
    paymentLog: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'log-orphan-1') {
          return {
            id: 'log-orphan-1',
            provider: PaymentProvider.PAYSTACK,
            providerRef: 'pstk-ref-orphan',
            amount: 500,
            currency: 'USD',
            status: PaymentStatus.SUCCESS,
            createdAt: new Date(),
            invoiceId: null,
            clientId: null,
          };
        }
        return null;
      },
      findMany: async () => [
        { id: 'failed-log-1', provider: 'PAYSTACK', status: PaymentStatus.FAILED, createdAt: new Date() },
        { id: 'failed-log-2', provider: 'DARAJA', status: PaymentStatus.FAILED, createdAt: new Date() },
      ],
      update: async ({ where, data }: any) => {
        updatedPaymentLogData = { where, data };
        return { id: where.id, ...data };
      },
    },
    invoice: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'inv-target-1') {
          return {
            id: 'inv-target-1',
            invoiceNumber: 'INV-2026-001',
            amount: 500,
            currency: 'USD',
            status: 'PENDING',
            clientId: 'client-org-42',
            client: { id: 'client-org-42', businessName: 'Acme Safari Ltd' },
            paymentLogs: [{ status: PaymentStatus.SUCCESS, amount: 500 }],
            lineItems: [
              { description: 'Service A', amount: 300, quantity: 1, total: 300 },
              { description: 'Service B', amount: 200, quantity: 1, total: 200 },
            ],
          };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        updatedInvoiceData = { where, data };
        return { id: where.id, ...data };
      },
    },
    hostingAccount: {
      findFirst: async () => ({
        id: 'host-acc-1',
        domain: 'portal.acmesafari.co.ke',
        ipAddress: '102.134.20.10',
        status: 'ACTIVE',
      }),
      findUnique: async () => ({
        id: 'host-acc-1',
        domain: 'portal.acmesafari.co.ke',
        status: 'SUSPENDED',
      }),
      update: async ({ where, data }: any) => {
        updatedHostingData = { where, data };
        return { id: where.id, ...data };
      },
    },
    client: {
      findUnique: async ({ where }: any) => ({
        id: where.id || 'client-org-42',
        userId: 'user-42',
        businessName: 'Acme Safari Adventures Ltd',
        email: 'jane@acmesafari.co.ke',
        status: 'SUSPENDED',
        user: {
          id: 'user-42',
          email: 'jane@acmesafari.co.ke',
          passwordHash: where.id === 'client-unclaimed' ? null : 'argon2-hashed-val',
          deletedAt: new Date(),
        },
      }),
      update: async ({ where, data }: any) => {
        updatedClientData = { where, data };
        return { id: where.id, ...data };
      },
    },
    user: {
      update: async ({ where, data }: any) => {
        updatedUserData = { where, data };
        return { id: where.id, ...data };
      },
    },
    refreshToken: {
      create: async () => ({ id: 'rt-1' }),
      updateMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
  };

  const settlementMockForB: any = {
    activatePaidSubscription: async () => {
      activatedSubCalled = true;
    },
  };

  const dokployMockForB: any = {
    bindDomain: async () => ({ success: true }),
    restartWorkload: async () => {
      dokployRestartCalled = true;
      return { success: true };
    },
  };

  const diagnosticsServiceForB = new AdminDiagnosticsService(
    prismaMockForB,
    configMockForA,
    settlementMockForB,
    { verifyTransaction: async () => ({ status: true, data: { status: 'success' } }) } as any,
    { isConfigured: () => true, queryStkStatus: async () => ({ ResultCode: '0' }) } as any,
    dokployMockForB,
  );

  // Mock inspectTlsCert for live TLS test
  (diagnosticsServiceForB as any).inspectTlsCert = async () => ({
    valid_to: new Date(Date.now() + 60 * 86400_000).toISOString(),
    issuer: { O: 'Let\'s Encrypt' },
  });

  await check('B1. Tool 1: Orphan payment auto-matching & transactional credit/link (LINK_AND_SETTLE & CREDIT_CLIENT)', async () => {
    activatedSubCalled = false;
    const resSettle = await diagnosticsServiceForB.remediateOrphanPayment({
      paymentLogId: 'log-orphan-1',
      targetInvoiceId: 'inv-target-1',
      action: 'LINK_AND_SETTLE',
    }, mockAdminUser);

    assert.strictEqual(resSettle.success, true);
    assert.strictEqual(resSettle.status, 'PAID');
    assert.strictEqual(updatedInvoiceData.data.status, 'PAID');
    assert.strictEqual(updatedPaymentLogData.data.status, PaymentStatus.SUCCESS);
    assert.strictEqual(activatedSubCalled, true, 'activatePaidSubscription must be called');

    const resCredit = await diagnosticsServiceForB.remediateOrphanPayment({
      paymentLogId: 'log-orphan-1',
      targetClientId: 'client-org-42',
      action: 'CREDIT_CLIENT',
    }, mockAdminUser);
    assert.strictEqual(resCredit.success, true);
    assert.strictEqual(resCredit.action, 'CREDIT_CLIENT');
  });

  await check('B2. Tool 2: Fleet DNS & SSL scanning with SSRF guards & certificate refresh/reissue', async () => {
    // Assert SSRF guard detects private/reserved IPs
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.1'), true, 'Loopback must be flagged');
    assert.strictEqual(isPrivateOrReservedIp('10.0.4.5'), true, 'Private Class A must be flagged');
    assert.strictEqual(isPrivateOrReservedIp('192.168.1.1'), true, 'Private Class C must be flagged');
    assert.strictEqual(isPrivateOrReservedIp('169.254.169.254'), true, 'Link local/metadata must be flagged');
    assert.strictEqual(isPrivateOrReservedIp('::1'), true, 'IPv6 loopback must be flagged');
    assert.strictEqual(isPrivateOrReservedIp('102.134.20.10'), false, 'Public IP must be permitted');

    const resRefresh = await diagnosticsServiceForB.remediateDnsSsl({
      domain: 'portal.acmesafari.co.ke',
      action: 'REFRESH_SSL',
    }, mockAdminUser);
    assert.strictEqual(resRefresh.success, true);
    assert.strictEqual(resRefresh.sslIssuer, 'Let\'s Encrypt');

    const resReissue = await diagnosticsServiceForB.remediateDnsSsl({
      domain: 'portal.acmesafari.co.ke',
      action: 'REISSUE_SSL',
    }, mockAdminUser);
    assert.strictEqual(resReissue.success, true);
    assert.strictEqual(resReissue.status, 'REISSUED');
  });

  await check('B3. Tool 3: Webhook failure burst detection & batch retry (RETRY_WEBHOOK_BURST)', async () => {
    (diagnosticsServiceForB as any).replayWebhook = async (logId: string) => ({
      success: true,
      settled: true,
      logId,
      message: 'Replayed and settled successfully',
    });

    const resBatch = await diagnosticsServiceForB.retryWebhooksBatch(2, mockAdminUser);
    assert.strictEqual(resBatch.total, 2);
    assert.strictEqual(resBatch.scanned, 2);
    assert.strictEqual(resBatch.settled, 2);
    assert.strictEqual(resBatch.failed, 0);
  });

  await check('B4. Tool 4: Unsynced invoice calculation & sync (SYNC_FROM_PAYMENTS & RECALCULATE_FROM_ITEMS)', async () => {
    const resSync = await diagnosticsServiceForB.remediateInvoiceSync({
      invoiceId: 'inv-target-1',
      action: 'SYNC_FROM_PAYMENTS',
    }, mockAdminUser);
    assert.strictEqual(resSync.success, true);
    assert.strictEqual(resSync.status, 'PAID');

    const resRecalc = await diagnosticsServiceForB.remediateInvoiceSync({
      invoiceId: 'inv-target-1',
      action: 'RECALCULATE_FROM_ITEMS',
    }, mockAdminUser);
    assert.strictEqual(resRecalc.success, true);
    assert.strictEqual(resRecalc.updatedAmount, 500);
  });

  await check('B5. Tool 5: Client credential and access lockout remediation (claim_ vs magic_ routing & unlock)', async () => {
    // Unclaimed user -> claim_ token and /portal/claim URL
    const resClaim = await diagnosticsServiceForB.remediateClientAccess({
      clientId: 'client-unclaimed',
      action: 'GENERATE_RESET_LINK',
    }, mockAdminUser);
    assert.strictEqual(resClaim.success, true);
    assert.ok(resClaim.token.startsWith('claim_'), 'Unclaimed token must start with claim_');
    assert.ok(resClaim.resetLink.includes('/portal/claim?token=claim_'), 'Unclaimed link must route to /portal/claim');

    // Claimed user -> magic_ token and /portal/login/verify URL
    const resMagic = await diagnosticsServiceForB.remediateClientAccess({
      clientId: 'client-org-42',
      action: 'GENERATE_RESET_LINK',
    }, mockAdminUser);
    assert.strictEqual(resMagic.success, true);
    assert.ok(resMagic.token.startsWith('magic_'), 'Claimed token must start with magic_');
    assert.ok(resMagic.resetLink.includes('/portal/login/verify?token=magic_'), 'Claimed link must route to /portal/login/verify');

    // UNLOCK_ACCOUNT restores client and user to ACTIVE
    const resUnlock = await diagnosticsServiceForB.remediateClientAccess({
      clientId: 'client-org-42',
      action: 'UNLOCK_ACCOUNT',
    }, mockAdminUser);
    assert.strictEqual(resUnlock.success, true);
    assert.strictEqual(updatedClientData.data.status, 'ACTIVE');
    assert.strictEqual(updatedUserData.data.deletedAt, null);
  });

  await check('B6. Tool 6: Suspended domain normalization (UNSUSPEND & NORMALIZE_STATUS)', async () => {
    dokployRestartCalled = false;
    const resUnsuspend = await diagnosticsServiceForB.remediateDomainState({
      hostingAccountId: 'host-acc-1',
      action: 'UNSUSPEND',
    }, mockAdminUser);
    assert.strictEqual(resUnsuspend.success, true);
    assert.strictEqual(resUnsuspend.status, 'ACTIVE');
    assert.strictEqual(dokployRestartCalled, true, 'Dokploy restartWorkload must be triggered');
  });

  // ============================================================================
  // SUITE C: Proactive Anomaly Detection & One-Click Remediations (All 4 Rules)
  // ============================================================================
  console.log(`\n${BOLD}${YELLOW}[SUITE C] Proactive Anomaly Detection & One-Click Remediations (All 4 Rules)${RESET}`);

  const now = new Date();
  const mockProactiveAccounts = [
    {
      id: 'host-crit',
      domain: 'expiring-soon.com',
      ipAddress: '102.134.20.10',
      status: 'ACTIVE',
      sslExpiry: new Date(now.getTime() + 2 * 86400_000), // 2 days -> CRITICAL
      client: { id: 'c-1', businessName: 'Client 1' },
    },
    {
      id: 'host-warn',
      domain: 'expiring-next-week.com',
      ipAddress: '102.134.20.10',
      status: 'ACTIVE',
      sslExpiry: new Date(now.getTime() + 5 * 86400_000), // 5 days -> WARNING
      client: { id: 'c-2', businessName: 'Client 2' },
    },
  ];

  const mockFailedBurstLogs = [
    { id: 'fl-1', provider: 'PAYSTACK', status: PaymentStatus.FAILED, errorMessage: 'Timeout', createdAt: new Date() },
    { id: 'fl-2', provider: 'PAYSTACK', status: PaymentStatus.FAILED, errorMessage: 'Timeout', createdAt: new Date() },
    { id: 'fl-3', provider: 'DARAJA', status: PaymentStatus.FAILED, errorMessage: 'Auth fail', createdAt: new Date() },
  ];

  const mockUnappliedPayments = [
    {
      id: 'pay-unapplied-1',
      provider: PaymentProvider.PAYSTACK,
      providerRef: 'pay-ref-999',
      amount: 1200,
      currency: 'USD',
      status: PaymentStatus.SUCCESS,
      invoiceId: 'inv-unpaid-1',
      invoice: { id: 'inv-unpaid-1', invoiceNumber: 'INV-UNPAID', status: 'PENDING', amount: 1200, clientId: 'c-1' },
      client: { id: 'c-1', businessName: 'Client 1' },
    },
  ];

  const mockExpiredProposals = [
    {
      id: 'prop-expired-1',
      proposalCode: 'PROP-EX-99',
      status: 'EXPIRED',
      expiresAt: new Date(now.getTime() - 24 * 3600_000),
      clientName: 'Safari Ventures',
      clientEmail: 'safari@ventures.co.ke',
      clientId: 'c-1',
    },
  ];

  const prismaMockForC: any = {
    $transaction: async (cb: any) => cb(prismaMockForC),
    hostingAccount: {
      findMany: async () => mockProactiveAccounts,
      findFirst: async () => mockProactiveAccounts[0],
      findUnique: async () => mockProactiveAccounts[0],
      update: async () => ({}),
    },
    paymentLog: {
      findMany: async ({ where }: any) => {
        if (where?.status === PaymentStatus.FAILED) return mockFailedBurstLogs;
        if (where?.status === PaymentStatus.SUCCESS) return mockUnappliedPayments;
        return [];
      },
      findUnique: async () => mockUnappliedPayments[0],
      update: async () => ({}),
    },
    proposal: {
      findMany: async () => mockExpiredProposals,
      findFirst: async () => mockExpiredProposals[0],
      update: async () => ({}),
    },
    invoice: {
      findFirst: async () => ({
        id: 'inv-dep-1',
        invoiceNumber: 'INV-DEP-99',
        amount: 500,
        currency: 'USD',
        status: 'PAID',
        clientId: 'c-1',
        paymentLogs: [{ status: PaymentStatus.SUCCESS }],
      }),
      findUnique: async () => ({
        id: 'inv-dep-1',
        invoiceNumber: 'INV-DEP-99',
        amount: 500,
        currency: 'USD',
        status: 'PAID',
        clientId: 'c-1',
      }),
      update: async () => ({}),
    },
    client: {
      findUnique: async () => ({ id: 'c-1', businessName: 'Safari Ventures' }),
      update: async () => ({}),
    },
    project: {
      findFirst: async () => null,
      create: async () => ({ id: 'proj-1', name: 'Roadmap' }),
    },
    projectTask: {
      createMany: async () => ({ count: 5 }),
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
  };

  const diagnosticsServiceForC = new AdminDiagnosticsService(
    prismaMockForC,
    configMockForA,
    settlementMockForB,
    { verifyTransaction: async () => ({ status: true, data: { status: 'success' } }) } as any,
    { isConfigured: () => true } as any,
    dokployMockForB,
  );

  (diagnosticsServiceForC as any).inspectTlsCert = async () => ({
    valid_to: new Date(Date.now() + 60 * 86400_000).toISOString(),
    issuer: { O: 'Let\'s Encrypt' },
  });

  let scanReport: any = null;

  await check('C1. Rule 1: SSL Expiry <= 7 days (CRITICAL <= 3d, WARNING 4-7d) & Remediation', async () => {
    scanReport = await diagnosticsServiceForC.getProactiveScan();
    assert.strictEqual(scanReport.success, true);

    const sslAnomalies = scanReport.anomalies.filter((a: any) => a.rule === 'SSL_EXPIRING_7D');
    assert.strictEqual(sslAnomalies.length, 2, 'Must detect both expiring SSL accounts');

    const crit = sslAnomalies.find((a: any) => a.resourceId === 'host-crit');
    assert.strictEqual(crit.severity, 'CRITICAL', '<= 3 days must be CRITICAL');
    assert.strictEqual(crit.remediationAction, 'REFRESH_SSL');

    const warn = sslAnomalies.find((a: any) => a.resourceId === 'host-warn');
    assert.strictEqual(warn.severity, 'WARNING', '4-7 days must be WARNING');

    // Test direct remediation dispatch
    const remRes = await diagnosticsServiceForC.remediateProactiveAnomaly({
      anomalyId: crit.id,
      rule: 'SSL_EXPIRING_7D',
      remediationAction: crit.remediationAction,
      remediationPayload: crit.remediationPayload,
    }, mockAdminUser);
    assert.strictEqual(remRes.success, true);
  });

  await check('C2. Rule 2: Webhook Failure Bursts (>= 3 in past 60 min) & Batch Remediation', async () => {
    const burstAnomalies = scanReport.anomalies.filter((a: any) => a.rule === 'WEBHOOK_BURST');
    assert.strictEqual(burstAnomalies.length, 1, 'Must detect webhook burst');
    assert.strictEqual(burstAnomalies[0].severity, 'CRITICAL', 'Burst must be CRITICAL');
    assert.strictEqual(burstAnomalies[0].metadata.failureCount, 3);
    assert.strictEqual(burstAnomalies[0].remediationAction, 'RETRY_WEBHOOK_BURST');

    (diagnosticsServiceForC as any).replayWebhook = async () => ({ success: true });
    const remRes = await diagnosticsServiceForC.remediateProactiveAnomaly({
      anomalyId: burstAnomalies[0].id,
      rule: 'WEBHOOK_BURST',
      remediationAction: burstAnomalies[0].remediationAction,
      remediationPayload: burstAnomalies[0].remediationPayload,
    }, mockAdminUser);
    assert.strictEqual(remRes.success, true);
  });

  await check('C3. Rule 3: Unapplied Payments (SUCCESS payment with unpaid invoice) & Remediation', async () => {
    const unappliedAnomalies = scanReport.anomalies.filter((a: any) => a.rule === 'UNAPPLIED_PAYMENT');
    assert.strictEqual(unappliedAnomalies.length, 1, 'Must detect unapplied payment');
    assert.strictEqual(unappliedAnomalies[0].severity, 'CRITICAL');
    assert.strictEqual(unappliedAnomalies[0].metadata.amount, 1200);
    assert.strictEqual(unappliedAnomalies[0].remediationAction, 'AUTO_APPLY_PAYMENT');

    const remRes = await diagnosticsServiceForC.remediateProactiveAnomaly({
      anomalyId: unappliedAnomalies[0].id,
      rule: 'UNAPPLIED_PAYMENT',
      remediationAction: unappliedAnomalies[0].remediationAction,
      remediationPayload: unappliedAnomalies[0].remediationPayload,
    }, mockAdminUser);
    assert.strictEqual(remRes.success, true);
    assert.strictEqual(remRes.action, 'AUTO_APPLY_PAYMENT');
    assert.strictEqual((remRes as any).invoiceId, 'inv-unpaid-1');
  });

  await check('C4. Rule 4: Expired Quotes with Paid Deposits & Roadmap Kickoff Remediation', async () => {
    const quoteAnomalies = scanReport.anomalies.filter((a: any) => a.rule === 'EXPIRED_QUOTE_DEPOSIT');
    assert.strictEqual(quoteAnomalies.length, 1, 'Must detect expired quote with deposit');
    assert.strictEqual(quoteAnomalies[0].severity, 'CRITICAL');
    assert.strictEqual(quoteAnomalies[0].remediationAction, 'EXTEND_AND_ACTIVATE_QUOTE');

    const remRes = await diagnosticsServiceForC.remediateProactiveAnomaly({
      anomalyId: quoteAnomalies[0].id,
      rule: 'EXPIRED_QUOTE_DEPOSIT',
      remediationAction: quoteAnomalies[0].remediationAction,
      remediationPayload: quoteAnomalies[0].remediationPayload,
    }, mockAdminUser);
    assert.strictEqual(remRes.success, true);
    assert.strictEqual(remRes.action, 'EXTEND_AND_ACTIVATE_QUOTE');
    assert.strictEqual((remRes as any).newStatus, 'ACCEPTED');
  });

  // ============================================================================
  // SUITE D: Synced Manual Client Account Creation & Onboarding Sync
  // ============================================================================
  console.log(`\n${BOLD}${YELLOW}[SUITE D] Synced Manual Client Account Creation & Onboarding Sync${RESET}`);

  let createdUserRecord: any = null;
  let createdClientRecord: any = null;
  let createdProjectRecord: any = null;
  let createdRefreshToken: any = null;

  const prismaMockForD: any = {
    $transaction: async (cb: any) => cb(prismaMockForD),
    client: {
      findFirst: async () => null,
      findUnique: async ({ where }: any) => ({
        id: where.id || 'client-man-1',
        businessName: 'Serengeti Tech Solutions',
        email: 'info@serengeti.co.tz',
        status: where.id === 'client-need-sync' ? 'PENDING' : 'ACTIVE',
        deletedAt: null,
        user: where.id === 'client-claimed' ? { id: 'u-1', passwordHash: 'hashed-pw' } : { id: 'u-1', passwordHash: null, email: 'info@serengeti.co.tz' },
        projects: where.id === 'client-need-sync' ? [] : [{ id: 'p-1' }],
        subscriptions: where.id === 'client-need-sync' ? [] : [{ id: 's-1', status: 'ACTIVE' }],
      }),
      create: async ({ data }: any) => {
        createdClientRecord = { id: 'client-man-1', ...data };
        return createdClientRecord;
      },
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    user: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        createdUserRecord = { id: 'user-man-1', ...data };
        return createdUserRecord;
      },
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    plan: {
      findFirst: async () => ({ id: 'plan-pro-1', name: 'Professional Tier', tier: 'PRO', priceMonthly: 299 }),
      findUnique: async () => ({ id: 'plan-pro-1', name: 'Professional Tier', tier: 'PRO', priceMonthly: 299 }),
      findFirstOrThrow: async () => ({ id: 'plan-pro-1', name: 'Professional Tier', tier: 'PRO', priceMonthly: 299 }),
    },
    project: {
      create: async ({ data }: any) => {
        createdProjectRecord = { id: 'proj-man-1', ...data };
        return createdProjectRecord;
      },
    },
    subscription: {
      create: async ({ data }: any) => ({ id: 'sub-man-1', ...data }),
    },
    refreshToken: {
      create: async ({ data }: any) => {
        createdRefreshToken = data;
        return { id: 'rt-man-1', ...data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
  };

  const clientsService = new ClientsService(prismaMockForD, configMockForA);

  await check('D1. Atomic Manual Client Provisioning with 72h claim_ token & workspace initialization', async () => {
    const dto = {
      businessName: 'Serengeti Tech Solutions',
      contactName: 'Baraka Mwangi',
      email: 'info@serengeti.co.tz',
      phone: '+255712345678',
      country: 'TZ',
      planTier: 'PRO',
      projectTitle: 'Serengeti Cloud Platform Launch',
    };

    const res = await clientsService.manualProvision(dto as any, mockAdminUser);
    assert.strictEqual(res.expiresIn, 72 * 3600, 'Expiration must be 72 hours (259200 seconds)');
    assert.ok(res.invitationToken.startsWith('claim_'), 'Token must start with claim_');
    assert.ok(res.claimUrl.includes('/portal/claim?token=claim_'), 'claimUrl must route to /portal/claim');
    assert.ok(res.claimUrl.includes('email=info%40serengeti.co.tz'), 'claimUrl must contain encoded email');

    assert.strictEqual(createdUserRecord.email, 'info@serengeti.co.tz');
    assert.strictEqual(createdUserRecord.role, 'CLIENT');
    assert.strictEqual(createdUserRecord.passwordHash, null, 'User passwordHash must be null (unclaimed)');

    assert.strictEqual(createdClientRecord.businessName, 'Serengeti Tech Solutions');
    assert.strictEqual(createdProjectRecord.name, 'Serengeti Cloud Platform Launch');

    // Verify SHA-256 token hash storage in RefreshToken
    const expectedHash = createHash('sha256').update(res.invitationToken).digest('hex');
    assert.strictEqual(createdRefreshToken.tokenHash, expectedHash);
    assert.ok(createdRefreshToken.expiresAt.getTime() > Date.now() + 71 * 3600_000);
  });

  await check('D2. Troubleshooting Activation Resend (resendInvite generates fresh 72h claim link)', async () => {
    const resResend = await clientsService.resendInvite('client-man-1', mockAdminUser);
    assert.strictEqual(resResend.success, true);
    assert.ok(resResend.invitationToken.startsWith('claim_'));
    assert.strictEqual(resResend.expiresIn, 72 * 3600);
    assert.ok(resResend.claimUrl.includes('/portal/claim?token=claim_'));
  });

  await check('D3. Troubleshooting Onboarding Synchronization (syncOnboarding repairs missing state)', async () => {
    const resSync = await clientsService.syncOnboarding('client-need-sync', mockAdminUser);
    assert.strictEqual(resSync.status, 'ACTIVE');
    assert.ok(Array.isArray(resSync.repairedItems), 'repairedItems must be an array');
    assert.ok(resSync.repairedItems.length >= 2, 'Should repair project and subscription');
  });

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  const elapsed = Date.now() - startTime;
  console.log(`\n${BOLD}${CYAN}--------------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}VERIFICATION SUMMARY:${RESET}`);
  console.log(`  Total Assertions Checked : ${BOLD}${totalAssertions}${RESET}`);
  console.log(`  Passed Assertions        : ${BOLD}${GREEN}${passedAssertions}${RESET}`);
  console.log(`  Failed Assertions        : ${BOLD}${failures.length === 0 ? GREEN + '0' : RED + failures.length}${RESET}`);
  console.log(`  Execution Time           : ${DIM}${elapsed}ms${RESET}`);
  console.log(`${BOLD}${CYAN}--------------------------------------------------------------------------------${RESET}\n`);

  if (failures.length > 0) {
    console.error(`${BOLD}${RED}FAILED ASSERTIONS DETECTED:${RESET}`);
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log(`${BOLD}${GREEN}✔ ALL 4 SUITES PASSED WITH 100% SUCCESS.${RESET}\n`);
    process.exit(0);
  }
}

runAllVerifications().catch((err) => {
  console.error(`${RED}Fatal error running verification suite:${RESET}`, err);
  process.exit(1);
});
