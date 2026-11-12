import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  BillingCycle,
  ClientStatus,
  InvoiceStatus,

  PaymentStatus,
  PlanTier,
  PlatformOutboxStatus,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as http from 'http';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentSettlementService, checkoutLineItem } from '../billing/payment-settlement.service';
import { PaystackService } from '../billing/paystack.service';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import { PlatformCallbacksController } from './platform-callbacks.controller';
import { PlatformProvisioningAdminController } from './platform-provisioning-admin.controller';
import { PlatformProvisioningOutboxService } from './platform-provisioning-outbox.service';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';
import { PlatformHostingCutoverService } from './platform-hosting-cutover.service';
import { PlatformProvisioningWorkerService } from './platform-provisioning-worker.service';
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
} from './provisioning-crypto';

const rawTestDbUrl = (process.env.BAZIONWEB_TEST_DATABASE_URL ?? '').trim();

function isSafeTestDatabaseUrl(urlString: string): boolean {
  if (!urlString) return false;
  try {
    const parsed = new URL(urlString);
    if (process.env.ALLOW_REMOTE_TEST_DB === 'true') return true;
    const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    const isTestDbName = parsed.pathname.toLowerCase().includes('test');
    return isLocalHost && isTestDbName;
  } catch {
    return false;
  }
}

const enabled = isSafeTestDatabaseUrl(rawTestDbUrl);
const describePg = enabled ? describe : describe.skip;

function signCallbackHeaders(
  body: Record<string, unknown>,
  signingSecret: string,
  bearerSecret: string,
): { raw: string; signature: string; authorization: string } {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac('sha256', signingSecret)
    .update(`${ts}.${raw}`, 'utf8')
    .digest('hex');
  const token = jwt.sign(
    { scope: 'provisioning:status:write' },
    bearerSecret,
    {
      algorithm: 'HS256',
      issuer: DEFAULT_CALLBACK_ISSUER,
      audience: DEFAULT_CALLBACK_AUDIENCE,
      subject: 'bazion-platform-status-worker',
      jwtid: crypto.randomUUID(),
      expiresIn: 120,
    },
  );
  return {
    raw,
    signature: `t=${ts},v1=${sig}`,
    authorization: `Bearer ${token}`,
  };
}

