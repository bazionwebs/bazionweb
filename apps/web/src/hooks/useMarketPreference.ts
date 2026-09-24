'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Market } from '@/lib/pricingData';

export const MARKET_STORAGE_KEY = 'bw-market';
export const MARKET_COOKIE_KEY = 'bw-market';

/**
 * Reads the market cookie silently without external dependencies.
 */
export function readMarketCookie(): Market | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + MARKET_COOKIE_KEY + '=([^;]*)'));
    const val = match ? decodeURIComponent(match[2]).toLowerCase() : null;
    return val === 'kenya' || val === 'international' ? (val as Market) : null;
  } catch {
    return null;
  }
}

/**
 * Saves market to cookie for edge sync and persistence.
 */
export function setMarketCookie(market: Market) {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = `${MARKET_COOKIE_KEY}=${market}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    /* ignore cookie writing errors */
  }
}

/**
 * Silent market detection:
 * - Edge cookie / header takes priority
 * - Timezone analysis (Africa/* timezones default to Kenya/East Africa)
 * - Defaults to international (USD) for global visitors and search crawlers
 */
export function detectMarket(): Market {
  // 1. Check cookie injected by Edge Middleware
  const cookieVal = readMarketCookie();
  if (cookieVal) return cookieVal;

  // 2. Check client timezone as fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (tz.startsWith('Africa/')) return 'kenya';
  } catch {
    /* ignore — default below */
  }

  return 'international';
}

export function readStoredMarket(): Market | null {
  // Check URL override if on client
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const cur = params.get('currency')?.toLowerCase();
      const mkt = params.get('market')?.toLowerCase();
      if (cur === 'kes' || mkt === 'kenya' || mkt === 'ke') return 'kenya';
      if (cur === 'usd' || mkt === 'international' || mkt === 'intl') return 'international';
    } catch {
      /* ignore */
    }
  }

  const cookie = readMarketCookie();
  if (cookie) return cookie;

  try {
    const v = window.localStorage.getItem(MARKET_STORAGE_KEY);
    return v === 'kenya' || v === 'international' ? (v as Market) : null;
  } catch {
    return null;
  }
}

/**
 * Silent Market Preference Hook
 *
 * Design guarantees:
 * - Silent resolution: Never pops up alarming suggestion banners or comparisons.
 * - Single canonical URL: Prevents SEO duplicate content and cloaking penalties.
 * - Edge synchronization: Middleware and client share the 'bw-market' cookie.
 */
export function useMarketPreference() {
  const [market, setMarketState] = useState<Market>('international');

  useEffect(() => {
    // 1. Priority to explicit stored preference or cookie
    const stored = readStoredMarket();
    if (stored) {
      setMarketState(stored);
      return;
    }

    // 2. Silent edge/timezone detection
    const detected = detectMarket();
    if (detected === 'kenya') {
      setMarketState('kenya');
      setMarketCookie('kenya');
      try {
        window.localStorage.setItem(MARKET_STORAGE_KEY, 'kenya');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setMarket = useCallback((m: Market) => {
    setMarketState(m);
    setMarketCookie(m);
    try {
      window.localStorage.setItem(MARKET_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    market,
    setMarket,
    suggestKenya: false, // Intentionally false: eliminates comparative alert banners
  };
}
