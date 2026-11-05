import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentSettlementService,
  checkoutLineItem,
} from '../payment-settlement.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaystackService } from '../paystack.service';
import {
  PaymentStatus,
  PaymentProvider,
  PaymentMethodType,
  InvoiceStatus,
} from '@prisma/client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const client = {
  id: 'client-1',
  planId: 'plan-growth',
  email: 'test@example.com',
  user: { passwordHash: 'hash' },
};

const baseInvoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  amount: 5000,
  currency: 'KES',
  clientId: 'client-1',
  subscriptionId: null as string | null,
  lineItems: [
    checkoutLineItem({
      description: 'BazionWeb Growth (MONTHLY)',
      amount: 5000,
      currency: 'KES',
      planId: 'plan-growth',
      billingCycle: 'MONTHLY',
      purpose: 'subscription',
    }),
  ],
  client,
};

function makePrisma(invoiceResult?: any) {
  const txList: any[] = [];
  const makeTx = () => ({
    invoice: { update: jest.fn().mockResolvedValue({}) },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'sub-new' }),
      update: jest.fn().mockResolvedValue({}),
    },
    client: { update: jest.fn().mockResolvedValue({}) },
    paymentLog: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
  });

  const p: any = {
    paymentLog: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoiceResult === undefined ? { ...baseInvoice } : invoiceResult),
    },
    $transaction: jest.fn(async (fn: any) => {
      const tx = makeTx();
      txList.push(tx);
      return fn(tx);
    }),
    _txs: () => txList,
  };
  return p;
}

function makePaystack(result?: any) {
  return {
    verifyTransaction: jest.fn().mockResolvedValue(
      result ?? {
        status: true,
        data: {
          status: 'success',
          reference: 'ps_ref',
          amount: 500000,
          currency: 'KES',
          channel: 'card',
          metadata: { invoiceNumber: 'INV-001', planId: 'plan-growth', billingCycle: 'MONTHLY' },
        },
      },
    ),
  };
}

async function build(prisma: any, paystack?: any) {
  const m: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentSettlementService,
      { provide: PrismaService, useValue: prisma },
      { provide: PaystackService, useValue: paystack ?? makePaystack() },
    ],
  }).compile();
  return m.get<PaymentSettlementService>(PaymentSettlementService);
}

// ── checkoutLineItem ──────────────────────────────────────────────────────────

describe('checkoutLineItem', () => {
  it('returns correct shape with all fields', () => {
    const item = checkoutLineItem({ description: 'T', amount: 100, planId: 'p1', billingCycle: 'MONTHLY', purpose: 'subscription' });
    expect(item).toMatchObject({ description: 'T', amount: 100, quantity: 1, planId: 'p1', billingCycle: 'MONTHLY', purpose: 'subscription' });
  });

  it('defaults quantity=1 and purpose=subscription', () => {
    const item = checkoutLineItem({ description: 'X', amount: 0 });
    expect(item.quantity).toBe(1);
    expect(item.purpose).toBe('subscription');
  });
});

// ── settlePaystackCharge ──────────────────────────────────────────────────────

