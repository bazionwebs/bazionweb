import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const MARKET_COOKIE_NAME = 'bw-market';

const EAST_AFRICA_COUNTRIES = new Set(['KE', 'UG', 'TZ', 'RW', 'BI', 'ET', 'SS']);

/**
 * Silent Edge Geo-Detection Middleware:
 * - Detects country via edge headers (Vercel, Cloudflare, standard proxy headers)
 * - Injects 'bw-market' cookie silently so clients render native pricing without flash
 * - Respects query overrides (?currency=kes, ?currency=usd, ?market=kenya, ?market=intl)
 * - Defaults Googlebot / US / International crawlers to 'international' (USD) for clean SEO
 */
export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1. Check explicit query parameter override
  const currencyParam = searchParams.get('currency')?.toLowerCase();
  const marketParam = searchParams.get('market')?.toLowerCase();

  let targetMarket: 'kenya' | 'international' | null = null;
  if (currencyParam === 'kes' || marketParam === 'kenya' || marketParam === 'ke') {
    targetMarket = 'kenya';
  } else if (currencyParam === 'usd' || marketParam === 'international' || marketParam === 'intl') {
    targetMarket = 'international';
  }

  // 2. Check existing cookie
  const existingCookie = request.cookies.get(MARKET_COOKIE_NAME)?.value;
  if (!targetMarket && (existingCookie === 'kenya' || existingCookie === 'international')) {
    targetMarket = existingCookie;
  }

  // 3. If still undetermined, check Edge Geolocation headers
  if (!targetMarket) {
    const vercelGeo = (request as unknown as { geo?: { country?: string } }).geo?.country;
    const headerCountry =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-real-ip-country') ||
      request.headers.get('x-country-code') ||
      vercelGeo ||
      '';

    const normalizedCountry = headerCountry.trim().toUpperCase();

    if (EAST_AFRICA_COUNTRIES.has(normalizedCountry)) {
      targetMarket = 'kenya';
    } else {
      // Default international for all other regions & search crawlers (US IP)
      targetMarket = 'international';
    }
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Attach internal header
  response.headers.set('x-bazion-market', targetMarket);

  // Set or refresh cookie for client-side sync without hydration delay
  if (existingCookie !== targetMarket) {
    response.cookies.set(MARKET_COOKIE_NAME, targetMarket, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
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
