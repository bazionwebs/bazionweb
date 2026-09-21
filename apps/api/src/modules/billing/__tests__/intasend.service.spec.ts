import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { IntaSendService } from '../intasend.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IntaSendService', () => {
  let service: IntaSendService;
  let mockAxiosInstance: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'INTASEND_ENVIRONMENT') return 'sandbox';
      if (key === 'INTASEND_SECRET_KEY') return 'test_secret_key';
      if (key === 'INTASEND_PUBLISHABLE_KEY') return 'test_pub_key';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntaSendService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IntaSendService>(IntaSendService);
    jest.clearAllMocks();
  });

  it('should be defined and return publishable key', () => {
    expect(service).toBeDefined();
    expect(service.getPublishableKey()).toBe('test_pub_key');
  });

  describe('getOrCreateCustomer()', () => {
    it('returns customer id on successful remote call', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { customer_id: 'CUST_12345' },
      });

      const result = await service.getOrCreateCustomer({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '254712345678',
      });

      expect(result).toBe('CUST_12345');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/customers/', {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '254712345678',
      });
    });

    it('falls back to generated customer id when remote call fails', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getOrCreateCustomer({
        email: 'fallback@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
      });

      expect(result).toMatch(/^CUST_/);
    });
  });

  describe('triggerMpesaStkPush()', () => {
    it('formats phone numbers with leading 0 and returns successful STK response', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          invoice: { invoice_id: 'INV_123' },
          tracking_id: 'TRK_999',
          state: 'PENDING',
          customer_message: 'Prompt sent',
        },
      });

      const result = await service.triggerMpesaStkPush({
        phoneNumber: '0712345678',
        amount: 5000,
        currency: 'KES',
        narrative: 'Invoice payment',
        invoiceNumber: 'INV-2025-001',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payment/mpesa-stk-push/',
        expect.objectContaining({
          phone_number: '254712345678',
          amount: 5000,
        }),
      );
      expect(result.invoiceId).toBe('INV_123');
      expect(result.trackingId).toBe('TRK_999');
    });

    it('formats phone numbers starting with 7 or 1', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: 'INV_456', state: 'PENDING' },
      });

      await service.triggerMpesaStkPush({
        phoneNumber: '712345678',
        amount: 2500,
        currency: 'KES',
        narrative: 'Invoice payment',
        invoiceNumber: 'INV-2025-002',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payment/mpesa-stk-push/',
        expect.objectContaining({
          phone_number: '254712345678',
        }),
      );
    });

    it('returns demo fallback in sandbox environment on API error', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { data: { message: 'Safaricom bridge timeout' } },
      });

      const result = await service.triggerMpesaStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        currency: 'KES',
        narrative: 'Test',
        invoiceNumber: 'INV-DEMO',
      });

      expect(result.state).toBe('PENDING');
      expect(result.invoiceId).toMatch(/^DEMO_INV_/);
      expect(result.customerMessage).toContain('Sandbox');
    });

    it('throws HttpException in production environment on API error', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'INTASEND_ENVIRONMENT') return 'production';
        return defaultValue;
      });

      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { data: { message: 'Payment gateway rejected' } },
      });

      await expect(
        service.triggerMpesaStkPush({
          phoneNumber: '254712345678',
          amount: 1000,
          currency: 'KES',
          narrative: 'Test',
          invoiceNumber: 'INV-FAIL',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('createCheckoutSession()', () => {
    it('returns checkout URL on successful response', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          url: 'https://payment.intasend.com/checkout/sess_123',
          signature: 'sig_123',
          id: 'sess_123',
        },
      });

      const result = await service.createCheckoutSession({
        amount: 100,
        currency: 'USD',
        email: 'user@example.com',
        firstName: 'Alex',
        lastName: 'Smith',
        invoiceNumber: 'INV-100',
        redirectUrl: 'https://bazionweb.com/success',
      });

      expect(result.checkoutUrl).toBe('https://payment.intasend.com/checkout/sess_123');
      expect(result.signature).toBe('sig_123');
      expect(result.trackingId).toBe('sess_123');
    });

    it('provides fallback sandbox redirect URL on error', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.createCheckoutSession({
        amount: 49,
        currency: 'USD',
        email: 'user@example.com',
        firstName: 'Alex',
        lastName: 'Smith',
        invoiceNumber: 'INV-101',
        redirectUrl: 'https://bazionweb.com/success',
      });

      expect(result.checkoutUrl).toContain('sandbox.intasend.com/pay');
      expect(result.signature).toBe('sandbox_sig');
    });
  });
});
