import { NextRequest, NextResponse } from 'next/server';
import {
  MARKETS,
  MarketCode,
  normalizeMarketCode,
  resolveMarket,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
  BAZION_MARKET_HEADER,
  BAZION_PRICEBOOK_HEADER,
} from '@/lib/marketEngine';

export async function GET(request: NextRequest) {
  // Edge middleware was removed for Vercel services compatibility (services
  // do not support Edge Function outputs). Resolve here with the same priority:
  // explicit ?market/?currency override → canonical/legacy cookie → IP geolocation → GLOBAL.
  const params = request.nextUrl.searchParams;
  const qMarket = params.get('market')?.toLowerCase();
  const qCurrency = params.get('currency')?.toLowerCase();
  let userSelection: string | null = null;
  if (qCurrency === 'kes' || qMarket === 'kenya' || qMarket === 'ke') {
    userSelection = 'KE';
  } else if (qCurrency === 'usd' || qMarket === 'international' || qMarket === 'intl' || qMarket === 'global') {
    userSelection = 'GLOBAL';
  }

  const geoCountry =
    request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || '';
  const resolution = resolveMarket({
    userSelection,
    marketCookie:
      request.cookies.get(BAZION_MARKET_COOKIE)?.value ??
      request.cookies.get(LEGACY_MARKET_COOKIE)?.value,
    ipCountry: geoCountry || null,
  });

  const market = MARKETS[resolution.code] || MARKETS.GLOBAL;

  return NextResponse.json({
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
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetCode: MarketCode = normalizeMarketCode(body?.marketCode);
    const market = MARKETS[targetCode] || MARKETS.GLOBAL;

    const legacyVal = targetCode === 'KE' ? 'kenya' : 'international';
    const maxAge = 60 * 60 * 24 * 365; // 1 year

    const response = NextResponse.json({
      success: true,
      marketCode: market.code,
      currency: market.currency,
      priceBookId: market.activePriceBookId,
      message: `Commercial market switched to ${market.name}`,
    });

    // Set canonical market cookie
    response.cookies.set(BAZION_MARKET_COOKIE, market.code, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false,
    });

    // Set legacy cookie
    response.cookies.set(LEGACY_MARKET_COOKIE, legacyVal, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false,
    });

    response.headers.set(BAZION_MARKET_HEADER, market.code);
    response.headers.set(BAZION_PRICEBOOK_HEADER, market.activePriceBookId);

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid market configuration request' },
      { status: 400 }
    );
  }
}
