import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from '../billing.service';
import { PaystackService } from '../paystack.service';
import { DarajaService } from '../daraja.service';
import { PaymentSettlementService } from '../payment-settlement.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PricingService } from '../../pricing/pricing.service';
import { PricingAuditService } from '../../pricing/pricing-audit.service';
import {
  CANONICAL_CATALOG_PRICES,
  CATALOG_PRODUCT_ALIASES,
  resolveCanonicalProductId,
} from '../../pricing/canonical-catalog';

describe('Canonical Catalog & Alias Synchronization (BillingService + PricingService)', () => {
  let billingService: BillingService;
  let pricingService: PricingService;

  const mockMarketKE = {
    id: 'mkt-ke',
    code: 'KE',
    name: 'Kenya',
    currencyCode: 'KES',
    active: true,
    vatRate: 0.16,
    taxIncludedInPrice: true,
    roundingRule: 'INTEGER',
    currency: { code: 'KES', symbol: 'KSh', decimals: 0, exchangeRateToBase: 129.5 },
    priceBooks: [{ id: 'KE-2026-v1', status: 'active', effectiveFrom: new Date('2026-01-01') }],
  };

  const mockMarketGlobal = {
    id: 'mkt-global',
    code: 'GLOBAL',
    name: 'International',
    currencyCode: 'USD',
    active: true,
    vatRate: 0,
    taxIncludedInPrice: false,
    roundingRule: 'EXACT',
    currency: { code: 'USD', symbol: '$', decimals: 2, exchangeRateToBase: 1.0 },
    priceBooks: [{ id: 'GLOBAL-2026-v1', status: 'active', effectiveFrom: new Date('2026-01-01') }],
  };

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'u-1', ...data })),
    },
    client: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data })),
    },
    plan: {
      findFirst: jest.fn().mockResolvedValue({ id: 'plan-care-ess', name: 'Care Essential', isActive: true }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    invoice: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 'inv-1',
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        currency: data.currency,
        lineItems: data.lineItems,
      })),
    },
    paymentLog: {
      create: jest.fn().mockResolvedValue({ id: 'plog-1' }),
    },
    market: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        where?.code === 'GLOBAL' ? mockMarketGlobal : mockMarketKE,
      ),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
        where?.currencyCode === 'USD' ? mockMarketGlobal : mockMarketKE,
      ),
    },
    priceBook: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
        where?.marketId === 'mkt-global'
          ? { id: 'GLOBAL-2026-v1', marketId: 'mkt-global', version: '2026-v1', status: 'active' }
          : { id: 'KE-2026-v1', marketId: 'mkt-ke', version: '2026-v1', status: 'active' },
      ),
    },
    // Simulate un-reseeded database returning 0 price rows so canonical fallback is exercised!
    price: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    taxRule: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    marketAdjustment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    currency: {
      findUnique: jest.fn().mockResolvedValue({ code: 'KES', exchangeRateToBase: 129.5 }),
    },
    $transaction: jest.fn(async (cb: any) => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const mockPaystack = {
    initializeTransaction: jest.fn().mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/test-session',
      reference: 'ps_ref_sync_1',
    }),
    chargeMpesaStk: jest.fn(),
    verifyTransaction: jest.fn(),
    verifyWebhookSignature: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        PricingService,
        PricingAuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaystackService, useValue: mockPaystack },
        { provide: DarajaService, useValue: {} },
        { provide: PaymentSettlementService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'FRONTEND_URL') return 'https://bazionweb.com';
              return def;
            }),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    billingService = module.get(BillingService);
    pricingService = module.get(PricingService);
  });

  it('reproduces and passes the exact production checkout stack (Launch + .co.ke + Host Business + extra-page x2 = KES 39,000)', async () => {
    const res = await billingService.subscribePaystackGuest({
      planId: 'none',
      billingCycle: 'MONTHLY' as any,
      currency: 'KES',
      email: 'nissimasher2019@gmail.com',
      firstName: 'Nissim',
      lastName: 'Asher',
      extras: [
        { productId: 'website-launch', qty: 1 }, // KES 25,000
        { productId: 'domain-co-ke', qty: 1 },   // KES 1,500
        { productId: 'host-business', qty: 1 },  // KES 8,500
        { productId: 'extra-page', qty: 2 },     // 2 x KES 2,000 = KES 4,000
      ],
    });

    expect(res.status).toBe('REDIRECT_REQUIRED');
    expect(res.chargedCurrency).toBe('KES');
    expect(res.chargedAmount).toBe(39000);

    const createdInvoice = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(createdInvoice.amount).toBe(39000);
    expect(createdInvoice.lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'website-launch', amount: 25000 }),
        expect.objectContaining({ productId: 'domain-co-ke', amount: 1500 }),
        expect.objectContaining({ productId: 'host-business', amount: 8500 }),
        expect.objectContaining({ productId: 'rate-extra-page', quantity: 2, amount: 4000 }),
      ]),
    );
  });

  it('prices every alias and canonical catalog SKU in both KES and USD without throwing "not available in the price book"', async () => {
    const allTestableIds = [
      ...Object.keys(CATALOG_PRODUCT_ALIASES),
      ...Object.keys(CANONICAL_CATALOG_PRICES),
    ];

    for (const currency of ['KES', 'USD'] as const) {
      const extras = allTestableIds.map((productId) => ({ productId, qty: 1 }));
      const res = await billingService.subscribePaystackGuest({
        planId: 'none',
        billingCycle: 'MONTHLY' as any,
        currency,
        email: `all-${currency.toLowerCase()}@example.com`,
        firstName: 'Catalog',
        lastName: 'Auditor',
        extras,
      });

      expect(res.status).toBe('REDIRECT_REQUIRED');
      expect(res.chargedAmount).toBeGreaterThan(0);
    }

    for (const alias of Object.keys(CATALOG_PRODUCT_ALIASES)) {
      const resolved = resolveCanonicalProductId(alias);
      expect(CANONICAL_CATALOG_PRICES[resolved]).toBeDefined();
    }
  });

  it('PricingService.calculateQuote resolves short rate-card IDs, rush-delivery in selectedAddOns, and unseeded SKUs while still rejecting invalid SKUs', async () => {
    const quote = await pricingService.calculateQuote({
      marketCode: 'KE',
      packageType: 'service-admin-hub-starter',
      selectedAddOns: ['extra-page', 'addon-admin-dashboard', 'mpesa-integration', 'rush-delivery'],
      care: 'care-essential',
      hosting: 'host-cloud-monthly',
    });

    // Base 45,000 + extra-page 2,000 + admin-dashboard 25,000 + mpesa 10,000 = 82,000
    // + 35% rush (28,700) = 110,700
    expect(quote.breakdown.subtotalBuild).toBe(82000);
    expect(quote.breakdown.rushDelivery.applied).toBe(true);
    expect(quote.breakdown.rushDelivery.amount).toBe(28700);
    expect(quote.totalPayableNow).toBe(110700);
    expect(quote.breakdown.careMonthly.amount).toBe(5000);
    expect(quote.breakdown.hostingAnnual.amount).toBe(3200);

    await expect(
      pricingService.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        selectedAddOns: ['totally-nonexistent-addon'],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
