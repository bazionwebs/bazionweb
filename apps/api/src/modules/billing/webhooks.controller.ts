import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { DarajaService } from './daraja.service';
import { PaymentSettlementService } from './payment-settlement.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly settlement: PaymentSettlementService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly daraja?: DarajaService,
  ) {}

  private verifyDarajaToken(req: Request): boolean {
    const secret = (this.config?.get<string>('DARAJA_WEBHOOK_SECRET', '') || '').trim();
    if (!secret || secret.includes('CHANGE_ME')) {
      return false;
    }
    const supplied = String(
      (req.query as Record<string, unknown> | undefined)?.token ||
      req.headers?.['x-daraja-webhook-secret'] ||
      '',
    ).trim();
    if (!supplied) {
      throw new UnauthorizedException('Missing Daraja callback verification token');
    }
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Daraja callback verification token');
    }
    return true;
  }

  // Exact bytes for HMAC — requires NestFactory rawBody:true (see main.ts).
  private rawBody(req: Request): Buffer | string {
    const raw = (req as any).rawBody;
    if (raw) return raw as Buffer;
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  }

  /**
   * Paystack webhook — cards + M-Pesa STK (HMAC-SHA512 over raw body).
   * Fulfillment is delegated to PaymentSettlementService so the return-URL
   * verifier uses the exact same idempotent path.
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

    return this.settlement.settlePaystackCharge(event.data ?? {});
  }

  /**
   * Safaricom Daraja Lipa Na M-Pesa STK Push Callback.
   * Only a PaymentLog created at STK init can be settled (unsigned callbacks
   * cannot invent an invoice). Amount is checked against that invoice.
   */
  @Post('daraja')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Safaricom Daraja Lipa Na M-Pesa STK Callback' })
  async handleDarajaWebhook(@Req() req: Request) {
    const tokenVerified = this.verifyDarajaToken(req);
    const darajaActive = Boolean(this.daraja?.isConfigured?.());
    if (!tokenVerified && !darajaActive) {
      throw new UnauthorizedException('Daraja callback verification is not configured');
    }

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
    });

    if (existingLog && existingLog.status === PaymentStatus.SUCCESS) {
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

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

    // Safaricom Daraja STK callbacks carry no asymmetric signature: verify
    // payment finality directly against Safaricom's STK Query API whenever
    // Daraja credentials are active before settling any invoice.
    if (darajaActive && this.daraja) {
      const upstream = await this.daraja.queryStkStatus(CheckoutRequestID);
      if (String(upstream.resultCode) !== '0') {
        this.logger.warn(
          `Daraja callback rejected by upstream STK query for ${CheckoutRequestID}: resultCode=${upstream.resultCode}`,
        );
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }
    }

    const metadataItems: Array<{ Name: string; Value: any }> = CallbackMetadata?.Item || [];
    const getMetaValue = (name: string) => metadataItems.find((i) => i.Name === name)?.Value;
    const receiptNumber = String(getMetaValue('MpesaReceiptNumber') || CheckoutRequestID);
    const rawAmount = getMetaValue('Amount');
    const paidAmount = rawAmount === undefined || rawAmount === null || rawAmount === '' ? NaN : Number(rawAmount);

    return this.settlement.settleDarajaSuccess({
      checkoutRequestId: CheckoutRequestID,
      receiptNumber,
      paidAmount,
      payload,
    });
  }
}