describe('PaymentSettlementService.settlePaystackCharge', () => {
  it('returns IGNORED_NO_REFERENCE when reference is absent', async () => {
    const svc = await build(makePrisma());
    expect((await svc.settlePaystackCharge({ amount: 100, currency: 'KES' })).status).toBe('IGNORED_NO_REFERENCE');
  });

  it('returns ALREADY_PROCESSED and skips DB write when log succeeded', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      amount: 5000,
      currency: 'KES',
      method: PaymentMethodType.CARD,
      invoice: { invoiceNumber: 'INV-001', client: { email: 'x@x.com', user: { passwordHash: 'h' } } },
    });
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'KES' });
    expect(r.status).toBe('ALREADY_PROCESSED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records orphan log when no invoice is found', async () => {
    const prisma = makePrisma(null);
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'KES', metadata: { invoiceNumber: 'INV-MISS' } });
    expect(r.status).toBe('ORPHAN_TRANSACTION_RECORDED');
    expect(prisma.paymentLog.upsert).toHaveBeenCalled();
  });

  it('returns AMOUNT_MISMATCH when paid < invoice amount', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 1000, currency: 'KES', metadata: { invoiceNumber: 'INV-001' } });
    expect(r.status).toBe('AMOUNT_MISMATCH');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns AMOUNT_MISMATCH on currency mismatch', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'USD', metadata: { invoiceNumber: 'INV-001' } });
    expect(r.status).toBe('AMOUNT_MISMATCH');
  });

  it('settles invoice PAID and creates subscription on first payment', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({
      reference: 'ps_ref',
      amount: 500000,
      currency: 'KES',
      channel: 'card',
      metadata: { invoiceNumber: 'INV-001', planId: 'plan-growth', billingCycle: 'MONTHLY' },
    });
    expect(r.status).toBe('PROCESSED');
    expect(r.claimed).toBe(true);
    const tx = prisma._txs()[0];
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }));
    expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientId: 'client-1', status: 'ACTIVE', provider: PaymentProvider.PAYSTACK }),
    }));
    expect(tx.client.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }));
  });

  it('updates an existing linked subscription on renewal', async () => {
    const prisma = makePrisma({ ...baseInvoice, subscriptionId: 'sub-existing' });
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'KES', channel: 'card', metadata: { invoiceNumber: 'INV-001' } });
    expect(r.status).toBe('PROCESSED');
    const tx = prisma._txs()[0];
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sub-existing' } }));
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('reuses an active subscription when invoice has no linked sub', async () => {
    const prisma2 = makePrisma();
    prisma2.$transaction.mockImplementation(async (fn: any) => {
      const tx: any = {
        invoice: { update: jest.fn().mockResolvedValue({}) },
        subscription: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sub-existing' }),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
        client: { update: jest.fn().mockResolvedValue({}) },
        paymentLog: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
      };
      return fn(tx);
    });
    const svc2 = await build(prisma2);
    const r = await svc2.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'KES', channel: 'card', metadata: { invoiceNumber: 'INV-001' } });
    expect(r.status).toBe('PROCESSED');
  });

  it('identifies mobile_money channel and still processes', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({ reference: 'ps_ref', amount: 500000, currency: 'KES', channel: 'mobile_money', metadata: { invoiceNumber: 'INV-001' } });
    expect(r.status).toBe('PROCESSED');
  });

  it('settles a USD subscription invoice with cart add-ons paid in KES when linked PENDING paymentLog matches', async () => {
    const usdInvoice = {
      ...baseInvoice,
      id: 'inv-usd-cart',
      invoiceNumber: 'INV-USD-001',
      amount: 174,
      currency: 'USD',
      lineItems: [
        checkoutLineItem({
          description: 'BazionWeb Care Essential (monthly) — card',
          amount: 75,
          currency: 'USD',
          planId: 'plan-care-essential',
          billingCycle: 'MONTHLY',
          purpose: 'subscription',
        }),
        checkoutLineItem({
          description: 'Add-on — business x1 (year)',
          amount: 99,
          currency: 'USD',
          productId: 'host-business',
          qty: 1,
          purpose: 'subscription',
        }),
      ],
    };
    const prisma = makePrisma(usdInvoice);
    prisma.paymentLog.findUnique.mockResolvedValue({
      id: 'plog-fx-1',
      status: PaymentStatus.PENDING,
      amount: 22533, // Math.round(174 * 129.5)
      currency: 'KES',
      method: PaymentMethodType.CARD,
      invoice: usdInvoice,
    });

    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({
      reference: 'ps_ref_fx_cart',
      amount: 2253300, // subunits
      currency: 'KES',
      channel: 'card',
      metadata: {
        invoiceNumber: 'INV-USD-001',
        planId: 'plan-care-essential',
        billingCycle: 'MONTHLY',
        fxConverted: true,
        originalAmount: 174,
        originalCurrency: 'USD',
        exchangeRate: 129.5,
      },
    });

    expect(r.status).toBe('PROCESSED');
    expect(r.invoiceNumber).toBe('INV-USD-001');
    const tx = prisma._txs()[0];
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-usd-cart' },
        data: expect.objectContaining({ status: InvoiceStatus.PAID }),
      }),
    );
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          planId: 'plan-care-essential',
          status: 'ACTIVE',
          provider: PaymentProvider.PAYSTACK,
        }),
      }),
    );
  });

  it('settles a USD invoice via fxConverted metadata when no prior paymentLog exists and records KES settlement currency', async () => {
    const usdInvoice = {
      ...baseInvoice,
      id: 'inv-usd-meta',
      invoiceNumber: 'INV-USD-002',
      amount: 75,
      currency: 'USD',
    };
    const prisma = makePrisma(usdInvoice);
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({
      reference: 'ps_ref_fx_meta',
      amount: 971300, // 9713 KES = Math.round(75 * 129.5)
      currency: 'KES',
      channel: 'card',
      metadata: {
        invoiceNumber: 'INV-USD-002',
        planId: 'plan-growth',
        billingCycle: 'MONTHLY',
        fxConverted: true,
        originalAmount: 75,
        originalCurrency: 'USD',
        exchangeRate: 129.5,
      },
    });

    expect(r.status).toBe('PROCESSED');
    const tx = prisma._txs()[0];
    expect(tx.paymentLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          amount: 9713,
          currency: 'KES',
          status: PaymentStatus.SUCCESS,
        }),
      }),
    );
  });

  it('rejects fxConverted metadata settlement with AMOUNT_MISMATCH when paidAmount is below converted expected amount', async () => {
    const usdInvoice = {
      ...baseInvoice,
      id: 'inv-usd-underpaid',
      invoiceNumber: 'INV-USD-003',
      amount: 174,
      currency: 'USD',
    };
    const prisma = makePrisma(usdInvoice);
    const svc = await build(prisma);
    const r = await svc.settlePaystackCharge({
      reference: 'ps_ref_fx_underpaid',
      amount: 100, // Only 1 KES paid instead of 22,533 KES!
      currency: 'KES',
      channel: 'card',
      metadata: {
        invoiceNumber: 'INV-USD-003',
        fxConverted: true,
        originalAmount: 174,
        originalCurrency: 'USD',
        exchangeRate: 129.5,
      },
    });

    expect(r.status).toBe('AMOUNT_MISMATCH');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── confirmPaystackReference ──────────────────────────────────────────────────

describe('PaymentSettlementService.confirmPaystackReference', () => {
  it('returns MISSING_REFERENCE for empty string', async () => {
    const svc = await build(makePrisma());
    const r = await svc.confirmPaystackReference('');
    expect(r.status).toBe('MISSING_REFERENCE');
    expect(r.paid).toBe(false);
  });

  it('returns ALREADY_PROCESSED without calling Paystack API', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      amount: 5000,
      currency: 'KES',
      method: PaymentMethodType.CARD,
      invoice: { invoiceNumber: 'INV-001', client: { email: 'x@x.com', user: { passwordHash: 'h' } } },
    });
    const paystack = makePaystack();
    const svc = await build(prisma, paystack);
    const r = await svc.confirmPaystackReference('ps_ref');
    expect(r.status).toBe('ALREADY_PROCESSED');
    expect(r.paid).toBe(true);
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });

  it('returns paid=false when Paystack verification fails', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma, makePaystack({ status: true, data: { status: 'failed' } }));
    const r = await svc.confirmPaystackReference('ps_ref');
    expect(r.paid).toBe(false);
  });

  it('settles a freshly verified transaction and returns paid=true', async () => {
    const prisma = makePrisma();
    const svc = await build(prisma);
    const r = await svc.confirmPaystackReference('ps_ref');
    expect(r.paid).toBe(true);
  });
});

