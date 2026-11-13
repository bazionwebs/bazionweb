import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  BFF_EDGE_COOKIE_NAME,
  OIDC_SESSION_COOKIE_NAME,
  type OidcSessionRecord,
  applyNoStoreHeaders,
  clearAllBffCookies,
  cookieNameFor,
  resolveSessionSecrets,
  unsealCookiePayload,
  verifyBffEdgeJwt,
} from '@/lib/oidc-bff';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'bazionweb_session';

export async function POST(req: Request) {
  let token = '';
  try {
    const body = (await req.json()) as { accessToken?: unknown };
    token = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid session payload.' }, { status: 400 });
  }

  const verified = verifyBffEdgeJwt(token);
  if (!verified) {
    return NextResponse.json({ error: 'Invalid or expired access token.' }, { status: 401 });
  }

  const maxAge = Math.max(60, Math.min(86_400, verified.exp - Math.floor(Date.now() / 1000)));
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return applyNoStoreHeaders(res);
}

export async function GET() {
  const cookieStore = await cookies();
  const sealedOidc =
    cookieStore.get(cookieNameFor(OIDC_SESSION_COOKIE_NAME, true))?.value ??
    cookieStore.get(OIDC_SESSION_COOKIE_NAME)?.value ??
    '';
  const oidcSession = unsealCookiePayload<OidcSessionRecord>(resolveSessionSecrets(), sealedOidc);
  if (oidcSession) {
    return applyNoStoreHeaders(
      NextResponse.json({
        active: true,
        expiresAt: oidcSession.exp * 1000,
        user: oidcSession.user,
      }),
    );
  }

  const token =
    cookieStore.get(cookieNameFor(BFF_EDGE_COOKIE_NAME, true))?.value ??
    cookieStore.get(BFF_EDGE_COOKIE_NAME)?.value ??
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    '';
  const verified = verifyBffEdgeJwt(token);
  if (!verified) {
    return applyNoStoreHeaders(NextResponse.json({ active: false }, { status: 404 }));
  }

  return applyNoStoreHeaders(
    NextResponse.json({
      active: true,
      expiresAt: verified.exp * 1000,
      ...(verified.sub
        ? {
            user: {
              id: verified.sub,
              email: verified.email ?? '',
              firstName: verified.given_name ?? '',
              lastName: verified.family_name ?? '',
              roles: verified.realm_access?.roles ?? ['CLIENT'],
              keycloakId: verified.sub,
              ...(verified.subscriptionStatus
                ? { subscriptionStatus: verified.subscriptionStatus }
                : {}),
            },
          }
        : {}),
    }),
  );
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearAllBffCookies(res, process.env.NODE_ENV === 'production');
  return applyNoStoreHeaders(res);
}
