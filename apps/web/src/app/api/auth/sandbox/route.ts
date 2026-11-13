import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySandboxJwt } from '@/lib/auth/sandboxJwt';

export const dynamic = 'force-dynamic';

const SANDBOX_COOKIE_NAME = 'bazionweb_sandbox_token';

export async function POST(req: Request) {
  let token = '';
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body?.token === 'string' ? body.token.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid sandbox handshake payload.' }, { status: 400 });
  }

  const verified = verifySandboxJwt(token);
  if (!verified) {
    return NextResponse.json({ error: 'Invalid or expired sandbox session token.' }, { status: 401 });
  }

  const maxAge = Math.max(60, Math.min(900, verified.exp - Math.floor(Date.now() / 1000)));
  const res = NextResponse.json({ success: true, expiresAt: verified.exp * 1000 });
  res.cookies.set(SANDBOX_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return res;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SANDBOX_COOKIE_NAME)?.value ?? '';
  const verified = verifySandboxJwt(token);
  if (!verified) {
    return NextResponse.json({ active: false }, { status: 404 });
  }

  return NextResponse.json({
    active: true,
    expiresAt: verified.exp * 1000,
    user: {
      id: verified.sub ?? '',
      email: verified.email ?? '',
      firstName: verified.given_name ?? '',
      lastName: verified.family_name ?? '',
      roles: Array.isArray(verified.realm_access?.roles) ? verified.realm_access.roles : ['CLIENT'],
      keycloakId: verified.sub ?? '',
      subscriptionStatus: verified.subscriptionStatus,
      impersonatedBy: verified.impersonatedBy,
      isSandbox: true,
    },
    sandboxMeta: {
      clientId: verified.clientId ?? '',
      clientBusinessName: verified.clientBusinessName ?? '',
      impersonatedBy: verified.impersonatedBy ?? '',
    },
  });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SANDBOX_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}

