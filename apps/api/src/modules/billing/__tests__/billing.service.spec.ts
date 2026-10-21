import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockInvoice = {
  id: 'invoice-uuid-1',
  clientId: 'client-uuid-1',
  subscriptionId: 'sub-uuid-1',
  invoiceNumber: 'INV-2025-0001',
  amount: 199,
  currency: 'USD',
  status: 'SENT',
  dueDate: new Date('2025-07-01'),
  paidAt: null,
  client: { businessName: 'Acacia Healthcare', userId: 'user-uuid-1' },
};

const mockClient  = { id: 'client-uuid-1', userId: 'user-uuid-1' };
const adminUser   = { id: 'admin-uuid', roles: ['ADMIN'] };
const clientUser  = { id: 'user-uuid-1', roles: ['CLIENT'] };
const otherUser   = { id: 'other-uuid', roles: ['CLIENT'] };

const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    count:      jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  client:  { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  user:    { findUnique: jest.fn(), create: jest.fn() },
  plan:    { findUnique: jest.fn() },
  wiseReceivingAccount: { create: jest.fn() },
  paymentLog: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  subscription: { findMany: jest.fn() },
  $transaction: jest.fn((cb) => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
};

import { IntaSendService } from '../intasend.service';
import { PaystackService } from '../paystack.service';
import { WiseService } from '../wise.service';
import { ConfigService } from '@nestjs/config';

const mockIntaSendService = {
  createSubscriptionPlan: jest.fn(),
  subscribeMpesa: jest.fn(),
  createCardCheckout: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  getOrCreateCustomer: jest.fn(),
  triggerMpesaStkPush: jest.fn(),
  createCheckoutSession: jest.fn(),
  getPublishableKey: jest.fn(),
};

const mockPaystackService = {
  initializeTransaction: jest.fn(),
  chargeMpesaStk: jest.fn(),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(),
};

const mockWiseService = {
  getReceivingAccount: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  getManualSettlementInstructions: jest.fn().mockReturnValue({
    beneficiary: 'BazionWeb Technologies Ltd',
    accountNumber: 'TEST123',
    referenceNote: 'ref',
  }),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: any) => {
    if (key === 'FRONTEND_URL') return 'https://bazionweb.com';
    return def;
  }),
};

