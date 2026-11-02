import React from 'react';
import { render } from '@testing-library/react';
import PricingPage, { generateMetadata } from '@/app/(public)/pricing/page';
import * as geoDetection from '../src/lib/geoDetection';

jest.mock('../src/lib/geoDetection', () => ({
  ...jest.requireActual('../src/lib/geoDetection'),
  getServerMarket: jest.fn(),
}));

describe('Empirical Pricing Page Single-Currency Verification', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When visitor is identified as Kenya Domestic (KE)', () => {
    beforeEach(() => {
      (geoDetection.getServerMarket as jest.Mock).mockResolvedValue({
        market: 'KE',
        currency: 'KES',
      });
    });

    it('generates single-market metadata for Kenya without USD or dual-market mentions', async () => {
      const meta = await generateMetadata();
      expect(meta.description).toContain('Kenya');
      expect(meta.description).toContain('KES');
      expect(meta.description).not.toContain('USD');
      expect(meta.description).not.toContain('dual-market');
    });

    it('renders strictly KES offers in Schema.org JSON-LD with zero USD offers', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      const data = JSON.parse(script!.textContent || '{}');

      expect(data['@type']).toBe('Product');
      expect(data.description).not.toContain('dual-market');
      expect(data.areaServed).toBe('Kenya');

      expect(Array.isArray(data.offers)).toBe(true);
      expect(data.offers.length).toBeGreaterThan(0);

      // Verify every offer is KES
      for (const offer of data.offers) {
        expect(offer.priceCurrency).toBe('KES');
        expect(offer.priceCurrency).not.toBe('USD');
        expect(offer.name).not.toContain('International');
      }
    });
  });

  describe('When visitor is identified as International (GLOBAL)', () => {
    beforeEach(() => {
      (geoDetection.getServerMarket as jest.Mock).mockResolvedValue({
        market: 'GLOBAL',
        currency: 'USD',
      });
    });

    it('generates single-market metadata for Global without KES or dual-market mentions', async () => {
      const meta = await generateMetadata();
      expect(meta.description).toContain('USD');
      expect(meta.description).not.toContain('KES');
      expect(meta.description).not.toContain('dual-market');
    });

    it('renders strictly USD offers in Schema.org JSON-LD with zero KES offers', async () => {
      const pageJsx = await PricingPage();
      const { container } = render(pageJsx);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      const data = JSON.parse(script!.textContent || '{}');

      expect(data['@type']).toBe('Product');
      expect(data.description).not.toContain('dual-market');
      expect(data.areaServed).toBe('Worldwide');

      expect(Array.isArray(data.offers)).toBe(true);
      expect(data.offers.length).toBeGreaterThan(0);

      // Verify every offer is USD
      for (const offer of data.offers) {
        expect(offer.priceCurrency).toBe('USD');
        expect(offer.priceCurrency).not.toBe('KES');
        expect(offer.name).not.toContain('Kenya');
      }
    });
  });
});
