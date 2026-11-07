import { NextResponse } from 'next/server';
import { isEmailTransportConfigured, sendMagicLinkEmail } from '@/lib/email';
import {
  fetchInternalApi,
  resolveApiBase,
  resolveInternalDispatchSecret,
} from '@/lib/api-base';
import { getTrustedSiteOrigin } from '@/lib/site-origin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sanitizeRedirectPath } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Magic-link sign-in request.
 *
 * Supports dual delivery so production never silently drops sign-in emails:
 *   1. Direct API dispatch: if `bazionweb-api` has RESEND_API_KEY / SMTP_*
 *      configured, `POST /api/v1/auth/magic-link` mints the single-use token
 *      and dispatches the email directly without requiring a shared BFF secret.
 *   2. Web BFF dispatch: if email credentials live on `bazionweb-web`, the BFF
 *      authenticates with `x-internal-dispatch` and sends via `sendMagicLinkEmail`.
 *   3. Honest error reporting: if neither service has working email delivery in
 *      production (`delivered === false`), returns HTTP 503 instead of claiming
 *      the email was sent.
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

    const { email, redirect } = await req.json();
    const safeRedirect = sanitizeRedirectPath(redirect);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const apiBaseUrl = resolveApiBase();
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Auth backend not configured' }, { status: 503 });
    }

    const dispatchSecret = resolveInternalDispatchSecret();

    const upstream = await fetchInternalApi('/api/v1/auth/magic-link', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dispatchSecret ? { 'x-internal-dispatch': dispatchSecret } : {}),
      },
      body: JSON.stringify({
        email: cleanEmail,
        ...(safeRedirect ? { redirect: safeRedirect } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Could not process the sign-in request right now. Please try again shortly.' },
        { status: upstream.status },
      );
    }

    const envelope = await upstream.json().catch(() => ({}));
    const payload = envelope?.data ?? envelope;
    const magicToken = typeof payload?.magicToken === 'string' ? payload.magicToken : '';
    const apiDispatched = Boolean(payload?.emailDispatched);
    const apiDelivered = Boolean(payload?.delivered);

    // 1. If the NestJS API already dispatched & delivered the email directly, return immediately.
    if (apiDispatched && apiDelivered) {
      return NextResponse.json({
        success: true,
        delivered: true,
        provider: payload?.provider || 'api-mail',
        message: `If that email has an account, a sign-in link is on its way.`,
      });
    }

    const webMailConfigured = isEmailTransportConfigured();
    const isProd = process.env.NODE_ENV === 'production';

    // 2. If API tried to send and failed, try web mailer only if web has credentials & a token.
    if (apiDispatched && !apiDelivered && (!magicToken || !webMailConfigured)) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            'Email provider rejected sign-in link delivery. Please sign in with your password instead.',
          code: 'EMAIL_NOT_DELIVERED',
          delivered: false,
        },
        { status: 503 },
      );
    }

    // 3. No token returned and API did not self-dispatch.
    if (!magicToken) {
      // If we are in production and NEITHER API mail is configured NOR web has both
      // a dispatch secret + email transport, surface the configuration gap honestly
      // instead of pretending an email was sent.
      if (isProd && (!dispatchSecret || !webMailConfigured)) {
        console.error(
          '[Magic Link] Sign-in email could not be sent: configure RESEND_API_KEY (or SMTP_HOST/SMTP_USER/SMTP_PASS) on bazionweb-api, or set INTERNAL_DISPATCH_SECRET + RESEND_API_KEY on both web and api.',
        );
        return NextResponse.json(
          {
            error:
              'Passwordless email delivery is not configured yet on this server. Please use "Sign in to complete payment" (password sign-in) instead.',
            code: 'EMAIL_NOT_CONFIGURED',
            delivered: false,
          },
          { status: 503 },
        );
      }

      // Dispatch secret + web mailer ARE configured, so an empty token genuinely means
      // unknown/unclaimed email — reply identically (no enumeration).
      return NextResponse.json({
        success: true,
        delivered: true,
        message: `If that email has an account, a sign-in link is on its way.`,
      });
    }

    const origin = getTrustedSiteOrigin();
    const verifyParams = new URLSearchParams({ token: magicToken });
    if (safeRedirect) {
      verifyParams.set('redirect', safeRedirect);
    }
    const magicLinkUrl = `${origin}/portal/login/verify?${verifyParams.toString()}`;

    const sendResult = await sendMagicLinkEmail({
      to: cleanEmail,
      magicLinkUrl,
    });

    if (!sendResult.delivered && isProd) {
      console.error(`[Magic Link] Delivery failed for ${cleanEmail}:`, sendResult.message);
      return NextResponse.json(
        {
          error:
            sendResult.message ||
            'Email delivery is not configured yet on this server. Please sign in with your password instead.',
          code: 'EMAIL_NOT_DELIVERED',
          delivered: false,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      delivered: sendResult.delivered,
      provider: sendResult.provider,
      ...(process.env.NODE_ENV === 'development' && !sendResult.delivered
        ? { previewUrl: magicLinkUrl }
        : {}),
      message: sendResult.delivered
        ? `A secure sign-in link has been delivered to ${cleanEmail}.`
        : sendResult.message || `Sign-in link generated for ${cleanEmail}.`,
    });
  } catch (error: unknown) {
    console.error('Magic link dispatch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate sign-in link' },
      { status: 500 },
    );
  }
}
