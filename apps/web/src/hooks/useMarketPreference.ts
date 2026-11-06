'use client';

import { useEffect, useState } from 'react';
import {
  MarketCode,
  LegacyMarket,
  MarketDefinition,
  MARKETS,
  normalizeMarketCode,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
} from '@/lib/marketEngine';
import { resolveMarketFromClientHints } from '@/lib/geoDetection';

const MARKET_STORAGE_KEY = BAZION_MARKET_COOKIE;
const LEGACY_STORAGE_KEY = LEGACY_MARKET_COOKIE;

/**
 * Reads market code from document.cookie
 */
export function readMarketCookie(): MarketCode | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + BAZION_MARKET_COOKIE + '=([^;]*)'));
    if (match) {
      return normalizeMarketCode(decodeURIComponent(match[1]));
    }
    const legacyMatch = document.cookie.match(new RegExp('(?:^|;\\s*)' + LEGACY_MARKET_COOKIE + '=([^;]*)'));
    if (legacyMatch) {
      return normalizeMarketCode(decodeURIComponent(legacyMatch[1]));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Writes persistent market cookies for future server and client requests.
 */
export function setMarketCookie(market: MarketCode | LegacyMarket) {
  if (typeof document === 'undefined') return;
  try {
    const canonical = normalizeMarketCode(market);
    const legacyVal = canonical === 'KE' ? 'kenya' : 'international';
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();

    document.cookie = `${BAZION_MARKET_COOKIE}=${canonical}; expires=${expires}; path=/; SameSite=Lax`;
    document.cookie = `${LEGACY_MARKET_COOKIE}=${legacyVal}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    /* ignore cookie writing errors */
  }
}

/**
 * Synchronous client-side market resolver.
 * Priority:
 * 1. Existing cookie (set by server or pre-paint <head> script)
 * 2. Client hints (Intl timezone)
 * 3. Fallback: GLOBAL
 */
export function detectMarket(): MarketCode {
  const cookieVal = readMarketCookie();
  if (cookieVal) return cookieVal;

  return resolveMarketFromClientHints();
}

export interface UseMarketPreferenceReturn {
  marketCode: MarketCode;
  market: LegacyMarket;
  marketDef: MarketDefinition;
  isLocked: true;
  /** @deprecated Manual market switching disabled */
  setMarket?: (market: MarketCode | LegacyMarket) => void;
  /** @deprecated Manual market modal disabled */
  openModal?: () => void;
  /** @deprecated Manual market modal disabled */
  closeModal?: () => void;
  isModalOpen?: boolean;
}

/**
 * React hook for market preference consumption.
 * Strictly auto-detected and read-only.
 */
export function useMarketPreference(initialMarket?: MarketCode): UseMarketPreferenceReturn {
  // Synchronous state initialization: Match SSR on initial render pass to prevent React #418/#425 hydration mismatches
  const [marketCode, setMarketCode] = useState<MarketCode>(initialMarket || 'GLOBAL');

  useEffect(() => {
    // Re-verify cookie or client hints on mount and persist if not already saved
    const resolved = detectMarket() || initialMarket || 'GLOBAL';
    setMarketCode(resolved);
    setMarketCookie(resolved);

    try {
      window.localStorage.setItem(MARKET_STORAGE_KEY, resolved);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, resolved === 'KE' ? 'kenya' : 'international');
    } catch {
      /* ignore */
    }
  }, [initialMarket]);

  const marketDef: MarketDefinition = MARKETS[marketCode] || MARKETS.GLOBAL;
  const legacyMarket: LegacyMarket = marketCode === 'KE' ? 'kenya' : 'international';

  return {
    marketCode,
    market: legacyMarket,
    marketDef,
    isLocked: true,
  };
}
