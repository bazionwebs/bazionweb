/**
 * @jest-environment node
 */

import {
  resolveMarket,
  getRegionalCountryOptions,
  isCountryInMarket,
  REGIONAL_COUNTRY_OPTIONS,
} from '@/lib/marketEngine';
import {
  resolveMarketFromHeaders,
  resolveMarketFromClientHints,
} from '@/lib/geoDetection';

describe('Market Engine & Regionalization Logic', () => {
  describe('getRegionalCountryOptions & REGIONAL_COUNTRY_OPTIONS', () => {
    it('returns exactly East African countries for KE market', () => {
      const options = getRegionalCountryOptions('KE');
      const codes = options.map((opt) => opt.code);
      expect(codes).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);
      expect(codes).not.toContain('US');
      expect(codes).not.toContain('GB');
    });

    it('returns international options for GLOBAL market', () => {
      const options = getRegionalCountryOptions('GLOBAL');
      const codes = options.map((opt) => opt.code);
      expect(codes).toContain('US');
      expect(codes).toContain('GB');
      expect(codes).toContain('CA');
      expect(codes).toContain('AU');
      expect(codes).toContain('DE');
      expect(codes).toContain('OTHER');
      expect(codes).not.toContain('KE');
    });

    it('falls back to GLOBAL for null or undefined market', () => {
      const options = getRegionalCountryOptions(null);
      expect(options).toEqual(REGIONAL_COUNTRY_OPTIONS.GLOBAL);
    });
  });

  describe('isCountryInMarket validation', () => {
    it('accurately validates countries within KE regional market', () => {
      expect(isCountryInMarket('KE', 'KE')).toBe(true);
      expect(isCountryInMarket('UG', 'KE')).toBe(true);
      expect(isCountryInMarket('TZ', 'KE')).toBe(true);
      expect(isCountryInMarket('RW', 'KE')).toBe(true);
      expect(isCountryInMarket('BI', 'KE')).toBe(true);
      expect(isCountryInMarket('SS', 'KE')).toBe(true);
      expect(isCountryInMarket('ET', 'KE')).toBe(true);
      expect(isCountryInMarket('US', 'KE')).toBe(false);
      expect(isCountryInMarket('GB', 'KE')).toBe(false);
    });

    it('accurately validates countries within GLOBAL market', () => {
      expect(isCountryInMarket('US', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('GB', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('CA', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('OTHER', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('KE', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('UG', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('BI', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('SS', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('ET', 'GLOBAL')).toBe(false);
    });

    it('returns false for empty or null country codes', () => {
      expect(isCountryInMarket('', 'KE')).toBe(false);
      expect(isCountryInMarket(null, 'KE')).toBe(false);
      expect(isCountryInMarket(undefined, 'GLOBAL')).toBe(false);
    });
  });

  describe('resolveMarket strict priority', () => {
    it('prioritizes edge ipCountry over cookie and billingCountry', () => {
      const res = resolveMarket({
        ipCountry: 'KE',
        marketCookie: 'GLOBAL',
        billingCountry: 'US',
      });
      expect(res.code).toBe('KE');
      expect(res.level).toBe('LEVEL_1_GEO_IP');
    });

    it('prioritizes cookie when ipCountry is absent', () => {
      const res = resolveMarket({
        ipCountry: null,
        marketCookie: 'KE',
        billingCountry: 'US',
      });
      expect(res.code).toBe('KE');
      expect(res.level).toBe('LEVEL_2_COOKIE');
    });

    it('falls back to billingCountry when ipCountry and cookie are absent', () => {
      const res = resolveMarket({
        billingCountry: 'KE',
      });
      expect(res.code).toBe('KE');
      expect(res.level).toBe('LEVEL_4_BILLING_COUNTRY');
    });

    it('defaults to GLOBAL when no signals exist', () => {
      const res = resolveMarket({});
      expect(res.code).toBe('GLOBAL');
      expect(res.level).toBe('LEVEL_1_GEO_IP');
    });
  });

  describe('geoDetection headers and hints', () => {
    it('resolves KE from cf-ipcountry header', () => {
      const headers = new Headers();
      headers.set('cf-ipcountry', 'KE');
      expect(resolveMarketFromHeaders(headers)).toBe('KE');
    });

    it('resolves GLOBAL from x-vercel-ip-country header', () => {
      const headers = new Headers();
      headers.set('x-vercel-ip-country', 'US');
      expect(resolveMarketFromHeaders(headers)).toBe('GLOBAL');
    });

    it('returns null when no edge geo header exists', () => {
      const headers = new Headers();
      expect(resolveMarketFromHeaders(headers)).toBeNull();
    });

    it('resolves KE from East African timezone client hints', () => {
      expect(resolveMarketFromClientHints({ timezone: 'Africa/Nairobi' })).toBe('KE');
      expect(resolveMarketFromClientHints({ timezone: 'Africa/Kampala' })).toBe('KE');
      expect(resolveMarketFromClientHints({ timezone: 'Africa/Dar_es_Salaam' })).toBe('KE');
    });

    it('resolves GLOBAL from non-East African timezones', () => {
      expect(resolveMarketFromClientHints({ timezone: 'America/New_York' })).toBe('GLOBAL');
      expect(resolveMarketFromClientHints({ timezone: 'Europe/London' })).toBe('GLOBAL');
    });
  });
});
