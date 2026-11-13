import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_CALLBACK_MAX_SKEW_SECONDS,
  type ProvisioningOperationV1,
  type SubscriptionLifecycleAction,
  validateProvisioningStatusEventV1,
  validateSubscriptionLifecycleStatusEventV1,
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
            requestedDomain: operation.requestedDomain ?? existingProjection.requestedDomain ?? null,
            platformDeploymentId: operation.hostingDeploymentId ?? existingProjection.platformDeploymentId ?? null,
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
            requestedDomain: operation.requestedDomain ?? null,
            platformDeploymentId: operation.hostingDeploymentId ?? null,
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

  private verifyWebhookSignature(input: {
    rawBody: Buffer | string;
    signatureHeader: string | undefined;
    authorizationHeader?: string;
    signingSecret?: string;
    bearerSecret?: string;
    maxSkewSeconds?: number;
    nowSeconds?: number;
  }): void {
    const signingSecret = (
      input.signingSecret ??
      this.config?.get<string>('PLATFORM_CALLBACK_SIGNING_SECRET') ??
      ''
    ).trim();
    const bearerSecret = (
      input.bearerSecret ??
      this.config?.get<string>('PLATFORM_CALLBACK_BEARER_SECRET') ??
      ''
    ).trim();
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
  }

  private formatCustomerLifecycleMessage(
    action: SubscriptionLifecycleAction,
    installationStatus: string | null,
  ): string {
    if (action === 'grace') {
      return 'Invoice payment past due; your workspace remains active during your billing grace window.';
    }
    if (action === 'suspend' || installationStatus === 'suspended') {
      return 'Service is temporarily suspended due to an overdue invoice. Paying the outstanding invoice restores access automatically.';
    }
    if (action === 'cancel' || installationStatus === 'offboarding' || installationStatus === 'offboarded') {
      return 'Subscription cancelled. Configuration snapshots remain safeguarded inside the 30-day recovery window.';
    }
    return 'Service active and synchronized.';
  }

  async ingestSignedLifecycleCallback(input: {
    rawBody: Buffer | string;
    body: unknown;
    signatureHeader: string | undefined;
    authorizationHeader?: string;
    signingSecret?: string;
    bearerSecret?: string;
    maxSkewSeconds?: number;
    nowSeconds?: number;
  }) {
    this.verifyWebhookSignature(input);

    const validated = validateSubscriptionLifecycleStatusEventV1(input.body);
    if (!validated) {
      throw new BadRequestException('Invalid product.subscription.lifecycle.status.v1 callback payload');
    }

    const lc = validated.lifecycle;
    const incomingUpdatedAt = new Date(lc.updatedAt);

    return this.prisma.$transaction(async (tx: any) => {
      const existingInbox = await tx.platformCallbackInbox.findUnique({
        where: { eventId: validated.eventId },
      });
      if (existingInbox) {
        const currentProjection = await tx.platformProvisioningProjection.findUnique({
          where: { externalOrderId: lc.externalOrderId },
        });
        return {
          deduplicated: true,
          staleIgnored: false,
          projection: currentProjection,
        };
      }

      try {
        await tx.platformCallbackInbox.create({
          data: {
            eventId: validated.eventId,
            correlationId: validated.correlationId,
            operationId: lc.commandId,
            eventType: validated.eventType,
            statusSnapshot: lc.installationStatus ?? lc.action,
            occurredAt: new Date(validated.occurredAt),
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          const currentProjection = await tx.platformProvisioningProjection.findUnique({
            where: { externalOrderId: lc.externalOrderId },
          });
          return { deduplicated: true, staleIgnored: false, projection: currentProjection };
        }
        throw error;
      }

      const existingProjection = await tx.platformProvisioningProjection.findUnique({
        where: { externalOrderId: lc.externalOrderId },
      });

      if (
        existingProjection &&
        existingProjection.platformUpdatedAt.getTime() > incomingUpdatedAt.getTime()
      ) {
        return {
          deduplicated: false,
          staleIgnored: true,
          projection: existingProjection,
        };
      }

      const outbox = await tx.platformProvisioningOutbox?.findUnique?.({
        where: { externalOrderId: lc.externalOrderId },
        select: { id: true, clientId: true, platformOperationId: true },
      });

      const subscription = await tx.subscription?.findUnique?.({
        where: { id: lc.subscriptionId },
        select: { clientId: true, gracePeriodEnd: true },
      });

      const resolvedClientId =
        existingProjection?.clientId ?? subscription?.clientId ?? outbox?.clientId ?? null;
      const customerStatusMessage = this.formatCustomerLifecycleMessage(
        lc.action,
        lc.installationStatus,
      );
      const graceEndsAt = lc.action === 'grace' ? subscription?.gracePeriodEnd ?? null : null;
      const subscriptionStatus =
        lc.installationStatus === 'suspended'
          ? 'SUSPENDED'
          : lc.action === 'grace'
            ? 'PAST_DUE'
            : lc.action === 'cancel'
              ? 'CANCELLED'
              : 'ACTIVE';

      const projection = existingProjection
        ? await tx.platformProvisioningProjection.update({
            where: { id: existingProjection.id },
            data: {
              status: lc.installationStatus ?? existingProjection.status,
              platformTenantId: lc.tenantId ?? existingProjection.platformTenantId,
              installationId: lc.installationId ?? existingProjection.installationId,
              subscriptionStatus,
              graceEndsAt,
              lifecycleReasonCode: lc.reasonCode,
              customerStatusMessage,
              lastEventId: validated.eventId,
              lastCorrelationId: validated.correlationId,
              platformUpdatedAt: incomingUpdatedAt,
            },
          })
        : await tx.platformProvisioningProjection.create({
            data: {
              operationId: outbox?.platformOperationId ?? `lifecycle:${lc.commandId}`,
              outboxId: outbox?.id ?? null,
              clientId: resolvedClientId,
              externalOrderId: lc.externalOrderId,
              status: lc.installationStatus === 'ready' ? 'ready' : lc.action,
              currentStep: null,
              platformTenantId: lc.tenantId,
              installationId: lc.installationId,
              subscriptionStatus,
              graceEndsAt,
              lifecycleReasonCode: lc.reasonCode,
              customerStatusMessage,
              lastEventId: validated.eventId,
              lastCorrelationId: validated.correlationId,
              platformUpdatedAt: incomingUpdatedAt,
            },
          });

      return {
        deduplicated: false,
        staleIgnored: false,
        projection,
      };
    });
  }
}

