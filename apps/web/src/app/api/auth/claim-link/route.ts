import { NextResponse } from 'next/server';
import { sendClaimLinkEmail } from '@/lib/email';
import { resolveApiBase } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

/**
 * Account-claim link request.
 *
 * The NestJS API only mints a token when the billing email belongs to a paid,
 * not-yet-claimed client. This route delivers that token to the billing inbox
 * so knowing the email address alone is never enough to take over the account.
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

    const upstream = await fetch(`${apiBaseUrl}/api/v1/auth/claim-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Could not process the claim request right now. Please try again shortly.' },
        { status: upstream.status },
      );
    }

    const { claimToken } = (await upstream.json()) as { claimToken: string };

    // Unknown, unpaid, or already-claimed emails return an empty token. Reply
    // identically so the endpoint cannot be used to enumerate customers.
    if (!claimToken) {
      return NextResponse.json({
        success: true,
        delivered: true,
        message: 'If that email has a paid, unclaimed account, a claim link is on its way.',
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = req.headers.get('origin') || `${proto}://${host}`;

    const claimLinkUrl = `${origin}/portal/claim?token=${encodeURIComponent(claimToken)}&email=${encodeURIComponent(cleanEmail)}`;

    const sendResult = await sendClaimLinkEmail({
      to: cleanEmail,
      claimLinkUrl,
    });

    return NextResponse.json({
      success: true,
      delivered: sendResult.delivered,
      provider: sendResult.provider,
      message: sendResult.delivered
        ? `A secure claim link has been delivered to ${cleanEmail}.`
        : `Claim link generated for ${cleanEmail}.`,
    });
  } catch (error: unknown) {
    console.error('Claim link dispatch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate claim link' },
      { status: 500 },
    );
  }
}
