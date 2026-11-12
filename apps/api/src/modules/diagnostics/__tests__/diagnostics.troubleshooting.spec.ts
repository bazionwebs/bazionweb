import * as dns from 'dns';
import { ConfigService } from '@nestjs/config';
import { AdminDiagnosticsService } from '../diagnostics.service';
import { ClientsService } from '../../clients/clients.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

describe('Admin Diagnostics & Troubleshooting Suite', () => {
  let diagnosticsService: AdminDiagnosticsService;
  let clientsService: ClientsService;

  let prismaMock: any;
  let configMock: any;
  let settlementMock: any;
  let paystackMock: any;
  let darajaMock: any;
  let dokployMock: any;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $transaction: jest.fn((cb) => cb(prismaMock)),
      client: {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        count: jest.fn().mockResolvedValue(25),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      ticket: {
        count: jest.fn().mockResolvedValue(3),
      },
      paymentLog: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      hostingAccount: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      project: {
        create: jest.fn(),
      },
      subscription: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      plan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-starter-id', name: 'Starter Plan', tier: 'STARTER' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-starter-id', name: 'Starter Plan', tier: 'STARTER' }),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        if (key === 'NEXT_PUBLIC_APP_URL') return 'https://bazionweb.com';
        return null;
      }),
    };

    settlementMock = {
      activatePaidSubscription: jest.fn().mockResolvedValue(undefined),
      settlePaystackCharge: jest.fn().mockResolvedValue(true),
      settleDarajaSuccess: jest.fn().mockResolvedValue(true),
    };

    paystackMock = {
      verifyTransaction: jest.fn(),
    };

    darajaMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      queryStkStatus: jest.fn(),
    };

    dokployMock = {
      providerName: 'DokployProvider',
      bindDomain: jest.fn().mockResolvedValue({ domainId: 'dok-1', sslActive: true, verified: true }),
      restartWorkload: jest.fn().mockResolvedValue(true),
    };

    diagnosticsService = new AdminDiagnosticsService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
      settlementMock as any,
      paystackMock as any,
      darajaMock as any,
      dokployMock as any,
    );

    clientsService = new ClientsService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Orphan & Unapplied Payments Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Orphan & Unapplied Payments', () => {
    it('TC-DIAG-ORPHAN-1: queries orphan payment records and extracts candidate client info', async () => {
      const mockOrphanLog = {
        id: 'orphan-log-1',
        provider: PaymentProvider.PAYSTACK,
        providerRef: 'ref_123',
        method: 'CARD',
        amount: 299,
        currency: 'USD',
        status: PaymentStatus.FAILED,
        createdAt: new Date(),
        errorMessage: 'Orphan: no invoice found for customer',
        rawPayload: JSON.stringify({
          customer: { email: 'client@acacia.co.ke' },
        }),
        client: null,
        invoice: null,
      };

      prismaMock.paymentLog.findMany.mockResolvedValue([mockOrphanLog]);
      prismaMock.client.findFirst.mockResolvedValue({
        id: 'client-1',
        businessName: 'Acacia Tech',
        email: 'client@acacia.co.ke',
        status: 'ACTIVE',
      });
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-001',
        amount: 299,
        status: 'SENT',
        clientId: 'client-1',
      });

      const res = await diagnosticsService.getOrphanPayments();

      expect(res.count).toBe(1);
      expect(res.items[0].id).toBe('orphan-log-1');
      expect(res.items[0].extractedEmail).toBe('client@acacia.co.ke');
      expect(res.items[0].candidateClient?.id).toBe('client-1');
      expect(res.items[0].candidateInvoice?.id).toBe('inv-1');
      expect(res.items[0].matchConfidence).toBe('HIGH');
    });

    it('TC-REMED-ORPHAN-1: LINK_AND_SETTLE updates invoice to PAID, links log to SUCCESS, and activates subscription', async () => {
      const mockLog = {
        id: 'orphan-log-2',
        provider: PaymentProvider.PAYSTACK,
        providerRef: 'pstk_success_ref',
        amount: 150,
        createdAt: new Date(),
      };
      const mockInvoice = {
        id: 'target-inv-1',
        invoiceNumber: 'INV-1001',
        clientId: 'client-abc',
        client: { id: 'client-abc', planId: 'plan-1' },
      };

      prismaMock.paymentLog.findUnique.mockResolvedValue(mockLog);
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice);

      const res = await diagnosticsService.remediateOrphanPayment(
        {
          paymentLogId: 'orphan-log-2',
          targetInvoiceId: 'target-inv-1',
          action: 'LINK_AND_SETTLE',
        },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('LINK_AND_SETTLE');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-inv-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(prismaMock.paymentLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'orphan-log-2' },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCESS,
            invoiceId: 'target-inv-1',
            clientId: 'client-abc',
          }),
        }),
      );
      expect(settlementMock.activatePaidSubscription).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'troubleshooting.remediate_orphan_payment',
            resourceId: 'orphan-log-2',
          }),
        }),
      );
    });

    it('TC-REMED-ORPHAN-2: CREDIT_CLIENT links payment to target client and activates status', async () => {
      const mockLog = {
        id: 'orphan-log-3',
        amount: 500,
      };
      const mockClient = {
        id: 'client-credit-target',
        businessName: 'Savannah Cloud Services',
      };

      prismaMock.paymentLog.findUnique.mockResolvedValue(mockLog);
      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const res = await diagnosticsService.remediateOrphanPayment(
        {
          paymentLogId: 'orphan-log-3',
          targetClientId: 'client-credit-target',
          action: 'CREDIT_CLIENT',
        },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('CREDIT_CLIENT');
      expect(prismaMock.paymentLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'orphan-log-3' },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCESS,
            clientId: 'client-credit-target',
          }),
        }),
      );
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-credit-target' },
          data: { status: 'ACTIVE' },
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DNS & SSL Fleet Scanner & Remediation Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Fleet DNS & SSL Resolver', () => {
    it('TC-DIAG-SSL-1: flags certificate expiring within 7 days', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['104.21.5.12']);
      const fiveDaysFromNow = new Date(Date.now() + 5 * 86_400_000);
      const mockHosting = [
        {
          id: 'host-1',
          domain: 'expiring.bazionweb.com',
          ipAddress: '104.21.5.12',
          sslExpiry: fiveDaysFromNow,
          sslIssuer: "Let's Encrypt",
          status: 'ACTIVE',
          client: { id: 'c-1', businessName: 'Client Alpha', status: 'ACTIVE' },
        },
      ];

      prismaMock.hostingAccount.findMany.mockResolvedValue(mockHosting);

      const res = await diagnosticsService.scanDnsSslFleet();

      expect(res.totalScanned).toBe(1);
      expect(res.domains[0].anomaly).toBe('SSL_EXPIRING_7D');
      expect(res.domains[0].hasIssue).toBe(true);
      expect(res.issuesCount).toBe(1);
    });

    it('TC-REMED-SSL-2: REISSUE_SSL triggers Dokploy bindDomain and updates HostingAccount status', async () => {
      prismaMock.hostingAccount.findFirst.mockResolvedValue({
        id: 'host-reissue-1',
        domain: 'portal.acacia.co.ke',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'app-portal-1',
        status: 'ACTIVE',
      });

      const res = await diagnosticsService.remediateDnsSsl(
        { domain: 'portal.acacia.co.ke', action: 'REISSUE_SSL' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('REISSUE_SSL');
      expect(dokployMock.bindDomain).toHaveBeenCalledWith({
        applicationId: 'app-portal-1',
        domain: 'portal.acacia.co.ke',
        https: true,
        certificateType: 'letsencrypt',
      });
      expect(prismaMock.hostingAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'host-reissue-1' },
          data: { status: 'ACTIVE' },
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('fails closed when a legacy hosting account has no verified Dokploy workload reference', async () => {
      prismaMock.hostingAccount.findFirst.mockResolvedValue({
        id: 'host-legacy-1',
        domain: 'legacy.acacia.co.ke',
        status: 'ACTIVE',
      });

      await expect(
        diagnosticsService.remediateDnsSsl(
          { domain: 'legacy.acacia.co.ke', action: 'REISSUE_SSL' },
          { id: 'admin-1', email: 'admin@bazionweb.com' },
        ),
      ).rejects.toThrow('verified workload reference');

      expect(dokployMock.bindDomain).not.toHaveBeenCalled();
      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
    });

    it('does not call a legacy provider for a Platform-linked hosting row', async () => {
      prismaMock.hostingAccount.findFirst.mockResolvedValue({
        id: 'host-platform-linked-1',
        domain: 'platform.acacia.co.ke',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'legacy-provider-id',
        platformDeploymentId: '33333333-3333-4333-8333-333333333333',
        status: 'ACTIVE',
      });

      await expect(diagnosticsService.remediateDnsSsl(
        { domain: 'platform.acacia.co.ke', action: 'REISSUE_SSL' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      )).rejects.toThrow('linked to Bazion Platform');

      expect(dokployMock.bindDomain).not.toHaveBeenCalled();
      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
    });

    it('does not report SSL reissue success or activate the account when Dokploy binding fails', async () => {
      prismaMock.hostingAccount.findFirst.mockResolvedValue({
        id: 'host-provider-error-1',
        domain: 'portal.acacia.co.ke',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'app-portal-1',
        status: 'PROVISIONING',
      });
      dokployMock.bindDomain.mockRejectedValueOnce(new Error('provider unavailable'));

      await expect(
        diagnosticsService.remediateDnsSsl(
          { domain: 'portal.acacia.co.ke', action: 'REISSUE_SSL' },
          { id: 'admin-1', email: 'admin@bazionweb.com' },
        ),
      ).rejects.toThrow('could not reissue the SSL certificate');

      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('TC-SSRF-SSL-1: remediateDnsSsl REFRESH_SSL blocks private/reserved IPs with BadRequestException', async () => {
      prismaMock.hostingAccount.findFirst.mockResolvedValue({
        id: 'host-internal-1',
        domain: 'internal.corp',
        ipAddress: '127.0.0.1',
      });
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['192.168.1.50']);

      await expect(
        diagnosticsService.remediateDnsSsl(
          { domain: 'internal.corp', action: 'REFRESH_SSL' },
          { id: 'admin-1', email: 'admin@bazionweb.com' },
        ),
      ).rejects.toThrow('Cannot inspect SSL: domain resolves to a private or reserved IP address');
    });

    it('TC-SSRF-SSL-2: scanDnsSslFleet avoids live TLS inspection for private/reserved resolved IPs', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['10.0.0.1']);
      const inspectSpy = jest.spyOn<any, any>(diagnosticsService, 'inspectTlsCert');

      const mockHosting = [
        {
          id: 'host-private',
          domain: 'intranet.bazionweb.com',
          ipAddress: '10.0.0.1',
          sslExpiry: null,
          sslIssuer: null,
          status: 'ACTIVE',
          client: { id: 'c-priv', businessName: 'Private Corp', status: 'ACTIVE' },
        },
      ];

      prismaMock.hostingAccount.findMany.mockResolvedValue(mockHosting);

      const res = await diagnosticsService.scanDnsSslFleet();

      expect(res.totalScanned).toBe(1);
      expect(inspectSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Failed Webhooks & Burst Anomaly Detection Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Failed Webhook Stream & Batch Retries', () => {
    it('TC-DIAG-WH-1: detects burst anomaly when 3 or more webhooks fail within 15 minutes', async () => {
      const mockFailed = [
        {
          id: 'wh-fail-1',
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.FAILED,
          createdAt: new Date(),
          errorMessage: 'Transaction declined by bank',
          amount: 50,
          currency: 'USD',
          method: 'CARD',
          client: null,
          invoice: null,
        },
      ];

      prismaMock.paymentLog.findMany.mockResolvedValue(mockFailed);
      prismaMock.paymentLog.count.mockResolvedValue(4); // 4 failures in last 15 min

      const res = await diagnosticsService.getWebhookFailures();

      expect(res.burstDetected).toBe(true);
      expect(res.burstCount).toBe(4);
      expect(res.groupedReasons.GATEWAY_REJECTED).toBe(1);
    });

    it('TC-REMED-WH-1: retryWebhooksBatch iterates failed logs and settles verified payments', async () => {
      const mockLogs = [
        { id: 'wh-1', provider: PaymentProvider.PAYSTACK, providerRef: 'ref-1', status: 'FAILED' },
        { id: 'wh-2', provider: PaymentProvider.PAYSTACK, providerRef: 'ref-2', status: 'FAILED' },
      ];

      prismaMock.paymentLog.findMany.mockResolvedValue(mockLogs);
      prismaMock.paymentLog.findUnique
        .mockResolvedValueOnce({
          id: 'wh-1',
          provider: PaymentProvider.PAYSTACK,
          providerRef: 'ref-1',
        })
        .mockResolvedValueOnce({
          id: 'wh-2',
          provider: PaymentProvider.PAYSTACK,
          providerRef: 'ref-2',
        });

      paystackMock.verifyTransaction
        .mockResolvedValueOnce({ data: { status: 'success' } })
        .mockResolvedValueOnce({ data: { status: 'failed' } });

      settlementMock.settlePaystackCharge.mockResolvedValue(true);

      const res = await diagnosticsService.retryWebhooksBatch(24, { id: 'admin-1', email: 'admin@bazionweb.com' });

      expect(res.scanned).toBe(2);
      expect(res.settled).toBe(1);
      expect(res.failed).toBe(1);
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Unsynced Invoice Totals Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Invoice Total & Status Synchronization', () => {
    it('TC-DIAG-INV-1: detects line item mathematical mismatch and paid as unpaid status', async () => {
      const mockInvoices = [
        {
          id: 'inv-desync-1',
          invoiceNumber: 'INV-5001',
          amount: 500, // Recorded $500
          currency: 'USD',
          status: 'SENT',
          lineItems: [
            { description: 'Hosting', amount: 150, quantity: 1, total: 150 },
            { description: 'SSL Certificate', amount: 100, quantity: 1, total: 100 },
          ], // Sum is $250
          paymentLogs: [],
          client: { id: 'c-1', businessName: 'Savannah Logistics' },
        },
        {
          id: 'inv-desync-2',
          invoiceNumber: 'INV-5002',
          amount: 300,
          currency: 'USD',
          status: 'SENT',
          lineItems: [],
          paymentLogs: [{ id: 'p-1', amount: 300, status: PaymentStatus.SUCCESS }], // Fully paid but still SENT
          client: { id: 'c-2', businessName: 'Rift Valley Safari' },
        },
      ];

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices);

      const res = await diagnosticsService.getUnsyncedInvoices();

      expect(res.totalUnsynced).toBe(2);
      expect(res.items[0].discrepancy).toBe('LINE_ITEM_MISMATCH');
      expect(res.items[1].discrepancy).toBe('STATUS_DESYNC_PAID_AS_UNPAID');
    });

    it('TC-REMED-INV-1: SYNC_FROM_PAYMENTS marks invoice PAID and activates subscription', async () => {
      const mockInvoice = {
        id: 'inv-remed-1',
        invoiceNumber: 'INV-9001',
        amount: 250,
        currency: 'USD',
        status: 'SENT',
        client: { id: 'c-1', planId: 'plan-1' },
        paymentLogs: [{ id: 'p-1', amount: 250, status: PaymentStatus.SUCCESS, createdAt: new Date() }],
      };

      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice);

      const res = await diagnosticsService.remediateInvoiceSync(
        { invoiceId: 'inv-remed-1', action: 'SYNC_FROM_PAYMENTS' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('PAID');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-remed-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(settlementMock.activatePaidSubscription).toHaveBeenCalled();
    });

    it('TC-REMED-INV-2: RECALCULATE_FROM_ITEMS recalculates invoice amount to match line items', async () => {
      const mockInvoice = {
        id: 'inv-recalc-1',
        invoiceNumber: 'INV-9002',
        amount: 500,
        currency: 'USD',
        lineItems: [
          { description: 'Cloud VPS', amount: 200, quantity: 1, total: 200 },
          { description: 'Managed Security', amount: 150, quantity: 1, total: 150 },
        ],
        paymentLogs: [],
      };

      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice);

      const res = await diagnosticsService.remediateInvoiceSync(
        { invoiceId: 'inv-recalc-1', action: 'RECALCULATE_FROM_ITEMS' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.updatedAmount).toBe(350);
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-recalc-1' },
          data: { amount: 350 },
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Client Credential & Access Lockouts Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Client Credential & Access Lockouts', () => {
    it('TC-DIAG-CLI-1: surfaces suspended clients, soft-deleted users, and unclaimed accounts', async () => {
      prismaMock.client.findMany.mockResolvedValue([
        {
          id: 'c-locked-1',
          businessName: 'Locked Corp',
          contactName: 'John',
          email: 'john@locked.com',
          status: 'SUSPENDED',
          deletedAt: null,
          user: { id: 'u-1', deletedAt: null, passwordHash: 'hash', lastLoginAt: null },
        },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'u-2',
          email: 'mary@unclaimed.com',
          deletedAt: null,
          passwordHash: null, // Unclaimed passwordless
          client: { id: 'c-unclaimed', businessName: 'Unclaimed Co', contactName: 'Mary', status: 'ACTIVE' },
        },
      ]);

      const res = await diagnosticsService.getClientAccessIssues();

      expect(res.totalLocked).toBe(2);
      expect(res.items.some((i) => i.lockoutReason === 'CLIENT_SUSPENDED')).toBe(true);
      expect(res.items.some((i) => i.lockoutReason === 'PASSWORD_UNSET')).toBe(true);
    });

    it('TC-REMED-CLI-1: UNLOCK_ACCOUNT sets status ACTIVE and clears deletedAt', async () => {
      const mockClient = {
        id: 'client-unlock-1',
        userId: 'user-unlock-1',
        businessName: 'Unlocked Ltd',
        email: 'info@unlocked.com',
        user: { id: 'user-unlock-1', deletedAt: new Date() },
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const res = await diagnosticsService.remediateClientAccess(
        { clientId: 'client-unlock-1', action: 'UNLOCK_ACCOUNT' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-unlock-1' },
          data: { status: 'ACTIVE', deletedAt: null },
        }),
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-unlock-1' },
          data: { deletedAt: null },
        }),
      );
    });

    it('TC-REMED-CLI-2: GENERATE_RESET_LINK creates claim link for unclaimed account', async () => {
      const mockClient = {
        id: 'client-claim-1',
        userId: 'user-claim-1',
        user: { id: 'user-claim-1', email: 'claim@client.com', passwordHash: null },
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const res = await diagnosticsService.remediateClientAccess(
        { clientId: 'client-claim-1', action: 'GENERATE_RESET_LINK' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.token).toContain('claim_');
      expect(res.resetLink).toContain('/portal/claim?token=claim_');
      expect(res.resetLink).toContain('email=claim%40client.com');
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-claim-1',
          }),
        }),
      );
    });

    it('TC-REMED-CLI-3: GENERATE_RESET_LINK creates magic link for claimed account', async () => {
      const mockClient = {
        id: 'client-magic-1',
        userId: 'user-magic-1',
        user: { id: 'user-magic-1', email: 'claimed@client.com', passwordHash: 'argon2id$hashed' },
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const res = await diagnosticsService.remediateClientAccess(
        { clientId: 'client-magic-1', action: 'GENERATE_RESET_LINK' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.token).toContain('magic_');
      expect(res.resetLink).toContain('/portal/login/verify?token=magic_');
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-magic-1',
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Suspended Domain States Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Suspended Domain States', () => {
    it('TC-DIAG-DOM-1: detects INCONSISTENT_SUSPENSION when domain is suspended but client has zero overdue invoices', async () => {
      const mockHosting = [
        {
          id: 'host-susp-1',
          domain: 'billing-resolved.com',
          status: 'SUSPENDED',
          createdAt: new Date(),
          client: {
            id: 'c-paid',
            businessName: 'Paid Client',
            invoices: [], // ZERO overdue invoices
          },
        },
      ];

      prismaMock.hostingAccount.findMany.mockResolvedValue(mockHosting);

      const res = await diagnosticsService.getSuspendedDomains();

      expect(res.totalSuspended).toBe(1);
      expect(res.items[0].suspensionType).toBe('INCONSISTENT_SUSPENSION');
    });

    it('TC-REMED-DOM-1: UNSUSPEND normalizes domain status to ACTIVE and restarts container', async () => {
      prismaMock.hostingAccount.findUnique.mockResolvedValue({
        id: 'host-unsusp-1',
        domain: 'restored-domain.com',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'provider-workload-1',
        status: 'SUSPENDED',
      });

      const res = await diagnosticsService.remediateDomainState(
        { hostingAccountId: 'host-unsusp-1', action: 'UNSUSPEND' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(prismaMock.hostingAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'host-unsusp-1' },
          data: { status: 'ACTIVE' },
        }),
      );
      expect(dokployMock.restartWorkload).toHaveBeenCalledWith('provider-workload-1');
    });

    it('does not reactivate a hosting account if the configured provider cannot restart its workload', async () => {
      prismaMock.hostingAccount.findUnique.mockResolvedValue({
        id: 'host-restart-failure-1',
        domain: 'restart-failure.example',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'provider-workload-2',
        status: 'SUSPENDED',
      });
      dokployMock.restartWorkload.mockRejectedValueOnce(new Error('provider unavailable'));

      await expect(diagnosticsService.remediateDomainState(
        { hostingAccountId: 'host-restart-failure-1', action: 'UNSUSPEND' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      )).rejects.toThrow('could not restart the hosting workload');

      expect(dokployMock.restartWorkload).toHaveBeenCalledWith('provider-workload-2');
      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
    });

    it('does not mutate provider state for an account without a verified workload reference', async () => {
      prismaMock.hostingAccount.findUnique.mockResolvedValue({
        id: 'host-unmapped-1',
        domain: 'unmapped.example',
        deploymentProvider: 'dokploy',
        providerWorkloadId: null,
        status: 'SUSPENDED',
      });

      await expect(diagnosticsService.remediateDomainState(
        { hostingAccountId: 'host-unmapped-1', action: 'UNSUSPEND' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      )).rejects.toThrow('verified workload reference');

      expect(dokployMock.restartWorkload).not.toHaveBeenCalled();
      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
    });

    it('does not unsuspend a Platform-linked hosting row through the legacy provider', async () => {
      prismaMock.hostingAccount.findUnique.mockResolvedValue({
        id: 'host-platform-linked-2',
        domain: 'platform-suspended.example',
        deploymentProvider: 'dokploy',
        providerWorkloadId: 'legacy-provider-id',
        platformDeploymentId: '33333333-3333-4333-8333-333333333333',
        status: 'SUSPENDED',
      });

      await expect(diagnosticsService.remediateDomainState(
        { hostingAccountId: 'host-platform-linked-2', action: 'UNSUSPEND' },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      )).rejects.toThrow('linked to Bazion Platform');

      expect(dokployMock.restartWorkload).not.toHaveBeenCalled();
      expect(prismaMock.hostingAccount.update).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Manual Client Account Provisioning Tests (Features 15, 16, 17)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Secure Synced Manual Client Provisioning', () => {
    it('TC-CLI-PROV-1: atomically provisions user, client, initial project, active subscription, and 72-hour claim token', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.plan.findFirst.mockResolvedValue({ id: 'plan-growth', name: 'Growth', tier: 'GROWTH' });

      prismaMock.user.create.mockResolvedValue({
        id: 'new-user-uuid',
        email: 'alex@apexlogistics.co.ke',
        role: 'CLIENT',
        passwordHash: null,
      });

      prismaMock.client.create.mockResolvedValue({
        id: 'new-client-uuid',
        userId: 'new-user-uuid',
        businessName: 'Apex Logistics',
        contactName: 'Alex Mwangi',
        email: 'alex@apexlogistics.co.ke',
        status: 'ACTIVE',
      });

      prismaMock.project.create.mockResolvedValue({
        id: 'new-proj-uuid',
        clientId: 'new-client-uuid',
        name: 'Apex Logistics Launch Project',
        status: 'PLANNING',
      });

      prismaMock.subscription.create.mockResolvedValue({
        id: 'new-sub-uuid',
        clientId: 'new-client-uuid',
        status: 'ACTIVE',
      });

      const res = await clientsService.manualProvision(
        {
          businessName: 'Apex Logistics',
          contactName: 'Alex Mwangi',
          email: 'alex@apexlogistics.co.ke',
          phone: '+254700000001',
          planTier: 'GROWTH',
        },
        { id: 'admin-1', email: 'admin@bazionweb.com' },
      );

      expect(res.client).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.invitationToken).toContain('claim_');
      expect(res.claimUrl).toContain('/portal/claim?token=claim_');
      expect(res.expiresIn).toBe(259200); // 72 hours in seconds

      // Verify transaction contents
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'alex@apexlogistics.co.ke',
            role: 'CLIENT',
            passwordHash: null,
          }),
        }),
      );
      expect(prismaMock.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessName: 'Apex Logistics',
            status: 'ACTIVE',
          }),
        }),
      );
      expect(prismaMock.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Apex Logistics Launch Project',
            status: 'PLANNING',
          }),
        }),
      );
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'new-user-uuid',
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'client.manual_provision',
          }),
        }),
      );
    });

    it('TC-CLI-PROV-2: resendInvite re-issues a fresh 72-hour claim token and revokes old ones', async () => {
      const mockClient = {
        id: 'client-invite-1',
        email: 'unclaimed@client.com',
        user: {
          id: 'user-invite-1',
          email: 'unclaimed@client.com',
          passwordHash: null,
        },
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const res = await clientsService.resendInvite('client-invite-1', { id: 'admin-1', email: 'admin@bazionweb.com' });

      expect(res.success).toBe(true);
      expect(res.invitationToken).toContain('claim_');
      expect(res.claimUrl).toContain('token=claim_');
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-invite-1', revokedAt: null },
        }),
      );
      expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    });

    it('TC-CLI-PROV-3: syncOnboarding repairs missing project, subscription, and user account', async () => {
      const mockClient = {
        id: 'client-repair-1',
        businessName: 'Broken Client Ltd',
        contactName: 'Repair Contact',
        email: 'repair@client.com',
        status: 'SUSPENDED',
        user: null, // Missing User!
        projects: [], // Missing Project!
        subscriptions: [], // Missing Subscription!
        plan: { id: 'plan-1', name: 'Starter' },
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);
      prismaMock.user.create.mockResolvedValue({ id: 'repaired-user-id' });

      const res = await clientsService.syncOnboarding('client-repair-1', { id: 'admin-1', email: 'admin@bazionweb.com' });

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.repairedItems.length).toBeGreaterThan(0);
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
      expect(prismaMock.user.create).toHaveBeenCalled();
      expect(prismaMock.project.create).toHaveBeenCalled();
      expect(prismaMock.subscription.create).toHaveBeenCalled();
    });
  });
});
