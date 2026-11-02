import React from 'react';
import { render } from '@testing-library/react';
import PricingPage, { generateMetadata } from '@/app/(public)/pricing/page';
import * as geoDetection from '../src/lib/geoDetection';

jest.mock('../src/lib/geoDetection', () => ({
  ...jest.requireActual('../src/lib/geoDetection'),
  getServerMarket: jest.fn(),
}));

describe('Empirical Adversarial Challenge: Pricing Page Schema & Single-Currency Rendering', () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.cookie = 'bazion_market=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'bw-market=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  // =========================================================================
  // SCENARIO 1: Kenya Context (bazion_market=KE / cf-ipcountry: KE)
  // =========================================================================
  describe('Under Kenya Domestic Context (bazion_market=KE / cf-ipcountry: KE)', () => {
    beforeEach(() => {
      document.cookie = 'bazion_market=KE; path=/';
      document.cookie = 'bw-market=kenya; path=/';
      (geoDetection.getServerMarket as jest.Mock).mockResolvedValue({
        market: 'KE',
        currency: 'KES',
      });
    });

    it('generates metadata containing ONLY Kenya/KES context with zero USD or dual-market text', async () => {
      const meta = await generateMetadata();
      expect(meta.description).toBeDefined();
      const desc = meta.description as string;

      // Positive assertions
      expect(desc).toContain('Kenya');
      expect(desc).toContain('KES');
      expect(desc).toContain('M-Pesa');

      // Adversarial negative assertions: no dual-market or international prices
      expect(desc).not.toMatch(/dual[- ]market/i);
      expect(desc).not.toContain('USD');
      expect(desc).not.toContain('worldwide');
      expect(desc).not.toContain('$');

      // Title check
      expect(meta.title).not.toMatch(/dual[- ]market/i);

      // Keywords check: contains Kenya/KES keywords, zero USD keywords
      const keywords = meta.keywords as string[];
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.some((k) => k.includes('Kenya') || k.includes('KES'))).toBe(true);
      expect(keywords.some((k) => k.includes('USD'))).toBe(false);
    });

    it('renders Schema.org JSON-LD containing strictly KES offers and zero USD offers', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      const schema = JSON.parse(script!.textContent || '{}');

      // Product metadata
      expect(schema['@type']).toBe('Product');
      expect(schema.name).toBe('BazionWeb Digital Engineering & Website Care Plans');
      expect(schema.areaServed).toBe('Kenya');
      expect(schema.description).toContain('Kenyan businesses');
      expect(schema.description).not.toMatch(/dual[- ]market/i);
      expect(schema.description).not.toContain('USD');
      expect(schema.description).not.toContain('$');

      // Offers verification
      expect(Array.isArray(schema.offers)).toBe(true);
      expect(schema.offers.length).toBeGreaterThanOrEqual(9);

      // Verify EVERY offer in schema is strictly KES
      for (const offer of schema.offers) {
        expect(offer['@type']).toBe('Offer');
        expect(offer.priceCurrency).toBe('KES');
        expect(offer.priceCurrency).not.toBe('USD');

        // Negative check: serialized JSON must have zero USD substrings
        const serialized = JSON.stringify(offer);
        expect(serialized).not.toContain('"USD"');
        expect(serialized).not.toContain('$');
        expect(offer.name).not.toMatch(/USD|International/i);
      }
    });

    it('renders PricingView with KES Commercial Schedule indicator and no foreign currency badges', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const text = container.textContent || '';
      expect(text).toContain('KES Commercial Schedule');
      expect(text).toContain('M-Pesa STK');
      expect(text).not.toContain('USD Commercial Schedule');
      expect(text).not.toMatch(/dual[- ]market/i);
    });
  });

  // =========================================================================
  // SCENARIO 2: Global Context (bazion_market=GLOBAL / cf-ipcountry: US)
  // =========================================================================
  describe('Under Global International Context (bazion_market=GLOBAL / cf-ipcountry: US)', () => {
    beforeEach(() => {
      document.cookie = 'bazion_market=GLOBAL; path=/';
      document.cookie = 'bw-market=international; path=/';
      (geoDetection.getServerMarket as jest.Mock).mockResolvedValue({
        market: 'GLOBAL',
        currency: 'USD',
      });
    });

    it('generates metadata containing ONLY Global/USD context with zero KES or dual-market text', async () => {
      const meta = await generateMetadata();
      expect(meta.description).toBeDefined();
      const desc = meta.description as string;

      // Positive assertions
      expect(desc).toContain('worldwide');
      expect(desc).toContain('USD');

      // Adversarial negative assertions: no dual-market or Kenya domestic prices
      expect(desc).not.toMatch(/dual[- ]market/i);
      expect(desc).not.toContain('KES');
      expect(desc).not.toContain('KSh');
      expect(desc).not.toContain('Kenya');
      expect(desc).not.toContain('M-Pesa');

      // Title check
      expect(meta.title).not.toMatch(/dual[- ]market/i);

      // Keywords check: contains USD keywords, zero KES keywords
      const keywords = meta.keywords as string[];
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.some((k) => k.includes('USD'))).toBe(true);
      expect(keywords.some((k) => k.includes('KES') || k.includes('Kenya'))).toBe(false);
    });

    it('renders Schema.org JSON-LD containing strictly USD offers and zero KES offers', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      const schema = JSON.parse(script!.textContent || '{}');

      // Product metadata
      expect(schema['@type']).toBe('Product');
      expect(schema.name).toBe('BazionWeb Digital Engineering & Website Care Plans');
      expect(schema.areaServed).toBe('Worldwide');
      expect(schema.description).toContain('international clients');
      expect(schema.description).not.toMatch(/dual[- ]market/i);
      expect(schema.description).not.toContain('KES');
      expect(schema.description).not.toContain('KSh');
      expect(schema.description).not.toContain('Kenya');

      // Offers verification
      expect(Array.isArray(schema.offers)).toBe(true);
      expect(schema.offers.length).toBeGreaterThanOrEqual(9);

      // Verify EVERY offer in schema is strictly USD
      for (const offer of schema.offers) {
        expect(offer['@type']).toBe('Offer');
        expect(offer.priceCurrency).toBe('USD');
        expect(offer.priceCurrency).not.toBe('KES');

        // Negative check: serialized JSON must have zero KES substrings
        const serialized = JSON.stringify(offer);
        expect(serialized).not.toContain('"KES"');
        expect(serialized).not.toContain('KSh');
        expect(offer.name).not.toMatch(/Kenya|KES|KSh/i);
      }
    });

    it('renders PricingView with USD Commercial Schedule indicator and no foreign currency badges', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const text = container.textContent || '';
      expect(text).toContain('USD Commercial Schedule');
      expect(text).toContain('Card / Wire');
      expect(text).not.toContain('KES Commercial Schedule');
      expect(text).not.toMatch(/dual[- ]market/i);
    });
  });
});
