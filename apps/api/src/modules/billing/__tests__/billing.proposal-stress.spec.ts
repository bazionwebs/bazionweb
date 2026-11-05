import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService } from '../billing.service';
import { BillingController } from '../billing.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaystackService } from '../paystack.service';
import { DarajaService } from '../daraja.service';
import { PaymentSettlementService } from '../payment-settlement.service';

describe('Adversarial Stress Test: Backend Proposal API (GET /api/v1/invoices/proposals/:code)', () => {
  let service: BillingService;
  let controller: BillingController;

  const mockPrisma = {
    proposal: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    client: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    plan: {
      findFirst: jest.fn(),
    },
    currency: {
      findUnique: jest.fn(),
    },
    paymentLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPaystack = {
    initializeTransaction: jest.fn(),
  };

  const mockDaraja = {
    initiateStkPush: jest.fn(),
    formatPhoneNumber: jest.fn((p) => p),
  };

  const mockSettlement = {
    settleDepositInvoice: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'PROPOSAL_DEPOSIT_PERCENT') return '50';
      return defaultValue ?? 'test-value';
    }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaystackService, useValue: mockPaystack },
        { provide: DarajaService, useValue: mockDaraja },
        { provide: PaymentSettlementService, useValue: mockSettlement },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    controller = module.get<BillingController>(BillingController);
  });

  describe('1. Adversarial Codes, Malformed Strings & Injection Resistance', () => {
    const maliciousPayloads = [
      // SQL Injection
      "' OR '1'='1",
      "'; DROP TABLE proposals; --",
      "admin'--",
      "' UNION SELECT null, null, null--",
      "1; EXEC xp_cmdshell('dir')",
      
      // XSS & HTML Injections
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
      "<svg onload=alert(1)>",
      
      // Path Traversal & File Inclusion
      "../../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\cmd.exe",
      "%2e%2e%2f%2e%2e%2f",
      "/etc/shadow",
      
      // Null Bytes & Control Characters
      "BZ\0KE-2026",
      "BZ\r\nKE-2026",
      "BZ\tKE-2026",
      "BZ\u0000KE",
      
      // Special symbols and punctuation
      "BZ KE 2026",
      "BZ!@#$%",
      "BZ?query=true",
      "BZ/2026/01",
      "BZ\\2026\\01",
      "BZ:2026:01",
      "BZ;2026;01",
      
      // Whitespace
      "",
      "    ",
      "\t\n\r",
      
      // Unicode & Homoglyphs
      "ＢＺ－ＫＥ－２０２６", // Fullwidth characters
      "BZ—KE—2026", // Em-dash instead of hyphen
      "BZ\u200BKE", // Zero-width space
      
      // Length boundary violations
      "A", // 1 char (< 4)
      "AB", // 2 chars (< 4)
      "ABC", // 3 chars (< 4)
      "A".repeat(65), // 65 chars (> 64)
      "A".repeat(500), // 500 chars (buffer bloat)
      "A".repeat(10000), // 10,000 chars (ReDoS / memory probe)
    ];

    maliciousPayloads.forEach((payload) => {
      it(`strictly rejects adversarial input "${payload.slice(0, 30)}..." with NotFoundException without querying DB`, async () => {
        await expect(service.getProposalByCode(payload)).rejects.toThrow(NotFoundException);
        expect(mockPrisma.proposal.findUnique).not.toHaveBeenCalled();
      });
    });

    it('accepts exact length boundary valid codes: 4 characters and 64 characters', async () => {
      const code4 = 'ABCD';
      const code64 = 'A'.repeat(64);

      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      // Should pass regex and attempt findUnique
      await expect(service.getProposalByCode(code4)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.proposal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { proposalCode: code4 } })
      );

      mockPrisma.proposal.findUnique.mockClear();

      await expect(service.getProposalByCode(code64)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.proposal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { proposalCode: code64 } })
      );
    });

    it('supports hyphens and underscores within valid characters', async () => {
      const validCode = 'BZ_KE-2026_TEST-1';
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.getProposalByCode(validCode)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.proposal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { proposalCode: validCode } })
      );
    });
  });

  describe('2. Rate Limiting Metadata Verification (30 req/min)', () => {
    it('verifies BillingController.getProposal is configured with 30 req/min limit', () => {
      const reflector = new Reflector();
      const handler = controller.getProposal;

      const isPublic = reflector.get<boolean>('isPublic', handler);
      expect(isPublic).toBe(true);

      const metadataKeys = Reflect.getMetadataKeys(handler);
      expect(metadataKeys).toContain('THROTTLER:LIMITdefault');
      expect(metadataKeys).toContain('THROTTLER:TTLdefault');

      const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
      const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);

      expect(limit).toBe(30);
      expect(ttl).toBe(60000);
    });
  });

  describe('3. Dynamic Expiration Calculation Verification', () => {
    const baseProposal = {
      id: 'prop-uuid-test',
      proposalCode: 'BZ-KE-2026-EXPIRY',
      currency: 'KES',
      totalAmount: 100000,
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      market: { code: 'KE', currencyCode: 'KES', currency: { symbol: 'KSh' } },
      lineItems: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('dynamically marks proposal as EXPIRED when expiresAt is 1 millisecond in the past, even if DB says LOCKED', async () => {
      const pastExpires = new Date(Date.now() - 1000);
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...baseProposal,
        status: 'LOCKED',
        expiresAt: pastExpires,
      });

      const res = await service.getProposalByCode('BZ-KE-2026-EXPIRY');
      expect(res.data.status).toBe('EXPIRED');
    });

    it('marks proposal as LOCKED when expiresAt is in the future and DB says LOCKED', async () => {
      const futureExpires = new Date(Date.now() + 60000);
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...baseProposal,
        status: 'LOCKED',
        expiresAt: futureExpires,
      });

      const res = await service.getProposalByCode('BZ-KE-2026-EXPIRY');
      expect(res.data.status).toBe('LOCKED');
    });

    it('retains ACCEPTED status even if expiresAt is in the past (already executed agreement)', async () => {
      const pastExpires = new Date(Date.now() - 86400000);
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...baseProposal,
        status: 'ACCEPTED',
        expiresAt: pastExpires,
      });

      const res = await service.getProposalByCode('BZ-KE-2026-EXPIRY');
      expect(res.data.status).toBe('ACCEPTED');
    });

    it('marks status as EXPIRED if DB status is explicitly EXPIRED even if expiresAt is in the future', async () => {
      const futureExpires = new Date(Date.now() + 86400000);
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...baseProposal,
        status: 'EXPIRED',
        expiresAt: futureExpires,
      });

      const res = await service.getProposalByCode('BZ-KE-2026-EXPIRY');
      expect(res.data.status).toBe('EXPIRED');
    });
  });

  describe('4. Penny-Accurate 50/50 Payment Split Math Verification', () => {
    const testAmounts = [
      99999.99,
      0.01,
      0.02,
      0.03,
      1.99,
      49.99,
      99.99,
      180000.00,
      175432.55,
      33333.33,
      1234567.89,
      0.05,
      0.07,
      15.01,
      1000000.01,
    ];

    testAmounts.forEach((total) => {
      it(`guarantees depositAmount + finalAmount === totalAmount exactly for ${total}`, async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
          id: 'prop-math',
          proposalCode: 'BZ-KE-2026-MATH',
          currency: 'USD',
          totalAmount: total,
          status: 'LOCKED',
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          market: { code: 'GLOBAL', currencyCode: 'USD', currency: { symbol: '$' } },
          lineItems: [],
        });

        const res = await service.getProposalByCode('BZ-KE-2026-MATH');
        const { depositAmount, finalAmount, totalAmount } = res.data;

        expect(totalAmount).toBe(total);
        // Financial invariants:
        // 1. Sum must equal totalAmount exactly down to 2 decimal places
        const sum = Math.round((depositAmount + finalAmount) * 100) / 100;
        expect(sum).toBe(total);

        // 2. Both must have at most 2 decimal places
        expect(depositAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
        expect(finalAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/);

        // 3. Difference between deposit and final must be <= 0.01 (penny accurate split)
        expect(Math.abs(depositAmount - finalAmount)).toBeLessThanOrEqual(0.010000001);
      });
    });

    it('executes 1,000 randomized fuzz tests across fractional amounts', async () => {
      for (let i = 0; i < 1000; i++) {
        // Random amount between 0.01 and 500,000.00 with 2 decimal places
        const total = Math.round((Math.random() * 500000 + 0.01) * 100) / 100;
        mockPrisma.proposal.findUnique.mockResolvedValue({
          id: `prop-fuzz-${i}`,
          proposalCode: 'BZ-KE-2026-FUZZ',
          currency: 'KES',
          totalAmount: total,
          status: 'LOCKED',
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          market: { code: 'KE', currencyCode: 'KES', currency: { symbol: 'KSh' } },
          lineItems: [],
        });

        const res = await service.getProposalByCode('BZ-KE-2026-FUZZ');
        const { depositAmount, finalAmount } = res.data;
        const sum = Math.round((depositAmount + finalAmount) * 100) / 100;
        expect(sum).toBe(total);
      }
    });
  });

  describe('5. Line Item Defensive Parsing & Normalization', () => {
    it('normalizes malformed or null line item records safely without throwing', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'prop-norm',
        proposalCode: 'BZ-KE-2026-NORM',
        currency: 'USD',
        totalAmount: 1000,
        status: 'LOCKED',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        market: null, // Test null market
        lineItems: [
          {}, // empty object
          { title: 'Normal Item', price: 500, quantity: 1 },
          { name: 'Item using name field', amount: 300, count: 2 },
          { description: 'Item using description', price: 'invalid_number' },
          { productId: 'item-prod-id' }, // Missing price and title
          { title: 'Recurring Care', price: 100, billingPeriod: 'month' },
        ],
      });

      const res = await service.getProposalByCode('BZ-KE-2026-NORM');
      expect(res.data.lineItems).toBeDefined();
      expect(res.data.lineItems).toHaveLength(6);

      // Check item 1 (empty object converted to Project Item with 0 price)
      expect(res.data.lineItems[0].title).toBe('Project Item');
      expect(res.data.lineItems[0].price).toBe(0);

      // Check item 2
      expect(res.data.lineItems[1].title).toBe('Normal Item');
      expect(res.data.lineItems[1].price).toBe(500);
      expect(res.data.lineItems[1].quantity).toBe(1);

      // Check item 3 (name and count mapped)
      expect(res.data.lineItems[2].title).toBe('Item using name field');
      expect(res.data.lineItems[2].price).toBe(300);
      expect(res.data.lineItems[2].quantity).toBe(2);

      // Check item 4 (invalid price falls back to 0)
      expect(res.data.lineItems[3].title).toBe('Item using description');
      expect(res.data.lineItems[3].price).toBe(0);

      // Check item 6 (billingPeriod maps to subtitle)
      expect(res.data.lineItems[5].title).toBe('Recurring Care');
      expect(res.data.lineItems[5].subtitle).toBe('monthly recurring');
    });

    it('handles non-array lineItems JSON by returning empty array', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'prop-nonarray',
        proposalCode: 'BZ-KE-2026-NONARRAY',
        currency: 'USD',
        totalAmount: 500,
        status: 'LOCKED',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        market: null,
        lineItems: 'corrupted string in database',
      });

      const res = await service.getProposalByCode('BZ-KE-2026-NONARRAY');
      expect(res.data.lineItems).toEqual([]);
    });

    it('safely filters out null or undefined elements in lineItems array without throwing', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'prop-null-element',
        proposalCode: 'BZ-KE-2026-NULLEL',
        currency: 'USD',
        totalAmount: 500,
        status: 'LOCKED',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        market: null,
        lineItems: [null, undefined, { title: 'Safe Item', price: 500 }],
      });

      const res = await service.getProposalByCode('BZ-KE-2026-NULLEL');
      expect(res.success).toBe(true);
      expect(res.data.lineItems).toHaveLength(1);
      expect(res.data.lineItems[0].title).toBe('Safe Item');
      expect(res.data.lineItems[0].price).toBe(500);
    });

    it('safely parses stringified JSON string lineItems including nested items or mixed nulls', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'prop-json-str',
        proposalCode: 'BZ-KE-2026-JSONSTR',
        currency: 'KES',
        totalAmount: 90000,
        status: 'LOCKED',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        market: null,
        lineItems: JSON.stringify([
          null,
          { title: 'Stringified Flagship', price: 90000, quantity: 1 },
        ]),
      });

      const res = await service.getProposalByCode('BZ-KE-2026-JSONSTR');
      expect(res.success).toBe(true);
      expect(res.data.lineItems).toHaveLength(1);
      expect(res.data.lineItems[0].title).toBe('Stringified Flagship');
      expect(res.data.lineItems[0].price).toBe(90000);
    });
  });
});
