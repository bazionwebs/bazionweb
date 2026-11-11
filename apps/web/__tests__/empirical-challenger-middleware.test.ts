/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Empirical Challenger: Edge Route Protection & Middleware Security Harness', () => {
  const BASE_URL = 'http://localhost:3000';

  describe('1. Unauthenticated Edge Route Protection (HTTP 307 + next query param)', () => {
    const protectedRoutes = [
      { path: '/admin/dashboard', expectedLogin: '/admin/login' },
      { path: '/admin/users', expectedLogin: '/admin/login' },
      { path: '/admin/clients', expectedLogin: '/admin/login' },
      { path: '/admin/invoices', expectedLogin: '/admin/login' },
      { path: '/admin/settings', expectedLogin: '/admin/login' },
      { path: '/admin/reports', expectedLogin: '/admin/login' },
      { path: '/admin/troubleshooting', expectedLogin: '/admin/login' },
      { path: '/portal/projects', expectedLogin: '/portal/login' },
      { path: '/portal/account', expectedLogin: '/portal/login' },
      { path: '/portal/assets', expectedLogin: '/portal/login' },
      { path: '/portal/invoices', expectedLogin: '/portal/login' },
      { path: '/portal/milestones', expectedLogin: '/portal/login' },
      { path: '/portal/packages', expectedLogin: '/portal/login' },
      { path: '/portal/vault', expectedLogin: '/portal/login' },
    ];

    test.each(protectedRoutes)(
      'rejects unauthenticated request to $path with 307 redirect to $expectedLogin',
      ({ path, expectedLogin }) => {
        const req = new NextRequest(`${BASE_URL}${path}`);
        const res = middleware(req);

        expect(res.status).toBe(307);
        const location = res.headers.get('location');
        expect(location).not.toBeNull();

        const redirectUrl = new URL(location!);
        expect(redirectUrl.pathname).toBe(expectedLogin);
        expect(redirectUrl.searchParams.get('next')).toBe(path);
      },
    );

    it('redirects base /admin to /admin/login?next=/admin with HTTP 307', () => {
      const req = new NextRequest(`${BASE_URL}/admin`);
      const res = middleware(req);

      expect(res.status).toBe(307);
      const redirectUrl = new URL(res.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/admin/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/admin');
    });

    it('redirects base /portal to /portal/login?next=/portal with HTTP 307', () => {
      const req = new NextRequest(`${BASE_URL}/portal`);
      const res = middleware(req);

      expect(res.status).toBe(307);
      const redirectUrl = new URL(res.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/portal/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/portal');
    });

    it('properly encodes deeply nested and parameterized routes in next parameter', () => {
      const deepPath = '/admin/invoices/2026/Q1/INV-8892';
      const req = new NextRequest(`${BASE_URL}${deepPath}`);
      const res = middleware(req);

      expect(res.status).toBe(307);
      const redirectUrl = new URL(res.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/admin/login');
      expect(redirectUrl.searchParams.get('next')).toBe(deepPath);
    });
  });

  describe('2. Public Paths Bypass (HTTP 200 without redirection)', () => {
    const publicAdminPaths = [
      '/admin/login',
      '/admin/login/',
      '/admin/login?error=invalid_credentials',
      '/admin/login/callback',
    ];

    const publicPortalPaths = [
      '/portal/login',
      '/portal/login/',
      '/portal/login/verify',
      '/portal/claim',
      '/portal/claim/promo-2026',
      '/portal/register',
      '/portal/register?plan=enterprise',
      '/portal/reset-password',
      '/portal/reset-password?token=abcdef123456',
    ];

    const publicMarketingPaths = [
      '/',
      '/about',
      '/pricing',
      '/solutions',
      '/services',
      '/contact',
      '/quote',
      '/legal/terms',
      '/legal/privacy',
    ];

    test.each(publicAdminPaths)(
      'allows unauthenticated request to public admin path $path without redirect',
      (path) => {
        const req = new NextRequest(`${BASE_URL}${path}`);
        const res = middleware(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      },
    );

    test.each(publicPortalPaths)(
      'allows unauthenticated request to public portal path $path without redirect',
      (path) => {
        const req = new NextRequest(`${BASE_URL}${path}`);
        const res = middleware(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      },
    );

    test.each(publicMarketingPaths)(
      'allows unauthenticated request to public marketing path $path without redirect',
      (path) => {
        const req = new NextRequest(`${BASE_URL}${path}`);
        const res = middleware(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      },
    );
  });

  describe('3. Geo-Header Market Detection & Regional Routing', () => {
    const eastAfricanCountries = [
      'KE', // Kenya
      'UG', // Uganda
      'TZ', // Tanzania
      'RW', // Rwanda
      'BI', // Burundi
      'SS', // South Sudan
      'ET', // Ethiopia
      'SO', // Somalia
      'DJ', // Djibouti
      'KM', // Comoros
      'MG', // Madagascar
    ];

    const nonEastAfricanCountries = [
      'US', // United States
      'GB', // United Kingdom
      'CA', // Canada
      'DE', // Germany
      'FR', // France
      'ZA', // South Africa
      'NG', // Nigeria
      'IN', // India
      'JP', // Japan
      'AU', // Australia
    ];

    test.each(eastAfricanCountries)(
      'sets bazion_market=KE cookie for East African visitor from country %s via cf-ipcountry',
      (country) => {
        const req = new NextRequest(`${BASE_URL}/`, {
          headers: { 'cf-ipcountry': country },
        });
        const res = middleware(req);

        const cookies = res.cookies.getAll();
        const marketCookie = cookies.find((c) => c.name === 'bazion_market');
        const bwMarketCookie = cookies.find((c) => c.name === 'bw-market');

        expect(marketCookie).toBeDefined();
        expect(marketCookie?.value).toBe('KE');
        expect(bwMarketCookie).toBeDefined();
        expect(bwMarketCookie?.value).toBe('kenya');
      },
    );

    test.each(nonEastAfricanCountries)(
      'does NOT set bazion_market cookie for non-EA visitor from country %s via cf-ipcountry',
      (country) => {
        const req = new NextRequest(`${BASE_URL}/`, {
          headers: { 'cf-ipcountry': country },
        });
        const res = middleware(req);

        const cookies = res.cookies.getAll();
        const marketCookie = cookies.find((c) => c.name === 'bazion_market');
        expect(marketCookie).toBeUndefined();
      },
    );

    it('specifically verifies cf-ipcountry: KE sets bazion_market=KE', () => {
      const req = new NextRequest(`${BASE_URL}/pricing`, {
        headers: { 'cf-ipcountry': 'KE' },
      });
      const res = middleware(req);
      const cookie = res.cookies.get('bazion_market');
      expect(cookie?.value).toBe('KE');
    });

    it('specifically verifies cf-ipcountry: UG sets bazion_market=KE', () => {
      const req = new NextRequest(`${BASE_URL}/pricing`, {
        headers: { 'cf-ipcountry': 'UG' },
      });
      const res = middleware(req);
      const cookie = res.cookies.get('bazion_market');
      expect(cookie?.value).toBe('KE');
    });

    it('specifically verifies cf-ipcountry: US does NOT set bazion_market', () => {
      const req = new NextRequest(`${BASE_URL}/pricing`, {
        headers: { 'cf-ipcountry': 'US' },
      });
      const res = middleware(req);
      const cookie = res.cookies.get('bazion_market');
      expect(cookie).toBeUndefined();
    });

    it('specifically verifies cf-ipcountry: GB does NOT set bazion_market', () => {
      const req = new NextRequest(`${BASE_URL}/pricing`, {
        headers: { 'cf-ipcountry': 'GB' },
      });
      const res = middleware(req);
      const cookie = res.cookies.get('bazion_market');
      expect(cookie).toBeUndefined();
    });

    it('supports fallback geo headers: x-vercel-ip-country, cloudfront-viewer-country, x-country-code', () => {
      const headersToTest = [
        { header: 'x-vercel-ip-country', value: 'KE' },
        { header: 'cloudfront-viewer-country', value: 'UG' },
        { header: 'x-country-code', value: 'TZ' },
      ];

      for (const { header, value } of headersToTest) {
        const req = new NextRequest(`${BASE_URL}/`, {
          headers: { [header]: value },
        });
        const res = middleware(req);
        expect(res.cookies.get('bazion_market')?.value).toBe('KE');
      }
    });

    it('handles lowercase and whitespace in geo-headers gracefully', () => {
      const req = new NextRequest(`${BASE_URL}/`, {
        headers: { 'cf-ipcountry': '  ke  ' },
      });
      const res = middleware(req);
      expect(res.cookies.get('bazion_market')?.value).toBe('KE');
    });

    it('does NOT overwrite preexisting bazion_market or bw-market cookies', () => {
      // Preexisting bazion_market=US
      const reqWithBazion = new NextRequest(`${BASE_URL}/`, {
        headers: {
          'cf-ipcountry': 'KE',
          cookie: 'bazion_market=US',
        },
      });
      const resWithBazion = middleware(reqWithBazion);
      expect(resWithBazion.cookies.get('bazion_market')).toBeUndefined();

      // Preexisting bw-market=global
      const reqWithBw = new NextRequest(`${BASE_URL}/`, {
        headers: {
          'cf-ipcountry': 'KE',
          cookie: 'bw-market=global',
        },
      });
      const resWithBw = middleware(reqWithBw);
      expect(resWithBw.cookies.get('bazion_market')).toBeUndefined();
    });
  });

  describe('4. Session Authentication Recognition & Bypass Defense', () => {
    it('allows access to protected /admin/dashboard with bazionweb_session cookie', () => {
      const req = new NextRequest(`${BASE_URL}/admin/dashboard`, {
        headers: { cookie: 'bazionweb_session=session_token_123' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows access to protected /portal/projects with bazionweb-auth cookie', () => {
      const req = new NextRequest(`${BASE_URL}/portal/projects`, {
        headers: { cookie: 'bazionweb-auth=authenticated_state' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows access to protected routes with valid Bearer Authorization header', () => {
      const req = new NextRequest(`${BASE_URL}/admin/dashboard`, {
        headers: { authorization: 'Bearer jwt_access_token_xyz' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('rejects empty or whitespace-only auth cookie and redirects with 307', () => {
      const emptyReq = new NextRequest(`${BASE_URL}/admin/dashboard`, {
        headers: { cookie: 'bazionweb_session=' },
      });
      const emptyRes = middleware(emptyReq);
      expect(emptyRes.status).toBe(307);

      const wsReq = new NextRequest(`${BASE_URL}/portal/projects`, {
        headers: { cookie: 'bazionweb_session=   ' },
      });
      const wsRes = middleware(wsReq);
      expect(wsRes.status).toBe(307);
    });

    it('rejects non-Bearer or malformed authorization header and redirects with 307', () => {
      const basicReq = new NextRequest(`${BASE_URL}/admin/dashboard`, {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      const basicRes = middleware(basicReq);
      expect(basicRes.status).toBe(307);

      const emptyBearerReq = new NextRequest(`${BASE_URL}/portal/projects`, {
        headers: { authorization: 'Bearer ' },
      });
      const emptyBearerRes = middleware(emptyBearerReq);
      expect(emptyBearerRes.status).toBe(307);
    });
  });

  describe('5. Edge Security Response Headers', () => {
    it('attaches all hardened security headers on responses', () => {
      const req = new NextRequest(`${BASE_URL}/`);
      const res = middleware(req);

      expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('on');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(res.headers.get('Strict-Transport-Security')).toBe(
        'max-age=63072000; includeSubDomains; preload',
      );
    });
  });
});
