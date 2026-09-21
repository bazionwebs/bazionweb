import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WiseService } from '../wise.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WiseService', () => {
  let service: WiseService;
  let mockAxiosInstance: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'WISE_ENVIRONMENT') return 'sandbox';
      if (key === 'WISE_API_TOKEN') return 'test_wise_token';
      if (key === 'WISE_PROFILE_ID') return '1001001';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WiseService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WiseService>(WiseService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateVirtualBankDetails()', () => {
    it('returns matched bank details from remote API if available', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: [{ id: 'borderless-123' }],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'bank-usd-1',
              currency: 'USD',
              accountHolderName: 'BazionWeb Inc',
              active: true,
              details: {
                accountNumber: '1122334455',
                routingNumber: '026073150',
                bic: 'EVBLUS33',
              },
            },
          ],
        });

      const details = await service.generateVirtualBankDetails('USD');

      expect(details.currency).toBe('USD');
      expect(details.accountNumber).toBe('1122334455');
      expect(details.routingNumber).toBe('026073150');
    });

    it('falls back to provisioned USD bank details when API fails', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Wise API down'));

      const details = await service.generateVirtualBankDetails('USD');

      expect(details.currency).toBe('USD');
      expect(details.accountHolderName).toBe('BazionWeb Technologies Ltd');
      expect(details.routingNumber).toBe('026073150');
      expect(details.bankAddress.country).toBe('United States');
    });

    it('returns provisioned EUR bank details when requested', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      const details = await service.generateVirtualBankDetails('EUR');

      expect(details.currency).toBe('EUR');
      expect(details.iban).toBe('BE89370400440532');
      expect(details.bankAddress.country).toBe('Belgium');
    });

    it('returns provisioned GBP bank details when requested', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      const details = await service.generateVirtualBankDetails('GBP');

      expect(details.currency).toBe('GBP');
      expect(details.iban).toContain('GB12TRWI');
      expect(details.routingNumber).toBe('23-14-70');
      expect(details.bankAddress.country).toBe('United Kingdom');
    });
  });
});
