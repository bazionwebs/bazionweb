import { ConfigService } from '@nestjs/config';
import {
  ClientStatus,
  InvoiceStatus,
  PaymentProvider,
  PlatformOutboxStatus,
  PrismaClient,
  SubscriptionStatus,
} from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { ClientsService } from '../clients/clients.service';
import { PlatformCallbackProjectionService } from '../platform-provisioning/platform-callback-projection.service';
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  signCommercialCommandToken,
} from '../platform-provisioning/provisioning-crypto';
import { SubscriptionLifecycleOutboxService } from '../platform-provisioning/subscription-lifecycle-outbox.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { SubscriptionDunningService } from './subscription-dunning.service';

const COMMAND_SECRET = 'bazion-phase6-command-secret-32-chars-minimum!';
const WEBHOOK_SECRET = 'bazion-phase6-webhook-secret-32-chars-minimum!';
const CALLBACK_BEARER_SECRET = 'bazion-phase6-callback-bearer-32-chars-min!';

function signWebhookHeader(rawBody: string, secret: string, tsSec: number): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${tsSec}.${rawBody}`)
    .digest('hex');
  return `t=${tsSec},v1=${digest}`;
}

function isSafeLocalTestDb(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostOk = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
    return hostOk && dbName.includes('test');
  } catch {
    return false;
  }
}

describe('Phase 6 Commercial Dunning & Subscription Lifecycle Sync', () => {
  it('enforces grace-first dunning before suspension and restores on invoice settlement', async () => {
    const state = {
      invoiceStatus: InvoiceStatus.SENT as InvoiceStatus,
      subscriptionStatus: SubscriptionStatus.ACTIVE as SubscriptionStatus,
      gracePeriodEnd: null as Date | null,
      dunningAttemptsCount: 0,
      lastDunningAt: null as Date | null,
      cancelledAt: null as Date | null,
      clientStatus: ClientStatus.ACTIVE as ClientStatus,
      notifications: [] as Array<Record<string, unknown>>,
      lifecycleRows: [] as Array<Record<string, any>>,
      projections: new Map<string, any>(),
      callbackInbox: new Map<string, any>(),
    };

    const txMock: any = {
      invoice: {
        updateMany: async ({ data }: any) => {
          if (state.invoiceStatus === InvoiceStatus.SENT) {
            state.invoiceStatus = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        },
        count: async () => (state.invoiceStatus === InvoiceStatus.OVERDUE ? 1 : 0),
        update: async () => ({}),
      },
      subscription: {
        findMany: async () => {
          if (
            state.invoiceStatus === InvoiceStatus.OVERDUE &&
            (state.subscriptionStatus === SubscriptionStatus.ACTIVE ||
              state.subscriptionStatus === SubscriptionStatus.PAST_DUE)
          ) {
            return [
              {
                id: 'sub-unit-1',
                clientId: 'client-unit-1',
                planId: 'plan-core',
                status: state.subscriptionStatus,
                gracePeriodEnd: state.gracePeriodEnd,
                dunningAttemptsCount: state.dunningAttemptsCount,
                lastDunningAt: state.lastDunningAt,
                client: { id: 'client-unit-1', userId: 'user-unit-1', status: state.clientStatus },
                invoices: [
                  {
                    id: 'inv-unit-1',
                    invoiceNumber: 'INV-2026-9001',
                    dueDate: new Date('2026-11-01T00:00:00.000Z'),
                  },
                ],
              },
            ];
          }
          return [];
        },
        findUnique: async ({ where }: any) => {
          if (where.id !== 'sub-unit-1') return null;
          return {
            id: 'sub-unit-1',
            clientId: 'client-unit-1',
            planId: 'plan-core',
            status: state.subscriptionStatus,
            gracePeriodEnd: state.gracePeriodEnd,
            dunningAttemptsCount: state.dunningAttemptsCount,
            lastDunningAt: state.lastDunningAt,
            client: { id: 'client-unit-1', userId: 'user-unit-1' },
          };
        },
        count: async () => 0,
        update: async ({ data }: any) => {
          if (data.status !== undefined) state.subscriptionStatus = data.status;
          if (data.gracePeriodEnd !== undefined) state.gracePeriodEnd = data.gracePeriodEnd;
          if (data.dunningAttemptsCount !== undefined) state.dunningAttemptsCount = data.dunningAttemptsCount;
          if (data.lastDunningAt !== undefined) state.lastDunningAt = data.lastDunningAt;
          if (data.cancelledAt !== undefined) state.cancelledAt = data.cancelledAt;
          return {
            id: 'sub-unit-1',
            clientId: 'client-unit-1',
            status: state.subscriptionStatus,
            gracePeriodEnd: state.gracePeriodEnd,
            dunningAttemptsCount: state.dunningAttemptsCount,
          };
        },
      },
      client: {
        update: async ({ data }: any) => {
          if (data.status) state.clientStatus = data.status;
          return { id: 'client-unit-1', status: state.clientStatus };
        },
      },
      notification: {
        create: async ({ data }: any) => {
          state.notifications.push(data);
          return data;
        },
      },
      platformProvisioningOutbox: {
        findFirst: async () => ({ externalOrderId: 'ord-unit-1' }),
        findUnique: async () => ({ id: 'outbox-prov-1', clientId: 'client-unit-1' }),
      },
      subscriptionLifecycleOutbox: {
        findUnique: async ({ where }: any) =>
          state.lifecycleRows.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `lc-${state.lifecycleRows.length + 1}`, ...data };
          state.lifecycleRows.push(row);
          return row;
        },
        findMany: async () =>
          state.lifecycleRows.filter((r) => r.status === PlatformOutboxStatus.PENDING),
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const row of state.lifecycleRows) {
            if (where.id && row.id !== where.id) continue;
            if (where.leaseToken && row.leaseToken !== where.leaseToken) continue;
            if (where.status && row.status !== where.status) continue;
            if (data.attemptCount?.increment) {
              row.attemptCount += data.attemptCount.increment;
            }
            const next = { ...data };
            delete next.attemptCount;
            Object.assign(row, next);
            count += 1;
          }
          return { count };
        },
        findUniqueOrThrow: async () => null,
      },
      platformCallbackInbox: {
        findUnique: async ({ where }: any) => state.callbackInbox.get(where.eventId) ?? null,
        create: async ({ data }: any) => {
          state.callbackInbox.set(data.eventId, data);
          return data;
        },
      },
      platformProvisioningProjection: {
        findFirst: async () => state.projections.get('ord-unit-1') ?? null,
        findUnique: async ({ where }: any) => state.projections.get(where.externalOrderId) ?? null,
        create: async ({ data }: any) => {
          const row = { id: 'proj-1', ...data };
          state.projections.set(row.externalOrderId, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          for (const row of state.projections.values()) {
            if (row.id === where.id) {
              Object.assign(row, data);
              return row;
            }
          }
          throw new Error('NOT_FOUND');
        },
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(txMock),
    };

    // Patch findUnique lookup by id for claimDueBatch fallback path
    const origSubFindUnique = txMock.subscriptionLifecycleOutbox.findUnique;
    txMock.subscriptionLifecycleOutbox.findUnique = async ({ where }: any) => {
      if (where.id) return state.lifecycleRows.find((r) => r.id === where.id) ?? null;
      return origSubFindUnique({ where });
    };

    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          BILLING_GRACE_PERIOD_DAYS: '7',
          BILLING_DUNNING_MAX_ATTEMPTS: '3',
          BILLING_DUNNING_RETRY_HOURS: '24',
          PLATFORM_API_BASE_URL: 'https://platform.bazion.test',
          PLATFORM_PROVISIONING_COMMAND_SECRET: COMMAND_SECRET,
          PLATFORM_CALLBACK_SIGNING_SECRET: WEBHOOK_SECRET,
          PLATFORM_CALLBACK_BEARER_SECRET: CALLBACK_BEARER_SECRET,
        };
        return map[key];
      },
    } as unknown as ConfigService;

    const lifecycleOutbox = new SubscriptionLifecycleOutboxService(txMock, config);
    const dunning = new SubscriptionDunningService(txMock, lifecycleOutbox, config);

    // Day 1 overdue -> MUST enter PAST_DUE grace period & queue `grace`, NEVER suspend immediately
    const t0 = new Date('2026-11-02T06:00:00.000Z');
    const s1 = await dunning.processOverdueAndDunning(t0);
    expect(s1).toEqual({
      invoicesMarkedOverdue: 1,
      gracedCount: 1,
      remindedCount: 0,
      suspendedCount: 0,
    });
    expect(state.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
    expect(state.clientStatus).toBe(ClientStatus.ACTIVE);
    expect(state.dunningAttemptsCount).toBe(1);
    expect(state.lifecycleRows.map((r) => r.action)).toEqual(['grace']);

    // Day 3 inside grace window -> reminder #2, still active (PAST_DUE)
    const t1 = new Date('2026-11-04T06:00:00.000Z');
    const s2 = await dunning.processOverdueAndDunning(t1);
    expect(s2.remindedCount).toBe(1);
    expect(s2.suspendedCount).toBe(0);
    expect(state.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
    expect(state.dunningAttemptsCount).toBe(2);

    // Day 8 (grace expired at 2026-11-09? Use Nov 10 -> past 7 days grace AND attempt 3 >= 3) -> SUSPEND
    const t2 = new Date('2026-11-10T06:00:00.000Z');
    const s3 = await dunning.processOverdueAndDunning(t2);
    expect(s3.suspendedCount).toBe(1);
    expect(state.subscriptionStatus).toBe(SubscriptionStatus.SUSPENDED);
    expect(state.clientStatus).toBe(ClientStatus.SUSPENDED);
    expect(state.lifecycleRows.map((r) => r.action)).toEqual(['grace', 'suspend']);

    // Worker delivers `grace` and `suspend` with signed JWT verification
    const seenJwtScopes: string[][] = [];
    const batch1 = await lifecycleOutbox.processDueBatch({
      fetchImpl: async (_url, init) => {
        const token = init.headers.Authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, COMMAND_SECRET) as jwt.JwtPayload;
        const parsedScopes =
          typeof decoded.scope === 'string'
            ? decoded.scope.split(/\s+/).filter(Boolean)
            : Array.isArray(decoded.scopes)
              ? (decoded.scopes as string[])
              : [];
        seenJwtScopes.push(parsedScopes);
        return {
          status: 202,
          ok: true,
          json: async () => ({ accepted: true }),
        };
      },
    });
    expect(batch1.accepted).toBe(2);
    expect(seenJwtScopes).toEqual([
      ['commercial:lifecycle:write'],
      ['commercial:lifecycle:write'],
    ]);

    // Paying settled invoice on SUSPENDED subscription restores ACTIVE & enqueues `reactivate`
    const settlement = new PaymentSettlementService(
      txMock,
      {} as any,
      { enqueueForSettledInvoice: async () => {} } as any,
      lifecycleOutbox,
    );
    state.invoiceStatus = InvoiceStatus.PAID;
    await settlement.activatePaidSubscription(
      txMock,
      {
        id: 'inv-unit-1',
        clientId: 'client-unit-1',
        subscriptionId: 'sub-unit-1',
        lineItems: [{ description: 'Renewal', amount: 5000, currency: 'KES' }],
        client: { planId: 'plan-core' },
      },
      { provider: PaymentProvider.PAYSTACK, providerRef: 'ps-ref-1' },
    );
    expect(state.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
    expect(state.clientStatus).toBe(ClientStatus.ACTIVE);
    expect(state.gracePeriodEnd).toBeNull();
    expect(state.dunningAttemptsCount).toBe(0);
    expect(state.lifecycleRows.map((r) => r.action)).toEqual(['grace', 'suspend', 'reactivate']);

    // Callback projection verifies HMAC + JWT, updates projection safely without internal leakage, and blocks stale updates
    const projectionSvc = new PlatformCallbackProjectionService(txMock, config);
    const makeCallback = (
      eventId: string,
      action: 'suspend' | 'reactivate',
      installationStatus: 'suspended' | 'ready',
      updatedAt: string,
    ) => {
      const payload = {
        schemaVersion: '1.0.0',
        eventType: 'product.subscription.lifecycle.status.v1',
        eventId,
        correlationId: '33333333-3333-4333-8333-333333333333',
        occurredAt: updatedAt,
        source: 'bazion-platform',
        lifecycle: {
          schemaVersion: '1.0.0',
          commandId: '44444444-4444-4444-8444-444444444444',
          action,
          subscriptionId: 'sub-unit-1',
          externalOrderId: 'ord-unit-1',
          tenantId: 'tenant-1',
          installationId: 'inst-1',
          installationStatus,
          applied: true,
          reasonCode: action === 'suspend' ? 'GRACE_EXPIRED_DUNNING_EXHAUSTED' : 'INVOICE_SETTLED',
          effectiveAt: updatedAt,
          updatedAt,
        },
      };
      const rawBody = JSON.stringify(payload);
      const nowSec = Math.floor(Date.now() / 1000);
      const signatureHeader = signWebhookHeader(rawBody, WEBHOOK_SECRET, nowSec);
      const bearer = signCommercialCommandToken(
        {
          subject: 'platform-worker',
          issuer: DEFAULT_CALLBACK_ISSUER,
          audience: DEFAULT_CALLBACK_AUDIENCE,
          scopes: ['provisioning:status:write'],
        },
        CALLBACK_BEARER_SECRET,
      );
      return {
        rawBody,
        body: payload,
        signatureHeader,
        authorizationHeader: `Bearer ${bearer}`,
        nowSeconds: nowSec,
      };
    };

    const cbReactivate = await projectionSvc.ingestSignedLifecycleCallback(
      makeCallback(
        '55555555-5555-4555-8555-555555555555',
        'reactivate',
        'ready',
        '2026-11-11T10:00:00.000Z',
      ),
    );
    expect(cbReactivate.deduplicated).toBe(false);
    expect(cbReactivate.projection?.subscriptionStatus).toBe('ACTIVE');
    expect(cbReactivate.projection?.customerStatusMessage).not.toMatch(/lease|stack|secret/i);

    // Out-of-order older `suspend` event must be flagged staleIgnored
    const cbStale = await projectionSvc.ingestSignedLifecycleCallback(
      makeCallback(
        '66666666-6666-4666-8666-666666666666',
        'suspend',
        'suspended',
        '2026-11-10T10:00:00.000Z',
      ),
    );
    expect(cbStale.staleIgnored).toBe(true);
    expect(cbStale.projection?.subscriptionStatus).toBe('ACTIVE');

    // Explicit cancellation preserves records and enqueues `cancel`
    await dunning.cancelSubscriptionWithSync({
      subscriptionId: 'sub-unit-1',
      now: new Date('2026-11-12T00:00:00.000Z'),
    });
    expect(state.subscriptionStatus).toBe(SubscriptionStatus.CANCELLED);
    expect(state.lifecycleRows.map((r) => r.action)).toEqual([
      'grace',
      'suspend',
      'reactivate',
      'cancel',
    ]);
  });

  const testDbUrl = process.env.BAZIONWEB_TEST_DATABASE_URL?.trim();
  const pgIt = isSafeLocalTestDb(testDbUrl) ? it : it.skip;

  pgIt(
    'runs end-to-end dunning, FOR UPDATE SKIP LOCKED outbox delivery, settlement reactivation, and callback projection against live bazionweb_test Postgres',
    async () => {
      const prisma = new PrismaClient({
        datasources: { db: { url: testDbUrl } },
      });
      await prisma.$connect();

      const suffix = crypto.randomUUID().slice(0, 8);
      const userId = crypto.randomUUID();
      const planId = `plan-p6-${suffix}`;
      const clientId = `client-p6-${suffix}`;
      const subscriptionId = `sub-p6-${suffix}`;
      const invoiceId = `inv-p6-${suffix}`;
      const provOutboxId = `pout-p6-${suffix}`;
      const externalOrderId = `ord-p6-${suffix}`;
      const nowBase = new Date('2026-11-01T00:00:00.000Z');

      const testDbUrlCleanupIds: string[] = [];
      try {
        await prisma.user.create({
          data: {
            id: userId,
            email: `p6-${suffix}@example.test`,
            updatedAt: nowBase,
          },
        });
        await prisma.plan.create({
          data: {
            id: planId,
            name: `Phase 6 Care ${suffix}`,
            tier: 'STARTER',
            priceMonthly: 5000,
            priceAnnual: 50000,
            uptimeSla: '99.9%',
            p1ResponseMinutes: 60,
            p2ResponseMinutes: 240,
            p3ResponseMinutes: 1440,
            maxBackupRetention: 30,
            updatedAt: nowBase,
          },
        });
        await prisma.client.create({
          data: {
            id: clientId,
            userId,
            businessName: `Phase 6 Bakery ${suffix}`,
            contactName: 'Grace Baker',
            email: `p6-${suffix}@example.test`,
            planId,
            status: ClientStatus.ACTIVE,
            updatedAt: nowBase,
          },
        });
        await prisma.subscription.create({
          data: {
            id: subscriptionId,
            clientId,
            planId,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            renewalDate: new Date('2026-11-01T00:00:00.000Z'),
            currentPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
            currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
            updatedAt: nowBase,
          },
        });
        await prisma.invoice.create({
          data: {
            id: invoiceId,
            clientId,
            subscriptionId,
            invoiceNumber: `INV-P6-${suffix}`,
            amount: 5000,
            currency: 'KES',
            status: InvoiceStatus.SENT,
            dueDate: new Date('2026-10-31T00:00:00.000Z'),
            updatedAt: nowBase,
            lineItems: [{ description: 'Care Renewal', amount: 5000, currency: 'KES' }],
          },
        });
        await prisma.platformProvisioningOutbox.create({
          data: {
            id: provOutboxId,
            invoiceId,
            clientId,
            subscriptionId,
            lineIndex: 0,
            eventId: crypto.randomUUID(),
            correlationId: crypto.randomUUID(),
            idempotencyKey: `prov-p6:${invoiceId}:0`,
            requestFingerprint: `fp-${suffix}`,
            externalCustomerId: clientId,
            externalOrderId,
            payload: { schemaVersion: '1.0.0' },
            status: PlatformOutboxStatus.ACCEPTED,
            updatedAt: nowBase,
          },
        });

        const config = {
          get: (key: string) => {
            const map: Record<string, string> = {
              BILLING_GRACE_PERIOD_DAYS: '7',
              BILLING_DUNNING_MAX_ATTEMPTS: '3',
              BILLING_DUNNING_RETRY_HOURS: '24',
              PLATFORM_API_BASE_URL: 'https://platform.bazion.test',
              PLATFORM_PROVISIONING_COMMAND_SECRET: COMMAND_SECRET,
              PLATFORM_CALLBACK_SIGNING_SECRET: WEBHOOK_SECRET,
              PLATFORM_CALLBACK_BEARER_SECRET: CALLBACK_BEARER_SECRET,
            };
            return map[key];
          },
        } as unknown as ConfigService;

        const lifecycleOutbox = new SubscriptionLifecycleOutboxService(prisma as any, config);
        const dunning = new SubscriptionDunningService(prisma as any, lifecycleOutbox, config);
        const settlement = new PaymentSettlementService(
          prisma as any,
          {} as any,
          { enqueueForSettledInvoice: async () => {} } as any,
          lifecycleOutbox,
        );
        const projectionSvc = new PlatformCallbackProjectionService(prisma as any, config);
        const clientsSvc = new ClientsService(prisma as any, config);

        // Step 1: Enter grace window on Nov 02
        await dunning.processOverdueAndDunning(new Date('2026-11-02T06:00:00.000Z'));
        const subAfterGrace = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        expect(subAfterGrace.status).toBe(SubscriptionStatus.PAST_DUE);

        // Step 2: Intermediate reminder on Nov 05
        await dunning.processOverdueAndDunning(new Date('2026-11-05T06:00:00.000Z'));
        const subAfterRemind = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        expect(subAfterRemind.status).toBe(SubscriptionStatus.PAST_DUE);
        expect(subAfterRemind.dunningAttemptsCount).toBe(2);

        // Step 3: Post-grace suspension on Nov 10
        await dunning.processOverdueAndDunning(new Date('2026-11-10T06:00:00.000Z'));
        const subAfterSuspend = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        const clientAfterSuspend = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
        expect(subAfterSuspend.status).toBe(SubscriptionStatus.SUSPENDED);
        expect(clientAfterSuspend.status).toBe(ClientStatus.SUSPENDED);

        // Step 4: Verify `grace` & `suspend` rows exist in PG and claim/deliver via FOR UPDATE SKIP LOCKED
        const batch = await lifecycleOutbox.processDueBatch({
          fetchImpl: async () => ({
            status: 202,
            ok: true,
            json: async () => ({ ok: true }),
          }),
        });
        expect(batch.accepted).toBeGreaterThanOrEqual(2);

        // Step 5: Signed suspend callback updates PG projection, and ClientsService surfaces it safely
        const cbEventId = crypto.randomUUID();
        testDbUrlCleanupIds.push(cbEventId);
        const cbNow = new Date('2026-11-10T06:01:00.000Z').toISOString();
        const cbBody = {
          schemaVersion: '1.0.0',
          eventType: 'product.subscription.lifecycle.status.v1',
          eventId: cbEventId,
          correlationId: crypto.randomUUID(),
          occurredAt: cbNow,
          source: 'bazion-platform',
          lifecycle: {
            schemaVersion: '1.0.0',
            commandId: crypto.randomUUID(),
            action: 'suspend',
            subscriptionId,
            externalOrderId,
            tenantId: `tenant-p6-${suffix}`,
            installationId: `inst-p6-${suffix}`,
            installationStatus: 'suspended',
            applied: true,
            reasonCode: 'GRACE_EXPIRED_DUNNING_EXHAUSTED',
            effectiveAt: cbNow,
            updatedAt: cbNow,
          },
        };
        const rawCb = JSON.stringify(cbBody);
        const nowSec = Math.floor(Date.now() / 1000);
        await projectionSvc.ingestSignedLifecycleCallback({
          rawBody: rawCb,
          body: cbBody,
          signatureHeader: signWebhookHeader(rawCb, WEBHOOK_SECRET, nowSec),
          authorizationHeader: `Bearer ${signCommercialCommandToken(
            {
              subject: 'platform-worker',
              issuer: DEFAULT_CALLBACK_ISSUER,
              audience: DEFAULT_CALLBACK_AUDIENCE,
              scopes: ['provisioning:status:write'],
            },
            CALLBACK_BEARER_SECRET,
          )}`,
          nowSeconds: nowSec,
        });

        const portalView = await clientsSvc.findByUserId(userId);
        expect(portalView.data.subscriptions[0]?.status).toBe(SubscriptionStatus.SUSPENDED);
        expect(portalView.data.platformProvisioningProjections[0]?.subscriptionStatus).toBe('SUSPENDED');
        expect(portalView.data.platformProvisioningProjections[0]?.customerStatusMessage).toContain(
          'temporarily suspended',
        );

        // Step 6: Settle invoice in real PG transaction -> restores ACTIVE + enqueues `reactivate`
        await prisma.$transaction(async (tx) => {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.PAID, paidAt: new Date('2026-11-11T09:00:00.000Z') },
          });
          await settlement.activatePaidSubscription(
            tx,
            {
              id: invoiceId,
              clientId,
              subscriptionId,
              lineItems: [{ description: 'Care Renewal', amount: 5000, currency: 'KES' }],
              client: { planId },
            },
            { provider: PaymentProvider.PAYSTACK, providerRef: `ps-${suffix}` },
          );
        });

        const subRestored = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        const clientRestored = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
        expect(subRestored.status).toBe(SubscriptionStatus.ACTIVE);
        expect(subRestored.gracePeriodEnd).toBeNull();
        expect(subRestored.dunningAttemptsCount).toBe(0);
        expect(clientRestored.status).toBe(ClientStatus.ACTIVE);

        const lcRows = await prisma.subscriptionLifecycleOutbox.findMany({
          where: { subscriptionId },
          orderBy: { createdAt: 'asc' },
        });
        expect(lcRows.map((r) => r.action)).toEqual(['grace', 'suspend', 'reactivate']);
      } finally {
        await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
        await prisma.subscriptionLifecycleOutbox.deleteMany({ where: { subscriptionId } }).catch(() => {});
        await prisma.platformProvisioningProjection.deleteMany({ where: { externalOrderId } }).catch(() => {});
        if (testDbUrlCleanupIds.length > 0) {
          await prisma.platformCallbackInbox.deleteMany({ where: { eventId: { in: testDbUrlCleanupIds } } }).catch(() => {});
        }
        await prisma.platformProvisioningOutbox.deleteMany({ where: { id: provOutboxId } }).catch(() => {});
        await prisma.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => {});
        await prisma.subscription.deleteMany({ where: { id: subscriptionId } }).catch(() => {});
        await prisma.client.deleteMany({ where: { id: clientId } }).catch(() => {});
        await prisma.plan.deleteMany({ where: { id: planId } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
        await prisma.$disconnect();
      }
    },
  );
});
