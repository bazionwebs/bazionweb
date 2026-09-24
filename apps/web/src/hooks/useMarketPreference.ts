'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Market } from '@/lib/pricingData';

export const MARKET_STORAGE_KEY = 'bw-market';

/**
 * Market preference with SEO-safe defaults.
 *
 * Why this shape (per Google's international guidance):
 * - One canonical URL per page — the market toggle never changes the URL,
 *   so crawlers always see a stable, indexable page (no hreflang needed:
 *   the content is the same language, only price presentation varies).
 * - Never auto-redirect by location (that traps Googlebot, which crawls
 *   mostly from the US, on a single variant). Instead we *suggest* via a
 *   dismissible banner and remember an explicit choice in localStorage.
 * - Server render is always the International default, so first paint and
 *   crawlers see identical HTML (no hydration mismatch, no cloaking —
 *   bots are treated exactly like visitors).
 */
export function detectMarket(): Market {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    // East-African timezones where mobile-money rails are the norm.
    if (tz.startsWith('Africa/')) return 'kenya';
  } catch {
    /* ignore — default below */
  }
  return 'international';
}

export function readStoredMarket(): Market | null {
  try {
    const v = window.localStorage.getItem(MARKET_STORAGE_KEY);
    return v === 'kenya' || v === 'international' ? v : null;
  } catch {
    return null;
  }
}

export function useMarketPreference() {
  const [market, setMarketState] = useState<Market>('international');
  const [explicit, setExplicit] = useState(false);
  const [autoKenya, setAutoKenya] = useState(false);

  useEffect(() => {
    const stored = readStoredMarket();
    if (stored) {
      setMarketState(stored);
      setExplicit(true);
      return;
    }
    if (detectMarket() === 'kenya') {
      setMarketState('kenya');
      setAutoKenya(true);
    }
  }, []);

  const setMarket = useCallback((m: Market) => {
    setMarketState(m);
    setExplicit(true);
    try {
      window.localStorage.setItem(MARKET_STORAGE_KEY, m);
    } catch {
      /* ignore — preference simply won't persist */
    }
  }, []);

  return { market, setMarket, suggestKenya: autoKenya && !explicit };
}
