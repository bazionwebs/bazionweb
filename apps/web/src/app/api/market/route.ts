import { NextRequest, NextResponse } from 'next/server';
import {
  MARKETS,
  MarketCode,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
  BAZION_MARKET_HEADER,
  BAZION_PRICEBOOK_HEADER,
  normalizeMarketCode,
} from '@/lib/marketEngine';
import { resolveMarketFromHeaders } from '@/lib/geoDetection';

export async function GET(request: NextRequest) {
  // 1. Authoritative Edge / Reverse Proxy Geo-Headers
  let resolvedCode: MarketCode | null = resolveMarketFromHeaders(request.headers);

  // 2. Authoritative Cookie check
  if (!resolvedCode) {
    const cookieVal =
      request.cookies.get(BAZION_MARKET_COOKIE)?.value ??
      request.cookies.get(LEGACY_MARKET_COOKIE)?.value;

    if (cookieVal) {
      resolvedCode = normalizeMarketCode(cookieVal);
    }
  }

  // 3. Deterministic Default Fallback
  if (!resolvedCode) {
    resolvedCode = 'GLOBAL';
  }

  const market = MARKETS[resolvedCode] || MARKETS.GLOBAL;
  const legacyVal = market.code === 'KE' ? 'kenya' : 'international';
  const maxAge = 60 * 60 * 24 * 365; // 1 year

  const response = NextResponse.json({
    market: market.code,
    marketCode: market.code,
    name: market.name,
    shortName: market.shortName,
    flag: market.flag,
    currency: market.currency,
    currencySymbol: market.currencySymbol,
    priceBookId: market.activePriceBookId,
    paymentRailDescription: market.paymentRailDescription,
    commercialTermsTitle: market.commercialTermsTitle,
    supportScope: market.supportScope,
    paymentMethods: market.paymentMethods,
    isLocked: true,
  });

  // Set persistent cookies so client and subsequent server requests agree
  response.cookies.set(BAZION_MARKET_COOKIE, market.code, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false,
  });

  response.cookies.set(LEGACY_MARKET_COOKIE, legacyVal, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false,
  });

  response.headers.set(BAZION_MARKET_HEADER, market.code);
  response.headers.set(BAZION_PRICEBOOK_HEADER, market.activePriceBookId);

  return response;
}

export async function POST(_request: NextRequest) {
  void _request;
  // Strictly reject public manual switching per Requirement R2.2
  return NextResponse.json(
    {
      error: 'Manual market switching is disabled. BazionWeb automatically detects and locks regional markets.',
      isLocked: true,
    },
    { status: 403 }
  );
}
