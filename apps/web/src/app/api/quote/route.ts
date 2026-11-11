import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  resolveMarket,
  isCountryInMarket,
  getRegionalCountryOptions,
  mapCountryToMarket,
} from '@/lib/marketEngine';
import {
  getPriceBookForMarket,
  formatCurrency,
  normalizeCatalogProductId,
} from '@/lib/priceBooks';
import { ADD_ON_RATE_CARD } from '@/lib/pricingData';
import { resolveApiV1Base } from '@/lib/api-base';
import { sendQuoteSummaryEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  saveProposalToLocalCache,
  getProposalFromLocalCache,
} from '@/lib/proposal-cache';

export const dynamic = 'force-dynamic';

/** Removes CR/LF and other control characters that could inject email headers. */
function stripControlChars(value: string): string {
  return value.replace(/[\r\n\u0000-\u001F]+/g, ' ');
}

const EMAIL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62})@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,62})\.[A-Za-z]{2,14}$/;

/** Uniform, unguessable base-36 suffix from a CSPRNG (NOT Math.random). */
function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    if (bytes[i] < 248) out += alphabet[bytes[i] % 36]; // 248/256 keeps modulo uniform
  }
  while (out.length < length) out += alphabet[randomBytes(1)[0] % 36];
  return out;
}

/**
 * BFF GET Handler: Retrieve commercial proposal by reference code (?code=... or ?proposal=...).
 * Queries the authoritative NestJS API with resilient fallback to local in-memory cache.
 */
