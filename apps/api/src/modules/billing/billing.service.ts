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
import { WiseService } from './wise.service';
import { IntaSendSubscriptionDto, WiseCorporateInvoiceDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly intasendService: IntaSendService,
    private readonly wiseService: WiseService,
  ) {}

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
   * Track A: IntaSend Subscription (M-Pesa STK Push or Card Tokenization)
   */
  async subscribeIntaSend(user: any, dto: IntaSendSubscriptionDto) {
    // 1. Resolve client record
    let client = await this.prisma.client.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    if (!client) {
      // Auto-register client entity for active user if not existing
      client = await this.prisma.client.create({
        data: {
          userId: user.id,
          businessName: user.firstName ? `${user.firstName}'s Organisation` : 'BazionWeb Client',
          contactName: `${user.firstName || 'Valued'} ${user.lastName || 'Client'}`.trim(),
          email: user.email,
          phone: dto.mpesaPhoneNumber || user.phone || '254700000000',
          planId: dto.planId,
        },
        include: { user: true },
      });
    }

    // 2. Resolve Plan
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('The selected subscription plan is inactive or does not exist.');
    }

    const isAnnual = dto.billingCycle === BillingCycle.ANNUAL;
    const amount = isAnnual
      ? Number(plan.priceAnnualKes || plan.priceAnnual.toNumber() * 130)
      : Number(plan.priceMonthlyKes || plan.priceMonthly.toNumber() * 130);

    const invoiceNumber = `INV-KE-${Date.now().toString().slice(-8)}`;

    // 3. Register or verify IntaSend customer
    await this.intasendService.getOrCreateCustomer({
      email: client.email,
      first_name: client.user.firstName || 'Client',
      last_name: client.user.lastName || 'Account',
      phone_number: dto.mpesaPhoneNumber || client.phone || undefined,
    });

    // 4. Create pending invoice
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

    // 5. Branch: M-Pesa STK Push
    if (dto.paymentMethod === 'MPESA') {
      if (!dto.mpesaPhoneNumber) {
        throw new BadRequestException('Phone number is required to trigger M-Pesa prompt.');
      }

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
        message: stkResult.customerMessage,
        invoiceNumber: invoice.invoiceNumber,
        trackingId: stkResult.trackingId,
      };
    }

    // Branch: Credit Card
    const checkoutSession = await this.intasendService.createCheckoutSession({
      amount,
      currency: 'KES',
      email: client.email,
      firstName: client.user.firstName || 'Client',
      lastName: client.user.lastName || 'Account',
      invoiceNumber: invoice.invoiceNumber,
      redirectUrl: `${process.env.FRONTEND_URL || 'https://bazionweb.com'}/billing/verification?invoice=${invoice.invoiceNumber}`,
    });

    await this.prisma.paymentLog.create({
      data: {
        idempotencyKey: `INTASEND_CARD_${checkoutSession.trackingId}`,
        provider: PaymentProvider.INTASEND,
        providerRef: checkoutSession.trackingId,
        method: PaymentMethodType.CARD,
        amount,
        currency: 'KES',
        status: PaymentStatus.PENDING,
        clientId: client.id,
        invoiceId: invoice.id,
        userId: user.id,
        rawPayload: checkoutSession as any,
      },
    });

    return {
      status: 'REDIRECT_REQUIRED',
      method: 'CARD',
      checkoutUrl: checkoutSession.checkoutUrl,
      trackingId: checkoutSession.trackingId,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /**
   * Track B: Wise Corporate B2B Invoicing (Virtual IBAN / ACH allocation)
   */
  async createWiseCorporateInvoice(user: any, dto: WiseCorporateInvoiceDto) {
    let client = await this.prisma.client.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          userId: user.id,
          businessName: user.firstName ? `${user.firstName}'s Enterprise` : 'Corporate Client',
          contactName: `${user.firstName || 'Corporate'} ${user.lastName || 'Billing'}`.trim(),
          email: user.email,
          planId: dto.planId,
        },
        include: { user: true },
      });
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const isAnnual = dto.billingCycle === BillingCycle.ANNUAL;
    const amount = isAnnual ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
    const invoiceNumber = `B2B-INV-${Date.now().toString().slice(-7)}`;
    const paymentReference = `BW-${(client.businessName || 'CORP').substring(0, 3).toUpperCase()}-${invoiceNumber.slice(-5)}`;

    const bankDetails = await this.wiseService.generateVirtualBankDetails(dto.currency);

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
          wiseAccountId: bankDetails.id,
          currency: dto.currency,
          accountHolder: bankDetails.accountHolderName,
          accountNumber: bankDetails.accountNumber,
          routingNumber: bankDetails.routingNumber,
          swiftBic: bankDetails.swiftBic,
          iban: bankDetails.iban,
          bankAddress: bankDetails.bankAddress as any,
          paymentReference,
          expiresAt: dueDate,
        },
      });

      return { invoice, wiseAccount };
    });

    return {
      status: 'INVOICE_GENERATED',
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
        referenceNote: `Quote payment reference "${paymentReference}" on your bank remittance advice.`,
      },
    };
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
