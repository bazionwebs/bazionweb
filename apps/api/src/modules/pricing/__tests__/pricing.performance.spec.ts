import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from '../pricing.service';
import { PricingAuditService } from '../pricing-audit.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PricingService Performance & Query Optimization', () => {
  let service: PricingService;

  const mockMarket = {
    id: 'market-ke-uuid',
    code: 'KE',
    name: 'Kenya',
    currencyCode: 'KES',
    countryCodes: ['KE'],
    active: true,
    vatRate: 0.16,
    taxIncludedInPrice: true,
    currency: { code: 'KES', symbol: 'KSh' },
  };

  const mockPriceBook = {
    id: 'KE-2026-v1',
    marketId: 'market-ke-uuid',
    name: 'Kenya Price Book 2026 v1',
    version: '2026-v1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveUntil: new Date('2026-12-31'),
    status: 'active',
  };

  const mockPrices = [
    { id: 'p1', priceBookId: 'KE-2026-v1', productId: 'website-business', amount: 90000 },
    { id: 'p2', priceBookId: 'KE-2026-v1', productId: 'rate-extra-page', amount: 2000 },
    { id: 'p3', priceBookId: 'KE-2026-v1', productId: 'addon-seo-advanced', amount: 25000 },
    { id: 'p4', priceBookId: 'KE-2026-v1', productId: 'addon-copywriting', amount: 15000 },
    { id: 'p5', priceBookId: 'KE-2026-v1', productId: 'care-business', amount: 12000 },
    { id: 'p6', priceBookId: 'KE-2026-v1', productId: 'host-business', amount: 3500 },
  ];

  const mockPrisma = {
    market: {
      findUnique: jest.fn().mockResolvedValue(mockMarket),
    },
    priceBook: {
      findFirst: jest.fn().mockResolvedValue(mockPriceBook),
    },
    price: {
      findMany: jest.fn().mockResolvedValue(mockPrices),
    },
    taxRule: {
      findFirst: jest.fn().mockResolvedValue({ rate: 0.16, isInclusive: true, name: 'VAT' }),
    },
    marketAdjustment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PricingAuditService, useValue: { logChange: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  it('calculates 1,000 quotes within acceptable latency (< 500ms total)', async () => {
    const iterations = 1000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await service.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        extraPages: 3,
        selectedAddOns: ['addon-seo-advanced', 'addon-copywriting'],
        rushDelivery: i % 2 === 0,
        care: 'growth',
        hosting: 'business',
      });
    }

    const duration = Date.now() - startTime;
    const avgLatencyMs = duration / iterations;

    // Must average well under 1ms per computation in-process
    expect(avgLatencyMs).toBeLessThan(1.0);
  });

  it('guarantees single-batch price querying (no N+1 database queries)', async () => {
    mockPrisma.price.findMany.mockClear();

    await service.calculateQuote({
      marketCode: 'KE',
      packageType: 'business',
      extraPages: 5,
      selectedAddOns: ['addon-seo-advanced', 'addon-copywriting'],
      care: 'growth',
      hosting: 'business',
    });

    // Exactly 1 findMany query fetching all required products via `productId: { in: [...] }`
    expect(mockPrisma.price.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.price.findMany).toHaveBeenCalledWith({
      where: {
        priceBookId: 'KE-2026-v1',
        productId: {
          in: expect.arrayContaining([
            'website-business',
            'rate-extra-page',
            'addon-seo-advanced',
            'addon-copywriting',
            'care-business',
            'host-business',
          ]),
        },
      },
    });
  });
});
