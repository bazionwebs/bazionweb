/**
 * BazionWeb Regional Geo-Detection Engine
 *
 * Implements 4-layer fail-safe regional market identification:
 * 1. Edge & Reverse Proxy Geo-Headers (cf-ipcountry, x-vercel-ip-country, cloudfront-viewer-country, x-country-code)
 * 2. Authoritative Persistent Cookie (bazion_market, bw-market)
 * 3. Client Hints & Browser Environment (Intl.DateTimeFormat timezones)
 * 4. Deterministic Global Fallback (GLOBAL / USD)
 */

import {
  MarketCode,
  MARKETS,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
  mapCountryToMarket,
  normalizeMarketCode,
} from './marketEngine';

export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP';

export interface ServerMarketResult {
  market: MarketCode;
  currency: CurrencyCode;
}

/**
 * East African Community (EAC) timezones that map to the KE domestic price book.
 */
export const EAST_AFRICA_TIMEZONES = new Set([
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Kigali',
  'Africa/Bujumbura',
  'Africa/Juba',
  'Africa/Addis_Ababa',
  'Africa/Mogadishu',
  'Africa/Asmara',
  'Africa/Djibouti',
  'Indian/Comoro',
  'Indian/Mayotte',
  'Indian/Antananarivo',
]);

/**
 * Authoritative Edge and Reverse Proxy Header inspection.
 * Inspects Cloudflare, Vercel, AWS CloudFront, and custom reverse proxy headers.
 *
 * @param headers - Web API standard Headers collection
 * @returns Resolved MarketCode, or null if no recognized geographic header is found
 */
export function resolveMarketFromHeaders(headers: Headers | { get(name: string): string | null }): MarketCode | null {
  const rawCountry = (
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('cloudfront-viewer-country') ||
    headers.get('x-country-code') ||
    headers.get('x-real-ip-country') ||
    headers.get('x-geo-country') ||
    ''
  ).trim().toUpperCase();

  if (!rawCountry) return null;

  // Filter out Cloudflare / Vercel special / proxy / Tor placeholder codes
  if (['XX', 'T1', 'UNKNOWN', ''].includes(rawCountry)) {
    return null;
  }

  return mapCountryToMarket(rawCountry);
}

/**
 * Passive Client-Side Environment Resolution using IANA Timezone.
 * Zero user permission prompt, instantaneous, complies with Permissions-Policy: geolocation=().
 *
 * @returns MarketCode ('KE' if East Africa, 'GLOBAL' otherwise)
 */
export function resolveMarketFromClientHints(hints?: { timezone?: string }): MarketCode {
  try {
    let tz = hints?.timezone;
    if (!tz && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    if (tz) {
      const cleanTz = tz.trim();
      if (cleanTz === 'Africa/Nairobi' || EAST_AFRICA_TIMEZONES.has(cleanTz) || cleanTz.toLowerCase().includes('nairobi')) {
        return 'KE';
      }
    }
  } catch {
    /* Ignore environment inspection errors in restricted browser contexts */
  }

  return 'GLOBAL';
}

/**
 * Server-Side Market Resolution Helper for Next.js Server Components, Layouts, and API Route Handlers.
 *
 * Priority order:
 * 1. Edge / Proxy Headers (Authoritative physical location)
 * 2. Persistent cookie (bazion_market or legacy bw-market)
 * 3. Client hints fallback (if called on client) or Deterministic Global Default
 *
 * Uses dynamic import of 'next/headers' to prevent webpack client bundling violations
 * when imported by shared utilities or isomorphic contexts.
 */
export async function getServerMarket(
  customHeaders?: Headers | Record<string, string> | { get(name: string): string | null } | null,
  customCookie?: string | null
): Promise<ServerMarketResult> {
  let cookieVal: string | undefined = customCookie ?? undefined;
  let headerList: Headers | { get(name: string): string | null } | undefined =
    (customHeaders as any) ?? undefined;

  if (cookieVal && cookieVal.includes('=')) {
    const match = cookieVal.match(/(?:^|;\s*)(?:bazion_market|bw-market)=([^;]*)/);
    if (match) {
      cookieVal = decodeURIComponent(match[1]);
    }
  }

  if (!cookieVal && !headerList) {
    try {
      const { cookies, headers } = await import('next/headers');
      const cookieStore = await cookies();
      cookieVal =
        cookieStore.get(BAZION_MARKET_COOKIE)?.value ||
        cookieStore.get(LEGACY_MARKET_COOKIE)?.value;

      headerList = await headers();
    } catch {
      /* If executed outside Next.js request context (e.g. client bundle or standalone test), proceed gracefully */
    }
  }

  // 1. Authoritative Cookie (User explicit preference or persistent session)
  if (cookieVal) {
    const market = normalizeMarketCode(cookieVal);
    const currency = (MARKETS[market]?.currency ?? (market === 'KE' ? 'KES' : 'USD')) as CurrencyCode;
    return { market, currency };
  }

  // 2. Authoritative Edge / Proxy Headers
  if (headerList) {
    const headerMarket = resolveMarketFromHeaders(headerList);
    if (headerMarket) {
      const currency = (MARKETS[headerMarket]?.currency ?? (headerMarket === 'KE' ? 'KES' : 'USD')) as CurrencyCode;
      return { market: headerMarket, currency };
    }
  }

  // 3. Fallback: on client inspect hints, on server default to GLOBAL
  if (typeof window !== 'undefined') {
    const hintMarket = resolveMarketFromClientHints();
    return {
      market: hintMarket,
      currency: (MARKETS[hintMarket]?.currency ?? (hintMarket === 'KE' ? 'KES' : 'USD')) as CurrencyCode,
    };
  }

  return { market: 'GLOBAL', currency: 'USD' };
}
