#!/usr/bin/env ts-node
/**
 * Line-delimited JSON stdin/stdout RPC bridge for live dual-DB cross-repo Phase 3 E2E tests.
 * Runs the real NestJS HTTP callback receiver, PaymentSettlementService,
 * PlatformProvisioningOutboxService, PlatformProvisioningWorkerService, and
 * PlatformProvisioningReconciliationService against BAZIONWEB_TEST_DATABASE_URL.
 */
import 'reflect-metadata';
import { INestApplication, LoggerService, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  BillingCycle,
  ClientStatus,
  InvoiceStatus,
  PlanTier,
  PlatformOutboxStatus,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import * as readline from 'readline';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentSettlementService, checkoutLineItem } from '../src/modules/billing/payment-settlement.service';
import { PaystackService } from '../src/modules/billing/paystack.service';
import { PlatformCallbackProjectionService } from '../src/modules/platform-provisioning/platform-callback-projection.service';
import { PlatformCallbacksController } from '../src/modules/platform-provisioning/platform-callbacks.controller';
import { PlatformProvisioningAdminController } from '../src/modules/platform-provisioning/platform-provisioning-admin.controller';
import { PlatformProvisioningOutboxService } from '../src/modules/platform-provisioning/platform-provisioning-outbox.service';
import { PlatformProvisioningReconciliationService } from '../src/modules/platform-provisioning/platform-provisioning-reconciliation.service';
import { PlatformProvisioningWorkerService } from '../src/modules/platform-provisioning/platform-provisioning-worker.service';
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
} from '../src/modules/platform-provisioning/provisioning-crypto';

class StderrOnlyLogger implements LoggerService {
  log(message: unknown, context?: string) {
    process.stderr.write(`[LOG${context ? `:${context}` : ''}] ${String(message)}\n`);
  }
  error(message: unknown, trace?: string, context?: string) {
    process.stderr.write(`[ERROR${context ? `:${context}` : ''}] ${String(message)} ${trace ?? ''}\n`);
  }
  warn(message: unknown, context?: string) {
    process.stderr.write(`[WARN${context ? `:${context}` : ''}] ${String(message)}\n`);
  }
  debug(message: unknown, context?: string) {
    process.stderr.write(`[DEBUG${context ? `:${context}` : ''}] ${String(message)}\n`);
  }
  verbose(message: unknown, context?: string) {
    process.stderr.write(`[VERBOSE${context ? `:${context}` : ''}] ${String(message)}\n`);
  }
}

function assertSafeLocalTestDbUrl(urlString: string): string {
  const trimmed = urlString.trim();
  const parsed = new URL(trimmed);
  if (process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
    const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    const isTestDbName = parsed.pathname.toLowerCase().includes('test');
    if (!isLocalHost || !isTestDbName) {
      throw new Error(`Refusing non-local/non-test BAZIONWEB_TEST_DATABASE_URL: ${parsed.hostname}${parsed.pathname}`);
    }
  }
  return trimmed;
}

