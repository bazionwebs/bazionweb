import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaystackService } from '../paystack.service';
import { DarajaService } from '../daraja.service';
import { PaymentSettlementService } from '../payment-settlement.service';

const lockedProposal = {
  id: 'prop-uuid-1',
  proposalCode: 'BZ-KE-2026-ABC12',
  status: 'LOCKED',
  clientEmail: 'jane@acacia.co.ke',
  clientName: 'Jane Wanjiku',
  clientCompany: 'Acacia Healthcare Ltd',
  currency: 'KES',
  totalAmount: 100000,
  expiresAt: new Date(Date.now() + 86_400_000),
};

const depositInvoice = {
  id: 'inv-uuid-1',
  invoiceNumber: 'INV-KE-00000001-ABCDEF',
  amount: 50000,
  currency: 'KES',
  dueDate: new Date(Date.now() + 7 * 86_400_000),
};

const mockPrisma = {
  proposal: { findUnique: jest.fn(), updateMany: jest.fn() },
  invoice: { findFirst: jest.fn(), create: jest.fn() },
  client: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn() },
  plan: { findFirst: jest.fn(), findUnique: jest.fn() },
  paymentLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockPaystackService = {
  initializeTransaction: jest.fn(),
  chargeMpesaStk: jest.fn(),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(),
};

const mockDarajaService = {
  initiateStkPush: jest.fn(),
  queryStkStatus: jest.fn(),
  formatPhoneNumber: jest.fn((p: string) => p),
  getAccessToken: jest.fn().mockResolvedValue('test_token'),
};

const mockPaymentSettlementService = {
  confirmPaystackReference: jest.fn(),
  settlePaystackCharge: jest.fn(),
  settleDarajaSuccess: jest.fn(),
  paymentStatus: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: any) => {
    if (key === 'FRONTEND_URL') return 'https://bazionweb.com';
    return def;
  }),
};

const mockEvents = { emit: jest.fn() };

function guestPrismaMocks() {
  mockPrisma.plan.findFirst.mockResolvedValue({ id: 'plan-1' });
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({ id: 'user-1' });
  mockPrisma.client.findUnique.mockResolvedValue(null);
  mockPrisma.client.create.mockResolvedValue({ id: 'client-1' });
}

