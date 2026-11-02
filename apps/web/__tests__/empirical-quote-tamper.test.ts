/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as handleQuotePost } from '@/app/api/quote/route';
import { GET as handleMarketGet, POST as handleMarketPost } from '@/app/api/market/route';

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.99'),
}));

jest.mock('../src/lib/email', () => ({
  sendQuoteSummaryEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Empirical Verification: Anti-Tamper & Regional Locking', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new Error('Backend CRM offline simulation'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('POST /api/quote Anti-Tampering Validation', () => {
    it('rejects with HTTP 400 when US visitor attempts to submit billingCountry: KE', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'Adversary Tamperer',
          clientEmail: 'adversary@example.com',
          billingCountry: 'KE',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('GLOBAL');
      expect(json.allowedCountries).toContain('US');
      expect(json.allowedCountries).not.toContain('KE');
    });

    it('rejects with HTTP 400 when visitor with bazion_market=GLOBAL cookie attempts to submit billingCountry: KE', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'bazion_market=GLOBAL',
        },
        body: JSON.stringify({
          clientName: 'Cookie Tamperer',
          clientEmail: 'cookietamper@example.com',
          billingCountry: 'KE',
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('GLOBAL');
    });

    it('rejects with HTTP 400 when KE visitor attempts to submit billingCountry: US', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Kenyan Tamperer',
          clientEmail: 'kenyan@example.com',
          billingCountry: 'US',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('KE');
      expect(json.allowedCountries).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);
    });

    it('accepts proposal when KE visitor submits valid East African country (UG)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Uganda Client',
          clientEmail: 'uganda@example.com',
          billingCountry: 'UG',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.currency).toBe('KES');
    });

    it('accepts proposal when KE visitor submits valid East African country (BI, SS, ET)', async () => {
      for (const countryCode of ['BI', 'SS', 'ET']) {
        const request = new NextRequest('http://localhost:3000/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-ipcountry': 'KE',
          },
          body: JSON.stringify({
            clientName: `${countryCode} Client`,
            clientEmail: `${countryCode.toLowerCase()}@example.com`,
            billingCountry: countryCode,
            packageType: 'business',
          }),
        });

        const res = await handleQuotePost(request);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.currency).toBe('KES');
      }
    });

    it('accepts proposal when US visitor submits valid Global country (GB)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'UK Client',
          clientEmail: 'uk@example.com',
          billingCountry: 'GB',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.currency).toBe('USD');
    });
  });

  describe('Market Route Handler Security & Immutability', () => {
    it('POST /api/market rejects manual override attempts with HTTP 403 Forbidden', async () => {
      const request = new NextRequest('http://localhost:3000/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: 'KE' }),
      });

      const res = await handleMarketPost(request);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('GET /api/market ignores query overrides and sets bazion_market cookie', async () => {
      const request = new NextRequest('http://localhost:3000/api/market?market=KE', {
        method: 'GET',
        headers: {
          'cf-ipcountry': 'US',
        },
      });

      const res = await handleMarketGet(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.market).toBe('GLOBAL');

      const setCookieHeader = res.headers.get('set-cookie');
      expect(setCookieHeader).toContain('bazion_market=GLOBAL');
    });
  });
});
