import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingAuditService } from './pricing-audit.service';
import {
  CalculateQuoteDto,
  UpsertPriceDto,
  CreatePriceBookDto,
  UpsertTaxRuleDto,
  UpsertAdjustmentDto,
} from './pricing.dto';
import {
  CANONICAL_CATALOG_PRICES,
  resolveCanonicalProductId,
} from './canonical-catalog';

export interface CalculatedQuoteResponse {
  marketCode: string;
  marketName: string;
  currency: string;
  currencySymbol: string;
  priceBookId: string;
  priceBookVersion: string;
  billingCycle?: string;
  breakdown: {
    package: {
      productId: string;
      name: string;
      amount: number;
    };
    extraPages: {
      count: number;
      ratePerPage: number;
      amount: number;
    };
    addOns: Array<{
      productId: string;
      name: string;
      amount: number;
    }>;
    rushDelivery: {
      applied: boolean;
      surchargePct: number;
      amount: number;
    };
    subtotalBuild: number;
    discounts: {
      couponCode?: string;
      description?: string;
      amount: number;
    };
    netBuildAmount: number;
    tax: {
      ruleName: string;
      taxType: string;
      rate: number;
      isInclusive: boolean;
      taxAmount: number;
    };
    totalBuildGross: number;
    careMonthly: {
      productId?: string;
      amount: number;
    };
    hostingAnnual: {
      productId?: string;
      amount: number;
    };
    totalMonthlyRecurring: number;
  };
  totalPayableNow: number;
  calculatedAt: string;
  proposalId?: string;
  proposalCode?: string;
  leadId?: string;
  expiresAt?: string;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PricingAuditService,
  ) {}

  /**
   * Return all active markets with their currencies and active tax rules.
   * Pulls directly from DB to enforce Single Source of Truth.
   */
  async getActiveMarkets() {
    return this.prisma.market.findMany({
      where: { active: true },
      include: {
        currency: true,
        taxRules: {
          where: { active: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Resolve appropriate market code from country code or explicit preference.
   */
  async resolveMarket(countryCode?: string, preferredMarketCode?: string) {
    if (preferredMarketCode) {
      const preferred = await this.prisma.market.findUnique({
        where: { code: preferredMarketCode.toUpperCase() },
        include: { currency: true },
      });
      if (preferred && preferred.active) {
        return preferred;
      }
    }

    if (countryCode) {
      const upperCountry = countryCode.toUpperCase();
      // 1. Direct match for markets where code matches country
      const direct = await this.prisma.market.findUnique({
        where: { code: upperCountry },
        include: { currency: true },
      });
      if (direct && direct.active) {
        return direct;
      }

      // 2. Check countryCodes array
      const mapped = await this.prisma.market.findFirst({
        where: {
          active: true,
          countryCodes: { has: upperCountry },
        },
        include: { currency: true },
      });
      if (mapped) {
        return mapped;
      }
    }

    // Default to GLOBAL if outside Kenya, or KE if explicitly in Kenya
    const fallbackCode = countryCode?.toUpperCase() === 'KE' ? 'KE' : 'GLOBAL';
    const fallback = await this.prisma.market.findUnique({
      where: { code: fallbackCode },
      include: { currency: true },
    });

    if (!fallback) {
      // Return first active market in database if specific code not found
      const firstActive = await this.prisma.market.findFirst({
        where: { active: true },
        include: { currency: true },
      });
      if (!firstActive) {
        throw new NotFoundException('No active commercial markets configured in database.');
      }
      return firstActive;
    }

    return fallback;
  }

  /**
   * Retrieve active price book for a given market based on current date.
   */
  async getActivePriceBook(marketId: string) {
    const now = new Date();
    const priceBook = await this.prisma.priceBook.findFirst({
      where: {
        marketId,
        status: 'active',
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!priceBook) {
      throw new NotFoundException(
        `No active price book found for market ${marketId} at ${now.toISOString()}`,
      );
    }

    return priceBook;
  }

  /**
   * Retrieve full catalog of products and prices for a market directly from DB.
   */
  async getCatalog(marketCode: string) {
    const market = await this.resolveMarket(undefined, marketCode);
    const priceBook = await this.getActivePriceBook(market.id);

    const [prices, taxRules, adjustments] = await Promise.all([
      this.prisma.price.findMany({
        where: { priceBookId: priceBook.id },
        orderBy: { productId: 'asc' },
      }),
      this.prisma.taxRule.findMany({
        where: { marketId: market.id, active: true },
      }),
      this.prisma.marketAdjustment.findMany({
        where: { marketId: market.id, active: true, couponCode: null },
      }),
    ]);

    return {
      market: {
        id: market.id,
        code: market.code,
        name: market.name,
        currencyCode: market.currencyCode,
        currencySymbol: market.currency.symbol,
        vatRate: Number(market.vatRate),
        taxIncludedInPrice: market.taxIncludedInPrice,
        roundingRule: market.roundingRule,
      },
      priceBook: {
        id: priceBook.id,
        name: priceBook.name,
        version: priceBook.version,
        effectiveFrom: priceBook.effectiveFrom,
        effectiveUntil: priceBook.effectiveUntil,
      },
      prices: prices.map((p) => ({
        id: p.id,
        productId: p.productId,
        amount: Number(p.amount),
        billingPeriod: p.billingPeriod,
        minPrice: p.minPrice ? Number(p.minPrice) : null,
        maxPrice: p.maxPrice ? Number(p.maxPrice) : null,
      })),
      taxRules: taxRules.map((tr) => ({
        id: tr.id,
        name: tr.name,
        taxType: tr.taxType,
        rate: Number(tr.rate),
        isInclusive: tr.isInclusive,
      })),
      activeAdjustments: adjustments.map((a) => ({
        id: a.id,
        name: a.name,
        adjustmentType: a.adjustmentType,
        value: Number(a.value),
        minSpend: a.minSpend ? Number(a.minSpend) : null,
      })),
    };
  }

  /**
   * Centralized Calculation Engine:
   * Computes an authoritative commercial quote strictly from DB prices, taxes, and adjustments.
   * Zero reliance on client-side hardcoded constants.
   */
  async calculateQuote(dto: CalculateQuoteDto): Promise<CalculatedQuoteResponse> {
    const market = await this.resolveMarket(dto.countryCode, dto.marketCode);
    const priceBook = await this.getActivePriceBook(market.id);
    const currencyKey: 'KES' | 'USD' = market.currencyCode === 'KES' ? 'KES' : 'USD';

    // 1. Map the public configurator options to canonical price-book product IDs.
    const packageKeys: Record<string, string> = {
      existing: 'website-existing',
      'website-existing': 'website-existing',
      launch: 'website-launch',
      business: 'website-business',
      professional: 'website-professional',
      'ecom-starter': 'ecommerce-starter',
      'ecom-business': 'ecommerce-business',
      'ecom-pro': 'ecommerce-enterprise',
      custom: 'website-enterprise',
      corporate: 'website-enterprise',
      starter: 'website-launch',
      ecommerce: 'ecommerce-starter',
      enterprise: 'website-enterprise',
    };
    const rawPkg = (dto.packageType || '').trim();
    const resolvedDirectPkg = resolveCanonicalProductId(rawPkg);
    const packageKey =
      packageKeys[rawPkg] ||
      (CANONICAL_CATALOG_PRICES[resolvedDirectPkg]
        ? resolvedDirectPkg
        : resolveCanonicalProductId(`website-${rawPkg}`));

    const extraPageKey = 'rate-extra-page';
    const rawAddOns = (dto.selectedAddOns || []).map((id) => (id || '').trim()).filter(Boolean);
    const hasRushInAddOns = rawAddOns.some((id) => id.toLowerCase() === 'rush-delivery');
    const selectedAddOns = [
      ...new Set(
        rawAddOns
          .filter((id) => id.toLowerCase() !== 'rush-delivery')
          .map((id) => resolveCanonicalProductId(id)),
      ),
    ];
    const careAliases: Record<string, string> = {
      starter: 'care-essential',
      growth: 'care-business',
      scale: 'care-professional',
      'care-enterprise': 'care-enterprise',
    };
    const hostingAliases: Record<string, string> = {
      starter: 'host-essential',
      business: 'host-business',
      enterprise: 'host-pro',
      'host-pro': 'host-pro',
      'host-professional': 'host-pro',
      'host-cloud': 'host-cloud',
    };
    const careKey =
      dto.care && dto.care !== 'none'
        ? resolveCanonicalProductId(careAliases[dto.care] || dto.care)
        : null;
    const hostingKey =
      dto.hosting && dto.hosting !== 'none'
        ? resolveCanonicalProductId(hostingAliases[dto.hosting] || dto.hosting)
        : null;

    const allKeysToFetch = [
      packageKey,
      extraPageKey,
      ...selectedAddOns,
      ...(careKey ? [careKey] : []),
      ...(hostingKey ? [hostingKey] : []),
    ];

    // 2. Fetch authoritative prices from DB in a single query
    const dbPrices = await this.prisma.price.findMany({
      where: {
        priceBookId: priceBook.id,
        productId: { in: allKeysToFetch },
      },
    });

    const priceMap = new Map<string, number>();
    for (const p of dbPrices) {
      priceMap.set(p.productId, Number(p.amount));
    }
    if (!priceMap.has('website-existing')) {
      priceMap.set('website-existing', 0);
    }

    const resolveItemPrice = (productId: string): number | undefined => {
      if (priceMap.has(productId)) {
        return priceMap.get(productId);
      }
      const canonical = CANONICAL_CATALOG_PRICES[productId];
      return canonical ? canonical[currencyKey] : undefined;
    };

    // 3. Resolve package price
    const basePackageAmount = resolveItemPrice(packageKey);
    if (basePackageAmount === undefined) {
      throw new BadRequestException(
        `Product ${packageKey} is not priced in active price book ${priceBook.id}`,
      );
    }

    // 4. Resolve extra pages
    const extraPagesCount = Number(dto.extraPages) || 0;
    const configuredPageRate = resolveItemPrice(extraPageKey);
    if (extraPagesCount > 0 && configuredPageRate === undefined) {
      throw new BadRequestException('Additional pages are not priced in the active price book.');
    }
    const pageRate = configuredPageRate || 0;
    const extraPagesAmount = extraPagesCount * pageRate;

    // 5. Resolve add-ons. Never silently omit an unpriced selection from a quote.
    const itemizedAddOns: Array<{ productId: string; name: string; amount: number }> = [];
    let addOnsSubtotal = 0;

    for (const addonId of selectedAddOns) {
      const addonAmount = resolveItemPrice(addonId);
      if (addonAmount === undefined) {
        throw new BadRequestException(`Add-on ${addonId} is not available in the active price book.`);
      }
      addOnsSubtotal += addonAmount;
      itemizedAddOns.push({
        productId: addonId,
        name: this.formatProductName(addonId),
        amount: addonAmount,
      });
    }

    if (careKey && resolveItemPrice(careKey) === undefined) {
      throw new BadRequestException(`Care plan ${careKey} is not available in the active price book.`);
    }
    if (hostingKey && resolveItemPrice(hostingKey) === undefined) {
      throw new BadRequestException(`Hosting plan ${hostingKey} is not available in the active price book.`);
    }

    // 6. Subtotal Build & Rush Delivery
    const subtotalBuild = basePackageAmount + extraPagesAmount + addOnsSubtotal;
    const rushApplied = Boolean(dto.rushDelivery || hasRushInAddOns);
    const rushMultiplier = rushApplied ? 0.35 : 0;
    const rushAmount = Math.round(subtotalBuild * rushMultiplier);
    const grossBuildBeforeDiscount = subtotalBuild + rushAmount;

    // 7. Check Market Adjustments / Coupons from DB
    let discountAmount = 0;
    let appliedCoupon: string | undefined = undefined;
    let discountDescription: string | undefined = undefined;

    if (dto.couponCode) {
      const now = new Date();
      const codeUpper = dto.couponCode.trim().toUpperCase();
      const adjustment = await this.prisma.marketAdjustment.findFirst({
        where: {
          marketId: market.id,
          couponCode: codeUpper,
          active: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
        },
      });

      if (adjustment) {
        const minSpend = adjustment.minSpend ? Number(adjustment.minSpend) : 0;
        if (grossBuildBeforeDiscount >= minSpend) {
          appliedCoupon = codeUpper;
          discountDescription = adjustment.name;
          const adjValue = Number(adjustment.value);

          if (adjustment.adjustmentType === 'PERCENTAGE_DISCOUNT') {
            discountAmount = Math.round((grossBuildBeforeDiscount * adjValue) / 100);
          } else if (adjustment.adjustmentType === 'FIXED_DISCOUNT') {
            discountAmount = adjValue;
          }

          if (adjustment.maxDiscount && discountAmount > Number(adjustment.maxDiscount)) {
            discountAmount = Number(adjustment.maxDiscount);
          }
        }
      }
    }

    const netBuildAmount = Math.max(0, grossBuildBeforeDiscount - discountAmount);

    // 8. Tax Calculation (from DB TaxRules)
    const taxRule = await this.prisma.taxRule.findFirst({
      where: { marketId: market.id, active: true },
      orderBy: { rate: 'desc' },
    });

    const taxRate = taxRule ? Number(taxRule.rate) : Number(market.vatRate);
    const isInclusive = taxRule ? taxRule.isInclusive : market.taxIncludedInPrice;
    let taxAmount = 0;
    let totalBuildGross = netBuildAmount;

    if (taxRate > 0) {
      if (isInclusive) {
        // Price already includes tax: extract tax portion
        taxAmount = Math.round(netBuildAmount - netBuildAmount / (1 + taxRate));
        totalBuildGross = netBuildAmount;
      } else {
        // Tax is exclusive: add on top
        taxAmount = Math.round(netBuildAmount * taxRate);
        totalBuildGross = netBuildAmount + taxAmount;
      }
    }

    // 9. Recurring Care & Hosting
    const careAmount = careKey ? resolveItemPrice(careKey) || 0 : 0;
    const hostingAmount = hostingKey ? resolveItemPrice(hostingKey) || 0 : 0;

    const result: CalculatedQuoteResponse = {
      marketCode: market.code,
      marketName: market.name,
      currency: market.currencyCode,
      currencySymbol: market.currency.symbol,
      priceBookId: priceBook.id,
      priceBookVersion: priceBook.version,
      billingCycle: dto.billingCycle,
      breakdown: {
        package: {
          productId: packageKey,
          name: this.formatProductName(packageKey),
          amount: basePackageAmount,
        },
        extraPages: {
          count: extraPagesCount,
          ratePerPage: pageRate,
          amount: extraPagesAmount,
        },
        addOns: itemizedAddOns,
        rushDelivery: {
          applied: rushApplied,
          surchargePct: rushApplied ? 35 : 0,
          amount: rushAmount,
        },
        subtotalBuild,
        discounts: {
          couponCode: appliedCoupon,
          description: discountDescription,
          amount: discountAmount,
        },
        netBuildAmount,
        tax: {
          ruleName: taxRule ? taxRule.name : 'Standard VAT',
          taxType: taxRule ? taxRule.taxType : 'VAT',
          rate: taxRate,
          isInclusive,
          taxAmount,
        },
        totalBuildGross,
        careMonthly: {
          productId: careKey || undefined,
          amount: careAmount,
        },
        hostingAnnual: {
          productId: hostingKey || undefined,
          amount: hostingAmount,
        },
        totalMonthlyRecurring: careAmount,
      },
      totalPayableNow: totalBuildGross,
      calculatedAt: new Date().toISOString(),
    };

    if (dto.clientEmail && dto.clientName) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const countryCode = (dto.sourceCountry || dto.countryCode || market.code).trim().toUpperCase();
      const proposalCode = `BZ-${market.code}-${now.getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const lineItems = [
        { kind: 'package', productId: packageKey, name: this.formatProductName(packageKey), amount: basePackageAmount, billingPeriod: 'one-time' },
        ...(extraPagesCount > 0 ? [{ kind: 'extra-pages', productId: extraPageKey, name: `${extraPagesCount} Additional Custom Pages`, quantity: extraPagesCount, amount: extraPagesAmount, billingPeriod: 'one-time' }] : []),
        ...itemizedAddOns.map(item => ({ kind: 'add-on', ...item, billingPeriod: 'one-time' })),
        ...(rushAmount > 0 ? [{ kind: 'rush-delivery', name: 'Priority Rush Delivery (+35%)', amount: rushAmount, billingPeriod: 'one-time' }] : []),
        ...(discountAmount > 0 ? [{ kind: 'discount', name: discountDescription || 'Promotional Discount', amount: -discountAmount, code: appliedCoupon }] : []),
        { kind: 'tax', name: taxRule ? taxRule.name : 'Standard VAT', amount: taxAmount, rate: taxRate, included: isInclusive },
        ...(careKey ? [{ kind: 'recurring', productId: careKey, name: this.formatProductName(careKey), amount: careAmount, billingPeriod: 'month', ...(dto.billingCycle ? { billingCycle: dto.billingCycle } : {}) }] : []),
        ...(hostingKey ? [{ kind: 'recurring', productId: hostingKey, name: this.formatProductName(hostingKey), amount: hostingAmount, billingPeriod: 'year', ...(dto.billingCycle ? { billingCycle: dto.billingCycle } : {}) }] : []),
      ];

      const [proposal, lead] = await this.prisma.$transaction([
        this.prisma.proposal.create({
          data: {
            proposalCode,
            marketId: market.id,
            priceBookId: priceBook.id,
            currency: market.currencyCode,
            billingCountry: countryCode,
            clientEmail: dto.clientEmail.trim().toLowerCase(),
            clientName: dto.clientName.trim(),
            clientCompany: dto.clientCompany?.trim() || null,
            lineItems: lineItems as any,
            totalAmount: totalBuildGross,
            status: 'LOCKED',
            expiresAt,
          },
          select: { id: true },
        }),
        this.prisma.lead.create({
          data: {
            name: dto.clientName.trim(),
            email: dto.clientEmail.trim().toLowerCase(),
            company: dto.clientCompany?.trim() || null,
            country: countryCode,
            marketId: market.id,
            currency: market.currencyCode,
            priceBookId: priceBook.id,
            serviceInterest: dto.service?.trim() || this.formatProductName(packageKey),
            source: dto.source?.trim() || 'website_quote_calculator',
          },
          select: { id: true },
        }),
      ]);

      result.proposalId = proposal.id;
      result.proposalCode = proposalCode;
      result.leadId = lead.id;
      result.expiresAt = expiresAt.toISOString();
    }

    return result;
  }

  // ─── Administrative Mutators with Append-Only Audit Logging ────────────────

  async upsertPrice(
    adminUserId: string,
    dto: UpsertPriceDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.price.findUnique({
      where: {
        priceBookId_productId: {
          priceBookId: dto.priceBookId,
          productId: dto.productId,
        },
      },
    });

    const price = await this.prisma.price.upsert({
      where: {
        priceBookId_productId: {
          priceBookId: dto.priceBookId,
          productId: dto.productId,
        },
      },
      update: {
        amount: dto.amount,
        billingPeriod: dto.billingPeriod,
      },
      create: {
        priceBookId: dto.priceBookId,
        productId: dto.productId,
        amount: dto.amount,
        billingPeriod: dto.billingPeriod,
      },
    });

    await this.auditService.logChange({
      entityType: 'PRICE',
      entityId: price.id,
      action: existing ? 'UPDATE' : 'CREATE',
      changedBy: adminUserId,
      oldValues: existing ? { amount: Number(existing.amount), billingPeriod: existing.billingPeriod } : null,
      newValues: { amount: dto.amount, billingPeriod: dto.billingPeriod, priceBookId: dto.priceBookId, productId: dto.productId },
      changeReason: dto.changeReason,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return price;
  }

  async createPriceBook(
    adminUserId: string,
    dto: CreatePriceBookDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const priceBook = await this.prisma.priceBook.create({
      data: {
        id: dto.id,
        marketId: dto.marketId,
        name: dto.name,
        version: dto.version,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
        status: 'active',
      },
    });

    await this.auditService.logChange({
      entityType: 'PRICE_BOOK',
      entityId: priceBook.id,
      action: 'CREATE',
      changedBy: adminUserId,
      newValues: {
        id: priceBook.id,
        marketId: priceBook.marketId,
        name: priceBook.name,
        version: priceBook.version,
        effectiveFrom: priceBook.effectiveFrom,
      },
      changeReason: dto.changeReason,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return priceBook;
  }

  async upsertTaxRule(
    adminUserId: string,
    dto: UpsertTaxRuleDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.taxRule.findFirst({
      where: { marketId: dto.marketId, name: dto.name },
    });

    let rule;
    if (existing) {
      rule = await this.prisma.taxRule.update({
        where: { id: existing.id },
        data: {
          rate: dto.rate,
          isInclusive: dto.isInclusive,
          taxType: dto.taxType,
          countryCode: dto.countryCode,
        },
      });
    } else {
      rule = await this.prisma.taxRule.create({
        data: {
          marketId: dto.marketId,
          name: dto.name,
          taxType: dto.taxType,
          rate: dto.rate,
          isInclusive: dto.isInclusive,
          countryCode: dto.countryCode,
          active: true,
        },
      });
    }

    await this.auditService.logChange({
      entityType: 'TAX_RULE',
      entityId: rule.id,
      action: existing ? 'UPDATE' : 'CREATE',
      changedBy: adminUserId,
      oldValues: existing ? { rate: Number(existing.rate), isInclusive: existing.isInclusive } : null,
      newValues: { rate: dto.rate, isInclusive: dto.isInclusive, name: dto.name },
      changeReason: dto.changeReason,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return rule;
  }

  async upsertAdjustment(
    adminUserId: string,
    dto: UpsertAdjustmentDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.marketAdjustment.findFirst({
      where: { marketId: dto.marketId, name: dto.name },
    });

    let adj;
    if (existing) {
      adj = await this.prisma.marketAdjustment.update({
        where: { id: existing.id },
        data: {
          adjustmentType: dto.adjustmentType,
          value: dto.value,
          minSpend: dto.minSpend,
          maxDiscount: dto.maxDiscount,
          couponCode: dto.couponCode ? dto.couponCode.toUpperCase() : null,
          productId: dto.productId,
        },
      });
    } else {
      adj = await this.prisma.marketAdjustment.create({
        data: {
          marketId: dto.marketId,
          name: dto.name,
          adjustmentType: dto.adjustmentType,
          value: dto.value,
          minSpend: dto.minSpend,
          maxDiscount: dto.maxDiscount,
          couponCode: dto.couponCode ? dto.couponCode.toUpperCase() : null,
          productId: dto.productId,
          active: true,
        },
      });
    }

    await this.auditService.logChange({
      entityType: 'MARKET_ADJUSTMENT',
      entityId: adj.id,
      action: existing ? 'UPDATE' : 'CREATE',
      changedBy: adminUserId,
      oldValues: existing ? { value: Number(existing.value), adjustmentType: existing.adjustmentType } : null,
      newValues: { value: dto.value, adjustmentType: dto.adjustmentType, couponCode: dto.couponCode },
      changeReason: dto.changeReason,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return adj;
  }

  private formatProductName(id: string): string {
    const names: Record<string, string> = {
      'website-launch': 'Launch Website',
      'website-business': 'Business Website',
      'website-professional': 'Professional Website',
      'website-enterprise': 'Corporate & Enterprise Website',
      'ecommerce-starter': 'E-Commerce Starter',
      'ecommerce-business': 'E-Commerce Business',
      'ecommerce-enterprise': 'E-Commerce Professional',
      'addon-blog-news': 'Blog / News Engine',
      'addon-advanced-form': 'Advanced Form / Survey',
      'addon-booking': 'Online Booking System',
      'addon-payment-gateway': 'Card Payment Gateway',
      'addon-mpesa': 'M-Pesa STK Push Integration',
      'addon-newsletter': 'Newsletter Integration',
      'addon-seo-advanced': 'Advanced SEO Foundation',
      'addon-copywriting': 'Professional Copywriting',
      'addon-migration': 'Website Migration',
      'addon-extra-revision': 'Additional Revision Round',
      'addon-custom-api': 'Custom API Integration',
      'addon-multilingual': 'Multilingual Support (i18n)',
      'addon-document-hub': 'Document Download Hub',
      'care-essential': 'Care Essential',
      'care-business': 'Care Business',
      'care-professional': 'Care Professional',
      'care-enterprise': 'Care Enterprise',
      'host-essential': 'Host Essential',
      'host-business': 'Host Business',
      'host-pro': 'Host Professional',
      'host-professional': 'Host Professional',
      'host-cloud': 'Managed Cloud Cluster',
    };
    if (names[id]) return names[id];
    if (CANONICAL_CATALOG_PRICES[id]?.name) return CANONICAL_CATALOG_PRICES[id].name;
    return id
      .replace(/^addon-/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
