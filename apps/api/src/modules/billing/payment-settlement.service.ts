import { Injectable, Logger } from '@nestjs/common';
import {
  BillingCycle,
  InvoiceStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { provisionProjectFromProposalInvoice } from '../projects/project-provisioning.util';

export type CheckoutPurpose = 'subscription' | 'invoice_payment';

export interface CheckoutIntent {
  purpose: CheckoutPurpose;
  planId?: string;
  billingCycle?: BillingCycle;
}

export function checkoutLineItem(args: {
  description: string;
  amount: number;
  currency?: string;
  quantity?: number;
  planId?: string;
  productId?: string;
  qty?: number;
  billingCycle?: string;
  purpose?: CheckoutPurpose;
}) {
  return {
    description: args.description,
    amount: args.amount,
    currency: args.currency,
    quantity: args.quantity ?? args.qty ?? 1,
    planId: args.planId,
    productId: args.productId,
    billingCycle: args.billingCycle,
    purpose: args.purpose ?? 'subscription',
  };
}

function invoiceDescription(lineItems: unknown): string | undefined {
  if (!Array.isArray(lineItems)) return undefined;
  const firstItem = lineItems.find((item) => item && typeof item === 'object');
  return typeof firstItem?.description === 'string' ? firstItem.description : undefined;
}

function intentFromLineItems(lineItems: unknown): CheckoutIntent {
  const first = Array.isArray(lineItems) ? (lineItems[0] as Record<string, unknown> | undefined) : undefined;
  const purpose = first?.purpose === 'invoice_payment' ? 'invoice_payment' : 'subscription';
  const cycle = first?.billingCycle === 'ANNUAL' || first?.billingCycle === 'MONTHLY'
    ? (first.billingCycle as BillingCycle)
    : undefined;
  const planId = typeof first?.planId === 'string' && first.planId ? first.planId : undefined;
  return { purpose, planId, billingCycle: cycle };
}

@Injectable()
export class PaymentSettlementService {
  private readonly logger = new Logger(PaymentSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  /**
   * Idempotent subscription activation. Plan is taken from the invoice
   * line-item (server-written at checkout), never from client-editable
   * Paystack metadata as the primary source.
   */
  async activatePaidSubscription(
    tx: any,
    invoice: {
      id: string;
      clientId: string;
      subscriptionId: string | null;
      invoiceNumber?: string;
      amount?: unknown;
      currency?: string;
      paidAt?: Date | null;
      notes?: string | null;
      lineItems?: unknown;
      client: { planId: string } | null;
    },
    opts: {
      provider: PaymentProvider;
      providerRef: string;
      metadataPlanId?: string;
      metadataBillingCycle?: string;
      metadataPurpose?: string;
    },
  ): Promise<void> {
    const intent = intentFromLineItems(invoice.lineItems);
    const purpose = opts.metadataPurpose === 'invoice_payment' ? 'invoice_payment' : intent.purpose;
    if (purpose === 'invoice_payment' && !invoice.subscriptionId) {
      // One-time payment (e.g. a project kickoff deposit): there is no
      // subscription to activate, but a paying client is an active client —
      // flip status so the portal guard unlocks after account claim, and
      // provision the scoped Delivery Roadmap if this is a proposal deposit.
      await tx.client.update({
        where: { id: invoice.clientId },
        data: { status: 'ACTIVE' },
      }).catch((err: Error) => this.logger.warn(`Client status update failed: ${err.message}`));

      await provisionProjectFromProposalInvoice(tx, {
        id: invoice.id,
        clientId: invoice.clientId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount ?? 0,
        currency: invoice.currency ?? 'KES',
        paidAt: invoice.paidAt ?? new Date(),
        notes: invoice.notes,
        lineItems: invoice.lineItems,
      }).catch((err: Error) =>
        this.logger.warn(`Proposal project provisioning failed for invoice ${invoice.id}: ${err.message}`),
      );
      return;
    }

    const now = new Date();
    let planId = intent.planId;
    if (!planId && invoice.subscriptionId) {
      const linked = await tx.subscription.findUnique({
        where: { id: invoice.subscriptionId },
        select: { planId: true },
      });
      planId = linked?.planId;
    }
    if (!planId) planId = opts.metadataPlanId;
    if (!planId) planId = invoice.client?.planId;

    const billingCycle: BillingCycle =
      intent.billingCycle ||
      (opts.metadataBillingCycle === 'ANNUAL' || opts.metadataBillingCycle === 'MONTHLY'
        ? (opts.metadataBillingCycle as BillingCycle)
        : BillingCycle.MONTHLY);

    if (invoice.subscriptionId) {
      await tx.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86_400_000),
          renewalDate: new Date(now.getTime() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86_400_000),
          gracePeriodEnd: null,
          dunningAttemptsCount: 0,
          lastDunningAt: null,
          ...(planId ? { planId } : {}),
        },
      });
    } else if (planId) {
      const existingActive = await tx.subscription.findFirst({
        where: { clientId: invoice.clientId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (existingActive) {
        await tx.subscription.update({
          where: { id: existingActive.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            planId,
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86_400_000),
            renewalDate: new Date(now.getTime() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86_400_000),
            gracePeriodEnd: null,
            dunningAttemptsCount: 0,
            lastDunningAt: null,
            cancelledAt: null,
          },
        });
        await tx.invoice.update({ where: { id: invoice.id }, data: { subscriptionId: existingActive.id } });
      } else {
        const nextPeriod = new Date(now.getTime() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86_400_000);
        const sub = await tx.subscription.create({
          data: {
            clientId: invoice.clientId,
            planId,
            billingCycle,
            status: SubscriptionStatus.ACTIVE,
            startDate: now,
            renewalDate: nextPeriod,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriod,
            provider: opts.provider,
            providerSubscriptionId: opts.providerRef,
          },
        });
        await tx.invoice.update({ where: { id: invoice.id }, data: { subscriptionId: sub.id } });
      }
    }

    await tx.client.update({
      where: { id: invoice.clientId },
      data: { status: 'ACTIVE', ...(planId ? { planId } : {}) },
    }).catch((err: Error) => this.logger.warn(`Client status update failed: ${err.message}`));
  }

  private amountsMatch(paid: number, expected: number, currency: string, invoiceCurrency: string): boolean {
    if (currency && invoiceCurrency && currency.toUpperCase() !== invoiceCurrency.toUpperCase()) {
      return false;
    }
    if (!Number.isFinite(paid) || !Number.isFinite(expected)) return false;
    return paid >= expected - 0.01;
  }

  async settlePaystackCharge(data: Record<string, any>): Promise<{
    status: string;
    invoiceNumber?: string;
    email?: string;
    claimed?: boolean;
    description?: string;
  }> {
    const reference = String(data.reference || '');
    const invoiceNumber = String(data.metadata?.invoiceNumber || '');
    const paidAmount = Number(data.amount) / 100;
    const currency = String(data.currency || 'KES');
    if (!reference) return { status: 'IGNORED_NO_REFERENCE' };

    const idempotencyKey = `PAYSTACK_${reference}`;
    const existing = await this.prisma.paymentLog.findUnique({
      where: { idempotencyKey },
      include: { invoice: { include: { client: { include: { user: true } } } } },
    });
    if (existing?.status === PaymentStatus.SUCCESS) {
      return {
        status: 'ALREADY_PROCESSED',
        invoiceNumber: existing.invoice?.invoiceNumber,
        email: existing.invoice?.client?.email,
        claimed: Boolean(existing.invoice?.client?.user?.passwordHash),
        description: invoiceDescription(existing.invoice?.lineItems),
      };
    }

    let invoice = existing?.invoice ?? null;
    if (!invoice && invoiceNumber) {
      invoice = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
        include: { client: { include: { user: true } } },
      });
    }
    if (!invoice) {
      await this.prisma.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.PAYSTACK,
          providerRef: reference,
          method:
            String(data.channel || '').includes('mobile_money') || String(data.channel || '').includes('mpesa')
              ? PaymentMethodType.MPESA
              : PaymentMethodType.CARD,
          amount: paidAmount || 0,
          currency,
          status: PaymentStatus.FAILED,
          errorMessage: `Orphan: no invoice for Paystack reference ${reference}`,
          clientId: null,
          rawPayload: data,
        },
        update: { rawPayload: data },
      }).catch((err) => {
        this.logger.error(`Failed to persist Paystack orphan log: ${err.message}`, err.stack);
      });
      this.logger.warn(`Paystack orphan recorded for reference ${reference}`);
      return { status: 'ORPHAN_TRANSACTION_RECORDED' };
    }

    const expected = Number(invoice.amount);
    if (!this.amountsMatch(paidAmount, expected, currency, invoice.currency)) {
      this.logger.warn(
        `Paystack amount/currency mismatch ${reference}: ${paidAmount} ${currency} vs ${expected} ${invoice.currency}`,
      );
      await this.prisma.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.PAYSTACK,
          providerRef: reference,
          method: PaymentMethodType.CARD,
          amount: paidAmount || 0,
          currency,
          status: PaymentStatus.FAILED,
          errorMessage: `Amount mismatch: paid ${paidAmount} ${currency}, expected ${expected} ${invoice.currency}`,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: data,
        },
        update: {
          status: PaymentStatus.FAILED,
          errorMessage: `Amount mismatch: paid ${paidAmount} ${currency}, expected ${expected} ${invoice.currency}`,
          rawPayload: data,
        },
      }).catch(() => undefined);
      return { status: 'AMOUNT_MISMATCH' };
    }

    const channel = String(data.channel || data.authorization?.channel || '').toLowerCase();
    const method =
      channel.includes('mobile_money') || channel.includes('mpesa') || channel.includes('momo')
        ? PaymentMethodType.MPESA
        : PaymentMethodType.CARD;

    await this.prisma.$transaction(async (tx) => {
      const again = await tx.paymentLog.findUnique({ where: { idempotencyKey } });
      if (again?.status === PaymentStatus.SUCCESS) return;

      await tx.invoice.update({
        where: { id: invoice!.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      await this.activatePaidSubscription(tx, invoice!, {
        provider: PaymentProvider.PAYSTACK,
        providerRef: reference,
        metadataPlanId: data.metadata?.planId,
        metadataBillingCycle: data.metadata?.billingCycle,
        metadataPurpose: data.metadata?.purpose,
      });

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.PAYSTACK,
          providerRef: reference,
          method,
          amount: Number.isFinite(paidAmount) ? paidAmount : Number(invoice!.amount),
          currency: invoice!.currency,
          status: PaymentStatus.SUCCESS,
          clientId: invoice!.clientId,
          invoiceId: invoice!.id,
          rawPayload: data,
        },
        update: { status: PaymentStatus.SUCCESS, rawPayload: data, invoiceId: invoice!.id, clientId: invoice!.clientId },
      });
    });

    this.logger.log(
      `Paystack payment processed — invoice ${invoice.invoiceNumber} PAID, subscription activated for client ${invoice.clientId}`,
    );
    return {
      status: 'PROCESSED',
      invoiceNumber: invoice.invoiceNumber,
      email: invoice.client?.email,
      claimed: Boolean(invoice.client?.user?.passwordHash),
      description: invoiceDescription(invoice.lineItems),
    };
  }

  /**
   * Return-URL confirmation (Stripe/Paystack recommended pattern):
   * verify the reference against Paystack, then run the same settler as the webhook.
   */
  async confirmPaystackReference(reference: string) {
    const cleaned = String(reference || '').trim();
    if (!cleaned) return { status: 'MISSING_REFERENCE', paid: false };

    const existing = await this.prisma.paymentLog.findUnique({
      where: { idempotencyKey: `PAYSTACK_${cleaned}` },
      include: { invoice: { include: { client: { include: { user: true } } } } },
    });
    if (existing?.status === PaymentStatus.SUCCESS) {
      return {
        status: 'ALREADY_PROCESSED',
        paid: true,
        invoiceNumber: existing.invoice?.invoiceNumber,
        email: existing.invoice?.client?.email,
        claimed: Boolean(existing.invoice?.client?.user?.passwordHash),
        amount: Number(existing.amount),
        currency: existing.currency,
        paidAt: existing.invoice?.paidAt?.toISOString(),
        channel: existing.method === PaymentMethodType.MPESA ? 'mobile_money' : 'card',
        description: invoiceDescription(existing.invoice?.lineItems),
      };
    }

    const verified = await this.paystack.verifyTransaction(cleaned);
    const tx = verified?.data;
    if (!verified?.status || tx?.status !== 'success') {
      return {
        status: String(tx?.status || 'UNVERIFIED').toUpperCase(),
        paid: false,
      };
    }

    const settled = await this.settlePaystackCharge(tx);
    return {
      ...settled,
      paid: settled.status === 'PROCESSED' || settled.status === 'ALREADY_PROCESSED',
      amount: Number(tx.amount) / 100,
      currency: tx.currency,
      paidAt: tx.paid_at,
      channel: tx.channel,
      description: settled.description,
    };
  }

  async paymentStatus(ref: string) {
    const cleaned = String(ref || '').trim();
    if (!cleaned) return { status: 'UNKNOWN' };

    const log = await this.prisma.paymentLog.findFirst({
      where: {
        OR: [
          { idempotencyKey: `PAYSTACK_${cleaned}` },
          { idempotencyKey: `DARAJA_${cleaned}` },
          { providerRef: cleaned },
        ],
      },
      include: { invoice: { select: { invoiceNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!log) return { status: 'UNKNOWN' };
    return {
      status: log.status,
      invoiceNumber: log.invoice?.invoiceNumber,
      invoiceStatus: log.invoice?.status,
    };
  }

  async settleDarajaSuccess(args: {
    checkoutRequestId: string;
    receiptNumber: string;
    paidAmount: number;
    payload: unknown;
  }) {
    const idempotencyKey = `DARAJA_${args.checkoutRequestId}`;
    const existingLog = await this.prisma.paymentLog.findUnique({
      where: { idempotencyKey },
      include: { invoice: { include: { client: true } } },
    });
    if (existingLog?.status === PaymentStatus.SUCCESS) {
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const invoice = existingLog?.invoice;
    if (!invoice) {
      this.logger.warn(`Daraja orphan: no invoice found for checkoutRequestId ${args.checkoutRequestId}`);
      await this.prisma.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.DARAJA,
          providerRef: args.receiptNumber,
          method: PaymentMethodType.MPESA,
          amount: args.paidAmount || 0,
          currency: 'KES',
          status: PaymentStatus.FAILED,
          errorMessage: `Orphan Daraja transaction: no invoice linked for ${args.checkoutRequestId}`,
          rawPayload: args.payload as any,
        },
        update: { rawPayload: args.payload as any },
      });
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const expected = Number(invoice.amount);
    if (Number.isFinite(args.paidAmount) && args.paidAmount < expected - 0.01) {
      this.logger.warn(
        `Daraja amount mismatch ${args.checkoutRequestId}: ${args.paidAmount} < ${expected}`,
      );
      await this.prisma.paymentLog.update({
        where: { idempotencyKey },
        data: {
          status: PaymentStatus.FAILED,
          errorMessage: `Amount mismatch: paid ${args.paidAmount}, expected ${expected}`,
          rawPayload: args.payload as any,
        },
      }).catch(() => undefined);
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      await this.activatePaidSubscription(tx, invoice, {
        provider: PaymentProvider.DARAJA,
        providerRef: args.receiptNumber,
      });

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.DARAJA,
          providerRef: args.receiptNumber,
          method: PaymentMethodType.MPESA,
          amount: Number.isFinite(args.paidAmount) ? args.paidAmount : Number(invoice.amount),
          currency: 'KES',
          status: PaymentStatus.SUCCESS,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: args.payload as any,
        },
        update: {
          status: PaymentStatus.SUCCESS,
          providerRef: args.receiptNumber,
          rawPayload: args.payload as any,
        },
      });
    });

    this.logger.log(`Daraja payment verified: Invoice ${invoice.invoiceNumber} PAID, receipt=${args.receiptNumber}`);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
