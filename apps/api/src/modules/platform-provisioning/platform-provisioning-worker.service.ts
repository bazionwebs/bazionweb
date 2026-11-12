import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PlatformOutboxStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  signCommercialCommandToken,
} from './provisioning-crypto';
import {
  findProvisioningDomainClaims,
  lockProvisioningDomainClaim,
  normalizeProvisioningDomain,
} from './domain-claim-lock';

export interface ClaimedCommercialOutboxRow {
  id: string;
  invoiceId: string;
  clientId: string;
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  externalOrderId: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  leaseToken: string;
}

export interface DeliveryBatchSummary {
  claimed: number;
  accepted: number;
  retried: number;
  deadLettered: number;
  leaseConflicts: number;
}

export type FetchLike = (
  url: string,
  init: RequestInit,
) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

const SAFE_ERROR_CODE_REGEX = /^[A-Z][A-Z0-9_:-]{1,63}$/;

function normalizeSafeErrorCode(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().toUpperCase().replace(/[^A-Z0-9_:-]+/g, '_').slice(0, 64);
  return SAFE_ERROR_CODE_REGEX.test(trimmed) ? trimmed : fallback;
}

function computeRetryDelaySeconds(
  attemptNumber: number,
  baseSeconds: number,
  maxSeconds: number,
  jitterRatio: number,
  randomFn: () => number,
): number {
  const exponent = Math.max(0, Math.min(12, attemptNumber - 1));
  const raw = Math.min(maxSeconds, baseSeconds * 2 ** exponent);
  const clampedJitter = Math.max(0, Math.min(0.5, jitterRatio));
  const jitter = Math.round(raw * clampedJitter * randomFn());
  return Math.max(1, Math.min(maxSeconds + jitter, 86_400));
}

function classifyDeliveryFailure(
  status: number | null,
  bodyErrorCode: string | null,
  error: unknown,
): { retryable: boolean; code: string } {
  if (status !== null) {
    if (status === 408 || status === 429 || status >= 500) {
      return { retryable: true, code: normalizeSafeErrorCode(bodyErrorCode, `HTTP_${status}`) };
    }
    return { retryable: false, code: normalizeSafeErrorCode(bodyErrorCode, `HTTP_${status}_REJECTED`) };
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { retryable: true, code: 'DELIVERY_TIMEOUT' };
  }
  return { retryable: true, code: 'DELIVERY_NETWORK_ERROR' };
}

