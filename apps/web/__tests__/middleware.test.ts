/**
 * @jest-environment node
 */
import * as crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const TEST_JWT_SECRET = 'test-middleware-jwt-signing-secret-32chars-min';

function signTestJwt(payloadOverrides: Record<string, unknown> = {}, secret = TEST_JWT_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-123',
      iss: 'bazionweb',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payloadOverrides,
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

describe('Edge Middleware (SEC-05)', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  describe('Route Protection (/admin/* and /portal/*)', () => {
    it('redirects unauthenticated access on /admin to /admin/login with HTTP 307', async () => {
      const req = new NextRequest('http://localhost:3000/admin/dashboard');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/login?next=%2Fadmin%2Fdashboard');
    });

    it('allows unauthenticated access to /admin/login', async () => {
      const req = new NextRequest('http://localhost:3000/admin/login');
      const res = await middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects unauthenticated access on /portal to /portal/login with HTTP 307', async () => {
      const req = new NextRequest('http://localhost:3000/portal/invoices');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/portal/login?next=%2Fportal%2Finvoices');
    });

    it('allows unauthenticated access to public portal routes (/portal/login, /portal/claim, /portal/register, /portal/reset-password)', async () => {
      const publicRoutes = [
        'http://localhost:3000/portal/login',
        'http://localhost:3000/portal/claim',
        'http://localhost:3000/portal/register',
        'http://localhost:3000/portal/reset-password',
      ];

      for (const url of publicRoutes) {
        const req = new NextRequest(url);
        const res = await middleware(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    it('allows authenticated users through to protected /admin and /portal routes when signed HS256 auth cookie is present', async () => {
      const adminToken = signTestJwt({ sub: 'admin-1', realm_access: { roles: ['ADMIN'] } });
      const adminReq = new NextRequest('http://localhost:3000/admin/clients', {
        headers: {
          cookie: `bazionweb_session=${adminToken}`,
        },
      });
      const adminRes = await middleware(adminReq);
      expect(adminRes.status).toBe(200);
      expect(adminRes.headers.get('location')).toBeNull();

      const portalToken = signTestJwt({ sub: 'client-1', realm_access: { roles: ['CLIENT'] } });
      const portalReq = new NextRequest('http://localhost:3000/portal/dashboard', {
        headers: {
          cookie: `bazionweb-auth=${JSON.stringify({ state: { accessToken: portalToken } })}`,
        },
      });
      const portalRes = await middleware(portalReq);
      expect(portalRes.status).toBe(200);
      expect(portalRes.headers.get('location')).toBeNull();
    });

    it('rejects trivial, unsigned, expired, or forged auth cookies and redirects with HTTP 307', async () => {
      const forgedJwt = signTestJwt({}, 'wrong-signing-secret-must-fail-32chars');
      const expiredJwt = signTestJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
      for (const badCookie of [
        'bazionweb_session=short',
        'bazionweb_session=admin_session_token_123',
        `bazionweb_session=${forgedJwt}`,
        `bazionweb_session=${expiredJwt}`,
      ]) {
        const badReq = new NextRequest('http://localhost:3000/admin/dashboard', {
          headers: { cookie: badCookie },
        });
        const res = await middleware(badReq);
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/admin/login?next=%2Fadmin%2Fdashboard');
      }
    });

    it('rejects sandbox cookie on /admin routes while permitting signed sandbox cookie on /portal routes', async () => {
      const sandboxJwt = signTestJwt({ sub: 'client-1', isSandbox: true, realm_access: { roles: ['CLIENT'] } });

      const adminReq = new NextRequest('http://localhost:3000/admin/clients', {
        headers: { cookie: `bazionweb_sandbox_token=${sandboxJwt}` },
      });
      const adminRes = await middleware(adminReq);
      expect(adminRes.status).toBe(307);

      const portalReq = new NextRequest('http://localhost:3000/portal/invoices', {
        headers: { cookie: `bazionweb_sandbox_token=${sandboxJwt}` },
      });
      const portalRes = await middleware(portalReq);
      expect(portalRes.status).toBe(200);
    });
  });

  describe('Geo-Detection & Regional Market Cookie Initialization', () => {
    it('sets bazion_market=KE cookie when cf-ipcountry is an East African country (e.g. KE, UG, TZ, RW) and no cookie exists', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'cf-ipcountry': 'KE',
        },
      });
      const res = await middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeDefined();
      expect(marketCookie?.value).toBe('KE');
    });

    it('sets bazion_market=KE cookie when x-vercel-ip-country is UG', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'x-vercel-ip-country': 'UG',
        },
      });
      const res = await middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeDefined();
      expect(marketCookie?.value).toBe('KE');
    });

    it('does not overwrite existing bazion_market cookie', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          'cf-ipcountry': 'KE',
          cookie: 'bazion_market=US',
        },
      });
      const res = await middleware(req);

      const cookies = res.cookies.getAll();
      const marketCookie = cookies.find((c) => c.name === 'bazion_market');
      expect(marketCookie).toBeUndefined(); // No set-cookie header generated since cookie already exists
    });
  });

  describe('Security Headers', () => {
    it('emits comprehensive security headers on responses', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);

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
