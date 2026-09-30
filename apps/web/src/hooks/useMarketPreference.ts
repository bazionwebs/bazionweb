'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MarketCode,
  LegacyMarket,
  MarketDefinition,
  MARKETS,
  normalizeMarketCode,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
} from '@/lib/marketEngine';

// Re-use the same cookie name strings as localStorage keys for consistency
const MARKET_STORAGE_KEY = BAZION_MARKET_COOKIE;  // 'bazion_market'
const LEGACY_STORAGE_KEY = LEGACY_MARKET_COOKIE;  // 'bw-market'

/**
 * Reads market cookie from document.cookie
 */
export function readMarketCookie(): MarketCode | null {
  if (typeof document === 'undefined') return null;
  try {
    // 1. Check authoritative bazion_market cookie
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + BAZION_MARKET_COOKIE + '=([^;]*)'));
    if (match) {
      return normalizeMarketCode(decodeURIComponent(match[1]));
    }
    // 2. Check legacy bw-market cookie
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
 * Sets persistent market cookies for both edge middleware and legacy support.
 */
export function setMarketCookie(market: MarketCode | LegacyMarket) {
  if (typeof document === 'undefined') return;
  try {
    const canonical = normalizeMarketCode(market);
    const legacyVal = canonical === 'KE' ? 'kenya' : 'international';
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();

    // Set new canonical market cookie
    document.cookie = `${BAZION_MARKET_COOKIE}=${canonical}; expires=${expires}; path=/; SameSite=Lax`;
    // Set legacy cookie for backward-compatible edge nodes
    document.cookie = `${LEGACY_MARKET_COOKIE}=${legacyVal}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    /* ignore cookie writing errors */
  }
}

/**
 * Silent market detection (Level 1 Geo IP & Timezone heuristic)
 */
export function detectMarket(): MarketCode {
  // 1. Check cookie injected by Edge Middleware
  const cookieVal = readMarketCookie();
  if (cookieVal) return cookieVal;

  // 2. Check client timezone as fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (tz === 'Africa/Nairobi' || tz.startsWith('Africa/')) {
      return 'KE';
    }
  } catch {
    /* ignore */
  }

  return 'GLOBAL';
}

/**
 * Read stored market from query param, cookie, or local storage.
 */
export function readStoredMarket(): MarketCode | null {
  // 1. Check URL override if on client
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const cur = params.get('currency')?.toLowerCase();
      const mkt = params.get('market')?.toLowerCase();
      if (cur === 'kes' || mkt === 'kenya' || mkt === 'ke') return 'KE';
      if (cur === 'usd' || mkt === 'international' || mkt === 'intl' || mkt === 'global') return 'GLOBAL';
    } catch {
      /* ignore */
    }
  }

  // 2. Cookie
  const cookie = readMarketCookie();
  if (cookie) return cookie;

  // 3. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem(MARKET_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (v) return normalizeMarketCode(v);
    } catch {
      /* ignore */
    }
  }

  return null;
}

// Global modal event listener
const MARKET_MODAL_EVENT = 'bazion:open-market-modal';
const MARKET_CHANGE_EVENT = 'bazion:market-change';

export function triggerOpenMarketModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MARKET_MODAL_EVENT));
  }
}

/**
 * React hook for market preference resolution and UI binding
 */
export function useMarketPreference() {
  const [marketCode, setMarketCodeState] = useState<MarketCode>('GLOBAL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 1. Try to read market from URL params, cookie, or localStorage in one pass
    const stored = readStoredMarket();
    if (stored) {
      setMarketCodeState(stored);
    } else {
      // 2. No persisted preference — fall back to timezone heuristic
      let detected: MarketCode = 'GLOBAL';
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
        if (tz === 'Africa/Nairobi' || tz.startsWith('Africa/')) detected = 'KE';
      } catch { /* ignore */ }

      setMarketCodeState(detected);
      setMarketCookie(detected);
      try {
        window.localStorage.setItem(MARKET_STORAGE_KEY, detected);
        window.localStorage.setItem(LEGACY_STORAGE_KEY, detected === 'KE' ? 'kenya' : 'international');
      } catch { /* ignore */ }
    }

    // 3. Listen for modal and market-change broadcast events
    const handleOpenModal = () => setIsModalOpen(true);
    const handleMarketChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { marketCode: MarketCode };
      if (detail?.marketCode) setMarketCodeState(detail.marketCode);
    };

    window.addEventListener(MARKET_MODAL_EVENT, handleOpenModal);
    window.addEventListener(MARKET_CHANGE_EVENT, handleMarketChange);

    return () => {
      window.removeEventListener(MARKET_MODAL_EVENT, handleOpenModal);
      window.removeEventListener(MARKET_CHANGE_EVENT, handleMarketChange);
    };
  }, []);

  const setMarket = useCallback((m: MarketCode | LegacyMarket) => {
    const code = normalizeMarketCode(m);
    setMarketCodeState(code);
    setMarketCookie(code);

    try {
      window.localStorage.setItem(MARKET_STORAGE_KEY, code);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, code === 'KE' ? 'kenya' : 'international');
    } catch {
      /* ignore */
    }

    // Dispatch broadcast event so all components update in real-time
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MARKET_CHANGE_EVENT, { detail: { marketCode: code } }));
    }
  }, []);

  const marketDef: MarketDefinition = MARKETS[marketCode] || MARKETS.GLOBAL;
  const legacyMarket: LegacyMarket = marketCode === 'KE' ? 'kenya' : 'international';

  return {
    marketCode,
    market: legacyMarket, // legacy compatibility for existing components
    marketDef,
    setMarket,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    suggestKenya: false,
  };
}
