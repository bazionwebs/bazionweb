'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  MarketCode,
  LegacyMarket,
  MarketDefinition,
  MARKETS,
  normalizeMarketCode,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
} from '@/lib/marketEngine';
import type { CurrencyCode, ServerMarketResult } from '@/lib/geoDetection';

export interface MarketContextValue {
  marketCode: MarketCode;
  currency: CurrencyCode;
  formatPrice: (amount: number, options?: Intl.NumberFormatOptions) => string;
  setMarketPreference: (market: MarketCode | LegacyMarket) => void;
  market: LegacyMarket;
  marketDef: MarketDefinition;
  isLocked: boolean;
  setMarket?: (market: MarketCode | LegacyMarket) => void;
  openModal?: () => void;
  closeModal?: () => void;
  isModalOpen?: boolean;
}

export const MarketContext = createContext<MarketContextValue | null>(null);

function writeCookies(canonical: MarketCode) {
  if (typeof document === 'undefined') return;
  try {
    const legacyVal = canonical === 'KE' ? 'kenya' : 'international';
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = `${BAZION_MARKET_COOKIE}=${canonical}; expires=${expires}; path=/; SameSite=Lax`;
    document.cookie = `${LEGACY_MARKET_COOKIE}=${legacyVal}; expires=${expires}; path=/; SameSite=Lax`;

    window.localStorage.setItem(BAZION_MARKET_COOKIE, canonical);
    window.localStorage.setItem(LEGACY_MARKET_COOKIE, legacyVal);
  } catch {
    /* ignore cookie persistence errors */
  }
}

function resolveMarketCode(input?: MarketCode | ServerMarketResult | string | null): MarketCode {
  if (!input) return 'GLOBAL';
  if (typeof input === 'object' && input !== null && 'market' in input) {
    return normalizeMarketCode((input as ServerMarketResult).market);
  }
  return normalizeMarketCode(String(input));
}

export interface MarketProviderProps {
  initialMarket?: MarketCode | ServerMarketResult | string | null;
  children: React.ReactNode;
}

export function MarketProvider({ initialMarket = 'GLOBAL', children }: MarketProviderProps) {
  const initialCode = useMemo(() => resolveMarketCode(initialMarket), [initialMarket]);
  const [marketCode, setMarketCodeState] = useState<MarketCode>(initialCode);

  useEffect(() => {
    const nextCode = resolveMarketCode(initialMarket);
    if (nextCode && nextCode !== marketCode) {
      setMarketCodeState(nextCode);
    }
  }, [initialMarket]);

  const setMarketPreference = useCallback((market: MarketCode | LegacyMarket) => {
    const canonical = normalizeMarketCode(market);
    setMarketCodeState(canonical);
    writeCookies(canonical);
  }, []);

  const marketDef: MarketDefinition = MARKETS[marketCode] || MARKETS.GLOBAL;
  const currency = (marketDef.currency ?? (marketCode === 'KE' ? 'KES' : 'USD')) as CurrencyCode;
  const legacyMarket: LegacyMarket = marketCode === 'KE' ? 'kenya' : 'international';

  const formatPrice = useCallback(
    (amount: number, options?: Intl.NumberFormatOptions): string => {
      const locale = marketDef.defaultLocale || (marketCode === 'KE' ? 'en-KE' : 'en-US');
      const formatted = amount.toLocaleString(locale, options);
      if (marketDef.currencySymbol === '$') {
        return `$${formatted}`;
      }
      return `${marketDef.currencySymbol} ${formatted}`;
    },
    [marketCode, marketDef]
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      marketCode,
      currency,
      formatPrice,
      setMarketPreference,
      market: legacyMarket,
      marketDef,
      isLocked: true,
      setMarket: setMarketPreference,
    }),
    [marketCode, currency, formatPrice, setMarketPreference, legacyMarket, marketDef]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}

export default MarketProvider;
