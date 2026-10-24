import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhooksController } from '../webhooks.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaystackService } from '../paystack.service';
import { PaymentSettlementService } from '../payment-settlement.service';

describe('WebhooksController Paystack activation', () => {
  let controller: WebhooksController;
  let prisma: any;
  let settlement: any;
  let txs: any[];

  const mockConfig = {
    get: jest.fn(() => 'test-secret-minimum-32-chars!!'),
  };

  const paidInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-KE-1',
    amount: 5000,
    currency: 'KES',
    clientId: 'client-1',
    subscriptionId: null,
    client: { planId: 'plan-growth' },
  };

  beforeEach(async () => {
    txs = [];
    const makeTx = () => ({
      client: { update: jest.fn().mockResolvedValue({}) },
      invoice: { update: jest.fn() },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'sub-new' }),
      },
      paymentLog: { upsert: jest.fn(), create: jest.fn() },
    });

    prisma = {
      client: { update: jest.fn().mockResolvedValue({}) },
      paymentLog: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(), create: jest.fn() },
      invoice: { findUnique: jest.fn().mockResolvedValue(paidInvoice), update: jest.fn() },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'sub-new' }),
      },
      $transaction: jest.fn(async (fn: any) => {
        const tx = makeTx();
        txs.push(tx);
        return fn(tx);
      }),
    };

    // settlement mock replays the logic tests need to verify
    settlement = {
      settlePaystackCharge: jest.fn(async (data: any) => {
        const reference = String(data.reference || '');
        const invoiceNumber = String(data.metadata?.invoiceNumber || '');
        const paidAmount = Number(data.amount) / 100;
        if (!reference) return { status: 'IGNORED_NO_REFERENCE' };
        const invoice = await prisma.invoice.findUnique({ where: { invoiceNumber } });
        if (!invoice) return { status: 'ORPHAN_TRANSACTION_RECORDED' };
        const expected = Number(invoice.amount);
        if (paidAmount < expected - 0.01) return { status: 'AMOUNT_MISMATCH' };
        await prisma.$transaction(async (tx: any) => {
          await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
          const metaPlanId = data.metadata?.planId || invoice.client?.planId;
          const metaCycle = data.metadata?.billingCycle || 'MONTHLY';
          if (invoice.subscriptionId) {
            await tx.subscription.update({ where: { id: invoice.subscriptionId }, data: { status: 'ACTIVE', planId: metaPlanId, billingCycle: metaCycle } });
          } else {
            const sub = await tx.subscription.create({ data: { clientId: invoice.clientId, planId: metaPlanId, status: 'ACTIVE', provider: 'PAYSTACK', billingCycle: metaCycle } });
            await tx.invoice.update({ where: { id: invoice.id }, data: { subscriptionId: sub.id } });
          }
          await tx.client.update({ where: { id: invoice.clientId }, data: { status: 'ACTIVE' } });
        });
        return { status: 'PROCESSED' };
      }),
      settleDarajaSuccess: jest.fn().mockResolvedValue({ ResultCode: 0, ResultDesc: 'Accepted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PaystackService, useValue: { verifyWebhookSignature: jest.fn() } },
        { provide: PaymentSettlementService, useValue: settlement },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  function paystackEvent(metadata: Record<string, unknown> = {}) {
    return {
      body: {
        event: 'charge.success',
        data: {
          reference: 'ps_ref_1',
          amount: 500000, // kobo -> 5000.00
          currency: 'KES',
          channel: 'card',
          metadata: { invoiceNumber: 'INV-KE-1', ...metadata },
        },
      },
    };
  }

  it('creates and activates a subscription when the payment comes from a guest (no linked sub, metadata plan)', async () => {
    const result = await controller.handlePaystackWebhook(paystackEvent({ planId: 'plan-growth', billingCycle: 'ANNUAL' }) as any, 'sig');

    expect(result.status).toBe('PROCESSED');
    const tx = txs[0];
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          planId: 'plan-growth',
          status: 'ACTIVE',
          provider: 'PAYSTACK',
          billingCycle: 'ANNUAL',
        }),
      }),
    );
    expect(tx.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'client-1' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
  });

  it('falls back to the client assigned plan when metadata is absent', async () => {
    const result = await controller.handlePaystackWebhook(paystackEvent() as any, 'sig');

    expect(result.status).toBe('PROCESSED');
    const tx = txs[0];
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planId: 'plan-growth' }) }),
    );
  });

  it('renews an existing subscription instead of creating a second one', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...paidInvoice, subscriptionId: 'sub-existing' });
    settlement.settlePaystackCharge.mockImplementationOnce(async (data: any) => {
      const invoice = await prisma.invoice.findUnique({ where: { invoiceNumber: String(data.metadata?.invoiceNumber || '') } });
      await prisma.$transaction(async (tx: any) => {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
        await tx.subscription.update({ where: { id: invoice.subscriptionId }, data: { status: 'ACTIVE', planId: data.metadata?.planId } });
        await tx.client.update({ where: { id: invoice.clientId }, data: { status: 'ACTIVE' } });
      });
      return { status: 'PROCESSED' };
    });

    const result = await controller.handlePaystackWebhook(paystackEvent({ planId: 'plan-growth' }) as any, 'sig');

    expect(result.status).toBe('PROCESSED');
    const tx = txs[0];
    expect(tx.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-existing' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('rejects short payments without activation', async () => {
    const result = await controller.handlePaystackWebhook(
      {
        body: {
          event: 'charge.success',
          data: {
            reference: 'ps_ref_2',
            amount: 1000, // 10.00 vs invoice 5000
            currency: 'KES',
            channel: 'card',
            metadata: { invoiceNumber: 'INV-KE-1' },
          },
        },
      } as any,
      'sig',
    );

    expect(result.status).toBe('AMOUNT_MISMATCH');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores non-success events', async () => {
    const result = await controller.handlePaystackWebhook({ body: { event: 'charge.failed', data: { reference: 'x' } } } as any, 'sig');
    expect(result.status).toBe('IGNORED');
  });
});
