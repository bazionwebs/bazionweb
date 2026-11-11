import { NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/email';
import {
  fetchInternalApi,
  resolveApiBase,
  resolveInternalDispatchSecret,
} from '@/lib/api-base';
import { getTrustedSiteOrigin } from '@/lib/site-origin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Self-service password recovery — step 1 dispatch.
 *
 * Token minting lives in the NestJS API (`POST /api/v1/auth/forgot-password`,
 * throttled 3/min): reset tokens are server-generated, single-use, 15-minute
 * DB-backed hashes. This Next route only asks the API for the token (the raw
 * token is never exposed to the browser) and delivers the email, mirroring
 * the magic-link flow.
 *
 * The response is ALWAYS identical whether or not an account exists and is
 * eligible — no email enumeration.
 */
export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`auth:forgot-password:${clientIp}`, 5, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again in a few minutes.' },
      { status: 429 },
    );
  }

  let cleanEmail = '';

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }
    cleanEmail = email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
  }

  try {
    const apiBaseUrl = resolveApiBase();
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Auth backend not configured' }, { status: 503 });
    }

    const dispatchSecret = resolveInternalDispatchSecret();

    const upstream = await fetchInternalApi('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dispatchSecret ? { 'x-internal-dispatch': dispatchSecret } : {}),
      },
      body: JSON.stringify({ email: cleanEmail }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (upstream.status === 429) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please wait a minute and try again.' },
        { status: 429 },
      );
    }

    if (upstream.ok) {
      const envelope = await upstream.json().catch(() => ({}));
      const payload = envelope?.data ?? envelope;
      if (payload?.emailDispatched && payload?.delivered) {
        return NextResponse.json(
          {
            success: true,
            delivered: true,
            message:
              'If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.',
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const resetToken = typeof payload?.resetToken === 'string' ? payload.resetToken : '';

      if (resetToken) {
        const resetLinkUrl = `${getTrustedSiteOrigin()}/portal/reset-password?token=${encodeURIComponent(resetToken)}`;
        const sendResult = await sendPasswordResetEmail({ to: cleanEmail, resetLinkUrl });

        if (process.env.NODE_ENV === 'development' && process.env.SHOW_DEV_TOKEN_PREVIEW === '1') {
          return NextResponse.json(
            {
              success: true,
              delivered: sendResult.delivered,
              devPreviewUrl: resetLinkUrl,
              devNotice: sendResult.delivered
                ? `Reset email dispatched to ${cleanEmail}. In local development you can also use the preview link below.`
                : sendResult.message,
            },
            { headers: { 'Cache-Control': 'no-store' } },
          );
        }
      }
    }
  } catch {
    console.error('Forgot password dispatch failed.');
  }

  return NextResponse.json(
    {
      success: true,
      message: 'If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
