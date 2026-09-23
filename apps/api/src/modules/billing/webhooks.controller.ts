import { 
  Controller, 
  Post, 
  Req, 
  Headers, 
  HttpCode, 
  HttpStatus, 
  UnauthorizedException, 
  Logger 
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { 
  SubscriptionStatus, 
  PaymentStatus, 
  InvoiceStatus, 
  BillingCycle, 
  PaymentProvider,
  PaymentMethodType 
} from '@prisma/client';
import * as crypto from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Webhook signature helpers ─────────────────────────────────────────────
  // Fail CLOSED in production: when a real secret is configured, a missing or
  // invalid signature is rejected. Placeholder/unset secrets log a warning and
  // accept (dev/sandbox only) so local testing is not blocked.

  private isSecretConfigured(secret: string): boolean {
    return !!secret && !secret.toLowerCase().includes('placeholder');
  }

  private signaturesMatch(provided: string, expectedHex: string): boolean {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expectedHex, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private requireValidSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string,
    provider: string,
  ): void {
    if (!this.isSecretConfigured(secret)) {
      this.logger.warn(
        `${provider} webhook secret not configured — accepting unsigned payload (dev/sandbox only)`,
      );
      return;
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signature || !this.signaturesMatch(signature, expected)) {
      this.logger.warn(`${provider} signature verification failed`);
      throw new UnauthorizedException(`Invalid ${provider} webhook signature`);
    }
  }

  private rawBody(req: Request): string {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  /**
   * IntaSend IPN (Instant Payment Notification) Webhook
   */
  @Post('intasend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IntaSend Payment Notification Webhook' })
  async handleIntaSendWebhook(
    @Req() req: Request,
    @Headers('intasend-signature') signature?: string,
  ) {
    const payload = req.body;
    const { 
      invoice_id, 
      state, 
      api_ref: invoiceNumber, 
      value: amount, 
      account, 
      challenge,
      tracking_id
    } = payload;

    // Support IntaSend Webhook Handshake Verification Challenge
    if (challenge) {
      this.logger.log('Responding to IntaSend Webhook Verification Handshake');
      return { challenge };
    }

    const secretKey = process.env.INTASEND_SECRET_KEY || '';

    this.requireValidSignature(this.rawBody(req), signature, secretKey, 'IntaSend');

    this.logger.log(`Received IntaSend webhook: Invoice = ${invoiceNumber || invoice_id}, State = ${state}`);

    const resolvedRef = String(invoice_id || tracking_id || Date.now());
    const idempotencyKey = `INTASEND_EVENT_${resolvedRef}_${state}`;

    // Idempotent lock check
    const existingLog = await this.prisma.paymentLog.findUnique({
      where: { idempotencyKey },
    });

    if (existingLog && existingLog.status === PaymentStatus.SUCCESS) {
      return { status: 'ALREADY_PROCESSED' };
    }

    // Lookup associated invoice
    const invoice = invoiceNumber
      ? await this.prisma.invoice.findUnique({
          where: { invoiceNumber },
          include: { client: true, subscription: true },
        })
      : null;

    if (!invoice) {
      this.logger.warn(`IntaSend Webhook: No matching invoice found for api_ref ${invoiceNumber}`);
      return { status: 'ORPHAN_TRANSACTION_RECORDED' };
    }

    // Amount integrity: never mark PAID on a short payment. Tolerates minor
    // rounding (0.01); a missing amount falls back to the invoice total below.
    const paidAmount = Number(amount);
    const expectedAmount = Number(invoice.amount);
    if (amount !== undefined && amount !== null && amount !== '' && !Number.isNaN(paidAmount) && paidAmount < expectedAmount - 0.01) {
      this.logger.warn(
        `IntaSend Webhook: amount mismatch for ${invoiceNumber} (paid ${paidAmount} < invoiced ${expectedAmount})`,
      );
      return { status: 'AMOUNT_MISMATCH' };
    }

    if (state === 'COMPLETE' || state === 'SUCCESSFUL') {
      await this.prisma.$transaction(async (tx) => {
        // Mark Invoice as PAID
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });

        const now = new Date();
        const nextPeriod = new Date(now);
        nextPeriod.setMonth(nextPeriod.getMonth() + 1);

        // Update or create subscription
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

            await tx.invoice.update({
              where: { id: invoice.id },
              data: { subscriptionId: sub.id },
            });
          }
        }

        // Upsert Payment Log
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
          update: {
            status: PaymentStatus.SUCCESS,
            rawPayload: payload,
          },
        });
      });

      this.logger.log(`Subscription activated for client ${invoice.clientId} via IntaSend`);
    } else if (state === 'FAILED') {
      await this.handlePaymentFailure(invoice, payload, idempotencyKey);
    }

    return { status: 'PROCESSED' };
  }

  /**
   * Wise Webhook (Balance Credits & Bank Wire Transfers)
   */
  @Post('wise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wise Corporate Wire Settlement Webhook' })
  async handleWiseWebhook(
    @Req() req: Request,
    @Headers('x-signature-sha256') signature?: string,
  ) {
    const wiseWebhookSecret = process.env.WISE_WEBHOOK_SECRET || '';

    this.requireValidSignature(this.rawBody(req), signature, wiseWebhookSecret, 'Wise');

    const { event_type, data } = req.body;
    this.logger.log(`Wise Webhook: Event = ${event_type}, Ref = ${data?.payment_reference || data?.resource?.id}`);

    if (event_type === 'balance-account-credit' || event_type === 'transfer.state-change') {
      const paymentRef = data?.payment_reference || data?.reference;
      const creditAmount = Number(data?.amount || data?.resource?.amount || 0);
      const currency = String(data?.currency || data?.resource?.currency || 'USD');

      if (!paymentRef) {
        return { status: 'IGNORED_NO_REFERENCE' };
      }

      const receivingAccount = await this.prisma.wiseReceivingAccount.findFirst({
        where: { paymentReference: paymentRef },
        include: { invoice: true, client: true },
      });

      if (!receivingAccount) {
        this.logger.warn(`No invoice found mapped to Wise payment reference: ${paymentRef}`);
        return { status: 'UNMATCHED_REFERENCE' };
      }

      // Amount integrity: never grant a year of service on a short payment.
      const expectedAmount = Number(receivingAccount.invoice.amount);
      if (creditAmount > 0 && creditAmount < expectedAmount - 0.01) {
        this.logger.warn(
          `Wise Webhook: amount mismatch for ${paymentRef} (credited ${creditAmount} < invoiced ${expectedAmount})`,
        );
        return { status: 'AMOUNT_MISMATCH' };
      }

      // Deterministic key (no Date.now fallback) so redeliveries dedupe.
      const idempotencyKey = `WISE_CREDIT_${paymentRef}_${event_type}_${creditAmount || 'na'}`;

      await this.prisma.$transaction(async (tx) => {
        // Mark Invoice as PAID
        await tx.invoice.update({
          where: { id: receivingAccount.invoiceId },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });

        // Extend corporate subscription for 1 Year
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
              provider: PaymentProvider.WISE,
              providerSubscriptionId: `WISE-${receivingAccount.wiseAccountId}`,
            },
          });
        }

        // Record payment log (upsert: redeliveries dedupe on the unique key)
        await tx.paymentLog.upsert({
          where: { idempotencyKey },
          create: {
            idempotencyKey,
            provider: PaymentProvider.WISE,
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

      this.logger.log(`Corporate B2B wire settled for client ${receivingAccount.clientId}`);
    }

    return { status: 'PROCESSED' };
  }

  /**
   * Graceful Payment Failure & Dunning State Machine
   */
  private async handlePaymentFailure(invoice: any, payload: any, idempotencyKey: string) {
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

        this.logger.warn(
          `Dunning Attempt #${currentAttempts}: Subscription ${invoice.subscriptionId} status set to ${
            isPastGrace ? 'SUSPENDED' : 'PAST_DUE'
          }`,
        );
      }

      await tx.paymentLog.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: PaymentProvider.INTASEND,
          method: PaymentMethodType.CARD,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          status: PaymentStatus.FAILED,
          errorMessage: payload?.failed_reason || 'Card charge declined by gateway',
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          rawPayload: payload,
        },
        update: {
          status: PaymentStatus.FAILED,
          errorMessage: payload?.failed_reason || 'Card charge declined by gateway',
        },
      });
    });
  }
}
