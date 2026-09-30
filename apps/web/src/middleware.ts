import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Import canonical constants from marketEngine — single source of truth for cookie names
import {
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
  mapCountryToMarket,
} from '@/lib/marketEngine';

/**
 * Market-Aware Edge Middleware:
 *
 * Implements:
 * 1. IP Geolocation (initial signal via Cloudflare/Vercel edge headers)
 * 2. Market Cookie validation & persistence (bazion_market and legacy bw-market)
 * 3. Query override (?market=ke, ?market=global, ?currency=kes, etc.)
 * 4. Cache key safety headers: sets 'Vary: Cookie' so edge CDNs do not poison cross-market caches
 * 5. Downstream request headers: 'x-bazion-market' ('KE' | 'GLOBAL') and 'x-bazion-pricebook'
 */
export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1. Check explicit query parameter override
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

  // 2. Check existing cookie (Level 2 Resolution)
  const existingCanonicalCookie = request.cookies.get(BAZION_MARKET_COOKIE)?.value?.toUpperCase();
  const existingLegacyCookie = request.cookies.get(LEGACY_MARKET_COOKIE)?.value?.toLowerCase();

  if (!targetMarketCode) {
    if (existingCanonicalCookie === 'KE' || existingLegacyCookie === 'kenya') {
      targetMarketCode = 'KE';
    } else if (
      existingCanonicalCookie === 'GLOBAL' ||
      existingLegacyCookie === 'international'
    ) {
      targetMarketCode = 'GLOBAL';
    }
  }

  // 3. If still undetermined, check Edge Geolocation headers (Level 1 Resolution)
  if (!targetMarketCode) {
    const vercelGeo = (request as unknown as { geo?: { country?: string } }).geo?.country;
    const headerCountry =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-real-ip-country') ||
      request.headers.get('x-country-code') ||
      vercelGeo ||
      '';

    const normalizedCountry = headerCountry.trim().toUpperCase();
    // Delegate to canonical mapCountryToMarket — single source for East Africa routing
    targetMarketCode = mapCountryToMarket(normalizedCountry) as 'KE' | 'GLOBAL';
  }

  const legacyValue = targetMarketCode === 'KE' ? 'kenya' : 'international';
  const priceBookId = targetMarketCode === 'KE' ? 'KE-2026-v1' : 'GLOBAL-2026-v1';

  // Create response
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-bazion-market', targetMarketCode);
  requestHeaders.set('x-bazion-pricebook', priceBookId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach internal headers to downstream response
  response.headers.set('x-bazion-market', targetMarketCode);
  response.headers.set('x-bazion-pricebook', priceBookId);

  // Crucial CDN Caching Rule: Tell CDNs that the response varies by cookie
  response.headers.set('Vary', 'Cookie, Accept-Encoding');

  // Set or refresh cookies for client-side hydration without layout shift
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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - static media files
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|docx|xlsx)$).*)',
  ],
};
