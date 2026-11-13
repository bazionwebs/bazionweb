import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  OIDC_SESSION_COOKIE_NAME,
  type OidcSessionRecord,
  applyNoStoreHeaders,
  cookieNameFor,
  resolveSessionSecrets,
  unsealCookiePayload,
} from '@/lib/oidc-bff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const sealed =
    cookieStore.get(cookieNameFor(OIDC_SESSION_COOKIE_NAME, true))?.value ??
    cookieStore.get(OIDC_SESSION_COOKIE_NAME)?.value ??
    '';

  const secrets = resolveSessionSecrets();
  const session = unsealCookiePayload<OidcSessionRecord>(secrets, sealed);
  if (!session) {
    const res = NextResponse.json({ active: false }, { status: 401 });
    return applyNoStoreHeaders(res);
  }

  const res = NextResponse.json({
    active: true,
    expiresAt: session.exp * 1000,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles: session.user.roles,
      keycloakId: session.user.keycloakId,
      oidcIssuer: session.user.oidcIssuer,
      oidcSubject: session.user.oidcSubject,
      tenantId: session.user.tenantId,
      tenantSlug: session.user.tenantSlug,
      platformRole: session.user.platformRole,
      subscriptionStatus: session.user.subscriptionStatus ?? 'ACTIVE',
    },
  });
  return applyNoStoreHeaders(res);
}

