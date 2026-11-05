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

describe('BillingService & Controller — Proposal Retrieval (GET /api/v1/invoices/proposals/:code)', () => {
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
    get: jest.fn().mockReturnValue('test-value'),
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

  describe('BillingService.getProposalByCode', () => {
    const validProposalCode = 'BZ-KE-2026-ABC12';
    const futureDate = new Date(Date.now() + 7 * 86_400_000);
    const pastDate = new Date(Date.now() - 86_400_000);

    const baseDbProposal = {
      id: 'prop-uuid-101',
      proposalCode: validProposalCode,
      currency: 'KES',
      totalAmount: 180000,
      clientName: 'Jane Wanjiku',
      clientCompany: 'Acacia Medical Ltd',
      clientEmail: 'jane@acacia.co.ke',
      status: 'LOCKED',
      createdAt: new Date('2026-04-01T10:00:00Z'),
      expiresAt: futureDate,
      market: {
        code: 'KE',
        currencyCode: 'KES',
        currency: {
          symbol: 'KSh',
        },
      },
      lineItems: [
        {
          title: 'Business Digital Flagship',
          subtitle: 'Up to 10 Bespoke Pages & CMS',
          price: 150000,
          quantity: 1,
        },
        {
          title: 'M-Pesa STK & Card Settlement Gateway',
          price: 30000,
          quantity: 1,
        },
      ],
    };

    it('retrieves and returns structured proposal details for valid proposal code', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(baseDbProposal);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.getProposalByCode(validProposalCode);

      expect(mockPrisma.proposal.findUnique).toHaveBeenCalledWith({
        where: { proposalCode: validProposalCode },
        include: {
          market: {
            include: {
              currency: true,
            },
          },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.proposalCode).toBe(validProposalCode);
      expect(result.data.currency).toBe('KES');
      expect(result.data.currencySymbol).toBe('KSh');
      expect(result.data.totalAmount).toBe(180000);
      expect(result.data.depositAmount).toBe(90000); // 50%
      expect(result.data.finalAmount).toBe(90000); // 50%
      expect(result.data.status).toBe('LOCKED');
      expect(result.data.clientName).toBe('Jane Wanjiku');
      expect(result.data.clientEmail).toBe('jane@acacia.co.ke');
      expect(result.data.clientCompany).toBe('Acacia Medical Ltd');
      expect(result.data.marketCode).toBe('KE');
      expect(result.data.lineItems).toHaveLength(2);
      expect(result.data.lineItems[0].title).toBe('Business Digital Flagship');
      expect(result.data.lineItems[0].price).toBe(150000);
      expect(result.data.invoice).toBeUndefined();
    });

    it('normalizes lowercase proposal codes to uppercase before querying', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(baseDbProposal);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const lowercaseCode = 'bz-ke-2026-abc12';
      const result = await service.getProposalByCode(lowercaseCode);

      expect(mockPrisma.proposal.findUnique).toHaveBeenCalledWith({
        where: { proposalCode: 'BZ-KE-2026-ABC12' },
        include: {
          market: {
            include: {
              currency: true,
            },
          },
        },
      });
      expect(result.data.proposalCode).toBe(validProposalCode);
    });

    it('marks status as EXPIRED when expiresAt is in the past', async () => {
      const expiredDbProposal = {
        ...baseDbProposal,
        expiresAt: pastDate,
      };
      mockPrisma.proposal.findUnique.mockResolvedValue(expiredDbProposal);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.getProposalByCode(validProposalCode);
      expect(result.data.status).toBe('EXPIRED');
    });

    it('attaches linked deposit invoice if one exists', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(baseDbProposal);
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-uuid-1',
        invoiceNumber: 'INV-KE-2026-0001',
        amount: 90000,
        status: 'PENDING',
        dueDate: futureDate,
      });

      const result = await service.getProposalByCode(validProposalCode);
      expect(result.data.invoice).toBeDefined();
      expect(result.data.invoice?.invoiceNumber).toBe('INV-KE-2026-0001');
      expect(result.data.invoice?.amount).toBe(90000);
      expect(result.data.invoice?.status).toBe('PENDING');
      expect(result.data.invoice?.dueDate).toBe(futureDate.toISOString());
    });

    it('throws NotFoundException if proposal code does not exist in DB', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.getProposalByCode('BZ-KE-9999-NOTFOUND')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws NotFoundException for empty or invalid format proposal codes', async () => {
      const badCodes = [
        '',
        '   ',
        'QUOTE<script>',
        'BZ;DROP;',
        'A', // too short (< 4 chars)
      ];

      for (const badCode of badCodes) {
        await expect(service.getProposalByCode(badCode)).rejects.toThrow(NotFoundException);
      }
    });

    it('correctly maps USD currency symbol for global proposals', async () => {
      const globalProposal = {
        ...baseDbProposal,
        proposalCode: 'BZ-GL-2026-US123',
        currency: 'USD',
        totalAmount: 1800,
        market: {
          code: 'GLOBAL',
          currencyCode: 'USD',
          currency: {
            symbol: '$',
          },
        },
        lineItems: [
          {
            title: 'Professional Portal',
            price: 1800,
          },
        ],
      };
      mockPrisma.proposal.findUnique.mockResolvedValue(globalProposal);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.getProposalByCode('BZ-GL-2026-US123');
      expect(result.data.currency).toBe('USD');
      expect(result.data.currencySymbol).toBe('$');
      expect(result.data.depositAmount).toBe(900);
      expect(result.data.finalAmount).toBe(900);
      expect(result.data.marketCode).toBe('GLOBAL');
    });
  });

  describe('BillingController Metadata', () => {
    it('decorates getProposal with @Public() and throttle metadata', () => {
      const reflector = new Reflector();
      const methodHandler = controller.getProposal;

      const isPublic = reflector.get<boolean>('isPublic', methodHandler);
      expect(isPublic).toBe(true);

      const keys = Reflect.getMetadataKeys(methodHandler);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('isPublic');
      const hasThrottler = keys.some((k: string) => String(k).toLowerCase().includes('throttle'));
      expect(hasThrottler).toBe(true);
    });
  });
});
