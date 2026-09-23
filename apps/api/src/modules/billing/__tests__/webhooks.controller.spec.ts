import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhooksController } from '../webhooks.controller';
import { PrismaService } from '../../../prisma/prisma.service';

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
        paymentLog: {
          upsert: jest.fn(),
          create: jest.fn(),
        },
      }),
    ),
  };
}

describe('WebhooksController signatures', () => {
  let controller: WebhooksController;
  let prisma: ReturnType<typeof mockPrisma>;
  const OLD_ENV = process.env;

  const paidInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    amount: 100,
    currency: 'USD',
    clientId: 'client-1',
    subscriptionId: null,
  };

  beforeEach(async () => {
    process.env = { ...OLD_ENV, INTASEND_SECRET_KEY: SECRET, WISE_WEBHOOK_SECRET: SECRET };
    prisma = mockPrisma();
    prisma.paymentLog.findUnique.mockResolvedValue(null);
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('rejects IntaSend webhooks with a missing signature when a secret is configured', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100 };
    await expect(controller.handleIntaSendWebhook({ body } as any, undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects IntaSend webhooks with a wrong signature', async () => {
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100 };
    await expect(controller.handleIntaSendWebhook({ body } as any, 'deadbeef')).rejects.toThrow(
      UnauthorizedException,
    );
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

  it('accepts unsigned webhooks only while the secret is a placeholder (dev)', async () => {
    process.env.INTASEND_SECRET_KEY = 'ISSecretKey_sandbox_placeholder';
    const body = { invoice_id: 'x', state: 'COMPLETE', api_ref: 'INV-1', value: 100, account: '254700000000' };
    const result = await controller.handleIntaSendWebhook({ body } as any, undefined);
    expect(result.status).toBe('PROCESSED');
  });

  it('rejects Wise webhooks with a missing signature when a secret is configured', async () => {
    await expect(
      controller.handleWiseWebhook({ body: { event_type: 'x' } } as any, undefined),
    ).rejects.toThrow(UnauthorizedException);
  });
});