const mockEvents = { emit: jest.fn() };

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: IntaSendService, useValue: mockIntaSendService },
        { provide: PaystackService, useValue: mockPaystackService },
        { provide: WiseService, useValue: mockWiseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  // ── generate() ──────────────────────────────────────────────────────────────

  describe('generate()', () => {
    it('creates invoice with unique invoice number', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.generate({ clientId: 'client-uuid-1', amount: 199 });

      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(createCall.data.amount).toBe(199);
      expect(createCall.data.currency).toBe('USD');
      expect(createCall.data.status).toBe('SENT');
    });

    it('sets due date 14 days from now', async () => {
      mockPrisma.invoice.count.mockResolvedValue(5);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.generate({ clientId: 'client-uuid-1', amount: 99 });

      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      const dueDate = createCall.data.dueDate as Date;
      const diffDays = Math.round((dueDate.getTime() - Date.now()) / 86_400_000);
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(14);
    });

    it('emits invoice.created event', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.generate({ clientId: 'client-uuid-1', amount: 49 });

      expect(mockEvents.emit).toHaveBeenCalledWith('invoice.created', expect.any(Object));
    });

    it('stores optional subscription ID', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.generate({ clientId: 'client-uuid-1', subscriptionId: 'sub-uuid-1', amount: 199 });

      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.subscriptionId).toBe('sub-uuid-1');
    });
  });

  // ── markPaid() ──────────────────────────────────────────────────────────────

  describe('markPaid()', () => {
    it('sets status to PAID and paidAt timestamp', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'PAID', paidAt: new Date() });

      const result = await service.markPaid('invoice-uuid-1');

      const updateCall = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('PAID');
      expect(updateCall.data.paidAt).toBeInstanceOf(Date);
      expect(result.data.status).toBe('PAID');
    });

    it('emits invoice.paid event', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'PAID', paidAt: new Date() });

      await service.markPaid('invoice-uuid-1');

      expect(mockEvents.emit).toHaveBeenCalledWith('invoice.paid', expect.any(Object));
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.markPaid('missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all invoices for admin', async () => {
      mockPrisma.invoice.count.mockResolvedValue(3);
      mockPrisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      const result = await service.findAll(adminUser, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(3);
    });

    it('scopes invoices to own client for CLIENT role', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.invoice.count.mockResolvedValue(2);
      mockPrisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.findAll(clientUser, { scope: 'mine', page: 1, limit: 20 });

      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: clientUser.id } }),
      );
    });

    it('returns empty for client with no account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const result = await service.findAll(clientUser, { scope: 'mine', page: 1, limit: 20 });
      expect(result.data).toHaveLength(0);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns invoice for owner', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      const result = await service.findOne('invoice-uuid-1', clientUser);
      expect(result.data.id).toBe('invoice-uuid-1');
    });

    it('throws ForbiddenException for other user', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      await expect(service.findOne('invoice-uuid-1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-uuid', adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── markOverdueInvoices() (cron) ────────────────────────────────────────────

  describe('markOverdueInvoices()', () => {
    it('bulk-updates SENT invoices past due date', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 3 });

      await service.markOverdueInvoices();

      const updateCall = mockPrisma.invoice.updateMany.mock.calls[0][0];
      expect(updateCall.where.status).toBe('SENT');
      expect(updateCall.where.dueDate.lt).toBeInstanceOf(Date);
      expect(updateCall.data.status).toBe('OVERDUE');
    });

    it('emits overdue_batch event when invoices found', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 2 });
      await service.markOverdueInvoices();
      expect(mockEvents.emit).toHaveBeenCalledWith('invoice.overdue_batch', { count: 2 });
    });

    it('does not emit event when count is 0', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });
      await service.markOverdueInvoices();
      expect(mockEvents.emit).not.toHaveBeenCalled();
    });
  });

  // ── subscribeIntaSend() ───────────────────────────────────────────────────────

  describe('subscribeIntaSend()', () => {
    const mockPlan = {
      id: 'plan-growth',
      name: 'Growth',
      isActive: true,
      priceMonthlyKes: 12900,
      priceAnnualKes: 129000,
      priceMonthly: { toNumber: () => 99 },
      priceAnnual: { toNumber: () => 990 },
    };

    it('charges M-Pesa via Paystack primary (IntaSend not called)', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'client-uuid-1',
        email: 'test@example.com',
        phone: '254712345678',
        user: { firstName: 'Peter', lastName: 'Kimani' },
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-KE-12345678',
        amount: 12900,
      });
      mockPaystackService.chargeMpesaStk.mockResolvedValue({
        reference: 'MPESA_INV-KE-12345678',
        status: 'pay_offline',
        raw: { reference: 'MPESA_INV-KE-12345678' },
      });

      const result = await service.subscribeIntaSend(
        { id: 'user-uuid-1', email: 'test@example.com' },
        {
          planId: 'plan-growth',
          billingCycle: 'MONTHLY' as any,
          paymentMethod: 'MPESA',
          mpesaPhoneNumber: '0712345678',
        },
      );

      expect(mockPaystackService.chargeMpesaStk).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12900, phone: '0712345678' }),
      );
      expect(mockIntaSendService.triggerMpesaStkPush).not.toHaveBeenCalled();
      expect(result.provider).toBe('PAYSTACK');
      expect(result.invoiceNumber).toBe('INV-KE-12345678');
    });

    it('falls back to IntaSend when Paystack STK fails', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'client-uuid-1',
        email: 'test@example.com',
        phone: '254712345678',
        user: { firstName: 'Peter', lastName: 'Kimani' },
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-KE-12345678',
        amount: 12900,
      });
      mockPaystackService.chargeMpesaStk.mockRejectedValueOnce(new Error('Paystack down'));
      mockIntaSendService.triggerMpesaStkPush.mockResolvedValue({
        invoiceId: 'IS_INV_1',
        trackingId: 'IS_TRK_1',
        state: 'PENDING',
        customerMessage: 'Prompt sent',
      });

      const result = await service.subscribeIntaSend(
        { id: 'user-uuid-1', email: 'test@example.com' },
        {
          planId: 'plan-growth',
          billingCycle: 'MONTHLY' as any,
          paymentMethod: 'MPESA',
          mpesaPhoneNumber: '0712345678',
        },
      );

      expect(mockIntaSendService.triggerMpesaStkPush).toHaveBeenCalled();
      expect(result.provider).toBe('INTASEND_FALLBACK');
    });

    it('creates Paystack card checkout via subscribePaystack (server pricing)', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockPrisma.client.create.mockResolvedValue({
        id: 'client-new-1',
        email: 'carduser@example.com',
        phone: '254721287053',
        user: { firstName: 'Alice', lastName: 'Wambui' },
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-2',
        invoiceNumber: 'INV-KE-87654321',
        amount: 12900,
      });
      mockPaystackService.initializeTransaction.mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/abc',
        accessCode: 'acc',
        reference: 'ref_123',
      });

      const result = await service.subscribePaystack(
        { id: 'user-new', email: 'carduser@example.com', firstName: 'Alice', lastName: 'Wambui' },
        { planId: 'plan-growth', billingCycle: 'MONTHLY' as any, currency: 'KES' },
      );

      expect(mockPaystackService.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12900, currency: 'KES' }),
      );
      expect(result.method).toBe('CARD');
      expect(result.checkoutUrl).toBe('https://checkout.paystack.com/abc');
    });

    it('throws BadRequestException if plan is inactive or not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'client-uuid-1',
        user: { firstName: 'Peter' },
      });
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.subscribeIntaSend(
          { id: 'user-uuid-1' },
          {
            planId: 'non-existent',
            billingCycle: 'MONTHLY' as any,
            paymentMethod: 'MPESA',
            mpesaPhoneNumber: '0712345678',
          },
        ),
      ).rejects.toThrow();
    });

    it('throws BadRequestException if MPESA selected without phone number', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'client-uuid-1',
        user: { firstName: 'Peter' },
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(
        service.subscribeIntaSend(
          { id: 'user-uuid-1' },
          {
            planId: 'plan-growth',
            billingCycle: 'MONTHLY' as any,
            paymentMethod: 'MPESA',
          } as any,
        ),
      ).rejects.toThrow();
    });
  });

  // ── createBankTransferInvoice() (manual — Wise receiving unavailable in KE) ──

  describe('createBankTransferInvoice()', () => {
    it('creates invoice + manual receiving account from env bank details', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'corp-client-1',
        businessName: 'Acme Corp',
        contactName: 'John Doe',
        email: 'john@acmecorp.com',
        user: { firstName: 'John', lastName: 'Doe' },
      });

      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-enterprise',
        name: 'Enterprise',
        isActive: true,
        priceMonthly: { toNumber: () => 199 },
        priceAnnual: { toNumber: () => 1990 },
      });

      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-corp-1',
        invoiceNumber: 'B2B-INV-123456',
        amount: 199,
        currency: 'USD',
        dueDate: new Date(),
      });

      mockPrisma.wiseReceivingAccount.create.mockResolvedValue({
        id: 'rec-acc-1',
        accountHolder: 'BazionWeb Technologies Ltd',
        accountNumber: 'TEST123',
        routingNumber: null,
        swiftBic: 'TESTBIC',
        bankAddress: { country: 'Kenya' },
      });

      mockPrisma.paymentLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.createBankTransferInvoice(
        { id: 'corp-user-1', email: 'john@acmecorp.com' },
        {
          planId: 'plan-enterprise',
          billingCycle: 'MONTHLY' as any,
          currency: 'USD',
          purchaseOrderNumber: 'PO-999',
        },
      );

      expect(result.status).toBe('INVOICE_GENERATED');
      expect(result.provider).toBe('MANUAL_BANK_TRANSFER');
      expect(result.bankTransferDetails.accountNumber).toBe('TEST123');
      expect(mockWiseService.getManualSettlementInstructions).toHaveBeenCalled();
    });
  });

  // ── subscribePaystackGuest() — pay-first checkout ───────────────────────────

  describe('subscribePaystackGuest()', () => {
    const seedPrice = {
      id: 'plan-growth',
      name: 'Growth',
      isActive: true,
      priceMonthly: 59,
      priceAnnual: 590,
      priceMonthlyKes: 7700,
      priceAnnualKes: 77000,
    };

    const guestDto = {
      planId: 'plan-growth',
      billingCycle: 'MONTHLY' as any,
      currency: 'KES' as const,
      email: 'guest@example.com',
      firstName: 'Jane',
      lastName: 'Wanjiku',
    };

    it('creates a passwordless user, guest client, invoice and Paystack URL', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(seedPrice);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-guest-1', email: guestDto.email });
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockPrisma.client.create.mockResolvedValue({ id: 'client-guest-1', email: guestDto.email, planId: 'plan-growth' });
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-guest', invoiceNumber: 'INV-KE-0001', amount: 7700, currency: 'KES',
      });
      mockPrisma.paymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockPaystackService.initializeTransaction.mockResolvedValue({
        authorizationUrl: 'https://paystack.test/checkout',
        reference: 'ps_ref_1',
      });

      const result = await service.subscribePaystackGuest(guestDto);

      expect(result.status).toBe('REDIRECT_REQUIRED');
      expect(result.checkoutUrl).toContain('paystack');
      expect(result.invoiceNumber).toBe('INV-KE-0001');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      const createdUser = mockPrisma.user.create.mock.calls[0][0].data;
      expect(createdUser.role).toBe('CLIENT');
      expect(createdUser.passwordHash).toBeUndefined(); // claim sets it later
      const createdClient = mockPrisma.client.create.mock.calls[0][0].data;
      expect(createdClient.status).toBe('TRIAL');
      expect(createdClient.planId).toBe('plan-growth');
      const initCall = mockPaystackService.initializeTransaction.mock.calls[0][0];
      expect(initCall.amount).toBe(7700); // server pricebook, not client-supplied
      expect(initCall.metadata.guest).toBe(true);
    });

    it('reuses an existing email-identity and updates the plan intent', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(seedPrice);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-guest-1', email: guestDto.email });
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'client-guest-1', planId: 'plan-starter' });
      mockPrisma.client.update.mockResolvedValue({ id: 'client-guest-1', planId: 'plan-growth' });
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-2', invoiceNumber: 'INV-KE-0002', amount: 7700, currency: 'KES' });
      mockPrisma.paymentLog.create.mockResolvedValue({ id: 'log-2' });
      mockPaystackService.initializeTransaction.mockResolvedValue({ authorizationUrl: 'https://paystack.test/x', reference: 'ps_ref_2' });

      await service.subscribePaystackGuest(guestDto);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'client-guest-1' }, data: expect.objectContaining({ planId: 'plan-growth' }) }),
      );
    });

    it('rejects inactive or unknown plans', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.subscribePaystackGuest(guestDto)).rejects.toThrow(/inactive or does not exist/i);
    });

    it('rejects plans missing a price in the requested currency', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ ...seedPrice, priceMonthlyKes: null, priceMonthly: null });
      await expect(service.subscribePaystackGuest(guestDto)).rejects.toThrow(/price not configured/i);
    });
  });
});
