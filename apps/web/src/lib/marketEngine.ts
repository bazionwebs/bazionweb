/**
 * BazionWeb Market Engine
 *
 * Core architectural principle:
 * Instead of simple `if country == 'KE' -> KES else USD`, BazionWeb operates
 * a formal Market Engine supporting commercial price books, multi-level resolution,
 * persistent cookies, user overrides, and authoritative billing country validation.
 */

export type MarketCode = 'KE' | 'GLOBAL' | 'EA' | 'AFRICA' | 'US' | 'UK' | 'EU';
export type LegacyMarket = 'kenya' | 'international';

export interface MarketDefinition {
  code: MarketCode;
  name: string;
  shortName: string;
  flag: string;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  currencySymbol: string;
  activePriceBookId: string;
  active: boolean;
  defaultLocale: string;
  countryCodes: string[]; // ISO 3166-1 alpha-2 codes mapped to this market
  commercialTermsTitle: string;
  supportScope: string;
  paymentRailDescription: string;
  paymentMethods: Array<{
    id: string;
    name: string;
    description: string;
    isPrimary?: boolean;
  }>;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  description: string;
}

/**
 * Regional country options strictly partitioned by commercial market.
 * Only options mapped to the customer's auto-identified market are rendered in the proposal modal.
 */
export const REGIONAL_COUNTRY_OPTIONS: Record<MarketCode, CountryOption[]> = {
  KE: [
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', description: 'KES · M-Pesa & Paystack' },
    { code: 'UG', name: 'Uganda', flag: '🇺🇬', description: 'East Africa Region · KES' },
    { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', description: 'East Africa Region · KES' },
    { code: 'RW', name: 'Rwanda', flag: '🇷🇼', description: 'East Africa Region · KES' },
    { code: 'BI', name: 'Burundi', flag: '🇧🇮', description: 'East Africa Region · KES' },
    { code: 'SS', name: 'South Sudan', flag: '🇸🇸', description: 'East Africa Region · KES' },
    { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', description: 'East Africa Region · KES' },
  ],
  GLOBAL: [
    { code: 'US', name: 'United States & Global', flag: '🇺🇸', description: 'USD · Card & Wire' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', description: 'USD · International' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', description: 'USD · Global Rails' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', description: 'USD · Global Rails' },
    { code: 'DE', name: 'Germany / Europe', flag: '🇩🇪', description: 'USD · International' },
    { code: 'OTHER', name: 'Other International', flag: '🌍', description: 'USD · Global SLA' },
  ],
  EA: [
    { code: 'UG', name: 'Uganda', flag: '🇺🇬', description: 'East Africa Region · KES' },
    { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', description: 'East Africa Region · KES' },
    { code: 'RW', name: 'Rwanda', flag: '🇷🇼', description: 'East Africa Region · KES' },
    { code: 'BI', name: 'Burundi', flag: '🇧🇮', description: 'East Africa Region · KES' },
    { code: 'SS', name: 'South Sudan', flag: '🇸🇸', description: 'East Africa Region · KES' },
    { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', description: 'East Africa Region · KES' },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', description: 'KES · M-Pesa & Paystack' },
  ],
  AFRICA: [
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', description: 'USD · West Africa' },
    { code: 'GH', name: 'Ghana', flag: '🇬🇭', description: 'USD · West Africa' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', description: 'USD · Southern Africa' },
    { code: 'OTHER', name: 'Other African Country', flag: '🌍', description: 'USD · Global SLA' },
  ],
  US: [
    { code: 'US', name: 'United States', flag: '🇺🇸', description: 'USD · Domestic Rails' },
  ],
  UK: [
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', description: 'GBP · Domestic Rails' },
  ],
  EU: [
    { code: 'DE', name: 'Germany / Europe', flag: '🇩🇪', description: 'EUR · SEPA' },
  ],
};

export const BAZION_MARKET_COOKIE = 'bazion_market';
export const LEGACY_MARKET_COOKIE = 'bw-market';
export const BAZION_MARKET_HEADER = 'x-bazion-market';
export const BAZION_PRICEBOOK_HEADER = 'x-bazion-pricebook';

/**
 * Supported market catalog
 */
export const MARKETS: Record<MarketCode, MarketDefinition> = {
  KE: {
    code: 'KE',
    name: 'Kenya Market',
    shortName: 'Kenya',
    flag: '🇰🇪',
    currency: 'KES',
    currencySymbol: 'KSh',
    activePriceBookId: 'KE-2026-v1',
    active: true,
    defaultLocale: 'en-KE',
    countryCodes: ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET'],
    commercialTermsTitle: 'Kenya Commercial Terms & SME SLAs',
    supportScope: 'East Africa Time (EAT) priority support with direct WhatsApp & phone dispatch',
    paymentRailDescription: 'M-Pesa STK Push (Daraja) & local Visa/Mastercard via Paystack',
    paymentMethods: [
      { id: 'mpesa', name: 'M-Pesa', description: 'Instant STK push via Safaricom Daraja API', isPrimary: true },
      { id: 'card', name: 'Credit / Debit Card', description: 'Local and regional Visa / Mastercard via Paystack' },
    ],
  },
  GLOBAL: {
    code: 'GLOBAL',
    name: 'International Market',
    shortName: 'International',
    flag: '🌍',
    currency: 'USD',
    currencySymbol: '$',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: true,
    defaultLocale: 'en-US',
    countryCodes: ['*'], // Catch-all for non-domestic visitors
    commercialTermsTitle: 'International Commercial Terms & Global Master SLAs',
    supportScope: 'Worldwide coverage across UTC-5 to UTC+3 with dedicated project management',
    paymentRailDescription: 'Paystack — Global Visa / Mastercard / Amex',
    paymentMethods: [
      { id: 'card', name: 'International Card', description: 'Visa, Mastercard, Amex via Paystack', isPrimary: true },
    ],
  },
  // Future planned markets (Architectural headroom)
  EA: {
    code: 'EA',
    name: 'East Africa Region',
    shortName: 'East Africa',
    flag: '🌍',
    currency: 'USD',
    currencySymbol: '$',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: false, // Activated as localized regional rails expand
    defaultLocale: 'en-UG',
    countryCodes: ['UG', 'TZ', 'RW', 'BI', 'SS', 'ET'],
    commercialTermsTitle: 'East African Community Trade Terms',
    supportScope: 'EAT regional project management and SLA',
    paymentRailDescription: 'MTN Mobile Money, Airtel Money & Regional Wire',
    paymentMethods: [
      { id: 'mobile_money', name: 'Mobile Money', description: 'MTN MoMo, Airtel Money' },
      { id: 'card', name: 'Card', description: 'Regional Debit/Credit' },
    ],
  },
  AFRICA: {
    code: 'AFRICA',
    name: 'Pan-African Markets',
    shortName: 'Pan-Africa',
    flag: '🌍',
    currency: 'USD',
    currencySymbol: '$',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: false,
    defaultLocale: 'en-NG',
    countryCodes: ['NG', 'GH', 'ZA', 'EG'],
    commercialTermsTitle: 'Pan-African Business Terms',
    supportScope: 'GMT to GMT+2 operational response',
    paymentRailDescription: 'Paystack, Flutterwave & African Corporate Wire',
    paymentMethods: [
      { id: 'card', name: 'Card', description: 'Visa / Mastercard' },
      { id: 'bank', name: 'NIP / Direct Bank Transfer', description: 'Corporate direct rails' },
    ],
  },
  US: {
    code: 'US',
    name: 'United States',
    shortName: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    currencySymbol: '$',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: false,
    defaultLocale: 'en-US',
    countryCodes: ['US'],
    commercialTermsTitle: 'US Business Terms',
    supportScope: 'US Eastern / Pacific business hours',
    paymentRailDescription: 'ACH Direct Debit, Domestic Wire & Stripe Cards',
    paymentMethods: [
      { id: 'ach', name: 'ACH Direct Debit', description: 'Domestic US Bank Transfer' },
      { id: 'card', name: 'Credit Card', description: 'Stripe Corporate Cards' },
    ],
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    shortName: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    currencySymbol: '£',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: false,
    defaultLocale: 'en-GB',
    countryCodes: ['GB'],
    commercialTermsTitle: 'UK Business Terms',
    supportScope: 'GMT / BST operational hours',
    paymentRailDescription: 'BACS / Faster Payments & Stripe Cards',
    paymentMethods: [
      { id: 'bacs', name: 'Faster Payments', description: 'UK Domestic Bank Transfer' },
      { id: 'card', name: 'Card', description: 'Debit / Credit' },
    ],
  },
  EU: {
    code: 'EU',
    name: 'European Union',
    shortName: 'Europe',
    flag: '🇪🇺',
    currency: 'EUR',
    currencySymbol: '€',
    activePriceBookId: 'GLOBAL-2026-v1',
    active: false,
    defaultLocale: 'en-DE',
    countryCodes: ['DE', 'FR', 'NL', 'IT', 'ES', 'SE', 'DK', 'PL', 'IE'],
    commercialTermsTitle: 'EU Cross-Border Service Terms',
    supportScope: 'CET operational hours',
    paymentRailDescription: 'SEPA Direct Credit & European Cards',
    paymentMethods: [
      { id: 'sepa', name: 'SEPA Transfer', description: 'Eurozone SEPA Instant' },
      { id: 'card', name: 'Card', description: 'Debit / Credit' },
    ],
  },
};

/**
 * Convert legacy names ('kenya', 'international') or code strings ('KE', 'GLOBAL') to canonical MarketCode.
 */
export function normalizeMarketCode(value: string | null | undefined): MarketCode {
  if (!value) return 'GLOBAL';
  const clean = value.trim().toUpperCase();
  if (clean === 'KE' || clean === 'KENYA') return 'KE';
  if (clean === 'GLOBAL' || clean === 'INTERNATIONAL' || clean === 'INTL' || clean === 'USD') return 'GLOBAL';
  if (clean in MARKETS && MARKETS[clean as MarketCode].active) {
    return clean as MarketCode;
  }
  return 'GLOBAL';
}

/**
 * Maps a country code (from IP/Geo or Billing Address) to an active market.
 */
export function mapCountryToMarket(countryCode: string | null | undefined): MarketCode {
  if (!countryCode) return 'GLOBAL';
  const code = countryCode.trim().toUpperCase();

  // Explicit Kenya check
  if (code === 'KE') return 'KE';

  // East Africa routing (can route to KE pricebook or future EA book)
  if (['UG', 'TZ', 'RW', 'BI', 'SS', 'ET'].includes(code)) {
    // Currently served under KE market terms or GLOBAL depending on configuration
    return 'KE';
  }

  return 'GLOBAL';
}

/**
 * Retrieves the scoped list of selectable country options for a given market.
 * Falls back deterministically to GLOBAL options if the market is invalid or unrecognized.
 */
export function getRegionalCountryOptions(market?: MarketCode | string | null): CountryOption[] {
  if (!market) return REGIONAL_COUNTRY_OPTIONS.GLOBAL;
  const canonical = normalizeMarketCode(market);
  return REGIONAL_COUNTRY_OPTIONS[canonical] || REGIONAL_COUNTRY_OPTIONS.GLOBAL;
}

/**
 * Validates whether a given ISO country code belongs to the allowed regional options for the market.
 */
export function isCountryInMarket(countryCode: string | null | undefined, market: MarketCode): boolean {
  if (!countryCode) return false;
  const cleanCode = countryCode.trim().toUpperCase();
  const options = getRegionalCountryOptions(market);
  return options.some(opt => opt.code === cleanCode);
}

export interface MarketResolutionInput {
  ipCountry?: string | null;
  marketCookie?: string | null;
  userSelection?: string | null;
  billingCountry?: string | null;
  accountMarket?: string | null;
}

export interface MarketResolutionResult {
  market: MarketDefinition;
  code: MarketCode;
  level: 'LEVEL_1_GEO_IP' | 'LEVEL_2_COOKIE' | 'LEVEL_3_USER_CHOICE' | 'LEVEL_4_BILLING_COUNTRY' | 'LEVEL_0_ACCOUNT';
  authoritative: boolean;
  currency: string;
  priceBookId: string;
}

/**
 * Authoritative Market Determination Algorithm (Strict Regional Policy):
 *
 * Request
 *   │
 *   ▼
 * 0. Existing Account Market? ───► YES ──► Level 0: Account Market (authoritative)
 *   │ NO
 *   ▼
 * 1. IP Geolocation (cf-ipcountry / vercel geo / edge headers)?
 *   │ YES ──► Level 1: Edge Geo-IP (authoritative)
 *   │ NO
 *   ▼
 * 2. Market Cookie (bazion_market / bw-market)?
 *   │ YES ──► Level 2: Stored Cookie
 *   │ NO
 *   ▼
 * 4. Billing Country (fallback for local API/testing when no edge/cookie signals)?
 *   │ YES ──► Level 4: Billing Country
 *   │ NO
 *   ▼
 * Default: GLOBAL (Deterministic International fallback)
 */
export function resolveMarket(input: MarketResolutionInput): MarketResolutionResult {
  // Level 0: Account preference
  if (input.accountMarket) {
    const code = normalizeMarketCode(input.accountMarket);
    return {
      market: MARKETS[code] || MARKETS.GLOBAL,
      code,
      level: 'LEVEL_0_ACCOUNT',
      authoritative: true,
      currency: (MARKETS[code] || MARKETS.GLOBAL).currency,
      priceBookId: (MARKETS[code] || MARKETS.GLOBAL).activePriceBookId,
    };
  }

  // Level 1: Edge IP Geolocation Headers (Authoritative)
  if (input.ipCountry) {
    const code = mapCountryToMarket(input.ipCountry);
    return {
      market: MARKETS[code] || MARKETS.GLOBAL,
      code,
      level: 'LEVEL_1_GEO_IP',
      authoritative: true,
      currency: (MARKETS[code] || MARKETS.GLOBAL).currency,
      priceBookId: (MARKETS[code] || MARKETS.GLOBAL).activePriceBookId,
    };
  }

  // Level 2: Stored market cookie
  if (input.marketCookie) {
    const code = normalizeMarketCode(input.marketCookie);
    return {
      market: MARKETS[code] || MARKETS.GLOBAL,
      code,
      level: 'LEVEL_2_COOKIE',
      authoritative: false,
      currency: (MARKETS[code] || MARKETS.GLOBAL).currency,
      priceBookId: (MARKETS[code] || MARKETS.GLOBAL).activePriceBookId,
    };
  }

  // Level 4: Billing Country (fallback when no edge headers or cookies are available)
  if (input.billingCountry) {
    const code = mapCountryToMarket(input.billingCountry);
    return {
      market: MARKETS[code] || MARKETS.GLOBAL,
      code,
      level: 'LEVEL_4_BILLING_COUNTRY',
      authoritative: false,
      currency: (MARKETS[code] || MARKETS.GLOBAL).currency,
      priceBookId: (MARKETS[code] || MARKETS.GLOBAL).activePriceBookId,
    };
  }

  // Default international for web crawlers, search engines and unverified IPs
  const defaultCode: MarketCode = 'GLOBAL';
  return {
    market: MARKETS[defaultCode],
    code: defaultCode,
    level: 'LEVEL_1_GEO_IP',
    authoritative: false,
    currency: MARKETS[defaultCode].currency,
    priceBookId: MARKETS[defaultCode].activePriceBookId,
  };
}
