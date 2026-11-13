import { NextResponse } from 'next/server';
import {
  applyNoStoreHeaders,
  clearAllBffCookies,
  resolveOidcBffConfig,
} from '@/lib/oidc-bff';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const config = resolveOidcBffConfig(url.origin);
  const strictCookies = config?.strictCookies ?? process.env.NODE_ENV === 'production';

  if (config) {
    await fetch(`${config.internalBaseUrl}/v1/bff/logout`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ signedOut: true });
  clearAllBffCookies(res, strictCookies);
  return applyNoStoreHeaders(res);
}

