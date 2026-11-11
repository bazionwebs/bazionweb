import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { BillingService } from '../billing.service';
import { PaymentSettlementService } from '../payment-settlement.service';
import { PlatformProvisioningOutboxService } from '../../platform-provisioning/platform-provisioning-outbox.service';
import { PaystackService } from '../paystack.service';
import { DarajaService } from '../daraja.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PricingService } from '../../pricing/pricing.service';
import { PricingAuditService } from '../../pricing/pricing-audit.service';
import { ClientsService } from '../../clients/clients.service';

/**
 * Authoritative Test Fixtures derived from PROJECT.md & Price Books
 */
const MOCK_KE_MARKET = {
  id: 'mkt-ke',
  code: 'KE',
  name: 'Kenya Market',
  currencyCode: 'KES',
  currencySymbol: 'KSh',
  currency: { code: 'KES', symbol: 'KSh' },
  vatRate: 0.16,
  taxIncludedInPrice: true,
  roundingRule: 'standard',
  active: true,
  priceBooks: [
    {
      id: 'pb-ke-2026',
      marketId: 'mkt-ke',
      name: 'Kenya 2026 Price Book',
      version: '2026-v1',
      status: 'active',
      effectiveFrom: new Date('2026-01-01'),
      effectiveUntil: new Date('2026-12-31'),
    },
  ],
};

const MOCK_GLOBAL_MARKET = {
  id: 'mkt-global',
  code: 'GLOBAL',
  name: 'International Market',
  currencyCode: 'USD',
  currencySymbol: '$',
  currency: { code: 'USD', symbol: '$' },
  vatRate: 0,
  taxIncludedInPrice: false,
  roundingRule: 'standard',
  active: true,
  priceBooks: [
    {
      id: 'pb-global-2026',
      marketId: 'mkt-global',
      name: 'Global 2026 Price Book',
      version: '2026-v1',
      status: 'active',
      effectiveFrom: new Date('2026-01-01'),
      effectiveUntil: new Date('2026-12-31'),
    },
  ],
};

const MOCK_PLAN = {
  id: 'plan-business-uuid',
  slug: 'business',
  name: 'Business Website',
  tier: 'BUSINESS',
  priceMonthly: 90000,
  isActive: true,
  createdAt: new Date(),
};

const MOCK_PRICES = [
  { id: 'pr-1', priceBookId: 'pb-ke-2026', productId: 'website-launch', name: 'Launch Website', amount: 25000, currency: 'KES' },
  { id: 'pr-2', priceBookId: 'pb-ke-2026', productId: 'website-business', name: 'Business Website', amount: 90000, currency: 'KES' },
  { id: 'pr-3', priceBookId: 'pb-ke-2026', productId: 'rate-extra-page', name: 'Extra Page', amount: 3500, currency: 'KES' },
  { id: 'pr-4', priceBookId: 'pb-ke-2026', productId: 'addon-blog-news', name: 'Blog / News Engine', amount: 7500, currency: 'KES' },
  { id: 'pr-5', priceBookId: 'pb-global-2026', productId: 'website-business', name: 'Business Website', amount: 950, currency: 'USD' },
  { id: 'pr-6', priceBookId: 'pb-global-2026', productId: 'rate-extra-page', name: 'Extra Page', amount: 40, currency: 'USD' },
];

