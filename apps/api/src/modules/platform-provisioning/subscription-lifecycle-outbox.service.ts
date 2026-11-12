import * as crypto from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  deterministicUuidFromSeed,
  signCommercialCommandToken,
  type SubscriptionLifecycleAction,
} from './provisioning-crypto';

export interface EnqueueSubscriptionLifecycleCommandInput {
  subscriptionId: string;
  clientId: string;
  externalOrderId: string;
  action: SubscriptionLifecycleAction;
  reasonCode: string;
  effectiveAt: Date;
  graceEndsAt?: Date | null;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface ClaimedLifecycleOutboxRow {
  id: string;
  subscriptionId: string;
  clientId: string;
  externalOrderId: string;
  action: string;
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  leaseToken: string;
}

export interface LifecycleDeliveryBatchSummary {
  claimed: number;
  accepted: number;
  retried: number;
  deadLettered: number;
  leaseConflicts: number;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
    redirect?: 'error' | 'follow' | 'manual';
  },
) => Promise<{
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
}>;

function computeRetryDelaySeconds(
  attemptCount: number,
  baseSeconds: number,
  maxSeconds: number,
  jitterRatio: number,
  randomFn: () => number,
): number {
  const exponential = Math.min(maxSeconds, baseSeconds * Math.pow(2, Math.max(0, attemptCount - 1)));
  const jitterWindow = exponential * jitterRatio;
  const offset = (randomFn() * 2 - 1) * jitterWindow;
  return Math.max(1, Math.round(exponential + offset));
}

function classifyFailure(
  httpStatus: number | null,
  error: unknown,
): { retryable: boolean; errorCode: string } {
  if (httpStatus !== null) {
    if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
      return { retryable: true, errorCode: `HTTP_${httpStatus}` };
    }
    return { retryable: false, errorCode: `HTTP_${httpStatus}` };
  }
  const message = error instanceof Error ? error.message.toUpperCase() : 'NETWORK_ERROR';
  if (message.includes('ABORT') || message.includes('TIMEOUT')) {
    return { retryable: true, errorCode: 'DELIVERY_TIMEOUT' };
  }
  return { retryable: true, errorCode: 'DELIVERY_NETWORK_ERROR' };
}

