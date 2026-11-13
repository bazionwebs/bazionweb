import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  buildInstallationChangeCommandsForSettledInvoice,
  buildProvisioningRequestsForSettledInvoice,
  type BuiltProvisioningOutboxCommand,
  type SettledClientSource,
  type SettledInvoiceLineSource,
} from './provisioning-request-builder';
import {
  findProvisioningDomainClaims,
  lockProvisioningDomainClaim,
  normalizeProvisioningDomain,
} from './domain-claim-lock';

/**
 * Enqueues provisioning commands atomically inside the active Prisma billing settlement transaction.
 */
@Injectable()
export class PlatformProvisioningOutboxService {
  private readonly logger = new Logger(PlatformProvisioningOutboxService.name);

  async enqueueForSettledInvoice(
    tx: any,
    invoice: SettledInvoiceLineSource & { client?: SettledClientSource | null },
    opts?: { occurredAt?: Date },
  ): Promise<BuiltProvisioningOutboxCommand[]> {
    if (!tx?.platformProvisioningOutbox || typeof tx.platformProvisioningOutbox.upsert !== 'function') {
      throw new Error('PRISMA_TRANSACTION_MISSING_PROVISIONING_OUTBOX');
    }

    let client: SettledClientSource | null = invoice.client ?? null;
    const needsClientHydration =
      !client ||
      !client.id ||
      !client.email ||
      !client.businessName ||
      !client.contactName ||
      (!client.plan && Boolean(client.planId));

    if (needsClientHydration && typeof tx?.client?.findUnique === 'function') {
      const hydrated = await tx.client.findUnique({
        where: { id: invoice.clientId },
        select: {
          id: true,
          businessName: true,
          contactName: true,
          email: true,
          planId: true,
          plan: { select: { id: true, name: true, tier: true } },
        },
      });
      if (hydrated) {
        client = hydrated;
      }
    }

    if (!client) {
      throw new Error(`PROVISIONING_CLIENT_NOT_FOUND:${invoice.clientId}`);
    }

    const commands = buildProvisioningRequestsForSettledInvoice({
      invoice,
      client,
      occurredAt: opts?.occurredAt,
    });
    const changeCommands = buildInstallationChangeCommandsForSettledInvoice({
      invoice,
      client,
      occurredAt: opts?.occurredAt,
    });

    if (commands.length === 0 && changeCommands.length === 0) {
      this.logger.warn(
        `Invoice ${invoice.invoiceNumber ?? invoice.id} has no quote-time Platform catalog binding; no provisioning command was created.`,
      );
    }
    for (const command of commands) {
      const requestedDomain = command.payload.requestedDomain
        ? normalizeProvisioningDomain(command.payload.requestedDomain)
        : null;
      let domainConflict = false;
      if (requestedDomain) {
        await lockProvisioningDomainClaim(tx, requestedDomain);
        const domainClaims = await findProvisioningDomainClaims(
          tx,
          requestedDomain,
          { excludeExternalOrderId: command.payload.order.externalOrderId },
        );
        domainConflict = domainClaims.length > 0;
      }

      await tx.platformProvisioningOutbox.upsert({
        where: {
          invoiceId_lineIndex: {
            invoiceId: invoice.id,
            lineIndex: command.lineIndex,
          },
        },
        update: {},
        create: {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          subscriptionId: invoice.subscriptionId ?? null,
          lineIndex: command.lineIndex,
          schemaVersion: command.payload.schemaVersion,
          eventId: command.eventId,
          correlationId: command.correlationId,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint: command.requestFingerprint,
          externalCustomerId: command.externalCustomerId,
          externalOrderId: command.externalOrderId,
          payload: command.payload,
          ...(domainConflict
            ? {
                status: 'DEAD',
                lastErrorCode: 'PLATFORM_DOMAIN_CLAIM_CONFLICT',
                deadLetteredAt: new Date(),
              }
            : {}),
          nextAttemptAt: new Date(),
        },
      });
    }

    for (const changeCmd of changeCommands) {
      const requestFingerprint = createHash('sha256')
        .update(JSON.stringify(changeCmd.payload))
        .digest('hex');

      await tx.platformProvisioningOutbox.upsert({
        where: {
          invoiceId_lineIndex: {
            invoiceId: invoice.id,
            lineIndex: changeCmd.lineIndex,
          },
        },
        update: {},
        create: {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          subscriptionId: invoice.subscriptionId ?? null,
          lineIndex: changeCmd.lineIndex,
          schemaVersion: changeCmd.payload.schemaVersion,
          eventId: changeCmd.eventId,
          correlationId: changeCmd.correlationId,
          idempotencyKey: changeCmd.idempotencyKey,
          requestFingerprint,
          externalCustomerId: changeCmd.payload.target.externalCustomerId,
          externalOrderId: changeCmd.payload.commercial.externalOrderId,
          payload: changeCmd.payload,
          nextAttemptAt: new Date(),
        },
      });
    }

    this.logger.log(
      `Enqueued ${commands.length} provisioning command(s) and ${changeCommands.length} installation-change command(s) for invoice ${invoice.invoiceNumber ?? invoice.id}`,
    );

    return commands;
  }
}
