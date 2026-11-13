import { randomUUID } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus, PlatformOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import {
  assertSafePlatformBaseUrl,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  DEFAULT_MAX_PLATFORM_RESPONSE_BYTES,
  readJsonResponseWithSizeLimit,
  signCommercialCommandToken,
  validateProvisioningOperationV1,
} from './provisioning-crypto';
import type { FetchLike } from './platform-provisioning-worker.service';

export interface CommercialReconciliationReport {
  generatedAt: string;
  staleThresholdMinutes: number;
  counts: {
    paidInvoicesWithoutOutbox: number;
    acceptedWithoutStatusLag: number;
    deadOutboxCount: number;
    staleProcessingLeases: number;
    failedOrCompensationRequired: number;
  };
  paidInvoicesWithoutOutbox: Array<{
    invoiceId: string;
    invoiceNumber: string;
    clientId: string;
    paidAt: string | null;
  }>;
  laggingAcceptedOutbox: Array<{
    outboxId: string;
    invoiceId: string;
    externalOrderId: string;
    platformOperationId: string | null;
    acceptedAt: string | null;
    projectionStatus: string | null;
  }>;
  deadOutboxItems: Array<{
    outboxId: string;
    invoiceId: string;
    externalOrderId: string;
    attemptCount: number;
    lastHttpStatus: number | null;
    lastErrorCode: string | null;
    deadLetteredAt: string | null;
  }>;
  staleProcessingItems: Array<{
    outboxId: string;
    externalOrderId: string;
    leaseExpiresAt: string | null;
  }>;
}

