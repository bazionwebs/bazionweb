/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import {
  REGIONAL_COUNTRY_OPTIONS,
  MARKETS,
  mapCountryToMarket,
  isCountryInMarket,
  getRegionalCountryOptions,
} from '@/lib/marketEngine';
import { POST as handleQuotePost } from '@/app/api/quote/route';

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.101'),
}));

jest.mock('../src/lib/email', () => ({
  sendQuoteSummaryEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Empirical Adversarial Challenge: Regional Territory Expansion & /api/quote Submissions', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new Error('CRM offline simulation'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // CHALLENGE 2: Regional Territory Expansion in marketEngine.ts
  // =========================================================================
  describe('Regional Territory Expansion in marketEngine.ts', () => {
    it('verifies Burundi (BI), South Sudan (SS), and Ethiopia (ET) are present in REGIONAL_COUNTRY_OPTIONS.KE', () => {
      const keOptions = REGIONAL_COUNTRY_OPTIONS.KE;
      expect(keOptions).toBeDefined();

      const codes = keOptions.map((o) => o.code);
      expect(codes).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);

      // Exact entry verification
      const bi = keOptions.find((o) => o.code === 'BI');
      expect(bi).toEqual({
        code: 'BI',
        name: 'Burundi',
        flag: '🇧🇮',
        description: 'East Africa Region · KES',
      });

      const ss = keOptions.find((o) => o.code === 'SS');
      expect(ss).toEqual({
        code: 'SS',
        name: 'South Sudan',
        flag: '🇸🇸',
        description: 'East Africa Region · KES',
      });

      const et = keOptions.find((o) => o.code === 'ET');
      expect(et).toEqual({
        code: 'ET',
        name: 'Ethiopia',
        flag: '🇪🇹',
        description: 'East Africa Region · KES',
      });
    });

    it('verifies BI, SS, and ET are mapped to KE in MARKETS.KE.countryCodes and mapCountryToMarket', () => {
      expect(MARKETS.KE.countryCodes).toContain('BI');
      expect(MARKETS.KE.countryCodes).toContain('SS');
      expect(MARKETS.KE.countryCodes).toContain('ET');

      expect(mapCountryToMarket('BI')).toBe('KE');
      expect(mapCountryToMarket('SS')).toBe('KE');
      expect(mapCountryToMarket('ET')).toBe('KE');

      // Case-insensitivity check
      expect(mapCountryToMarket('bi')).toBe('KE');
      expect(mapCountryToMarket('ss')).toBe('KE');
      expect(mapCountryToMarket('et')).toBe('KE');
    });

    it('verifies isCountryInMarket permits BI, SS, and ET under KE and strictly forbids them under GLOBAL', () => {
      expect(isCountryInMarket('BI', 'KE')).toBe(true);
      expect(isCountryInMarket('SS', 'KE')).toBe(true);
      expect(isCountryInMarket('ET', 'KE')).toBe(true);

      // Case-insensitivity
      expect(isCountryInMarket('bi', 'KE')).toBe(true);
      expect(isCountryInMarket('ss', 'KE')).toBe(true);
      expect(isCountryInMarket('et', 'KE')).toBe(true);

      // Adversarial negative check: must NOT be valid under GLOBAL
      expect(isCountryInMarket('BI', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('SS', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('ET', 'GLOBAL')).toBe(false);

      const globalCodes = getRegionalCountryOptions('GLOBAL').map((c) => c.code);
      expect(globalCodes).not.toContain('BI');
      expect(globalCodes).not.toContain('SS');
      expect(globalCodes).not.toContain('ET');
    });
  });

  // =========================================================================
  // CHALLENGE 3: /api/quote Submissions with BI, SS, ET under KES terms
  // =========================================================================
  describe('/api/quote Submissions for Expanded EAC Territories', () => {
    it.each([
      { country: 'BI', label: 'Burundi' },
      { country: 'SS', label: 'South Sudan' },
      { country: 'ET', label: 'Ethiopia' },
    ])('accepts quote submission under KES terms for $country ($label) with cf-ipcountry: KE', async ({ country, label }) => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: `${label} Enterprise Client`,
          clientEmail: `client-${country.toLowerCase()}@example.com`,
          clientCompany: `${label} Technologies`,
          billingCountry: country,
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('LOCKED');
      expect(data.marketCode).toBe('KE');
      expect(data.currency).toBe('KES');
      expect(data.currencySymbol).toBe('KSh');
      expect(data.billingCountry).toBe(country);
      expect(data.priceBookId).toBe('KE-2026-v1');
      expect(data.commercialTerms.title).toBe('Kenya Commercial Terms & SME SLAs');

      // Verify business package base cost in KES (90,000)
      expect(data.package.baseCost).toBe(90000);
      expect(data.package.formattedBaseCost).toContain('90,000');
    });

    it.each([
      { country: 'bi', label: 'burundi (lowercase)' },
      { country: 'ss', label: 'south sudan (lowercase)' },
      { country: 'et', label: 'ethiopia (lowercase)' },
    ])('normalizes lowercase billingCountry $country and accepts under KES terms', async ({ country, label }) => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: `${label} Client`,
          clientEmail: `lowercase-${country}@example.com`,
          billingCountry: country,
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.currency).toBe('KES');
      expect(data.billingCountry).toBe(country.toUpperCase());
      expect(data.package.baseCost).toBe(25000); // Launch package KES
    });

    it.each([
      { country: 'BI', label: 'Burundi direct geo-IP' },
      { country: 'SS', label: 'South Sudan direct geo-IP' },
      { country: 'ET', label: 'Ethiopia direct geo-IP' },
    ])('auto-detects market as KE when visitor has cf-ipcountry: $country and accepts $country billing', async ({ country, label }) => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': country,
        },
        body: JSON.stringify({
          clientName: `${label} Client`,
          clientEmail: `direct-geo-${country.toLowerCase()}@example.com`,
          billingCountry: country,
          packageType: 'professional',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.marketCode).toBe('KE');
      expect(data.currency).toBe('KES');
      expect(data.billingCountry).toBe(country);
      expect(data.package.baseCost).toBe(160000); // Professional package KES
    });

    it.each(['BI', 'SS', 'ET'])(
      'rejects with HTTP 400 REGIONAL_MARKET_MISMATCH when US visitor attempts to submit billingCountry: %s',
      async (countryCode) => {
        const request = new NextRequest('http://localhost:3000/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-ipcountry': 'US',
          },
          body: JSON.stringify({
            clientName: 'Tamperer from US',
            clientEmail: 'tamper@us.com',
            billingCountry: countryCode,
            packageType: 'business',
          }),
        });

        const res = await handleQuotePost(request);
        expect(res.status).toBe(400);

        const data = await res.json();
        expect(data.code).toBe('REGIONAL_MARKET_MISMATCH');
        expect(data.detectedMarket).toBe('GLOBAL');
        expect(data.allowedCountries).not.toContain(countryCode);
        expect(data.error).toContain(`Billing country '${countryCode}' does not match the auto-identified regional market 'GLOBAL'`);
      }
    );
  });
});
