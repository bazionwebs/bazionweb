import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SANDBOX_COOKIE_NAME = 'bazionweb_sandbox_token';

interface VerifiedSandboxClaims {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  subscriptionStatus?: string;
  clientId?: string;
  clientBusinessName?: string;
  impersonatedBy?: string;
  isSandbox?: boolean;
  is_sandbox?: boolean;
  exp: number;
  iss?: string;
}

function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret.length < 32 || secret.includes('CHANGE_ME')) {
    return '';
  }
  return secret;
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const raw = Buffer.from(base64, 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function verifySandboxJwt(token: string): VerifiedSandboxClaims | null {
  const secret = getJwtSecret();
  if (!secret) return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;

  const header = decodeBase64UrlJson<{ alg?: string }>(headerSeg);
  const payload = decodeBase64UrlJson<VerifiedSandboxClaims>(payloadSeg);
  if (!header || !payload || header.alg !== 'HS256') return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    return null;
  }
  if (payload.iss !== undefined && payload.iss !== 'bazionweb') {
    return null;
  }
  if (!payload.isSandbox && !payload.is_sandbox && !payload.impersonatedBy) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerSeg}.${payloadSeg}`)
    .digest();
  let actualSig: Buffer;
  try {
    let b64 = sigSeg.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    actualSig = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }

  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }
  return payload;
}

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

