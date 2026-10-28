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
  ProposalDepositMpesaDto
} from './dto/billing.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { checkoutLineItem } from './payment-settlement.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly paystackService: PaystackService,
    private readonly darajaService: DarajaService,
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
    const isAnnual = billingCycle === BillingCycle.ANNUAL;
    if (currency === 'KES') {
      if (isAnnual && plan.priceAnnualKes != null) return this.toNumber(plan.priceAnnualKes);
      if (!isAnnual && plan.priceMonthlyKes != null) return this.toNumber(plan.priceMonthlyKes);
      const base = isAnnual ? plan.priceAnnual : plan.priceMonthly;
      const n = this.toNumber(base);
      return Number.isFinite(n) ? n * 130 : NaN;
    }
    return this.toNumber(isAnnual ? plan.priceAnnual : plan.priceMonthly);
  }

  private newInvoiceNumber(prefix: string): string {
    return `${prefix}-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private getManualSettlementInstructions(currency: 'USD' | 'EUR' | 'GBP', paymentReference: string) {
    const beneficiary = this.config.get<string>('BANK_BENEFICIARY', 'BazionWeb Technologies Ltd');
    const accountNumber = this.config.get<string>('BANK_ACCOUNT_NUMBER', '');
    const routingNumber = this.config.get<string>('BANK_ROUTING_NUMBER', '');
    const iban = this.config.get<string>('BANK_IBAN', '');
    const swiftBic = this.config.get<string>('BANK_SWIFT_BIC', '');
    const line = this.config.get<string>('BANK_ADDRESS_LINE', '');
    const city = this.config.get<string>('BANK_ADDRESS_CITY', '');
    const country = this.config.get<string>('BANK_ADDRESS_COUNTRY', '');

    if (!accountNumber && !iban) {
      throw new ServiceUnavailableException(
        'Bank transfer details not configured — contact billing@bazionweb.com',
      );
    }

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
    const isStaff = ['ADMIN', 'SUPER_ADMIN'].some(r => user.roles?.includes(r));
    const where: any = {};

    if (!isStaff || filters.scope === 'mine') {
      const client = await this.prisma.client.findFirst({ where: { userId: user.id } });
      if (!client) return { data: [], meta: { page: 1, limit: filters.limit, total: 0, totalPages: 0 } };
      where.clientId = client.id;
    }

    if (filters.status) where.status = filters.status.toUpperCase();

    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { 
          client: { select: { businessName: true, email: true } },
          wiseReceivingAccount: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return {
      data: items,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async findOne(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { 
        client: { include: { plan: true, user: true } }, 
        subscription: true,
        wiseReceivingAccount: true,
        paymentLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
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
   * Track A: M-Pesa STK (KES) — Paystack STK Push.
   */
  async subscribeMpesa(user: any, dto: MpesaSubscriptionDto) {
    if (!dto.mpesaPhoneNumber) {
      throw new BadRequestException('Phone number is required to trigger M-Pesa prompt.');
    }
    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Organisation` : 'BazionWeb Client',
      contactName: `${user.firstName || 'Valued'} ${user.lastName || 'Client'}`.trim(),
      email: user.email,
      phone: dto.mpesaPhoneNumber,
      planId: dto.planId,
    });

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    return this.initMpesaStk({
      client,
      userId: user.id,
      phone: dto.mpesaPhoneNumber,
      plan,
      billingCycle: dto.billingCycle,
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
    plan: { id: string; name: string };
    billingCycle: BillingCycle;
  }) {
    const { client, userId, phone, plan, billingCycle } = args;

    const amount = this.planAmount(plan, billingCycle, 'KES');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Plan price is not configured for KES');
    }

    const invoiceNumber = this.newInvoiceNumber('INV-KE');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        amount,
        currency: 'KES',
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: [
          checkoutLineItem({
            description: `BazionWeb ${plan.name} (${billingCycle}) Maintenance & Infrastructure`,
            amount,
            currency: 'KES',
            planId: plan.id,
            billingCycle,
            purpose: 'subscription',
          }),
        ],
      },
    });

    return this.pushMpesaStk({
      client,
      userId,
      phone,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount, currency: invoice.currency },
      description: `BazionWeb ${plan.name}`,
      metadata: { planId: plan.id, billingCycle },
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
    const init = await this.paystackService.initializeTransaction({
      email: dto.email || invoice.client.email || user.email,
      amount,
      currency: invoice.currency,
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
        amount,
        currency: invoice.currency,
        status: PaymentStatus.PENDING,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: init as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /**
   * Track A2: Paystack card checkout (KES/USD). Server-side pricing only.
   */
  async subscribePaystack(user: any, dto: PaystackSubscriptionDto) {
    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Organisation` : 'BazionWeb Client',
      contactName: `${user.firstName || 'Valued'} ${user.lastName || 'Client'}`.trim(),
      email: dto.email || user.email,
      phone: user.phone,
      planId: dto.planId,
    });

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    const amount = this.planAmount(plan, dto.billingCycle, dto.currency);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
    }

    const invoiceNumber = this.newInvoiceNumber(dto.currency === 'KES' ? 'INV-KE' : 'INV-USD');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        amount,
        currency: dto.currency,
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: [
          checkoutLineItem({
            description: `BazionWeb ${plan.name} (${dto.billingCycle}) — card`,
            amount,
            currency: dto.currency,
            planId: plan.id,
            billingCycle: dto.billingCycle,
            purpose: 'subscription',
          }),
        ],
      },
    });

    const init = await this.paystackService.initializeTransaction({
      email: dto.email || client.email,
      amount,
      currency: dto.currency,
      invoiceNumber: invoice.invoiceNumber,
      callbackUrl: `${frontendUrl}/checkout/verify`,
      metadata: { planId: plan.id, billingCycle: dto.billingCycle, clientId: client.id },
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount,
        currency: dto.currency,
        status: PaymentStatus.PENDING,
        clientId: client.id,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: init as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
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
  }) {
    let guestUser = await this.prisma.user.findUnique({ where: { email: opts.email } });
    if (guestUser?.passwordHash || (guestUser?.keycloakId && !guestUser.keycloakId.startsWith('pending-'))) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACCOUNT_EXISTS',
        message: 'An account already exists for this email. Sign in to complete payment.',
      });
    }
    if (!guestUser) {
      guestUser = await this.prisma.user.create({
        data: {
          email: opts.email,
          role: 'CLIENT',
          firstName: opts.firstName,
          lastName: opts.lastName,
          phone: opts.phone,
        },
      });
    }

    let guest = await this.prisma.client.findUnique({ where: { userId: guestUser.id } });
    if (!guest) {
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
    } else {
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

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    const { userId, guest } = await this.resolveGuestIdentity({
      email,
      firstName,
      lastName,
      businessName: dto.businessName?.trim() || 'BazionWeb Client',
      phone: dto.mpesaPhoneNumber,
      planId: plan.id,
    });

    const result = await this.initMpesaStk({
      client: { id: guest.id, email, user: { firstName, lastName } },
      userId,
      phone: dto.mpesaPhoneNumber,
      plan,
      billingCycle: dto.billingCycle,
    });

    return { ...result, guest: true, email };
  }

  /**
   * Guest card checkout (Track C) — pay-first via Paystack, no account needed.
   */
  async subscribePaystackGuest(dto: GuestSubscriptionDto) {
    const email = dto.email.trim().toLowerCase();
    const businessName = dto.businessName?.trim() || 'BazionWeb Client';

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    const { userId, guest } = await this.resolveGuestIdentity({
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      businessName,
      phone: dto.phone,
      planId: plan.id,
    });

    const amount = this.planAmount(plan, dto.billingCycle, dto.currency);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
    }

    const invoiceNumber = this.newInvoiceNumber(dto.currency === 'KES' ? 'INV-KE' : 'INV-USD');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: guest.id,
        invoiceNumber,
        amount,
        currency: dto.currency,
        status: InvoiceStatus.SENT,
        dueDate,
        lineItems: [
          checkoutLineItem({
            description: `BazionWeb ${plan.name} (${dto.billingCycle.toLowerCase()}) — card`,
            amount,
            currency: dto.currency,
            planId: plan.id,
            billingCycle: dto.billingCycle,
            purpose: 'subscription',
          }),
        ],
      },
    });

    const init = await this.paystackService.initializeTransaction({
      email,
      amount,
      currency: dto.currency,
      invoiceNumber: invoice.invoiceNumber,
      callbackUrl: `${frontendUrl}/checkout/verify`,
      metadata: { planId: plan.id, billingCycle: dto.billingCycle, clientId: guest.id, guest: true },
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount,
        currency: dto.currency,
        status: PaymentStatus.PENDING,
        clientId: guest.id,
        invoiceId: invoice.id,
        userId,
        rawPayload: init as any,
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
    };
  }

  /**
   * Track B: Manual B2B bank-transfer invoice.
   */
  async createBankTransferInvoice(user: any, dto: BankTransferInvoiceDto) {
    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Enterprise` : 'Corporate Client',
      contactName: `${user.firstName || 'Corporate'} ${user.lastName || 'Billing'}`.trim(),
      email: user.email,
      planId: dto.planId,
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

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const { guest } = await this.resolveGuestIdentity({
      email,
      firstName: dto.firstName?.trim() || 'Corporate',
      lastName: dto.lastName?.trim() || 'Client',
      businessName: dto.businessName?.trim() || 'Corporate Client',
      phone: dto.phone,
      planId: plan.id,
    });

    return this.bankTransferInvoiceFor({ clientId: guest.id, businessName: guest.businessName }, dto);
  }

  /** Shared B2B invoice core — server-priced, invoice + manual wire details. */
  private async bankTransferInvoiceFor(
    owner: { clientId: string; businessName?: string | null },
    dto: { planId: string; billingCycle: BillingCycle; currency: 'USD' | 'EUR' | 'GBP' | 'KES'; purchaseOrderNumber?: string },
  ) {
    const client = { id: owner.clientId, businessName: owner.businessName };

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const amount = this.planAmount(plan, dto.billingCycle, dto.currency);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
    }
    const invoiceNumber = this.newInvoiceNumber('B2B-INV');
    const paymentReference = `BW-${(client.businessName || 'CORP').substring(0, 3).toUpperCase()}-${invoiceNumber.slice(-5)}`;

    const bankDetails = this.getManualSettlementInstructions(
      dto.currency === 'KES' ? 'USD' : (dto.currency as 'USD' | 'EUR' | 'GBP'),
      paymentReference,
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Net 14-day corporate payment terms

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
          lineItems: [
            checkoutLineItem({
              description: `Enterprise Lifecycle Management: ${plan.name} (${dto.billingCycle})`,
              amount,
              currency: dto.currency,
              planId: plan.id,
              billingCycle: dto.billingCycle,
              purpose: 'subscription',
            }),
          ],
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

    this.events.emit('invoice.created', { invoiceNumber, clientId: client.id, amount });

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

    const email = (dto.email || proposal.clientEmail).trim().toLowerCase();
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

  /** Guest card payment for an accepted proposal's kickoff deposit. */
  async payProposalDepositCard(code: string, dto: ProposalDepositCardDto) {
    const { proposal, invoice } = await this.proposalDepositInvoice(code);
    if (invoice.currency !== 'KES' && invoice.currency !== 'USD') {
      throw new BadRequestException(`Card checkout does not support ${invoice.currency} — use M-Pesa or bank transfer.`);
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://bazionweb.com');
    const amount = Number(invoice.amount);
    const init = await this.paystackService.initializeTransaction({
      email: dto.email?.trim().toLowerCase() || proposal.clientEmail,
      amount,
      currency: invoice.currency as 'KES' | 'USD',
      invoiceNumber: invoice.invoiceNumber,
      callbackUrl: `${frontendUrl}/checkout/verify`,
      metadata: { clientId: invoice.clientId, purpose: 'invoice_payment', invoiceNumber: invoice.invoiceNumber },
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `PAYSTACK_${init.reference}`,
        provider: PaymentProvider.PAYSTACK,
        providerRef: init.reference,
        method: PaymentMethodType.CARD,
        amount,
        currency: invoice.currency,
        status: PaymentStatus.PENDING,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        rawPayload: init as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      provider: 'PAYSTACK',
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      invoiceNumber: invoice.invoiceNumber,
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

  async generate(dto: { clientId: string; subscriptionId?: string; amount: number; notes?: string }) {
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: dto.clientId,
        subscriptionId: dto.subscriptionId,
        invoiceNumber,
        amount: dto.amount,
        currency: 'USD',
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: dto.notes,
      },
    });

    this.events.emit('invoice.created', { invoice });
    return { data: invoice };
  }

  async markPaid(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    });

    this.events.emit('invoice.paid', { invoice: updated });
    return { data: updated };
  }

  async getPdfUrl(id: string, user: any) {
    await this.findOne(id, user);
    return {
      data: {
        url: `/api/v1/invoices/${id}/pdf/download`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
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
}
