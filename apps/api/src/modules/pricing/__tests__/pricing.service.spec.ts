import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from '../pricing.service';
import { PricingAuditService } from '../pricing-audit.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PricingService', () => {
  let service: PricingService;

  const mockMarketKE = {
    id: 'market-ke-uuid',
    code: 'KE',
    name: 'Kenya',
    currencyCode: 'KES',
    countryCodes: ['KE'],
    active: true,
    defaultLocale: 'en-KE',
    vatRate: 0.16,
    taxIncludedInPrice: true,
    roundingRule: 'INTEGER',
    currency: { code: 'KES', symbol: 'KSh', decimals: 0, exchangeRateToBase: 129.5 },
  };

  const mockMarketGlobal = {
    id: 'market-global-uuid',
    code: 'GLOBAL',
    name: 'International / Global',
    currencyCode: 'USD',
    countryCodes: [],
    active: true,
    defaultLocale: 'en-US',
    vatRate: 0.0,
    taxIncludedInPrice: false,
    roundingRule: 'EXACT',
    currency: { code: 'USD', symbol: '$', decimals: 2, exchangeRateToBase: 1.0 },
  };

  const mockPriceBookKE = {
    id: 'KE-2026-v1',
    marketId: 'market-ke-uuid',
    name: 'Kenya Price Book 2026 v1',
    version: '2026-v1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveUntil: new Date('2026-12-31'),
    status: 'active',
  };

  const mockPricesKE = [
    { id: 'p1', priceBookId: 'KE-2026-v1', productId: 'website-business', amount: 90000, billingPeriod: 'one-time' },
    { id: 'p2', priceBookId: 'KE-2026-v1', productId: 'rate-extra-page', amount: 2000, billingPeriod: 'one-time' },
    { id: 'p3', priceBookId: 'KE-2026-v1', productId: 'addon-seo-advanced', amount: 25000, billingPeriod: 'one-time' },
    { id: 'p4', priceBookId: 'KE-2026-v1', productId: 'care-business', amount: 12000, billingPeriod: 'month' },
    { id: 'p5', priceBookId: 'KE-2026-v1', productId: 'host-business', amount: 3500, billingPeriod: 'year' },
  ];

  const mockTaxRuleKE = {
    id: 'tr-1',
    marketId: 'market-ke-uuid',
    name: 'KRA Standard VAT (16%)',
    taxType: 'VAT',
    rate: 0.16,
    isInclusive: true,
    active: true,
  };

  const mockAdjustmentKE = {
    id: 'adj-1',
    marketId: 'market-ke-uuid',
    name: 'Kenya SME 10% Discount',
    adjustmentType: 'PERCENTAGE_DISCOUNT',
    value: 10,
    minSpend: 50000,
    maxDiscount: null,
    couponCode: 'SMEKE10',
    active: true,
    effectiveFrom: new Date('2026-01-01'),
    effectiveUntil: null,
  };

  const mockPrisma = {
    market: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    priceBook: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    price: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    taxRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketAdjustment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pricingAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    proposal: { create: jest.fn().mockResolvedValue({ id: 'proposal-1' }) },
    lead: { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        PricingAuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('resolveMarket', () => {
    it('resolves market by country code KE', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(mockMarketKE);
      const result = await service.resolveMarket('KE');
      expect(result.code).toBe('KE');
    });

    it('resolves market by countryCodes array', async () => {
      mockPrisma.market.findUnique.mockResolvedValueOnce(null); // direct match fails
      mockPrisma.market.findFirst.mockResolvedValueOnce(mockMarketKE);
      const result = await service.resolveMarket('KE');
      expect(result.code).toBe('KE');
    });

    it('falls back to GLOBAL for non-KE countries', async () => {
      mockPrisma.market.findUnique.mockResolvedValueOnce(null); // US not direct
      mockPrisma.market.findFirst.mockResolvedValueOnce(null); // US not in array
      mockPrisma.market.findUnique.mockResolvedValueOnce(mockMarketGlobal); // GLOBAL fallback
      const result = await service.resolveMarket('US');
      expect(result.code).toBe('GLOBAL');
    });
    it('falls back to first active market when GLOBAL not found', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(null); // all findUnique calls return null
      mockPrisma.market.findFirst
        .mockResolvedValueOnce(null)   // countryCodes lookup
        .mockResolvedValueOnce(mockMarketKE); // first active fallback
      const result = await service.resolveMarket('XX');
      expect(result.code).toBe('KE');
    });

    it('throws NotFoundException when no active markets exist at all', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(null);
      mockPrisma.market.findFirst.mockResolvedValue(null);
      await expect(service.resolveMarket('XX')).rejects.toThrow('No active commercial markets configured in database.');
    });

    it('returns preferred market when explicitly requested', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(mockMarketGlobal);
      const result = await service.resolveMarket(undefined, 'GLOBAL');
      expect(result.code).toBe('GLOBAL');
    });
  });

  describe('calculateQuote', () => {
    beforeEach(() => {
      mockPrisma.market.findUnique.mockResolvedValue(mockMarketKE);
      mockPrisma.priceBook.findFirst.mockResolvedValue(mockPriceBookKE);
      mockPrisma.price.findMany.mockResolvedValue(mockPricesKE);
      mockPrisma.taxRule.findFirst.mockResolvedValue(mockTaxRuleKE);
      mockPrisma.marketAdjustment.findFirst.mockResolvedValue(null);
    });

    it('persists a server-priced proposal and CRM lead in one transaction', async () => {
      const quote = await service.calculateQuote({
        marketCode: 'KE',
        countryCode: 'KE',
        sourceCountry: 'KE',
        packageType: 'business',
        clientName: 'Amina Client',
        clientEmail: 'AMINA@example.com',
        clientCompany: 'Acacia Ltd',
      });

      expect(quote.proposalId).toBe('proposal-1');
      expect(quote.proposalCode).toMatch(/^BZ-KE-2026-/);
      expect(quote.leadId).toBe('lead-1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.proposal.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ clientEmail: 'amina@example.com', status: 'LOCKED', totalAmount: 90000 }),
      }));
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ email: 'amina@example.com', serviceInterest: 'Website Business' }),
      }));
    });

    it('calculates standard business package quote correctly with tax inclusive', async () => {
      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
      });

      expect(quote.marketCode).toBe('KE');
      expect(quote.currency).toBe('KES');
      expect(quote.breakdown.package.amount).toBe(90000);
      expect(quote.breakdown.subtotalBuild).toBe(90000);
      expect(quote.breakdown.tax.isInclusive).toBe(true);
      expect(quote.breakdown.tax.rate).toBe(0.16);
      // Tax is inclusive: net / (1 + 0.16)
      expect(quote.breakdown.tax.taxAmount).toBe(Math.round(90000 - 90000 / 1.16));
      expect(quote.totalPayableNow).toBe(90000);
    });

    it('adds extra pages and add-ons to build subtotal', async () => {
      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        extraPages: 5, // 5 * 2000 = 10000
        selectedAddOns: ['addon-seo-advanced'], // 25000
      });

      // 90000 + 10000 + 25000 = 125000
      expect(quote.breakdown.subtotalBuild).toBe(125000);
      expect(quote.breakdown.extraPages.amount).toBe(10000);
      expect(quote.breakdown.addOns).toHaveLength(1);
      expect(quote.breakdown.addOns[0].amount).toBe(25000);
      expect(quote.totalPayableNow).toBe(125000);
    });

    it('applies 35% rush delivery surcharge correctly', async () => {
      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        rushDelivery: true,
      });

      // 90000 + (90000 * 0.35) = 90000 + 31500 = 121500
      expect(quote.breakdown.rushDelivery.applied).toBe(true);
      expect(quote.breakdown.rushDelivery.amount).toBe(31500);
      expect(quote.totalPayableNow).toBe(121500);
    });

    it('applies market adjustment coupon discount when minimum spend is met', async () => {
      mockPrisma.marketAdjustment.findFirst.mockResolvedValue(mockAdjustmentKE);

      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business', // 90000 >= 50000 min spend
        couponCode: 'SMEKE10',
      });

      // 10% discount on 90000 = 9000
      expect(quote.breakdown.discounts.couponCode).toBe('SMEKE10');
      expect(quote.breakdown.discounts.amount).toBe(9000);
      expect(quote.breakdown.netBuildAmount).toBe(81000);
      expect(quote.totalPayableNow).toBe(81000);
    });

    it('keeps annual hosting separate from monthly care fees', async () => {
      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        care: 'growth',
        hosting: 'business',
      });

      expect(quote.breakdown.careMonthly.amount).toBe(12000);
      expect(quote.breakdown.hostingAnnual.amount).toBe(3500);
      expect(quote.breakdown.totalMonthlyRecurring).toBe(12000);
    });

    it('applies FIXED_DISCOUNT coupon correctly', async () => {
      const fixedAdj = {
        ...mockAdjustmentKE,
        adjustmentType: 'FIXED_DISCOUNT',
        value: 5000,
        minSpend: 0,
        maxDiscount: null,
        couponCode: 'FLAT5K',
      };
      mockPrisma.marketAdjustment.findFirst.mockResolvedValue(fixedAdj);

      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        couponCode: 'FLAT5K',
      });

      expect(quote.breakdown.discounts.amount).toBe(5000);
      expect(quote.breakdown.netBuildAmount).toBe(85000);
    });

    it('caps discount at maxDiscount when exceeded', async () => {
      const cappedAdj = {
        ...mockAdjustmentKE,
        adjustmentType: 'PERCENTAGE_DISCOUNT',
        value: 50,
        minSpend: 0,
        maxDiscount: 10000,
        couponCode: 'BIG50',
      };
      mockPrisma.marketAdjustment.findFirst.mockResolvedValue(cappedAdj);

      const quote = await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business', // 90000 * 50% = 45000, capped to 10000
        couponCode: 'BIG50',
      });

      expect(quote.breakdown.discounts.amount).toBe(10000);
      expect(quote.breakdown.netBuildAmount).toBe(80000);
    });

    it('calculates exclusive tax (added on top) for non-inclusive markets', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(mockMarketGlobal);
      mockPrisma.taxRule.findFirst.mockResolvedValue({
        id: 'tr-2',
        marketId: 'market-global-uuid',
        name: 'Sales Tax 10%',
        taxType: 'SALES_TAX',
        rate: 0.10,
        isInclusive: false,
        active: true,
      });

      const quote = await service.calculateQuote({
        marketCode: 'GLOBAL',
        packageType: 'business',
      });

      expect(quote.breakdown.tax.isInclusive).toBe(false);
      expect(quote.breakdown.tax.taxAmount).toBe(9000); // 90000 * 0.10
      expect(quote.totalPayableNow).toBe(99000); // 90000 + 9000
    });

    it('throws NotFoundException when no active price book exists', async () => {
      mockPrisma.priceBook.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateQuote({ marketCode: 'KE', packageType: 'business' }),
      ).rejects.toThrow('No active price book found');
    });
  });

  describe('Administrative pricing mutations with audit logging', () => {
    it('creates/updates price and writes to pricing_audit_logs', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(null);
      mockPrisma.price.upsert.mockResolvedValue({
        id: 'new-price-id',
        priceBookId: 'KE-2026-v1',
        productId: 'website-starter',
        amount: 45000,
      });
      mockPrisma.pricingAuditLog.create.mockResolvedValue({ id: 'audit-log-1' });

      await service.upsertPrice(
        'admin-user-uuid',
        {
          priceBookId: 'KE-2026-v1',
          productId: 'website-starter',
          amount: 45000,
          changeReason: 'Q4 Pricing Adjustment',
        },
        { ip: '127.0.0.1' },
      );

      expect(mockPrisma.price.upsert).toHaveBeenCalled();
      expect(mockPrisma.pricingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'PRICE',
          entityId: 'new-price-id',
          action: 'CREATE',
          changedBy: 'admin-user-uuid',
          changeReason: 'Q4 Pricing Adjustment',
          ipAddress: '127.0.0.1',
        }),
      });
    });
  });
});
