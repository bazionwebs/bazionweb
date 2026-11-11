/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as handleQuotePost } from '@/app/api/quote/route';

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.99'),
}));

jest.mock('../src/lib/email', () => ({
  sendQuoteSummaryEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Empirical Challenger: Quote API Anti-Tamper Security (Requirement R3)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate backend CRM / pricing service offline so it falls back to local authoritative price books
    global.fetch = jest.fn().mockRejectedValue(new Error('Backend CRM offline simulation'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Adversarial Cross-Market Tampering Attacks', () => {
    it('rejects KE visitor attempting to tamper billingCountry to US', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Kenyan Tamperer',
          clientEmail: 'tamperer@kenya.co.ke',
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
      expect(json.allowedCountries).not.toContain('US');
    });

    it('rejects bazion_market=KE cookie holder attempting to submit billingCountry: GB', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'bazion_market=KE',
        },
        body: JSON.stringify({
          clientName: 'Cookie Tamperer',
          clientEmail: 'cookietamper@kenya.co.ke',
          billingCountry: 'GB',
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('KE');
      expect(json.allowedCountries).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);
    });

    it('rejects US visitor attempting to tamper billingCountry to KE to steal local KES pricing', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'Arbitrage Attacker',
          clientEmail: 'arbitrage@evilcorp.com',
          billingCountry: 'KE',
          packageType: 'professional',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('GLOBAL');
      expect(json.allowedCountries).not.toContain('KE');
      expect(json.allowedCountries).toContain('US');
    });

    it('rejects bazion_market=GLOBAL cookie holder attempting to submit billingCountry: UG', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'bazion_market=GLOBAL',
        },
        body: JSON.stringify({
          clientName: 'Global Tamperer',
          clientEmail: 'globaltamper@example.com',
          billingCountry: 'UG',
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('GLOBAL');
      expect(json.allowedCountries).not.toContain('UG');
    });

    it('prioritizes authoritative edge header over spoofed cookie (Level 1 over Level 2)', async () => {
      // Adversary connects from US IP but sends a forged bazion_market=KE cookie to claim KE pricing
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
          cookie: 'bazion_market=KE',
        },
        body: JSON.stringify({
          clientName: 'Spoofer',
          clientEmail: 'spoofer@us.com',
          billingCountry: 'KE',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      // Because cf-ipcountry: US is authoritative (Level 1), detected market is GLOBAL.
      // Therefore, billingCountry: KE must be rejected!
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
      expect(json.detectedMarket).toBe('GLOBAL');
    });

    it('enforces anti-tamper across alternate edge headers (x-vercel-ip-country, cloudfront-viewer-country, x-country-code)', async () => {
      const headerNames = ['x-vercel-ip-country', 'cloudfront-viewer-country', 'x-country-code'];

      for (const headerName of headerNames) {
        const request = new NextRequest('http://localhost:3000/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [headerName]: 'KE',
          },
          body: JSON.stringify({
            clientName: 'Edge Header Tamperer',
            clientEmail: 'edge@example.com',
            billingCountry: 'US',
            packageType: 'business',
          }),
        });

        const res = await handleQuotePost(request);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
        expect(json.detectedMarket).toBe('KE');
      }
    });
  });

  describe('Legitimate Regional & Global Requests', () => {
    it('accepts Kenya IP with billingCountry: UG under East African terms (KES)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Kampala Client',
          clientEmail: 'client@kampala.ug',
          billingCountry: 'UG',
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('KE');
      expect(json.currency).toBe('KES');
      expect(json.billingCountry).toBe('UG');
      expect(json.totals.totalBuild).toBe(25000); // KES 25,000 for launch package
    });

    it('accepts Kenya IP with billingCountry: TZ under East African terms (KES)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Dar es Salaam Client',
          clientEmail: 'client@daresalaam.tz',
          billingCountry: 'TZ',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('KE');
      expect(json.currency).toBe('KES');
      expect(json.billingCountry).toBe('TZ');
      expect(json.totals.totalBuild).toBe(90000); // KES 90,000 for business package
    });

    it('accepts Uganda IP with billingCountry: KE under East African terms (KES)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'UG',
        },
        body: JSON.stringify({
          clientName: 'East Africa Client',
          clientEmail: 'ea@client.com',
          billingCountry: 'KE',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('KE');
      expect(json.currency).toBe('KES');
      expect(json.billingCountry).toBe('KE');
    });

    it('accepts US IP with billingCountry: US under GLOBAL terms (USD)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'New York Client',
          clientEmail: 'client@ny.com',
          billingCountry: 'US',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('GLOBAL');
      expect(json.currency).toBe('USD');
      expect(json.totals.totalBuild).toBe(950); // USD 950 for business package
    });

    it('accepts US IP with billingCountry: GB under GLOBAL terms (USD)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'London Client',
          clientEmail: 'client@london.co.uk',
          billingCountry: 'GB',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('GLOBAL');
      expect(json.currency).toBe('USD');
      expect(json.billingCountry).toBe('GB');
    });

    it('accepts Germany IP with billingCountry: DE under GLOBAL terms (USD)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'DE',
        },
        body: JSON.stringify({
          clientName: 'Berlin Client',
          clientEmail: 'client@berlin.de',
          billingCountry: 'DE',
          packageType: 'launch',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('GLOBAL');
      expect(json.currency).toBe('USD');
      expect(json.billingCountry).toBe('DE');
      expect(json.totals.totalBuild).toBe(450); // USD 450 for launch package
    });

    it('accepts other international country (OTHER) under GLOBAL terms (USD)', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'FR',
        },
        body: JSON.stringify({
          clientName: 'Paris Client',
          clientEmail: 'client@paris.fr',
          billingCountry: 'OTHER',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.marketCode).toBe('GLOBAL');
      expect(json.currency).toBe('USD');
      expect(json.billingCountry).toBe('OTHER');
    });
  });

  describe('Adversarial Stress Testing: Malformed, Missing & Hostile Payloads', () => {
    it('rejects empty payload ({}) with HTTP 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Name and email are required/i);
    });

    it('rejects missing or empty clientEmail with HTTP 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: 'No Email Client', clientEmail: '   ' }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Name and email are required/i);
    });

    it('rejects non-string clientName (e.g. number or object) with HTTP 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: 12345, clientEmail: 'test@example.com' }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
    });

    it('rejects non-array selectedAddOns (e.g. string or object) with HTTP 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Addon Attacker',
          clientEmail: 'addon@example.com',
          selectedAddOns: 'malicious-string-not-array',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid add-on selection/i);
    });

    it('rejects selectedAddOns containing non-string items with HTTP 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Addon Attacker',
          clientEmail: 'addon@example.com',
          selectedAddOns: [123, null, false],
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid add-on selection/i);
    });

    it('rejects invalid/non-existent billing country (ZZ) under KE detection', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Fake Country Attacker',
          clientEmail: 'fake@example.com',
          billingCountry: 'ZZ',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('REGIONAL_MARKET_MISMATCH');
    });

    it('safely handles negative extraPages by clamping to 0 without crashing', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'KE',
        },
        body: JSON.stringify({
          clientName: 'Negative Pages Client',
          clientEmail: 'neg@example.com',
          billingCountry: 'KE',
          packageType: 'business',
          extraPages: -100,
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.breakdown.extraPages.count).toBe(0);
      expect(json.breakdown.extraPages.amount).toBe(0);
      expect(json.totals.totalBuild).toBe(90000);
    });

    it('safely handles unknown packageType, care, and hosting by applying default fallbacks', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: 'Unknown Enums Client',
          clientEmail: 'unknown@example.com',
          billingCountry: 'US',
          packageType: 'super-infinite-quantum',
          care: 'unlimited-free-care',
          hosting: 'quantum-server-free',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.currency).toBe('USD');
      // Should default monthly care and hosting to 0
      expect(json.totals.monthlyCare).toBe(0);
      expect(json.totals.annualHosting).toBe(0);
    });

    it('safely handles XSS / SQL injection strings in fields without crashing', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ipcountry': 'US',
        },
        body: JSON.stringify({
          clientName: "<script>alert('XSS')</script>",
          clientEmail: "victim@example.com'; DROP TABLE quotes;--",
          clientCompany: '<img src=x onerror=alert(1)>',
          couponCode: "' OR '1'='1",
          billingCountry: 'US',
          packageType: 'business',
        }),
      });

      const res = await handleQuotePost(request);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Name and email are required to save your proposal.');
    });
  });
});
