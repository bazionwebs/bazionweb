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

function hasAuthSession(request: NextRequest): boolean {
  // Check common session/token cookie identifiers
  const authCookie =
    request.cookies.get('bazionweb_session')?.value ||
    request.cookies.get('bazionweb-auth')?.value ||
    request.cookies.get('bazionweb_auth_token')?.value ||
    request.cookies.get('bazionweb_sandbox_token')?.value ||
    request.cookies.get('accessToken')?.value ||
    request.cookies.get('token')?.value;

  if (authCookie && authCookie.trim().length >= 10) {
    return true;
  }

  // Check Authorization header (e.g. from mobile or API clients)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.trim().toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.trim().slice(7).trim();
    if (bearerToken.length >= 10) {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Edge Authentication & Route Protection ────────────────────────────
  // Protect /admin routes (except /admin/login)
  if (pathname.startsWith('/admin') && !isPublicPath(pathname, PUBLIC_ADMIN_PATHS)) {
    if (!hasAuthSession(request)) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl, 307);
    }
  }

  // Protect /portal routes (except /portal/login, claim, register, reset-password)
  if (pathname.startsWith('/portal') && !isPublicPath(pathname, PUBLIC_PORTAL_PATHS)) {
    if (!hasAuthSession(request)) {
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
