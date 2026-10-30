import { NextResponse } from 'next/server';
import { sendClaimLinkEmail } from '@/lib/email';
import { resolveApiBase } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If a paid, unclaimed account exists for this email, a secure link will be sent. Check your inbox and spam folder, or contact support if it does not arrive.',
};

function getTrustedSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://bazionweb.com';
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' || (process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
      return url.origin;
    }
  } catch {
    // Fall back to the canonical production origin rather than trusting request headers.
  }
  return 'https://bazionweb.com';
}

export async function POST(req: Request) {
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
    if (!apiBaseUrl) return NextResponse.json(GENERIC_RESPONSE);

    const dispatchSecret =
      process.env.INTERNAL_DISPATCH_SECRET ||
      process.env.PAYSTACK_SECRET_KEY ||
      '';

    const upstream = await fetch(`${apiBaseUrl}/api/v1/auth/claim-link`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dispatchSecret ? { 'x-internal-dispatch': dispatchSecret } : {}),
      },
      body: JSON.stringify({ email: cleanEmail }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) return NextResponse.json(GENERIC_RESPONSE);

    const envelope = await upstream.json().catch(() => ({}));
    const payload = envelope?.data ?? envelope;
    const claimToken = typeof payload?.claimToken === 'string' ? payload.claimToken : '';

    if (claimToken) {
      const claimLinkUrl = `${getTrustedSiteOrigin()}/portal/claim?token=${encodeURIComponent(claimToken)}&email=${encodeURIComponent(cleanEmail)}`;
      const sendResult = await sendClaimLinkEmail({ to: cleanEmail, claimLinkUrl });

      if (process.env.NODE_ENV === 'development' && !sendResult.delivered) {
        return NextResponse.json(
          {
            ...GENERIC_RESPONSE,
            devPreviewUrl: claimLinkUrl,
            devNotice: sendResult.message,
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }
  } catch {
    console.error('Claim link dispatch failed.');
  }

  return NextResponse.json(GENERIC_RESPONSE, { headers: { 'Cache-Control': 'no-store' } });
}
