import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WiseService } from '../wise.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WiseService (payouts + manual settlement only)', () => {
  let service: WiseService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'WISE_ENVIRONMENT') return 'sandbox';
      if (key === 'WISE_API_TOKEN') return 'test_wise_token';
      if (key === 'WISE_PROFILE_ID') return '1001001';
      if (key === 'BANK_BENEFICIARY') return 'BazionWeb Technologies Ltd';
      if (key === 'BANK_ACCOUNT_NUMBER') return 'TEST123';
      if (key === 'BANK_SWIFT_BIC') return 'TESTBIC';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    mockedAxios.create.mockReturnValue({ get: jest.fn(), post: jest.fn() } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [WiseService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<WiseService>(WiseService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateVirtualBankDetails is gone (410) — use manual settlement', async () => {
    await expect(service.generateVirtualBankDetails('USD')).rejects.toThrow(
      'Wise virtual bank accounts unavailable',
    );
  });

  it('returns manual settlement instructions from env', () => {
    const d = service.getManualSettlementInstructions('USD', 'BW-ABC-12345');
    expect(d.beneficiary).toBe('BazionWeb Technologies Ltd');
    expect(d.accountNumber).toBe('TEST123');
    expect(d.referenceNote).toContain('BW-ABC-12345');
  });
});
