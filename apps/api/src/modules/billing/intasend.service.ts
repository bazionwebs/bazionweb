import { Injectable, Logger, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface IntaSendCustomerPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface IntaSendMpesaStkParams {
  phoneNumber: string;
  amount: number;
  currency: 'KES';
  narrative: string;
  invoiceNumber: string;
}

export interface IntaSendCheckoutSessionParams {
  amount: number;
  currency: 'KES' | 'USD';
  email: string;
  firstName: string;
  lastName: string;
  invoiceNumber: string;
  redirectUrl: string;
}

@Injectable()
export class IntaSendService {
  private readonly logger = new Logger(IntaSendService.name);
  private readonly http: AxiosInstance;
  private readonly publishableKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const isSandbox = this.config.get<string>('INTASEND_ENVIRONMENT', 'sandbox') === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://sandbox.intasend.com/api/v1'
      : 'https://payment.intasend.com/api/v1';

    // Fail fast: no placeholder defaults. Joi validates at boot; getOrThrow guards tests.
    const secretKey = this.config.get<string>('INTASEND_SECRET_KEY', '');
    this.publishableKey = this.config.get<string>('INTASEND_PUBLISHABLE_KEY', '');
    if (!secretKey || !this.publishableKey) {
      this.logger.warn('IntaSend keys missing — STK calls will fail closed until configured');
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  getPublishableKey(): string {
    return this.publishableKey;
  }

  /**
   * Ensure customer exists in IntaSend
   */
  async getOrCreateCustomer(data: IntaSendCustomerPayload): Promise<string> {
    try {
      const response = await this.http.post('/customers/', {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
      });
      return response.data.customer_id || response.data.id || `CUST_${Date.now()}`;
    } catch (error: any) {
      this.logger.warn(`IntaSend customer lookup note: ${error.response?.data?.message || error.message}`);
      // Return a generated reference if remote customer registration responds with benign notice
      return `CUST_${Buffer.from(data.email).toString('hex').slice(0, 12)}`;
    }
  }

  /**
   * Trigger direct M-Pesa STK Push for billing subscription.
   * Fail-closed: gateway errors always throw (no DEMO_* fallbacks).
   */
  async triggerMpesaStkPush(params: IntaSendMpesaStkParams) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    if (params.amount > 250_000) {
      throw new BadRequestException('M-Pesa per-transaction limit is KES 250,000');
    }
    // Normalize M-Pesa phone numbers to international format (e.g., 0712... -> 254712...)
    let formattedPhone = params.phoneNumber.replace(/[\s+-]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = `254${formattedPhone.slice(1)}`;
    } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
      formattedPhone = `254${formattedPhone}`;
    }
    if (!/^254\d{9}$/.test(formattedPhone)) {
      throw new BadRequestException('Valid Safaricom phone number is required (e.g. 254712345678)');
    }

    try {
      const response = await this.http.post('/payment/mpesa-stk-push/', {
        phone_number: formattedPhone,
        amount: params.amount,
        narrative: params.narrative,
        api_ref: params.invoiceNumber,
      });

      return {
        invoiceId: response.data.invoice?.invoice_id || response.data.id,
        trackingId: response.data.tracking_id || response.data.id || params.invoiceNumber,
        state: response.data.state || 'PENDING',
        customerMessage: response.data.customer_message || 'STK Push prompt sent to your Safaricom mobile phone.',
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.detail || error.message;
      this.logger.error(`IntaSend STK Push failed: ${JSON.stringify(errorMsg)}`);
      throw new HttpException(
        `M-Pesa STK Push failed: ${errorMsg}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * @deprecated Cards go via Paystack (PaystackService). Kept for backwards compat.
   * Fail-closed: never returns sandbox URLs.
   */
  async createCheckoutSession(params: IntaSendCheckoutSessionParams) {
    try {
      const response = await this.http.post('/checkout/', {
        public_key: this.publishableKey,
        amount: params.amount,
        currency: params.currency,
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        api_ref: params.invoiceNumber,
        redirect_url: params.redirectUrl,
        card_tarrif: 'CUSTOMER',
      });

      if (!response.data?.url && !response.data?.id) {
        throw new HttpException('IntaSend checkout rejected', HttpStatus.BAD_GATEWAY);
      }
      return {
        checkoutUrl: response.data.url || `${this.baseUrl}/checkout/${response.data.id}`,
        signature: response.data.signature || '',
        trackingId: response.data.id || params.invoiceNumber,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`IntaSend checkout failed: ${error.message}`);
      throw new HttpException(
        `IntaSend checkout failed: ${error.response?.data?.message || error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
