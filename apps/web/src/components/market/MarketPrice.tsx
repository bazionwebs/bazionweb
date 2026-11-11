'use client';

import React from 'react';
import { useMarketPreference } from '@/hooks/useMarketPreference';

/**
 * Tiny client island that renders the market-aware string.
 *
 * The surrounding page stays a SERVER component (statically cacheable, no
 * ISO/CLS cost); only this leaf hydrates. Because the island is its own
 * boundary, the market resolution happens inside one text node — no
 * page-level GLOBAL→KE re-render, no layout shift from font/reflow of
 * sibling content.
 */
interface MarketPriceTextProps {
  /** Display value for the Kenya (KE) market. */
  ke: string;
  /** Display value for the global (USD) market. */
  global: string;
  className?: string;
}

export default function MarketPriceText({ ke, global, className }: MarketPriceTextProps) {
  const { market } = useMarketPreference();
  return <span className={className}>{market === 'kenya' ? ke : global}</span>;
}

export function MarketPriceTag({ className }: { className?: string }) {
  const { marketDef } = useMarketPreference();
  return (
    <span className={className}>
      {marketDef.flag} {marketDef.shortName} ({marketDef.currency})
    </span>
  );
}
