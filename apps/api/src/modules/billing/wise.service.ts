import { Injectable, Logger, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface ManualBankDetails {
  beneficiary: string;
  accountNumber?: string;
  iban?: string;
  swiftBic?: string;
  routingNumber?: string;
  bankAddress?: Record<string, string>;
  referenceNote?: string;
}

/**
 * Wise — payouts + invoice links ONLY.
 *
 * Wise business receiving with local account details is NOT available for
 * Kenya-registered businesses (see onboarding availability screen). Do NOT
 * generate virtual USD/EUR/GBP accounts here. Collections use:
 *   KES M-Pesa -> IntaSend, Cards -> Paystack, B2B wire -> manual bank transfer.
 */
@Injectable()
export class WiseService {
  private readonly logger = new Logger(WiseService.name);
  private readonly http: AxiosInstance;
  private readonly profileId: string;

  constructor(private readonly config: ConfigService) {
    const isSandbox = this.config.get<string>('WISE_ENVIRONMENT', 'sandbox') === 'sandbox';
    const baseURL = isSandbox
      ? 'https://api.sandbox.transferwise.tech/v1'
      : 'https://api.wise.com/v1';

    const apiToken = this.config.get<string>('WISE_API_TOKEN', '');
    this.profileId = this.config.get<string>('WISE_PROFILE_ID', '');

    this.http = axios.create({
      baseURL,
      headers: {
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  /**
   * Static B2B settlement instructions from env (no fake accounts).
   * Configure BANK_* in Render / host env. Throws 503 if unconfigured.
   */
  getManualSettlementInstructions(currency: 'USD' | 'EUR' | 'GBP', paymentReference: string): ManualBankDetails {
    const beneficiary = this.config.get<string>('BANK_BENEFICIARY', 'BazionWeb Technologies Ltd');
    const accountNumber = this.config.get<string>('BANK_ACCOUNT_NUMBER', '');
    const iban = this.config.get<string>('BANK_IBAN', '');
    const swiftBic = this.config.get<string>('BANK_SWIFT_BIC', '');
    const line = this.config.get<string>('BANK_ADDRESS_LINE', '');
    const city = this.config.get<string>('BANK_ADDRESS_CITY', '');
    const country = this.config.get<string>('BANK_ADDRESS_COUNTRY', '');

    if (!accountNumber && !iban) {
      throw new ServiceUnavailableException(
        'Bank transfer details not configured — contact billing@bazionweb.com',
      );
    }

    return {
      beneficiary,
      accountNumber: accountNumber || undefined,
      iban: iban || undefined,
      swiftBic: swiftBic || undefined,
      bankAddress:
        line || city || country
          ? { addressFirstLine: line, city, country }
          : undefined,
      referenceNote: `Quote payment reference "${paymentReference}" on your bank remittance advice.`,
    };
  }

  /**
   * @deprecated Wise virtual receiving accounts are unavailable in KE.
   * Always throws — callers must use getManualSettlementInstructions().
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateVirtualBankDetails(_currency: 'USD' | 'EUR' | 'GBP'): Promise<never> {
    throw new HttpException(
      'Wise virtual bank accounts unavailable for KE businesses — use manual bank transfer',
      HttpStatus.GONE,
    );
  }

  /** Optional payout helper (contractor/supplier). Fail-closed, no fallbacks. */
  async createPayout(params: { amount: number; currency: string; recipientId: string; reference: string }) {
    const token = this.config.get<string>('WISE_API_TOKEN', '');
    if (!token || !this.profileId) {
      throw new ServiceUnavailableException('Wise payouts not configured');
    }
    try {
      const res = await this.http.post('/transfers', {
        sourceAccount: this.profileId,
        targetAccount: params.recipientId,
        amount: { value: params.amount, currency: params.currency },
        reference: params.reference,
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      this.logger.error(`Wise payout failed: ${msg}`);
      throw new HttpException(`Wise payout failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): void {
    const secret = this.config.get<string>('WISE_WEBHOOK_SECRET', '');
    if (!secret) {
      throw new ServiceUnavailableException('Wise webhook secret not configured');
    }
    if (!signature) {
      throw new HttpException('Missing Wise signature', HttpStatus.UNAUTHORIZED);
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new HttpException('Invalid Wise signature', HttpStatus.UNAUTHORIZED);
    }
  }
}
