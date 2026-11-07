import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  BadRequestException, 
  ConflictException,
  ServiceUnavailableException,
  Logger 
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  BillingCycle, 
  SubscriptionStatus, 
  PaymentProvider, 
  PaymentMethodType, 
  PaymentStatus, 
  InvoiceStatus 
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { DarajaService } from './daraja.service';
import { 
  MpesaSubscriptionDto, 
  PaystackSubscriptionDto, 
  BankTransferInvoiceDto, 
  GuestSubscriptionDto, 
  GuestMpesaSubscriptionDto, 
  GuestBankTransferInvoiceDto,
  PayInvoiceMpesaDto,
  PayInvoiceCardDto,
  AcceptProposalDto,
  ProposalDepositCardDto,
  ProposalDepositMpesaDto,
  CartExtraDto
} from './dto/billing.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { checkoutLineItem, PaymentSettlementService } from './payment-settlement.service';
import {
  CANONICAL_CATALOG_PRICES,
  CanonicalCatalogEntry,
  resolveCanonicalProductId,
} from '../pricing/canonical-catalog';
import {
  computeDocumentFingerprint,
  InvoicePdfGenerator,
  OFFICIAL_BAZION_KRA_PIN,
  OFFICIAL_BAZION_PAYMENT_DETAILS,
  resolveSupplierTaxPin,
  isSupplierVatRegistered,
} from './invoice-pdf.generator';

/** JWT audience for short-lived invoice PDF download links. */
const INVOICE_DOWNLOAD_AUDIENCE = 'bazionweb:invoice-download';

export interface InvoiceBreakdown {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  vatLabel: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  isInclusive: boolean;
  /** False when the supplier is not VAT-registered (no VAT may be charged or shown). */
  vatRegistered: boolean;
}

