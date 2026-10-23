import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { DarajaService } from '../daraja.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DarajaService (Safaricom M-Pesa STK Push)', () => {
  let service: DarajaService;
  let mockHttp: any;

  const mockConfigValues: Record<string, string> = {
    DARAJA_ENVIRONMENT: 'sandbox',
    DARAJA_CONSUMER_KEY: 'test_consumer_key',
    DARAJA_CONSUMER_SECRET: 'test_consumer_secret',
    DARAJA_BUSINESS_SHORTCODE: '174379',
    DARAJA_PASSKEY: 'bfb279f9aa9bdbaca158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    DARAJA_CALLBACK_URL: 'https://api.bazionweb.com/api/v1/webhooks/daraja',
  };

  const createService = async (configOverrides: Record<string, any> = {}) => {
    mockHttp = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockHttp);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DarajaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key in configOverrides) return configOverrides[key];
              if (key in mockConfigValues) return mockConfigValues[key];
              return def;
            }),
          },
        },
      ],
    }).compile();

    return module.get<DarajaService>(DarajaService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createService();
  });

  describe('Initialization & Configuration', () => {
    it('initializes with sandbox baseURL by default', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://sandbox.safaricom.co.ke',
        }),
      );
    });

    it('initializes with production baseURL when configured', async () => {
      await createService({ DARAJA_ENVIRONMENT: 'production' });
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.safaricom.co.ke',
        }),
      );
    });

    it('throws ServiceUnavailableException when consumer key or secret is missing', async () => {
      const brokenService = await createService({ DARAJA_CONSUMER_KEY: '' });
      await expect(brokenService.getAccessToken()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('formatPhoneNumber', () => {
    it('formats 07... numbers to 2547...', () => {
      expect(service.formatPhoneNumber('0712345678')).toBe('254712345678');
    });

    it('formats 01... numbers to 2541...', () => {
      expect(service.formatPhoneNumber('0112345678')).toBe('254112345678');
    });

    it('formats 7... numbers to 2547...', () => {
      expect(service.formatPhoneNumber('712345678')).toBe('254712345678');
    });

    it('formats 1... numbers to 2541...', () => {
      expect(service.formatPhoneNumber('112345678')).toBe('254112345678');
    });

    it('handles +254 with spaces and dashes', () => {
      expect(service.formatPhoneNumber('+254 712-345 678')).toBe('254712345678');
    });

    it('throws BadRequest HttpException for invalid numbers', () => {
      expect(() => service.formatPhoneNumber('0201234567')).toThrow(HttpException);
      expect(() => service.formatPhoneNumber('12345')).toThrow(HttpException);
      expect(() => service.formatPhoneNumber('254812345678')).toThrow(HttpException);
    });
  });

  describe('getAccessToken', () => {
    it('requests a new OAuth token and caches it', async () => {
      mockHttp.get.mockResolvedValueOnce({
        data: {
          access_token: 'daraja_mock_token_123',
          expires_in: '3599',
        },
      });

      const token1 = await service.getAccessToken();
      expect(token1).toBe('daraja_mock_token_123');
      expect(mockHttp.get).toHaveBeenCalledTimes(1);

      // Second call should return cached token without calling API
      const token2 = await service.getAccessToken();
      expect(token2).toBe('daraja_mock_token_123');
      expect(mockHttp.get).toHaveBeenCalledTimes(1);
    });

    it('throws HttpException when Safaricom token endpoint fails', async () => {
      mockHttp.get.mockRejectedValueOnce({
        response: { data: { errorMessage: 'Invalid Consumer Key' } },
      });

      await expect(service.getAccessToken()).rejects.toThrow(HttpException);
    });

    it('throws HttpException when response has no access_token', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: {} });
      await expect(service.getAccessToken()).rejects.toThrow(HttpException);
    });
  });

  describe('initiateStkPush', () => {
    beforeEach(() => {
      mockHttp.get.mockResolvedValue({
        data: { access_token: 'valid_token', expires_in: '3599' },
      });
    });

    it('successfully initiates STK push and returns formatted response', async () => {
      mockHttp.post.mockResolvedValueOnce({
        data: {
          MerchantRequestID: '29115-34620561-1',
          CheckoutRequestID: 'ws_CO_19122023102450364712345678',
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing',
        },
      });

      const res = await service.initiateStkPush({
        phone: '0712345678',
        amount: 2500,
        invoiceNumber: 'INV-2025-001',
      });

      expect(res.merchantRequestId).toBe('29115-34620561-1');
      expect(res.checkoutRequestId).toBe('ws_CO_19122023102450364712345678');
      expect(res.responseCode).toBe('0');
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/mpesa/stkpush/v1/processrequest',
        expect.objectContaining({
          BusinessShortCode: '174379',
          Amount: 2500,
          PhoneNumber: '254712345678',
          PartyA: '254712345678',
          AccountReference: 'INV-2025-001',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid_token' },
        }),
      );
    });

    it('rejects amount <= 0', async () => {
      await expect(
        service.initiateStkPush({
          phone: '0712345678',
          amount: 0,
          invoiceNumber: 'INV-0',
        }),
      ).rejects.toThrow(HttpException);
      expect(mockHttp.post).not.toHaveBeenCalled();
    });

    it('rejects amount > 150,000 KES', async () => {
      await expect(
        service.initiateStkPush({
          phone: '0712345678',
          amount: 150001,
          invoiceNumber: 'INV-BIG',
        }),
      ).rejects.toThrow(HttpException);
      expect(mockHttp.post).not.toHaveBeenCalled();
    });

    it('throws HttpException if Safaricom returns non-zero ResponseCode', async () => {
      mockHttp.post.mockResolvedValueOnce({
        data: {
          ResponseCode: '1',
          ResponseDescription: 'The shortcode is inactive',
        },
      });

      await expect(
        service.initiateStkPush({
          phone: '0712345678',
          amount: 1000,
          invoiceNumber: 'INV-ERR',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('handles Safaricom HTTP error', async () => {
      mockHttp.post.mockRejectedValueOnce({
        response: { data: { errorMessage: 'Internal error' } },
      });

      await expect(
        service.initiateStkPush({
          phone: '0712345678',
          amount: 1000,
          invoiceNumber: 'INV-HTTP-ERR',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('queryStkStatus', () => {
    beforeEach(() => {
      mockHttp.get.mockResolvedValue({
        data: { access_token: 'valid_token', expires_in: '3599' },
      });
    });

    it('successfully queries STK status', async () => {
      mockHttp.post.mockResolvedValueOnce({
        data: {
          ResponseCode: '0',
          ResponseDescription: 'The service request has been accepted successfully',
          MerchantRequestID: '29115-34620561-1',
          CheckoutRequestID: 'ws_CO_123',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
        },
      });

      const res = await service.queryStkStatus('ws_CO_123');

      expect(res.checkoutRequestId).toBe('ws_CO_123');
      expect(res.resultCode).toBe('0');
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/mpesa/stkpushquery/v1/query',
        expect.objectContaining({
          CheckoutRequestID: 'ws_CO_123',
          BusinessShortCode: '174379',
        }),
        expect.anything(),
      );
    });

    it('handles query STK push failure', async () => {
      mockHttp.post.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(service.queryStkStatus('ws_CO_TIMEOUT')).rejects.toThrow(HttpException);
    });
  });
});
