import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPublicKey,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'node:crypto';
import type { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/utils';

export const BFF_EDGE_COOKIE_NAME = 'bw_bff_session';
export const OIDC_SESSION_COOKIE_NAME = 'bw_oidc_session';
export const OIDC_TX_COOKIE_NAME = 'bw_oidc_tx';
export const LEGACY_SESSION_COOKIE_NAME = 'bazionweb_session';

const TX_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const CLOCK_SKEW_SECONDS = 30;

export interface OidcBffConfig {
  issuer: string;
  internalBaseUrl: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  appOrigin: string;
  redirectUri: string;
  strictCookies: boolean;
}

export interface OidcTransactionState {
  codeVerifier: string;
  state: string;
  nonce: string;
  redirectTo: string;
  exp: number;
}

export interface OidcSessionUser {
  id: string;
  clientId?: string | null;
  claimRequired?: boolean;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  keycloakId: string;
  oidcIssuer: string;
  oidcSubject: string;
  tenantId: string | null;
  tenantSlug: string | null;
  platformRole: string | null;
  subscriptionStatus?: 'ACTIVE' | 'PENDING' | 'NONE';
}

export interface OidcSessionRecord {
  user: OidcSessionUser;
  iat: number;
  exp: number;
}

interface JwkRsaKey {
  kty?: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function resolveSessionSecrets(): string[] {
  const candidates = [process.env.OIDC_BFF_SESSION_SECRET, process.env.JWT_SECRET];
  const secrets: string[] = [];
  for (const raw of candidates) {
    const trimmed = (raw || '').trim();
    if (trimmed.length >= 32 && !trimmed.includes('CHANGE_ME') && !secrets.includes(trimmed)) {
      secrets.push(trimmed);
    }
  }
  return secrets;
}

export function resolveOidcBffConfig(requestUrl?: string): OidcBffConfig | null {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const issuer = normalizeOrigin(process.env.OIDC_ISSUER);
  if (!issuer) return null;
  if (nodeEnv === 'production' && !issuer.startsWith('https://')) {
    return null;
  }

  const internalBaseUrl = normalizeOrigin(process.env.OIDC_API_INTERNAL_URL) ?? issuer;
  const clientId = (
    process.env.OIDC_CLIENT_ID ||
    process.env.OIDC_BFF_CLIENT_ID ||
    'bazion-bff-platform'
  ).trim();
  const clientSecret = (
    process.env.OIDC_CLIENT_SECRET ||
    process.env.OIDC_BFF_CLIENT_SECRET ||
    ''
  ).trim();

  if (!clientId || !clientSecret || (nodeEnv === 'production' && /CHANGE_ME|dev-only/i.test(clientSecret))) {
    return null;
  }

  const secrets = resolveSessionSecrets();
  const sessionSecret = secrets[0] ?? '';
  if (!sessionSecret) return null;

  const requestOrigin = requestUrl ? normalizeOrigin(requestUrl) : null;
  const appOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.FRONTEND_URL) ??
    requestOrigin;
  if (!appOrigin) return null;
  if (nodeEnv === 'production' && !appOrigin.startsWith('https://')) {
    return null;
  }

  const strictCookies = nodeEnv === 'production' || appOrigin.startsWith('https://');
  return {
    issuer,
    internalBaseUrl,
    clientId,
    clientSecret,
    sessionSecret,
    appOrigin,
    redirectUri: `${appOrigin}/api/auth/oidc/callback`,
    strictCookies,
  };
}

export function cookieNameFor(baseName: string, strictCookies: boolean): string {
  return strictCookies ? `__Host-Http-${baseName}` : baseName;
}

export function buildStrictCookieOptions(maxAgeSeconds: number, strictCookies: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: strictCookies,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function deriveSealingKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from('bazionweb:oidc-bff:v1', 'utf8'), Buffer.from('aes-256-gcm', 'utf8'), 32),
  );
}

