import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/utils';
import {
  OIDC_TX_COOKIE_NAME,
  applyNoStoreHeaders,
  buildStrictCookieOptions,
  computePkceS256Challenge,
  cookieNameFor,
  createOidcTransaction,
  resolveOidcBffConfig,
  sealCookiePayload,
  TX_TTL_SECONDS,
} from '@/lib/oidc-bff';

export const dynamic = 'force-dynamic';

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

  const rawRedirect = url.searchParams.get('redirect') ?? url.searchParams.get('next');
  const safeRedirect = sanitizeRedirectPath(rawRedirect) ?? '/portal';
  const tx = createOidcTransaction(safeRedirect);
  const codeChallenge = computePkceS256Challenge(tx.codeVerifier);

  const authorizeUrl = new URL(`${config.issuer}/v1/oidc/authorize`);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', tx.state);
  authorizeUrl.searchParams.set('nonce', tx.nonce);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const txToken = sealCookiePayload(config.sessionSecret, tx);
  const response =
    url.searchParams.get('mode') === 'json'
      ? NextResponse.json({ authorizeUrl: authorizeUrl.toString(), redirectTo: tx.redirectTo })
      : NextResponse.redirect(authorizeUrl.toString(), 302);

  response.cookies.set(
    cookieNameFor(OIDC_TX_COOKIE_NAME, config.strictCookies),
    txToken,
    buildStrictCookieOptions(TX_TTL_SECONDS, config.strictCookies),
  );

  return applyNoStoreHeaders(response);
}

