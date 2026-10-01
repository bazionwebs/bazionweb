import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PaystackService } from '../paystack.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaystackService (cards + M-Pesa STK primary)', () => {
  let service: PaystackService;
  let mockHttp: any;

  const mockConfig = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test_12345678';
      if (key === 'PAYSTACK_WEBHOOK_SECRET') return 'sk_test_12345678';
      return def;
    }),
  };

  beforeEach(async () => {
    mockHttp = { post: jest.fn(), get: jest.fn() };
    mockedAxios.create.mockReturnValue(mockHttp);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PaystackService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = module.get<PaystackService>(PaystackService);
    jest.clearAllMocks();
  });

  it('initializes with server amount (subunits) and card channel only', async () => {
    mockHttp.post.mockResolvedValueOnce({
      data: {
        status: true,
        data: { authorization_url: 'https://checkout.paystack.com/x', access_code: 'a', reference: 'r1' },
      },
    });

    const r = await service.initializeTransaction({
      email: 'a@b.co',
      amount: 12900,
      currency: 'KES',
      invoiceNumber: 'INV-1',
      callbackUrl: 'https://bazionweb.com/checkout/verify',
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      '/transaction/initialize',
      expect.objectContaining({ amount: 1290000, channels: ['card'] }),
      expect.anything(),
    );
    expect(r.reference).toBe('r1');
  });

  it('rejects non-positive amounts before calling gateway', async () => {
    await expect(
      service.initializeTransaction({
        email: 'a@b.co',
        amount: 0,
        currency: 'KES',
        invoiceNumber: 'INV-1',
        callbackUrl: 'https://x',
      }),
    ).rejects.toThrow();
    expect(mockHttp.post).not.toHaveBeenCalled();
  });

  it('charges M-Pesa STK via /charge with mpesa provider', async () => {
    mockHttp.post.mockResolvedValueOnce({
      data: {
        status: true,
        data: { reference: 'MPESA_INV-1', status: 'pay_offline', display_text: 'Send STK' },
      },
    });

    const r = await service.chargeMpesaStk({
      email: 'a@b.co',
      amount: 5000,
      phone: '0712345678',
      invoiceNumber: 'INV-1',
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      '/charge',
      expect.objectContaining({
        amount: 500000,
        currency: 'KES',
        mobile_money: { phone: '+254712345678', provider: 'mpesa' },
      }),
      expect.anything(),
    );
    expect(r.reference).toBe('MPESA_INV-1');
  });

  it('rejects M-Pesa above Paystack 150k cap before calling gateway', async () => {
    await expect(
      service.chargeMpesaStk({
        email: 'a@b.co',
        amount: 200_000,
        phone: '0712345678',
        invoiceNumber: 'INV-BIG',
      }),
    ).rejects.toThrow();
    expect(mockHttp.post).not.toHaveBeenCalled();
  });
});
