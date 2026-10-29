import { Injectable, Logger, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface DarajaStkPromptParams {
  phone: string;
  amount: number;
  invoiceNumber: string;
  accountReference?: string;
  description?: string;
}

export interface DarajaStkResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface DarajaQueryStatusResult {
  responseCode: string;
  responseDescription: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
}

@Injectable()
export class DarajaService {
  private readonly logger = new Logger(DarajaService.name);
  private readonly http: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: ConfigService) {
    const isProduction = this.config.get<string>('DARAJA_ENVIRONMENT', 'sandbox') === 'production';
    const baseURL = isProduction
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    this.http = axios.create({
      baseURL,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private getCredentials() {
    const consumerKey = this.config.get<string>('DARAJA_CONSUMER_KEY', '');
    const consumerSecret = this.config.get<string>('DARAJA_CONSUMER_SECRET', '');
    const shortCode = this.config.get<string>('DARAJA_BUSINESS_SHORTCODE', '174379');
    const environment = this.config.get<string>('DARAJA_ENVIRONMENT', 'sandbox');
    const sandboxPasskey = 'bfb279f9aa9bdbaca158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const passkey = this.config.get<string>(
      'DARAJA_PASSKEY',
      environment === 'production' ? '' : sandboxPasskey,
    );
    if (!passkey) {
      throw new ServiceUnavailableException('Daraja passkey is not configured');
    }
    const callbackUrl = this.config.get<string>(
      'DARAJA_CALLBACK_URL',
      'https://bazionweb.com/api/v1/webhooks/daraja',
    );

    if (!consumerKey || !consumerSecret) {
      throw new ServiceUnavailableException('Daraja API credentials are not configured');
    }

    return { consumerKey, consumerSecret, shortCode, passkey, callbackUrl };
  }

  /**
   * Formats local Kenyan phone numbers to the strict Safaricom 254XXXXXXXXX standard.
   */
  formatPhoneNumber(raw: string): string {
    let clean = raw.replace(/[\s\-\+]/g, '');
    if (clean.startsWith('0')) {
      clean = `254${clean.slice(1)}`;
    } else if (clean.startsWith('7') || clean.startsWith('1')) {
      clean = `254${clean}`;
    }

    if (!/^254[17]\d{8}$/.test(clean)) {
      throw new HttpException(
        'Invalid Safaricom phone number. Must be a valid Kenyan mobile number (e.g. 0712345678 or 254712345678).',
        HttpStatus.BAD_REQUEST,
      );
    }
    return clean;
  }

  /**
   * Generates a 14-digit timestamp YYYYMMDDHHmmss required for Daraja passwords.
   */
  private generateTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  /**
   * Generates Base64 encoded password: Base64(ShortCode + PassKey + Timestamp)
   */
  private generatePassword(shortCode: string, passkey: string, timestamp: string): string {
    return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
  }

  /**
   * Obtains an OAuth token, with automatic in-memory caching to eliminate latency & avoid rate limits.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const { consumerKey, consumerSecret } = this.getCredentials();
    const authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;

    try {
      const res = await this.http.get('/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: authHeader },
      });

      if (!res.data?.access_token) {
        throw new Error('Safaricom did not return an access token');
      }

      this.cachedToken = res.data.access_token;
      const expiresInSec = Number(res.data.expires_in) || 3599;
      this.tokenExpiresAt = now + expiresInSec * 1000;
      return this.cachedToken;
    } catch (err: any) {
      const msg = err.response?.data?.errorMessage || err.message;
      this.logger.error(`Daraja OAuth token request failed: ${msg}`);
      throw new HttpException(`Failed to authenticate with Safaricom Daraja: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Triggers an instant M-Pesa STK Push PIN prompt to the customer's handset.
   */
  async initiateStkPush(params: DarajaStkPromptParams): Promise<DarajaStkResult> {
    const { shortCode, passkey, callbackUrl } = this.getCredentials();
    const formattedPhone = this.formatPhoneNumber(params.phone);
    const amount = Math.round(params.amount);

    if (amount <= 0) {
      throw new HttpException('Payment amount must be greater than zero KES', HttpStatus.BAD_REQUEST);
    }
    if (amount > 150_000) {
      throw new HttpException(
        'Transaction exceeds the Safaricom M-Pesa single transaction limit of KES 150,000.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const accessToken = await this.getAccessToken();
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(shortCode, passkey, timestamp);

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: (params.accountReference || params.invoiceNumber).slice(0, 12),
      TransactionDesc: (params.description || `Invoice ${params.invoiceNumber}`).slice(0, 128),
    };

    try {
      const res = await this.http.post('/mpesa/stkpush/v1/processrequest', payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = res.data;
      if (data.ResponseCode !== '0') {
        throw new HttpException(
          data.CustomerMessage || data.ResponseDescription || 'M-Pesa STK push rejected by Safaricom',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage || 'Please enter your M-Pesa PIN on your phone to complete payment.',
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const msg = err.response?.data?.errorMessage || err.response?.data?.ResponseDescription || err.message;
      this.logger.error(`Daraja STK push failed for ${params.invoiceNumber}: ${msg}`);
      throw new HttpException(`M-Pesa prompt failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Queries the status of an active STK transaction (used when callbacks are delayed).
   */
  async queryStkStatus(checkoutRequestId: string): Promise<DarajaQueryStatusResult> {
    const { shortCode, passkey } = this.getCredentials();
    const accessToken = await this.getAccessToken();
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(shortCode, passkey, timestamp);

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const res = await this.http.post('/mpesa/stkpushquery/v1/query', payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return {
        responseCode: res.data.ResponseCode,
        responseDescription: res.data.ResponseDescription,
        merchantRequestId: res.data.MerchantRequestID,
        checkoutRequestId: res.data.CheckoutRequestID,
        resultCode: String(res.data.ResultCode),
        resultDesc: res.data.ResultDesc,
      };
    } catch (err: any) {
      const msg = err.response?.data?.errorMessage || err.message;
      this.logger.error(`Daraja query status failed for ${checkoutRequestId}: ${msg}`);
      throw new HttpException(`M-Pesa query failed: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
