import { NextRequest, NextResponse } from 'next/server';
import { resolveMarket } from '@/lib/marketEngine';
import { getPriceBookForMarket, formatCurrency } from '@/lib/priceBooks';
import { ADD_ON_RATE_CARD } from '@/lib/pricingData';
import { resolveApiV1Base } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      billingCountry,
      packageType = 'business',
      extraPages = 0,
      selectedAddOns = [],
      rushDelivery = false,
      care = 'none',
      hosting = 'none',
      clientName,
      clientEmail,
      clientCompany,
      couponCode,
    } = body;

    if (typeof clientName !== 'string' || typeof clientEmail !== 'string' || !clientName.trim() || !clientEmail.trim()) {
      return NextResponse.json({ error: 'Name and email are required to save your proposal.' }, { status: 400 });
    }

    if (!Array.isArray(selectedAddOns) || selectedAddOns.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Invalid add-on selection.' }, { status: 400 });
    }

    const countryCode = typeof billingCountry === 'string' ? billingCountry.trim().toUpperCase() : '';
    const resolution = resolveMarket({
      billingCountry: countryCode || null,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const marketCode = resolution.code;

    // ─── 1. Attempt Centralized Database SSOT Query via Backend API ───────────
    try {
      const response = await fetch(`${resolveApiV1Base()}/pricing/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          marketCode,
          countryCode: countryCode || marketCode,
          sourceCountry: countryCode || undefined,
          packageType,
          extraPages: Number(extraPages) || 0,
          selectedAddOns,
          rushDelivery: Boolean(rushDelivery),
          care,
          hosting,
          couponCode,
          clientEmail: clientEmail.trim().toLowerCase(),
          clientName: clientName.trim(),
          clientCompany: typeof clientCompany === 'string' ? clientCompany.trim() : undefined,
          service: `Website - ${String(packageType || 'project')}`,
          source: 'website_quote_calculator',
        }),
      });

      if (response.ok) {
        const envelope = await response.json().catch(() => ({}));
        const quote = envelope?.data ?? envelope;
        if (quote?.proposalId && quote?.proposalCode) {
          const breakdown = quote.breakdown;
          const annualHosting = Number(breakdown.hostingAnnual?.amount || 0);
          const monthlyCare = Number(breakdown.careMonthly?.amount || 0);
          const totalYearOne =
            Number(breakdown.totalBuildGross || 0) + annualHosting + monthlyCare * 12;

          return NextResponse.json({
            success: true,
            status: 'LOCKED',
            proposalId: quote.proposalId,
            proposalCode: quote.proposalCode,
            leadId: quote.leadId,
            marketCode: quote.marketCode,
            currency: quote.currency,
            currencySymbol: quote.currencySymbol,
            priceBookId: quote.priceBookId,
            priceBookVersion: quote.priceBookVersion,
            billingCountry: countryCode || marketCode,
            createdAt: quote.calculatedAt,
            expiresAt: quote.expiresAt,
            package: {
              id: breakdown.package.productId,
              name: breakdown.package.name,
              baseCost: breakdown.package.amount,
              formattedBaseCost: formatCurrency(breakdown.package.amount, quote.currency),
            },
            breakdown,
            totals: {
              totalBuild: breakdown.totalBuildGross,
              formattedTotalBuild: formatCurrency(breakdown.totalBuildGross, quote.currency),
              monthlyCare,
              formattedMonthlyCare: formatCurrency(monthlyCare, quote.currency),
              annualHosting,
              formattedAnnualHosting: formatCurrency(annualHosting, quote.currency),
              totalYearOne,
              formattedTotalYearOne: formatCurrency(totalYearOne, quote.currency),
            },
          });
        }
      }
    } catch {
      // Backend API unreachable or timed out — fall back to local calculation
    }

    // ─── 2. Resilient Local Fallback Engine (Authoritative Price Books) ────────
    const priceBook = getPriceBookForMarket(marketCode);
    const currency = priceBook.currency;

    const packageMap: Record<string, string> = {
      launch: 'website-launch',
      business: 'website-business',
      professional: 'website-professional',
      'ecom-starter': 'ecommerce-starter',
      'ecom-business': 'ecommerce-business',
      custom: 'website-enterprise',
      corporate: 'website-enterprise',
    };
    const packageKey = packageMap[packageType] || `website-${packageType}`;
    const packageItem = priceBook.items[packageKey] || priceBook.items['website-business'];
    const baseCost = packageItem ? packageItem.amount : (marketCode === 'KE' ? 90000 : 950);

    const extraPageItem = priceBook.items['rate-extra-page'];
    const pageRate = extraPageItem ? extraPageItem.amount : (marketCode === 'KE' ? 2000 : 40);
    const extraPagesCount = Math.max(0, Number(extraPages) || 0);
    const extraPagesCost = extraPagesCount * pageRate;

    let addOnsCost = 0;
    const itemizedAddOns: Array<{ productId: string; name: string; amount: number; formatted: string }> = [];

    if (Array.isArray(selectedAddOns)) {
      for (const addonId of selectedAddOns) {
        const addon = ADD_ON_RATE_CARD.find((a) => a.id === addonId);
        if (addon) {
          const cost = marketCode === 'KE' ? addon.rawKes : addon.rawUsd;
          addOnsCost += cost;
          itemizedAddOns.push({
            productId: addon.id,
            name: addon.name,
            amount: cost,
            formatted: formatCurrency(cost, currency),
          });
        }
      }
    }

    const subtotalBuild = baseCost + extraPagesCost + addOnsCost;
    const rushMultiplier = rushDelivery ? 0.35 : 0;
    const rushCost = Math.round(subtotalBuild * rushMultiplier);
    const totalBuild = subtotalBuild + rushCost;

    let monthlyCare = 0;
    if (care !== 'none') {
      const careItem = priceBook.items[care];
      if (careItem) {
        monthlyCare = careItem.amount;
      } else {
        if (care === 'care-essential') monthlyCare = marketCode === 'KE' ? 5000 : 75;
        if (care === 'care-business') monthlyCare = marketCode === 'KE' ? 10000 : 150;
        if (care === 'care-professional') monthlyCare = marketCode === 'KE' ? 20000 : 300;
      }
    }

    let annualHosting = 0;
    if (hosting !== 'none') {
      const hostItem = priceBook.items[hosting];
      if (hostItem) {
        annualHosting = hostItem.amount;
      } else {
        if (hosting === 'host-essential') annualHosting = marketCode === 'KE' ? 4500 : 49;
        if (hosting === 'host-business') annualHosting = marketCode === 'KE' ? 8500 : 99;
        if (hosting === 'host-pro' || hosting === 'host-professional') annualHosting = marketCode === 'KE' ? 15000 : 189;
      }
    }

    const totalYearOne = totalBuild + annualHosting + monthlyCare * 12;
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const proposalCode = `BZ-${marketCode}-${now.getFullYear()}-${randomSuffix}`;
    const proposalId = `PROP-${marketCode}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    const breakdown = {
      package: {
        productId: packageItem?.productId || `website-${packageType}`,
        name: packageItem?.name || packageType,
        amount: baseCost,
      },
      extraPages: {
        count: extraPagesCount,
        ratePerPage: pageRate,
        amount: extraPagesCost,
      },
      addOns: itemizedAddOns,
      rushDelivery: {
        applied: Boolean(rushDelivery),
        amount: rushCost,
      },
      subtotalBuild,
      totalBuildGross: totalBuild,
      careMonthly: {
        productId: care,
        amount: monthlyCare,
      },
      hostingAnnual: {
        productId: hosting,
        amount: annualHosting,
      },
    };

    return NextResponse.json({
      success: true,
      status: 'LOCKED',
      proposalId,
      proposalCode,
      leadId: `LEAD-${Date.now().toString(36).toUpperCase()}`,
      marketCode,
      currency,
      currencySymbol: priceBook.currencySymbol,
      priceBookId: priceBook.id,
      priceBookVersion: priceBook.version,
      billingCountry: countryCode || marketCode,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      package: {
        id: packageType,
        name: packageItem?.name || packageType,
        baseCost,
        formattedBaseCost: formatCurrency(baseCost, currency),
      },
      breakdown,
      totals: {
        totalBuild,
        formattedTotalBuild: formatCurrency(totalBuild, currency),
        monthlyCare,
        formattedMonthlyCare: formatCurrency(monthlyCare, currency),
        annualHosting,
        formattedAnnualHosting: formatCurrency(annualHosting, currency),
        totalYearOne,
        formattedTotalYearOne: formatCurrency(totalYearOne, currency),
      },
      commercialTerms: {
        paymentRails: priceBook.paymentRails,
        title: marketCode === 'KE' ? 'Kenya Commercial Terms & SME SLAs' : 'International Master Terms & SLAs',
      },
    });
  } catch (error) {
    console.error('Quote generation error:', error);
    return NextResponse.json({ error: 'Failed to generate authoritative quote' }, { status: 500 });
  }
}
