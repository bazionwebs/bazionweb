import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveMarket } from '@/lib/marketEngine';
import { formatCurrency } from '@/lib/priceBooks';

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

    // Resolve market via confirmed billing country / headers
    const resolution = resolveMarket({
      billingCountry: billingCountry || null,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const marketCode = resolution.code;
    let currency: 'KES' | 'USD' | 'EUR' | 'GBP' = (resolution.currency as 'KES' | 'USD' | 'EUR' | 'GBP') || 'USD';
    let currencySymbol = marketCode === 'KE' ? 'KSh' : '$';
    let priceBookVersion = '2026-v1';
    let priceBookId = `${marketCode}-2026-v1`;

    // Package item key & page rate key
    const packageKey = `website-${packageType}`;
    const extraPageKey = 'rate-extra-page';

    let baseCost = marketCode === 'KE' ? 90000 : 1500;
    let pageRate = marketCode === 'KE' ? 2000 : 50;
    const priceMap = new Map<string, number>();

    // ─── Query Database Single Source of Truth ───────────────────────────────
    try {
      const dbMarket = await prisma.market.findUnique({
        where: { code: marketCode },
        include: { currency: true },
      });

      if (dbMarket) {
        currency = dbMarket.currencyCode as 'KES' | 'USD' | 'EUR' | 'GBP';
        currencySymbol = dbMarket.currency.symbol;

        const dbPriceBook = await prisma.priceBook.findFirst({
          where: {
            marketId: dbMarket.id,
            status: 'active',
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date() } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (dbPriceBook) {
          priceBookId = dbPriceBook.id;
          priceBookVersion = dbPriceBook.version;

          const dbPrices = await prisma.price.findMany({
            where: { priceBookId: dbPriceBook.id },
          });

          for (const p of dbPrices) {
            priceMap.set(p.productId, Number(p.amount));
          }

          if (priceMap.has(packageKey)) {
            baseCost = priceMap.get(packageKey)!;
          }
          if (priceMap.has(extraPageKey)) {
            pageRate = priceMap.get(extraPageKey)!;
          }
        }
      }
    } catch (dbErr: any) {
      console.warn('Database pricing query notice (using fallback constants):', dbErr.message);
    }

    const extraPagesCost = (Number(extraPages) || 0) * pageRate;

    // Calculate add-ons from Database Prices
    let addOnsCost = 0;
    const itemizedAddOns: Array<{ id: string; name: string; cost: number; formatted: string }> = [];

    if (Array.isArray(selectedAddOns)) {
      for (const addonId of selectedAddOns) {
        const cost =
          priceMap.get(addonId) ??
          (marketCode === 'KE' ? 15000 : 250);
        addOnsCost += cost;
        itemizedAddOns.push({
          id: addonId,
          name: addonId
            .split('-')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          cost,
          formatted: formatCurrency(cost, currency),
        });
      }
    }

    const subtotalBuild = baseCost + extraPagesCost + addOnsCost;
    const rushMultiplier = rushDelivery ? 0.35 : 0;
    const rushCost = Math.round(subtotalBuild * rushMultiplier);
    const totalBuild = subtotalBuild + rushCost;

    // Care recurring costs from Database
    let monthlyCare = 0;
    if (care !== 'none') {
      const careKey = `care-${care.replace('care-', '')}`;
      monthlyCare =
        priceMap.get(careKey) ??
        (marketCode === 'KE' ? (care.includes('growth') ? 12000 : 5000) : 99);
    }

    // Hosting recurring costs from Database
    let annualHosting = 0;
    if (hosting !== 'none') {
      const hostKey = `hosting-${hosting.replace('host-', '')}`;
      annualHosting =
        (priceMap.get(hostKey) ?? (marketCode === 'KE' ? 3500 : 35)) * 12;
    }

    const totalYearOne = totalBuild + annualHosting + monthlyCare * 12;

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 day guarantee
    const proposalId = `BZ-${marketCode}-${now.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Generate locked proposal
    const lockedProposal = {
      proposalId,
      status: 'LOCKED',
      version: priceBookVersion,
      priceBookId,
      marketCode,
      currency,
      currencySymbol,
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
        name: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Website`,
        baseCost,
        formattedBaseCost: formatCurrency(baseCost, currency),
        timeline: packageType === 'enterprise' ? '20–30 working days' : '10–18 working days',
        supportWarranty: '30-day warranty',
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
        paymentRails:
          marketCode === 'KE'
            ? ['M-Pesa STK Push', 'Kenyan Bank Wire / RTGS', 'Local Visa / Mastercard']
            : ['International Visa / Mastercard', 'Wise Wire Transfer', 'ACH / SEPA Direct'],
        title:
          marketCode === 'KE'
            ? 'Kenya Commercial Terms & SME SLAs'
            : 'International Master Terms & SLAs',
      },
    };

    // Persist locked proposal in DB if clientEmail is present
    if (clientEmail) {
      try {
        const dbMarket = await prisma.market.findUnique({ where: { code: marketCode } });
        if (dbMarket) {
          await prisma.proposal.create({
            data: {
              proposalCode: proposalId,
              marketId: dbMarket.id,
              priceBookId,
              currency,
              billingCountry: billingCountry || (marketCode === 'KE' ? 'KE' : 'GLOBAL'),
              clientEmail: clientEmail.trim().toLowerCase(),
              clientName: clientName?.trim() || null,
              clientCompany: clientCompany?.trim() || null,
              lineItems: lockedProposal as any,
              totalAmount: totalBuild,
              status: 'LOCKED',
              expiresAt: expires,
            },
          });
        }
      } catch (propErr: any) {
        console.warn('Notice: proposal record not stored in DB:', propErr.message);
      }
    }

    return NextResponse.json(lockedProposal);
  } catch (error) {
    console.error('Quote generation error:', error);
    return NextResponse.json({ error: 'Failed to generate authoritative quote' }, { status: 500 });
  }
}
