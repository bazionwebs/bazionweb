import { Injectable, Logger, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface PaystackInitParams {
  email: string;
  amount: number; // major units (KES or USD)
  currency: 'KES' | 'USD';
  invoiceNumber: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Paystack — Cards + M-Pesa STK (primary) + international.
 * IntaSend kept as fallback for M-Pesa (>150k, Till/Paybill, outages).
 * Fail-closed: missing secret throws 503, gateway errors throw 502. No demo fallbacks.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://api.paystack.co',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private secret(): string {
    const s = this.config.get<string>('PAYSTACK_SECRET_KEY', '');
    if (!s) {
      throw new ServiceUnavailableException('Paystack is not configured');
    }
    return s;
  }

  webhookSecret(): string {
    // Paystack signs webhooks with the secret key; dedicated webhook secret optional.
    return (
      this.config.get<string>('PAYSTACK_WEBHOOK_SECRET', '') ||
      this.config.get<string>('PAYSTACK_SECRET_KEY', '')
    );
  }

  async initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResult> {
    if (!params.email || !params.email.includes('@')) {
      throw new HttpException('Valid email is required', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new HttpException('Amount must be greater than zero', HttpStatus.BAD_REQUEST);
    }
    if (params.amount > 5_000_000) {
      throw new HttpException('Amount exceeds maximum', HttpStatus.BAD_REQUEST);
    }

    const secret = this.secret();
    const amountInSubunits = Math.round(params.amount * 100);

    try {
      const res = await this.http.post(
        '/transaction/initialize',
        {
          email: params.email,
          amount: amountInSubunits,
          currency: params.currency,
          channels: ['card'], // cards-only: M-Pesa stays on IntaSend
          callback_url: params.callbackUrl,
          metadata: {
            invoiceNumber: params.invoiceNumber,
            customer_type: 'managed_client',
            ...(params.metadata ?? {}),
          },
        },
        { headers: { Authorization: `Bearer ${secret}` } },
      );

      const data = res.data;
      if (!data?.status || !data?.data?.authorization_url || !data?.data?.reference) {
        throw new HttpException(
          data?.message || 'Payment initialization rejected by Paystack',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const msg = err.response?.data?.message || err.message;
      this.logger.error(`Paystack initialize failed for ${params.invoiceNumber}: ${msg}`);
      throw new HttpException(`Card checkout failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  async chargeMpesaStk(params: {
    email: string;
    amount: number; // major units KES
    phone: string;
    invoiceNumber: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ reference: string; status: string; displayText?: string; raw: any }> {
    if (!params.email || !params.email.includes('@')) {
      throw new HttpException('Valid email is required', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new HttpException('Amount must be greater than zero', HttpStatus.BAD_REQUEST);
    }
    // Paystack M-Pesa cap (Safaricom): 150,000 per transaction.
    if (params.amount > 150_000) {
      throw new HttpException(
        'Amount exceeds Paystack M-Pesa limit (KES 150,000) — use bank transfer or split',
        HttpStatus.BAD_REQUEST,
      );
    }

    let phone = params.phone.replace(/[\s-]/g, '');
    if (phone.startsWith('0')) phone = `+254${phone.slice(1)}`;
    else if (phone.startsWith('254')) phone = `+${phone}`;
    else if (/^[17]\d{8}$/.test(phone)) phone = `+254${phone}`;
    if (!/^\+254[17]\d{8}$/.test(phone)) {
      throw new HttpException('Valid Safaricom phone number required', HttpStatus.BAD_REQUEST);
    }

    const secret = this.secret();
    const amountInSubunits = Math.round(params.amount * 100);

    try {
      const res = await this.http.post(
        '/charge',
        {
          email: params.email,
          amount: amountInSubunits,
          currency: 'KES',
          reference: `MPESA_${params.invoiceNumber}`.replace(/[^A-Za-z0-9_=.,-]/g, '-'),
          mobile_money: { phone, provider: 'mpesa' },
          metadata: {
            invoiceNumber: params.invoiceNumber,
            customer_type: 'managed_client',
            ...(params.metadata ?? {}),
          },
        },
        { headers: { Authorization: `Bearer ${secret}` } },
      );

      const data = res.data;
      if (!data?.status || !data?.data?.reference) {
        throw new HttpException(
          data?.message || 'M-Pesa charge rejected by Paystack',
          HttpStatus.BAD_GATEWAY,
        );
      }
      return {
        reference: data.data.reference,
        status: data.data.status, // pay_offline | pending | success
        displayText: data.data.display_text,
        raw: data.data,
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const msg = err.response?.data?.message || err.message;
      this.logger.error(`Paystack M-Pesa charge failed for ${params.invoiceNumber}: ${msg}`);
      throw new HttpException(`M-Pesa charge failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  async verifyTransaction(reference: string): Promise<any> {
    const secret = this.secret();
    try {
      const res = await this.http.get(`/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      throw new HttpException(`Paystack verification failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): void {
    const secret = this.webhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException('Paystack webhook secret not configured');
    }
    if (!signature) {
      throw new HttpException('Missing Paystack signature', HttpStatus.UNAUTHORIZED);
    }
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new HttpException('Invalid Paystack signature', HttpStatus.UNAUTHORIZED);
    }
  }
}