@Injectable()
export class PlatformProvisioningReconciliationService {
  private readonly logger = new Logger(PlatformProvisioningReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionService: PlatformCallbackProjectionService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async getReconciliationReport(staleMinutes = 5): Promise<CommercialReconciliationReport> {
    const boundedMinutes = Math.max(1, Math.min(1440, Math.trunc(staleMinutes)));
    const cutoff = new Date(Date.now() - boundedMinutes * 60_000);
    const now = new Date();

    const [
      paidInvoicesWithoutOutbox,
      acceptedCandidates,
      deadOutboxItems,
      staleProcessingItems,
      failedOrCompensationCount,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          platformOutboxEntries: { none: {} },
        },
        orderBy: { paidAt: 'desc' },
        take: 50,
        select: {
          id: true,
          invoiceNumber: true,
          clientId: true,
          paidAt: true,
        },
      }),
      this.prisma.platformProvisioningOutbox.findMany({
        where: {
          status: PlatformOutboxStatus.ACCEPTED,
          acceptedAt: { lte: cutoff },
          OR: [
            { projection: { is: null } },
            { projection: { is: { status: 'accepted' } } },
          ],
        },
        orderBy: { acceptedAt: 'asc' },
        take: 50,
        include: {
          projection: { select: { status: true } },
        },
      }),
      this.prisma.platformProvisioningOutbox.findMany({
        where: { status: PlatformOutboxStatus.DEAD },
        orderBy: { deadLetteredAt: 'desc' },
        take: 50,
        select: {
          id: true,
          invoiceId: true,
          externalOrderId: true,
          attemptCount: true,
          lastHttpStatus: true,
          lastErrorCode: true,
          deadLetteredAt: true,
        },
      }),
      this.prisma.platformProvisioningOutbox.findMany({
        where: {
          status: PlatformOutboxStatus.PROCESSING,
          leaseExpiresAt: { lte: now },
        },
        orderBy: { leaseExpiresAt: 'asc' },
        take: 50,
        select: {
          id: true,
          externalOrderId: true,
          leaseExpiresAt: true,
        },
      }),
      this.prisma.platformProvisioningProjection.count({
        where: {
          status: { in: ['failed', 'compensation_required'] },
        },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      staleThresholdMinutes: boundedMinutes,
      counts: {
        paidInvoicesWithoutOutbox: paidInvoicesWithoutOutbox.length,
        acceptedWithoutStatusLag: acceptedCandidates.length,
        deadOutboxCount: deadOutboxItems.length,
        staleProcessingLeases: staleProcessingItems.length,
        failedOrCompensationRequired: failedOrCompensationCount,
      },
      paidInvoicesWithoutOutbox: paidInvoicesWithoutOutbox.map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        paidAt: inv.paidAt?.toISOString() ?? null,
      })),
      laggingAcceptedOutbox: acceptedCandidates.map((item) => ({
        outboxId: item.id,
        invoiceId: item.invoiceId,
        externalOrderId: item.externalOrderId,
        platformOperationId: item.platformOperationId,
        acceptedAt: item.acceptedAt?.toISOString() ?? null,
        projectionStatus: item.projection?.status ?? null,
      })),
      deadOutboxItems: deadOutboxItems.map((item) => ({
        outboxId: item.id,
        invoiceId: item.invoiceId,
        externalOrderId: item.externalOrderId,
        attemptCount: item.attemptCount,
        lastHttpStatus: item.lastHttpStatus,
        lastErrorCode: item.lastErrorCode,
        deadLetteredAt: item.deadLetteredAt?.toISOString() ?? null,
      })),
      staleProcessingItems: staleProcessingItems.map((item) => ({
        outboxId: item.id,
        externalOrderId: item.externalOrderId,
        leaseExpiresAt: item.leaseExpiresAt?.toISOString() ?? null,
      })),
    };
  }

  async pollLaggingOperations(options?: {
    staleMinutes?: number;
    platformApiBaseUrl?: string;
    commandSecret?: string;
    commandIssuer?: string;
    commandAudience?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  }): Promise<{ checked: number; updated: number; errors: number }> {
    const rawBaseUrl = (options?.platformApiBaseUrl ?? this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '').trim();
    const secret = (options?.commandSecret ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!rawBaseUrl || !secret) {
      throw new Error('PLATFORM_PROVISIONING_POLL_NOT_CONFIGURED');
    }
    const baseUrl = assertSafePlatformBaseUrl(rawBaseUrl, {
      isProduction: this.config?.get<string>('NODE_ENV') === 'production',
      errorCode: 'PLATFORM_PROVISIONING_BASE_URL_INVALID',
    });

    const issuer = options?.commandIssuer ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_ISSUER') ?? DEFAULT_COMMAND_ISSUER;
    const audience = options?.commandAudience ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_AUDIENCE') ?? DEFAULT_COMMAND_AUDIENCE;
    const timeoutMs = options?.timeoutMs ?? Number(this.config?.get('PLATFORM_PROVISIONING_TIMEOUT_MS') ?? 5000);
    const staleMinutes = options?.staleMinutes ?? 5;
    const cutoff = new Date(Date.now() - Math.max(1, Math.trunc(staleMinutes)) * 60_000);
    const fetchImpl: FetchLike =
      options?.fetchImpl ??
      (async (url, init) => {
        const res = await fetch(url, { ...init, redirect: 'error' });
        const parsed = await readJsonResponseWithSizeLimit(res, DEFAULT_MAX_PLATFORM_RESPONSE_BYTES).catch(() => null);
        return {
          status: res.status,
          ok: res.ok,
          json: async () => parsed,
        };
      });

    const candidates = await this.prisma.platformProvisioningOutbox.findMany({
      where: {
        status: PlatformOutboxStatus.ACCEPTED,
        platformOperationId: { not: null },
        acceptedAt: { lte: cutoff },
        OR: [
          { projection: { is: null } },
          { projection: { is: { status: { in: ['accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating'] } } } },
        ],
      },
      orderBy: { acceptedAt: 'asc' },
      take: 25,
      select: {
        id: true,
        platformOperationId: true,
      },
    });

    let updated = 0;
    let errors = 0;

    for (const candidate of candidates) {
      const operationId = candidate.platformOperationId!;
      const token = signCommercialCommandToken(
        {
          subject: 'bazionweb-reconciliation-poller',
          issuer,
          audience,
          scopes: ['commercial:provisioning:read'],
          ttlSeconds: 120,
        },
        secret,
      );

      try {
        const res = await fetchImpl(`${baseUrl}/v1/internal/commercial/operations/${encodeURIComponent(operationId)}`, {
          method: 'GET',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          errors += 1;
          continue;
        }
        const body = (await res.json()) as { operation?: unknown };
        const operation = validateProvisioningOperationV1(body?.operation);
        if (!operation) {
          errors += 1;
          continue;
        }
        const projected = await this.projectionService.projectOperationSnapshot(operation);
        if (!projected.staleIgnored) updated += 1;
      } catch (err) {
        errors += 1;
        this.logger.warn(
          `Operation poll failed for ${operationId}: ${err instanceof Error ? err.message : 'UNKNOWN'}`,
        );
      }
    }

    return {
      checked: candidates.length,
      updated,
      errors,
    };
  }

  /**
   * Pushes paid commercial order snapshots to Platform's cross-entity reconciliation
   * endpoint and emits structured error logs + immutable audit alerts on unresolved drift.
   */
  async pushCrossEntityReconciliationSnapshot(options?: {
    staleMinutes?: number;
    platformApiBaseUrl?: string;
    commandSecret?: string;
    commandIssuer?: string;
    commandAudience?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  }): Promise<{
    correlationId: string;
    ordersSubmitted: number;
    localDriftCount: number;
    remoteUnresolvedDriftCount: number;
    alertTriggered: boolean;
  }> {
    const rawBaseUrl = (options?.platformApiBaseUrl ?? this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '').trim();
    const secret = (options?.commandSecret ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!rawBaseUrl || !secret) {
      throw new Error('PLATFORM_PROVISIONING_RECONCILIATION_NOT_CONFIGURED');
    }
    const baseUrl = assertSafePlatformBaseUrl(rawBaseUrl, {
      isProduction: this.config?.get<string>('NODE_ENV') === 'production',
      errorCode: 'PLATFORM_PROVISIONING_BASE_URL_INVALID',
    });

    const issuer = options?.commandIssuer ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_ISSUER') ?? DEFAULT_COMMAND_ISSUER;
    const audience = options?.commandAudience ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_AUDIENCE') ?? DEFAULT_COMMAND_AUDIENCE;
    const timeoutMs = options?.timeoutMs ?? Number(this.config?.get('PLATFORM_PROVISIONING_TIMEOUT_MS') ?? 5000);
    const correlationId = randomUUID();

    const localReport = await this.getReconciliationReport(options?.staleMinutes ?? 5);
    const localDriftCount =
      localReport.counts.paidInvoicesWithoutOutbox
      + localReport.counts.acceptedWithoutStatusLag
      + localReport.counts.deadOutboxCount
      + localReport.counts.staleProcessingLeases
      + localReport.counts.failedOrCompensationRequired;

    const outboxSnapshots = await this.prisma.platformProvisioningOutbox.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        externalOrderId: true,
        externalCustomerId: true,
        clientId: true,
        payload: true,
        platformOperationId: true,
        createdAt: true,
        invoice: { select: { status: true, paidAt: true } },
        projection: {
          select: {
            platformTenantId: true,
            installationId: true,
            status: true,
          },
        },
      },
    });

    const paidOrders = outboxSnapshots
      .filter((item) => item.invoice?.status === InvoiceStatus.PAID || item.invoice == null)
      .map((item) => {
        const payload = (item.payload && typeof item.payload === 'object' ? item.payload : {}) as {
          order?: { offerId?: string; offerVersion?: string };
        };
        return {
          externalOrderId: item.externalOrderId,
          externalCustomerId: item.externalCustomerId || item.clientId,
          offerId: payload.order?.offerId ?? 'website-launch',
          offerVersion: payload.order?.offerVersion ?? '1.0.0',
          paymentStatus: 'paid' as const,
          paidAt: (item.invoice?.paidAt ?? item.createdAt ?? new Date()).toISOString(),
          operationId: item.platformOperationId ?? null,
          tenantId: item.projection?.platformTenantId ?? null,
          installationId: item.projection?.installationId ?? null,
          provisioningStatus: (item.projection?.status as string | undefined) ?? null,
          legacyFallbackUsed: false,
          legacyTenantId: null,
        };
      });

    const token = signCommercialCommandToken(
      {
        subject: 'bazionweb-reconciliation-scheduler',
        issuer,
        audience,
        scopes: ['commercial:provisioning:read'],
        ttlSeconds: 120,
      },
      secret,
    );

    const fetchImpl: FetchLike =
      options?.fetchImpl ??
      (async (url, init) => {
        const res = await fetch(url, { ...init, redirect: 'error' });
        const parsed = await readJsonResponseWithSizeLimit(res, DEFAULT_MAX_PLATFORM_RESPONSE_BYTES).catch(() => null);
        return {
          status: res.status,
          ok: res.ok,
          json: async () => parsed,
        };
      });

    const res = await fetchImpl(`${baseUrl}/v1/internal/commercial/reconciliation/report`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        schemaVersion: '1.0.0',
        correlationId,
        paidOrders,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const remoteBody = (await res.json()) as {
      summary?: { unresolvedDriftCount?: number; criticalExceptions?: number };
    } | null;
    if (!res.ok) {
      throw new Error(`PLATFORM_RECONCILIATION_PUSH_FAILED:${res.status}`);
    }

    const remoteUnresolvedDriftCount = Number(remoteBody?.summary?.unresolvedDriftCount ?? 0);
    const alertTriggered = localDriftCount > 0 || remoteUnresolvedDriftCount > 0;

    if (alertTriggered) {
      this.logger.error(
        JSON.stringify({
          event: 'PLATFORM_RECONCILIATION_DRIFT_ALERT',
          correlationId,
          localDriftCount,
          remoteUnresolvedDriftCount,
          ordersSubmitted: paidOrders.length,
        }),
      );
      if (typeof (this.prisma as any).auditLog?.create === 'function') {
        await (this.prisma as any).auditLog
          .create({
            data: {
              action: 'PLATFORM_RECONCILIATION_DRIFT_ALERT',
              resourceType: 'PlatformReconciliation',
              resourceId: correlationId,
              newValue: {
                localDriftCount,
                remoteUnresolvedDriftCount,
                ordersSubmitted: paidOrders.length,
                localCounts: localReport.counts,
              },
            },
          })
          .catch(() => undefined);
      }
    }

    return {
      correlationId,
      ordersSubmitted: paidOrders.length,
      localDriftCount,
      remoteUnresolvedDriftCount,
      alertTriggered,
    };
  }

  /** Scheduled every 15 minutes to poll lagging operations and push cross-entity snapshots. */
  @Cron('0 */15 * * * *')
  async scheduledReconciliationTick(): Promise<void> {
    if (this.config?.get<string>('PLATFORM_PROVISIONING_RECONCILIATION_CRON_ENABLED') === 'false') {
      return;
    }
    const baseUrl = (this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '').trim();
    const secret = (this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!baseUrl || !secret) {
      return;
    }

    await this.pollLaggingOperations().catch((err) => {
      this.logger.error(`Scheduled lag poll failed: ${err instanceof Error ? err.message : 'UNKNOWN'}`);
    });
    await this.pushCrossEntityReconciliationSnapshot().catch((err) => {
      this.logger.error(`Scheduled cross-entity reconciliation push failed: ${err instanceof Error ? err.message : 'UNKNOWN'}`);
    });
  }
}

