/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Edge Middleware (SEC-05)', () => {
  describe('Route Protection (/admin/* and /portal/*)', () => {
    it('redirects unauthenticated access on /admin to /admin/login with HTTP 307', () => {
      const req = new NextRequest('http://localhost:3000/admin/dashboard');
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/login?next=%2Fadmin%2Fdashboard');
    });

    it('allows unauthenticated access to /admin/login', () => {
      const req = new NextRequest('http://localhost:3000/admin/login');
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects unauthenticated access on /portal to /portal/login with HTTP 307', () => {
      const req = new NextRequest('http://localhost:3000/portal/invoices');
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/portal/login?next=%2Fportal%2Finvoices');
    });

    it('allows unauthenticated access to public portal routes (/portal/login, /portal/claim, /portal/register, /portal/reset-password)', () => {
      const publicRoutes = [
        'http://localhost:3000/portal/login',
        'http://localhost:3000/portal/claim',
        'http://localhost:3000/portal/register',
        'http://localhost:3000/portal/reset-password',
      ];

      for (const url of publicRoutes) {
        const req = new NextRequest(url);
        const res = middleware(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    it('allows authenticated users through to protected /admin and /portal routes when auth cookie is present', () => {
      const adminReq = new NextRequest('http://localhost:3000/admin/clients', {
        headers: {
          cookie: 'bazionweb_session=admin_session_token_123',
        },
      });
      const adminRes = middleware(adminReq);
      expect(adminRes.status).toBe(200);
      expect(adminRes.headers.get('location')).toBeNull();

      const portalReq = new NextRequest('http://localhost:3000/portal/dashboard', {
        headers: {
          cookie: 'bazionweb-auth={"state":{"accessToken":"valid-jwt-token"}}',
        },
      });
      const portalRes = middleware(portalReq);
      expect(portalRes.status).toBe(200);
      expect(portalRes.headers.get('location')).toBeNull();
    });

    it('rejects trivial or short auth cookies (< 10 chars) and redirects with HTTP 307', () => {
      const shortCookieReq = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: 'bazionweb_session=short',
        },
      });
      const res = middleware(shortCookieReq);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/admin/login?next=%2Fadmin%2Fdashboard');
    });
  });

  describe('Geo-Detection & Regional Market Cookie Initialization', () => {
    it('sets bazion_market=KE cookie when cf-ipcountry is an East African country (e.g. KE, UG, TZ, RW) and no cookie exists', () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'cf-ipcountry': 'KE',
        },
      });
      const res = middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeDefined();
      expect(marketCookie?.value).toBe('KE');
    });

    it('sets bazion_market=KE cookie when x-vercel-ip-country is UG', () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'x-vercel-ip-country': 'UG',
        },
      });
      const res = middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeDefined();
      expect(marketCookie?.value).toBe('KE');
    });

    it('does not overwrite existing bazion_market cookie', () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'cf-ipcountry': 'KE',
          cookie: 'bazion_market=US',
        },
      });
      const res = middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeUndefined(); // No set-cookie header generated since cookie already exists
    });
  });

  describe('Security Headers', () => {
    it('emits comprehensive security headers on responses', () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = middleware(req);

      expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('on');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    });
  });
});