@Injectable()
export class BillingService {

  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly paystackService: PaystackService,
    private readonly darajaService: DarajaService,
    private readonly settlement: PaymentSettlementService,
    private readonly config: ConfigService,
  ) {}

  private async resolveClient(user: any, fallback: { businessName: string; contactName: string; email: string; phone?: string; planId: string }) {
    let client = await this.prisma.client.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          userId: user.id,
          businessName: fallback.businessName,
          contactName: fallback.contactName,
          email: fallback.email,
          phone: fallback.phone,
          planId: fallback.planId,
        },
        include: { user: true },
      });
    }
    return client;
  }

  /** Server-side pricebook lookup — client never sends amount. */
  private toNumber(v: any): number {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    if (typeof v.toNumber === 'function') return Number(v.toNumber());
    return Number(v.toString ? v.toString() : v);
  }

  private planAmount(plan: any, billingCycle: BillingCycle, currency: 'KES' | 'USD' | 'EUR' | 'GBP'): number {
    const isKes = currency === 'KES';
    const monthlyRate = isKes
      ? (plan.priceMonthlyKes != null ? this.toNumber(plan.priceMonthlyKes) : this.toNumber(plan.priceMonthly) * 130)
      : this.toNumber(plan.priceMonthly);

    const annualRate = isKes
      ? (plan.priceAnnualKes != null ? this.toNumber(plan.priceAnnualKes) : (plan.priceAnnual != null ? this.toNumber(plan.priceAnnual) * 130 : Math.round(monthlyRate * 12 * 0.80)))
      : (plan.priceAnnual != null ? this.toNumber(plan.priceAnnual) : Math.round(monthlyRate * 12 * 0.80));

    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        return monthlyRate;
      case BillingCycle.QUARTERLY:
        return Math.round(monthlyRate * 3 * 0.95);
      case BillingCycle.SEMI_ANNUALLY:
        return Math.round(monthlyRate * 6 * 0.90);
      case BillingCycle.ANNUAL:
        return annualRate;
      case BillingCycle.BIENNIAL:
        return Math.round(monthlyRate * 24 * 0.68);
      case BillingCycle.TRIENNIAL:
        return Math.round(monthlyRate * 36 * 0.60);
      default:
        return monthlyRate;
    }
  }

  private newInvoiceNumber(prefix: string): string {
    return `${prefix}-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private getManualSettlementInstructions(currency: 'USD' | 'EUR' | 'GBP', paymentReference: string) {
    const cleanEnv = (val?: string | null) => {
      const v = (val || '').trim();
      return v && !v.includes('CHANGE_ME') ? v : '';
    };
    const beneficiary =
      cleanEnv(this.config.get<string>('BANK_BENEFICIARY')) ||
      OFFICIAL_BAZION_PAYMENT_DETAILS.bankAccountName;
    const accountNumber =
      cleanEnv(this.config.get<string>('BANK_ACCOUNT_NUMBER')) ||
      OFFICIAL_BAZION_PAYMENT_DETAILS.bankAccountNumber;
    const routingNumber = cleanEnv(this.config.get<string>('BANK_ROUTING_NUMBER'));
    const iban = cleanEnv(this.config.get<string>('BANK_IBAN'));
    const swiftBic =
      cleanEnv(this.config.get<string>('BANK_SWIFT_BIC')) ||
      OFFICIAL_BAZION_PAYMENT_DETAILS.bankSwiftCode;
    const line =
      cleanEnv(this.config.get<string>('BANK_ADDRESS_LINE')) ||
      `${OFFICIAL_BAZION_PAYMENT_DETAILS.bankName} - ${OFFICIAL_BAZION_PAYMENT_DETAILS.bankBranch}`;
    const city = cleanEnv(this.config.get<string>('BANK_ADDRESS_CITY')) || 'Nairobi';
    const country = cleanEnv(this.config.get<string>('BANK_ADDRESS_COUNTRY')) || 'Kenya';

    return {
      beneficiary,
      accountNumber: accountNumber || undefined,
      routingNumber: routingNumber || undefined,
      iban: iban || undefined,
      swiftBic: swiftBic || undefined,
      bankAddress:
        line || city || country
          ? { addressFirstLine: line, city, country }
          : undefined,
      referenceNote: `Quote payment reference "${paymentReference}" on your bank remittance advice.`,
    };
  }

  async findAll(user: any, filters: { scope?: string; status?: string; page: number; limit: number }) {
    const page = Math.max(1, Math.floor(Number(filters.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit) || 20)));
    const isStaff = ['ADMIN', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = {};

    if (!isStaff || filters.scope === 'mine') {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      where.clientId = client.id;
    }

    if (filters.status) {
      const normalizedStatus = filters.status.toUpperCase();
      if (!Object.values(InvoiceStatus).includes(normalizedStatus as InvoiceStatus)) {
        throw new BadRequestException(`Invalid invoice status filter: ${filters.status}`);
      }
      where.status = normalizedStatus;
    }

    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { 
          client: { select: { businessName: true, email: true } },
          wiseReceivingAccount: true,
          paymentLogs: {
            where: { status: PaymentStatus.SUCCESS },
            select: {
              providerRef: true,
              provider: true,
              method: true,
              createdAt: true,
              status: true,
              amount: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Attach a server-computed tax breakdown so every surface (portal table,
    // statement modal, PDF) shows the same VAT split from the Market table.
    const taxByCurrency = new Map<string, { vatRate: number; isInclusive: boolean }>();
    for (const currency of new Set(items.map((i) => i.currency))) {
      taxByCurrency.set(currency, await this.resolveInvoiceTax(currency));
    }

    return {
      data: items.map((inv) => ({
        ...inv,
        breakdown: this.calculateInvoiceBreakdown(inv, taxByCurrency.get(inv.currency)),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { 
        client: {
          include: {
            plan: true,
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, role: true },
            },
          },
        }, 
        subscription: true,
        wiseReceivingAccount: true,
        paymentLogs: {
          select: {
            id: true,
            provider: true,
            providerRef: true,
            method: true,
            amount: true,
            currency: true,
            status: true,
            errorMessage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const isStaff = ['ADMIN', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && invoice.client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return { data: invoice };
  }

  /**
   * Resolves an optional Care Plan selection.
   * When the client checks out a cart stack without an optional Step 4 Care Plan
   * (`planId === 'none'` or omitted while `extras` are present), `plan` is null
   * so no care plan fee is charged, and a fallback plan ID is resolved only to
   * satisfy the non-nullable `Client.planId` foreign key in Prisma.
   */
  private async resolvePlanSelection(
    planId: string | undefined,
    extras: CartExtraDto[] | undefined,
    opts: { requireActive?: boolean; notFoundMessage?: string } = {},
  ): Promise<{ plan: any | null; clientPlanId: string }> {
    const requireActive = opts.requireActive ?? true;
    const notFoundMessage =
      opts.notFoundMessage ?? 'The selected subscription plan is inactive or does not exist.';

    const isNoCarePlan = !planId || planId === 'none';
    if (isNoCarePlan) {
      if (!extras || extras.length === 0) {
        throw new BadRequestException(notFoundMessage);
      }
      const fallbackPlan =
        typeof (this.prisma.plan as any)?.findFirst === 'function'
          ? await (this.prisma.plan as any).findFirst({ where: { isActive: true } })
          : null;
      return {
        plan: null,
        clientPlanId: fallbackPlan?.id || 'plan-starter',
      };
    }

    let plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan && typeof (this.prisma.plan as any)?.findFirst === 'function') {
      plan = await (this.prisma.plan as any).findFirst({ where: { slug: planId } });
    }
    if (!plan || (requireActive && !plan.isActive)) {
      throw new BadRequestException(notFoundMessage);
    }

    return { plan, clientPlanId: plan.id };
  }

  /**
   * Track A: M-Pesa STK (KES) — Paystack STK Push.
   */
  async subscribeMpesa(user: any, dto: MpesaSubscriptionDto) {
    if (!dto.mpesaPhoneNumber) {
      throw new BadRequestException('Phone number is required to trigger M-Pesa prompt.');
    }
    const { plan, clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras);

    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Organisation` : 'BazionWeb Client',
      contactName: `${user.firstName || 'Valued'} ${user.lastName || 'Client'}`.trim(),
      email: user.email,
      phone: dto.mpesaPhoneNumber,
      planId: clientPlanId,
    });

    return this.initMpesaStk({
      client,
      userId: user.id,
      phone: dto.mpesaPhoneNumber,
      plan,
      billingCycle: dto.billingCycle,
      extras: dto.extras,
    });
  }

  /**
   * Shared M-Pesa STK initiation via Paystack / Daraja.
   * Used by both the authenticated route and guest (pay-first) checkout.
   * `invoice` is pre-created; PaymentLog links the STK attempt to it so the
   * Daraja/Paystack webhooks settle THAT invoice on success.
   */
  private async pushMpesaStk(args: {
    client: { id: string; email: string; user?: { firstName?: string | null; lastName?: string | null } | null };
    userId: string | null;
    phone: string;
    invoice: { id: string; invoiceNumber: string; amount: number; currency: string };
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    const { client, userId, phone, invoice, description, metadata } = args;
    const amount = Number(invoice.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invoice amount is not configured for M-Pesa payment.');
    }

    const hasDaraja = Boolean(
      this.config.get<string>('DARAJA_CONSUMER_KEY') &&
      this.config.get<string>('DARAJA_CONSUMER_SECRET')
    );

    if (hasDaraja) {
      try {
        const stk = await this.darajaService.initiateStkPush({
          phone,
          amount,
          invoiceNumber: invoice.invoiceNumber,
          description,
        });

        await this.prisma.paymentLog.create({
          data: {
            idempotencyKey: `DARAJA_${stk.checkoutRequestId}`,
            provider: PaymentProvider.DARAJA,
            providerRef: stk.checkoutRequestId,
            method: PaymentMethodType.MPESA,
            amount,
            currency: 'KES',
            status: PaymentStatus.PENDING,
            clientId: client.id,
            invoiceId: invoice.id,
            ...(userId ? { userId } : {}),
            rawPayload: stk as any,
          },
        });

        return {
          status: 'PENDING_STK_INPUT',
          method: 'MPESA',
          provider: 'DARAJA',
          message:
            stk.customerMessage || 'M-Pesa prompt sent! Check your handset and enter PIN to complete.',
          invoiceNumber: invoice.invoiceNumber,
          trackingId: stk.checkoutRequestId,
        };
      } catch (err: any) {
        this.logger.warn(`Daraja STK push failed for ${invoice.invoiceNumber}, falling back to Paystack: ${err?.message}`);
      }
    }

    const stk = await this.paystackService.chargeMpesaStk({
      email: client.email,
      amount,
      phone,
      invoiceNumber: invoice.invoiceNumber,
      metadata: { clientId: client.id, ...(metadata ?? {}) },
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${stk.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: stk.reference,
        method: PaymentMethodType.MPESA,
        amount,
        currency: 'KES',
        status: PaymentStatus.PENDING,
        clientId: client.id,
        invoiceId: invoice.id,
        ...(userId ? { userId } : {}),
        rawPayload: stk.raw as any,
      },
    });

    return {
      status: 'PENDING_STK_INPUT',
      method: 'MPESA',
      provider: 'PAYSTACK',
      message:
        stk.displayText || 'M-Pesa prompt sent! Check your handset and enter PIN to complete.',
      invoiceNumber: invoice.invoiceNumber,
      trackingId: stk.reference,
    };
  }

  /**
   * Shared M-Pesa STK initiation via Paystack.
   * Used by both the authenticated route and guest (pay-first) checkout.
   */
  private async initMpesaStk(args: {
    client: { id: string; email: string; user?: { firstName?: string | null; lastName?: string | null } | null };
    userId: string | null;
    phone: string;
    plan: { id: string; name: string } | null;
    billingCycle: BillingCycle;
    extras?: CartExtraDto[];
  }) {
    const { client, userId, phone, plan, billingCycle } = args;

    let amount = 0;
    if (plan) {
      amount = this.planAmount(plan, billingCycle, 'KES');
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('Plan price is not configured for KES');
      }
    }

    const linePurpose = plan ? 'subscription' : 'invoice_payment';
    const { lineItems: extraItems, total: extrasTotal } = await this.priceCartExtras('KES', args.extras, linePurpose);
    const total = Math.round((amount + extrasTotal) * 100) / 100;
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Checkout total must be greater than zero.');
    }

    const invoiceNumber = this.newInvoiceNumber('INV-KE');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const invoiceLineItems = [
      ...(plan
        ? [
            checkoutLineItem({
              description: `BazionWeb ${plan.name} (${billingCycle}) Maintenance & Infrastructure`,
              amount,
              currency: 'KES',
              planId: plan.id,
              billingCycle,
              purpose: 'subscription',
            }),
          ]
        : []),
      ...extraItems,
    ];

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        amount: total,
        currency: 'KES',
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: invoiceLineItems,
      },
    });

    return this.pushMpesaStk({
      client,
      userId,
      phone,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: total, currency: invoice.currency },
      description: plan ? `BazionWeb ${plan.name}` : 'BazionWeb Digital Stack',
      metadata: plan
        ? { planId: plan.id, billingCycle }
        : { purpose: 'invoice_payment', billingCycle },
    });
  }

  async queryMpesaStatus(checkoutRequestId: string) {
    const ref = String(checkoutRequestId || '').trim();
    if (!ref) throw new BadRequestException('Missing checkout request id');

    const log = await this.prisma.paymentLog.findFirst({
      where: {
        OR: [
          { idempotencyKey: `DARAJA_${ref}` },
          { idempotencyKey: `PAYSTACK_${ref}` },
          { providerRef: ref },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!log) {
      throw new NotFoundException('No matching checkout was found');
    }
    if (log.status === PaymentStatus.SUCCESS || log.status === PaymentStatus.FAILED) {
      return {
        responseCode: log.status === PaymentStatus.SUCCESS ? '0' : '1',
        resultCode: log.status === PaymentStatus.SUCCESS ? '0' : '1',
        resultDesc: log.status,
        checkoutRequestId: ref,
      };
    }
    if (log.provider !== PaymentProvider.DARAJA) {
      return {
        responseCode: '0',
        resultCode: '0',
        resultDesc: log.status,
        checkoutRequestId: ref,
      };
    }
    return this.darajaService.queryStkStatus(ref);
  }

  /** Shared ownership + payability validation for invoice payment rails. */
  private async assertPayableInvoice(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: { include: { user: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const isStaff = ['ADMIN', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    if (!isStaff && invoice.client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('This invoice is already settled and cannot accept new payments.');
    }

    return invoice;
  }

  /**
   * Settle an existing PENDING/OVERDUE invoice with an M-Pesa STK Push.
   * The webhook (Daraja or Paystack) marks the invoice PAID on success.
   */
  async payInvoiceMpesa(user: any, id: string, dto: PayInvoiceMpesaDto) {
    const invoice = await this.assertPayableInvoice(id, user);

    if (invoice.currency !== 'KES') {
      throw new BadRequestException(
        'M-Pesa is only available for KES invoices — settle this invoice by card instead.'
      );
    }

    return this.pushMpesaStk({
      client: invoice.client,
      userId: user.id,
      phone: dto.mpesaPhoneNumber,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: Number(invoice.amount), currency: invoice.currency },
      description: `BazionWeb invoice ${invoice.invoiceNumber}`,
      metadata: { purpose: 'invoice_payment' },
    });
  }

  /**
   * Settle an existing PENDING/OVERDUE invoice by card via a Paystack redirect.
   * The Paystack webhook marks the invoice PAID on success.
   */
  async payInvoiceCard(user: any, id: string, dto: PayInvoiceCardDto) {
    const invoice = await this.assertPayableInvoice(id, user);

    const amount = Number(invoice.amount);
    if (invoice.currency !== 'KES' && invoice.currency !== 'USD') {
      throw new BadRequestException(
        `Card checkout does not support ${invoice.currency} invoices — use M-Pesa or bank transfer.`
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invoice amount is not configured for card payment.');
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');
    const { init, chargedAmount, chargedCurrency, fxConverted, exchangeRate } =
      await this.initializePaystackWithFxFallback({
        email: dto.email || invoice.client.email || user.email,
        amount,
        currency: invoice.currency as 'KES' | 'USD',
        invoiceNumber: invoice.invoiceNumber,
        callbackUrl: `${frontendUrl}/portal/invoices?card_settled=1`,
        metadata: { clientId: invoice.clientId, purpose: 'invoice_payment', invoiceNumber: invoice.invoiceNumber },
      });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount: chargedAmount,
        currency: chargedCurrency,
        status: PaymentStatus.PENDING,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: {
          ...init,
          fxConverted,
          originalAmount: amount,
          originalCurrency: invoice.currency,
          exchangeRate,
        } as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
      chargedAmount,
      chargedCurrency,
      fxConverted,
      exchangeRate,
    };
  }

  /**
   * Track A2: Paystack card checkout (KES/USD). Server-side pricing only.
   * Uses initializePaystackWithFxFallback so USD checkouts automatically convert
   * to KES when the merchant does not yet have a USD settlement account enabled.
   */
  async subscribePaystack(user: any, dto: PaystackSubscriptionDto) {
    const { plan, clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras);

    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Organisation` : 'BazionWeb Client',
      contactName: `${user.firstName || 'Valued'} ${user.lastName || 'Client'}`.trim(),
      email: dto.email || user.email,
      phone: user.phone,
      planId: clientPlanId,
    });

    let amount = 0;
    if (plan) {
      amount = this.planAmount(plan, dto.billingCycle, dto.currency);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
      }
    }

    const linePurpose = plan ? 'subscription' : 'invoice_payment';
    const { lineItems: extraItems, total: extrasTotal } = await this.priceCartExtras(dto.currency, dto.extras, linePurpose);
    const total = Math.round((amount + extrasTotal) * 100) / 100;
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Checkout total must be greater than zero.');
    }

    const invoiceNumber = this.newInvoiceNumber(dto.currency === 'KES' ? 'INV-KE' : 'INV-USD');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');

    const invoiceLineItems = [
      ...(plan
        ? [
            checkoutLineItem({
              description: `BazionWeb ${plan.name} (${dto.billingCycle}) — card`,
              amount,
              currency: dto.currency,
              planId: plan.id,
              billingCycle: dto.billingCycle,
              purpose: 'subscription',
            }),
          ]
        : []),
      ...extraItems,
    ];

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        amount: total,
        currency: dto.currency,
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: invoiceLineItems,
      },
    });

    const { init, chargedAmount, chargedCurrency, fxConverted, exchangeRate } =
      await this.initializePaystackWithFxFallback({
        email: dto.email || client.email,
        amount: total,
        currency: dto.currency,
        invoiceNumber: invoice.invoiceNumber,
        callbackUrl: `${frontendUrl}/checkout/verify`,
        metadata: plan
          ? { planId: plan.id, billingCycle: dto.billingCycle, clientId: client.id }
          : { purpose: 'invoice_payment', billingCycle: dto.billingCycle, clientId: client.id },
      });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount: chargedAmount,
        currency: chargedCurrency,
        status: PaymentStatus.PENDING,
        clientId: client.id,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: {
          ...init,
          fxConverted,
          originalAmount: total,
          originalCurrency: dto.currency,
          exchangeRate,
        } as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
      chargedAmount,
      chargedCurrency,
      fxConverted,
      exchangeRate,
    };
  }

  /**
   * Guest (pay-first) identity — a passwordless user row (claim sets the
   * password later) plus its required 1:1 client profile. Email is the join
   * key. Shared by every guest rail: Paystack cards, M-Pesa STK, B2B invoice.
   */
  private async resolveGuestIdentity(opts: {
    email: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone?: string;
    planId: string;
    allowExistingAccount?: boolean;
  }) {
    let guestUser = await this.prisma.user.findUnique({ where: { email: opts.email } });
    const isClaimedAccount = Boolean(
      guestUser?.passwordHash || (guestUser?.keycloakId && !guestUser.keycloakId.startsWith('pending-')),
    );
    if (isClaimedAccount && !opts.allowExistingAccount) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACCOUNT_EXISTS',
        message: 'An account already exists for this email. Sign in to complete payment.',
      });
    }
    if (!guestUser) {
      try {
        guestUser = await this.prisma.user.create({
          data: {
            email: opts.email,
            role: 'CLIENT',
            firstName: opts.firstName,
            lastName: opts.lastName,
            phone: opts.phone,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          guestUser = await this.prisma.user.findUnique({ where: { email: opts.email } });
        }
        if (!guestUser) throw err;
      }
    }

    let guest = await this.prisma.client.findUnique({ where: { userId: guestUser.id } });
    if (!guest && typeof this.prisma.client.findFirst === 'function') {
      guest = await this.prisma.client.findFirst({ where: { email: opts.email } });
    }
    if (!guest) {
      try {
        guest = await this.prisma.client.create({
          data: {
            userId: guestUser.id,
            businessName: opts.businessName,
            contactName: `${opts.firstName} ${opts.lastName}`.trim(),
            email: opts.email,
            phone: opts.phone,
            planId: opts.planId,
            status: 'TRIAL',
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          guest =
            (await this.prisma.client.findUnique({ where: { userId: guestUser.id } })) ??
            (typeof this.prisma.client.findFirst === 'function'
              ? await this.prisma.client.findFirst({ where: { email: opts.email } })
              : null);
        }
        if (!guest) throw err;
      }
    } else if (!isClaimedAccount) {
      // Keep the latest plan intent if the guest switched plans between visits.
      if (guest.planId !== opts.planId || guest.businessName !== opts.businessName) {
        guest = await this.prisma.client.update({
          where: { id: guest.id },
          data: { planId: opts.planId, businessName: opts.businessName },
        });
      }
    }

    return { userId: guestUser.id as string, guest };
  }

  /**
   * Guest M-Pesa checkout (Track C) — pay-first via Paystack, no account needed.
   */
  async subscribeMpesaGuest(dto: GuestMpesaSubscriptionDto) {
    if (!dto.mpesaPhoneNumber) {
      throw new BadRequestException('Phone number is required to trigger M-Pesa prompt.');
    }
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName?.trim() || 'Valued';
    const lastName = dto.lastName?.trim() || 'Client';

    const { plan, clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras);

    const { userId, guest } = await this.resolveGuestIdentity({
      email,
      firstName,
      lastName,
      businessName: dto.businessName?.trim() || 'BazionWeb Client',
      phone: dto.mpesaPhoneNumber,
      planId: clientPlanId,
    });

    const result = await this.initMpesaStk({
      client: { id: guest.id, email, user: { firstName, lastName } },
      userId,
      phone: dto.mpesaPhoneNumber,
      plan,
      billingCycle: dto.billingCycle,
      extras: dto.extras,
    });

    return { ...result, guest: true, email };
  }

  /**
   * Guest card checkout (Track C) — pay-first via Paystack, no account needed.
   */
  async subscribePaystackGuest(dto: GuestSubscriptionDto) {
    const email = dto.email.trim().toLowerCase();
    const businessName = dto.businessName?.trim() || 'BazionWeb Client';

    const { plan, clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras);

    const { userId, guest } = await this.resolveGuestIdentity({
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      businessName,
      phone: dto.phone,
      planId: clientPlanId,
    });

    let amount = 0;
    if (plan) {
      amount = this.planAmount(plan, dto.billingCycle, dto.currency);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
      }
    }

    const linePurpose = plan ? 'subscription' : 'invoice_payment';
    const { lineItems: extraItems, total: extrasTotal } = await this.priceCartExtras(dto.currency, dto.extras, linePurpose);
    const total = Math.round((amount + extrasTotal) * 100) / 100;
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Checkout total must be greater than zero.');
    }

    const invoiceNumber = this.newInvoiceNumber(dto.currency === 'KES' ? 'INV-KE' : 'INV-USD');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');

    const invoiceLineItems = [
      ...(plan
        ? [
            checkoutLineItem({
              description: `BazionWeb ${plan.name} (${dto.billingCycle.toLowerCase()}) — card`,
              amount,
              currency: dto.currency,
              planId: plan.id,
              billingCycle: dto.billingCycle,
              purpose: 'subscription',
            }),
          ]
        : []),
      ...extraItems,
    ];

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: guest.id,
        invoiceNumber,
        amount: total,
        currency: dto.currency,
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: invoiceLineItems,
      },
    });

    const { init, chargedAmount, chargedCurrency, fxConverted, exchangeRate } =
      await this.initializePaystackWithFxFallback({
        email,
        amount: total,
        currency: dto.currency,
        invoiceNumber: invoice.invoiceNumber,
        callbackUrl: `${frontendUrl}/checkout/verify`,
        metadata: plan
          ? { planId: plan.id, billingCycle: dto.billingCycle, clientId: guest.id, guest: true }
          : { purpose: 'invoice_payment', billingCycle: dto.billingCycle, clientId: guest.id, guest: true },
      });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount: chargedAmount,
        currency: chargedCurrency,
        status: PaymentStatus.PENDING,
        clientId: guest.id,
        invoiceId: invoice.id,
        userId,
        rawPayload: {
          ...init,
          fxConverted,
          originalAmount: total,
          originalCurrency: dto.currency,
          exchangeRate,
        } as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
      email,
      chargedAmount,
      chargedCurrency,
      fxConverted,
      exchangeRate,
    };
  }

  /**
   * Track B: Manual B2B bank-transfer invoice.
   */
  async createBankTransferInvoice(user: any, dto: BankTransferInvoiceDto) {
    const { clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras, {
      requireActive: false,
      notFoundMessage: 'Plan not found',
    });

    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Enterprise` : 'Corporate Client',
      contactName: `${user.firstName || 'Corporate'} ${user.lastName || 'Billing'}`.trim(),
      email: user.email,
      planId: clientPlanId,
    });

    return this.bankTransferInvoiceFor({ clientId: client.id, businessName: client.businessName }, dto);
  }

  /**
   * Guest B2B invoice (Track C) — no account required. Produces the same
   * invoice + manual settlement instructions; activation stays manual
   * (admin confirms the wire), so this is lower-risk than paid rails.
   */
  async createBankTransferInvoiceGuest(dto: GuestBankTransferInvoiceDto) {
    const email = dto.email.trim().toLowerCase();

    const { clientPlanId } = await this.resolvePlanSelection(dto.planId, dto.extras, {
      requireActive: false,
      notFoundMessage: 'Plan not found',
    });

    const { guest } = await this.resolveGuestIdentity({
      email,
      firstName: dto.firstName?.trim() || 'Corporate',
      lastName: dto.lastName?.trim() || 'Client',
      businessName: dto.businessName?.trim() || 'Corporate Client',
      phone: dto.phone,
      planId: clientPlanId,
    });

    return this.bankTransferInvoiceFor({ clientId: guest.id, businessName: guest.businessName }, dto);
  }

  /** Shared B2B invoice core — server-priced, invoice + manual wire details. */
  private async bankTransferInvoiceFor(
    owner: { clientId: string; businessName?: string | null },
    dto: {
      planId?: string;
      billingCycle: BillingCycle;
      currency: 'USD' | 'EUR' | 'GBP' | 'KES';
      purchaseOrderNumber?: string;
      extras?: CartExtraDto[];
    },
  ) {
    const client = { id: owner.clientId, businessName: owner.businessName };

    const { plan } = await this.resolvePlanSelection(dto.planId, dto.extras, {
      requireActive: false,
      notFoundMessage: 'Plan not found',
    });

    let planCharge = 0;
    if (plan) {
      planCharge = this.planAmount(plan, dto.billingCycle, dto.currency);
      if (!Number.isFinite(planCharge) || planCharge <= 0) {
        throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
      }
    }

    const extrasCurrency = dto.currency === 'KES' ? 'KES' : 'USD';
    const linePurpose = plan ? 'subscription' : 'invoice_payment';
    const { lineItems: extraItems, total: extrasTotal } = await this.priceCartExtras(
      extrasCurrency,
      dto.extras,
      linePurpose,
    );
    const amount = Math.round((planCharge + extrasTotal) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`Invoice amount not configured for ${dto.currency}`);
    }

    const invoiceNumber = this.newInvoiceNumber('B2B-INV');
    const paymentReference = `BW-${(client.businessName || 'CORP').substring(0, 3).toUpperCase()}-${invoiceNumber.slice(-5)}`;

    const bankDetails = this.getManualSettlementInstructions(
      dto.currency === 'KES' ? 'USD' : (dto.currency as 'USD' | 'EUR' | 'GBP'),
      paymentReference,
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Net 14-day corporate payment terms

    const invoiceLineItems = [
      ...(plan
        ? [
            checkoutLineItem({
              description: `Enterprise Lifecycle Management: ${plan.name} (${dto.billingCycle})`,
              amount: planCharge,
              currency: dto.currency,
              planId: plan.id,
              billingCycle: dto.billingCycle,
              purpose: 'subscription',
            }),
          ]
        : []),
      ...extraItems,
    ];

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          clientId: client.id,
          invoiceNumber,
          amount,
          currency: dto.currency,
          status: InvoiceStatus.SENT,
          dueDate,
          notes: dto.purchaseOrderNumber ? `PO Ref: ${dto.purchaseOrderNumber}` : null,
          lineItems: invoiceLineItems,
        },
      });

      const wiseAccount = await tx.wiseReceivingAccount.create({
        data: {
          clientId: client.id,
          invoiceId: invoice.id,
          wiseAccountId: `MANUAL-${invoiceNumber}`,
          currency: dto.currency,
          accountHolder: bankDetails.beneficiary,
          accountNumber: bankDetails.accountNumber || bankDetails.iban || 'PENDING',
          routingNumber: bankDetails.routingNumber,
          swiftBic: bankDetails.swiftBic,
          iban: bankDetails.iban,
          bankAddress: (bankDetails.bankAddress as any) ?? undefined,
          paymentReference,
          expiresAt: dueDate,
        },
      });

      await tx.paymentLog.create({
        data: {
          idempotencyKey: `BANK_${invoiceNumber}`,
          provider: PaymentProvider.MANUAL_BANK_TRANSFER,
          providerRef: paymentReference,
          method: PaymentMethodType.BANK_TRANSFER,
          amount,
          currency: dto.currency,
          status: PaymentStatus.PENDING,
          clientId: client.id,
          invoiceId: invoice.id,
          rawPayload: { paymentReference } as any,
        },
      });

      return { invoice, wiseAccount };
    });

    this.events.emit('invoice.created', { invoice: result.invoice });

    return {
      status: 'INVOICE_GENERATED',
      provider: 'MANUAL_BANK_TRANSFER',
      invoiceNumber: result.invoice.invoiceNumber,
      amount: result.invoice.amount,
      currency: result.invoice.currency,
      dueDate: result.invoice.dueDate,
      paymentReference,
      bankTransferDetails: {
        beneficiary: result.wiseAccount.accountHolder,
        accountNumber: result.wiseAccount.accountNumber,
        routingNumber: result.wiseAccount.routingNumber,
        iban: result.wiseAccount.iban,
        swiftBic: result.wiseAccount.swiftBic,
        bankAddress: result.wiseAccount.bankAddress,
        referenceNote: bankDetails.referenceNote,
      },
    };
  }

  // ─── Cart extras (server-priced catalog add-ons) ───────────────────────────

  /**
   * Authoritative server-side fallback price book for all canonical Step 1 (Website/App & Add-Ons),
   * Step 2 (Domain), and Step 3 (Managed Hosting) catalog products. Synchronized via shared
   * `CANONICAL_CATALOG_PRICES` + `resolveCanonicalProductId` so checkout never fails with
   * "not available in the price book" on short/legacy IDs or unseeded SKUs.
   */
  private static readonly CANONICAL_CATALOG_PRICES: Readonly<
    Record<string, CanonicalCatalogEntry>
  > = CANONICAL_CATALOG_PRICES;

  /**
   * Price cart add-ons from the active price book for the charge currency,
   * with authoritative fallback to CANONICAL_CATALOG_PRICES when an item is not
   * yet seeded in the DB Price table.
   * The client only sends product IDs and quantities — amounts, descriptions,
   * and validity always come from the server so totals cannot be tampered with.
   */
  private async priceCartExtras(
    currency: 'KES' | 'USD',
    extras?: CartExtraDto[],
    purpose: 'subscription' | 'invoice_payment' = 'subscription',
  ) {
    if (!extras?.length) return { lineItems: [] as ReturnType<typeof checkoutLineItem>[], total: 0 };

    const normalizedExtras = extras.map((extra) => ({
      rawProductId: extra.productId,
      canonicalProductId: resolveCanonicalProductId(extra.productId),
      qty: extra.qty,
    }));
    const lookupProductIds = Array.from(
      new Set(
        normalizedExtras.flatMap((e) => [e.rawProductId, e.canonicalProductId]).filter(Boolean),
      ),
    );

    const market =
      typeof this.prisma.market?.findFirst === 'function'
        ? await this.prisma.market.findFirst({
            where: { currencyCode: currency, active: true },
            include: { priceBooks: { where: { status: 'active' }, orderBy: { effectiveFrom: 'desc' }, take: 1 } },
          })
        : null;
    const priceBook = market?.priceBooks?.[0];

    const prices =
      priceBook && typeof (this.prisma as any).price?.findMany === 'function'
        ? await this.prisma.price.findMany({
            where: { priceBookId: priceBook.id, productId: { in: lookupProductIds } },
          })
        : [];
    const priceMap = new Map<string, any>(prices.map((p: any) => [p.productId, p]));

    const lineItems: ReturnType<typeof checkoutLineItem>[] = [];
    let total = 0;
    for (const extra of normalizedExtras) {
      const dbPrice =
        priceMap.get(extra.canonicalProductId) ?? priceMap.get(extra.rawProductId);
      const canonical =
        BillingService.CANONICAL_CATALOG_PRICES[extra.canonicalProductId] ??
        BillingService.CANONICAL_CATALOG_PRICES[extra.rawProductId];
      if (!dbPrice && !canonical) {
        if (!market || !priceBook) {
          throw new ServiceUnavailableException(
            `No active price book for ${currency} — remove add-ons or contact support.`,
          );
        }
        throw new BadRequestException(`Add-on "${extra.rawProductId}" is not available in the ${currency} price book.`);
      }

      const unitAmount = dbPrice != null ? Number(dbPrice.amount) : canonical![currency];
      const amount = unitAmount * extra.qty;
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException(`Add-on "${extra.rawProductId}" has an invalid price.`);
      }

      const billingPeriod = dbPrice?.billingPeriod ?? canonical?.billingPeriod;
      const period = billingPeriod ? ` (${billingPeriod})` : '';
      const label = canonical?.name ?? `Add-on — ${extra.canonicalProductId.replace(/^[\w-]+-/, '')}`;

      lineItems.push(
        checkoutLineItem({
          description: `${label} x${extra.qty}${period}`,
          amount,
          currency,
          productId: extra.canonicalProductId,
          qty: extra.qty,
          purpose,
        }),
      );
      total += amount;
    }
    return { lineItems, total: Math.round(total * 100) / 100 };
  }

  // ─── Proposal → deposit checkout (quote-to-close) ──────────────────────────

  /** Deposit share of the proposal total charged at kickoff (percent, 10–100). */
  private proposalDepositPercent(): number {
    const raw = Number(this.config.get<string>('PROPOSAL_DEPOSIT_PERCENT', '50'));
    if (!Number.isFinite(raw)) return 50;
    return Math.min(100, Math.max(10, Math.round(raw)));
  }

  private depositInvoiceMarker(code: string): string {
    return `proposal ${code.trim().toUpperCase()}`;
  }

  private proposalAcceptResponse(proposal: { proposalCode: string; currency: string; totalAmount: any }, invoice: { id: string; invoiceNumber: string; amount: any; currency: string; dueDate: Date }, depositPercent: number) {
    return {
      status: 'ACCEPTED',
      proposalCode: proposal.proposalCode,
      depositPercent,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        dueDate: invoice.dueDate.toISOString(),
      },
      proposalTotal: Number(proposal.totalAmount),
    };
  }

  /**
   * Public Proposal Retrieval:
   * Looks up a locked, accepted, or expired proposal by its reference code,
   * calculates deposit (50%) and balance terms, maps line items, and attaches
   * linked deposit invoice details if already accepted.
   */
  async getProposalByCode(code: string) {
    const raw = String(code || '').trim();
    if (!raw) {
      throw new NotFoundException('Proposal not found');
    }

    const cleanCode = raw.toUpperCase();
    if (!/^[A-Z0-9_-]{4,64}$/.test(cleanCode)) {
      throw new NotFoundException('Proposal not found');
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { proposalCode: cleanCode },
      include: {
        market: {
          include: {
            currency: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${cleanCode} not found`);
    }

    const now = new Date();
    let status: 'LOCKED' | 'ACCEPTED' | 'EXPIRED' = 'LOCKED';
    if (proposal.status === 'ACCEPTED') {
      status = 'ACCEPTED';
    } else if (proposal.status === 'EXPIRED' || proposal.expiresAt < now) {
      status = 'EXPIRED';
    } else {
      status = 'LOCKED';
    }

    const depositPercent = this.proposalDepositPercent();
    const totalAmount = Number(proposal.totalAmount);
    const depositAmount = Math.round(((totalAmount * depositPercent) / 100) * 100) / 100;
    const finalAmount = Math.round((totalAmount - depositAmount) * 100) / 100;

    const currency = proposal.currency || proposal.market?.currencyCode || 'USD';
    const currencySymbol =
      proposal.market?.currency?.symbol ||
      (currency === 'KES' ? 'KSh' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$');

    const marketCode: 'KE' | 'GLOBAL' =
      proposal.market?.code === 'KE' || currency === 'KES' ? 'KE' : 'GLOBAL';

    // Normalize raw lineItems JSON into strict array shape (schema-tolerant defensive parsing)
    let rawItems: any[] = [];
    if (Array.isArray(proposal.lineItems)) {
      rawItems = proposal.lineItems;
    } else if (typeof proposal.lineItems === 'string') {
      try {
        const parsed = JSON.parse(proposal.lineItems);
        if (Array.isArray(parsed)) {
          rawItems = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).items)) {
          rawItems = (parsed as any).items;
        }
      } catch {
        rawItems = [];
      }
    } else if (proposal.lineItems && typeof proposal.lineItems === 'object' && Array.isArray((proposal.lineItems as any).items)) {
      rawItems = (proposal.lineItems as any).items;
    }

    const lineItems = rawItems
      .filter((item: any) => {
        if (!Boolean(item) || typeof item !== 'object') return false;
        // Omit non-billable tax metadata rows stored in proposal JSON
        if (item.kind === 'tax' && (item.included || !Number(item.price ?? item.amount ?? 0))) {
          return false;
        }
        return true;
      })
      .map((item: any) => {
        const fallbackByKind =
          item.kind === 'extra-pages'
            ? 'Additional Custom Pages'
            : item.kind === 'rush-delivery'
              ? 'Priority Rush Delivery (+35%)'
              : item.kind === 'discount'
                ? `Promotional Discount${item.code ? ` (${item.code})` : ''}`
                : undefined;
        const title = String(
          item.title || item.name || item.description || fallbackByKind || item.productId || 'Project Item',
        );
        const price = Number(item.price ?? item.amount ?? 0);
        const quantity = item.quantity !== undefined && Number.isFinite(Number(item.quantity))
          ? Number(item.quantity)
          : (item.count !== undefined && Number.isFinite(Number(item.count)) ? Number(item.count) : undefined);
        const subtitle = item.subtitle || (item.billingPeriod && item.billingPeriod !== 'one-time' ? `${item.billingPeriod}ly recurring` : undefined);
        return {
          title,
          ...(subtitle ? { subtitle } : {}),
          price: Number.isFinite(price) ? price : 0,
          ...(quantity !== undefined ? { quantity } : {}),
          ...(item.kind ? { kind: String(item.kind) } : {}),
          ...(item.billingPeriod ? { billingPeriod: String(item.billingPeriod) } : {}),
        };
      });

    // Check if a kickoff deposit invoice was already generated
    const marker = this.depositInvoiceMarker(cleanCode);
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { notes: { contains: marker }, status: { not: InvoiceStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true },
    });

    return {
      success: true,
      data: {
        proposalCode: proposal.proposalCode,
        currency,
        currencySymbol,
        totalAmount,
        depositAmount,
        finalAmount,
        status,
        clientName: proposal.clientName || '',
        clientCompany: proposal.clientCompany || '',
        clientEmail: proposal.clientEmail || '',
        marketCode,
        lineItems,
        expiresAt: proposal.expiresAt.toISOString(),
        createdAt: proposal.createdAt.toISOString(),
        ...(existingInvoice ? {
          invoice: {
            id: existingInvoice.id,
            invoiceNumber: existingInvoice.invoiceNumber,
            amount: Number(existingInvoice.amount),
            status: existingInvoice.status as any,
            dueDate: existingInvoice.dueDate instanceof Date 
              ? existingInvoice.dueDate.toISOString() 
              : new Date(existingInvoice.dueDate).toISOString(),
          },
        } : {}),
      },
    };
  }

  /**
   * Guest proposal acceptance (quote-to-close): validates the locked proposal,
   * provisions the passwordless guest identity, and creates the kickoff-deposit
   * invoice. Idempotent — re-accepting returns the same deposit invoice.
   */
  async acceptProposalGuest(dto: AcceptProposalDto) {
    const code = dto.code.trim().toUpperCase();
    const proposal = await this.prisma.proposal.findUnique({ where: { proposalCode: code } });
    if (!proposal) {
      throw new NotFoundException('We could not find that proposal. Double-check the reference code.');
    }
    if (proposal.status === 'EXPIRED' || proposal.expiresAt < new Date()) {
      throw new BadRequestException('This proposal has expired. Contact our team for a refreshed quote.');
    }

    const marker = this.depositInvoiceMarker(code);
    const findDepositInvoice = () =>
      this.prisma.invoice.findFirst({
        where: { notes: { contains: marker }, status: { not: InvoiceStatus.CANCELLED } },
        orderBy: { createdAt: 'desc' },
      });

    // Idempotent path: already accepted → hand back the same deposit invoice.
    if (proposal.status === 'ACCEPTED') {
      const existing = await findDepositInvoice();
      if (existing) {
        return this.proposalAcceptResponse(proposal, existing, this.proposalDepositPercent());
      }
    }

    const proposalEmail = (proposal.clientEmail || '').trim().toLowerCase();
    const suppliedEmail = (dto.email || '').trim().toLowerCase();
    if (proposalEmail && suppliedEmail && suppliedEmail !== proposalEmail) {
      throw new ForbiddenException('Email does not match the recipient of this proposal.');
    }
    const email = proposalEmail || suppliedEmail;
    if (!email) {
      throw new BadRequestException('A valid billing email is required to accept this proposal.');
    }
    const nameParts = (dto.firstName ? `${dto.firstName} ${dto.lastName ?? ''}` : proposal.clientName || 'Valued Client').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Valued';
    const lastName = nameParts.slice(1).join(' ') || 'Client';

    // Client.planId is required; a proposal has no plan intent unless a care
    // plan was quoted. Fall back to the cheapest active plan as placeholder.
    const fallbackPlan = await this.prisma.plan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallbackPlan) {
      throw new ServiceUnavailableException('No plans are configured yet — please contact our team.');
    }

    const { guest } = await this.resolveGuestIdentity({
      email,
      firstName,
      lastName,
      businessName: dto.businessName?.trim() || proposal.clientCompany?.trim() || `${firstName}'s Project`,
      phone: dto.phone,
      planId: fallbackPlan.id,
      allowExistingAccount: true,
    });

    const depositPercent = this.proposalDepositPercent();
    const depositAmount = Math.round(Number(proposal.totalAmount) * depositPercent) / 100;
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      throw new BadRequestException('Proposal total is not configured for a deposit invoice.');
    }

    // Claim the proposal atomically so two concurrent accepts cannot double-invoice.
    const claimed = await this.prisma.proposal.updateMany({
      where: { id: proposal.id, status: 'LOCKED' },
      data: { status: 'ACCEPTED' },
    });
    if (claimed.count === 0) {
      const existing = await findDepositInvoice();
      if (existing) {
        return this.proposalAcceptResponse(proposal, existing, depositPercent);
      }
      throw new ConflictException('This proposal is in another acceptance state. Contact our team.');
    }

    const invoiceNumber = this.newInvoiceNumber(proposal.currency === 'KES' ? 'INV-KE' : 'INV-USD');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: guest.id,
        invoiceNumber,
        amount: depositAmount,
        currency: proposal.currency,
        status: InvoiceStatus.SENT,
        dueDate,
        notes: `Kickoff deposit (${depositPercent}%) for ${marker}`,
        lineItems: [
          checkoutLineItem({
            description: `Kickoff deposit — ${proposal.proposalCode} (${depositPercent}% of project total)`,
            amount: depositAmount,
            currency: proposal.currency,
            purpose: 'invoice_payment',
          }),
        ],
      },
    });

    this.logger.log(`Proposal ${code} accepted — deposit invoice ${invoiceNumber} for client ${guest.id}`);
    return this.proposalAcceptResponse(proposal, invoice, depositPercent);
  }

  /** Load an accepted proposal's deposit invoice for a payment rail. */
  private async proposalDepositInvoice(code: string) {
    const marker = this.depositInvoiceMarker(code);
    const proposal = await this.prisma.proposal.findUnique({ where: { proposalCode: code.trim().toUpperCase() } });
    if (!proposal || proposal.status !== 'ACCEPTED') {
      throw new BadRequestException('Accept the proposal before paying the kickoff deposit.');
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: { notes: { contains: marker }, status: { not: InvoiceStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
    });
    if (!invoice) {
      throw new NotFoundException('No deposit invoice exists for this proposal yet.');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('This deposit is already settled.');
    }
    return { proposal, invoice };
  }

  /**
   * Resolves the USD -> KES exchange rate from the Currency table (or env override),
   * guarding against unseeded 1.0 schema defaults so FX fallback never charges 1:1.
   */
  private async resolveUsdToKesRate(): Promise<number> {
    const envRate = Number(this.config.get<string>('PAYSTACK_USD_KES_RATE', ''));
    if (Number.isFinite(envRate) && envRate > 1) {
      return envRate;
    }
    try {
      const kesCurrency = await this.prisma.currency?.findUnique?.({ where: { code: 'KES' } });
      const dbRate = kesCurrency?.exchangeRateToBase ? Number(kesCurrency.exchangeRateToBase) : NaN;
      if (Number.isFinite(dbRate) && dbRate > 1) {
        return dbRate;
      }
    } catch {
      // Fallback to canonical default rate when Currency lookup is unavailable
    }
    return 129.5;
  }

  /**
   * Converts a USD Paystack initialization request to KES settlement using the
   * active exchange rate and records the original USD invoice figures in metadata
   * so webhook / return-URL verification settles the USD invoice accurately.
   */
  private async initializePaystackInKesFromUsd(params: {
    email: string;
    amount: number;
    currency: 'KES' | 'USD';
    invoiceNumber: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }) {
    const fxRate = await this.resolveUsdToKesRate();
    const chargedAmount = Math.max(1, Math.round(params.amount * fxRate));
    const chargedCurrency = 'KES' as const;

    this.logger.log(
      `[Paystack] Settling USD ${params.amount} in KES ${chargedAmount} (rate: ${fxRate}) for ${params.invoiceNumber}`,
    );

    const init = await this.paystackService.initializeTransaction({
      ...params,
      amount: chargedAmount,
      currency: chargedCurrency,
      metadata: {
        ...(params.metadata ?? {}),
        fxConverted: true,
        originalAmount: params.amount,
        originalCurrency: 'USD',
        exchangeRate: fxRate,
      },
    });

    return {
      init,
      chargedAmount,
      chargedCurrency,
      fxConverted: true,
      exchangeRate: fxRate,
    };
  }

  /**
   * Memoizes when Paystack rejects USD with "Currency not supported by merchant"
   * in reactive/auto mode so subsequent USD checkouts in this process convert
   * directly to KES without repeating a failed round-trip.
   */
  private usdSettlementUnsupported = false;

  /**
   * Initializes a Paystack card transaction.
   *
   * Dual-mode currency handling for merchants without a USD domiciliary settlement account:
   * 1. Proactive mode: When `PAYSTACK_SETTLEMENT_CURRENCY=KES` is configured (or after
   *    an initial USD rejection is memoized), USD card checkouts are converted directly
   *    to KES without a failed round-trip.
   * 2. Reactive fallback mode: If Paystack rejects USD with "Currency not supported
   *    by merchant", automatically converts USD -> KES using the active market
   *    exchange rate, memoizes the capability, and retries seamlessly.
   */
  private async initializePaystackWithFxFallback(params: {
    email: string;
    amount: number;
    currency: 'KES' | 'USD';
    invoiceNumber: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }) {
    const forcedSettlement = (this.config.get<string>('PAYSTACK_SETTLEMENT_CURRENCY', '') || '')
      .trim()
      .toUpperCase();

    if (
      params.currency === 'USD' &&
      (forcedSettlement === 'KES' || (forcedSettlement !== 'USD' && this.usdSettlementUnsupported))
    ) {
      return this.initializePaystackInKesFromUsd(params);
    }

    try {
      const init = await this.paystackService.initializeTransaction(params);
      return {
        init,
        chargedAmount: params.amount,
        chargedCurrency: params.currency,
        fxConverted: false,
        exchangeRate: 1,
      };
    } catch (err: any) {
      const responsePayload = typeof err?.getResponse === 'function' ? err.getResponse() : undefined;
      const errorMessage = [
        err?.message,
        typeof responsePayload === 'string' ? responsePayload : (responsePayload as any)?.message,
        err?.response?.data?.message,
      ]
        .filter(Boolean)
        .join(' ');

      const isCurrencyUnsupported = /currency\s+not\s+supported|unsupported\s+currency/i.test(errorMessage);

      if (params.currency === 'USD' && isCurrencyUnsupported) {
        this.usdSettlementUnsupported = true;
        return this.initializePaystackInKesFromUsd(params);
      }

      throw err;
    }
  }

  /** Guest card payment for an accepted proposal's kickoff deposit. */
  async payProposalDepositCard(code: string, dto: ProposalDepositCardDto) {
    const { proposal, invoice } = await this.proposalDepositInvoice(code);
    if (invoice.currency !== 'KES' && invoice.currency !== 'USD') {
      throw new BadRequestException(`Card checkout does not support ${invoice.currency} — use M-Pesa or bank transfer.`);
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');
    const amount = Number(invoice.amount);
    const proposalEmail = (proposal.clientEmail || '').trim().toLowerCase();
    const suppliedEmail = (dto.email || '').trim().toLowerCase();
    if (proposalEmail && suppliedEmail && suppliedEmail !== proposalEmail) {
      throw new ForbiddenException('Email does not match the recipient of this proposal.');
    }
    const { init, chargedAmount, chargedCurrency, fxConverted, exchangeRate } =
      await this.initializePaystackWithFxFallback({
        email: proposalEmail || suppliedEmail,
        amount,
        currency: invoice.currency as 'KES' | 'USD',
        invoiceNumber: invoice.invoiceNumber,
        callbackUrl: `${frontendUrl}/checkout/verify`,
        metadata: {
          clientId: invoice.clientId,
          purpose: 'invoice_payment',
          invoiceNumber: invoice.invoiceNumber,
          proposalCode: proposal.proposalCode,
        },
      });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount: chargedAmount,
        currency: chargedCurrency,
        status: PaymentStatus.PENDING,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        rawPayload: {
          ...init,
          fxConverted,
          originalAmount: amount,
          originalCurrency: invoice.currency,
          exchangeRate,
        } as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
      chargedAmount,
      chargedCurrency,
      fxConverted,
      exchangeRate,
    };
  }

  /** Guest M-Pesa STK payment for an accepted proposal's kickoff deposit (KES). */
  async payProposalDepositMpesa(code: string, dto: ProposalDepositMpesaDto) {
    const { proposal, invoice } = await this.proposalDepositInvoice(code);
    if (invoice.currency !== 'KES') {
      throw new BadRequestException('M-Pesa is only available for KES proposals — pay the deposit by card instead.');
    }

    return this.pushMpesaStk({
      client: { id: invoice.clientId, email: proposal.clientEmail },
      userId: null,
      phone: dto.mpesaPhoneNumber,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: Number(invoice.amount), currency: invoice.currency },
      description: `BazionWeb kickoff deposit ${proposal.proposalCode}`,
      metadata: { purpose: 'invoice_payment', invoiceNumber: invoice.invoiceNumber },
    });
  }

  async generate(dto: {
    clientId: string;
    subscriptionId?: string;
    amount: number;
    currency?: 'USD' | 'KES' | 'EUR' | 'GBP';
    dueDate?: string;
    lineItems?: Array<{ description: string; quantity?: number; unitPrice?: number; amount?: number }>;
    notes?: string;
  }) {
    const currency = dto.currency || 'USD';
    const invoiceNumber = this.newInvoiceNumber('INV-MAN');
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: dto.clientId,
        subscriptionId: dto.subscriptionId,
        invoiceNumber,
        amount: dto.amount,
        currency,
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: dto.lineItems && dto.lineItems.length > 0 ? (dto.lineItems as any) : null,
        notes: dto.notes,
      },
      include: {
        client: { select: { businessName: true, email: true } },
      },
    });

    this.events.emit('invoice.created', { invoice });
    return { data: invoice };
  }

  async markPaid(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { planId: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidAt = invoice.paidAt ?? new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.PAID, paidAt },
      });

      await this.settlement.activatePaidSubscription(
        tx,
        {
          ...invoice,
          paidAt,
        },
        {
          provider: PaymentProvider.MANUAL_BANK_TRANSFER,
          providerRef: invoice.invoiceNumber,
        },
      );

      return inv;
    });

    this.events.emit('invoice.paid', { invoice: updated });
    return { data: updated };
  }

  /**
   * Whether BAZION WEB is registered for the VAT obligation on KRA iTax.
   * Defaults to false: a non-registered supplier must not charge VAT, split VAT
   * out of the price, or title documents "Tax Invoice" (Kenya VAT Act, 2013).
   */
  private supplierVatRegistered(): boolean {
    return isSupplierVatRegistered(this.config.get<string>('COMPANY_VAT_REGISTERED'));
  }

  /**
   * Resolves the VAT rule for an invoice currency from the Market table
   * (the same source of truth used by the pricing engine), so invoices never
   * show a tax line that the quote/price book did not charge.
   */
  private async resolveInvoiceTax(currency: string): Promise<{ vatRate: number; isInclusive: boolean }> {
    const fallback = { vatRate: 0, isInclusive: true };
    if (!this.supplierVatRegistered()) return fallback;
    try {
      const market = await this.prisma.market.findFirst({
        where: { currencyCode: (currency || '').toUpperCase(), active: true },
        select: { vatRate: true, taxIncludedInPrice: true },
      });
      if (!market) return fallback;
      return { vatRate: Number(market.vatRate) || 0, isInclusive: market.taxIncludedInPrice };
    } catch {
      return fallback;
    }
  }

  calculateInvoiceBreakdown(
    invoice: {
      amount: any;
      currency: string;
      status: string;
      paymentLogs?: Array<{ status: string; amount: any }>;
    },
    tax?: { vatRate: number; isInclusive: boolean },
  ): InvoiceBreakdown {
    const total = Number(invoice.amount || 0);
    const isKes = (invoice.currency || 'KES').toUpperCase() === 'KES';
    const vatRegistered = this.supplierVatRegistered();
    const resolvedTax =
      tax ?? { vatRate: vatRegistered && isKes ? 0.16 : 0.0, isInclusive: true };
    const vatRate = vatRegistered && resolvedTax.vatRate > 0 ? resolvedTax.vatRate : 0;
    const isInclusive = resolvedTax.isInclusive;

    let subtotal = total;
    let vatAmount = 0;

    // invoice.amount is always the gross amount the client is charged (the
    // pricing engine adds exclusive tax before the invoice is issued), so the
    // net/VAT split is always derived from the gross: total = subtotal + VAT.
    if (vatRate > 0) {
      subtotal = Math.round((total / (1 + vatRate)) * 100) / 100;
      vatAmount = Math.round((total - subtotal) * 100) / 100;
    }

    const ratePct = Math.round(vatRate * 10000) / 100;
    const vatLabel = !vatRegistered
      ? 'VAT Not Applicable (Supplier not VAT-registered)'
      : vatRate > 0
        ? `VAT @ ${ratePct}%`
        : '0% VAT (Zero-Rated Export of Services)';

    const isPaid = invoice.status === InvoiceStatus.PAID;
    const paidLogsSum = (invoice.paymentLogs || [])
      .filter((log) => log.status === PaymentStatus.SUCCESS)
      .reduce((sum, log) => sum + Number(log.amount || 0), 0);

    const amountPaid = isPaid ? total : Math.min(total, paidLogsSum);
    const balanceDue = isPaid ? 0 : Math.max(0, Math.round((total - amountPaid) * 100) / 100);

    return {
      subtotal,
      vatRate,
      vatAmount,
      vatLabel,
      total,
      amountPaid,
      balanceDue,
      isInclusive,
      vatRegistered,
    };
  }

  async verifyInvoiceAccess(
    id: string,
    options: {
      user?: any;
      token?: string;
      proposalCode?: string;
    },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          },
        },
        paymentLogs: {
          where: { status: PaymentStatus.SUCCESS },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // Path 1: Proposal code (unauthenticated guests downloading the kickoff
    // deposit invoice of their own proposal). Exact marker match only — a bare
    // substring match on the code could authorize unrelated invoices.
    if (options.proposalCode) {
      const marker = this.depositInvoiceMarker(options.proposalCode);
      if (invoice.notes?.includes(marker)) {
        return invoice;
      }
    }

    // Path 2: Short-lived signed download token minted by the authenticated
    // GET /invoices/:id/pdf endpoint (ownership is checked when it is minted).
    if (options.token) {
      try {
        const decoded = jwt.verify(options.token, this.invoiceDownloadSecret(), {
          algorithms: ['HS256'],
          audience: INVOICE_DOWNLOAD_AUDIENCE,
        }) as { invoiceId?: string };
        if (decoded.invoiceId === id) {
          return invoice;
        }
      } catch {
        // Invalid or expired token — fall through to user check.
      }
    }

    // Path 3: Authenticated user context (staff or owning client)
    if (options.user) {
      const isStaff = ['ADMIN', 'SUPER_ADMIN'].some((r) => options.user.roles?.includes(r));
      if (isStaff || invoice.client?.userId === options.user.id) {
        return invoice;
      }
    }

    throw new ForbiddenException('Access denied to this invoice statement');
  }

  /**
   * Download tokens are signed with a key derived from JWT_SECRET (never a
   * hardcoded fallback) and carry a dedicated audience and no `iss`, so they
   * can never be replayed as API access tokens by JwtAuthGuard.
   */
  private invoiceDownloadSecret(): string {
    const configured = this.config.get<string>('JWT_SECRET');
    if (configured && configured.length >= 32) {
      return `${configured}:${INVOICE_DOWNLOAD_AUDIENCE}`;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Invoice downloads are not configured');
    }
    return `dev-test-ephemeral-secret-32chars-min:${INVOICE_DOWNLOAD_AUDIENCE}`;
  }

  async generateInvoicePdfStream(
    id: string,
    accessOptions: { user?: any; token?: string; proposalCode?: string },
  ) {
    const invoice = await this.verifyInvoiceAccess(id, accessOptions);
    const breakdown = this.calculateInvoiceBreakdown(invoice, await this.resolveInvoiceTax(invoice.currency));

    const rawLineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    const paymentLog = invoice.paymentLogs?.[0];

    const pdfBuffer = InvoicePdfGenerator.generate({
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      amount: Number(invoice.amount),
      status: invoice.status,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      notes: invoice.notes,
      client: {
        businessName: invoice.client?.businessName || 'Valued Client',
        contactName:
          invoice.client?.contactName ||
          (invoice.client?.user
            ? `${invoice.client.user.firstName || ''} ${invoice.client.user.lastName || ''}`.trim()
            : null),
        email: invoice.client?.email || invoice.client?.user?.email || 'billing@bazionweb.com',
        address: invoice.client?.address,
        country: invoice.client?.country,
        taxPin: invoice.client?.taxPin,
      },
      lineItems: rawLineItems as any[],
      breakdown,
      paymentRef: paymentLog?.providerRef,
      supplier: {
        address: this.config.get<string>('COMPANY_POSTAL_ADDRESS') || null,
        taxPin: resolveSupplierTaxPin(this.config.get<string>('COMPANY_KRA_PIN')),
      },
    });

    return {
      stream: pdfBuffer,
      filename: `invoice-${invoice.invoiceNumber}.pdf`,
    };
  }

  async getPdfUrl(id: string, user: any) {
    await this.findOne(id, user);
    const downloadToken = jwt.sign({ sub: user?.id, invoiceId: id }, this.invoiceDownloadSecret(), {
      algorithm: 'HS256',
      audience: INVOICE_DOWNLOAD_AUDIENCE,
      expiresIn: '5m',
    });

    return {
      data: {
        url: `/api/v1/invoices/${id}/pdf/download`,
        downloadUrlWithToken: `/api/v1/invoices/${id}/pdf/download?token=${encodeURIComponent(downloadToken)}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    };
  }

  private maskEmailAddress(rawEmail?: string | null): string {
    const email = String(rawEmail || '').trim().toLowerCase();
    const atIdx = email.indexOf('@');
    if (atIdx <= 0) return 'client@***';
    const local = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1);
    const maskedLocal =
      local.length <= 2
        ? `${local[0] || '*'}***`
        : `${local.slice(0, 2)}***${local.slice(-1)}`;
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Public SSOT cryptographic verification for scanned Code-128 barcodes & reference lookups.
   * Supports exact invoice numbers (`INV-MAN-40770343-3099D6`), legacy barcode strings with a
   * trailing 6-hex checksum suffix (`INV-MAN-40770343-3099D6-62F583`), and proposal codes.
   */
  async verifyDocumentPublic(rawReference: string, checksumQuery?: string) {
    const cleaned = String(rawReference || '')
      .trim()
      .toUpperCase();
    if (!cleaned || cleaned.length < 3) {
      throw new BadRequestException('A valid document reference or barcode is required.');
    }

    // Extract optional trailing 6-char hex checksum suffix if present from a legacy barcode scan
    // (Note: standard invoice numbers end with 1 random 6-hex block like INV-MAN-12345678-3099D6;
    // a legacy barcode appended a SECOND 6-hex block like INV-MAN-12345678-3099D6-62F583).
    const parts = cleaned.split('-');
    let embeddedSig = '';
    const candidateRefs = [cleaned];
    if (
      parts.length >= 5 &&
      /^[0-9A-F]{6}$/.test(parts[parts.length - 1]) &&
      /^[0-9A-F]{6}$/.test(parts[parts.length - 2])
    ) {
      embeddedSig = parts[parts.length - 1];
      candidateRefs.push(parts.slice(0, -1).join('-'));
    }

    const effectiveSig = String(checksumQuery || embeddedSig || '')
      .replace(/^SHA256:\s*/i, '')
      .replace(/[^0-9A-F]/gi, '')
      .toUpperCase();

    // 1. Check Invoices table
    let invoice: any = null;
    for (const candidate of candidateRefs) {
      invoice = await this.prisma.invoice.findFirst({
        where: {
          invoiceNumber: { equals: candidate, mode: 'insensitive' },
        },
        include: {
          client: {
            include: {
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
          paymentLogs: {
            where: { status: PaymentStatus.SUCCESS },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (invoice) break;
    }

    if (invoice) {
      const tax = await this.resolveInvoiceTax(invoice.currency);
      const breakdown = this.calculateInvoiceBreakdown(invoice, tax);
      const clientEmail =
        invoice.client?.email ||
        invoice.client?.user?.email ||
        'billing@bazionweb.com';
      const fp = computeDocumentFingerprint({
        docNumber: invoice.invoiceNumber,
        totalAmount: breakdown.total ?? Number(invoice.amount),
        currency: invoice.currency,
        recipientEmail: clientEmail,
        issueDate: invoice.createdAt,
      });

      const signatureVerified =
        effectiveSig.length >= 4
          ? fp.hashHex.startsWith(effectiveSig) || fp.hashHex.includes(effectiveSig)
          : null;

      const rawItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
      const lineItems =
        rawItems.length > 0
          ? rawItems.map((it: any) => ({
              description: String(it?.description || 'Service Deliverable'),
              quantity: Math.max(1, Number(it?.quantity ?? 1)),
              amount: Number(it?.amount ?? invoice.amount ?? 0),
            }))
          : [
              {
                description: String(invoice.notes || 'Engineering & Managed Cloud Services'),
                quantity: 1,
                amount: Number(invoice.amount || 0),
              },
            ];

      return {
        verified: signatureVerified !== false,
        found: true,
        signatureVerified,
        documentType:
          invoice.status === InvoiceStatus.PAID
            ? 'OFFICIAL PAYMENT RECEIPT'
            : breakdown.vatAmount > 0
              ? 'OFFICIAL TAX INVOICE'
              : 'OFFICIAL INVOICE',
        referenceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        subtotal: breakdown.subtotal,
        vatAmount: breakdown.vatAmount,
        vatLabel: breakdown.vatLabel,
        totalAmount: breakdown.total,
        amountPaid: breakdown.amountPaid,
        balanceDue: breakdown.balanceDue,
        issuedAt: new Date(invoice.createdAt).toISOString(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
        paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : null,
        settlementRef: invoice.paymentLogs?.[0]?.providerRef || null,
        recipient: {
          businessName: invoice.client?.businessName || 'Valued Client',
          emailMasked: this.maskEmailAddress(clientEmail),
        },
        issuer: {
          legalName: 'BAZION WEB',
          proprietor: 'Joseph Mburu Kiai',
          regNumber: 'BN-DLSZOZ6O',
          taxPin: resolveSupplierTaxPin(this.config.get<string>('COMPANY_KRA_PIN')) || OFFICIAL_BAZION_KRA_PIN,
          brsValidation: 'SMS "BRS" to 21546',
        },
        paymentChannels: OFFICIAL_BAZION_PAYMENT_DETAILS,
        cryptographicFingerprint: fp.formatted,
        lineItems,
        verifiedAt: new Date().toISOString(),
      };
    }

    // 2. Check Proposals table if not found in Invoices
    for (const candidate of candidateRefs) {
      const proposal = await this.prisma.proposal.findFirst({
        where: {
          proposalCode: { equals: candidate, mode: 'insensitive' },
        },
      });
      if (proposal) {
        const fp = computeDocumentFingerprint({
          docNumber: proposal.proposalCode,
          totalAmount: Number(proposal.totalAmount || 0),
          currency: proposal.currency || 'KES',
          recipientEmail: proposal.clientEmail || '',
          issueDate: proposal.createdAt,
        });
        const signatureVerified =
          effectiveSig.length >= 4
            ? fp.hashHex.startsWith(effectiveSig) || fp.hashHex.includes(effectiveSig)
            : null;
        return {
          verified: signatureVerified !== false,
          found: true,
          signatureVerified,
          documentType: 'COMMERCIAL PROPOSAL',
          referenceNumber: proposal.proposalCode,
          status: proposal.status,
          currency: proposal.currency,
          subtotal: Number(proposal.totalAmount || 0),
          vatAmount: 0,
          vatLabel: 'Included in Proposal Scope',
          totalAmount: Number(proposal.totalAmount || 0),
          amountPaid: 0,
          balanceDue: Number(proposal.totalAmount || 0),
          issuedAt: new Date(proposal.createdAt).toISOString(),
          dueDate: proposal.expiresAt ? new Date(proposal.expiresAt).toISOString() : null,
          paidAt: null,
          settlementRef: null,
          recipient: {
            businessName: proposal.clientCompany || proposal.clientName || 'Valued Client',
            emailMasked: this.maskEmailAddress(proposal.clientEmail),
          },
          issuer: {
            legalName: 'BAZION WEB',
            proprietor: 'Joseph Mburu Kiai',
            regNumber: 'BN-DLSZOZ6O',
            taxPin: resolveSupplierTaxPin(this.config.get<string>('COMPANY_KRA_PIN')) || OFFICIAL_BAZION_KRA_PIN,
            brsValidation: 'SMS "BRS" to 21546',
          },
          paymentChannels: OFFICIAL_BAZION_PAYMENT_DETAILS,
          cryptographicFingerprint: fp.formatted,
          lineItems: Array.isArray(proposal.lineItems) && proposal.lineItems.length > 0
            ? (proposal.lineItems as any[]).map((it: any) => ({
                description: String(it?.description || it?.name || 'Commercial Proposal Deliverable'),
                quantity: Math.max(1, Number(it?.quantity ?? 1)),
                amount: Number(it?.amount ?? it?.price ?? 0),
              }))
            : [
                {
                  description: 'Turnkey Web Engineering & Managed Cloud Proposal',
                  quantity: 1,
                  amount: Number(proposal.totalAmount || 0),
                },
              ],
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    return {
      verified: false,
      found: false,
      signatureVerified: false,
      documentType: null,
      referenceNumber: cleaned,
      message:
        'No official BazionWeb invoice, payment receipt, or commercial proposal matches this reference.',
      issuer: {
        legalName: 'BAZION WEB',
        proprietor: 'Joseph Mburu Kiai',
        regNumber: 'BN-DLSZOZ6O',
        taxPin: OFFICIAL_BAZION_KRA_PIN,
        brsValidation: 'SMS "BRS" to 21546',
      },
      verifiedAt: new Date().toISOString(),
    };
  }


  /** Auto-generate monthly invoices for active subscriptions — runs 1st of each month at 00:05 */
  @Cron('5 0 1 * *', { name: 'auto-invoice-generation' })
  async autoGenerateMonthlyInvoices() {
    this.logger.log('Running monthly subscription renewal invoicing...');

    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, billingCycle: BillingCycle.MONTHLY },
      include: { client: true, plan: true },
    });

    let generated = 0;
    for (const sub of activeSubscriptions) {
      try {
        await this.generate({
          clientId: sub.clientId,
          subscriptionId: sub.id,
          amount: sub.plan.priceMonthly.toNumber(),
          notes: `Automated monthly renewal — ${sub.plan.name} plan`,
        });
        generated++;
      } catch (err) {
        this.logger.error(`Failed to generate monthly renewal for client ${sub.clientId}: ${err}`);
      }
    }

    this.logger.log(`Monthly invoice generation complete — ${generated}/${activeSubscriptions.length} processed`);
  }

  /** Mark overdue invoices and trigger dunning sequences — runs daily at 06:00 */
  @Cron('0 6 * * *', { name: 'mark-overdue-invoices' })
  async markOverdueInvoices() {
    const result = await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.SENT,
        dueDate: { lt: new Date() },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} invoice(s) as OVERDUE`);
      this.events.emit('invoice.overdue_batch', { count: result.count });
    }
  }

  /**
   * Payment reconciliation sweep — runs every 10 minutes.
   * Webhooks can be missed (deployments, network blips, provider retries), so
   * payment status must never depend solely on a callback arriving. Any
   * PENDING payment older than 3 minutes is verified against its provider and
   * settled through the same idempotent path the webhooks use.
   */
  @Cron('*/10 * * * *', { name: 'reconcile-pending-payments' })
  async reconcilePendingPayments() {
    const staleBefore = new Date(Date.now() - 3 * 60 * 1000);
    // Paystack retries webhooks for up to 72h; after that a query is the only truth.
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const pending = await this.prisma.paymentLog.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: staleBefore, gt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    if (pending.length === 0) return;

    this.logger.log(`Reconciling ${pending.length} stale PENDING payment(s)…`);
    let settled = 0;
    let failed = 0;
    let unresolved = 0;

    for (const log of pending) {
      try {
        if (log.provider === PaymentProvider.PAYSTACK && log.providerRef) {
          const verification = await this.paystackService.verifyTransaction(log.providerRef);
          const charge = verification?.data;
          if (charge?.status === 'success') {
            await this.settlement.settlePaystackCharge(charge);
            settled++;
          } else if (['failed', 'abandoned', 'reversed'].includes(charge?.status)) {
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: {
                status: PaymentStatus.FAILED,
                errorMessage: `Provider status: ${charge.status}`,
                rawPayload: verification,
              },
            });
            failed++;
          } else {
            unresolved++;
          }
        } else if (log.provider === PaymentProvider.DARAJA && log.providerRef) {
          const status = await this.darajaService.queryStkStatus(log.providerRef);
          if (status.resultCode === '0') {
            // The status query carries no CallbackMetadata, so the checkout id
            // doubles as the receipt reference — same fallback the webhook uses.
            await this.settlement.settleDarajaSuccess({
              checkoutRequestId: status.checkoutRequestId || log.providerRef,
              receiptNumber: status.checkoutRequestId || log.providerRef,
              paidAmount: Number(log.amount),
              payload: status,
            });
            settled++;
          } else if (['1', '1032', '1037'].includes(status.resultCode)) {
            // 1 = insufficient funds etc., 1032 = cancelled, 1037 = timed out
            await this.prisma.paymentLog.update({
              where: { id: log.id },
              data: {
                status: PaymentStatus.FAILED,
                errorMessage: status.resultDesc || `Daraja result code ${status.resultCode}`,
                rawPayload: status as any,
              },
            });
            failed++;
          } else {
            unresolved++;
          }
        } else {
          unresolved++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Reconciliation failed for payment ${log.id} (${log.provider}): ${message}`);
        unresolved++;
      }
    }

    this.logger.log(`Reconciliation complete — settled=${settled} failed=${failed} unresolved=${unresolved}`);
  }
}