// ── paymentStatus ─────────────────────────────────────────────────────────────

describe('PaymentSettlementService.paymentStatus', () => {
  it('returns UNKNOWN for empty ref', async () => {
    const svc = await build(makePrisma());
    expect((await svc.paymentStatus('')).status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when no log found', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findFirst.mockResolvedValue(null);
    const svc = await build(prisma);
    expect((await svc.paymentStatus('ps_ref')).status).toBe('UNKNOWN');
  });

  it('returns log status and invoiceNumber when log exists', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findFirst.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      invoice: { invoiceNumber: 'INV-001', status: InvoiceStatus.PAID },
    });
    const svc = await build(prisma);
    const r = await svc.paymentStatus('ps_ref');
    expect(r.status).toBe(PaymentStatus.SUCCESS);
    expect(r.invoiceNumber).toBe('INV-001');
    expect(r.invoiceStatus).toBe(InvoiceStatus.PAID);
  });
});

// ── settleDarajaSuccess ───────────────────────────────────────────────────────

describe('PaymentSettlementService.settleDarajaSuccess', () => {
  const args = { checkoutRequestId: 'ws_CO_1', receiptNumber: 'PXY12345', paidAmount: 5000, payload: {} };

  it('returns Accepted immediately when already SUCCESS', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({ status: PaymentStatus.SUCCESS, invoice: null });
    const svc = await build(prisma);
    expect(await svc.settleDarajaSuccess(args)).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records orphan and returns Accepted when no invoice is linked', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({ status: PaymentStatus.PENDING, invoice: null });
    const svc = await build(prisma);
    const r = await svc.settleDarajaSuccess(args);
    expect(r).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    expect(prisma.paymentLog.upsert).toHaveBeenCalled();
  });

  it('handles null log as orphan', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue(null);
    const svc = await build(prisma);
    const r = await svc.settleDarajaSuccess(args);
    expect(r).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  it('records amount mismatch without running full transaction', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({
      status: PaymentStatus.PENDING,
      invoice: { ...baseInvoice, client: { planId: 'plan-growth' } },
    });
    const svc = await build(prisma);
    const r = await svc.settleDarajaSuccess({ ...args, paidAmount: 10 });
    expect(r).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.paymentLog.update).toHaveBeenCalled();
  });

  it('settles invoice PAID and activates subscription on success', async () => {
    const prisma = makePrisma();
    prisma.paymentLog.findUnique.mockResolvedValue({
      status: PaymentStatus.PENDING,
      invoice: { ...baseInvoice, client: { planId: 'plan-growth' } },
    });
    const svc = await build(prisma);
    const r = await svc.settleDarajaSuccess(args);
    expect(r).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    const tx = prisma._txs()[0];
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }));
    expect(tx.client.update).toHaveBeenCalled();
  });
});




