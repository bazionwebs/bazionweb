import { NextRequest, NextResponse } from 'next/server';

/**
 * Public routes that do not require authentication at the edge.
 */
const PUBLIC_ADMIN_PATHS = ['/admin/login'];
const PUBLIC_PORTAL_PATHS = [
  '/portal/login',
  '/portal/claim',
  '/portal/register',
  '/portal/reset-password',
];

/**
 * Recognized East African Country Codes for local currency / market routing.
 */
const EAST_AFRICAN_COUNTRIES = new Set([
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
]);

function isPublicPath(pathname: string, publicPaths: string[]): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function decodeBase64UrlToBytes(input: string): Uint8Array<ArrayBuffer> | null {
  try {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function decodeBase64UrlJson(input: string): Record<string, unknown> | null {
  const bytes = decodeBase64UrlToBytes(input);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function resolveVerificationSecrets(): string[] {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.OIDC_BFF_SESSION_SECRET,
  ];
  const secrets: string[] = [];
  for (const raw of candidates) {
    const trimmed = (raw || '').trim();
    if (trimmed.length >= 32 && !trimmed.includes('CHANGE_ME') && !secrets.includes(trimmed)) {
      secrets.push(trimmed);
    }
  }
  return secrets;
}

async function verifyHs256Jwt(token: string): Promise<boolean> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return false;

  const header = decodeBase64UrlJson(headerSeg);
  const payload = decodeBase64UrlJson(payloadSeg);
  if (!header || !payload) return false;
  if (header.alg !== 'HS256') return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    return false;
  }
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf) || payload.nbf > nowSeconds) {
      return false;
    }
  }
  if (payload.iss !== undefined) {
    const allowedIssuers = new Set(
      ['bazionweb', 'bazionweb-bff', process.env.OIDC_ISSUER].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      ),
    );
    if (typeof payload.iss !== 'string' || !allowedIssuers.has(payload.iss)) {
      return false;
    }
  }

  const secrets = resolveVerificationSecrets();
  if (secrets.length === 0 || !globalThis.crypto?.subtle) {
    return false;
  }

  const sigBytes = decodeBase64UrlToBytes(sigSeg);
  if (!sigBytes || sigBytes.length !== 32) return false;

  const signingInput = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  for (const secret of secrets) {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await globalThis.crypto.subtle.verify('HMAC', key, sigBytes, signingInput);
    if (valid) return true;
  }
  return false;
}

function extractJwtCandidates(request: NextRequest): string[] {
  const candidates: string[] = [];
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.trim().toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.trim().slice(7).trim();
    if (bearer) candidates.push(bearer);
  }

  const directCookies = [
    request.cookies.get('__Host-Http-bw_bff_session')?.value,
    request.cookies.get('bw_bff_session')?.value,
    request.cookies.get('bazionweb_session')?.value,
    request.cookies.get('bazionweb_auth_token')?.value,
    ...(request.nextUrl.pathname.startsWith('/portal')
      ? [request.cookies.get('bazionweb_sandbox_token')?.value]
      : []),
    request.cookies.get('accessToken')?.value,
    request.cookies.get('token')?.value,
  ];
  for (const val of directCookies) {
    if (val && val.trim()) candidates.push(val.trim());
  }

  const authJsonCookie = request.cookies.get('bazionweb-auth')?.value;
  if (authJsonCookie) {
    try {
      const parsed = JSON.parse(authJsonCookie) as { state?: { accessToken?: unknown } };
      if (typeof parsed?.state?.accessToken === 'string' && parsed.state.accessToken.trim()) {
        candidates.push(parsed.state.accessToken.trim());
      }
    } catch {
      // Ignore malformed JSON cookie
    }
  }

  return candidates;
}

async function hasAuthSession(request: NextRequest): Promise<boolean> {
  const candidates = extractJwtCandidates(request);
  for (const token of candidates) {
    if (await verifyHs256Jwt(token)) {
      return true;
    }
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Edge Authentication & Route Protection ────────────────────────────
  // Protect /admin routes (except /admin/login)
  if (pathname.startsWith('/admin') && !isPublicPath(pathname, PUBLIC_ADMIN_PATHS)) {
    if (!(await hasAuthSession(request))) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl, 307);
    }
  }

  // Protect /portal routes (except /portal/login, claim, register, reset-password)
  if (pathname.startsWith('/portal') && !isPublicPath(pathname, PUBLIC_PORTAL_PATHS)) {
    if (!(await hasAuthSession(request))) {
      const loginUrl = new URL('/portal/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl, 307);
    }
  }

  // ── 2. Create Base Response ──────────────────────────────────────────────
  const response = NextResponse.next();

  // ── 3. Regional Market Geo-Detection & Cookie Initialization ─────────────
  // Inspect geo-headers to set bazion_market=KE cookie for East African visitors when no cookie exists
  const existingMarket =
    request.cookies.get('bazion_market')?.value ||
    request.cookies.get('bw-market')?.value;

  if (!existingMarket) {
    const rawCountry = (
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cloudfront-viewer-country') ||
      request.headers.get('x-country-code') ||
      ''
    ).trim().toUpperCase();

    if (rawCountry && EAST_AFRICAN_COUNTRIES.has(rawCountry)) {
      response.cookies.set('bazion_market', 'KE', {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
      response.cookies.set('bw-market', 'kenya', {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  // ── 4. Edge Security Headers ─────────────────────────────────────────────
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset directories: brand, team, images, icons
     * - api routes (handled by Next.js API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|brand/|team/|images/|icons/|api/).*)',
  ],
};
