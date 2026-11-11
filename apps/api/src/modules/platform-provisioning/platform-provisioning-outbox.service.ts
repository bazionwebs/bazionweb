import { Injectable, Logger } from '@nestjs/common';
import {
  buildProvisioningRequestsForSettledInvoice,
  type BuiltProvisioningOutboxCommand,
  type SettledClientSource,
  type SettledInvoiceLineSource,
} from './provisioning-request-builder';

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

    for (const command of commands) {
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
        },
      });
    }

    this.logger.log(
      `Enqueued ${commands.length} platform provisioning command(s) for invoice ${invoice.invoiceNumber ?? invoice.id}`,
    );

    return commands;
  }
}

