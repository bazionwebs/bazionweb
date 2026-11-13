import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/utils';
import {
  BFF_EDGE_COOKIE_NAME,
  OIDC_SESSION_COOKIE_NAME,
  OIDC_TX_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  type OidcTransactionState,
  applyNoStoreHeaders,
  buildStrictCookieOptions,
  clearAllBffCookies,
  cookieNameFor,
  resolveOidcBffConfig,
  resolveSessionSecrets,
  safeStringEqual,
  sealCookiePayload,
  signBffEdgeJwt,
  unsealCookiePayload,
  verifyIdTokenWithJwks,
} from '@/lib/oidc-bff';

export const dynamic = 'force-dynamic';

function clearTxCookie(response: NextResponse, strictCookies: boolean): void {
  for (const name of [OIDC_TX_COOKIE_NAME, cookieNameFor(OIDC_TX_COOKIE_NAME, true)]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: strictCookies || name.startsWith('__Host-Http-'),
      path: '/',
      maxAge: 0,
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const config = resolveOidcBffConfig(url.origin);
  if (!config) {
    return applyNoStoreHeaders(
      NextResponse.json(
        { error: 'OIDC_UNCONFIGURED', message: 'Platform OIDC single sign-on is not configured.' },
        { status: 503 },
      ),
    );
  }

  const upstreamError = url.searchParams.get('error');
  if (upstreamError) {
    const res = NextResponse.json(
      { error: 'OIDC_AUTHORIZATION_DENIED', message: 'OIDC sign-in was cancelled or denied.' },
      { status: 401 },
    );
    clearTxCookie(res, config.strictCookies);
    return applyNoStoreHeaders(res);
  }

  const code = (url.searchParams.get('code') ?? '').trim();
  const state = (url.searchParams.get('state') ?? '').trim();
  const cookieStore = await cookies();
  const rawTx =
    cookieStore.get(cookieNameFor(OIDC_TX_COOKIE_NAME, true))?.value ??
    cookieStore.get(OIDC_TX_COOKIE_NAME)?.value ??
    '';

  const secrets = resolveSessionSecrets();
  const tx = unsealCookiePayload<OidcTransactionState>(secrets, rawTx);
  if (!tx || !code || !state || !safeStringEqual(state, tx.state)) {
    const res = NextResponse.json(
      { error: 'OIDC_CALLBACK_INVALID', message: 'Invalid or expired OIDC authorization transaction.' },
      { status: 400 },
    );
    clearTxCookie(res, config.strictCookies);
    return applyNoStoreHeaders(res);
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: tx.codeVerifier,
    });

    const tokenRes = await fetch(`${config.internalBaseUrl}/v1/oidc/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const tokenBody = (await tokenRes.json().catch(() => null)) as {
      id_token?: unknown;
      access_token?: unknown;
      expires_in?: unknown;
    } | null;

    if (!tokenRes.ok || typeof tokenBody?.id_token !== 'string' || !tokenBody.id_token) {
      const res = NextResponse.json(
        { error: 'OIDC_TOKEN_EXCHANGE_FAILED', message: 'Failed to verify authorization code with OIDC provider.' },
        { status: 401 },
      );
      clearTxCookie(res, config.strictCookies);
      return applyNoStoreHeaders(res);
    }

    const user = await verifyIdTokenWithJwks(tokenBody.id_token, config, tx.nonce, fetch);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const rawExpiresIn =
      typeof tokenBody.expires_in === 'number' && Number.isFinite(tokenBody.expires_in)
        ? Math.max(300, Math.min(SESSION_TTL_SECONDS, Math.floor(tokenBody.expires_in)))
        : SESSION_TTL_SECONDS;
    const exp = nowSeconds + rawExpiresIn;

    const sealedSession = sealCookiePayload(config.sessionSecret, {
      user,
      iat: nowSeconds,
      exp,
    });
    const edgeJwt = signBffEdgeJwt(config.sessionSecret, user, rawExpiresIn);
    const safeTarget = sanitizeRedirectPath(tx.redirectTo) ?? '/portal';

    const response = NextResponse.redirect(new URL(safeTarget, config.appOrigin).toString(), 302);
    clearTxCookie(response, config.strictCookies);
    response.cookies.set(
      cookieNameFor(OIDC_SESSION_COOKIE_NAME, config.strictCookies),
      sealedSession,
      buildStrictCookieOptions(rawExpiresIn, config.strictCookies),
    );
    response.cookies.set(
      cookieNameFor(BFF_EDGE_COOKIE_NAME, config.strictCookies),
      edgeJwt,
      buildStrictCookieOptions(rawExpiresIn, config.strictCookies),
    );

    return applyNoStoreHeaders(response);
  } catch {
    const res = NextResponse.json(
      { error: 'OIDC_VERIFICATION_FAILED', message: 'OIDC identity verification failed.' },
      { status: 401 },
    );
    clearAllBffCookies(res, config.strictCookies);
    return applyNoStoreHeaders(res);
  }
}

