import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  PaymentProvider,
  PlatformOutboxStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from '../billing/paystack.service';
import {
  PaymentSettlementService,
  checkoutLineItem,
} from '../billing/payment-settlement.service';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import { PlatformCallbacksController } from './platform-callbacks.controller';
import { PlatformProvisioningOutboxService } from './platform-provisioning-outbox.service';
import { PlatformProvisioningReconciliationService } from './platform-provisioning-reconciliation.service';
import { PlatformProvisioningWorkerService } from './platform-provisioning-worker.service';
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  signCommercialCommandToken,
} from './provisioning-crypto';
import { buildProvisioningRequestsForSettledInvoice } from './provisioning-request-builder';

function signWebhookHeader(rawBody: string, secret: string, tsSec: number): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${tsSec}.${rawBody}`)
    .digest('hex');
  return `t=${tsSec},v1=${digest}`;
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
describe('BazionWeb commercial provisioning Phase 3 delivery suite', () => {
  it('dead-letters a paid Platform order when a legacy hosting account already owns its requested domain', async () => {
    const upsert = jest.fn(async ({ create }: any) => create);
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([]) // advisory transaction lock
      .mockResolvedValueOnce([{ id: 'legacy-hosting-1' }]);
    const service = new PlatformProvisioningOutboxService();

    await service.enqueueForSettledInvoice(
      {
        $queryRaw: queryRaw,
        platformProvisioningOutbox: { upsert },
      },
      {
        id: 'inv-domain-conflict',
        invoiceNumber: 'INV-DOMAIN-CONFLICT',
        clientId: 'client-domain-conflict',
        lineItems: [
          {
            productId: 'website-business',
            requestedDomain: 'Example.com',
            platformProvisioningBinding: catalogSnapshot('website-business'),
          },
        ],
        client: {
          id: 'client-domain-conflict',
          businessName: 'Domain Conflict Co',
          contactName: 'Amina',
          email: 'amina@example.test',
        },
      },
    );

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: PlatformOutboxStatus.DEAD,
        lastErrorCode: 'PLATFORM_DOMAIN_CLAIM_CONFLICT',
        deadLetteredAt: expect.any(Date),
        payload: expect.objectContaining({ requestedDomain: 'example.com' }),
      }),
    }));
  });

  it('reserves a requested domain against a different Platform order', async () => {
    const upsert = jest.fn(async ({ create }: any) => create);
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([]) // advisory transaction lock
      .mockResolvedValueOnce([{ claimId: 'another-order', source: 'outbox', externalOrderId: 'another-order' }]);
    const service = new PlatformProvisioningOutboxService();

    await service.enqueueForSettledInvoice(
      { $queryRaw: queryRaw, platformProvisioningOutbox: { upsert } },
      {
        id: 'inv-platform-domain-conflict',
        invoiceNumber: 'INV-PLATFORM-DOMAIN-CONFLICT',
        clientId: 'client-platform-domain-conflict',
        lineItems: [
          {
            productId: 'website-business',
            requestedDomain: 'example.com',
            platformProvisioningBinding: catalogSnapshot('website-business'),
          },
        ],
        client: {
          id: 'client-platform-domain-conflict',
          businessName: 'Second Domain Co',
          contactName: 'Samuel',
          email: 'samuel@example.test',
        },
      },
    );

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: PlatformOutboxStatus.DEAD,
        lastErrorCode: 'PLATFORM_DOMAIN_CLAIM_CONFLICT',
      }),
    }));
  });

  it('refuses operator replay while another order or legacy account owns the requested domain', async () => {
    const update = jest.fn();
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([]) // advisory transaction lock
        .mockResolvedValueOnce([{ claimId: 'legacy-hosting-1', source: 'legacy_hosting', externalOrderId: null }]),
      platformProvisioningOutbox: { update },
    };
    const prisma: any = {
      platformProvisioningOutbox: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'outbox-domain-1',
          externalOrderId: 'order-domain-1',
          payload: { requestedDomain: 'example.com' },
          maxAttempts: 8,
          attemptCount: 1,
        }),
      },
      $transaction: jest.fn((callback: (transaction: any) => unknown) => callback(tx)),
    };
    const worker = new PlatformProvisioningWorkerService(prisma);

    await expect(worker.replayOutboxEntry('outbox-domain-1')).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('builds commands only for settled lines pinned to Platform catalog releases', () => {
    const commands = buildProvisioningRequestsForSettledInvoice({
      invoice: {
        id: 'inv-1001',
        invoiceNumber: 'INV-2026-1001',
        clientId: 'client-1001',
        subscriptionId: 'sub-1001',
        lineItems: [
          checkoutLineItem({
            description: 'Business Website KES 90,000',
            amount: 90000,
            currency: 'KES',
            productId: 'website-business',
            billingCycle: 'MONTHLY',
            platformProvisioningBinding: catalogSnapshot('website-business'),
          }),
          checkoutLineItem({
            description: 'Blog Engine Add-on',
            amount: 7500,
            currency: 'KES',
            productId: 'addon-blog-news',
          }),
        ],
      },
      client: {
        id: 'client-1001',
        businessName: 'Savannah Roasters Ltd',
        contactName: 'Grace Wanjiku',
        email: '  GRACE@SAVANNAH.EXAMPLE  ',
        planId: 'plan-business',
        plan: { id: 'plan-business', name: 'Business Website', tier: 'BUSINESS' },
      },
      occurredAt: new Date('2026-11-11T20:00:00.000Z'),
    });

    expect(commands).toHaveLength(1);
    expect(commands[0]?.idempotencyKey).toBe('bazionweb:order:inv-1001:line:0:v1');
    expect(commands[0]?.externalOrderId).toBe('INV-2026-1001:line:0');
    expect(commands[0]?.payload.customer.primaryContact.email).toBe('grace@savannah.example');
    expect(commands[0]?.payload.order.offerId).toBe('website-business');

    const serialized = JSON.stringify(commands);
    expect(serialized).not.toContain('90000');
    expect(serialized).not.toContain('KES');
    expect(commands[0]?.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not infer offers or releases from plan names when an invoice lacks a quote-time catalog pin', () => {
    const commands = buildProvisioningRequestsForSettledInvoice({
      invoice: {
        id: 'inv-unpinned',
        clientId: 'client-unpinned',
        lineItems: [checkoutLineItem({
          description: 'Website Business subscription',
          amount: 90000,
          currency: 'KES',
          planId: 'plan-business',
          productId: 'website-business',
        })],
      },
      client: { id: 'client-unpinned', planId: 'plan-business', plan: { name: 'Business Website', tier: 'BUSINESS' } },
    });
    expect(commands).toEqual([]);
  });
  it('enqueues outbox commands inside the same settlement transaction and aborts on failure', async () => {
    const outboxRows: any[] = [];
    const invoiceUpdate = jest.fn().mockResolvedValue({});
    const clientUpdate = jest.fn().mockResolvedValue({});
    const subscriptionFindFirst = jest.fn().mockResolvedValue(null);
    const subscriptionCreate = jest.fn().mockResolvedValue({ id: 'sub-new-1' });
    const paymentLogUpsert = jest.fn().mockResolvedValue({});
    const outboxUpsert = jest.fn(async ({ create }: any) => {
      outboxRows.push(create);
      return create;
    });

    const mockPrisma: any = {
      paymentLog: { findUnique: jest.fn().mockResolvedValue(null) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-atomic-1',
          invoiceNumber: 'INV-ATOMIC-1',
          amount: 5000,
          currency: 'KES',
          status: InvoiceStatus.SENT,
          clientId: 'client-atomic-1',
          subscriptionId: null,
          lineItems: [
            checkoutLineItem({
              description: 'Launch Website',
              amount: 5000,
              currency: 'KES',
              productId: 'website-launch',
              billingCycle: 'MONTHLY',
              platformProvisioningBinding: catalogSnapshot('website-launch'),
            }),
          ],
          client: {
            id: 'client-atomic-1',
            businessName: 'Atomic Test Co',
            contactName: 'Samuel',
            email: 'samuel@atomic.test',
            planId: 'plan-starter',
          },
        }),
      },
      $transaction: jest.fn(async (fn: any) => {
        const tx = {
          invoice: { update: invoiceUpdate },
          subscription: {
            findFirst: subscriptionFindFirst,
            findUnique: jest.fn().mockResolvedValue(null),
            create: subscriptionCreate,
            update: jest.fn(),
          },
          client: { update: clientUpdate, findUnique: jest.fn().mockResolvedValue(null) },
          paymentLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: paymentLogUpsert,
          },
          platformProvisioningOutbox: {
            upsert: outboxUpsert,
          },
        };
        return fn(tx);
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentSettlementService,
        PlatformProvisioningOutboxService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaystackService, useValue: {} },
      ],
    }).compile();

    const settlement = moduleRef.get(PaymentSettlementService);
    const result = await settlement.settlePaystackCharge({
      reference: 'ps_atomic_1',
      amount: 500000,
      currency: 'KES',
      channel: 'card',
      metadata: { invoiceNumber: 'INV-ATOMIC-1' },
    });

    expect(result.status).toBe('PROCESSED');
    expect(outboxUpsert).toHaveBeenCalledTimes(1);
    expect(outboxRows[0]).toMatchObject({
      invoiceId: 'inv-atomic-1',
      idempotencyKey: 'bazionweb:order:inv-atomic-1:line:0:v1',
      externalOrderId: 'INV-ATOMIC-1:line:0',
    });

    // One-time / proposal-free checkout (purpose: 'invoice_payment', subscriptionId: null) also enqueues atomically.
    const oneTimeOutboxCountBefore = outboxRows.length;
    await settlement.activatePaidSubscription(
      await mockPrisma.$transaction((tx: any) => tx),
      {
        id: 'inv-one-time-1',
        invoiceNumber: 'INV-ONE-1',
        clientId: 'client-atomic-1',
        subscriptionId: null,
        amount: 25000,
        currency: 'KES',
        lineItems: [
          checkoutLineItem({
            description: 'Enterprise Setup',
            amount: 25000,
            currency: 'KES',
            productId: 'website-enterprise',
            purpose: 'invoice_payment',
            platformProvisioningBinding: catalogSnapshot('website-enterprise'),
          }),
        ],
        client: {
          id: 'client-atomic-1',
          businessName: 'Atomic Test Co',
          contactName: 'Samuel',
          email: 'samuel@atomic.test',
          planId: 'plan-starter',
        } as any,
      },
      {
        provider: PaymentProvider.DARAJA,
        providerRef: 'MPESA-1234',
        metadataPurpose: 'invoice_payment',
      },
    );
    expect(outboxRows.length).toBe(oneTimeOutboxCountBefore + 1);
    expect(outboxRows[1]?.externalOrderId).toBe('INV-ONE-1:line:0');

    // If outbox insertion fails, the entire settlement throws so the DB transaction rolls back.
    outboxUpsert.mockRejectedValueOnce(new Error('OUTBOX_WRITE_FAILED'));
    await expect(
      settlement.settlePaystackCharge({
        reference: 'ps_atomic_2',
        amount: 500000,
        currency: 'KES',
        channel: 'card',
        metadata: { invoiceNumber: 'INV-ATOMIC-1' },
      }),
    ).rejects.toThrow('OUTBOX_WRITE_FAILED');
  });

  it('delivers commands with short-lived audience JWT, backoff/jitter retry, dead-lettering, lease fencing, and replay', async () => {
    const commandSecret = 'commercial-command-secret-32-chars-ok';
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      invoiceId: 'inv-dlv-1',
      clientId: 'client-1',
      eventId: '22222222-2222-4222-8222-222222222222',
      correlationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'bazionweb:order:inv-dlv-1:line:0:v1',
      externalOrderId: 'INV-DLV-1:line:0',
      payload: { externalOrderId: 'INV-DLV-1:line:0' },
      status: PlatformOutboxStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 2,
      leaseToken: null as string | null,
      leaseExpiresAt: null as Date | null,
      nextAttemptAt: new Date(Date.now() - 1000),
      platformOperationId: null as string | null,
      lastHttpStatus: null as number | null,
      lastErrorCode: null as string | null,
      acceptedAt: null as Date | null,
      deadLetteredAt: null as Date | null,
    };

    const auditCreates: any[] = [];
    const prismaMock: any = {
      $transaction: async (fn: any) => fn(prismaMock),
      auditLog: { create: jest.fn(async (arg: any) => { auditCreates.push(arg.data); return {}; }) },
      platformProvisioningOutbox: {
        findMany: jest.fn(async () =>
          row.status === PlatformOutboxStatus.PENDING && row.nextAttemptAt <= new Date() ? [{ id: row.id }] : [],
        ),
        findUnique: jest.fn(async ({ where }: any) => (where.id === row.id ? { ...row } : null)),
        update: jest.fn(async ({ data }: any) => {
          Object.assign(row, data);
          return { ...row };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.id !== row.id) return { count: 0 };
          if (where.leaseToken && where.leaseToken !== row.leaseToken) return { count: 0 };
          if (where.status && where.status !== row.status) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
      },
    };

    const worker = new PlatformProvisioningWorkerService(prismaMock);
    let callCount = 0;
    let capturedAuthHeader = '';

    // 1) Transient 503 -> retry with future backoff
    const res1 = await worker.processDueBatch({
      platformApiBaseUrl: 'https://platform.example.test',
      commandSecret,
      retryBaseSeconds: 10,
      retryMaxSeconds: 60,
      randomFn: () => 0,
      fetchImpl: async (_url, init) => {
        callCount += 1;
        capturedAuthHeader = String((init.headers as Record<string, string>).Authorization ?? '');
        return {
          status: 503,
          ok: false,
          json: async () => ({ error: 'SERVICE_UNAVAILABLE' }),
        };
      },
    });
    expect(res1.retried).toBe(1);
    expect(callCount).toBe(1);
    expect(row.status).toBe(PlatformOutboxStatus.PENDING);
    expect(row.attemptCount).toBe(1);
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(capturedAuthHeader).toMatch(/^Bearer /);

    // 2) Exhaust maxAttempts=2 -> DEAD
    row.nextAttemptAt = new Date(Date.now() - 1000);
    const res2 = await worker.processDueBatch({
      platformApiBaseUrl: 'https://platform.example.test',
      commandSecret,
      fetchImpl: async () => ({
        status: 502,
        ok: false,
        json: async () => ({ error: 'BAD_GATEWAY' }),
      }),
    });
    expect(res2.deadLettered).toBe(1);
    expect(row.status).toBe(PlatformOutboxStatus.DEAD);
    expect(row.deadLetteredAt).toBeInstanceOf(Date);

    // 3) Operator replay -> PENDING with extended maxAttempts + AuditLog
    const replayed = await worker.replayOutboxEntry(row.id, { id: 'admin-1', email: 'ops@bazionweb.com' });
    expect(replayed.status).toBe(PlatformOutboxStatus.PENDING);
    expect(replayed.maxAttempts).toBe(5);
    expect(auditCreates).toHaveLength(1);

    // 4) Successful delivery -> ACCEPTED with platformOperationId
    const res3 = await worker.processDueBatch({
      platformApiBaseUrl: 'https://platform.example.test',
      commandSecret,
      fetchImpl: async () => ({
        status: 202,
        ok: true,
        json: async () => ({
          accepted: true,
          operation: { operationId: '99999999-9999-4999-8999-999999999999' },
        }),
      }),
    });
    expect(res3.accepted).toBe(1);
    expect(row.status).toBe(PlatformOutboxStatus.ACCEPTED);
    expect(row.platformOperationId).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('authenticates status callbacks, prevents replay, deduplicates by eventId, and projects monotonically', async () => {
    const signingSecret = 'callback-webhook-secret-at-least-32-chars';
    const bearerSecret = 'callback-bearer-secret-at-least-32-chars';

    const inbox = new Map<string, any>();
    let projection: any = null;

    const prismaMock: any = {
      $transaction: async (fn: any) => fn(prismaMock),
      platformCallbackInbox: {
        findUnique: jest.fn(async ({ where }: any) => inbox.get(where.eventId) ?? null),
        create: jest.fn(async ({ data }: any) => {
          inbox.set(data.eventId, data);
          return data;
        }),
      },
      platformProvisioningOutbox: {
        findUnique: jest.fn(async () => ({ id: 'outbox-1', clientId: 'client-1' })),
      },
      platformProvisioningProjection: {
        findUnique: jest.fn(async () => projection),
        create: jest.fn(async ({ data }: any) => {
          projection = { ...data, id: 'proj-1' };
          return projection;
        }),
        update: jest.fn(async ({ data }: any) => {
          projection = { ...projection, ...data };
          return projection;
        }),
      },
    };

    const configMock = new ConfigService({
      PLATFORM_CALLBACK_SIGNING_SECRET: signingSecret,
      PLATFORM_CALLBACK_BEARER_SECRET: bearerSecret,
      PLATFORM_CALLBACK_MAX_SKEW_SECONDS: 300,
    });
    const service = new PlatformCallbackProjectionService(prismaMock, configMock);
    const controller = new PlatformCallbacksController(service);

    const nowSec = Math.floor(Date.now() / 1000);
    const opId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const corrId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const event1 = {
      schemaVersion: '1.0.0',
      eventType: 'product.provisioning.status.v1',
      eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      correlationId: corrId,
      occurredAt: '2026-11-11T20:01:00.000Z',
      source: 'bazion-platform',
      operation: {
        schemaVersion: '1.0.0',
        operationId: opId,
        correlationId: corrId,
        externalOrderId: 'INV-1:line:0',
        status: 'ready',
        currentStep: 'complete',
        tenantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        installationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        requestedDomain: 'example.com',
        hostingDeploymentId: '22222222-2222-4222-8222-222222222222',
        failure: null,
        updatedAt: '2026-11-11T20:01:00.000Z',
      },
    };
    const raw1 = JSON.stringify(event1);
    const validBearer = signCommercialCommandToken(
      {
        subject: 'bazion-platform-status-dispatcher',
        issuer: DEFAULT_CALLBACK_ISSUER,
        audience: DEFAULT_CALLBACK_AUDIENCE,
        scopes: ['provisioning:status:write'],
        ttlSeconds: 120,
        nowSeconds: nowSec,
      },
      bearerSecret,
    );

    // Reject expired signature outside replay window
    await expect(
      controller.receiveProvisioningStatus(
        { body: event1, rawBody: Buffer.from(raw1) } as any,
        signWebhookHeader(raw1, signingSecret, nowSec - 900),
        `Bearer ${validBearer}`,
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Reject tampered signature
    await expect(
      controller.receiveProvisioningStatus(
        { body: event1, rawBody: Buffer.from(raw1) } as any,
        signWebhookHeader(`${raw1} `, signingSecret, nowSec),
        `Bearer ${validBearer}`,
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Accept valid signed callback -> projects 'ready'
    const first = await controller.receiveProvisioningStatus(
      { body: event1, rawBody: Buffer.from(raw1) } as any,
      signWebhookHeader(raw1, signingSecret, nowSec),
      `Bearer ${validBearer}`,
    );
    expect(projection.platformDeploymentId).toBe('22222222-2222-4222-8222-222222222222');
    expect(projection.requestedDomain).toBe('example.com');
    expect(first).toEqual({
      received: true,
      deduplicated: false,
      staleIgnored: false,
      operationId: opId,
      status: 'ready',
    });

    // Duplicate eventId -> deduplicated without overwriting projection
    const dup = await controller.receiveProvisioningStatus(
      { body: event1, rawBody: Buffer.from(raw1) } as any,
      signWebhookHeader(raw1, signingSecret, nowSec),
      `Bearer ${validBearer}`,
    );
    expect(dup.deduplicated).toBe(true);

    // Stale/older non-terminal callback with a new eventId -> ignored safely (no regression!)
    const olderEvent = {
      ...event1,
      eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      occurredAt: '2026-11-11T20:00:10.000Z',
      operation: {
        ...event1.operation,
        status: 'validating',
        currentStep: 'validate',
        updatedAt: '2026-11-11T20:00:10.000Z',
      },
    };
    const rawOld = JSON.stringify(olderEvent);
    const staleRes = await controller.receiveProvisioningStatus(
      { body: olderEvent, rawBody: Buffer.from(rawOld) } as any,
      signWebhookHeader(rawOld, signingSecret, nowSec),
      `Bearer ${validBearer}`,
    );
    expect(staleRes.staleIgnored).toBe(true);
    expect(projection.status).toBe('ready');

    // Invalid status payload after valid auth throws 400
    const badBody = { ...event1, unexpected: true };
    const badRaw = JSON.stringify(badBody);
    await expect(
      controller.receiveProvisioningStatus(
        { body: badBody, rawBody: Buffer.from(badRaw) } as any,
        signWebhookHeader(badRaw, signingSecret, nowSec),
        `Bearer ${validBearer}`,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('reconciles missing outbox entries, dead letters, and polls lagging accepted operations', async () => {
    const commandSecret = 'reconcile-command-secret-32-chars-ok';
    const opId = '12121212-1212-4121-8121-121212121212';
    const corrId = '34343434-3434-4343-8343-343434343434';
    let savedProjection: any = null;

    const prismaMock: any = {
      invoice: {
        findMany: jest.fn(async () => [
          { id: 'inv-miss', invoiceNumber: 'INV-MISS-1', clientId: 'client-9', paidAt: new Date('2026-11-11T19:00:00.000Z') },
        ]),
      },
      platformProvisioningOutbox: {
        findMany: jest
          .fn()
          // getReconciliationReport calls acceptedCandidates, deadOutboxItems, staleProcessingItems; then pollLaggingOperations calls findMany once
          .mockResolvedValueOnce([
            {
              id: 'outbox-lag-1',
              invoiceId: 'inv-lag-1',
              externalOrderId: 'INV-LAG-1:line:0',
              platformOperationId: opId,
              acceptedAt: new Date('2026-11-11T19:00:00.000Z'),
              projection: null,
            },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'outbox-lag-1', platformOperationId: opId }]),
        findUnique: jest.fn(async () => ({ id: 'outbox-lag-1', clientId: 'client-1' })),
      },
      platformProvisioningProjection: {
        count: jest.fn(async () => 0),
        findUnique: jest.fn(async () => savedProjection),
        create: jest.fn(async ({ data }: any) => {
          savedProjection = data;
          return savedProjection;
        }),
        update: jest.fn(async ({ data }: any) => {
          savedProjection = { ...savedProjection, ...data };
          return savedProjection;
        }),
      },
    };

    const projection = new PlatformCallbackProjectionService(prismaMock);
    const recon = new PlatformProvisioningReconciliationService(prismaMock, projection);

    const report = await recon.getReconciliationReport(5);
    expect(report.counts.paidInvoicesWithoutOutbox).toBe(1);
    expect(report.counts.acceptedWithoutStatusLag).toBe(1);
    expect(report.laggingAcceptedOutbox[0]?.platformOperationId).toBe(opId);

    const poll = await recon.pollLaggingOperations({
      platformApiBaseUrl: 'https://platform.example.test',
      commandSecret,
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          operation: {
            schemaVersion: '1.0.0',
            operationId: opId,
            correlationId: corrId,
            externalOrderId: 'INV-LAG-1:line:0',
            status: 'ready',
            currentStep: 'complete',
            tenantId: '56565656-5656-4565-8565-565656565656',
            installationId: '78787878-7878-4787-8787-787878787878',
            failure: null,
            updatedAt: '2026-11-11T20:05:00.000Z',
          },
        }),
      }),
    });

    expect(poll).toEqual({ checked: 1, updated: 1, errors: 0 });
    expect(savedProjection?.status).toBe('ready');
    expect(savedProjection?.installationId).toBe('78787878-7878-4787-8787-787878787878');
  });
});
