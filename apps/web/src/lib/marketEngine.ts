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
    countryCodes: ['KE'],
    commercialTermsTitle: 'Kenya Commercial Terms & SME SLAs',
    supportScope: 'East Africa Time (EAT) priority support with direct WhatsApp & phone dispatch',
    paymentRailDescription: 'M-Pesa STK Push, Paybill, Kenyan Bank Wire & local Visa/Mastercard',
    paymentMethods: [
      { id: 'mpesa', name: 'M-Pesa', description: 'Instant STK push & Paybill validation', isPrimary: true },
      { id: 'bank', name: 'Bank Transfer / RTGS', description: 'Kenyan commercial bank invoice settlement' },
      { id: 'card', name: 'Credit / Debit Card', description: 'Local and regional Visa / Mastercard' },
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
    paymentRailDescription: 'Paystack, Global Visa/Mastercard/Amex & SWIFT Bank Wire',
    paymentMethods: [
      { id: 'card', name: 'International Card', description: 'Visa, Mastercard, Amex via Paystack', isPrimary: true },
      { id: 'wire', name: 'International Wire / SWIFT', description: 'USD/EUR corporate receiving accounts via Bank Wire' },
      { id: 'paypal', name: 'Corporate Invoicing', description: 'Standard international B2B invoice settlement' },
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
 * 4-Level Market Determination Algorithm:
 *
 * Request
 *   │
 *   ▼
 * 0. Existing Account Market? ───► YES ──► Level 0: Account Market (authoritative)
 *   │ NO
 *   ▼
 * 4. In Quotation / Billing Flow with Confirmed Billing Country?
 *   │ YES ──► Level 4: Billing Country (authoritative)
 *   │ NO
 *   ▼
 * 3. Explicit User-Selected Market? (from modal/footer override)
 *   │ YES ──► Level 3: User Choice (saved to cookie)
 *   │ NO
 *   ▼
 * 2. Market Cookie (bazion_market / bw-market)?
 *   │ YES ──► Level 2: Cookie Market (stable visitor session)
 *   │ NO
 *   ▼
 * 1. IP Geolocation (cf-ipcountry / vercel geo / headers)
 *   │
 *   ▼
 * Default: Kenya if KE/East Africa, else GLOBAL
 */
export function resolveMarket(input: MarketResolutionInput): MarketResolutionResult {
  // Level 0: Account preference
  if (input.accountMarket) {
    const code = normalizeMarketCode(input.accountMarket);
    return {
      market: MARKETS[code],
      code,
      level: 'LEVEL_0_ACCOUNT',
      authoritative: true,
      currency: MARKETS[code].currency,
      priceBookId: MARKETS[code].activePriceBookId,
    };
  }

  // Level 4: Confirmed Billing Country (authoritative commercial stage)
  if (input.billingCountry) {
    const code = mapCountryToMarket(input.billingCountry);
    return {
      market: MARKETS[code],
      code,
      level: 'LEVEL_4_BILLING_COUNTRY',
      authoritative: true,
      currency: MARKETS[code].currency,
      priceBookId: MARKETS[code].activePriceBookId,
    };
  }

  // Level 3: User-selected market override
  if (input.userSelection) {
    const code = normalizeMarketCode(input.userSelection);
    return {
      market: MARKETS[code],
      code,
      level: 'LEVEL_3_USER_CHOICE',
      authoritative: false,
      currency: MARKETS[code].currency,
      priceBookId: MARKETS[code].activePriceBookId,
    };
  }

  // Level 2: Stored market cookie
  if (input.marketCookie) {
    const code = normalizeMarketCode(input.marketCookie);
    return {
      market: MARKETS[code],
      code,
      level: 'LEVEL_2_COOKIE',
      authoritative: false,
      currency: MARKETS[code].currency,
      priceBookId: MARKETS[code].activePriceBookId,
    };
  }

  // Level 1: IP Geolocation
  if (input.ipCountry) {
    const code = mapCountryToMarket(input.ipCountry);
    return {
      market: MARKETS[code],
      code,
      level: 'LEVEL_1_GEO_IP',
      authoritative: false,
      currency: MARKETS[code].currency,
      priceBookId: MARKETS[code].activePriceBookId,
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
