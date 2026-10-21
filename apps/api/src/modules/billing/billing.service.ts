import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  BadRequestException, 
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
import { IntaSendService } from './intasend.service';
import { PaystackService } from './paystack.service';
import { WiseService } from './wise.service';
import { IntaSendSubscriptionDto, PaystackSubscriptionDto, BankTransferInvoiceDto, WiseCorporateInvoiceDto, GuestSubscriptionDto } from './dto/billing.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly intasendService: IntaSendService,
    private readonly paystackService: PaystackService,
    private readonly wiseService: WiseService,
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
   * Track A: M-Pesa STK (KES) — Paystack /charge primary, IntaSend fallback.
   * Route kept as /subscribe/intasend for backwards compat. Amount from server pricebook.
   */
  async subscribeIntaSend(user: any, dto: IntaSendSubscriptionDto) {
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

    const amount = this.planAmount(plan, dto.billingCycle, 'KES');
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
        dueDate,
        lineItems: [
          {
            description: `BazionWeb ${plan.name} (${dto.billingCycle}) Maintenance & Infrastructure`,
            amount,
            quantity: 1,
          },
        ],
      },
    });

    // Primary: Paystack STK (1.5%). Amounts >150k exceed Paystack M-Pesa cap → IntaSend.
    if (amount <= 150_000) {
      try {
        const stk = await this.paystackService.chargeMpesaStk({
          email: client.email,
          amount,
          phone: dto.mpesaPhoneNumber,
          invoiceNumber: invoice.invoiceNumber,
          metadata: { planId: plan.id, billingCycle: dto.billingCycle, clientId: client.id },
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
            userId: user.id,
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
      } catch (err: any) {
        // Fail over to IntaSend below — log reason, never expose gateway internals.
        this.logger.warn(
          `Paystack STK failed for ${invoice.invoiceNumber}, falling back to IntaSend: ${err?.message}`,
        );
      }
    }

    // Fallback: IntaSend STK (3%) — >150k tickets, Till/Paybill, Paystack outages.
    await this.intasendService.getOrCreateCustomer({
      email: client.email,
      first_name: client.user.firstName || 'Client',
      last_name: client.user.lastName || 'Account',
      phone_number: dto.mpesaPhoneNumber,
    });

    const stkResult = await this.intasendService.triggerMpesaStkPush({
      phoneNumber: dto.mpesaPhoneNumber,
      amount,
      currency: 'KES',
      narrative: `BazionWeb ${plan.name}`,
      invoiceNumber: invoice.invoiceNumber,
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `INTASEND_STK_${stkResult.trackingId}_${invoice.id}`,
        provider: PaymentProvider.INTASEND,
        providerRef: stkResult.trackingId,
        method: PaymentMethodType.MPESA,
        amount,
        currency: 'KES',
        status: PaymentStatus.PENDING,
        clientId: client.id,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: stkResult as any,
      },
    });

    return {
      status: 'PENDING_STK_INPUT',
      method: 'MPESA',
      provider: 'INTASEND_FALLBACK',
      message: stkResult.customerMessage,
      invoiceNumber: invoice.invoiceNumber,
      trackingId: stkResult.trackingId,
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
        dueDate,
        lineItems: [
          {
            description: `BazionWeb ${plan.name} (${dto.billingCycle}) — card`,
            amount,
            currency: dto.currency,
            quantity: 1,
          },
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
   * Guest card checkout (Track C) — pay-first, no account needed.
   * Server-priced: the client supplies a planId, never an amount.
   * Creates a guest Client keyed by email (no userId) + invoice, then
   * redirects to Paystack. The webhook activates everything on charge.success;
   * the customer claims the account afterwards in one step.
   */
  async subscribePaystackGuest(dto: GuestSubscriptionDto) {
    const email = dto.email.trim().toLowerCase();
    const businessName = dto.businessName?.trim() || 'BazionWeb Client';

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    const amount = this.planAmount(plan, dto.billingCycle, dto.currency);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`Plan price not configured for ${dto.currency}`);
    }

    // Guest identity: a passwordless user row (claim sets the password later)
    // plus its required 1:1 client profile. Email is the join key.
    let guestUser = await this.prisma.user.findUnique({ where: { email } });
    if (!guestUser) {
      guestUser = await this.prisma.user.create({
        data: {
          email,
          role: 'CLIENT',
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone,
        },
      });
    }

    let guest = await this.prisma.client.findUnique({ where: { userId: guestUser.id } });
    if (!guest) {
      guest = await this.prisma.client.create({
        data: {
          userId: guestUser.id,
          businessName,
          contactName: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
          email,
          phone: dto.phone,
          planId: plan.id,
          status: 'TRIAL',
        },
      });
    } else {
      // Keep the latest plan intent if the guest switched plans between visits.
      if (guest.planId !== plan.id || guest.businessName !== businessName) {
        guest = await this.prisma.client.update({
          where: { id: guest.id },
          data: { planId: plan.id, businessName },
        });
      }
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
        dueDate,
        lineItems: [
          {
            description: `BazionWeb ${plan.name} (${dto.billingCycle.toLowerCase()}) — card`,
            amount,
            currency: dto.currency,
            quantity: 1,
          },
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
   * Track B: Manual B2B bank-transfer invoice (Wise virtual accounts unavailable in KE).
   * Wise is used for invoice links / payouts only — never for receiving details.
   */
  async createBankTransferInvoice(user: any, dto: BankTransferInvoiceDto) {
    const client = await this.resolveClient(user, {
      businessName: user.firstName ? `${user.firstName}'s Enterprise` : 'Corporate Client',
      contactName: `${user.firstName || 'Corporate'} ${user.lastName || 'Billing'}`.trim(),
      email: user.email,
      planId: dto.planId,
    });

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

    const bankDetails = this.wiseService.getManualSettlementInstructions(
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
          dueDate,
          notes: dto.purchaseOrderNumber ? `PO Ref: ${dto.purchaseOrderNumber}` : null,
          lineItems: [
            {
              description: `Enterprise Lifecycle Management: ${plan.name} (${dto.billingCycle})`,
              amount,
              currency: dto.currency,
              quantity: 1,
            },
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

  /** @deprecated Alias — use createBankTransferInvoice */
  async createWiseCorporateInvoice(user: any, dto: WiseCorporateInvoiceDto) {
    return this.createBankTransferInvoice(user, dto);
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
