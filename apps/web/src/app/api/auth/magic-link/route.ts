import { NextResponse } from 'next/server';
import { sendMagicLinkEmail } from '@/lib/email';
import { resolveApiBase } from '@/lib/api-base';

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
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const apiBaseUrl = resolveApiBase();
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Auth backend not configured' }, { status: 503 });
    }

    const upstream = await fetch(`${apiBaseUrl}/api/v1/auth/magic-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      // 429 and 5xx pass through status so the client can react appropriately.
      return NextResponse.json(
        { error: 'Could not process the sign-in request right now. Please try again shortly.' },
        { status: upstream.status },
      );
    }

    const { magicToken } = (await upstream.json()) as { magicToken: string };

    // Unknown emails return an empty token — reply identically (no enumeration).
    if (!magicToken) {
      return NextResponse.json({
        success: true,
        delivered: true,
        message: `If that email has an account, a sign-in link is on its way.`,
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = req.headers.get('origin') || `${proto}://${host}`;

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
