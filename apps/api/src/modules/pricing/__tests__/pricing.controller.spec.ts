import { Test, TestingModule } from '@nestjs/testing';
import { PricingController } from '../pricing.controller';
import { PricingService } from '../pricing.service';
import { PricingAuditService } from '../pricing-audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

import { ConfigService } from '@nestjs/config';

describe('PricingController', () => {
  let controller: PricingController;

  const mockPricingService = {
    getActiveMarkets: jest.fn(),
    getCatalog: jest.fn(),
    calculateQuote: jest.fn(),
    upsertPrice: jest.fn(),
    createPriceBook: jest.fn(),
    upsertTaxRule: jest.fn(),
    upsertAdjustment: jest.fn(),
  };

  const mockAuditService = {
    getAuditHistory: jest.fn(),
    logChange: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        { provide: PricingService, useValue: mockPricingService },
        { provide: PricingAuditService, useValue: mockAuditService },
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  it('delegates getMarkets to pricingService', async () => {
    mockPricingService.getActiveMarkets.mockResolvedValue([{ code: 'KE' }, { code: 'GLOBAL' }]);
    const result = await controller.getMarkets();
    expect(result).toHaveLength(2);
    expect(mockPricingService.getActiveMarkets).toHaveBeenCalled();
  });

  it('delegates calculateQuote to pricingService', async () => {
    const quoteDto = { packageType: 'business' as const, marketCode: 'KE' };
    mockPricingService.calculateQuote.mockResolvedValue({ totalPayableNow: 90000 });

    const result = await controller.calculateQuote(quoteDto);
    expect(result.totalPayableNow).toBe(90000);
    expect(mockPricingService.calculateQuote).toHaveBeenCalledWith(quoteDto);
  });

  it('delegates getCatalog to pricingService with default market', async () => {
    mockPricingService.getCatalog.mockResolvedValue({ market: { code: 'KE' } });
    const result = await controller.getCatalog('KE');
    expect(result.market.code).toBe('KE');
    expect(mockPricingService.getCatalog).toHaveBeenCalledWith('KE');
  });
});
