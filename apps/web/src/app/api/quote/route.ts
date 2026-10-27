import { NextRequest, NextResponse } from 'next/server';
import { resolveMarket } from '@/lib/marketEngine';
import { formatCurrency } from '@/lib/priceBooks';
import { resolveApiV1Base } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      billingCountry,
      packageType,
      extraPages = 0,
      selectedAddOns = [],
      rushDelivery = false,
      care = 'none',
      hosting = 'none',
      clientName,
      clientEmail,
      clientCompany,
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

    const response = await fetch(`${resolveApiV1Base()}/pricing/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        marketCode: resolution.code,
        countryCode: countryCode || resolution.code,
        sourceCountry: countryCode || undefined,
        packageType,
        extraPages: Number(extraPages),
        selectedAddOns,
        rushDelivery: Boolean(rushDelivery),
        care,
        hosting,
        clientEmail: clientEmail.trim().toLowerCase(),
        clientName: clientName.trim(),
        clientCompany: typeof clientCompany === 'string' ? clientCompany.trim() : undefined,
        service: `Website - ${String(packageType || 'project')}`,
        source: 'website_quote_calculator',
      }),
    });

    const envelope = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: envelope?.message || envelope?.error || 'We could not create an authoritative proposal. Please review your selections and try again.' },
        { status: response.status === 400 ? 422 : 502 },
      );
    }

    const quote = envelope?.data ?? envelope;
    if (!quote?.proposalId || !quote?.proposalCode) {
      return NextResponse.json({ error: 'The proposal could not be saved. Please try again.' }, { status: 502 });
    }

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
      billingCountry: countryCode || resolution.code,
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
  } catch {
    return NextResponse.json(
      { error: 'We could not reach the secure pricing service. Your request has not been submitted; please retry.' },
      { status: 503 },
    );
  }
}