@Injectable()
export class PlatformProvisioningWorkerService {
  private readonly logger = new Logger(PlatformProvisioningWorkerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Cron('*/30 * * * * *')
  async scheduledTick(): Promise<void> {
    if (this.config?.get<string>('PLATFORM_PROVISIONING_WORKER_ENABLED') !== 'true') {
      return;
    }
    if (this.running) return;
    this.running = true;
    try {
      await this.processDueBatch();
    } catch (error) {
      this.logger.error(
        `Scheduled provisioning delivery tick failed: ${error instanceof Error ? error.message : 'UNKNOWN'}`,
      );
    } finally {
      this.running = false;
    }
  }

  async claimDueBatch(limit: number, leaseSeconds: number): Promise<ClaimedCommercialOutboxRow[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const safeLeaseSeconds = Math.max(30, Math.min(900, Math.trunc(leaseSeconds)));

    return this.prisma.$transaction(async (tx: any) => {
      let candidates: Array<{ id: string }> = [];
      const usedRawClaim = typeof tx.$queryRaw === 'function';
      if (usedRawClaim) {
        candidates = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
            FROM platform_provisioning_outbox
           WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
              OR (status = 'PROCESSING' AND lease_expires_at <= NOW())
           ORDER BY next_attempt_at ASC, created_at ASC
           LIMIT ${safeLimit}
           FOR UPDATE SKIP LOCKED
        `;
      } else {
        const now = new Date();
        candidates = await tx.platformProvisioningOutbox.findMany({
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

      const claimed: ClaimedCommercialOutboxRow[] = [];
      const leaseExpiresAt = new Date(Date.now() + safeLeaseSeconds * 1000);
      const now = new Date();

      for (const candidate of candidates) {
        const leaseToken = crypto.randomUUID();
        const updated = await tx.platformProvisioningOutbox.updateMany({
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

        const row = await tx.platformProvisioningOutbox.findUnique({
          where: { id: candidate.id },
        });
        if (row) {
          claimed.push({
            id: row.id,
            invoiceId: row.invoiceId,
            clientId: row.clientId,
            eventId: row.eventId,
            correlationId: row.correlationId,
            idempotencyKey: row.idempotencyKey,
            externalOrderId: row.externalOrderId,
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
  }): Promise<DeliveryBatchSummary> {
    const baseUrl = (overrides?.platformApiBaseUrl ?? this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const secret = (overrides?.commandSecret ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!baseUrl || !secret) {
      throw new Error('PLATFORM_PROVISIONING_DELIVERY_NOT_CONFIGURED');
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
    const summary: DeliveryBatchSummary = {
      claimed: claimed.length,
      accepted: 0,
      retried: 0,
      deadLettered: 0,
      leaseConflicts: 0,
    };

    const endpointUrl = `${baseUrl}/v1/internal/commercial/provisioning-requests`;

    for (const item of claimed) {
      const bearer = signCommercialCommandToken(
        {
          subject: 'bazionweb-outbox-worker',
          issuer,
          audience,
          scopes: ['commercial:provisioning:write'],
          ttlSeconds: 120,
        },
        secret,
      );

      let httpStatus: number | null = null;
      let responseBody: Record<string, unknown> | null = null;
      let deliveryError: unknown = null;
      let acceptedOk = false;

      try {
        const response = await fetchImpl(endpointUrl, {
          method: 'POST',
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
        responseBody = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        acceptedOk = response.ok;
      } catch (error) {
        deliveryError = error;
      }

      if (acceptedOk) {
        const op = responseBody?.operation as Record<string, unknown> | undefined;
        const operationId = typeof op?.operationId === 'string' ? op.operationId : null;
        const ack = await this.prisma.platformProvisioningOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: item.leaseToken,
            status: PlatformOutboxStatus.PROCESSING,
          },
          data: {
            status: PlatformOutboxStatus.ACCEPTED,
            attemptCount: item.attemptCount + 1,
            platformOperationId: operationId,
            lastHttpStatus: httpStatus ?? 202,
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

      const bodyErrCode = typeof responseBody?.error === 'string' ? responseBody.error : null;
      const failure = classifyDeliveryFailure(httpStatus, bodyErrCode, deliveryError);
      const nextAttemptCount = item.attemptCount + 1;
      const shouldDeadLetter = !failure.retryable || nextAttemptCount >= item.maxAttempts;

      if (shouldDeadLetter) {
        const dead = await this.prisma.platformProvisioningOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: item.leaseToken,
            status: PlatformOutboxStatus.PROCESSING,
          },
          data: {
            status: PlatformOutboxStatus.DEAD,
            attemptCount: nextAttemptCount,
            lastHttpStatus: httpStatus,
            lastErrorCode: failure.code,
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
        nextAttemptCount,
        retryBaseSeconds,
        retryMaxSeconds,
        jitterRatio,
        randomFn,
      );
      const retried = await this.prisma.platformProvisioningOutbox.updateMany({
        where: {
          id: item.id,
          leaseToken: item.leaseToken,
          status: PlatformOutboxStatus.PROCESSING,
        },
        data: {
          status: PlatformOutboxStatus.PENDING,
          attemptCount: nextAttemptCount,
          lastHttpStatus: httpStatus,
          lastErrorCode: failure.code,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (retried.count === 1) summary.retried += 1;
      else summary.leaseConflicts += 1;
    }

    return summary;
  }

  async replayOutboxEntry(id: string, actorUser?: { id?: string; email?: string }) {
    const existing = await this.prisma.platformProvisioningOutbox.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Provisioning outbox entry not found');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const existingPayload =
        existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload)
          ? (existing.payload as Record<string, unknown>)
          : {};
      const requestedDomain =
        typeof existingPayload.requestedDomain === 'string'
          ? normalizeProvisioningDomain(existingPayload.requestedDomain)
          : null;
      if (requestedDomain) {
        await lockProvisioningDomainClaim(tx, requestedDomain);
        const domainClaims = await findProvisioningDomainClaims(
          tx,
          requestedDomain,
          existing.externalOrderId,
        );
        if (domainClaims.length > 0) {
          throw new ConflictException(
            'This order cannot be replayed while another Platform order or legacy hosting account claims its domain. Resolve the competing workload and ownership record, then replay the order.',
          );
        }
      }

      const updated = await tx.platformProvisioningOutbox.update({
        where: { id },
        data: {
          status: PlatformOutboxStatus.PENDING,
          nextAttemptAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          deadLetteredAt: null,
          lastErrorCode: null,
          lastHttpStatus: null,
          maxAttempts: Math.max(existing.maxAttempts, existing.attemptCount + 3),
        },
      });

      if (typeof tx.auditLog?.create === 'function') {
        await tx.auditLog
          .create({
            data: {
              userId: actorUser?.id ?? null,
              action: 'platform_provisioning.outbox_replay',
              resourceType: 'PlatformProvisioningOutbox',
              resourceId: id,
              newValue: {
                previousStatus: existing.status,
                newStatus: updated.status,
                externalOrderId: existing.externalOrderId,
                replayedBy: actorUser?.email ?? actorUser?.id ?? 'operator',
              },
            },
          })
          .catch(() => undefined);
      }

      return updated;
    });
  }
}