describe('BillingService — proposal deposit checkout (quote-to-close)', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: PaystackService, useValue: mockPaystackService },
        { provide: DarajaService, useValue: mockDarajaService },
        { provide: PaymentSettlementService, useValue: mockPaymentSettlementService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string, def?: any) => {
      if (key === 'FRONTEND_URL') return 'https://bazionweb.com';
      return def;
    });
  });

  describe('acceptProposalGuest()', () => {
    const dto = { code: 'BZ-KE-2026-ABC12', email: 'jane@acacia.co.ke' };

    it('throws NotFoundException for an unknown proposal code', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.acceptProposalGuest({ ...dto, code: 'BZ-KE-2026-NOPE0' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for an expired proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...lockedProposal,
        expiresAt: new Date(Date.now() - 86_400_000),
      });

      await expect(service.acceptProposalGuest(dto)).rejects.toThrow(BadRequestException);
    });

    it('creates the kickoff deposit invoice (50%) and claims the proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(lockedProposal);
      guestPrismaMocks();
      mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.invoice.create.mockResolvedValue(depositInvoice);

      const result = await service.acceptProposalGuest(dto);

      expect(result.status).toBe('ACCEPTED');
      expect(result.depositPercent).toBe(50);
      expect(result.invoice.invoiceNumber).toBe(depositInvoice.invoiceNumber);
      expect(result.invoice.amount).toBe(50000);

      const claimCall = mockPrisma.proposal.updateMany.mock.calls[0][0];
      expect(claimCall.where).toEqual({ id: 'prop-uuid-1', status: 'LOCKED' });
      expect(claimCall.data).toEqual({ status: 'ACCEPTED' });

      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.amount).toBe(50000);
      expect(createCall.data.currency).toBe('KES');
      expect(createCall.data.notes).toContain('proposal BZ-KE-2026-ABC12');
      expect(createCall.data.lineItems[0].description).toContain('Kickoff deposit');
    });

    it('is idempotent — re-accepting returns the same deposit invoice without re-claiming', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED' });
      mockPrisma.invoice.findFirst.mockResolvedValue(depositInvoice);

      const result = await service.acceptProposalGuest(dto);

      expect(result.invoice.id).toBe('inv-uuid-1');
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('returns the winner\'s invoice when a concurrent claim loses the race', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(lockedProposal);
      guestPrismaMocks();
      mockPrisma.proposal.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.invoice.findFirst.mockResolvedValue(depositInvoice);

      const result = await service.acceptProposalGuest(dto);

      expect(result.invoice.id).toBe('inv-uuid-1');
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the claim is lost and no deposit invoice exists', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(lockedProposal);
      guestPrismaMocks();
      mockPrisma.proposal.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.acceptProposalGuest(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ServiceUnavailableException when no plans are configured', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(lockedProposal);
      mockPrisma.plan.findFirst.mockResolvedValue(null);

      await expect(service.acceptProposalGuest(dto)).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadRequestException when the proposal total cannot fund a deposit', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, totalAmount: 0 });
      guestPrismaMocks();

      await expect(service.acceptProposalGuest(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('payProposalDepositCard()', () => {
    it('throws BadRequestException when the proposal is not accepted yet', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(lockedProposal);

      await expect(service.payProposalDepositCard(lockedProposal.proposalCode, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the deposit invoice was already settled', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED' });
      mockPrisma.invoice.findFirst.mockResolvedValue({ ...depositInvoice, status: 'PAID' });

      await expect(service.payProposalDepositCard(lockedProposal.proposalCode, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unsupported currencies', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED', currency: 'EUR' });
      mockPrisma.invoice.findFirst.mockResolvedValue({ ...depositInvoice, currency: 'EUR' });

      await expect(service.payProposalDepositCard(lockedProposal.proposalCode, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a Paystack hosted checkout and records the pending payment log', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED' });
      mockPrisma.invoice.findFirst.mockResolvedValue(depositInvoice);
      mockPaystackService.initializeTransaction.mockResolvedValue({
        authorizationUrl: 'https://paystack.test/checkout/123',
        reference: 'ref-123',
      });

      const result = await service.payProposalDepositCard(lockedProposal.proposalCode, {});

      expect(result.checkoutUrl).toBe('https://paystack.test/checkout/123');
      expect(result.status).toBe('REDIRECT_REQUIRED');
      expect(result.invoiceNumber).toBe(depositInvoice.invoiceNumber);

      const initCall = mockPaystackService.initializeTransaction.mock.calls[0][0];
      expect(initCall.amount).toBe(50000);
      expect(initCall.currency).toBe('KES');
      expect(initCall.invoiceNumber).toBe(depositInvoice.invoiceNumber);
      expect(initCall.callbackUrl).toContain('/checkout/verify');

      expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idempotencyKey: 'PAYSTACK_ref-123',
          provider: 'PAYSTACK',
          method: 'CARD',
          status: 'PENDING',
        }),
      });
    });
  });

  describe('payProposalDepositMpesa()', () => {
    it('throws BadRequestException for non-KES proposals', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED', currency: 'USD' });
      mockPrisma.invoice.findFirst.mockResolvedValue({ ...depositInvoice, currency: 'USD' });

      await expect(
        service.payProposalDepositMpesa(lockedProposal.proposalCode, { mpesaPhoneNumber: '+254712345678' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends an STK push via Paystack when Daraja is not configured and records the payment log', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...lockedProposal, status: 'ACCEPTED' });
      mockPrisma.invoice.findFirst.mockResolvedValue(depositInvoice);
      mockPaystackService.chargeMpesaStk.mockResolvedValue({
        reference: 'stk-ref-1',
        displayText: 'Enter your M-Pesa PIN',
        raw: { data: {} },
      });

      const result = await service.payProposalDepositMpesa(lockedProposal.proposalCode, {
        mpesaPhoneNumber: '+254712345678',
      });

      expect(result.trackingId).toBe('stk-ref-1');
      expect(result.status).toBe('PENDING_STK_INPUT');

      expect(mockPaystackService.chargeMpesaStk).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000, invoiceNumber: depositInvoice.invoiceNumber }),
      );
      expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idempotencyKey: 'PAYSTACK_stk-ref-1',
          method: 'MPESA',
          status: 'PENDING',
        }),
      });
    });
  });
});
