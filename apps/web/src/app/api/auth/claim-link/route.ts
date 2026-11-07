import { NextResponse } from 'next/server';
import { sendClaimLinkEmail, sendMagicLinkEmail } from '@/lib/email';
import {
  fetchInternalApi,
  resolveApiBase,
  resolveInternalDispatchSecret,
} from '@/lib/api-base';
import { getTrustedSiteOrigin } from '@/lib/site-origin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If a paid, unclaimed account exists for this email, a secure link will be sent. Check your inbox and spam folder, or contact support if it does not arrive.',
};

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`auth:claim-link:${clientIp}`, 15, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many account claim requests. Please try again in a few minutes.' },
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
    if (!apiBaseUrl) return NextResponse.json(GENERIC_RESPONSE);

    const dispatchSecret = resolveInternalDispatchSecret();

    const upstream = await fetchInternalApi('/api/v1/auth/claim-link', {
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
        { error: 'Too many account claim requests. Please wait a minute and try again.' },
        { status: 429 },
      );
    }

    if (!upstream.ok) return NextResponse.json(GENERIC_RESPONSE);

    const envelope = await upstream.json().catch(() => ({}));
    const payload = envelope?.data ?? envelope;
    if (payload?.emailDispatched && payload?.delivered) {
      return NextResponse.json(GENERIC_RESPONSE, { headers: { 'Cache-Control': 'no-store' } });
    }
    const claimToken = typeof payload?.claimToken === 'string' ? payload.claimToken : '';

    if (claimToken) {
      const claimLinkUrl = `${getTrustedSiteOrigin()}/portal/claim?token=${encodeURIComponent(claimToken)}&email=${encodeURIComponent(cleanEmail)}`;
      const sendResult = await sendClaimLinkEmail({ to: cleanEmail, claimLinkUrl });

      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          {
            ...GENERIC_RESPONSE,
            delivered: sendResult.delivered,
            devPreviewUrl: claimLinkUrl,
            devNotice: sendResult.delivered
              ? `Claim email dispatched to ${cleanEmail}. In local development you can also continue directly below.`
              : sendResult.message,
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json(GENERIC_RESPONSE, { headers: { 'Cache-Control': 'no-store' } });
    }

    // If no claimToken was minted, the account may already be claimed (password set).
    // Dispatch a one-time magic sign-in link for already-claimed accounts so returning
    // payers who click "Claim Account" can enter their dashboard without hitting a loop.
    const magicUpstream = await fetchInternalApi('/api/v1/auth/magic-link', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dispatchSecret ? { 'x-internal-dispatch': dispatchSecret } : {}),
      },
      body: JSON.stringify({ email: cleanEmail }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (magicUpstream.ok) {
      const magicEnvelope = await magicUpstream.json().catch(() => ({}));
      const magicPayload = magicEnvelope?.data ?? magicEnvelope;
      if (magicPayload?.emailDispatched && magicPayload?.delivered) {
        return NextResponse.json(GENERIC_RESPONSE, { headers: { 'Cache-Control': 'no-store' } });
      }
      const magicToken = typeof magicPayload?.magicToken === 'string' ? magicPayload.magicToken : '';

      if (magicToken) {
        const magicLinkUrl = `${getTrustedSiteOrigin()}/portal/login/verify?token=${encodeURIComponent(magicToken)}`;
        const sendResult = await sendMagicLinkEmail({ to: cleanEmail, magicLinkUrl });

        if (process.env.NODE_ENV === 'development') {
          return NextResponse.json(
            {
              ...GENERIC_RESPONSE,
              alreadyClaimed: true,
              delivered: sendResult.delivered,
              devPreviewUrl: magicLinkUrl,
              devNotice: 'This account is already set up. Use the instant sign-in link below or sign in with your password.',
            },
            { headers: { 'Cache-Control': 'no-store' } },
          );
        }
      }
    }
  } catch {
    console.error('Claim link dispatch failed.');
  }

  return NextResponse.json(GENERIC_RESPONSE, { headers: { 'Cache-Control': 'no-store' } });
}
