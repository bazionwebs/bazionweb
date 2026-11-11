'use client';

import { useContext, useMemo } from 'react';
import {
  MarketCode,
  LegacyMarket,
  MarketDefinition,
  MARKETS,
  normalizeMarketCode,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
} from '@/lib/marketEngine';
import { resolveMarketFromClientHints, type CurrencyCode } from '@/lib/geoDetection';
import { MarketContext } from '@/components/providers/MarketProvider';

const MARKET_STORAGE_KEY = BAZION_MARKET_COOKIE;
const LEGACY_STORAGE_KEY = LEGACY_MARKET_COOKIE;

/**
 * Reads market code from document.cookie synchronously.
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

    try {
      window.localStorage.setItem(MARKET_STORAGE_KEY, canonical);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, legacyVal);
    } catch {
      /* ignore storage errors */
    }
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
  isLocked: true | boolean;
  currency?: CurrencyCode;
  formatPrice?: (amount: number, options?: Intl.NumberFormatOptions) => string;
  setMarketPreference?: (market: MarketCode | LegacyMarket) => void;
  setMarket?: (market: MarketCode | LegacyMarket) => void;
  openModal?: () => void;
  closeModal?: () => void;
  isModalOpen?: boolean;
}

/**
 * React hook for market preference consumption.
 * Consumes MarketContext directly for zero-latency, zero-flash SSR hydration.
 */
export function useMarketPreference(initialMarket?: MarketCode): UseMarketPreferenceReturn {
  const context = useContext(MarketContext);

  if (context && !initialMarket) {
    return {
      marketCode: context.marketCode,
      market: context.market,
      marketDef: context.marketDef,
      isLocked: context.isLocked,
      currency: context.currency,
      formatPrice: context.formatPrice,
      setMarketPreference: context.setMarketPreference,
      setMarket: context.setMarket,
      openModal: context.openModal,
      closeModal: context.closeModal,
      isModalOpen: context.isModalOpen,
    };
  }

  // Fallback / explicit override when outside Provider or when initialMarket is explicitly passed
  const effectiveCode: MarketCode = initialMarket ? normalizeMarketCode(initialMarket) : (context?.marketCode ?? detectMarket());
  const marketDef: MarketDefinition = MARKETS[effectiveCode] || MARKETS.GLOBAL;
  const legacyMarket: LegacyMarket = effectiveCode === 'KE' ? 'kenya' : 'international';
  const currency = (marketDef.currency ?? (effectiveCode === 'KE' ? 'KES' : 'USD')) as CurrencyCode;

  const formatPrice = (amount: number, options?: Intl.NumberFormatOptions): string => {
    const locale = marketDef.defaultLocale || (effectiveCode === 'KE' ? 'en-KE' : 'en-US');
    const formatted = amount.toLocaleString(locale, options);
    if (marketDef.currencySymbol === '$') {
      return `$${formatted}`;
    }
    return `${marketDef.currencySymbol} ${formatted}`;
  };

  return {
    marketCode: effectiveCode,
    market: legacyMarket,
    marketDef,
    isLocked: true,
    currency,
    formatPrice,
    setMarketPreference: context?.setMarketPreference ?? setMarketCookie,
    setMarket: context?.setMarket ?? setMarketCookie,
  };
}
