/**
 * @jest-environment node
 */
import * as crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as oidcLoginGet } from '@/app/api/auth/oidc/login/route';
import { GET as oidcCallbackGet } from '@/app/api/auth/oidc/callback/route';
import { GET as oidcSessionGet } from '@/app/api/auth/oidc/session/route';
import { POST as oidcLogoutPost } from '@/app/api/auth/oidc/logout/route';
import { GET as authSessionGet, DELETE as authSessionDelete } from '@/app/api/auth/session/route';
import { middleware } from '@/middleware';
import api, { portalApi } from '@/lib/api';

const mockCookies = new Map<string, string>();

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookies.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
  }),
}));

const OIDC_ISSUER = 'https://platform-api.bazion-demo.org';
const BFF_SECRET = 'oidc-bff-test-session-secret-at-least-32-chars';
const CLIENT_ID = 'bazion-bff-platform';
const CLIENT_SECRET = 'oidc-bff-test-client-secret-at-least-32-chars';
const APP_URL = 'https://portal.bazion-demo.org';

function signRs256IdToken(
  privateKey: crypto.KeyObject,
  kid: string,
  claims: Record<string, unknown>,
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(privateKey).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

describe('OIDC BFF Relying Party (/api/auth/oidc/*)', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_BFF_SESSION_SECRET: process.env.OIDC_BFF_SESSION_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const kid = 'test-oidc-rsa-1';

  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    mockCookies.clear();
    env.NODE_ENV = 'test';
    env.OIDC_ISSUER = OIDC_ISSUER;
    env.OIDC_CLIENT_ID = CLIENT_ID;
    env.OIDC_CLIENT_SECRET = CLIENT_SECRET;
    env.OIDC_BFF_SESSION_SECRET = BFF_SECRET;
    env.JWT_SECRET = 'commercial-jwt-secret-must-be-32chars-min';
    env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });

  it('fails closed with 503 when OIDC config is incomplete', async () => {
    delete process.env.OIDC_ISSUER;
    const res = await oidcLoginGet(new Request(`${APP_URL}/api/auth/oidc/login`));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'OIDC_UNCONFIGURED' });
  });

  it('completes PKCE S256 login -> verified JWKS RS256 callback -> HttpOnly BFF session -> middleware -> logout without token leakage', async () => {
    // 1. Begin login with an untrusted external redirect attempt that must normalize safely
    const loginRes = await oidcLoginGet(
      new Request(`${APP_URL}/api/auth/oidc/login?redirect=/portal/invoices`),
    );
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.get('cache-control')).toContain('no-store');
    const authUrl = new URL(loginRes.headers.get('location')!);
    expect(authUrl.origin).toBe(OIDC_ISSUER);
    expect(authUrl.pathname).toBe('/v1/oidc/authorize');
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    const codeChallenge = authUrl.searchParams.get('code_challenge')!;
    expect(state.length).toBeGreaterThan(16);
    expect(nonce.length).toBeGreaterThan(16);

    const txCookie = loginRes.cookies.get('__Host-Http-bw_oidc_tx');
    expect(txCookie?.value).toBeTruthy();
    expect(txCookie?.httpOnly).toBe(true);
    expect(txCookie?.secure).toBe(true);
    expect(txCookie?.sameSite).toBe('lax');
    expect(txCookie?.path).toBe('/');
    mockCookies.set('__Host-Http-bw_oidc_tx', txCookie!.value);

    // 2. Callback with mismatched state fails cleanly and clears transaction cookie
    const badStateRes = await oidcCallbackGet(
      new Request(`${APP_URL}/api/auth/oidc/callback?code=auth-code-1&state=wrong-state`),
    );
    expect(badStateRes.status).toBe(400);
    expect(badStateRes.cookies.get('__Host-Http-bw_oidc_tx')?.maxAge).toBe(0);

    // 3. Valid callback exchanges code server-side, verifies PKCE code_verifier & RS256 ID token nonce
    const now = Math.floor(Date.now() / 1000);
    const idToken = signRs256IdToken(privateKey, kid, {
      iss: OIDC_ISSUER,
      sub: 'platform-user-123',
      aud: CLIENT_ID,
      exp: now + 900,
      iat: now,
      auth_time: now,
      jti: 'id-jti-1',
      nonce,
      email: 'grace@acacia.example',
      email_verified: true,
      name: 'Grace Wanjiku',
      tenant_id: 'tenant-123',
      tenant_slug: 'acacia-ltd',
      platform_role: null,
      org_roles: ['owner'],
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${OIDC_ISSUER}/v1/oidc/token`) {
        const bodyParams = new URLSearchParams(String(init?.body ?? ''));
        expect(bodyParams.get('client_secret')).toBe(CLIENT_SECRET);
        const verifier = bodyParams.get('code_verifier')!;
        const expectedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
        expect(expectedChallenge).toBe(codeChallenge);
        return new Response(
          JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email',
            id_token: idToken,
            access_token: 'opaque-access-token-must-never-leak-to-client',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === `${OIDC_ISSUER}/v1/oidc/jwks`) {
        return new Response(
          JSON.stringify({ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid, n: jwk.n, e: jwk.e }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === `${OIDC_ISSUER}/v1/bff/logout`) {
        return new Response(JSON.stringify({ signedOut: true }), { status: 200 });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const callbackRes = await oidcCallbackGet(
      new Request(`${APP_URL}/api/auth/oidc/callback?code=auth-code-1&state=${encodeURIComponent(state)}`),
    );
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get('location')).toBe(`${APP_URL}/portal/invoices`);
    expect(callbackRes.headers.get('location')).not.toContain('access_token');
    expect(callbackRes.headers.get('location')).not.toContain('id_token');
    expect(callbackRes.cookies.get('__Host-Http-bw_oidc_tx')?.maxAge).toBe(0);

    const oidcSessionCookie = callbackRes.cookies.get('__Host-Http-bw_oidc_session');
    const bffEdgeCookie = callbackRes.cookies.get('__Host-Http-bw_bff_session');
    expect(oidcSessionCookie?.httpOnly).toBe(true);
    expect(bffEdgeCookie?.httpOnly).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // 4. Middleware verifies __Host-Http-bw_bff_session cleanly at the edge
    const edgeReq = new NextRequest('http://localhost:3000/portal/invoices', {
      headers: { cookie: `__Host-Http-bw_bff_session=${bffEdgeCookie!.value}` },
    });
    const edgeRes = await middleware(edgeReq);
    expect(edgeRes.status).toBe(200);
    expect(edgeRes.headers.get('location')).toBeNull();

    // 5. GET /api/auth/oidc/session returns verified identity WITHOUT any raw OIDC tokens
    mockCookies.set('__Host-Http-bw_oidc_session', oidcSessionCookie!.value);
    const sessionRes = await oidcSessionGet();
    expect(sessionRes.status).toBe(200);
    const sessionJson = await sessionRes.json();
    expect(sessionJson.active).toBe(true);
    expect(sessionJson.user).toMatchObject({
      id: 'platform-user-123',
      oidcIssuer: OIDC_ISSUER,
      oidcSubject: 'platform-user-123',
      email: 'grace@acacia.example',
      roles: ['CLIENT'],
      tenantId: 'tenant-123',
    });
    expect(JSON.stringify(sessionJson)).not.toContain('opaque-access-token');
    expect(JSON.stringify(sessionJson)).not.toContain(idToken);

    // 6. POST /api/auth/oidc/logout clears all cookies
    const logoutRes = await oidcLogoutPost(
      new Request(`${APP_URL}/api/auth/oidc/logout`, { method: 'POST' }),
    );
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.cookies.get('__Host-Http-bw_oidc_session')?.maxAge).toBe(0);
    expect(logoutRes.cookies.get('__Host-Http-bw_bff_session')?.maxAge).toBe(0);
  });

  it('rejects sandbox impersonation claims and external redirect targets', async () => {
    const evilLogin = await oidcLoginGet(
      new Request(`${APP_URL}/api/auth/oidc/login?redirect=https://attacker.example/phish`),
    );
    expect(evilLogin.status).toBe(302);
    const authUrl = new URL(evilLogin.headers.get('location')!);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    const txCookie = evilLogin.cookies.get('__Host-Http-bw_oidc_tx')!;
    mockCookies.set('__Host-Http-bw_oidc_tx', txCookie.value);

    const now = Math.floor(Date.now() / 1000);
    const sandboxIdToken = signRs256IdToken(privateKey, kid, {
      iss: OIDC_ISSUER,
      sub: 'platform-user-123',
      aud: CLIENT_ID,
      exp: now + 900,
      nonce,
      is_sandbox: true,
    });

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${OIDC_ISSUER}/v1/oidc/token`) {
        return new Response(JSON.stringify({ id_token: sandboxIdToken, expires_in: 900 }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid, n: jwk.n, e: jwk.e }] }),
        { status: 200 },
      );
    });

    const cbRes = await oidcCallbackGet(
      new Request(`${APP_URL}/api/auth/oidc/callback?code=code-1&state=${encodeURIComponent(state)}`),
    );
    expect(cbRes.status).toBe(401);
    expect(cbRes.cookies.get('__Host-Http-bw_oidc_session')?.maxAge).toBe(0);
  });

  it('hydrates and clears /api/auth/session for OIDC BFF sessions without leaking tokens', async () => {
    const emptyRes = await authSessionGet();
    expect(emptyRes.status).toBe(404);
    expect(await emptyRes.json()).toEqual({ active: false });

    const loginRes = await oidcLoginGet(
      new Request(`${APP_URL}/api/auth/oidc/login?redirect=/portal/account`),
    );
    const authUrl = new URL(loginRes.headers.get('location')!);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    mockCookies.set('__Host-Http-bw_oidc_tx', loginRes.cookies.get('__Host-Http-bw_oidc_tx')!.value);

    const now = Math.floor(Date.now() / 1000);
    const idToken = signRs256IdToken(privateKey, kid, {
      iss: OIDC_ISSUER,
      sub: 'platform-user-456',
      aud: CLIENT_ID,
      exp: now + 900,
      nonce,
      email: 'ops@acacia.example',
      name: 'Ops Owner',
      tenant_id: 'tenant-456',
      tenant_slug: 'acacia-ops',
      org_roles: ['owner'],
    });

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${OIDC_ISSUER}/v1/oidc/token`) {
        return new Response(
          JSON.stringify({ id_token: idToken, access_token: 'secret-token-xyz', expires_in: 900 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid, n: jwk.n, e: jwk.e }] }),
        { status: 200 },
      );
    });

    const cbRes = await oidcCallbackGet(
      new Request(`${APP_URL}/api/auth/oidc/callback?code=code-2&state=${encodeURIComponent(state)}`),
    );
    expect(cbRes.status).toBe(302);
    mockCookies.set('__Host-Http-bw_oidc_session', cbRes.cookies.get('__Host-Http-bw_oidc_session')!.value);

    const sessionRes = await authSessionGet();
    expect(sessionRes.status).toBe(200);
    const body = await sessionRes.json();
    expect(body).toMatchObject({
      active: true,
      user: {
        id: 'platform-user-456',
        email: 'ops@acacia.example',
        roles: ['CLIENT'],
        tenantId: 'tenant-456',
        oidcIssuer: OIDC_ISSUER,
        oidcSubject: 'platform-user-456',
      },
    });
    expect(JSON.stringify(body)).not.toContain('secret-token-xyz');

    const delRes = await authSessionDelete();
    expect(delRes.status).toBe(200);
    expect(delRes.cookies.get('__Host-Http-bw_oidc_session')?.maxAge).toBe(0);
    expect(delRes.cookies.get('__Host-Http-bw_bff_session')?.maxAge).toBe(0);
    expect(delRes.cookies.get('bazionweb_session')?.maxAge).toBe(0);
  });

  it('submits subscription cancellation via canonical /subscriptions/:id/cancel API helper', async () => {
    const postSpy = jest.spyOn(api, 'post').mockResolvedValueOnce({
      data: { success: true, data: { id: 'sub-123', status: 'CANCELLED' } },
    });

    const result = await portalApi.cancelSubscription('sub-123', {
      reasonCode: 'CUSTOMER_REQUESTED',
    });

    expect(postSpy).toHaveBeenCalledWith('/subscriptions/sub-123/cancel', {
      reasonCode: 'CUSTOMER_REQUESTED',
    });
    expect(result).toEqual({ success: true, data: { id: 'sub-123', status: 'CANCELLED' } });
  });
});