@Injectable()
export class SubscriptionLifecycleOutboxService {
  private readonly logger = new Logger(SubscriptionLifecycleOutboxService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async resolveExternalOrderId(
    db: any,
    subscriptionId: string,
    clientId: string,
  ): Promise<string | null> {
    if (typeof db.platformProvisioningOutbox?.findFirst === 'function') {
      const bySub = await db.platformProvisioningOutbox.findFirst({
        where: { subscriptionId, clientId },
        orderBy: { createdAt: 'desc' },
        select: { externalOrderId: true },
      });
      if (bySub?.externalOrderId) return bySub.externalOrderId;

      const byInvoiceSub = await db.platformProvisioningOutbox.findFirst({
        where: {
          clientId,
          invoice: { subscriptionId },
        },
        orderBy: { createdAt: 'desc' },
        select: { externalOrderId: true },
      });
      if (byInvoiceSub?.externalOrderId) return byInvoiceSub.externalOrderId;
    }

    if (typeof db.platformProvisioningProjection?.findFirst === 'function') {
      const proj = await db.platformProvisioningProjection.findFirst({
        where: { clientId },
        orderBy: { platformUpdatedAt: 'desc' },
        select: { externalOrderId: true },
      });
      if (proj?.externalOrderId) return proj.externalOrderId;
    }

    return null;
  }

  async enqueueCommand(
    db: any,
    input: EnqueueSubscriptionLifecycleCommandInput,
  ): Promise<any> {
    const idempotencyKey = (
      input.idempotencyKey ??
      `bazionweb:sub:${input.subscriptionId}:${input.action}:${input.effectiveAt.toISOString()}`
    ).slice(0, 200);
    const paddedKey = idempotencyKey.length >= 16 ? idempotencyKey : `${idempotencyKey}:v1`.padEnd(16, '0');

    const existing = await db.subscriptionLifecycleOutbox.findUnique({
      where: { idempotencyKey: paddedKey },
    });
    if (existing) return existing;

    const eventId = deterministicUuidFromSeed(`lifecycle-event:${paddedKey}`);
    const correlationId =
      input.correlationId ?? deterministicUuidFromSeed(`lifecycle-corr:${input.subscriptionId}:${input.action}`);
    const occurredAt = new Date().toISOString();

    const payload: Record<string, unknown> = {
      schemaVersion: '1.0.0',
      eventId,
      correlationId,
      idempotencyKey: paddedKey,
      occurredAt,
      effectiveAt: input.effectiveAt.toISOString(),
      source: 'bazionweb',
      action: input.action,
      subscriptionId: input.subscriptionId,
      externalOrderId: input.externalOrderId,
      externalCustomerId: input.clientId,
      reasonCode: input.reasonCode,
      ...(input.graceEndsAt ? { graceEndsAt: input.graceEndsAt.toISOString() } : {}),
    };

    try {
      return await db.subscriptionLifecycleOutbox.create({
        data: {
          subscriptionId: input.subscriptionId,
          clientId: input.clientId,
          externalOrderId: input.externalOrderId,
          action: input.action,
          reasonCode: input.reasonCode,
          effectiveAt: input.effectiveAt,
          graceEndsAt: input.graceEndsAt ?? null,
          eventId,
          correlationId,
          idempotencyKey: paddedKey,
          payload,
          status: PlatformOutboxStatus.PENDING,
          attemptCount: 0,
          maxAttempts: 8,
          nextAttemptAt: new Date(),
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return db.subscriptionLifecycleOutbox.findUnique({
          where: { idempotencyKey: paddedKey },
        });
      }
      throw err;
    }
  }

  async enqueueForSubscription(
    db: any,
    input: {
      subscriptionId: string;
      clientId: string;
      action: SubscriptionLifecycleAction;
      reasonCode: string;
      effectiveAt: Date;
      graceEndsAt?: Date | null;
      idempotencyKey?: string;
      correlationId?: string;
    },
  ): Promise<any | null> {
    const externalOrderId = await this.resolveExternalOrderId(db, input.subscriptionId, input.clientId);
    if (!externalOrderId) {
      return null;
    }
    return this.enqueueCommand(db, {
      ...input,
      externalOrderId,
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'platform-subscription-lifecycle-outbox-dispatch',
  })
  async scheduledTick(): Promise<void> {
    if (this.running) return;
    if ((this.config?.get<string>('PLATFORM_LIFECYCLE_WORKER_ENABLED') ?? 'true') === 'false') {
      return;
    }
    const baseUrl = this.config?.get<string>('PLATFORM_API_BASE_URL')?.trim();
    const secret = this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET')?.trim();
    if (!baseUrl || !secret) return;

    this.running = true;
    try {
      await this.processDueBatch();
    } catch (error) {
      this.logger.error(
        `Scheduled lifecycle delivery tick failed: ${error instanceof Error ? error.message : 'UNKNOWN'}`,
      );
    } finally {
      this.running = false;
    }
  }

  async claimDueBatch(limit: number, leaseSeconds: number): Promise<ClaimedLifecycleOutboxRow[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const safeLeaseSeconds = Math.max(30, Math.min(900, Math.trunc(leaseSeconds)));

    return this.prisma.$transaction(async (tx: any) => {
      let candidates: Array<{ id: string }> = [];
      const usedRawClaim = typeof tx.$queryRaw === 'function';
      if (usedRawClaim) {
        candidates = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
            FROM subscription_lifecycle_outbox
           WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
              OR (status = 'PROCESSING' AND lease_expires_at <= NOW())
           ORDER BY next_attempt_at ASC, created_at ASC
           LIMIT ${safeLimit}
           FOR UPDATE SKIP LOCKED
        `;
      } else {
        const now = new Date();
        candidates = await tx.subscriptionLifecycleOutbox.findMany({
          where: {
            OR: [
              { status: PlatformOutboxStatus.PENDING, nextAttemptAt: { lte: now } },
              { status: PlatformOutboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
            ],
          },
          orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
          take: safeLimit,
          select: { id: true },
        });
      }

      const claimed: ClaimedLifecycleOutboxRow[] = [];
      const leaseExpiresAt = new Date(Date.now() + safeLeaseSeconds * 1000);
      const now = new Date();

      for (const candidate of candidates) {
        const leaseToken = crypto.randomUUID();
        const updated = await tx.subscriptionLifecycleOutbox.updateMany({
          where: usedRawClaim
            ? {
                id: candidate.id,
                status: { in: [PlatformOutboxStatus.PENDING, PlatformOutboxStatus.PROCESSING] },
              }
            : {
                id: candidate.id,
                OR: [
                  { status: PlatformOutboxStatus.PENDING, nextAttemptAt: { lte: now } },
                  { status: PlatformOutboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
                ],
              },
          data: {
            status: PlatformOutboxStatus.PROCESSING,
            leaseToken,
            leaseExpiresAt,
          },
        });
        if (updated.count !== 1) continue;

        const row = await tx.subscriptionLifecycleOutbox.findUnique({
          where: { id: candidate.id },
        });
        if (row) {
          claimed.push({
            id: row.id,
            subscriptionId: row.subscriptionId,
            clientId: row.clientId,
            externalOrderId: row.externalOrderId,
            action: row.action,
            eventId: row.eventId,
            correlationId: row.correlationId,
            idempotencyKey: row.idempotencyKey,
            payload: row.payload as Record<string, unknown>,
            attemptCount: row.attemptCount,
            maxAttempts: row.maxAttempts,
            leaseToken,
          });
        }
      }

      return claimed;
    });
  }

  async processDueBatch(overrides?: {
    platformApiBaseUrl?: string;
    commandSecret?: string;
    commandIssuer?: string;
    commandAudience?: string;
    batchSize?: number;
    leaseSeconds?: number;
    timeoutMs?: number;
    retryBaseSeconds?: number;
    retryMaxSeconds?: number;
    jitterRatio?: number;
    fetchImpl?: FetchLike;
    randomFn?: () => number;
  }): Promise<LifecycleDeliveryBatchSummary> {
    const baseUrl = (overrides?.platformApiBaseUrl ?? this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const secret = (overrides?.commandSecret ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!baseUrl || !secret) {
      throw new Error('PLATFORM_LIFECYCLE_DELIVERY_NOT_CONFIGURED');
    }

    const issuer = overrides?.commandIssuer ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_ISSUER') ?? DEFAULT_COMMAND_ISSUER;
    const audience = overrides?.commandAudience ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_AUDIENCE') ?? DEFAULT_COMMAND_AUDIENCE;
    const batchSize = overrides?.batchSize ?? Number(this.config?.get('PLATFORM_PROVISIONING_BATCH_SIZE') ?? 10);
    const leaseSeconds = overrides?.leaseSeconds ?? Number(this.config?.get('PLATFORM_PROVISIONING_LEASE_SECONDS') ?? 120);
    const timeoutMs = overrides?.timeoutMs ?? Number(this.config?.get('PLATFORM_PROVISIONING_TIMEOUT_MS') ?? 5000);
    const retryBaseSeconds = overrides?.retryBaseSeconds ?? 15;
    const retryMaxSeconds = overrides?.retryMaxSeconds ?? 1800;
    const jitterRatio = overrides?.jitterRatio ?? 0.25;
    const fetchImpl: FetchLike =
      overrides?.fetchImpl ??
      (async (url, init) => {
        const res = await fetch(url, init);
        return {
          status: res.status,
          ok: res.ok,
          json: () => res.json(),
        };
      });
    const randomFn = overrides?.randomFn ?? (() => Math.random());

    const claimed = await this.claimDueBatch(batchSize, leaseSeconds);
    const summary: LifecycleDeliveryBatchSummary = {
      claimed: claimed.length,
      accepted: 0,
      retried: 0,
      deadLettered: 0,
      leaseConflicts: 0,
    };

    const endpointUrl = `${baseUrl}/v1/internal/commercial/subscription-lifecycle`;

    for (const item of claimed) {
      const bearer = signCommercialCommandToken(
        {
          subject: 'bazionweb-lifecycle-worker',
          issuer,
          audience,
          scopes: ['commercial:lifecycle:write'],
          ttlSeconds: 120,
        },
        secret,
      );

      let httpStatus: number | null = null;
      let deliveryError: unknown = null;
      let acceptedOk = false;

      try {
        const response = await fetchImpl(endpointUrl, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
            'Idempotency-Key': item.idempotencyKey,
            'X-Bazion-Event-Id': item.eventId,
            'X-Bazion-Correlation-Id': item.correlationId,
          },
          body: JSON.stringify(item.payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
        httpStatus = response.status;
        acceptedOk = response.ok;
      } catch (error) {
        deliveryError = error;
      }

      if (acceptedOk) {
        const ack = await this.prisma.subscriptionLifecycleOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: item.leaseToken,
            status: PlatformOutboxStatus.PROCESSING,
          },
          data: {
            status: PlatformOutboxStatus.ACCEPTED,
            attemptCount: { increment: 1 },
            lastHttpStatus: httpStatus ?? 200,
            lastErrorCode: null,
            leaseToken: null,
            leaseExpiresAt: null,
            acceptedAt: new Date(),
          },
        });
        if (ack.count === 1) summary.accepted += 1;
        else summary.leaseConflicts += 1;
        continue;
      }

      const nextAttemptNumber = item.attemptCount + 1;
      const failure = classifyFailure(httpStatus, deliveryError);
      const shouldDeadLetter = !failure.retryable || nextAttemptNumber >= item.maxAttempts;

      if (shouldDeadLetter) {
        const dead = await this.prisma.subscriptionLifecycleOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: item.leaseToken,
            status: PlatformOutboxStatus.PROCESSING,
          },
          data: {
            status: PlatformOutboxStatus.DEAD,
            attemptCount: { increment: 1 },
            lastHttpStatus: httpStatus,
            lastErrorCode: failure.errorCode,
            leaseToken: null,
            leaseExpiresAt: null,
            deadLetteredAt: new Date(),
          },
        });
        if (dead.count === 1) summary.deadLettered += 1;
        else summary.leaseConflicts += 1;
        continue;
      }

      const delaySeconds = computeRetryDelaySeconds(
        nextAttemptNumber,
        retryBaseSeconds,
        retryMaxSeconds,
        jitterRatio,
        randomFn,
      );
      const retry = await this.prisma.subscriptionLifecycleOutbox.updateMany({
        where: {
          id: item.id,
          leaseToken: item.leaseToken,
          status: PlatformOutboxStatus.PROCESSING,
        },
        data: {
          status: PlatformOutboxStatus.PENDING,
          attemptCount: { increment: 1 },
          lastHttpStatus: httpStatus,
          lastErrorCode: failure.errorCode,
          leaseToken: null,
          leaseExpiresAt: null,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        },
      });
      if (retry.count === 1) summary.retried += 1;
      else summary.leaseConflicts += 1;
    }

    return summary;
  }
}
