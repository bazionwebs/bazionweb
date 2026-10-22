import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  SubscriptionStatus,
  PaymentStatus,
  InvoiceStatus,
  BillingCycle,
  PaymentProvider,
  PaymentMethodType,
} from '@prisma/client';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from './paystack.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paystack: PaystackService,
  ) {}

  // Exact bytes for HMAC — requires NestFactory rawBody:true (see main.ts).
  private rawBody(req: Request): Buffer | string {
    const raw = (req as any).rawBody;
    if (raw) return raw as Buffer;
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  }

  /**
   * Idempotent subscription activation for Paystack webhooks.
   * Plan resolution order:
   *   1. invoice.subscriptionId -> that subscription's plan (renewal/retry)
   *   2. provider metadata.planId (echoed by Paystack init)
   *   3. the client's assigned plan (Client.planId, set at checkout)
   * Also flips the owning Client to ACTIVE so the portal gate opens.
   */
  private async activatePaidSubscription(
    tx: any,
    invoice: { id: string; clientId: string; subscriptionId: string | null; client: { planId: string } | null },
    opts: { provider: PaymentProvider; providerRef: string; metadataPlanId?: string; metadataBillingCycle?: string },
  ): Promise<void> {
    const now = new Date();

    let planId = opts.metadataPlanId;
    if (!planId && invoice.subscriptionId) {
      const linked = await tx.subscription.findUnique({ where: { id: invoice.subscriptionId }, select: { planId: true } });
      planId = linked?.planId;
    }
    if (!planId) planId = invoice.client?.planId;

    const billingCycle =
      opts.metadataBillingCycle === 'ANNUAL' || opts.metadataBillingCycle === 'MONTHLY'
        ? (opts.metadataBillingCycle as BillingCycle)
        : BillingCycle.MONTHLY;

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

    // Open the client's access — the web gate reads this state.
    await tx.client.update({
      where: { id: invoice.clientId },
      data: { status: 'ACTIVE' },
    }).catch((err: Error) => this.logger.warn(`Client status update failed: ${err.message}`));
  }

  /**
   * Paystack webhook — cards + M-Pesa STK (HMAC-SHA512 over raw body).
   */
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack card + M-Pesa webhook' })
  async handlePaystackWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    const raw = this.rawBody(req);
    this.paystack.verifyWebhookSignature(raw, signature);

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (event?.event !== 'charge.success') return { status: 'IGNORED' };

    const data = event.data ?? {};
    const reference = String(data.reference || '');
    const invoiceNumber = String(data.metadata?.invoiceNumber || '');
    const paidAmount = Number(data.amount) / 100;
    const currency = String(data.currency || 'KES');
    if (!reference) return { status: 'IGNORED_NO_REFERENCE' };

    const idempotencyKey = `PAYSTACK_${reference}`;
    const existing = await this.prisma.paymentLog.findUnique({ where: { idempotencyKey } });
    if (existing && existing.status === PaymentStatus.SUCCESS) return { status: 'ALREADY_PROCESSED' };

    const invoice = invoiceNumber
      ? await this.prisma.invoice.findUnique({ where: { invoiceNumber }, include: { client: true } })
      : null;
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
    if (Number.isFinite(paidAmount) && paidAmount < expected - 0.01) {
      this.logger.warn(`Paystack amount mismatch ${reference}: ${paidAmount} < ${expected}`);
      return { status: 'AMOUNT_MISMATCH' };
    }

    const channel = String(data.channel || data.authorization?.channel || '').toLowerCase();
    const method =
      channel.includes('mobile_money') || channel.includes('mpesa') || channel.includes('momo')
        ? PaymentMethodType.MPESA
        : PaymentMethodType.CARD;

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      await this.activatePaidSubscription(tx, invoice, {
        provider: PaymentProvider.PAYSTACK,
        providerRef: reference,
        metadataPlanId: data.metadata?.planId,
        metadataBillingCycle: data.metadata?.billingCycle,
      });

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.PAYSTACK,
          providerRef: reference,
          method,
          amount: Number.isFinite(paidAmount) ? paidAmount : Number(invoice.amount),
          currency: invoice.currency,
          status: PaymentStatus.SUCCESS,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: event,
        },
        update: { status: PaymentStatus.SUCCESS, rawPayload: event },
      });
    });

    this.logger.log(`Paystack payment processed — invoice ${invoice.invoiceNumber} PAID, subscription activated for client ${invoice.clientId}`);
    return { status: 'PROCESSED' };
  }

  /**
   * Safaricom Daraja Lipa Na M-Pesa STK Push Callback.
   * Dispatched asynchronously when the subscriber enters PIN or cancels.
   */
  @Post('daraja')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Safaricom Daraja Lipa Na M-Pesa STK Callback' })
  async handleDarajaWebhook(@Req() req: Request) {
    const payload = req.body ?? {};
    const stkCallback = payload?.Body?.stkCallback;

    if (!stkCallback) {
      this.logger.warn('Received Daraja callback without stkCallback body');
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    this.logger.log(
      `Daraja callback: checkoutRequestId=${CheckoutRequestID} resultCode=${ResultCode} desc=${ResultDesc}`,
    );

    if (!CheckoutRequestID) {
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const idempotencyKey = `DARAJA_${CheckoutRequestID}`;

    const existingLog = await this.prisma.paymentLog.findUnique({
      where: { idempotencyKey },
      include: { invoice: { include: { client: true } } },
    });

    if (existingLog && existingLog.status === PaymentStatus.SUCCESS) {
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    // ResultCode !== 0 means cancelled, timeout, or insufficient balance
    if (ResultCode !== 0) {
      this.logger.warn(`Daraja payment unsuccessful: ${ResultDesc} (code ${ResultCode})`);
      if (existingLog) {
        await this.prisma.paymentLog.update({
          where: { idempotencyKey },
          data: {
            status: PaymentStatus.FAILED,
            errorMessage: ResultDesc || `Daraja error code ${ResultCode}`,
            rawPayload: payload,
          },
        });
      }
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    // Success (ResultCode === 0): extract metadata items
    const metadataItems: Array<{ Name: string; Value: any }> = CallbackMetadata?.Item || [];
    const getMetaValue = (name: string) => metadataItems.find((i) => i.Name === name)?.Value;

    const receiptNumber = String(getMetaValue('MpesaReceiptNumber') || CheckoutRequestID);
    const paidAmount = Number(getMetaValue('Amount'));

    const invoice = existingLog?.invoice;
    if (!invoice) {
      this.logger.warn(`Daraja orphan: no invoice found for checkoutRequestId ${CheckoutRequestID}`);
      await this.prisma.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.DARAJA,
          providerRef: receiptNumber,
          method: PaymentMethodType.MPESA,
          amount: paidAmount || 0,
          currency: 'KES',
          status: PaymentStatus.FAILED,
          errorMessage: `Orphan Daraja transaction: no invoice linked for ${CheckoutRequestID}`,
          rawPayload: payload,
        },
        update: { rawPayload: payload },
      });
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      await this.activatePaidSubscription(tx, invoice, {
        provider: PaymentProvider.DARAJA,
        providerRef: receiptNumber,
      });

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.DARAJA,
          providerRef: receiptNumber,
          method: PaymentMethodType.MPESA,
          amount: Number.isFinite(paidAmount) ? paidAmount : Number(invoice.amount),
          currency: 'KES',
          status: PaymentStatus.SUCCESS,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: payload,
        },
        update: {
          status: PaymentStatus.SUCCESS,
          providerRef: receiptNumber,
          rawPayload: payload,
        },
      });
    });

    this.logger.log(`Daraja payment verified: Invoice ${invoice.invoiceNumber} PAID, receipt=${receiptNumber}`);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
