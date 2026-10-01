import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Cookie name constants — must match marketEngine.ts exactly.
 * Edge Middleware runs in the Edge Runtime and CANNOT safely import from
 * app-layer modules (@/lib/*). Values are inlined here intentionally.
 * If these strings ever change, update marketEngine.ts in sync.
 */
const BAZION_MARKET_COOKIE = 'bazion_market'; // sync: marketEngine.ts L35
const LEGACY_MARKET_COOKIE = 'bw-market';      // sync: marketEngine.ts L36

/**
 * East Africa country codes that map to the Kenya market.
 * Must match marketEngine.ts mapCountryToMarket() — inlined for Edge Runtime.
 */
const EAST_AFRICA_COUNTRIES = new Set(['KE', 'UG', 'TZ', 'RW', 'BI', 'ET', 'SS']);

function resolveGeoMarket(countryCode: string): 'KE' | 'GLOBAL' {
  if (!countryCode) return 'GLOBAL';
  const code = countryCode.trim().toUpperCase();
  if (code === 'KE' || EAST_AFRICA_COUNTRIES.has(code)) return 'KE';
  return 'GLOBAL';
}

/**
 * Market-Aware Edge Middleware:
 *
 * 1. IP Geolocation (initial signal via Cloudflare/Vercel edge headers)
 * 2. Market Cookie validation & persistence (bazion_market + legacy bw-market)
 * 3. Query override (?market=ke, ?market=global, ?currency=kes, etc.)
 * 4. Cache key safety: 'Vary: Cookie' so CDNs don't cross-pollute markets
 * 5. Downstream headers: 'x-bazion-market' and 'x-bazion-pricebook'
 */
export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1. Explicit query-param override
  const currencyParam = searchParams.get('currency')?.toLowerCase();
  const marketParam = searchParams.get('market')?.toLowerCase();

  let targetMarketCode: 'KE' | 'GLOBAL' | null = null;
  if (currencyParam === 'kes' || marketParam === 'kenya' || marketParam === 'ke') {
    targetMarketCode = 'KE';
  } else if (
    currencyParam === 'usd' ||
    marketParam === 'international' ||
    marketParam === 'intl' ||
    marketParam === 'global'
  ) {
    targetMarketCode = 'GLOBAL';
  }

  // 2. Existing cookie (Level 2 Resolution)
  const existingCanonicalCookie = request.cookies.get(BAZION_MARKET_COOKIE)?.value?.toUpperCase();
  const existingLegacyCookie = request.cookies.get(LEGACY_MARKET_COOKIE)?.value?.toLowerCase();

  if (!targetMarketCode) {
    if (existingCanonicalCookie === 'KE' || existingLegacyCookie === 'kenya') {
      targetMarketCode = 'KE';
    } else if (existingCanonicalCookie === 'GLOBAL' || existingLegacyCookie === 'international') {
      targetMarketCode = 'GLOBAL';
    }
  }

  // 3. Edge Geolocation headers (Level 1 Resolution)
  if (!targetMarketCode) {
    const vercelGeo = (request as unknown as { geo?: { country?: string } }).geo?.country;
    const headerCountry =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-real-ip-country') ||
      request.headers.get('x-country-code') ||
      vercelGeo ||
      '';
    targetMarketCode = resolveGeoMarket(headerCountry);
  }

  const legacyValue = targetMarketCode === 'KE' ? 'kenya' : 'international';
  const priceBookId = targetMarketCode === 'KE' ? 'KE-2026-v1' : 'GLOBAL-2026-v1';

  // Build response with downstream headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-bazion-market', targetMarketCode);
  requestHeaders.set('x-bazion-pricebook', priceBookId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-bazion-market', targetMarketCode);
  response.headers.set('x-bazion-pricebook', priceBookId);

  // Crucial CDN caching rule — vary by cookie so market pages aren't cross-cached
  response.headers.set('Vary', 'Cookie, Accept-Encoding');

  // Set / refresh cookies
  const maxAge = 60 * 60 * 24 * 365; // 1 year

  if (existingCanonicalCookie !== targetMarketCode) {
    response.cookies.set(BAZION_MARKET_COOKIE, targetMarketCode, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false,
    });
  }

  if (existingLegacyCookie !== legacyValue) {
    response.cookies.set(LEGACY_MARKET_COOKIE, legacyValue, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|docx|xlsx)$).*)',
  ],
};