async function main() {
  const testDbUrl = assertSafeLocalTestDbUrl(process.env.BAZIONWEB_TEST_DATABASE_URL ?? '');
  const commandSecret = (process.env.PLATFORM_PROVISIONING_COMMAND_SECRET ?? '').trim();
  const callbackSigningSecret = (process.env.PLATFORM_CALLBACK_SIGNING_SECRET ?? '').trim();
  const callbackBearerSecret = (process.env.PLATFORM_CALLBACK_BEARER_SECRET ?? '').trim();

  if (commandSecret.length < 32 || callbackSigningSecret.length < 32) {
    throw new Error('E2E bridge requires >=32-char command and callback secrets');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });
  await prisma.$connect();

  const configValues: Record<string, string> = {
    PLATFORM_PROVISIONING_COMMAND_ISSUER: process.env.PLATFORM_PROVISIONING_COMMAND_ISSUER ?? DEFAULT_COMMAND_ISSUER,
    PLATFORM_PROVISIONING_COMMAND_AUDIENCE: process.env.PLATFORM_PROVISIONING_COMMAND_AUDIENCE ?? DEFAULT_COMMAND_AUDIENCE,
    PLATFORM_PROVISIONING_COMMAND_SECRET: commandSecret,
    PLATFORM_CALLBACK_SIGNING_SECRET: callbackSigningSecret,
    ...(callbackBearerSecret ? { PLATFORM_CALLBACK_BEARER_SECRET: callbackBearerSecret } : {}),
    PLATFORM_CALLBACK_MAX_SKEW_SECONDS: '300',
    PLATFORM_PROVISIONING_BATCH_SIZE: '10',
    PLATFORM_PROVISIONING_LEASE_SECONDS: '60',
    PLATFORM_PROVISIONING_TIMEOUT_MS: '5000',
    PLATFORM_PROVISIONING_WORKER_ENABLED: 'false',
    KEYCLOAK_URL: 'https://auth.example.test',
    KEYCLOAK_REALM: 'bazionweb',
    JWT_SECRET: 'e2e-bridge-jwt-secret-placeholder',
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
      PaymentSettlementService,
      { provide: PrismaService, useValue: prisma },
      { provide: PaystackService, useValue: {} },
      { provide: ConfigService, useValue: mockConfig },
    ],
  })
    .setLogger(new StderrOnlyLogger())
    .compile();

  const nestApp: INestApplication = moduleRef.createNestApplication({
    rawBody: true,
    logger: new StderrOnlyLogger(),
  });
  nestApp.enableVersioning({ type: VersioningType.URI });
  nestApp.setGlobalPrefix('api');
  await nestApp.listen(0, '127.0.0.1');

  const address = nestApp.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const bazionwebBaseUrl = `http://127.0.0.1:${port}`;

  const settlement = moduleRef.get(PaymentSettlementService);
  const outboxService = moduleRef.get(PlatformProvisioningOutboxService);
  const worker = moduleRef.get(PlatformProvisioningWorkerService);
  const reconciliation = moduleRef.get(PlatformProvisioningReconciliationService);

  const createdPlanIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdSubscriptionIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  async function seedAndPayInvoice(suffix: string, offerId: string) {
    const plan = await prisma.plan.create({
      data: {
        name: `E2E Plan ${suffix}`,
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
    createdPlanIds.push(plan.id);

    const user = await prisma.user.create({
      data: {
        email: `e2e-${suffix}@bazionweb.test`,
        role: UserRole.CLIENT,
        keycloakId: `e2e-kc-${suffix}`,
        firstName: 'Amina',
        lastName: 'Otieno',
      },
    });
    createdUserIds.push(user.id);

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName: `E2E Co ${suffix}`,
        contactName: 'Amina Otieno',
        email: `e2e-client-${suffix}@bazionweb.test`,
        planId: plan.id,
        status: ClientStatus.TRIAL,
      },
    });
    createdClientIds.push(client.id);

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
    createdSubscriptionIds.push(subscription.id);

    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        subscriptionId: subscription.id,
        invoiceNumber: `INV-E2E-${suffix}`,
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
            productId: offerId,
            purpose: 'subscription',
          }),
        ],
      },
    });
    createdInvoiceIds.push(invoice.id);

    const settleResult = await settlement.settlePaystackCharge({
      reference: `ref-e2e-${suffix}`,
      amount: 1500000,
      currency: 'KES',
      channel: 'card',
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        planId: plan.id,
        purpose: 'subscription',
      },
    });

    const outbox = await prisma.platformProvisioningOutbox.findFirstOrThrow({
      where: { invoiceId: invoice.id },
    });

    return {
      settleStatus: settleResult.status,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: client.id,
      subscriptionId: subscription.id,
      outbox,
    };
  }

  async function verifyRollback(suffix: string) {
    const plan = await prisma.plan.create({
      data: {
        name: `E2E Rollback Plan ${suffix}`,
        tier: PlanTier.STARTER,
        priceMonthly: 5000,
        priceAnnual: 50000,
        uptimeSla: '99.9%',
        p1ResponseMinutes: 30,
        p2ResponseMinutes: 120,
        p3ResponseMinutes: 480,
        maxBackupRetention: 14,
      },
    });
    createdPlanIds.push(plan.id);

    const user = await prisma.user.create({
      data: {
        email: `e2e-rb-${suffix}@bazionweb.test`,
        role: UserRole.CLIENT,
        keycloakId: `e2e-rb-kc-${suffix}`,
        firstName: 'Rollback',
        lastName: 'User',
      },
    });
    createdUserIds.push(user.id);

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName: `E2E Rollback Co ${suffix}`,
        contactName: 'Rollback User',
        email: `e2e-rb-client-${suffix}@bazionweb.test`,
        planId: plan.id,
        status: ClientStatus.TRIAL,
      },
    });
    createdClientIds.push(client.id);

    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber: `INV-E2E-RB-${suffix}`,
        amount: 5000,
        currency: 'KES',
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        lineItems: [
          checkoutLineItem({
            description: 'Starter Setup',
            amount: 5000,
            currency: 'KES',
            productId: 'website-launch',
            purpose: 'invoice_payment',
          }),
        ],
      },
    });
    createdInvoiceIds.push(invoice.id);

    let rolledBack = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID, paidAt: new Date() },
        });
        await outboxService.enqueueForSettledInvoice(tx, {
          ...invoice,
          client: { ...client, plan },
        });
        throw new Error('SIMULATED_TX_ABORT');
      });
    } catch {
      rolledBack = true;
    }

    const [persistedInvoice, outboxCount] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }),
      prisma.platformProvisioningOutbox.count({ where: { invoiceId: invoice.id } }),
    ]);

    return {
      rolledBack,
      invoiceStatus: persistedInvoice.status,
      paidAt: persistedInvoice.paidAt,
      outboxCount,
    };
  }

  async function cleanupAll() {
    if (createdInvoiceIds.length > 0) {
      const outboxes = await prisma.platformProvisioningOutbox.findMany({
        where: { invoiceId: { in: createdInvoiceIds } },
        select: { platformOperationId: true },
      });
      const opIds = outboxes.map((o) => o.platformOperationId).filter((v): v is string => Boolean(v));
      if (opIds.length > 0) {
        await prisma.platformCallbackInbox.deleteMany({ where: { operationId: { in: opIds } } }).catch(() => undefined);
        await prisma.platformProvisioningProjection.deleteMany({ where: { operationId: { in: opIds } } }).catch(() => undefined);
      }
      await prisma.platformProvisioningOutbox.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } }).catch(() => undefined);
      await prisma.paymentLog.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } }).catch(() => undefined);
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } }).catch(() => undefined);
    }
    if (createdSubscriptionIds.length > 0) {
      await prisma.subscription.deleteMany({ where: { id: { in: createdSubscriptionIds } } }).catch(() => undefined);
    }
    if (createdClientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } }).catch(() => undefined);
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined);
    }
    if (createdPlanIds.length > 0) {
      await prisma.plan.deleteMany({ where: { id: { in: createdPlanIds } } }).catch(() => undefined);
    }
  }

  function writeLine(obj: Record<string, unknown>) {
    process.stdout.write(`${JSON.stringify(obj)}\n`);
  }

  writeLine({ type: 'ready', bazionwebBaseUrl });

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg: { reqId?: string; op?: string; args?: Record<string, any> };
    try {
      msg = JSON.parse(line);
    } catch (err) {
      writeLine({ reqId: null, ok: false, error: err instanceof Error ? err.message : 'INVALID_JSON' });
      continue;
    }

    const reqId = msg.reqId ?? null;
    try {
      let result: unknown;
      const args = msg.args ?? {};
      switch (msg.op) {
        case 'settle_invoice':
          result = await seedAndPayInvoice(String(args.suffix), String(args.offerId ?? 'website-business'));
          break;
        case 'verify_rollback':
          result = await verifyRollback(String(args.suffix));
          break;
        case 'backdate_outbox':
          result = await prisma.platformProvisioningOutbox.update({
            where: { id: String(args.outboxId) },
            data: {
              ...(args.nextAttemptAt ? { nextAttemptAt: new Date(String(args.nextAttemptAt)) } : {}),
              ...(args.acceptedAt ? { acceptedAt: new Date(String(args.acceptedAt)) } : {}),
              ...(args.status ? { status: args.status as PlatformOutboxStatus } : {}),
            },
          });
          break;
        case 'run_worker_batch':
          result = await worker.processDueBatch({
            platformApiBaseUrl: String(args.platformApiBaseUrl),
            commandSecret,
            commandIssuer: configValues.PLATFORM_PROVISIONING_COMMAND_ISSUER,
            commandAudience: configValues.PLATFORM_PROVISIONING_COMMAND_AUDIENCE,
            retryBaseSeconds: Number(args.retryBaseSeconds ?? 5),
            retryMaxSeconds: Number(args.retryMaxSeconds ?? 30),
            randomFn: () => 0,
          });
          break;
        case 'replay_outbox':
          result = await worker.replayOutboxEntry(String(args.outboxId));
          break;
        case 'get_state': {
          const outbox = await prisma.platformProvisioningOutbox.findUnique({
            where: { id: String(args.outboxId) },
            include: { projection: true },
          });
          const inboxCount = args.operationId
            ? await prisma.platformCallbackInbox.count({ where: { operationId: String(args.operationId) } })
            : 0;
          result = { outbox, inboxCount };
          break;
        }
        case 'reconcile_and_poll': {
          const staleMinutes = Number(args.staleMinutes ?? 1);
          const reportBefore = await reconciliation.getReconciliationReport(staleMinutes);
          const poll = args.platformApiBaseUrl
            ? await reconciliation.pollLaggingOperations({
                staleMinutes,
                platformApiBaseUrl: String(args.platformApiBaseUrl),
                commandSecret,
                commandIssuer: configValues.PLATFORM_PROVISIONING_COMMAND_ISSUER,
                commandAudience: configValues.PLATFORM_PROVISIONING_COMMAND_AUDIENCE,
              })
            : null;
          const reportAfter = await reconciliation.getReconciliationReport(staleMinutes);
          result = { reportBefore, poll, reportAfter };
          break;
        }
        case 'shutdown':
          await cleanupAll();
          writeLine({ reqId, ok: true, result: { closed: true } });
          await nestApp.close();
          await prisma.$disconnect();
          return;
        default:
          throw new Error(`UNKNOWN_OP:${msg.op}`);
      }
      writeLine({ reqId, ok: true, result });
    } catch (error) {
      writeLine({
        reqId,
        ok: false,
        error: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
      });
    }
  }

  await cleanupAll();
  await nestApp.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  process.stderr.write(`Fatal bridge error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