export function sealCookiePayload(secret: string, payload: unknown): string {
  const key = deriveSealingKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

export function unsealCookiePayload<T extends { exp?: number }>(secrets: readonly string[], token: string | undefined | null): T | null {
  if (!token) return null;
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, ivSeg, ctSeg, tagSeg] = parts;
  if (!ivSeg || !ctSeg || !tagSeg) return null;

  let iv: Buffer;
  let ct: Buffer;
  let tag: Buffer;
  try {
    iv = Buffer.from(ivSeg, 'base64url');
    ct = Buffer.from(ctSeg, 'base64url');
    tag = Buffer.from(tagSeg, 'base64url');
  } catch {
    return null;
  }
  if (iv.length !== 12 || tag.length !== 16) return null;

  for (const secret of secrets) {
    try {
      const key = deriveSealingKey(secret);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
      const parsed = JSON.parse(decrypted) as T;
      if (typeof parsed.exp === 'number' && parsed.exp <= Math.floor(Date.now() / 1000)) {
        return null;
      }
      return parsed;
    } catch {
      // Try next verification key during key rotation
    }
  }
  return null;
}

export function signBffEdgeJwt(secret: string, user: OidcSessionUser, ttlSeconds = SESSION_TTL_SECONDS): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'bazionweb-bff',
      sub: user.id,
      ...(user.clientId ? { clientId: user.clientId } : {}),
      ...(typeof user.claimRequired === 'boolean' ? { claimRequired: user.claimRequired } : {}),
      oidcIss: user.oidcIssuer,
      oidcSub: user.oidcSubject,
      email: user.email,
      given_name: user.firstName,
      family_name: user.lastName,
      realm_access: { roles: user.roles },
      tenant_id: user.tenantId,
      tenant_slug: user.tenantSlug,
      platform_role: user.platformRole,
      subscriptionStatus: user.subscriptionStatus ?? 'ACTIVE',
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifyBffEdgeJwt(token: string): {
  exp: number;
  iss?: string;
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  subscriptionStatus?: 'ACTIVE' | 'PENDING' | 'NONE';
} | null {
  const secrets = resolveSessionSecrets();
  if (secrets.length === 0) return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;

  try {
    const header = JSON.parse(Buffer.from(headerSeg, 'base64url').toString('utf8')) as { alg?: string };
    const payload = JSON.parse(Buffer.from(payloadSeg, 'base64url').toString('utf8')) as {
      exp?: unknown;
      iss?: unknown;
      sub?: unknown;
      email?: unknown;
      given_name?: unknown;
      family_name?: unknown;
      realm_access?: { roles?: string[] };
      subscriptionStatus?: 'ACTIVE' | 'PENDING' | 'NONE';
    };
    if (header.alg !== 'HS256') return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (
      payload.iss !== undefined &&
      payload.iss !== 'bazionweb' &&
      payload.iss !== 'bazionweb-bff'
    ) {
      return null;
    }

    const actualSig = Buffer.from(sigSeg, 'base64url');
    for (const secret of secrets) {
      const expectedSig = createHmac('sha256', secret)
        .update(`${headerSeg}.${payloadSeg}`)
        .digest();
      if (actualSig.length === expectedSig.length && timingSafeEqual(actualSig, expectedSig)) {
        return {
          exp: payload.exp,
          ...(typeof payload.iss === 'string' ? { iss: payload.iss } : {}),
          ...(typeof payload.sub === 'string' ? { sub: payload.sub } : {}),
          ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
          ...(typeof payload.given_name === 'string' ? { given_name: payload.given_name } : {}),
          ...(typeof payload.family_name === 'string' ? { family_name: payload.family_name } : {}),
          ...(payload.realm_access ? { realm_access: payload.realm_access } : {}),
          ...(payload.subscriptionStatus ? { subscriptionStatus: payload.subscriptionStatus } : {}),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function createOidcTransaction(redirectRaw?: string | null): OidcTransactionState {
  const codeVerifier = randomBytes(32).toString('base64url');
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const redirectTo = sanitizeRedirectPath(redirectRaw) ?? '/portal';
  const exp = Math.floor(Date.now() / 1000) + TX_TTL_SECONDS;
  return { codeVerifier, state, nonce, redirectTo, exp };
}

export function computePkceS256Challenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function verifyIdTokenWithJwks(
  idToken: string,
  config: Pick<OidcBffConfig, 'issuer' | 'internalBaseUrl' | 'clientId'>,
  expectedNonce: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OidcSessionUser> {
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('OIDC_INVALID_ID_TOKEN');
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) {
    throw new Error('OIDC_INVALID_ID_TOKEN');
  }

  let header: { alg?: unknown; kid?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerSeg, 'base64url').toString('utf8')) as {
      alg?: unknown;
      kid?: unknown;
    };
    payload = JSON.parse(Buffer.from(payloadSeg, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('OIDC_INVALID_ID_TOKEN');
  }

  if (header.alg !== 'RS256') {
    throw new Error('OIDC_UNSUPPORTED_ID_TOKEN_ALG');
  }

  const jwksRes = await fetchImpl(`${config.internalBaseUrl}/v1/oidc/jwks`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!jwksRes.ok) {
    throw new Error('OIDC_JWKS_UNAVAILABLE');
  }

  const jwksJson = (await jwksRes.json().catch(() => null)) as { keys?: JwkRsaKey[] } | null;
  const keys = Array.isArray(jwksJson?.keys) ? jwksJson.keys : [];
  const matchingKey = keys.find(
    (k) =>
      k.kty === 'RSA' &&
      typeof k.n === 'string' &&
      typeof k.e === 'string' &&
      (!header.kid || k.kid === header.kid),
  );
  if (!matchingKey) {
    throw new Error('OIDC_JWKS_KEY_NOT_FOUND');
  }

  const publicKey = createPublicKey({
    key: { kty: 'RSA', n: matchingKey.n!, e: matchingKey.e! },
    format: 'jwk',
  });
  const sigValid = cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${headerSeg}.${payloadSeg}`, 'utf8'),
    publicKey,
    Buffer.from(sigSeg, 'base64url'),
  );
  if (!sigValid) {
    throw new Error('OIDC_INVALID_ID_TOKEN_SIGNATURE');
  }

  if (payload.is_sandbox === true || payload.isSandbox === true || payload.impersonatedBy) {
    throw new Error('OIDC_SANDBOX_SESSION_FORBIDDEN');
  }

  const iss = typeof payload.iss === 'string' ? payload.iss.replace(/\/+$/, '') : '';
  const expectedIss = config.issuer.replace(/\/+$/, '');
  if (!iss || iss !== expectedIss) {
    throw new Error('OIDC_INVALID_ISSUER');
  }

  const audValid =
    payload.aud === config.clientId ||
    (Array.isArray(payload.aud) && payload.aud.includes(config.clientId));
  if (!audValid) {
    throw new Error('OIDC_INVALID_AUDIENCE');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new Error('OIDC_ID_TOKEN_EXPIRED');
  }

  if (typeof payload.nonce !== 'string' || !safeStringEqual(payload.nonce, expectedNonce)) {
    throw new Error('OIDC_INVALID_NONCE');
  }

  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('OIDC_MISSING_SUBJECT');
  }

  const sub = payload.sub.trim();
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const fullName = typeof payload.name === 'string' ? payload.name.trim() : '';
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');
  const platformRole = typeof payload.platform_role === 'string' ? payload.platform_role : null;
  const orgRoles = Array.isArray(payload.org_roles)
    ? payload.org_roles.filter((r): r is string => typeof r === 'string')
    : [];
  const roles = ['CLIENT'];

  return {
    id: sub,
    email,
    firstName,
    lastName,
    roles,
    keycloakId: sub,
    oidcIssuer: expectedIss,
    oidcSubject: sub,
    tenantId: typeof payload.tenant_id === 'string' ? payload.tenant_id : null,
    tenantSlug: typeof payload.tenant_slug === 'string' ? payload.tenant_slug : null,
    platformRole,
    subscriptionStatus: 'ACTIVE',
  };
}

export function clearAllBffCookies(response: NextResponse, strictCookies: boolean): void {
  const names = [
    OIDC_TX_COOKIE_NAME,
    cookieNameFor(OIDC_TX_COOKIE_NAME, true),
    OIDC_SESSION_COOKIE_NAME,
    cookieNameFor(OIDC_SESSION_COOKIE_NAME, true),
    BFF_EDGE_COOKIE_NAME,
    cookieNameFor(BFF_EDGE_COOKIE_NAME, true),
    LEGACY_SESSION_COOKIE_NAME,
  ];
  for (const name of new Set(names)) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: strictCookies || name.startsWith('__Host-Http-'),
      path: '/',
      maxAge: 0,
    });
  }
}

export { SESSION_TTL_SECONDS, TX_TTL_SECONDS };
