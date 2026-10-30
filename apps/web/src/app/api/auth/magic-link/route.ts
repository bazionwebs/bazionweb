import { NextResponse } from 'next/server';
import { sendMagicLinkEmail } from '@/lib/email';
import { resolveApiBase } from '@/lib/api-base';
import { getTrustedSiteOrigin } from '@/lib/site-origin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Magic-link sign-in request.
 *
 * Token minting moved to the NestJS API (`POST /api/v1/auth/magic-link`):
 * tokens are server-generated, single-use, 15-minute DB-backed records —
 * no more HMAC-signed, non-revocable JSON blobs with a hardcoded fallback
 * secret. This Next route only asks the API for the token (throttled there)
 * and delivers the email, because email sending lives on this side (Resend).
 */
export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`auth:magic-link:${clientIp}`, 5, 15 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in link requests. Please try again in a few minutes.' },
        { status: 429 },
      );
    }

    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const apiBaseUrl = resolveApiBase();
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Auth backend not configured' }, { status: 503 });
    }

    const dispatchSecret =
      process.env.INTERNAL_DISPATCH_SECRET ||
      process.env.PAYSTACK_SECRET_KEY ||
      '';

    const upstream = await fetch(`${apiBaseUrl}/api/v1/auth/magic-link`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dispatchSecret ? { 'x-internal-dispatch': dispatchSecret } : {}),
      },
      body: JSON.stringify({ email: cleanEmail }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      // 429 and 5xx pass through status so the client can react appropriately.
      return NextResponse.json(
        { error: 'Could not process the sign-in request right now. Please try again shortly.' },
        { status: upstream.status },
      );
    }

    const envelope = await upstream.json().catch(() => ({}));
    const payload = envelope?.data ?? envelope;
    const magicToken = typeof payload?.magicToken === 'string' ? payload.magicToken : '';

    // Unknown emails return an empty token — reply identically (no enumeration).
    if (!magicToken) {
      return NextResponse.json({
        success: true,
        delivered: true,
        message: `If that email has an account, a sign-in link is on its way.`,
      });
    }

    const origin = getTrustedSiteOrigin();
    const magicLinkUrl = `${origin}/portal/login/verify?token=${encodeURIComponent(magicToken)}`;

    const sendResult = await sendMagicLinkEmail({
      to: cleanEmail,
      magicLinkUrl,
    });

    return NextResponse.json({
      success: true,
      delivered: sendResult.delivered,
      provider: sendResult.provider,
      message: sendResult.delivered
        ? `A secure sign-in link has been delivered to ${cleanEmail}.`
        : `Sign-in link generated for ${cleanEmail}.`,
    });
  } catch (error: unknown) {
    console.error('Magic link dispatch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate sign-in link' },
      { status: 500 },
    );
  }
}
