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
    } = body;

    // Level 4: Authoritative Resolution via Confirmed Billing Country
    const resolution = resolveMarket({
      billingCountry: billingCountry || null,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const marketCode = resolution.code;
    const priceBook = getPriceBookForMarket(marketCode);
    const currency = priceBook.currency;

    // Determine package pricing from active versioned price book
    const packageKey = `website-${packageType}`;
    const packageItem = priceBook.items[packageKey] || priceBook.items['website-business'];
    const baseCost = packageItem ? packageItem.amount : (marketCode === 'KE' ? 90000 : 1500);

    // Rate for extra pages from price book
    const extraPageItem = priceBook.items['rate-extra-page'];
    const pageRate = extraPageItem ? extraPageItem.amount : (marketCode === 'KE' ? 2000 : 50);
    const extraPagesCost = (Number(extraPages) || 0) * pageRate;

    // Calculate add-ons from rate card
    let addOnsCost = 0;
    const itemizedAddOns: Array<{ id: string; name: string; cost: number; formatted: string }> = [];

    if (Array.isArray(selectedAddOns)) {
      for (const addonId of selectedAddOns) {
        const addon = ADD_ON_RATE_CARD.find(a => a.id === addonId);
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

    // Care recurring costs
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

    // Hosting recurring costs
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

    const totalYearOne = totalBuild + annualHosting + (monthlyCare * 12);

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 day proposal guarantee
    const proposalId = `BZ-${marketCode}-${now.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Generate locked proposal
    const lockedProposal = {
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
    };

    return NextResponse.json(lockedProposal);
  } catch (error) {
    console.error('Quote generation error:', error);
    return NextResponse.json({ error: 'Failed to generate authoritative quote' }, { status: 500 });
  }
}
