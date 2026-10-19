import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingAuditService } from './pricing-audit.service';
import {
  CalculateQuoteDto,
  UpsertPriceDto,
  CreatePriceBookDto,
  UpsertTaxRuleDto,
  UpsertAdjustmentDto,
} from './pricing.dto';

export interface CalculatedQuoteResponse {
  marketCode: string;
  marketName: string;
  currency: string;
  currencySymbol: string;
  priceBookId: string;
  priceBookVersion: string;
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
    hostingMonthly: {
      productId?: string;
      amount: number;
    };
    totalMonthlyRecurring: number;
  };
  totalPayableNow: number;
  calculatedAt: string;
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

    const prices = await this.prisma.price.findMany({
      where: { priceBookId: priceBook.id },
      orderBy: { productId: 'asc' },
    });

    const taxRules = await this.prisma.taxRule.findMany({
      where: { marketId: market.id, active: true },
    });

    const adjustments = await this.prisma.marketAdjustment.findMany({
      where: { marketId: market.id, active: true },
    });

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
        couponCode: a.couponCode,
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

    // 1. Gather all product IDs needed
    const packageKey = `website-${dto.packageType}`;
    const extraPageKey = 'rate-extra-page';
    const selectedAddOns = dto.selectedAddOns || [];
    const careKey = dto.care && dto.care !== 'none' ? `care-${dto.care}` : null;
    const hostingKey =
      dto.hosting && dto.hosting !== 'none' ? `hosting-${dto.hosting}` : null;

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

    // 3. Resolve package price
    const basePackageAmount = priceMap.get(packageKey);
    if (basePackageAmount === undefined) {
      throw new BadRequestException(
        `Product ${packageKey} is not priced in active price book ${priceBook.id}`,
      );
    }

    // 4. Resolve extra pages
    const pageRate = priceMap.get(extraPageKey) || 0;
    const extraPagesCount = Number(dto.extraPages) || 0;
    const extraPagesAmount = extraPagesCount * pageRate;

    // 5. Resolve add-ons
    const itemizedAddOns: Array<{ productId: string; name: string; amount: number }> = [];
    let addOnsSubtotal = 0;

    for (const addonId of selectedAddOns) {
      const addonAmount = priceMap.get(addonId);
      if (addonAmount !== undefined) {
        addOnsSubtotal += addonAmount;
        itemizedAddOns.push({
          productId: addonId,
          name: this.formatProductName(addonId),
          amount: addonAmount,
        });
      }
    }

    // 6. Subtotal Build & Rush Delivery
    const subtotalBuild = basePackageAmount + extraPagesAmount + addOnsSubtotal;
    const rushMultiplier = dto.rushDelivery ? 0.35 : 0;
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
    const careAmount = careKey ? priceMap.get(careKey) || 0 : 0;
    const hostingAmount = hostingKey ? priceMap.get(hostingKey) || 0 : 0;
    const totalMonthlyRecurring = careAmount + hostingAmount;

    return {
      marketCode: market.code,
      marketName: market.name,
      currency: market.currencyCode,
      currencySymbol: market.currency.symbol,
      priceBookId: priceBook.id,
      priceBookVersion: priceBook.version,
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
          applied: !!dto.rushDelivery,
          surchargePct: dto.rushDelivery ? 35 : 0,
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
        hostingMonthly: {
          productId: hostingKey || undefined,
          amount: hostingAmount,
        },
        totalMonthlyRecurring,
      },
      totalPayableNow: totalBuildGross,
      calculatedAt: new Date().toISOString(),
    };
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
    return id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