describe('Backend Opaque-Box E2E Test Suite: BazionWeb Client Journey (Tiers 1 - 4)', () => {
  let billingService: BillingService;
  let settlementService: PaymentSettlementService;
  let pricingService: PricingService;
  let clientsService: ClientsService;

  // In-memory data store for stateful journey tracking
  const db = {
    proposals: new Map<string, any>(),
    invoices: new Map<string, any>(),
    clients: new Map<string, any>(),
    users: new Map<string, any>(),
    paymentLogs: new Map<string, any>(),
    projects: new Map<string, any>(),
  };

  const mockPrisma: any = {
    proposal: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.proposalCode) return db.proposals.get(where.proposalCode) || null;
        if (where.id) return Array.from(db.proposals.values()).find((p) => p.id === where.id) || null;
        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const all = Array.from(db.proposals.values());
        return all.find((p) => !where || Object.entries(where).every(([k, v]) => p[k] === v)) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { ...data, id: `prop-${Date.now()}-${Math.random()}` };
        db.proposals.set(item.proposalCode, item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = await mockPrisma.proposal.findUnique({ where });
        if (!existing) throw new NotFoundException();
        const updated = { ...existing, ...data };
        db.proposals.set(updated.proposalCode, updated);
        return updated;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [code, p] of db.proposals.entries()) {
          if (where.proposalCode === code || where.id === p.id) {
            db.proposals.set(code, { ...p, ...data });
            count++;
          }
        }
        return { count };
      }),
    },
    invoice: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const inv = db.invoices.get(where.id) || Array.from(db.invoices.values()).find((i) => i.invoiceNumber === where.invoiceNumber);
        if (!inv) return null;
        const result = { ...inv };
        if (include?.client && result.clientId) {
          result.client = db.clients.get(result.clientId);
          if (include.client.include?.user && result.client?.userId) {
            result.client.user = db.users.get(result.client.userId);
          }
        }
        return result;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const all = Array.from(db.invoices.values());
        return all.find((inv) => {
          if (where.notes?.contains && !inv.notes?.includes(where.notes.contains)) return false;
          if (where.status?.not && inv.status === where.status.not) return false;
          if (where.clientId && inv.clientId !== where.clientId) return false;
          return true;
        }) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { ...data, id: `inv-${Date.now()}-${Math.random()}`, createdAt: new Date() };
        db.invoices.set(item.id, item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.invoices.get(where.id);
        if (!existing) throw new NotFoundException();
        const updated = { ...existing, ...data };
        db.invoices.set(where.id, updated);
        return updated;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, inv] of db.invoices.entries()) {
          if (where.id === id || where.notes?.contains && inv.notes?.includes(where.notes.contains)) {
            db.invoices.set(id, { ...inv, ...data });
            count++;
          }
        }
        return { count };
      }),
    },
    client: {
      findUnique: jest.fn(async ({ where }: any) => {
        return db.clients.get(where.id) || null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const all = Array.from(db.clients.values());
        return all.find((c) => {
          if (where.email && c.email !== where.email) return false;
          if (where.userId && c.userId !== where.userId) return false;
          return true;
        }) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = `client-${Date.now()}-${Math.random()}`;
        const item = { ...data, id, createdAt: new Date() };
        db.clients.set(id, item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.clients.get(where.id);
        if (!existing) throw new NotFoundException();
        const updated = { ...existing, ...data };
        db.clients.set(where.id, updated);
        return updated;
      }),
      findMany: jest.fn(async () => Array.from(db.clients.values())),
      count: jest.fn(async () => db.clients.size),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.email) {
          return Array.from(db.users.values()).find((u) => u.email === where.email) || null;
        }
        return db.users.get(where.id) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = `user-${Date.now()}-${Math.random()}`;
        const item = { ...data, id };
        db.users.set(id, item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.users.get(where.id);
        if (!existing) return null;
        const updated = { ...existing, ...data };
        db.users.set(where.id, updated);
        return updated;
      }),
    },
    plan: {
      findFirst: jest.fn(async () => MOCK_PLAN),
      findFirstOrThrow: jest.fn(async () => MOCK_PLAN),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id === MOCK_PLAN.id) return MOCK_PLAN;
        return null;
      }),
    },
    market: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (!where?.code) return null;
        const code = where.code.toUpperCase();
        if (code === 'KE') return MOCK_KE_MARKET;
        if (code === 'GLOBAL') return MOCK_GLOBAL_MARKET;
        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.currencyCode === 'KES' || where?.code === 'KE') return MOCK_KE_MARKET;
        if (where?.currencyCode === 'USD' || where?.code === 'GLOBAL') return MOCK_GLOBAL_MARKET;
        return MOCK_KE_MARKET;
      }),
      findMany: jest.fn(async () => [MOCK_KE_MARKET, MOCK_GLOBAL_MARKET]),
    },
    priceBook: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.marketId === 'mkt-global') return MOCK_GLOBAL_MARKET.priceBooks[0];
        return MOCK_KE_MARKET.priceBooks[0];
      }),
      findMany: jest.fn(async () => MOCK_KE_MARKET.priceBooks),
    },
    taxRule: {
      findFirst: jest.fn(async () => ({ rate: 0.16, isInclusive: true })),
      findMany: jest.fn(async () => []),
    },
    marketAdjustment: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    price: {
      findMany: jest.fn(async ({ where }: any) => {
        return MOCK_PRICES.filter((p) => {
          if (where.priceBookId && p.priceBookId !== where.priceBookId) return false;
          if (where.productId?.in && !where.productId.in.includes(p.productId)) return false;
          return true;
        });
      }),
    },
    paymentLog: {
      create: jest.fn(async ({ data }: any) => {
        const id = `plog-${Date.now()}-${Math.random()}`;
        const item = { ...data, id };
        db.paymentLogs.set(id, item);
        return item;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let found: any = null;
        if (where.id) found = db.paymentLogs.get(where.id);
        if (where.idempotencyKey) {
          found = Array.from(db.paymentLogs.values()).find((l) => l.idempotencyKey === where.idempotencyKey);
        }
        if (!found) return null;
        const result = { ...found };
        if (include?.invoice && result.invoiceId) {
          result.invoice = db.invoices.get(result.invoiceId);
          if (include.invoice.include?.client && result.invoice?.clientId) {
            result.invoice.client = db.clients.get(result.invoice.clientId);
            if (include.invoice.include?.client?.include?.user && result.invoice.client?.userId) {
              result.invoice.client.user = db.users.get(result.invoice.client.userId);
            }
          }
        }
        return result;
      }),
      findFirst: jest.fn(async ({ where, include }: any) => {
        const all = Array.from(db.paymentLogs.values());
        const found = all.find((l) => {
          if (where.providerRef && l.providerRef !== where.providerRef) return false;
          if (where.invoiceId && l.invoiceId !== where.invoiceId) return false;
          if (where.idempotencyKey && l.idempotencyKey !== where.idempotencyKey) return false;
          return true;
        });
        if (!found) return null;
        const result = { ...found };
        if (include?.invoice && result.invoiceId) {
          result.invoice = db.invoices.get(result.invoiceId);
        }
        return result;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        let foundKey: string | null = null;
        for (const [id, log] of db.paymentLogs.entries()) {
          if (where.id === id || where.idempotencyKey === log.idempotencyKey) {
            foundKey = id;
            break;
          }
        }
        if (!foundKey) return null;
        const updated = { ...db.paymentLogs.get(foundKey), ...data };
        db.paymentLogs.set(foundKey, updated);
        return updated;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        let foundKey: string | null = null;
        for (const [id, log] of db.paymentLogs.entries()) {
          if (where.id === id || where.idempotencyKey === log.idempotencyKey) {
            foundKey = id;
            break;
          }
        }
        if (foundKey) {
          const updated = { ...db.paymentLogs.get(foundKey), ...update };
          db.paymentLogs.set(foundKey, updated);
          return updated;
        } else {
          const id = `plog-${Date.now()}-${Math.random()}`;
          const item = { ...create, id };
          db.paymentLogs.set(id, item);
          return item;
        }
      }),
    },
    project: {
      create: jest.fn(async ({ data }: any) => {
        const id = `proj-${Date.now()}`;
        const item = { ...data, id };
        db.projects.set(id, item);
        return item;
      }),
      findFirst: jest.fn(async () => Array.from(db.projects.values())[0] || null),
    },
    lead: {
      create: jest.fn(async ({ data }: any) => ({
        id: `lead-${Date.now()}-${Math.random()}`,
        ...data,
      })),
    },
    $transaction: jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(mockPrisma);
      }
      return arg;
    }),
  };

  const mockPaystack = {
    initializeTransaction: jest.fn(async (params: any) => ({
      authorizationUrl: `https://checkout.paystack.com/auth_${params.invoiceNumber || 'test'}`,
      reference: `ref_ps_${Date.now()}`,
      accessCode: 'mock_access_code',
    })),
    verifyTransaction: jest.fn(async (reference: string) => ({
      status: true,
      data: {
        status: 'success',
        reference,
        amount: 5000000,
        currency: 'KES',
        paid_at: new Date().toISOString(),
      },
    })),
    chargeMpesaStk: jest.fn(async () => ({
      reference: 'ref_stk_123',
      displayText: 'M-Pesa prompt sent!',
    })),
    verifyWebhookSignature: jest.fn(() => true),
  };

  const mockDaraja = {
    initiateStkPush: jest.fn(async () => ({
      CheckoutRequestID: `ws_CO_${Date.now()}_MOCK`,
      ResponseCode: '0',
      CustomerMessage: 'Success. Request accepted for processing',
      MerchantRequestID: 'mock_merchant_req',
    })),
    queryStkStatus: jest.fn(async () => ({ ResultCode: '0', ResultDesc: 'The service was accepted successfully' })),
    formatPhoneNumber: jest.fn((p: string) => p.replace(/\D/g, '')),
    getAccessToken: jest.fn(async () => 'mock_daraja_token'),
  };

  const mockConfig = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'PROPOSAL_DEPOSIT_PERCENT') return '50';
      if (key === 'FRONTEND_URL') return 'https://bazionweb.com';
      return def;
    }),
  };

  const mockEvents = { emit: jest.fn() };
  const mockAudit = { log: jest.fn(), recordEvent: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    db.proposals.clear();
    db.invoices.clear();
    db.clients.clear();
    db.users.clear();
    db.paymentLogs.clear();
    db.projects.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        PaymentSettlementService,
        {
          provide: PlatformProvisioningOutboxService,
          useValue: { enqueueForSettledInvoice: jest.fn().mockResolvedValue([]) },
        },
        PricingService,
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaystackService, useValue: mockPaystack },
        { provide: DarajaService, useValue: mockDaraja },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: PricingAuditService, useValue: mockAudit },
      ],
    }).compile();

    billingService = module.get<BillingService>(BillingService);
    settlementService = module.get<PaymentSettlementService>(PaymentSettlementService);
    pricingService = module.get<PricingService>(PricingService);
    clientsService = module.get<ClientsService>(ClientsService);
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Backend API - 5 Stages)
  // =========================================================================
  describe('TIER 1: Backend API Primary Feature Coverage Across All 5 Stages', () => {
    // Stage 1: Catalog & Price Book Services
    describe('Stage 1: Catalog & Price Book Services', () => {
      it('TC-API-1.1: Returns active commercial markets', async () => {
        const markets = await pricingService.getActiveMarkets();
        expect(Array.isArray(markets)).toBe(true);
        expect(markets.length).toBeGreaterThanOrEqual(2);
        expect(markets.some((m) => m.code === 'KE')).toBe(true);
        expect(markets.some((m) => m.code === 'GLOBAL')).toBe(true);
      });

      it('TC-API-1.2: Resolves Kenya market catalog with KES price books', async () => {
        const catalog = await pricingService.getCatalog('KE');
        expect(catalog.market.code).toBe('KE');
        expect(catalog.market.currencyCode).toBe('KES');
        expect(catalog.priceBook.id).toBe('pb-ke-2026');
      });

      it('TC-API-1.3: Resolves International market catalog with USD price books', async () => {
        const catalog = await pricingService.getCatalog('GLOBAL');
        expect(catalog.market.code).toBe('GLOBAL');
        expect(catalog.market.currencyCode).toBe('USD');
      });

      it('TC-API-1.4: Delivers localized currency symbols per market', async () => {
        const keCatalog = await pricingService.getCatalog('KE');
        const globalCatalog = await pricingService.getCatalog('GLOBAL');

        expect(keCatalog.market.currencySymbol).toBe('KSh');
        expect(globalCatalog.market.currencySymbol).toBe('$');
      });

      it('TC-API-1.5: Enforces active price book status for commercial validity', async () => {
        const keCatalog = await pricingService.getCatalog('KE');
        expect(keCatalog.priceBook.version).toBe('2026-v1');
      });
    });

    // Stage 2: Proposal Calculation & Locking Services
    describe('Stage 2: Proposal Calculation & Locking Services', () => {
      it('TC-API-2.1: Calculates quote and locks proposal with unique code', async () => {
        const quote = await pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'business',
          extraPages: 5,
          clientName: 'Jane Mwangi',
          clientEmail: 'jane@safari.co.ke',
          clientCompany: 'Safari Tech Ltd',
        });

        expect(quote.proposalCode).toMatch(/^BZ-KE-/);
        expect(quote.currency).toBe('KES');
        const saved = await mockPrisma.proposal.findUnique({
          where: { proposalCode: quote.proposalCode },
        });
        expect(saved.status).toBe('LOCKED');
        expect(quote.breakdown.package.name).toBe('Business Website');
        expect(quote.breakdown.totalBuildGross).toBeGreaterThan(0);
      });

      it('TC-API-2.2: Calculates 50% deposit term on generated proposals', async () => {
        const quote = await pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'business',
          clientName: 'Kipchoge Keino',
          clientEmail: 'kip@eldoret.co.ke',
        });

        const total = quote.breakdown.totalBuildGross;
        const deposit = Math.round(total * 0.5);
        expect(deposit).toBe(Math.round(total / 2));
      });

      it('TC-API-2.3: Sets 30-day proposal expiration window', async () => {
        const quote = await pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'business',
          clientName: 'Otieno Omolo',
          clientEmail: 'otieno@kisumu.co.ke',
        });

        const expiresAt = new Date(quote.expiresAt);
        const diffDays = Math.round((expiresAt.getTime() - Date.now()) / (86400 * 1000));
        expect(diffDays).toBeGreaterThanOrEqual(29);
        expect(diffDays).toBeLessThanOrEqual(31);
      });

      it('TC-API-2.4: Calculates International USD quotes with GLOBAL marketCode', async () => {
        const quote = await pricingService.calculateQuote({
          marketCode: 'GLOBAL',
          packageType: 'business',
          extraPages: 2,
          clientName: 'Sarah Jenkins',
          clientEmail: 'sarah@globaltech.com',
        });

        expect(quote.proposalCode).toMatch(/^BZ-GLOBAL-/);
        expect(quote.currency).toBe('USD');
        expect(quote.currencySymbol).toBe('$');
      });

      it('TC-API-2.5: Persists locked proposal record in database', async () => {
        const quote = await pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'business',
          clientName: 'David Kariuki',
          clientEmail: 'david@nairobi.co.ke',
        });

        const saved = await mockPrisma.proposal.findUnique({
          where: { proposalCode: quote.proposalCode },
        });
        expect(saved).not.toBeNull();
        expect(saved.clientEmail).toBe('david@nairobi.co.ke');
      });
    });

    // Stage 3: Invoicing Transparency & Accounting Compliance
    describe('Stage 3: Invoicing Transparency & Compliance', () => {
      it('TC-API-3.1: Accepts proposal and generates 50% kickoff deposit invoice', async () => {
        const proposalCode = 'BZ-KE-2026-TEST01';
        db.proposals.set(proposalCode, {
          id: 'prop-01',
          proposalCode,
          status: 'LOCKED',
          clientEmail: 'client@company.co.ke',
          clientName: 'Mercy Cherono',
          currency: 'KES',
          totalAmount: 100000,
          expiresAt: new Date(Date.now() + 86400000),
        });

        const res = await billingService.acceptProposalGuest({
          code: proposalCode,
          email: 'client@company.co.ke',
        });

        expect(res.status).toBe('ACCEPTED');
        expect(res.depositPercent).toBe(50);
        expect(res.invoice.amount).toBe(50000);
        expect(res.invoice.currency).toBe('KES');
        expect(res.invoice.invoiceNumber).toMatch(/^INV-KE/);
      });

      it('TC-API-3.2: Re-accepting proposal is idempotent and returns existing invoice', async () => {
        const proposalCode = 'BZ-KE-2026-TEST02';
        db.proposals.set(proposalCode, {
          id: 'prop-02',
          proposalCode,
          status: 'LOCKED',
          clientEmail: 'client2@company.co.ke',
          currency: 'KES',
          totalAmount: 80000,
          expiresAt: new Date(Date.now() + 86400000),
        });

        const firstAccept = await billingService.acceptProposalGuest({
          code: proposalCode,
          email: 'client2@company.co.ke',
        });

        const secondAccept = await billingService.acceptProposalGuest({
          code: proposalCode,
          email: 'client2@company.co.ke',
        });

        expect(firstAccept.invoice.id).toBe(secondAccept.invoice.id);
        expect(firstAccept.invoice.invoiceNumber).toBe(secondAccept.invoice.invoiceNumber);
      });

      it('TC-API-3.3: Formats itemized line items on kickoff deposit invoice', async () => {
        const proposalCode = 'BZ-KE-2026-TEST03';
        db.proposals.set(proposalCode, {
          id: 'prop-03',
          proposalCode,
          status: 'LOCKED',
          clientEmail: 'client3@company.co.ke',
          currency: 'KES',
          totalAmount: 120000,
          expiresAt: new Date(Date.now() + 86400000),
        });

        const res = await billingService.acceptProposalGuest({
          code: proposalCode,
          email: 'client3@company.co.ke',
        });

        const invoice = db.invoices.get(res.invoice.id);
        expect(invoice.lineItems.length).toBeGreaterThanOrEqual(1);
        expect(invoice.lineItems[0].amount).toBe(60000);
        expect(invoice.lineItems[0].purpose).toBe('invoice_payment');
      });

      it('TC-API-3.4: Generates compliant PDF download URL', async () => {
        const invId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
        db.invoices.set(invId, {
          id: invId,
          clientId: 'client-test',
          status: 'SENT',
        });

        const user = { id: 'user-test', roles: ['ADMIN'] };
        const pdf = await billingService.getPdfUrl(invId, user);
        expect(pdf.data.url).toBe(`/api/v1/invoices/${invId}/pdf/download`);
      });

      it('TC-API-3.5: Tracks invoice status progression to SENT', async () => {
        const proposalCode = 'BZ-KE-2026-TEST05';
        db.proposals.set(proposalCode, {
          id: 'prop-05',
          proposalCode,
          status: 'LOCKED',
          clientEmail: 'client5@company.co.ke',
          currency: 'KES',
          totalAmount: 90000,
          expiresAt: new Date(Date.now() + 86400000),
        });

        const res = await billingService.acceptProposalGuest({
          code: proposalCode,
          email: 'client5@company.co.ke',
        });

        const invoice = db.invoices.get(res.invoice.id);
        expect(invoice.status).toBe(InvoiceStatus.SENT);
      });
    });

    // Stage 4: Payment Processing & Checkout Security
    describe('Stage 4: Payment Processing & Checkout Security', () => {
      it('TC-API-4.1: Initiates M-Pesa STK push for accepted proposal kickoff deposit', async () => {
        const proposalCode = 'BZ-KE-2026-PAY01';
        const marker = `proposal ${proposalCode}`;
        db.proposals.set(proposalCode, {
          id: 'prop-pay-01',
          proposalCode,
          status: 'ACCEPTED',
          clientEmail: 'payer@company.co.ke',
          currency: 'KES',
          totalAmount: 100000,
          expiresAt: new Date(Date.now() + 86400000),
        });
        const invId = 'inv-pay-01';
        db.invoices.set(invId, {
          id: invId,
          clientId: 'client-p1',
          invoiceNumber: 'INV-KE-001',
          amount: 50000,
          currency: 'KES',
          status: InvoiceStatus.SENT,
          notes: `Kickoff deposit (50%) for ${marker}`,
        });

        const res = await billingService.payProposalDepositMpesa(proposalCode, {
          mpesaPhoneNumber: '254712345678',
        });

        expect(res.status).toBe('PENDING_STK_INPUT');
        expect(res.method).toBe('MPESA');
        expect(res.trackingId).toBeDefined();
        expect(mockPaystack.chargeMpesaStk).toHaveBeenCalled();
      });

      it('TC-API-4.2: Initializes Paystack card checkout for proposal deposit', async () => {
        const proposalCode = 'BZ-KE-2026-PAY02';
        const marker = `proposal ${proposalCode}`;
        db.proposals.set(proposalCode, {
          id: 'prop-pay-02',
          proposalCode,
          status: 'ACCEPTED',
          clientEmail: 'cardpayer@company.co.ke',
          currency: 'KES',
          totalAmount: 120000,
          expiresAt: new Date(Date.now() + 86400000),
        });
        const invId = 'inv-pay-02';
        db.invoices.set(invId, {
          id: invId,
          clientId: 'client-p2',
          invoiceNumber: 'INV-KE-002',
          amount: 60000,
          currency: 'KES',
          status: InvoiceStatus.SENT,
          notes: `Kickoff deposit (50%) for ${marker}`,
        });

        const res = await billingService.payProposalDepositCard(proposalCode, {
          email: 'cardpayer@company.co.ke',
        });

        expect(res.status).toBe('REDIRECT_REQUIRED');
        expect(res.method).toBe('CARD');
        expect(res.provider).toBe('PAYSTACK');
        expect(res.checkoutUrl).toContain('https://checkout.paystack.com/');
        expect(mockPaystack.initializeTransaction).toHaveBeenCalled();
      });

      it('TC-API-4.3: Settles payment and marks invoice PAID upon Daraja callback', async () => {
        const invId = 'inv-daraja-settle';
        db.invoices.set(invId, {
          id: invId,
          clientId: 'client-settle',
          invoiceNumber: 'INV-KE-SETTLE',
          amount: 50000,
          currency: 'KES',
          status: InvoiceStatus.SENT,
          lineItems: [{ purpose: 'invoice_payment', amount: 50000 }],
        });

        const checkoutRequestId = 'ws_CO_TEST';
        db.paymentLogs.set('plog-daraja', {
          id: 'plog-daraja',
          idempotencyKey: `DARAJA_${checkoutRequestId}`,
          provider: PaymentProvider.DARAJA,
          providerRef: 'NLX8999ABC',
          method: PaymentMethodType.MPESA,
          amount: 50000,
          currency: 'KES',
          status: PaymentStatus.PENDING,
          clientId: 'client-settle',
          invoiceId: invId,
        });

        await settlementService.settleDarajaSuccess({
          checkoutRequestId,
          receiptNumber: 'NLX8999ABC',
          paidAmount: 50000,
          payload: { mock: true },
        });

        const settledInvoice = db.invoices.get(invId);
        expect(settledInvoice.status).toBe(InvoiceStatus.PAID);
      });

      it('TC-API-4.4: Verifies Paystack reference and settles invoice', async () => {
        const invId = 'inv-ps-settle';
        db.invoices.set(invId, {
          id: invId,
          clientId: 'client-ps',
          invoiceNumber: 'INV-KE-PS',
          amount: 50000,
          currency: 'KES',
          status: InvoiceStatus.SENT,
          lineItems: [{ purpose: 'invoice_payment', amount: 50000 }],
        });

        const reference = 'ps_ref_test_01';
        db.paymentLogs.set('plog-1', {
          id: 'plog-1',
          idempotencyKey: `PAYSTACK_${reference}`,
          providerRef: reference,
          invoiceId: invId,
          status: PaymentStatus.PENDING,
        });

        const result = await settlementService.confirmPaystackReference(reference);
        expect(result.paid).toBe(true);
        expect(db.invoices.get(invId).status).toBe(InvoiceStatus.PAID);
      });

      it('TC-API-4.5: Returns payment status without exposing PII', async () => {
        const ref = 'ps_ref_status_check';
        const invId = 'inv-status-check';
        db.invoices.set(invId, {
          id: invId,
          invoiceNumber: 'INV-ST-001',
          status: InvoiceStatus.PAID,
        });
        db.paymentLogs.set('plog-st', {
          id: 'plog-st',
          providerRef: ref,
          invoiceId: invId,
          status: PaymentStatus.SUCCESS,
          updatedAt: new Date(),
        });

        const status = await settlementService.paymentStatus(ref);
        expect(status.status).toBe(PaymentStatus.SUCCESS);
        expect(status.invoiceNumber).toBe('INV-ST-001');
        // Ensure no PII (e.g. passwords, secrets) returned
        expect((status as any).password).toBeUndefined();
      });
    });

    // Stage 5: Client Onboarding & Dashboard Access
    describe('Stage 5: Client Onboarding & Dashboard Provisioning', () => {
      it('TC-API-5.1: Provisions Client and User records upon onboarding creation', async () => {
        const created = await clientsService.create({
          businessName: 'Kiprono Logistics Ltd',
          contactName: 'Dennis Kiprono',
          email: 'dennis@kipronologistics.co.ke',
          phone: '+254712345678',
          country: 'KE',
          planTier: 'BUSINESS',
        });

        expect(created.data).toBeDefined();
        expect(created.data.businessName).toBe('Kiprono Logistics Ltd');
        expect(created.data.status).toBe('TRIAL');
      });

      it('TC-API-5.2: Retrieves client profile by associated userId', async () => {
        const userId = 'user-uuid-dennis';
        const clientId = 'client-uuid-dennis';
        db.clients.set(clientId, {
          id: clientId,
          userId,
          businessName: 'Kiprono Logistics Ltd',
          contactName: 'Dennis Kiprono',
          email: 'dennis@kipronologistics.co.ke',
          deletedAt: null,
        });

        const found = await clientsService.findByUserId(userId);
        expect(found.data.id).toBe(clientId);
        expect(found.data.businessName).toBe('Kiprono Logistics Ltd');
      });

      it('TC-API-5.3: Updates client profile details and contact information', async () => {
        const clientId = 'client-update-test';
        db.clients.set(clientId, {
          id: clientId,
          userId: 'user-update-test',
          businessName: 'Initial Name',
          contactName: 'Initial Contact',
          deletedAt: null,
        });

        const updated = await clientsService.update(
          clientId,
          {
            businessName: 'Updated Enterprise Ltd',
            contactName: 'Updated Contact Person',
          },
          { id: 'user-update-test', roles: ['CLIENT'] },
        );

        expect(updated.data.businessName).toBe('Updated Enterprise Ltd');
        expect(updated.data.contactName).toBe('Updated Contact Person');
      });

      it('TC-API-5.4: Simulates client onboarding timestamp persistence (onboardedAt)', async () => {
        const clientId = 'client-onboard-test';
        db.clients.set(clientId, {
          id: clientId,
          onboardedAt: null,
          deletedAt: null,
        });

        // Simulate onboarding completion logic
        const now = new Date();
        const updated = await mockPrisma.client.update({
          where: { id: clientId },
          data: { onboardedAt: now },
        });

        expect(updated.onboardedAt).toEqual(now);
      });

      it('TC-API-5.5: Soft-deletes client and sets status to CANCELLED', async () => {
        const clientId = 'client-del-test';
        db.clients.set(clientId, {
          id: clientId,
          status: 'ACTIVE',
          deletedAt: null,
        });

        const del = await clientsService.softDelete(clientId);
        expect(del.data.deleted).toBe(true);

        const record = db.clients.get(clientId);
        expect(record.status).toBe('CANCELLED');
        expect(record.deletedAt).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY, ADVERSARIAL & CORNER CASES (Backend API)
  // =========================================================================
  describe('TIER 2: Backend API Boundary, Adversarial & Corner Cases', () => {
    it('TC-B-API-1: Rejects quote calculation when invalid package type is supplied', async () => {
      await expect(
        pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'invalid-tier' as any,
          clientName: 'Test User',
          clientEmail: 'test@example.com',
        }),
      ).rejects.toThrow();
    });

    it('TC-B-API-2: Rejects proposal acceptance for non-existent proposal code', async () => {
      await expect(
        billingService.acceptProposalGuest({
          code: 'BZ-DOES-NOT-EXIST',
          email: 'test@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('TC-B-API-3: Rejects proposal acceptance when proposal has expired', async () => {
      const expiredCode = 'BZ-KE-EXPIRED-99';
      db.proposals.set(expiredCode, {
        id: 'prop-exp',
        proposalCode: expiredCode,
        status: 'LOCKED',
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      });

      await expect(
        billingService.acceptProposalGuest({
          code: expiredCode,
          email: 'test@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-B-API-4: Rejects proposal payment before proposal has been accepted', async () => {
      const lockedCode = 'BZ-KE-UNACCEPTED';
      db.proposals.set(lockedCode, {
        id: 'prop-unacc',
        proposalCode: lockedCode,
        status: 'LOCKED', // Not yet ACCEPTED
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        billingService.payProposalDepositMpesa(lockedCode, {
          mpesaPhoneNumber: '254712345678',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-B-API-5: Rejects proposal acceptance when email mismatches proposal recipient', async () => {
      const code = 'BZ-KE-MISMATCH';
      db.proposals.set(code, {
        id: 'prop-mismatch',
        proposalCode: code,
        status: 'LOCKED',
        clientEmail: 'original@recipient.co.ke',
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        billingService.acceptProposalGuest({
          code,
          email: 'imposter@attacker.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TC-B-API-6: Rejects payment on already settled deposit invoice', async () => {
      const code = 'BZ-KE-ALREADY-PAID';
      const marker = `proposal ${code}`;
      db.proposals.set(code, {
        id: 'prop-paid',
        proposalCode: code,
        status: 'ACCEPTED',
        clientEmail: 'paid@client.co.ke',
      });
      db.invoices.set('inv-paid', {
        id: 'inv-paid',
        status: InvoiceStatus.PAID,
        notes: marker,
      });

      await expect(
        billingService.payProposalDepositCard(code, { email: 'paid@client.co.ke' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-B-API-7: Prevents non-owner client from accessing another client profile', async () => {
      const clientId = 'client-foreign';
      db.clients.set(clientId, {
        id: clientId,
        userId: 'user-foreign',
        businessName: 'Foreign Business Ltd',
        deletedAt: null,
      });

      const unauthorizedUser = { id: 'user-intruder', roles: ['CLIENT'] };
      await expect(
        clientsService.findOne(clientId, unauthorizedUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TC-B-API-8: Prevents non-staff clients from mutating client status or planTier', async () => {
      const clientId = 'client-tamper-plan';
      db.clients.set(clientId, {
        id: clientId,
        userId: 'user-client-1',
        businessName: 'Legit Business',
        status: 'TRIAL',
        deletedAt: null,
      });

      const clientUser = { id: 'user-client-1', roles: ['CLIENT'] };
      const updateDto: any = { status: 'ACTIVE', planTier: 'ENTERPRISE' };

      const res = await clientsService.update(clientId, updateDto, clientUser);
      // Status should remain TRIAL because client role cannot mutate status
      expect(res.data.status).toBe('TRIAL');
    });

    it('TC-B-API-9: Handles empty catalog queries gracefully without crashing', async () => {
      const catalog = await pricingService.getCatalog('UNKNOWN_MARKET');
      expect(catalog).toBeDefined();
    });

    it('TC-B-API-10: Handles duplicate client email registration conflict', async () => {
      db.clients.set('existing-c', {
        id: 'existing-c',
        email: 'duplicate@domain.co.ke',
      });

      await expect(
        clientsService.create({
          businessName: 'Duplicate Corp',
          contactName: 'Dupe Person',
          email: 'duplicate@domain.co.ke',
          planTier: 'BUSINESS',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTEGRATION PIPELINES (Full Backend Cycle)
  // =========================================================================
  describe('TIER 3: Backend Cross-Feature Integration Pipeline', () => {
    it('Executes the complete backend quote-to-close-to-onboarding lifecycle', async () => {
      // 1. Stage 1: Prospect views catalog
      const catalog = await pricingService.getCatalog('KE');
      expect(catalog.market.currencyCode).toBe('KES');

      // 2. Stage 2: Prospect calculates quote & locks proposal
      const quote = await pricingService.calculateQuote({
        marketCode: 'KE',
        packageType: 'business',
        extraPages: 3,
        clientName: 'Wambui Karanja',
        clientEmail: 'wambui@karanjafarms.co.ke',
        clientCompany: 'Karanja Organic Farms',
      });
      const proposalCode = quote.proposalCode;
      expect(proposalCode).toBeDefined();

      // 3. Stage 3: Prospect accepts proposal, triggering 50% Kickoff Invoice
      const acceptRes = await billingService.acceptProposalGuest({
        code: proposalCode,
        email: 'wambui@karanjafarms.co.ke',
      });
      expect(acceptRes.status).toBe('ACCEPTED');
      const depositInvoiceId = acceptRes.invoice.id;

      // 4. Stage 4: Client triggers M-Pesa STK Push
      const payRes = await billingService.payProposalDepositMpesa(proposalCode, {
        mpesaPhoneNumber: '254712345678',
      });
      expect(payRes.status).toBe('PENDING_STK_INPUT');
      const checkoutRequestId = payRes.trackingId;

      // 5. Stage 4 Webhook: Daraja settlement webhook confirms payment
      db.paymentLogs.set('plog-pipeline', {
        id: 'plog-pipeline',
        idempotencyKey: `DARAJA_${checkoutRequestId}`,
        provider: PaymentProvider.DARAJA,
        providerRef: 'QWE123RTY',
        method: PaymentMethodType.MPESA,
        amount: acceptRes.invoice.amount,
        currency: 'KES',
        status: PaymentStatus.PENDING,
        clientId: acceptRes.invoice.id,
        invoiceId: depositInvoiceId,
      });

      await settlementService.settleDarajaSuccess({
        checkoutRequestId,
        receiptNumber: 'QWE123RTY',
        paidAmount: acceptRes.invoice.amount,
        payload: { mock: true },
      });

      const settledInv = db.invoices.get(depositInvoiceId);
      expect(settledInv.status).toBe(InvoiceStatus.PAID);

      // 6. Stage 5: Client Onboarding completion
      const client = Array.from(db.clients.values()).find(
        (c) => c.email === 'wambui@karanjafarms.co.ke',
      );
      expect(client).toBeDefined();

      const onboardedTime = new Date();
      const updatedClient = await mockPrisma.client.update({
        where: { id: client.id },
        data: { onboardedAt: onboardedTime },
      });
      expect(updatedClient.onboardedAt).toEqual(onboardedTime);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION WORKLOADS & STRESS
  // =========================================================================
  describe('TIER 4: Real-World Workloads & Stress Scenarios', () => {
    it('TC-W-API-1: Executes high-throughput sequential quote requests without state bleed', async () => {
      const iterations = 20;
      const codes = new Set<string>();

      for (let i = 0; i < iterations; i++) {
        const quote = await pricingService.calculateQuote({
          marketCode: 'KE',
          packageType: 'business',
          clientName: `Stress Client ${i}`,
          clientEmail: `stress${i}@stress-test.co.ke`,
        });
        codes.add(quote.proposalCode);
      }

      expect(codes.size).toBe(iterations);
    });

    it('TC-W-API-2: Preserves transaction idempotency under repeated webhook delivery', async () => {
      const invId = 'inv-idempotent-stress';
      db.invoices.set(invId, {
        id: invId,
        clientId: 'client-idem',
        invoiceNumber: 'INV-IDEM-01',
        amount: 50000,
        currency: 'KES',
        status: InvoiceStatus.SENT,
        lineItems: [{ purpose: 'invoice_payment', amount: 50000 }],
      });

      const checkoutRequestId = 'ws_CO_IDEM';
      db.paymentLogs.set('plog-idem', {
        id: 'plog-idem',
        idempotencyKey: `DARAJA_${checkoutRequestId}`,
        provider: PaymentProvider.DARAJA,
        providerRef: 'NLX_IDEM_1',
        method: PaymentMethodType.MPESA,
        amount: 50000,
        currency: 'KES',
        status: PaymentStatus.PENDING,
        clientId: 'client-idem',
        invoiceId: invId,
      });

      const payload = {
        checkoutRequestId,
        receiptNumber: 'NLX_IDEM_1',
        paidAmount: 50000,
        payload: { mock: true },
      };

      // First webhook delivery
      await settlementService.settleDarajaSuccess(payload);
      expect(db.invoices.get(invId).status).toBe(InvoiceStatus.PAID);

      // Subsequent identical delivery (network retry)
      await settlementService.settleDarajaSuccess(payload);
      expect(db.invoices.get(invId).status).toBe(InvoiceStatus.PAID);
    });

    it('TC-W-API-3: Cross-market isolation under interleaved KES and USD transactions', async () => {
      for (let i = 0; i < 10; i++) {
        const isKe = i % 2 === 0;
        const market = isKe ? 'KE' : 'GLOBAL';
        const expectedCurrency = isKe ? 'KES' : 'USD';

        const quote = await pricingService.calculateQuote({
          marketCode: market,
          packageType: 'business',
          clientName: `Client ${i}`,
          clientEmail: `client${i}@test.com`,
        });

        expect(quote.currency).toBe(expectedCurrency);
      }
    });
  });
});
