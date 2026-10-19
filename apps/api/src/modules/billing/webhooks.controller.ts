import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
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
import * as crypto from 'crypto';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { WiseService } from './wise.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paystack: PaystackService,
    private readonly wise: WiseService,
  ) {}

  // Exact bytes for HMAC — requires NestFactory rawBody:true (see main.ts).
  private rawBody(req: Request): Buffer | string {
    const raw = (req as any).rawBody;
    if (raw) return raw as Buffer;
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  }

  private intaSendSecret(): string {
    const s = this.config.get<string>('INTASEND_SECRET_KEY', '');
    if (!s) throw new ServiceUnavailableException('IntaSend webhook secret not configured');
    return s;
  }

  private requireIntaSendSignature(rawBody: Buffer | string, signature: string | undefined): void {
    const secret = this.intaSendSecret();
    if (!signature) {
      throw new ServiceUnavailableException('Missing IntaSend signature');
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      this.logger.warn('IntaSend signature verification failed');
      throw new ServiceUnavailableException('Invalid IntaSend webhook signature');
    }
  }

  /**
   * IntaSend IPN — M-Pesa STK only.
   */
  @Post('intasend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IntaSend Payment Notification Webhook (M-Pesa)' })
  async handleIntaSendWebhook(
    @Req() req: Request,
    @Headers('intasend-signature') signature?: string,
  ) {
    const payload = req.body ?? {};

    // Handshake must come before verification (IntaSend requirement).
    if (payload.challenge) {
      this.logger.log('Responding to IntaSend Webhook Verification Handshake');
      return { challenge: payload.challenge };
    }

    this.requireIntaSendSignature(this.rawBody(req), signature);

    const {
      invoice_id,
      state,
      api_ref: invoiceNumber,
      value: amount,
      account,
      tracking_id,
    } = payload;

    this.logger.log(`IntaSend webhook: ref=${invoiceNumber || invoice_id} state=${state}`);

    const resolvedRef = String(invoice_id || tracking_id || invoiceNumber || '');
    if (!resolvedRef) return { status: 'IGNORED_NO_REFERENCE' };
    // Key idempotency on provider reference, not on event state transition
    const idempotencyKey = `INTASEND_EVENT_${resolvedRef}`;

    const existingLog = await this.prisma.paymentLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === PaymentStatus.SUCCESS) {
      return { status: 'ALREADY_PROCESSED' };
    }

    const invoice = invoiceNumber
      ? await this.prisma.invoice.findUnique({
          where: { invoiceNumber },
          include: { client: true, subscription: true },
        })
      : null;

    if (!invoice) {
      // Persist orphan for manual reconciliation — never silently drop money.
      // clientId: null avoids foreign key constraint violation against Client table.
      await this.prisma.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.INTASEND,
          providerRef: resolvedRef,
          method: PaymentMethodType.MPESA,
          amount: Number(amount) || 0,
          currency: 'KES',
          status: PaymentStatus.FAILED,
          errorMessage: `Orphan: no invoice for api_ref ${invoiceNumber}`,
          clientId: null,
          rawPayload: payload,
        },
        update: { rawPayload: payload },
      }).catch((err) => {
        this.logger.error(`Failed to persist IntaSend orphan payment log: ${err.message}`, err.stack);
      });
      this.logger.warn(`IntaSend orphan recorded for api_ref ${invoiceNumber}`);
      return { status: 'ORPHAN_TRANSACTION_RECORDED' };
    }

    const paidAmount = Number(amount);
    const expectedAmount = Number(invoice.amount);
    if (
      amount !== undefined &&
      amount !== null &&
      amount !== '' &&
      !Number.isNaN(paidAmount) &&
      paidAmount < expectedAmount - 0.01
    ) {
      this.logger.warn(`IntaSend amount mismatch for ${invoiceNumber}: ${paidAmount} < ${expectedAmount}`);
      return { status: 'AMOUNT_MISMATCH' };
    }

    if (state === 'COMPLETE' || state === 'SUCCESSFUL') {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID, paidAt: new Date() },
        });

        const now = new Date();
        const nextPeriod = new Date(now);
        nextPeriod.setMonth(nextPeriod.getMonth() + 1);

        if (invoice.subscriptionId) {
          await tx.subscription.update({
            where: { id: invoice.subscriptionId },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: now,
              currentPeriodEnd: nextPeriod,
              gracePeriodEnd: null,
              dunningAttemptsCount: 0,
              lastDunningAt: null,
            },
          });
        } else {
          const plan = await tx.plan.findFirst({ where: { isActive: true } });
          if (plan) {
            const sub = await tx.subscription.create({
              data: {
                clientId: invoice.clientId,
                planId: plan.id,
                billingCycle: BillingCycle.MONTHLY,
                status: SubscriptionStatus.ACTIVE,
                startDate: now,
                renewalDate: nextPeriod,
                currentPeriodStart: now,
                currentPeriodEnd: nextPeriod,
                provider: PaymentProvider.INTASEND,
                providerSubscriptionId: resolvedRef,
              },
            });
            await tx.invoice.update({ where: { id: invoice.id }, data: { subscriptionId: sub.id } });
          }
        }

        await tx.paymentLog.upsert({
          where: { idempotencyKey },
          create: {
            idempotencyKey,
            provider: PaymentProvider.INTASEND,
            providerRef: resolvedRef,
            method: account?.startsWith('254') ? PaymentMethodType.MPESA : PaymentMethodType.CARD,
            amount: Number(amount) || Number(invoice.amount),
            currency: invoice.currency,
            status: PaymentStatus.SUCCESS,
            clientId: invoice.clientId,
            invoiceId: invoice.id,
            rawPayload: payload,
          },
          update: { status: PaymentStatus.SUCCESS, rawPayload: payload },
        });
      });
      this.logger.log(`Subscription activated for client ${invoice.clientId} via IntaSend`);
    } else if (state === 'FAILED') {
      await this.handlePaymentFailure(invoice, payload, idempotencyKey, PaymentProvider.INTASEND);
    }

    return { status: 'PROCESSED' };
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

    return { status: 'PROCESSED' };
  }

  /**
   * Wise webhook — payout status only (transfer.state-change).
   * Collections are manual bank transfers reconciled by admin mark-paid.
   */
  @Post('wise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wise payout status webhook' })
  async handleWiseWebhook(
    @Req() req: Request,
    @Headers('x-signature-sha256') signature?: string,
  ) {
    this.wise.verifyWebhookSignature(this.rawBody(req), signature);

    const { event_type, data } = req.body ?? {};
    this.logger.log(`Wise webhook: ${event_type} ref=${data?.payment_reference || data?.resource?.id}`);

    if (event_type !== 'transfer.state-change' && event_type !== 'balance-account-credit') {
      return { status: 'IGNORED' };
    }

    const paymentRef = data?.payment_reference || data?.reference;
    if (!paymentRef) return { status: 'IGNORED_NO_REFERENCE' };

    const receivingAccount = await this.prisma.wiseReceivingAccount.findFirst({
      where: { paymentReference: paymentRef },
      include: { invoice: true, client: true },
    });
    if (!receivingAccount) {
      this.logger.warn(`Wise unmatched reference: ${paymentRef}`);
      return { status: 'UNMATCHED_REFERENCE' };
    }

    const creditAmount = Number(data?.amount || data?.resource?.amount || 0);
    const expectedAmount = Number(receivingAccount.invoice.amount);
    if (creditAmount > 0 && creditAmount < expectedAmount - 0.01) {
      return { status: 'AMOUNT_MISMATCH' };
    }

    const idempotencyKey = `WISE_CREDIT_${paymentRef}_${event_type}_${creditAmount || 'na'}`;
    const currency = String(data?.currency || data?.resource?.currency || receivingAccount.currency);

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: receivingAccount.invoiceId },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      const now = new Date();
      const nextPeriod = new Date(now);
      nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);

      const defaultPlan = await tx.plan.findFirst({ where: { isActive: true } });
      if (defaultPlan) {
        await tx.subscription.create({
          data: {
            clientId: receivingAccount.clientId,
            planId: defaultPlan.id,
            billingCycle: BillingCycle.ANNUAL,
            status: SubscriptionStatus.ACTIVE,
            startDate: now,
            renewalDate: nextPeriod,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriod,
            provider: PaymentProvider.MANUAL_BANK_TRANSFER,
            providerSubscriptionId: `BANK-${paymentRef}`,
          },
        });
      }

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.MANUAL_BANK_TRANSFER,
          providerRef: String(data?.id || data?.resource?.id || paymentRef),
          method: PaymentMethodType.BANK_TRANSFER,
          amount: creditAmount || Number(receivingAccount.invoice.amount),
          currency,
          status: PaymentStatus.SUCCESS,
          clientId: receivingAccount.clientId,
          invoiceId: receivingAccount.invoiceId,
          rawPayload: req.body,
        },
        update: { status: PaymentStatus.SUCCESS, rawPayload: req.body },
      });
    });

    return { status: 'PROCESSED' };
  }

  private async handlePaymentFailure(invoice: any, payload: any, idempotencyKey: string, provider: PaymentProvider) {
    const gracePeriodDays = 3;
    const now = new Date();
    const graceEnd = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      if (invoice.subscriptionId) {
        const sub = await tx.subscription.findUnique({ where: { id: invoice.subscriptionId } });
        const currentAttempts = (sub?.dunningAttemptsCount || 0) + 1;
        const isPastGrace = currentAttempts >= 3;

        await tx.subscription.update({
          where: { id: invoice.subscriptionId },
          data: {
            status: isPastGrace ? SubscriptionStatus.SUSPENDED : SubscriptionStatus.PAST_DUE,
            gracePeriodEnd: isPastGrace ? null : graceEnd,
            dunningAttemptsCount: currentAttempts,
            lastDunningAt: now,
          },
        });
      }

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider,
          method: invoice.currency === 'KES' ? PaymentMethodType.MPESA : PaymentMethodType.CARD,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          status: PaymentStatus.FAILED,
          errorMessage: payload?.failed_reason || 'Charge declined by gateway',
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: payload,
        },
        update: {
          status: PaymentStatus.FAILED,
          errorMessage: payload?.failed_reason || 'Charge declined by gateway',
        },
      });
    });
  }
}
