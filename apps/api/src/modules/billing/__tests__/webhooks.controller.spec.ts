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
    paymentLog: { findUnique: jest.fn(), upsert: jest.fn(), create: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    subscription: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    plan: { findFirst: jest.fn() },
    wiseReceivingAccount: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: any) =>
      fn({
        invoice: { update: jest.fn() },
        subscription: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
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
