import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhooksController } from '../webhooks.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaystackService } from '../paystack.service';
import { WiseService } from '../wise.service';

const SECRET = 'test-intasend-secret-minimum-32-chars!!';

function sign(body: unknown): string {
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(body)).digest('hex');
}

function mockPrisma() {
  return {
    client: { update: jest.fn().mockResolvedValue({}) },
    paymentLog: { findUnique: jest.fn(), upsert: jest.fn(), create: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    subscription: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    plan: { findFirst: jest.fn() },
    wiseReceivingAccount: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: any) =>
      fn({
        client: { update: jest.fn().mockResolvedValue({}) },
        invoice: { update: jest.fn() },
        subscription: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
        plan: { findFirst: jest.fn() },
        paymentLog: { upsert: jest.fn(), create: jest.fn() },
      }),
    ),
  };
}

describe('WebhooksController signatures', () => {
  let controller: WebhooksController;
  let prisma: ReturnType<typeof mockPrisma>;

  const paidInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    amount: 100,
    currency: 'KES',
    clientId: 'client-1',
    subscriptionId: null,
  };

  const mockConfig = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'INTASEND_SECRET_KEY') return SECRET;
      if (key === 'WISE_WEBHOOK_SECRET') return SECRET;
      if (key === 'PAYSTACK_SECRET_KEY') return SECRET;
      if (key === 'PAYSTACK_WEBHOOK_SECRET') return SECRET;
      return def;
    }),
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.paymentLog.findUnique.mockResolvedValue(null);
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: PaystackService,
          useValue: {
            verifyWebhookSignature: jest.fn((raw: any, sig?: string) => {
              const expected = crypto.createHmac('sha512', SECRET).update(raw).digest('hex');
              if (sig !== expected) throw new UnauthorizedException();
            }),
          },
        },
        {
          provide: WiseService,
          useValue: {
            verifyWebhookSignature: jest.fn((raw: any, sig?: string) => {
              const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
              if (sig !== expected) throw new UnauthorizedException();
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('rejects IntaSend webhooks with a missing signature', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100 };
    await expect(controller.handleIntaSendWebhook({ body } as any, undefined)).rejects.toThrow();
  });

  it('rejects IntaSend webhooks with a wrong signature', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100 };
    await expect(controller.handleIntaSendWebhook({ body } as any, 'deadbeef')).rejects.toThrow();
  });

  it('accepts a correctly signed IntaSend webhook', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100, account: '254700000000' };
    const result = await controller.handleIntaSendWebhook({ body } as any, sign(body));
    expect(result.status).toBe('PROCESSED');
  });

  it('refuses to mark PAID on a short payment', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 40, account: '254700000000' };
    const result = await controller.handleIntaSendWebhook({ body } as any, sign(body));
    expect(result.status).toBe('AMOUNT_MISMATCH');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still answers the IntaSend handshake challenge without a signature', async () => {
    const result = await controller.handleIntaSendWebhook({ body: { challenge: 'abc123' } } as any, undefined);
    expect(result).toEqual({ challenge: 'abc123' });
  });

  it('rejects Wise webhooks with a missing signature', async () => {
    await expect(
      controller.handleWiseWebhook({ body: { event_type: 'x' } } as any, undefined),
    ).rejects.toThrow();
  });
});

describe('WebhooksController Paystack activation', () => {
  let controller: WebhooksController;
  let prisma: any;
  let txs: any[];

  const mockConfig = {
    get: jest.fn(() => 'test-intasend-secret-minimum-32-chars!!'),
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: PaystackService,
          useValue: { verifyWebhookSignature: jest.fn() },
        },
        { provide: WiseService, useValue: { verifyWebhookSignature: jest.fn() } },
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
          amount: 500000, // kobo → 5000.00
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
