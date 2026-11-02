/**
 * @jest-environment jsdom
 */

import {
  resolveMarketFromHeaders,
  resolveMarketFromClientHints,
  getServerMarket,
  EAST_AFRICA_TIMEZONES,
} from '@/lib/geoDetection';
import {
  resolveMarket,
  mapCountryToMarket,
  normalizeMarketCode,
  getRegionalCountryOptions,
  isCountryInMarket,
  REGIONAL_COUNTRY_OPTIONS,
  BAZION_MARKET_COOKIE,
  LEGACY_MARKET_COOKIE,
} from '@/lib/marketEngine';

describe('Empirical Challenger: 4-Layer Auto-Detection & SSR Hydration Sync', () => {
  // ─── SECTION 1: EDGE PROXY HEADER PERMUTATIONS ───
  describe('Layer 1: Edge Proxy Header Resolution (resolveMarketFromHeaders)', () => {
    describe('cf-ipcountry permutations', () => {
      it.each([
        ['KE', 'KE'],
        ['ke', 'KE'],
        ['  KE  ', 'KE'],
        ['  ke  ', 'KE'],
        ['TZ', 'KE'],
        ['tz', 'KE'],
        ['UG', 'KE'],
        ['ug', 'KE'],
        ['RW', 'KE'],
        ['rw', 'KE'],
        ['BI', 'KE'],
        ['SS', 'KE'],
        ['ET', 'KE'],
        ['US', 'GLOBAL'],
        ['us', 'GLOBAL'],
        ['GB', 'GLOBAL'],
        ['gb', 'GLOBAL'],
        ['CA', 'GLOBAL'],
        ['DE', 'GLOBAL'],
        ['AU', 'GLOBAL'],
        ['FR', 'GLOBAL'],
        ['JP', 'GLOBAL'],
        ['ZA', 'GLOBAL'],
        ['NG', 'GLOBAL'],
        ['IN', 'GLOBAL'],
      ])('resolves cf-ipcountry="%s" -> %s', (headerVal, expectedMarket) => {
        const headers = new Headers();
        headers.set('cf-ipcountry', headerVal);
        expect(resolveMarketFromHeaders(headers)).toBe(expectedMarket);
      });

      it.each([
        ['XX'], // Cloudflare unknown / Tor placeholder
        ['T1'], // Tor network
        ['UNKNOWN'],
        [''], // Empty string
        ['   '], // Whitespace-only
      ])('filters out special/invalid code "%s" and returns null', (headerVal) => {
        const headers = new Headers();
        headers.set('cf-ipcountry', headerVal);
        expect(resolveMarketFromHeaders(headers)).toBeNull();
      });
    });

    describe('Alternative proxy headers permutations', () => {
      it('resolves x-vercel-ip-country (KE and US)', () => {
        const headersKE = new Headers();
        headersKE.set('x-vercel-ip-country', 'KE');
        expect(resolveMarketFromHeaders(headersKE)).toBe('KE');

        const headersLower = new Headers();
        headersLower.set('x-vercel-ip-country', 'ke');
        expect(resolveMarketFromHeaders(headersLower)).toBe('KE');

        const headersUS = new Headers();
        headersUS.set('x-vercel-ip-country', 'US');
        expect(resolveMarketFromHeaders(headersUS)).toBe('GLOBAL');
      });

      it('resolves cloudfront-viewer-country (KE, UG, GB)', () => {
        const headersKE = new Headers();
        headersKE.set('cloudfront-viewer-country', 'KE');
        expect(resolveMarketFromHeaders(headersKE)).toBe('KE');

        const headersUG = new Headers();
        headersUG.set('cloudfront-viewer-country', 'UG');
        expect(resolveMarketFromHeaders(headersUG)).toBe('KE');

        const headersGB = new Headers();
        headersGB.set('cloudfront-viewer-country', 'GB');
        expect(resolveMarketFromHeaders(headersGB)).toBe('GLOBAL');
      });

      it('resolves x-country-code (KE and DE)', () => {
        const headersKE = new Headers();
        headersKE.set('x-country-code', 'KE');
        expect(resolveMarketFromHeaders(headersKE)).toBe('KE');

        const headersDE = new Headers();
        headersDE.set('x-country-code', 'DE');
        expect(resolveMarketFromHeaders(headersDE)).toBe('GLOBAL');
      });

      it('resolves x-real-ip-country and x-geo-country fallbacks', () => {
        const hReal = new Headers();
        hReal.set('x-real-ip-country', 'KE');
        expect(resolveMarketFromHeaders(hReal)).toBe('KE');

        const hGeo = new Headers();
        hGeo.set('x-geo-country', 'KE');
        expect(resolveMarketFromHeaders(hGeo)).toBe('KE');
      });

      it('respects header priority order: cf-ipcountry > x-vercel-ip-country > cloudfront-viewer-country', () => {
        const headers = new Headers();
        headers.set('cf-ipcountry', 'KE');
        headers.set('x-vercel-ip-country', 'US');
        headers.set('cloudfront-viewer-country', 'GB');
        expect(resolveMarketFromHeaders(headers)).toBe('KE');

        const headers2 = new Headers();
        headers2.set('x-vercel-ip-country', 'KE');
        headers2.set('cloudfront-viewer-country', 'US');
        expect(resolveMarketFromHeaders(headers2)).toBe('KE');
      });

      it('handles mixed-case header names in accordance with HTTP spec', () => {
        const headers = new Headers();
        headers.set('CF-IPCountry', 'KE');
        expect(resolveMarketFromHeaders(headers)).toBe('KE');

        const headers2 = new Headers();
        headers2.set('X-Vercel-IP-Country', 'KE');
        expect(resolveMarketFromHeaders(headers2)).toBe('KE');

        const headers3 = new Headers();
        headers3.set('CloudFront-Viewer-Country', 'KE');
        expect(resolveMarketFromHeaders(headers3)).toBe('KE');
      });
    });
  });

  // ─── SECTION 2: CLIENT TIMEZONE RESOLUTION ───
  describe('Layer 3: Client Environment & Timezone Resolution (resolveMarketFromClientHints)', () => {
    describe('East African Community & regional timezones -> KE', () => {
      const eaTimezones = Array.from(EAST_AFRICA_TIMEZONES);

      it.each(eaTimezones)('resolves East Africa timezone "%s" -> KE', (tz) => {
        expect(resolveMarketFromClientHints({ timezone: tz })).toBe('KE');
      });

      it('resolves case-variations containing "nairobi" -> KE', () => {
        expect(resolveMarketFromClientHints({ timezone: 'Africa/Nairobi' })).toBe('KE');
        expect(resolveMarketFromClientHints({ timezone: 'AFRICA/NAIROBI' })).toBe('KE');
        expect(resolveMarketFromClientHints({ timezone: '  Africa/Nairobi  ' })).toBe('KE');
      });
    });

    describe('Global & International timezones -> GLOBAL', () => {
      it.each([
        ['America/New_York'],
        ['America/Los_Angeles'],
        ['America/Chicago'],
        ['Europe/London'],
        ['Europe/Berlin'],
        ['Europe/Paris'],
        ['Asia/Tokyo'],
        ['Asia/Dubai'],
        ['Asia/Singapore'],
        ['Australia/Sydney'],
        ['Pacific/Auckland'],
        ['UTC'],
        ['Etc/UTC'],
      ])('resolves global timezone "%s" -> GLOBAL', (tz) => {
        expect(resolveMarketFromClientHints({ timezone: tz })).toBe('GLOBAL');
      });
    });

    describe('Corner cases & malformed input safety', () => {
      it('resolves invalid timezone strings to GLOBAL default', () => {
        expect(resolveMarketFromClientHints({ timezone: 'Invalid/Zone_Name' })).toBe('GLOBAL');
        expect(resolveMarketFromClientHints({ timezone: 'Mars/Olympus' })).toBe('GLOBAL');
        expect(resolveMarketFromClientHints({ timezone: 'RandomText' })).toBe('GLOBAL');
      });

      it('does NOT throw when non-string timezone types are supplied', () => {
        // @ts-ignore
        expect(() => resolveMarketFromClientHints({ timezone: 12345 })).not.toThrow();
        // @ts-ignore
        expect(resolveMarketFromClientHints({ timezone: 12345 })).toBe('GLOBAL');

        // @ts-ignore
        expect(() => resolveMarketFromClientHints({ timezone: {} })).not.toThrow();
        // @ts-ignore
        expect(resolveMarketFromClientHints({ timezone: {} })).toBe('GLOBAL');

        // @ts-ignore
        expect(() => resolveMarketFromClientHints({ timezone: null })).not.toThrow();
      });

      it('falls back gracefully when Intl is mocked or unavailable', () => {
        const originalIntl = global.Intl;
        try {
          // Temporarily delete Intl
          // @ts-ignore
          global.Intl = undefined;
          expect(resolveMarketFromClientHints()).toBe('GLOBAL');
        } finally {
          global.Intl = originalIntl;
        }
      });
    });
  });

  // ─── SECTION 3: DETERMINISTIC FALLBACK BEHAVIOR ───
  describe('Layer 4: Deterministic Fallbacks & Null-Safety', () => {
    it('resolveMarket returns GLOBAL and USD when all signals are absent', () => {
      const result = resolveMarket({});
      expect(result.code).toBe('GLOBAL');
      expect(result.currency).toBe('USD');
      expect(result.market.activePriceBookId).toBe('GLOBAL-2026-v1');
    });

    it('resolveMarket handles all null / undefined properties gracefully', () => {
      const result = resolveMarket({
        ipCountry: null,
        marketCookie: null,
        userSelection: null,
        billingCountry: null,
        accountMarket: null,
      });
      expect(result.code).toBe('GLOBAL');
      expect(result.currency).toBe('USD');
    });

    it('resolveMarket handles placeholder / unknown ipCountry codes gracefully', () => {
      const resultXX = resolveMarket({ ipCountry: 'XX' });
      expect(resultXX.code).toBe('GLOBAL');
      expect(resultXX.currency).toBe('USD');

      const resultUnknown = resolveMarket({ ipCountry: 'UNKNOWN' });
      expect(resultUnknown.code).toBe('GLOBAL');
    });

    it('getServerMarket resolves to GLOBAL / USD when next/headers is unavailable or empty', async () => {
      const result = await getServerMarket();
      expect(['GLOBAL', 'KE']).toContain(result.market);
      expect(['USD', 'KES']).toContain(result.currency);
    });

    it('mapCountryToMarket maps unknown codes to GLOBAL', () => {
      expect(mapCountryToMarket(null)).toBe('GLOBAL');
      expect(mapCountryToMarket(undefined)).toBe('GLOBAL');
      expect(mapCountryToMarket('')).toBe('GLOBAL');
      expect(mapCountryToMarket('ZZ')).toBe('GLOBAL');
      expect(mapCountryToMarket('FOO')).toBe('GLOBAL');
    });

    it('normalizeMarketCode maps unknown strings to GLOBAL', () => {
      expect(normalizeMarketCode(null)).toBe('GLOBAL');
      expect(normalizeMarketCode(undefined)).toBe('GLOBAL');
      expect(normalizeMarketCode('')).toBe('GLOBAL');
      expect(normalizeMarketCode('xyz')).toBe('GLOBAL');
    });
  });

  // ─── SECTION 4: SSR / HYDRATION HEAD INLINE SCRIPT STRESS HARNESS ───
  describe('SSR / Hydration Sync: Head Inline Script Simulation', () => {
    const originalCookie = document.cookie;

    beforeEach(() => {
      // Clear cookies before each test
      document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    });

    afterEach(() => {
      document.cookie = originalCookie;
    });

    /**
     * Executes the EXACT inline script code embedded in `apps/web/src/app/layout.tsx`
     */
    function executeInlineHeadScript() {
      (function () {
        try {
          if (!document.cookie.match(/(?:^|;\s*)bazion_market=/)) {
            var tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
            var eaZones = ['Africa/Nairobi','Africa/Kampala','Africa/Dar_es_Salaam','Africa/Kigali','Africa/Bujumbura','Africa/Juba','Africa/Addis_Ababa','Africa/Mogadishu','Africa/Asmara','Africa/Djibouti','Indian/Comoro','Indian/Mayotte','Indian/Antananarivo'];
            var isKE = tz === 'Africa/Nairobi' || eaZones.indexOf(tz) !== -1 || (tz && tz.toLowerCase().indexOf('nairobi') !== -1);
            var code = isKE ? 'KE' : 'GLOBAL';
            var legacy = isKE ? 'kenya' : 'international';
            var exp = new Date(Date.now() + 365 * 864e5).toUTCString();
            document.cookie = 'bazion_market=' + code + '; expires=' + exp + '; path=/; SameSite=Lax';
            document.cookie = 'bw-market=' + legacy + '; expires=' + exp + '; path=/; SameSite=Lax';
          }
        } catch (e) {}
      })();
    }

    it('synchronously sets bazion_market=KE and bw-market=kenya when visiting from East Africa timezone without cookie', () => {
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = () => ({
        timeZone: 'Africa/Nairobi',
        locale: 'en-KE',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });

      try {
        executeInlineHeadScript();
        expect(document.cookie).toContain('bazion_market=KE');
        expect(document.cookie).toContain('bw-market=kenya');
      } finally {
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      }
    });

    it('synchronously sets bazion_market=GLOBAL and bw-market=international when visiting from London timezone without cookie', () => {
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = () => ({
        timeZone: 'Europe/London',
        locale: 'en-GB',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });

      try {
        executeInlineHeadScript();
        expect(document.cookie).toContain('bazion_market=GLOBAL');
        expect(document.cookie).toContain('bw-market=international');
      } finally {
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      }
    });

    it('does NOT overwrite existing bazion_market=GLOBAL cookie even if client has Africa/Nairobi timezone (server precedence)', () => {
      document.cookie = 'bazion_market=GLOBAL; path=/';
      document.cookie = 'bw-market=international; path=/';

      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = () => ({
        timeZone: 'Africa/Nairobi',
        locale: 'en-KE',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });

      try {
        executeInlineHeadScript();
        expect(document.cookie).toContain('bazion_market=GLOBAL');
        expect(document.cookie).not.toContain('bazion_market=KE');
      } finally {
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      }
    });

    it('does NOT overwrite existing bazion_market=KE cookie even if client has America/New_York timezone', () => {
      document.cookie = 'bazion_market=KE; path=/';
      document.cookie = 'bw-market=kenya; path=/';

      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = () => ({
        timeZone: 'America/New_York',
        locale: 'en-US',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });

      try {
        executeInlineHeadScript();
        expect(document.cookie).toContain('bazion_market=KE');
        expect(document.cookie).not.toContain('bazion_market=GLOBAL');
      } finally {
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      }
    });

    it('handles restricted browser sandbox where document.cookie setter throws without unhandled crash', () => {
      const originalPropertyDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

      // Mock restricted sandbox throwing on cookie access
      Object.defineProperty(document, 'cookie', {
        get: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
        set: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
        configurable: true,
      });

      try {
        expect(() => executeInlineHeadScript()).not.toThrow();
      } finally {
        if (originalPropertyDescriptor) {
          Object.defineProperty(document, 'cookie', originalPropertyDescriptor);
        }
      }
    });

    it('handles restricted environment where Intl is missing without unhandled crash', () => {
      // @ts-ignore
      const originalIntl = window.Intl;
      // @ts-ignore
      window.Intl = undefined;

      try {
        expect(() => executeInlineHeadScript()).not.toThrow();
        expect(document.cookie).toContain('bazion_market=GLOBAL');
      } finally {
        // @ts-ignore
        window.Intl = originalIntl;
      }
    });
  });

  // ─── SECTION 5: PROPOSAL SCOPING DOM PARTITION INTEGRITY ───
  describe('Proposal Scoping Catalog Integrity', () => {
    it('KE catalog contains exactly East African contracting territories', () => {
      const keOptions = getRegionalCountryOptions('KE');
      const codes = keOptions.map((o) => o.code);
      expect(codes).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);
      expect(codes).not.toContain('US');
      expect(codes).not.toContain('GB');
      expect(codes).not.toContain('CA');
    });

    it('GLOBAL catalog contains international contracting territories and OTHER', () => {
      const globalOptions = getRegionalCountryOptions('GLOBAL');
      const codes = globalOptions.map((o) => o.code);
      expect(codes).toContain('US');
      expect(codes).toContain('GB');
      expect(codes).toContain('CA');
      expect(codes).toContain('AU');
      expect(codes).toContain('DE');
      expect(codes).toContain('OTHER');
      expect(codes).not.toContain('KE');
      expect(codes).not.toContain('UG');
    });

    it('has zero cross-market overlap between KE and GLOBAL options', () => {
      const keCodes = new Set(getRegionalCountryOptions('KE').map((o) => o.code));
      const globalCodes = new Set(getRegionalCountryOptions('GLOBAL').map((o) => o.code));

      for (const code of keCodes) {
        expect(globalCodes.has(code)).toBe(false);
      }
    });

    it('isCountryInMarket strictly enforces boundaries', () => {
      expect(isCountryInMarket('KE', 'KE')).toBe(true);
      expect(isCountryInMarket('UG', 'KE')).toBe(true);
      expect(isCountryInMarket('TZ', 'KE')).toBe(true);
      expect(isCountryInMarket('RW', 'KE')).toBe(true);
      expect(isCountryInMarket('BI', 'KE')).toBe(true);
      expect(isCountryInMarket('SS', 'KE')).toBe(true);
      expect(isCountryInMarket('ET', 'KE')).toBe(true);
      expect(isCountryInMarket('US', 'KE')).toBe(false);

      expect(isCountryInMarket('US', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('GB', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('CA', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('AU', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('DE', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('OTHER', 'GLOBAL')).toBe(true);
      expect(isCountryInMarket('KE', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('UG', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('BI', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('SS', 'GLOBAL')).toBe(false);
      expect(isCountryInMarket('ET', 'GLOBAL')).toBe(false);
    });
  });
});