export async function GET(request: NextRequest) {
  try {
    // Unauthenticated proposal retrieval — cap enumeration attempts per IP.
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`quote:get:${clientIp}`, 60, 5 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many proposal lookups. Please wait a moment.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code') || searchParams.get('proposal');

    if (!rawCode || !rawCode.trim()) {
      return NextResponse.json(
        { success: false, error: 'Proposal reference code is required.' },
        { status: 400 }
      );
    }

    const cleanCode = rawCode.trim().toUpperCase();

    // Adversarial sanitize: reject codes that violate pattern
    if (!/^[A-Z0-9_-]{4,64}$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, error: 'Proposal code not found or invalid format.' },
        { status: 404 }
      );
    }

    // 1. Upstream call to NestJS backend
    try {
      const backendUrl = `${resolveApiV1Base()}/invoices/proposals/${encodeURIComponent(cleanCode)}`;
      const res = await fetch(backendUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const envelope = await res.json().catch(() => ({}));
        const payload = envelope?.data ?? envelope;
        if (payload?.proposalCode) {
          saveProposalToLocalCache(cleanCode, payload);
        }
        return NextResponse.json(envelope, { status: 200 });
      }

      if (res.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Proposal not found' },
          { status: 404 }
        );
      }

      if (res.status === 429) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again shortly.' },
          { status: 429 }
        );
      }
    } catch (err) {
      console.warn('[Quote BFF] Backend proposal retrieval offline or timed out:', err);
    }

    // 2. Fallback to local in-memory cache if backend is unavailable
    const cached = getProposalFromLocalCache(cleanCode);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached, _source: 'cache_fallback' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Proposal not found or temporarily unavailable.' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Quote BFF] Proposal retrieval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve proposal' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated proposal creation triggers an outbound email dispatch —
    // cap it aggressively per client IP so the endpoint can never be turned
    // into a mail-relay abusing the team's sender reputation.
    const clientIp = getClientIp(request);
    const ipRl = checkRateLimit(`quote:post:${clientIp}`, 12, 10 * 60_000);
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many quote submissions from this device. Please try again shortly.' },
        { status: 429 }
      );
    }

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

    // Sanitized field material: bounded length, no control characters.
    const packageTypeSafe = typeof packageType === 'string' ? stripControlChars(packageType).slice(0, 40).trim() : 'business';
    const cleanCare = typeof care === 'string' ? stripControlChars(care).slice(0, 40) : 'none';
    const cleanHosting = typeof hosting === 'string' ? stripControlChars(hosting).slice(0, 40) : 'none';
    const cleanCoupon =
      typeof couponCode === 'string' ? stripControlChars(couponCode).slice(0, 64).trim() : undefined;
    const billingCycleSafe =
      typeof body.billingCycle === 'string' ? stripControlChars(body.billingCycle).toUpperCase().slice(0, 16) || 'ANNUAL' : 'ANNUAL';

    // extraPages: integer, clamped 0..500 — no negative or huge values may
    // influence upstream pricing math.
    const extraPagesNormalized = Math.min(
      500,
      Math.max(0, Math.floor(Number(extraPages) || 0)),
    );

    if (!Array.isArray(selectedAddOns) || selectedAddOns.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Invalid add-on selection.' }, { status: 400 });
    }

    const cleanAddOnIds: string[] = selectedAddOns
      .slice(0, 20)
      .map((id) => stripControlChars(id).slice(0, 64));

    if (
      typeof clientName !== 'string'
      || typeof clientEmail !== 'string'
      || !clientName.trim()
      || !clientEmail.trim()
      || clientName.length > 120
      || !EMAIL_RE.test(clientEmail.trim())
    ) {
      return NextResponse.json({ error: 'Name and email are required to save your proposal.' }, { status: 400 });
    }

    const cleanName = stripControlChars(clientName).trim();
    const cleanEmail = clientEmail.trim().toLowerCase();
    const cleanCompany =
      typeof clientCompany === 'string' ? stripControlChars(clientCompany).trim().slice(0, 160) : undefined;

    // Mailbox-level cap: even with rotating source IPs, one recipient address
    // can only receive a handful of quote emails per hour.
    const emailRl = checkRateLimit(`quote:email:${cleanEmail}`, 5, 60 * 60_000);
    if (!emailRl.allowed) {
      return NextResponse.json(
        { error: 'Too many quote requests for this email address. Please try again later.' },
        { status: 429 }
      );
    }

    const rawCountry = typeof billingCountry === 'string' ? billingCountry.trim().toUpperCase() : '';

    const edgeCountry =
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cloudfront-viewer-country') ||
      request.headers.get('x-country-code');
    const cookieMarket = request.cookies.get('bazion_market')?.value;

    const hasEnvironmentSignals = Boolean(edgeCountry || cookieMarket);

    const detectionResolution = resolveMarket({
      ipCountry: edgeCountry,
      marketCookie: cookieMarket,
    });
    const detectedMarket = detectionResolution.code;

    if (hasEnvironmentSignals && rawCountry && !isCountryInMarket(rawCountry, detectedMarket)) {
      return NextResponse.json(
        {
          error: `Billing country '${rawCountry}' does not match the auto-identified regional market '${detectedMarket}'. Proposals must strictly conform to your regional market.`,
          code: 'REGIONAL_MARKET_MISMATCH',
          detectedMarket,
          allowedCountries: getRegionalCountryOptions(detectedMarket).map(c => c.code),
        },
        { status: 400 }
      );
    }

    const marketCode = hasEnvironmentSignals
      ? detectedMarket
      : (rawCountry ? mapCountryToMarket(rawCountry) : detectedMarket);

    const countryCode = rawCountry || getRegionalCountryOptions(marketCode)[0].code;

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
          packageType: packageTypeSafe || 'business',
          extraPages: extraPagesNormalized,
          selectedAddOns: cleanAddOnIds,
          rushDelivery: Boolean(rushDelivery),
          care: cleanCare,
          hosting: cleanHosting,
          billingCycle: billingCycleSafe,
          couponCode: cleanCoupon,
          clientEmail: cleanEmail,
          clientName: cleanName,
          clientCompany: cleanCompany,
          service: `Website - ${packageTypeSafe || 'project'}`,
          source: 'website_quote_calculator',
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.warn(
          '[Quote BFF] Upstream pricing service rejected proposal:',
          response.status,
          errBody?.message || errBody?.error,
        );
        return NextResponse.json(
          {
            error: errBody?.message || errBody?.error || 'Pricing service rejected proposal creation',
          },
          { status: response.status >= 500 ? 502 : response.status }
        );
      }

      if (response.ok) {
        const envelope = await response.json().catch(() => ({}));
        const quote = envelope?.data ?? envelope;
        if (quote?.proposalId && quote?.proposalCode) {
          const breakdown = quote.breakdown;
          const annualHosting = Number(breakdown.hostingAnnual?.amount || 0);
          const monthlyCare = Number(breakdown.careMonthly?.amount || 0);
          const totalYearOne =
            Number(breakdown.totalBuildGross || 0) + annualHosting + monthlyCare * 12;

          try {
            await sendQuoteSummaryEmail({
              clientName: cleanName,
              clientEmail: cleanEmail,
              clientCompany: cleanCompany,
              proposalId: quote.proposalId,
              proposalCode: quote.proposalCode,
              packageName: breakdown.package.name,
              currency: quote.currency,
              totalBuild: breakdown.totalBuildGross,
              formattedTotalBuild: formatCurrency(breakdown.totalBuildGross, quote.currency),
              monthlyCare,
              formattedMonthlyCare: formatCurrency(monthlyCare, quote.currency),
              annualHosting,
              formattedAnnualHosting: formatCurrency(annualHosting, quote.currency),
              totalYearOne,
              formattedTotalYearOne: formatCurrency(totalYearOne, quote.currency),
              proposalUrl: `https://bazionweb.com/quote?proposal=${encodeURIComponent(quote.proposalCode)}`,
            });
          } catch (emailErr) {
            console.warn('[Quote API] Non-fatal email quote dispatch error:', emailErr);
          }

          saveProposalToLocalCache(quote.proposalCode, {
            proposalCode: quote.proposalCode,
            currency: quote.currency,
            currencySymbol: quote.currencySymbol,
            totalAmount: breakdown.totalBuildGross,
            depositAmount: Math.round(breakdown.totalBuildGross * 0.5 * 100) / 100,
            finalAmount: Math.round((breakdown.totalBuildGross - Math.round(breakdown.totalBuildGross * 0.5 * 100) / 100) * 100) / 100,
            status: 'LOCKED',
            clientName: cleanName,
            clientCompany: cleanCompany || '',
            clientEmail: cleanEmail,
            marketCode: quote.marketCode,
            lineItems: [
              { title: breakdown.package.name, subtitle: 'Core Website Build', price: breakdown.package.amount, quantity: 1 },
              ...(extraPagesNormalized > 0 ? [{ title: 'Additional Pages', subtitle: `${extraPagesNormalized} page(s)`, price: breakdown.extraPages?.amount || 0, quantity: extraPagesNormalized }] : []),
              ...(Array.isArray(breakdown.addOns) ? breakdown.addOns.map((a: { name: string; amount: number }) => ({ title: a.name, subtitle: 'Add-on Module', price: a.amount, quantity: 1 })) : []),
            ],
            expiresAt: quote.expiresAt,
            createdAt: quote.calculatedAt,
          });

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
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Quote BFF] Backend pricing service offline or timed out:', err);
        return NextResponse.json(
          {
            error: 'Pricing service is temporarily unavailable. Please retry shortly.',
            code: 'UPSTREAM_OFFLINE',
          },
          { status: 503 }
        );
      }
    }

    // ─── 2. Resilient Local Fallback Engine (Authoritative Price Books) ────────
    const priceBook = getPriceBookForMarket(marketCode);
    const currency = priceBook.currency;

    const packageMap: Record<string, string> = {
      existing: 'website-existing',
      'existing-website': 'website-existing',
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
    const packageKey = packageMap[packageTypeSafe] || `website-${packageTypeSafe || 'business'}`;
    const packageItem = priceBook.items[packageKey] || priceBook.items['website-business'];
    const baseCost = packageItem ? packageItem.amount : (marketCode === 'KE' ? 90000 : 950);

    const extraPageItem = priceBook.items['rate-extra-page'];
    const pageRate = extraPageItem ? extraPageItem.amount : (marketCode === 'KE' ? 2000 : 40);
    const extraPagesCount = extraPagesNormalized;
    const extraPagesCost = extraPagesCount * pageRate;

    let addOnsCost = 0;
    const itemizedAddOns: Array<{ productId: string; name: string; amount: number; formatted: string }> = [];

    for (const addonId of cleanAddOnIds) {
      const canonicalId = normalizeCatalogProductId(addonId);
      const addon = ADD_ON_RATE_CARD.find((a) => a.id === addonId || normalizeCatalogProductId(a.id) === canonicalId);
      if (addon && (addon.rawKes > 0 || addon.rawUsd > 0)) {
        const cost = marketCode === 'KE' ? addon.rawKes : addon.rawUsd;
        addOnsCost += cost;
        itemizedAddOns.push({
          productId: canonicalId,
          name: addon.name,
          amount: cost,
          formatted: formatCurrency(cost, currency),
        });
      } else if (priceBook.items[canonicalId] || priceBook.items[addonId]) {
        const item = priceBook.items[canonicalId] || priceBook.items[addonId];
        addOnsCost += item.amount;
        itemizedAddOns.push({
          productId: item.productId,
          name: item.name,
          amount: item.amount,
          formatted: formatCurrency(item.amount, currency),
        });
      }
    }

    const subtotalBuild = baseCost + extraPagesCost + addOnsCost;
    const rushMultiplier = rushDelivery ? 0.35 : 0;
    const rushCost = Math.round(subtotalBuild * rushMultiplier);
    const totalBuild = subtotalBuild + rushCost;

    let monthlyCare = 0;
    if (cleanCare !== 'none') {
      const careItem = priceBook.items[cleanCare];
      if (careItem) {
        monthlyCare = careItem.amount;
      } else {
        if (cleanCare === 'care-essential') monthlyCare = marketCode === 'KE' ? 5000 : 75;
        if (cleanCare === 'care-business') monthlyCare = marketCode === 'KE' ? 10000 : 150;
        if (cleanCare === 'care-professional') monthlyCare = marketCode === 'KE' ? 20000 : 300;
        if (cleanCare === 'care-enterprise') monthlyCare = marketCode === 'KE' ? 40000 : 400;
      }
    }

    let annualHosting = 0;
    if (cleanHosting !== 'none') {
      const hostItem = priceBook.items[cleanHosting];
      if (hostItem) {
        annualHosting = hostItem.amount;
      } else {
        if (cleanHosting === 'host-essential') annualHosting = marketCode === 'KE' ? 4500 : 49;
        if (cleanHosting === 'host-business') annualHosting = marketCode === 'KE' ? 8500 : 99;
        if (cleanHosting === 'host-pro' || cleanHosting === 'host-professional') annualHosting = marketCode === 'KE' ? 15000 : 189;
        if (cleanHosting === 'host-cloud') annualHosting = marketCode === 'KE' ? 30000 : 300;
      }
    }

    const totalYearOne = totalBuild + annualHosting + monthlyCare * 12;
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const randomSuffix = randomCode(8);
    const proposalCode = `BZ-${marketCode}-${now.getFullYear()}-${randomSuffix}`;
    const proposalId = `PROP-${marketCode}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    const packageLabel = packageItem?.name || packageTypeSafe || 'business';

    const breakdown = {
      package: {
        productId: packageItem?.productId || `website-${packageTypeSafe || 'business'}`,
        name: packageLabel,
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
        productId: cleanCare,
        amount: monthlyCare,
      },
      hostingAnnual: {
        productId: cleanHosting,
        amount: annualHosting,
      },
    };

    try {
      await sendQuoteSummaryEmail({
        clientName: cleanName,
        clientEmail: cleanEmail,
        clientCompany: cleanCompany,
        proposalId,
        proposalCode,
        packageName: packageLabel,
        currency,
        totalBuild,
        formattedTotalBuild: formatCurrency(totalBuild, currency),
        monthlyCare,
        formattedMonthlyCare: formatCurrency(monthlyCare, currency),
        annualHosting,
        formattedAnnualHosting: formatCurrency(annualHosting, currency),
        totalYearOne,
        formattedTotalYearOne: formatCurrency(totalYearOne, currency),
        proposalUrl: `https://bazionweb.com/quote?proposal=${encodeURIComponent(proposalCode)}`,
      });
    } catch (emailErr) {
      console.warn('[Quote API] Non-fatal email quote dispatch error:', emailErr);
    }

    saveProposalToLocalCache(proposalCode, {
      proposalCode,
      currency,
      currencySymbol: priceBook.currencySymbol,
      totalAmount: totalBuild,
      depositAmount: Math.round(totalBuild * 0.5 * 100) / 100,
      finalAmount: Math.round((totalBuild - Math.round(totalBuild * 0.5 * 100) / 100) * 100) / 100,
      status: 'LOCKED',
      clientName: cleanName,
      clientCompany: cleanCompany || '',
      clientEmail: cleanEmail,
      marketCode,
      lineItems: [
        { title: packageLabel, subtitle: 'Core Website Build', price: baseCost, quantity: 1 },
        ...(extraPagesCount > 0 ? [{ title: 'Additional Pages', subtitle: `${extraPagesCount} page(s)`, price: extraPagesCost, quantity: extraPagesCount }] : []),
        ...itemizedAddOns.map(a => ({ title: a.name, subtitle: 'Add-on Module', price: a.amount, quantity: 1 })),
      ],
      expiresAt: expires.toISOString(),
      createdAt: now.toISOString(),
    });

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
        id: packageTypeSafe || 'business',
        name: packageLabel,
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
