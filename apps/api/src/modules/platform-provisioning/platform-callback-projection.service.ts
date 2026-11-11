import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_CALLBACK_MAX_SKEW_SECONDS,
  type ProvisioningOperationV1,
  validateProvisioningStatusEventV1,
  verifyPlatformStatusWebhook,
} from './provisioning-crypto';

const TERMINAL_STATUSES = new Set(['ready', 'compensated', 'failed']);

const STATUS_RANK: Record<string, number> = {
  accepted: 1,
  validating: 2,
  provisioning_tenant: 3,
  configuring_installation: 4,
  provisioning_hosting: 5,
  ready: 6,
  compensating: 4,
  compensation_required: 5,
  compensated: 6,
  failed: 6,
};

function shouldAdvanceProjection(
  existing: { status: string; platformUpdatedAt: Date } | null,
  incomingStatus: string,
  incomingUpdatedAt: Date,
): boolean {
  if (!existing) return true;
  if (TERMINAL_STATUSES.has(existing.status) && existing.status !== incomingStatus) {
    return false;
  }
  const existingTs = existing.platformUpdatedAt.getTime();
  const incomingTs = incomingUpdatedAt.getTime();
  if (incomingTs < existingTs) {
    return false;
  }
  if (incomingTs === existingTs) {
    return (STATUS_RANK[incomingStatus] ?? 0) >= (STATUS_RANK[existing.status] ?? 0);
  }
  return true;
}

@Injectable()
export class PlatformCallbackProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async ingestSignedStatusCallback(input: {
    rawBody: Buffer | string;
    body: unknown;
    signatureHeader: string | undefined;
    authorizationHeader?: string;
    signingSecret?: string;
    bearerSecret?: string;
    maxSkewSeconds?: number;
    nowSeconds?: number;
  }) {
    const signingSecret = (
      input.signingSecret ??
      this.config?.get<string>('PLATFORM_CALLBACK_SIGNING_SECRET') ??
      ''
    ).trim();
    const bearerSecret = (
      input.bearerSecret ??
      this.config?.get<string>('PLATFORM_CALLBACK_BEARER_SECRET') ??
      ''
    ).trim() || undefined;
    const maxSkewSeconds =
      input.maxSkewSeconds ??
      Number(this.config?.get('PLATFORM_CALLBACK_MAX_SKEW_SECONDS') ?? DEFAULT_CALLBACK_MAX_SKEW_SECONDS);

    verifyPlatformStatusWebhook({
      rawBody: input.rawBody,
      signatureHeader: input.signatureHeader,
      signingSecret,
      maxSkewSeconds,
      nowSeconds: input.nowSeconds,
      authorizationHeader: input.authorizationHeader,
      bearerSecret,
    });

    const parsedEvent = validateProvisioningStatusEventV1(input.body);
    if (!parsedEvent) {
      throw new BadRequestException('Invalid product.provisioning.status.v1 callback payload');
    }

    const occurredAt = new Date(parsedEvent.occurredAt);
    const operation = parsedEvent.operation;

    return this.prisma.$transaction(async (tx: any) => {
      const existingInbox = await tx.platformCallbackInbox.findUnique({
        where: { eventId: parsedEvent.eventId },
      });
      if (existingInbox) {
        return {
          received: true,
          deduplicated: true,
          staleIgnored: false,
          operationId: operation.operationId,
          status: existingInbox.statusSnapshot,
        };
      }

      try {
        await tx.platformCallbackInbox.create({
          data: {
            eventId: parsedEvent.eventId,
            correlationId: parsedEvent.correlationId,
            operationId: operation.operationId,
            eventType: parsedEvent.eventType,
            statusSnapshot: operation.status,
            occurredAt,
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          return {
            received: true,
            deduplicated: true,
            staleIgnored: false,
            operationId: operation.operationId,
            status: operation.status,
          };
        }
        throw error;
      }

      const projectionResult = await this.projectOperationSnapshot(
        operation,
        {
          eventId: parsedEvent.eventId,
          correlationId: parsedEvent.correlationId,
        },
        tx,
      );

      return {
        received: true,
        deduplicated: false,
        staleIgnored: projectionResult.staleIgnored,
        operationId: operation.operationId,
        status: projectionResult.projection.status,
      };
    });
  }

  async projectOperationSnapshot(
    operation: ProvisioningOperationV1,
    meta?: { eventId?: string | null; correlationId?: string | null },
    tx?: any,
  ) {
    const db = tx ?? this.prisma;
    const incomingUpdatedAt = new Date(operation.updatedAt);

    const outbox = await db.platformProvisioningOutbox.findUnique({
      where: { externalOrderId: operation.externalOrderId },
      select: { id: true, clientId: true },
    });

    const existingProjection = await db.platformProvisioningProjection.findUnique({
      where: { operationId: operation.operationId },
    });

    if (!shouldAdvanceProjection(existingProjection, operation.status, incomingUpdatedAt)) {
      return {
        staleIgnored: true,
        projection: existingProjection,
      };
    }

    const projection = existingProjection
      ? await db.platformProvisioningProjection.update({
          where: { operationId: operation.operationId },
          data: {
            outboxId: existingProjection.outboxId ?? outbox?.id ?? null,
            clientId: existingProjection.clientId ?? outbox?.clientId ?? null,
            status: operation.status,
            currentStep: operation.currentStep,
            platformTenantId: operation.tenantId,
            installationId: operation.installationId,
            failureCode: operation.failure?.code ?? null,
            failureRetryable: operation.failure?.retryable ?? null,
            lastEventId: meta?.eventId ?? existingProjection.lastEventId,
            lastCorrelationId: meta?.correlationId ?? operation.correlationId,
            platformUpdatedAt: incomingUpdatedAt,
          },
        })
      : await db.platformProvisioningProjection.create({
          data: {
            operationId: operation.operationId,
            outboxId: outbox?.id ?? null,
            clientId: outbox?.clientId ?? null,
            externalOrderId: operation.externalOrderId,
            status: operation.status,
            currentStep: operation.currentStep,
            platformTenantId: operation.tenantId,
            installationId: operation.installationId,
            failureCode: operation.failure?.code ?? null,
            failureRetryable: operation.failure?.retryable ?? null,
            lastEventId: meta?.eventId ?? null,
            lastCorrelationId: meta?.correlationId ?? operation.correlationId,
            platformUpdatedAt: incomingUpdatedAt,
          },
        });

    return {
      staleIgnored: false,
      projection,
    };
  }
}

