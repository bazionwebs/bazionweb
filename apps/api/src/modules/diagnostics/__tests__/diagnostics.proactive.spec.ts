import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminDiagnosticsService } from '../diagnostics.service';
import { AdminDiagnosticsController } from '../diagnostics.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

describe('AdminDiagnosticsService - Proactive Intelligence & Anomaly Remediation (R3)', () => {
  let diagnosticsService: AdminDiagnosticsService;

  let prismaMock: any;
  let configMock: any;
  let settlementMock: any;
  let paystackMock: any;
  let darajaMock: any;
  let dokployMock: any;

  const staffUser = {
    id: 'staff-admin-999',
    email: 'ops-lead@bazionweb.com',
  };

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $transaction: jest.fn((cb) => cb(prismaMock)),
      hostingAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentLog: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      proposal: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      client: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'proj-new-1', name: 'Roadmap' }),
      },
      projectTask: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        return null;
      }),
    };

    settlementMock = {
      activatePaidSubscription: jest.fn().mockResolvedValue(undefined),
      settlePaystackCharge: jest.fn().mockResolvedValue(true),
      settleDarajaSuccess: jest.fn().mockResolvedValue(true),
    };

    paystackMock = {
      verifyTransaction: jest.fn().mockResolvedValue({ status: true, data: { status: 'success' } }),
    };

    darajaMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      queryStkStatus: jest.fn().mockResolvedValue({ ResultCode: '0', ResultDesc: 'The service was accepted.' }),
    };

    dokployMock = {
      bindDomain: jest.fn().mockResolvedValue({ success: true }),
    };

    diagnosticsService = new AdminDiagnosticsService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
      settlementMock,
      paystackMock,
      darajaMock,
      dokployMock,
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rule 1: SSL Expiry <= 7 Days
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rule 1: SSL Expiry <= 7 Days', () => {
    it('TC-PA-1.1: flags active domain expiring in <= 3 days as CRITICAL and <= 7 days as WARNING', async () => {
      const now = Date.now();
      const mockAccounts = [
        {
          id: 'host-1',
          domain: 'critical-expiring.com',
          status: 'ACTIVE',
          sslExpiry: new Date(now + 2 * 86400_000), // 2 days left -> CRITICAL
          sslIssuer: "Let's Encrypt",
          client: { id: 'c-1', businessName: 'Critical Client', email: 'c1@test.com' },
        },
        {
          id: 'host-2',
          domain: 'warning-expiring.com',
          status: 'ACTIVE',
          sslExpiry: new Date(now + 6 * 86400_000), // 6 days left -> WARNING
          sslIssuer: "Let's Encrypt",
          client: { id: 'c-2', businessName: 'Warning Client', email: 'c2@test.com' },
        },
        {
          id: 'host-3',
          domain: 'missing-cert.com',
          status: 'ACTIVE',
          sslExpiry: null, // Null cert -> CRITICAL
          sslIssuer: null,
          client: { id: 'c-3', businessName: 'Missing Client', email: 'c3@test.com' },
        },
      ];

      prismaMock.hostingAccount.findMany.mockResolvedValue(mockAccounts);

      const report = await diagnosticsService.getProactiveScan();

      expect(report.success).toBe(true);
      expect(report.counts.sslExpiring).toBe(3);

      const sslAnomalies = report.anomalies.filter((a) => a.rule === 'SSL_EXPIRING_7D');
      expect(sslAnomalies).toHaveLength(3);

      const critical = sslAnomalies.find((a) => a.resourceId === 'host-1');
      expect(critical).toBeDefined();
      expect(critical?.severity).toBe('CRITICAL');
      expect(critical?.remediationAction).toBe('REFRESH_SSL');
      expect(critical?.metadata.daysLeft).toBe(2);

      const warning = sslAnomalies.find((a) => a.resourceId === 'host-2');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('WARNING');
      expect(warning?.remediationAction).toBe('REFRESH_SSL');
      expect(warning?.metadata.daysLeft).toBe(6);

      const missing = sslAnomalies.find((a) => a.resourceId === 'host-3');
      expect(missing).toBeDefined();
      expect(missing?.severity).toBe('CRITICAL');
      expect(missing?.remediationAction).toBe('REISSUE_SSL');
      expect(missing?.metadata.daysLeft).toBeNull();
    });

    it('TC-PA-1.2: does not flag domains with healthy SSL expiring > 7 days', async () => {
      // Prisma where query filters out > 7 days, so mock returns empty list
      prismaMock.hostingAccount.findMany.mockResolvedValue([]);

      const report = await diagnosticsService.getProactiveScan();
      expect(report.counts.sslExpiring).toBe(0);
      expect(report.anomalies.filter((a) => a.rule === 'SSL_EXPIRING_7D')).toHaveLength(0);
    });

    it('TC-PA-1.3: executes one-click SSL remediation (REFRESH_SSL & REISSUE_SSL)', async () => {
      const mockAccount = {
        id: 'host-1',
        domain: 'renew-ssl.com',
        ipAddress: '198.51.100.1',
        status: 'ACTIVE',
      };
      prismaMock.hostingAccount.findFirst.mockResolvedValue(mockAccount);
      jest.spyOn<any, any>(diagnosticsService, 'inspectTlsCert').mockResolvedValue({
        valid_to: new Date(Date.now() + 90 * 86400_000).toUTCString(),
        issuer: { O: "Let's Encrypt", CN: 'R3' },
      });

      // 1. REFRESH_SSL
      const refreshRes = await diagnosticsService.remediateProactiveAnomaly(
        {
          anomalyId: 'ssl-host-1',
          rule: 'SSL_EXPIRING_7D',
          remediationAction: 'REFRESH_SSL',
          remediationPayload: { domain: 'renew-ssl.com', hostingAccountId: 'host-1' },
        },
        staffUser,
      );

      expect(refreshRes.success).toBe(true);
      expect(refreshRes.action).toBe('REFRESH_SSL');
      expect(prismaMock.hostingAccount.update).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();

      // 2. REISSUE_SSL
      const reissueRes = await diagnosticsService.remediateProactiveAnomaly(
        {
          anomalyId: 'ssl-host-1',
          rule: 'SSL_EXPIRING_7D',
          remediationAction: 'REISSUE_SSL',
          remediationPayload: { domain: 'renew-ssl.com', hostingAccountId: 'host-1' },
        },
        staffUser,
      );

      expect(reissueRes.success).toBe(true);
      expect(reissueRes.action).toBe('REISSUE_SSL');
      expect(dokployMock.bindDomain).toHaveBeenCalledWith({
        domain: 'renew-ssl.com',
        certificateType: 'letsencrypt',
        https: true,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rule 2: Failed Webhook Bursts
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rule 2: Failed Webhook Bursts', () => {
    it('TC-PA-2.1: detects webhook failure burst when >= 3 webhooks failed in last 60 minutes', async () => {
      const now = new Date();
      const mockFailedLogs = [
        {
          id: 'log-1',
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.FAILED,
          createdAt: new Date(now.getTime() - 10 * 60_000),
          errorMessage: 'Invalid signature',
        },
        {
          id: 'log-2',
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.FAILED,
          createdAt: new Date(now.getTime() - 25 * 60_000),
          errorMessage: 'Connection timeout',
        },
        {
          id: 'log-3',
          provider: PaymentProvider.DARAJA,
          status: PaymentStatus.FAILED,
          createdAt: new Date(now.getTime() - 40 * 60_000),
          errorMessage: 'Request rejected',
        },
      ];

      prismaMock.paymentLog.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === PaymentStatus.FAILED) {
          return Promise.resolve(mockFailedLogs);
        }
        return Promise.resolve([]);
      });

      const report = await diagnosticsService.getProactiveScan();

      expect(report.counts.webhookBursts).toBe(1);
      const burstAnomaly = report.anomalies.find((a) => a.rule === 'WEBHOOK_BURST');
      expect(burstAnomaly).toBeDefined();
      expect(burstAnomaly?.severity).toBe('CRITICAL');
      expect(burstAnomaly?.title).toContain('3 Webhooks Failed in last 60 minutes');
      expect(burstAnomaly?.remediationAction).toBe('RETRY_WEBHOOK_BURST');
      expect(burstAnomaly?.remediationPayload.windowHours).toBe(1);
    });

    it('TC-PA-2.2: ignores isolated webhook failures (< 3 in 60m)', async () => {
      prismaMock.paymentLog.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === PaymentStatus.FAILED) {
          return Promise.resolve([
            {
              id: 'log-1',
              provider: PaymentProvider.PAYSTACK,
              status: PaymentStatus.FAILED,
              createdAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const report = await diagnosticsService.getProactiveScan();
      expect(report.counts.webhookBursts).toBe(0);
      expect(report.anomalies.filter((a) => a.rule === 'WEBHOOK_BURST')).toHaveLength(0);
    });

    it('TC-PA-2.3: executes one-click webhook burst replay remediation', async () => {
      // Mock retryWebhooksBatch via prisma mock
      prismaMock.paymentLog.findMany.mockResolvedValue([
        {
          id: 'log-f1',
          provider: PaymentProvider.PAYSTACK,
          providerRef: 'pay_ref_123',
          status: PaymentStatus.FAILED,
        },
      ]);
      prismaMock.paymentLog.findUnique.mockResolvedValue({
        id: 'log-f1',
        provider: PaymentProvider.PAYSTACK,
        providerRef: 'pay_ref_123',
        status: PaymentStatus.FAILED,
        invoiceId: 'inv-1',
        clientId: 'client-1',
      });
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        status: 'SENT',
        clientId: 'client-1',
      });

      const res = await diagnosticsService.remediateProactiveAnomaly(
        {
          rule: 'WEBHOOK_BURST',
          remediationAction: 'RETRY_WEBHOOK_BURST',
          remediationPayload: { windowHours: 1 },
        },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('RETRY_WEBHOOK_BURST');
      expect(res.message).toContain('Successfully replayed webhook burst');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rule 3: Unapplied Payments
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rule 3: Unapplied Payments', () => {
    it('TC-PA-3.1: detects orphan unapplied payment (SUCCESS with invoiceId null)', async () => {
      const mockUnapplied = [
        {
          id: 'pay-orphan-1',
          provider: PaymentProvider.PAYSTACK,
          providerRef: 'T12345678',
          amount: 150,
          currency: 'USD',
          status: PaymentStatus.SUCCESS,
          invoiceId: null,
          clientId: 'client-abc',
          client: { id: 'client-abc', businessName: 'Safari Tech', email: 'safari@test.com' },
          invoice: null,
        },
      ];

      prismaMock.paymentLog.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === PaymentStatus.SUCCESS) {
          return Promise.resolve(mockUnapplied);
        }
        return Promise.resolve([]);
      });

      const report = await diagnosticsService.getProactiveScan();

      expect(report.counts.unappliedPayments).toBe(1);
      const anomaly = report.anomalies.find((a) => a.rule === 'UNAPPLIED_PAYMENT');
      expect(anomaly).toBeDefined();
      expect(anomaly?.severity).toBe('CRITICAL');
      expect(anomaly?.title).toContain('Unapplied Payment T12345678');
      expect(anomaly?.remediationAction).toBe('AUTO_APPLY_PAYMENT');
    });

    it('TC-PA-3.2: detects payment where linked invoice is not marked PAID', async () => {
      const mockUnsettled = [
        {
          id: 'pay-unsettled-2',
          provider: PaymentProvider.DARAJA,
          providerRef: 'NL12345678',
          amount: 5000,
          currency: 'KES',
          status: PaymentStatus.SUCCESS,
          invoiceId: 'inv-unpaid-2',
          clientId: 'client-xyz',
          client: { id: 'client-xyz', businessName: 'Coast Logistics', email: 'coast@test.com' },
          invoice: {
            id: 'inv-unpaid-2',
            invoiceNumber: 'INV-2026-089',
            status: 'SENT',
            amount: 5000,
            currency: 'KES',
          },
        },
      ];

      prismaMock.paymentLog.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === PaymentStatus.SUCCESS) {
          return Promise.resolve(mockUnsettled);
        }
        return Promise.resolve([]);
      });

      const report = await diagnosticsService.getProactiveScan();

      expect(report.counts.unappliedPayments).toBe(1);
      const anomaly = report.anomalies.find((a) => a.rule === 'UNAPPLIED_PAYMENT');
      expect(anomaly).toBeDefined();
      expect(anomaly?.severity).toBe('CRITICAL');
      expect(anomaly?.title).toContain('Unsettled Payment on Invoice INV-2026-089');
    });

    it('TC-PA-3.3: one-click AUTO_APPLY_PAYMENT marks invoice PAID and provisions roadmap', async () => {
      const mockLog = {
        id: 'pay-log-99',
        provider: PaymentProvider.PAYSTACK,
        providerRef: 'PAY_99',
        amount: 250,
        currency: 'USD',
        status: PaymentStatus.SUCCESS,
        invoiceId: 'inv-target-99',
        clientId: 'client-target-99',
        invoice: {
          id: 'inv-target-99',
          invoiceNumber: 'INV-99',
          amount: 250,
          currency: 'USD',
          status: 'SENT',
          clientId: 'client-target-99',
          notes: 'Kickoff deposit for proposal BZ-PROP-99',
          lineItems: [],
        },
      };

      prismaMock.paymentLog.findUnique.mockResolvedValue(mockLog);
      prismaMock.invoice.findUnique.mockResolvedValue(mockLog.invoice);

      const res = await diagnosticsService.remediateProactiveAnomaly(
        {
          anomalyId: 'unapplied-pay-log-99',
          rule: 'UNAPPLIED_PAYMENT',
          remediationAction: 'AUTO_APPLY_PAYMENT',
          remediationPayload: {
            paymentLogId: 'pay-log-99',
            invoiceId: 'inv-target-99',
            clientId: 'client-target-99',
          },
        },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('AUTO_APPLY_PAYMENT');
      expect(res.message).toContain('Invoice marked PAID and services activated');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-target-99' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-target-99' },
          data: { status: 'ACTIVE' },
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rule 4: Pending Deposits with Expired Quotes
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rule 4: Pending Deposits with Expired Quotes', () => {
    it('TC-PA-4.1: detects paid deposit on expired quote and flags as CRITICAL', async () => {
      const expiredProposal = {
        id: 'prop-expired-1',
        proposalCode: 'BZ-EXP-001',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 5 * 86400_000),
        clientEmail: 'client1@test.com',
        clientName: 'Alpha Corp',
      };

      const paidDepositInvoice = {
        id: 'inv-dep-1',
        invoiceNumber: 'INV-DEP-001',
        amount: 1500,
        currency: 'USD',
        status: 'PAID',
        notes: 'Kickoff deposit (50%) for proposal BZ-EXP-001',
        paymentLogs: [{ status: PaymentStatus.SUCCESS }],
      };

      prismaMock.proposal.findMany.mockResolvedValue([expiredProposal]);
      prismaMock.invoice.findFirst.mockResolvedValue(paidDepositInvoice);

      const report = await diagnosticsService.getProactiveScan();

      expect(report.counts.expiredQuoteDeposits).toBe(1);
      const anomaly = report.anomalies.find((a) => a.rule === 'EXPIRED_QUOTE_DEPOSIT');
      expect(anomaly).toBeDefined();
      expect(anomaly?.severity).toBe('CRITICAL');
      expect(anomaly?.title).toContain('Paid Deposit (USD 1500) on Expired Quote BZ-EXP-001');
      expect(anomaly?.remediationAction).toBe('EXTEND_AND_ACTIVATE_QUOTE');
    });

    it('TC-PA-4.2: detects pending checkout attempt on expired quote and flags as WARNING', async () => {
      const expiredProposal = {
        id: 'prop-expired-2',
        proposalCode: 'BZ-EXP-002',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 2 * 86400_000),
        clientEmail: 'client2@test.com',
        clientName: 'Beta Corp',
      };

      const pendingDepositInvoice = {
        id: 'inv-dep-2',
        invoiceNumber: 'INV-DEP-002',
        amount: 800,
        currency: 'USD',
        status: 'SENT',
        notes: 'Kickoff deposit (50%) for proposal BZ-EXP-002',
        paymentLogs: [{ status: PaymentStatus.PENDING }],
      };

      prismaMock.proposal.findMany.mockResolvedValue([expiredProposal]);
      prismaMock.invoice.findFirst.mockResolvedValue(pendingDepositInvoice);

      const report = await diagnosticsService.getProactiveScan();

      expect(report.counts.expiredQuoteDeposits).toBe(1);
      const anomaly = report.anomalies.find((a) => a.rule === 'EXPIRED_QUOTE_DEPOSIT');
      expect(anomaly).toBeDefined();
      expect(anomaly?.severity).toBe('WARNING');
      expect(anomaly?.title).toContain('Pending Deposit Attempt on Expired Quote BZ-EXP-002');
      expect(anomaly?.remediationAction).toBe('EXTEND_AND_ACTIVATE_QUOTE');
    });

    it('TC-PA-4.3: one-click EXTEND_AND_ACTIVATE_QUOTE extends validity, accepts quote, and provisions project when paid', async () => {
      const proposal = {
        id: 'prop-expired-1',
        proposalCode: 'BZ-EXP-001',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 5 * 86400_000),
      };

      const invoice = {
        id: 'inv-dep-1',
        invoiceNumber: 'INV-DEP-001',
        clientId: 'client-1',
        amount: 1500,
        currency: 'USD',
        status: 'PAID',
        notes: 'proposal BZ-EXP-001',
        lineItems: [],
        paymentLogs: [{ status: PaymentStatus.SUCCESS }],
      };

      prismaMock.proposal.findFirst.mockResolvedValue(proposal);
      prismaMock.invoice.findUnique.mockResolvedValue(invoice);
      prismaMock.invoice.findFirst.mockResolvedValue(invoice);

      const res = await diagnosticsService.remediateProactiveAnomaly(
        {
          rule: 'EXPIRED_QUOTE_DEPOSIT',
          remediationAction: 'EXTEND_AND_ACTIVATE_QUOTE',
          remediationPayload: {
            proposalId: 'prop-expired-1',
            proposalCode: 'BZ-EXP-001',
            invoiceId: 'inv-dep-1',
          },
        },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.action).toBe('EXTEND_AND_ACTIVATE_QUOTE');
      expect((res as any).newStatus).toBe('ACCEPTED');
      expect(res.message).toContain('Proposal BZ-EXP-001 extended by 14 days and marked ACCEPTED');

      // Verify Proposal updated to ACCEPTED
      expect(prismaMock.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prop-expired-1' },
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );

      // Verify AuditLog was recorded
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'proactive.extend_and_activate_quote',
            resourceType: 'Proposal',
          }),
        }),
      );
    });

    it('TC-PA-4.4: one-click EXTEND_AND_ACTIVATE_QUOTE unlocks quote for checkout (LOCKED) when deposit is unpaid', async () => {
      const proposal = {
        id: 'prop-expired-2',
        proposalCode: 'BZ-EXP-002',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 2 * 86400_000),
      };

      const unpaidInvoice = {
        id: 'inv-dep-2',
        invoiceNumber: 'INV-DEP-002',
        clientId: 'client-2',
        amount: 800,
        currency: 'USD',
        status: 'SENT',
        notes: 'proposal BZ-EXP-002',
        lineItems: [],
        paymentLogs: [{ status: PaymentStatus.PENDING }],
      };

      prismaMock.proposal.findFirst.mockResolvedValue(proposal);
      prismaMock.invoice.findUnique.mockResolvedValue(unpaidInvoice);
      prismaMock.invoice.findFirst.mockResolvedValue(unpaidInvoice);

      const res = await diagnosticsService.remediateProactiveAnomaly(
        {
          rule: 'EXPIRED_QUOTE_DEPOSIT',
          remediationAction: 'EXTEND_AND_ACTIVATE_QUOTE',
          remediationPayload: {
            proposalId: 'prop-expired-2',
            proposalCode: 'BZ-EXP-002',
            invoiceId: 'inv-dep-2',
          },
        },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect((res as any).newStatus).toBe('LOCKED');
      expect(res.message).toContain('unlocked for client checkout');

      expect(prismaMock.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prop-expired-2' },
          data: expect.objectContaining({ status: 'LOCKED' }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Unified Proactive Scan Endpoint Aggregation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Unified Proactive Scan Aggregation', () => {
    it('TC-PA-5.1: getProactiveScan aggregates all 4 detectors in a single unified response', async () => {
      const now = Date.now();

      // Rule 1 mock: 1 expiring SSL
      prismaMock.hostingAccount.findMany.mockResolvedValue([
        {
          id: 'h-1',
          domain: 'scan-exp.com',
          status: 'ACTIVE',
          sslExpiry: new Date(now + 2 * 86400_000),
        },
      ]);

      // Rule 2 & 3 mock: 3 failed webhooks and 1 unapplied payment
      prismaMock.paymentLog.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === PaymentStatus.FAILED) {
          return Promise.resolve([
            { id: 'wh-1', provider: 'PAYSTACK', status: 'FAILED', createdAt: new Date() },
            { id: 'wh-2', provider: 'PAYSTACK', status: 'FAILED', createdAt: new Date() },
            { id: 'wh-3', provider: 'PAYSTACK', status: 'FAILED', createdAt: new Date() },
          ]);
        }
        if (args?.where?.status === PaymentStatus.SUCCESS) {
          return Promise.resolve([
            {
              id: 'pay-1',
              provider: 'PAYSTACK',
              amount: 100,
              currency: 'USD',
              status: 'SUCCESS',
              invoiceId: null,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      // Rule 4 mock: 1 expired proposal with paid deposit
      prismaMock.proposal.findMany.mockResolvedValue([
        {
          id: 'prop-1',
          proposalCode: 'BZ-QUOTE-1',
          status: 'EXPIRED',
          expiresAt: new Date(now - 86400_000),
        },
      ]);
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-1',
        status: 'PAID',
        amount: 500,
        currency: 'USD',
        notes: 'proposal BZ-QUOTE-1',
        paymentLogs: [],
      });

      const report = await diagnosticsService.getProactiveScan();

      expect(report.success).toBe(true);
      expect(report.status).toBe('ANOMALIES_DETECTED');
      expect(report.summary.totalAnomalies).toBe(4);
      expect(report.counts.sslExpiring).toBe(1);
      expect(report.counts.webhookBursts).toBe(1);
      expect(report.counts.unappliedPayments).toBe(1);
      expect(report.counts.expiredQuoteDeposits).toBe(1);
      expect(report.anomalies).toHaveLength(4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AdminDiagnosticsController Endpoints
  // ───────────────────────────────────────────────────────────────────────────
  describe('AdminDiagnosticsController Proactive Endpoints', () => {
    let controller: AdminDiagnosticsController;

    beforeEach(() => {
      controller = new AdminDiagnosticsController(diagnosticsService);
    });

    it('GET proactive-scan: calls svc.getProactiveScan', async () => {
      jest.spyOn(diagnosticsService, 'getProactiveScan').mockResolvedValue({
        success: true,
        status: 'HEALTHY',
        scannedAt: new Date().toISOString(),
        summary: { totalAnomalies: 0, critical: 0, warning: 0, info: 0 },
        counts: { sslExpiring: 0, webhookBursts: 0, unappliedPayments: 0, expiredQuoteDeposits: 0 },
        anomalies: [],
      });

      const res = await controller.getProactiveScan();
      expect(res.success).toBe(true);
      expect(res.status).toBe('HEALTHY');
    });

    it('POST proactive-scan/remediate: calls svc.remediateProactiveAnomaly', async () => {
      jest.spyOn(diagnosticsService, 'remediateProactiveAnomaly').mockResolvedValue({
        success: true,
        action: 'RETRY_WEBHOOK_BURST',
        message: 'Burst replayed',
      } as any);

      const dto = {
        remediationAction: 'RETRY_WEBHOOK_BURST',
        remediationPayload: { windowHours: 1 },
      };
      const res = await controller.remediateProactiveAnomaly(dto, { user: staffUser });
      expect(res.success).toBe(true);
      expect(res.action).toBe('RETRY_WEBHOOK_BURST');
    });

    it('POST remediate (alias): calls svc.remediateProactiveAnomaly', async () => {
      jest.spyOn(diagnosticsService, 'remediateProactiveAnomaly').mockResolvedValue({
        success: true,
        action: 'AUTO_APPLY_PAYMENT',
        message: 'Payment settled',
      } as any);

      const dto = {
        remediationAction: 'AUTO_APPLY_PAYMENT',
        remediationPayload: { paymentLogId: 'pay-1' },
      };
      const res = await controller.remediateAnomaly(dto, { user: staffUser });
      expect(res.success).toBe(true);
      expect(res.action).toBe('AUTO_APPLY_PAYMENT');
    });
  });
});

