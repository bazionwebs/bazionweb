import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus, PlatformOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
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
    const baseUrl = (options?.platformApiBaseUrl ?? this.config?.get<string>('PLATFORM_API_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const secret = (options?.commandSecret ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!baseUrl || !secret) {
      throw new Error('PLATFORM_PROVISIONING_POLL_NOT_CONFIGURED');
    }

    const issuer = options?.commandIssuer ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_ISSUER') ?? DEFAULT_COMMAND_ISSUER;
    const audience = options?.commandAudience ?? this.config?.get<string>('PLATFORM_PROVISIONING_COMMAND_AUDIENCE') ?? DEFAULT_COMMAND_AUDIENCE;
    const timeoutMs = options?.timeoutMs ?? Number(this.config?.get('PLATFORM_PROVISIONING_TIMEOUT_MS') ?? 5000);
    const staleMinutes = options?.staleMinutes ?? 5;
    const cutoff = new Date(Date.now() - Math.max(1, Math.trunc(staleMinutes)) * 60_000);
    const fetchImpl: FetchLike =
      options?.fetchImpl ??
      (async (url, init) => {
        const res = await fetch(url, init);
        return {
          status: res.status,
          ok: res.ok,
          json: () => res.json(),
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
}

