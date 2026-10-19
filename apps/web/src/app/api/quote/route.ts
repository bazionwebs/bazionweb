import { NextRequest, NextResponse } from 'next/server';
import { resolveMarket } from '@/lib/marketEngine';
import { getPriceBookForMarket, formatCurrency } from '@/lib/priceBooks';
import { ADD_ON_RATE_CARD } from '@/lib/pricingData';

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

    // Resolve market via confirmed billing country / headers
    const resolution = resolveMarket({
      billingCountry: billingCountry || null,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const marketCode = resolution.code;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    // ─── Attempt Centralized Database SSOT Query via API ─────────────────────
    try {
      const apiResponse = await fetch(`${apiUrl}/pricing/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketCode,
          countryCode: billingCountry,
          packageType,
          extraPages: Number(extraPages) || 0,
          selectedAddOns,
          rushDelivery: Boolean(rushDelivery),
          care,
          hosting,
          couponCode,
          clientEmail,
          clientName,
        }),
      });

      if (apiResponse.ok) {
        const dbCalculated = await apiResponse.json();
        const now = new Date();
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const proposalId = `BZ-${marketCode}-${now.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        return NextResponse.json({
          proposalId,
          status: 'LOCKED',
          version: dbCalculated.priceBookVersion,
          priceBookId: dbCalculated.priceBookId,
          marketCode: dbCalculated.marketCode,
          currency: dbCalculated.currency,
          currencySymbol: dbCalculated.currencySymbol,
          billingCountry: billingCountry || (marketCode === 'KE' ? 'KE' : 'GLOBAL'),
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString(),
          client: {
            name: clientName || null,
            email: clientEmail || null,
            company: clientCompany || null,
          },
          package: {
            id: packageType,
            name: dbCalculated.breakdown.package.name,
            baseCost: dbCalculated.breakdown.package.amount,
            formattedBaseCost: formatCurrency(dbCalculated.breakdown.package.amount, dbCalculated.currency),
            timeline: packageType === 'enterprise' ? '20–30 working days' : '10–18 working days',
            supportWarranty: '30-day warranty',
          },
          extraPages: {
            count: dbCalculated.breakdown.extraPages.count,
            rate: dbCalculated.breakdown.extraPages.ratePerPage,
            cost: dbCalculated.breakdown.extraPages.amount,
            formattedCost: formatCurrency(dbCalculated.breakdown.extraPages.amount, dbCalculated.currency),
          },
          addOns: dbCalculated.breakdown.addOns.map((a: { productId: string; name: string; amount: number }) => ({
            id: a.productId,
            name: a.name,
            cost: a.amount,
            formatted: formatCurrency(a.amount, dbCalculated.currency),
          })),
          rushDelivery: {
            active: dbCalculated.breakdown.rushDelivery.applied,
            multiplier: dbCalculated.breakdown.rushDelivery.applied ? 0.35 : 0,
            cost: dbCalculated.breakdown.rushDelivery.amount,
            formattedCost: formatCurrency(dbCalculated.breakdown.rushDelivery.amount, dbCalculated.currency),
          },
          totals: {
            subtotalBuild: dbCalculated.breakdown.subtotalBuild,
            totalBuild: dbCalculated.breakdown.totalBuildGross,
            formattedTotalBuild: formatCurrency(dbCalculated.breakdown.totalBuildGross, dbCalculated.currency),
            monthlyCare: dbCalculated.breakdown.careMonthly.amount,
            formattedMonthlyCare: formatCurrency(dbCalculated.breakdown.careMonthly.amount, dbCalculated.currency),
            annualHosting: dbCalculated.breakdown.hostingMonthly.amount * 12,
            formattedAnnualHosting: formatCurrency(dbCalculated.breakdown.hostingMonthly.amount * 12, dbCalculated.currency),
            totalYearOne:
              dbCalculated.breakdown.totalBuildGross +
              dbCalculated.breakdown.hostingMonthly.amount * 12 +
              dbCalculated.breakdown.careMonthly.amount * 12,
            formattedTotalYearOne: formatCurrency(
              dbCalculated.breakdown.totalBuildGross +
                dbCalculated.breakdown.hostingMonthly.amount * 12 +
                dbCalculated.breakdown.careMonthly.amount * 12,
              dbCalculated.currency,
            ),
          },
          commercialTerms: {
            paymentRails:
              marketCode === 'KE'
                ? ['M-Pesa STK Push', 'Kenyan Bank Wire / RTGS', 'Local Visa / Mastercard']
                : ['International Visa / Mastercard', 'Wise Wire Transfer', 'ACH / SEPA Direct'],
            title:
              marketCode === 'KE'
                ? 'Kenya Commercial Terms & SME SLAs'
                : 'International Master Terms & SLAs',
          },
        });
      }
    } catch {
      // Gracefully fall back to local calculation if backend API is offline during build/dev
    }

    // ─── Resilient Local Fallback Engine ──────────────────────────────────────
    const priceBook = getPriceBookForMarket(marketCode);
    const currency = priceBook.currency;

    const packageKey = `website-${packageType}`;
    const packageItem = priceBook.items[packageKey] || priceBook.items['website-business'];
    const baseCost = packageItem ? packageItem.amount : (marketCode === 'KE' ? 90000 : 1500);

    const extraPageItem = priceBook.items['rate-extra-page'];
    const pageRate = extraPageItem ? extraPageItem.amount : (marketCode === 'KE' ? 2000 : 50);
    const extraPagesCost = (Number(extraPages) || 0) * pageRate;

    let addOnsCost = 0;
    const itemizedAddOns: Array<{ id: string; name: string; cost: number; formatted: string }> = [];

    if (Array.isArray(selectedAddOns)) {
      for (const addonId of selectedAddOns) {
        const addon = ADD_ON_RATE_CARD.find((a) => a.id === addonId);
        if (addon) {
          const cost = marketCode === 'KE' ? addon.rawKes : addon.rawUsd;
          addOnsCost += cost;
          itemizedAddOns.push({
            id: addon.id,
            name: addon.name,
            cost,
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
        if (hosting === 'host-essential') annualHosting = marketCode === 'KE' ? 4500 : 60;
        if (hosting === 'host-business') annualHosting = marketCode === 'KE' ? 8500 : 120;
        if (hosting === 'host-pro') annualHosting = marketCode === 'KE' ? 15000 : 240;
      }
    }

    const totalYearOne = totalBuild + annualHosting + monthlyCare * 12;
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const proposalId = `BZ-${marketCode}-${now.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return NextResponse.json({
      proposalId,
      status: 'LOCKED',
      version: priceBook.version,
      priceBookId: priceBook.id,
      marketCode,
      currency,
      currencySymbol: priceBook.currencySymbol,
      billingCountry: billingCountry || (marketCode === 'KE' ? 'KE' : 'GLOBAL'),
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      client: {
        name: clientName || null,
        email: clientEmail || null,
        company: clientCompany || null,
      },
      package: {
        id: packageType,
        name: packageItem?.name || packageType,
        baseCost,
        formattedBaseCost: formatCurrency(baseCost, currency),
        timeline: packageItem?.timeline || '10–18 working days',
        supportWarranty: packageItem?.supportWarranty || '30-day warranty',
      },
      extraPages: {
        count: Number(extraPages) || 0,
        rate: pageRate,
        cost: extraPagesCost,
        formattedCost: formatCurrency(extraPagesCost, currency),
      },
      addOns: itemizedAddOns,
      rushDelivery: {
        active: Boolean(rushDelivery),
        multiplier: rushMultiplier,
        cost: rushCost,
        formattedCost: formatCurrency(rushCost, currency),
      },
      totals: {
        subtotalBuild,
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