function catalogSnapshot(offerId: string) {
  return {
    schemaVersion: '1.0.0' as const,
    catalogGeneratedAt: '2026-11-12T00:00:00.000Z',
    binding: {
      offer: { id: offerId, version: '2026.1.0' },
      composition: {
        product: { id: 'bazion-site', version: '1.0.0' },
        solution: { id: 'business-website', version: '1.0.0' },
        template: { id: 'node-nextjs', version: '1.0.0' },
      },
      requiredModules: [{ id: 'website-content', version: '1.0.0' }],
      optionalModules: [],
      distributionMode: 'shared-managed' as const,
    },
  };
}
describePg('PostgreSQL Commercial Provisioning Outbox, Worker, Callback & Reconciliation', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaClient;
  let nestApp: INestApplication;
  let nestBaseUrl: string;
  let settlement: PaymentSettlementService;
  let outboxService: PlatformProvisioningOutboxService;
  let worker: PlatformProvisioningWorkerService;
  let reconciliation: PlatformProvisioningReconciliationService;

  const commandSecret = 'pg-integ-command-secret-32-chars-min';
  const callbackSigningSecret = 'pg-integ-callback-signing-secret-32c';
  const callbackBearerSecret = 'pg-integ-callback-bearer-secret-32ch';

  const cleanupPlanIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupClientIds: string[] = [];
  const cleanupSubscriptionIds: string[] = [];
  const cleanupInvoiceIds: string[] = [];
  const cleanupOperationIds: string[] = [];
  const cleanupEventIds: string[] = [];

  async function seedCommercialFixture(suffix: string) {
    const plan = await prisma.plan.create({
      data: {
        name: `PG Integ Plan ${suffix}`,
        tier: PlanTier.BUSINESS,
        priceMonthly: 15000,
        priceAnnual: 150000,
        uptimeSla: '99.9%',
        p1ResponseMinutes: 15,
        p2ResponseMinutes: 60,
        p3ResponseMinutes: 240,
        maxBackupRetention: 30,
      },
    });
    cleanupPlanIds.push(plan.id);

    const user = await prisma.user.create({
      data: {
        email: `integ-${suffix}@bazionweb.test`,
        role: UserRole.CLIENT,
        keycloakId: `integ-kc-${suffix}`,
        firstName: 'Amina',
        lastName: 'Otieno',
      },
    });
    cleanupUserIds.push(user.id);

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName: `PG Integ Co ${suffix}`,
        contactName: 'Amina Otieno',
        email: `integ-client-${suffix}@bazionweb.test`,
        planId: plan.id,
        status: ClientStatus.TRIAL,
      },
    });
    cleanupClientIds.push(client.id);

    const subscription = await prisma.subscription.create({
      data: {
        clientId: client.id,
        planId: plan.id,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.TRIAL,
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    cleanupSubscriptionIds.push(subscription.id);

    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        subscriptionId: subscription.id,
        invoiceNumber: `INV-PG-${suffix}`,
        amount: 15000,
        currency: 'KES',
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        lineItems: [
          checkoutLineItem({
            description: 'Business Website Package',
            amount: 15000,
            currency: 'KES',
            planId: plan.id,
            productId: 'website-business',
            purpose: 'subscription',
            platformProvisioningBinding: catalogSnapshot('website-business'),
          }),
        ],
      },
    });
    cleanupInvoiceIds.push(invoice.id);

    return { plan, user, client, subscription, invoice };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: rawTestDbUrl } },
    });
    await prisma.$connect();

    const configValues: Record<string, string> = {
      PLATFORM_COMMAND_ISSUER: DEFAULT_COMMAND_ISSUER,
      PLATFORM_PROVISIONING_COMMAND_ISSUER: DEFAULT_COMMAND_ISSUER,
      PLATFORM_PROVISIONING_COMMAND_AUDIENCE: DEFAULT_COMMAND_AUDIENCE,
      PLATFORM_PROVISIONING_COMMAND_SECRET: commandSecret,
      PLATFORM_CALLBACK_SIGNING_SECRET: callbackSigningSecret,
      PLATFORM_CALLBACK_BEARER_SECRET: callbackBearerSecret,
      PLATFORM_CALLBACK_MAX_SKEW_SECONDS: '300',
      PLATFORM_PROVISIONING_BATCH_SIZE: '10',
      PLATFORM_PROVISIONING_LEASE_SECONDS: '60',
      PLATFORM_PROVISIONING_TIMEOUT_MS: '5000',
      PLATFORM_PROVISIONING_WORKER_ENABLED: 'false',
      KEYCLOAK_URL: 'https://auth.example.test',
      KEYCLOAK_REALM: 'bazionweb',
      JWT_SECRET: 'test-jwt-secret-placeholder-unused',
    };

    const mockConfig: Partial<ConfigService> = {
      get: ((key: string, defaultVal?: unknown) => configValues[key] ?? defaultVal) as any,
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformCallbacksController, PlatformProvisioningAdminController],
      providers: [
        Reflector,
        PlatformProvisioningOutboxService,
        PlatformProvisioningWorkerService,
        PlatformCallbackProjectionService,
        PlatformProvisioningReconciliationService,
        PlatformHostingCutoverService,
        PaymentSettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaystackService, useValue: {} },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    nestApp = moduleRef.createNestApplication({ rawBody: true });
    nestApp.enableVersioning({ type: VersioningType.URI });
    nestApp.setGlobalPrefix('api');
    await nestApp.listen(0, '127.0.0.1');

    const address = nestApp.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    nestBaseUrl = `http://127.0.0.1:${port}`;

    settlement = moduleRef.get(PaymentSettlementService);
    outboxService = moduleRef.get(PlatformProvisioningOutboxService);
    worker = moduleRef.get(PlatformProvisioningWorkerService);
    reconciliation = moduleRef.get(PlatformProvisioningReconciliationService);
  });

  afterAll(async () => {
    if (cleanupEventIds.length > 0) {
      await prisma.platformCallbackInbox.deleteMany({
        where: { eventId: { in: cleanupEventIds } },
      }).catch(() => undefined);
    }
    if (cleanupOperationIds.length > 0) {
      await prisma.platformProvisioningProjection.deleteMany({
        where: { operationId: { in: cleanupOperationIds } },
      }).catch(() => undefined);
    }
    if (cleanupInvoiceIds.length > 0) {
      await prisma.platformProvisioningOutbox.deleteMany({
        where: { invoiceId: { in: cleanupInvoiceIds } },
      }).catch(() => undefined);
      await prisma.paymentLog.deleteMany({
        where: { invoiceId: { in: cleanupInvoiceIds } },
      }).catch(() => undefined);
      await prisma.invoice.deleteMany({
        where: { id: { in: cleanupInvoiceIds } },
      }).catch(() => undefined);
    }
    if (cleanupSubscriptionIds.length > 0) {
      await prisma.subscription.deleteMany({
        where: { id: { in: cleanupSubscriptionIds } },
      }).catch(() => undefined);
    }
    if (cleanupClientIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: cleanupClientIds } },
      }).catch(() => undefined);
    }
    if (cleanupUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: cleanupUserIds } },
      }).catch(() => undefined);
    }
    if (cleanupPlanIds.length > 0) {
      await prisma.plan.deleteMany({
        where: { id: { in: cleanupPlanIds } },
      }).catch(() => undefined);
    }

    await nestApp?.close();
    await prisma?.$disconnect();
  });

  it('commits settlement + outbox in one transaction and rolls back both on mid-tx failure', async () => {
    const suffixCommit = crypto.randomUUID().slice(0, 8);
    const fx1 = await seedCommercialFixture(suffixCommit);

    const result = await settlement.settlePaystackCharge({
      reference: `ref-pg-${suffixCommit}`,
      amount: 1500000,
      currency: 'KES',
      channel: 'card',
      metadata: {
        invoiceNumber: fx1.invoice.invoiceNumber,
        planId: fx1.plan.id,
        purpose: 'subscription',
      },
    });
    expect(result.status).toBe('PROCESSED');

    const [paidInvoice, activeSub, outboxRows, paymentLog] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: fx1.invoice.id } }),
      prisma.subscription.findUniqueOrThrow({ where: { id: fx1.subscription.id } }),
      prisma.platformProvisioningOutbox.findMany({ where: { invoiceId: fx1.invoice.id } }),
      prisma.paymentLog.findFirst({ where: { invoiceId: fx1.invoice.id } }),
    ]);

    expect(paidInvoice.status).toBe(InvoiceStatus.PAID);
    expect(activeSub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(paymentLog?.status).toBe(PaymentStatus.SUCCESS);
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].status).toBe(PlatformOutboxStatus.PENDING);
    expect(outboxRows[0].externalOrderId).toBe(`${fx1.invoice.invoiceNumber}:line:0`);

    // Rollback check: failure after outbox insert inside $transaction leaves 0 outbox rows and UNPAID invoice
    const suffixRollback = crypto.randomUUID().slice(0, 8);
    const fx2 = await seedCommercialFixture(suffixRollback);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: fx2.invoice.id },
          data: { status: InvoiceStatus.PAID, paidAt: new Date() },
        });
        await outboxService.enqueueForSettledInvoice(tx, {
          ...fx2.invoice,
          client: { ...fx2.client, plan: fx2.plan },
        });
        throw new Error('SIMULATED_MID_TRANSACTION_FAILURE');
      }),
    ).rejects.toThrow('SIMULATED_MID_TRANSACTION_FAILURE');

    const [unpaidInvoice, rollbackOutbox] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: fx2.invoice.id } }),
      prisma.platformProvisioningOutbox.findMany({ where: { invoiceId: fx2.invoice.id } }),
    ]);
    expect(unpaidInvoice.status).toBe(InvoiceStatus.SENT);
    expect(unpaidInvoice.paidAt).toBeNull();
    expect(rollbackOutbox).toHaveLength(0);
  });

  it('claims once via FOR UPDATE SKIP LOCKED, survives HTTP 503 downtime to DEAD, and replays to ACCEPTED', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const fx = await seedCommercialFixture(suffix);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: fx.invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      await outboxService.enqueueForSettledInvoice(tx, {
        ...fx.invoice,
        client: { ...fx.client, plan: fx.plan },
      });
    });

    const row = await prisma.platformProvisioningOutbox.findFirstOrThrow({
      where: { invoiceId: fx.invoice.id },
    });
    await prisma.platformProvisioningOutbox.update({
      where: { id: row.id },
      data: { maxAttempts: 2 },
    });

    // Two concurrent workers claim against real PostgreSQL SKIP LOCKED
    const [claimA, claimB] = await Promise.all([
      worker.claimDueBatch(5, 60),
      worker.claimDueBatch(5, 60),
    ]);
    const claimedForInvoice = [...claimA, ...claimB].filter((c) => c.invoiceId === fx.invoice.id);
    expect(claimedForInvoice).toHaveLength(1);

    // Release lease back to PENDING for HTTP downtime test
    await prisma.platformProvisioningOutbox.update({
      where: { id: row.id },
      data: {
        status: PlatformOutboxStatus.PENDING,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(Date.now() - 1000),
      },
    });

    let mode: 'down' | 'up' = 'down';
    const operationId = crypto.randomUUID();
    cleanupOperationIds.push(operationId);

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        if (mode === 'down') {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }));
          return;
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            accepted: true,
            deduplicated: false,
            operation: {
              schemaVersion: '1.0.0',
              operationId,
              correlationId: payload.correlationId,
              externalOrderId: payload.order.externalOrderId,
              status: 'accepted',
              currentStep: 'command_accepted',
              tenantId: null,
              installationId: null,
              failure: null,
              updatedAt: new Date().toISOString(),
            },
          }),
        );
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const serverAddr = server.address();
    const serverPort = typeof serverAddr === 'object' && serverAddr ? serverAddr.port : 0;
    const platformUrl = `http://127.0.0.1:${serverPort}`;

    try {
      // Attempt 1 -> 503 retry with future backoff
      const firstBatch = await worker.processDueBatch({
        platformApiBaseUrl: platformUrl,
        commandSecret,
        retryBaseSeconds: 5,
        retryMaxSeconds: 30,
        randomFn: () => 0,
      });
      expect(firstBatch.retried).toBeGreaterThanOrEqual(1);

      const afterFirst = await prisma.platformProvisioningOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(afterFirst.status).toBe(PlatformOutboxStatus.PENDING);
      expect(afterFirst.attemptCount).toBe(1);
      expect(afterFirst.lastHttpStatus).toBe(503);
      expect(afterFirst.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

      // Attempt 2 -> exhaust maxAttempts=2 -> DEAD
      await prisma.platformProvisioningOutbox.update({
        where: { id: row.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });
      const secondBatch = await worker.processDueBatch({
        platformApiBaseUrl: platformUrl,
        commandSecret,
      });
      expect(secondBatch.deadLettered).toBeGreaterThanOrEqual(1);

      const deadRow = await prisma.platformProvisioningOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(deadRow.status).toBe(PlatformOutboxStatus.DEAD);
      expect(deadRow.deadLetteredAt).not.toBeNull();

      // Operator replay -> recovery when platform comes back up
      await worker.replayOutboxEntry(row.id);
      mode = 'up';
      const replayBatch = await worker.processDueBatch({
        platformApiBaseUrl: platformUrl,
        commandSecret,
      });
      expect(replayBatch.accepted).toBeGreaterThanOrEqual(1);

      const acceptedRow = await prisma.platformProvisioningOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(acceptedRow.status).toBe(PlatformOutboxStatus.ACCEPTED);
      expect(acceptedRow.platformOperationId).toBe(operationId);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('ingests signed callbacks over real NestJS HTTP with inbox dedupe, monotonic guard, and lag polling', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const fx = await seedCommercialFixture(suffix);
    const opId = crypto.randomUUID();
    const corrId = crypto.randomUUID();
    cleanupOperationIds.push(opId);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: fx.invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      await outboxService.enqueueForSettledInvoice(tx, {
        ...fx.invoice,
        client: { ...fx.client, plan: fx.plan },
      });
    });

    const outbox = await prisma.platformProvisioningOutbox.findFirstOrThrow({
      where: { invoiceId: fx.invoice.id },
    });
    await prisma.platformProvisioningOutbox.update({
      where: { id: outbox.id },
      data: {
        status: PlatformOutboxStatus.ACCEPTED,
        platformOperationId: opId,
        correlationId: corrId,
        acceptedAt: new Date(Date.now() - 180_000),
      },
    });

    // Ready callback delivered via live HTTP to NestJS PlatformCallbacksController
    const readyEventId = crypto.randomUUID();
    cleanupEventIds.push(readyEventId);
    const tenantId = crypto.randomUUID();
    const installationId = crypto.randomUUID();
    const readyPayload = {
      schemaVersion: '1.0.0',
      eventType: 'product.provisioning.status.v1',
      eventId: readyEventId,
      correlationId: corrId,
      occurredAt: new Date().toISOString(),
      source: 'bazion-platform',
      operation: {
        schemaVersion: '1.0.0',
        operationId: opId,
        correlationId: corrId,
        externalOrderId: outbox.externalOrderId,
        status: 'ready',
        currentStep: 'installation_ready',
        tenantId,
        installationId,
        failure: null,
        updatedAt: new Date().toISOString(),
      },
    };
    const signedReady = signCallbackHeaders(readyPayload, callbackSigningSecret, callbackBearerSecret);

    const res1 = await fetch(`${nestBaseUrl}/api/v1/webhooks/platform/provisioning-status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bazion-signature': signedReady.signature,
        authorization: signedReady.authorization,
      },
      body: signedReady.raw,
    });
    expect(res1.status).toBe(202);
    const body1 = (await res1.json()) as { deduplicated: boolean; status: string };
    expect(body1.deduplicated).toBe(false);
    expect(body1.status).toBe('ready');

    // Replay same eventId over HTTP -> deduplicated
    const resReplay = await fetch(`${nestBaseUrl}/api/v1/webhooks/platform/provisioning-status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bazion-signature': signedReady.signature,
        authorization: signedReady.authorization,
      },
      body: signedReady.raw,
    });
    expect(resReplay.status).toBe(202);
    const bodyReplay = (await resReplay.json()) as { deduplicated: boolean };
    expect(bodyReplay.deduplicated).toBe(true);

    // Out-of-order regression event -> ignored monotonically
    const staleEventId = crypto.randomUUID();
    cleanupEventIds.push(staleEventId);
    const stalePayload = {
      ...readyPayload,
      eventId: staleEventId,
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      operation: {
        ...readyPayload.operation,
        status: 'validating',
        currentStep: 'validating_request',
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
      },
    };
    const signedStale = signCallbackHeaders(stalePayload, callbackSigningSecret, callbackBearerSecret);
    const resStale = await fetch(`${nestBaseUrl}/api/v1/webhooks/platform/provisioning-status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bazion-signature': signedStale.signature,
        authorization: signedStale.authorization,
      },
      body: signedStale.raw,
    });
    expect(resStale.status).toBe(202);
    const bodyStale = (await resStale.json()) as { staleIgnored: boolean };
    expect(bodyStale.staleIgnored).toBe(true);

    const projection = await prisma.platformProvisioningProjection.findUniqueOrThrow({
      where: { operationId: opId },
    });
    expect(projection.status).toBe('ready');
    expect(projection.installationId).toBe(installationId);

    // Reconciliation + lag poll on a separate lagging accepted outbox row
    const lagSuffix = `${suffix}-lag`;
    const fxLag = await seedCommercialFixture(lagSuffix);
    const lagOpId = crypto.randomUUID();
    const lagCorrId = crypto.randomUUID();
    cleanupOperationIds.push(lagOpId);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: fxLag.invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      await outboxService.enqueueForSettledInvoice(tx, {
        ...fxLag.invoice,
        client: { ...fxLag.client, plan: fxLag.plan },
      });
    });

    const lagOutbox = await prisma.platformProvisioningOutbox.findFirstOrThrow({
      where: { invoiceId: fxLag.invoice.id },
    });
    await prisma.platformProvisioningOutbox.update({
      where: { id: lagOutbox.id },
      data: {
        status: PlatformOutboxStatus.ACCEPTED,
        platformOperationId: lagOpId,
        correlationId: lagCorrId,
        acceptedAt: new Date(Date.now() - 180_000),
      },
    });

    const reportBefore = await reconciliation.getReconciliationReport(1);
    expect(reportBefore.laggingAcceptedOutbox.some((item) => item.outboxId === lagOutbox.id)).toBe(true);

    const pollServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.endsWith(`/v1/internal/commercial/operations/${lagOpId}`)) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            operation: {
              schemaVersion: '1.0.0',
              operationId: lagOpId,
              correlationId: lagCorrId,
              externalOrderId: lagOutbox.externalOrderId,
              status: 'ready',
              currentStep: 'installation_ready',
              tenantId: crypto.randomUUID(),
              installationId: crypto.randomUUID(),
              failure: null,
              updatedAt: new Date().toISOString(),
            },
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => pollServer.listen(0, '127.0.0.1', () => resolve()));
    const pollAddr = pollServer.address();
    const pollPort = typeof pollAddr === 'object' && pollAddr ? pollAddr.port : 0;

    try {
      const pollRes = await reconciliation.pollLaggingOperations({
        staleMinutes: 1,
        platformApiBaseUrl: `http://127.0.0.1:${pollPort}`,
        commandSecret,
      });
      expect(pollRes.checked).toBeGreaterThanOrEqual(1);
      expect(pollRes.updated).toBeGreaterThanOrEqual(1);

      const caughtUpProjection = await prisma.platformProvisioningProjection.findUniqueOrThrow({
        where: { operationId: lagOpId },
      });
      expect(caughtUpProjection.status).toBe('ready');

      const reportAfter = await reconciliation.getReconciliationReport(1);
      expect(reportAfter.laggingAcceptedOutbox.some((item) => item.outboxId === lagOutbox.id)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => pollServer.close(() => resolve()));
    }
  });
});
