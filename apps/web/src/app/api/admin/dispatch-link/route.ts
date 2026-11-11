import { NextResponse } from 'next/server';
import { sendClaimLinkEmail, sendMagicLinkEmail } from '@/lib/email';
import { getTrustedSiteOrigin } from '@/lib/site-origin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { fetchInternalApi } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`admin:dispatch-link:${clientIp}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment before sending more links.' },
      { status: 429 },
    );
  }

  // Enforce staff/admin authentication — no environment-based bypass.
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin authentication token is required.' },
      { status: 401 },
    );
  }

  // Authorization is fail-closed: if the upstream JWT verification probe
  // cannot be completed, refuse to dispatch rather than assume innocence.
  try {
    const probe = await fetchInternalApi('/api/v1/clients?limit=1', {
      headers: { Authorization: authHeader },
      cache: 'no-store',
    });
    if (probe.status === 401 || probe.status === 403) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient administrative privileges.' },
        { status: 403 },
      );
    }
    if (!probe.ok && probe.status < 500) {
      return NextResponse.json(
        { error: 'Authorization could not be verified. Please sign in again.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Authorization service is temporarily unreachable. Please retry shortly.' },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { to, url, type } = body ?? {};

    // Strict recipient validation — no CRLF/control characters may reach the
    // email layer (header injection), no permissive "includes('@')" check.
    const EMAIL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62})@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,62})\.[A-Za-z]{2,14}$/;
    if (
      !to || typeof to !== 'string' || !EMAIL_RE.test(to.trim()) || /[\r\n\u0000-\u001F]/.test(to)
      || !url || typeof url !== 'string' || url.length > 1024
    ) {
      return NextResponse.json(
        { error: 'Valid recipient email address and link URL are required.' },
        { status: 400 },
      );
    }

    const cleanEmail = to.trim().toLowerCase();
    const isClaim = type === 'claim' || url.includes('/claim');

    // Strict URL destination validation against Open Redirect & SSRF
    const trustedOrigin = getTrustedSiteOrigin();
    let normalizedUrl: string;

    try {
      // If relative path, prefix with trusted origin
      if (url.startsWith('/')) {
        normalizedUrl = `${trustedOrigin}${url}`;
      } else {
        const parsed = new URL(url);
        // Only http/https allowed
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
        }
        // Force the origin to the trusted site origin to prevent external phishing links
        normalizedUrl = `${trustedOrigin}${parsed.pathname}${parsed.search}`;
      }

      // Restrict permitted path prefixes for security
      const parsedPath = new URL(normalizedUrl).pathname;
      const allowedPaths = ['/portal/', '/checkout', '/verify', '/claim'];
      if (!allowedPaths.some(p => parsedPath.startsWith(p))) {
        return NextResponse.json(
          { error: 'Destination URL path is not permitted for automated dispatch.' },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: 'Invalid link URL provided.' }, { status: 400 });
    }

    let sendResult;
    if (isClaim) {
      sendResult = await sendClaimLinkEmail({
        to: cleanEmail,
        claimLinkUrl: normalizedUrl,
      });
    } else {
      sendResult = await sendMagicLinkEmail({
        to: cleanEmail,
        magicLinkUrl: normalizedUrl,
      });
    }

    return NextResponse.json({
      success: true,
      delivered: Boolean(sendResult.delivered),
      provider: sendResult.provider,
      recipient: cleanEmail,
      message: sendResult.delivered
        ? `Link successfully dispatched via email to ${cleanEmail}`
        : sendResult.message || `Email queued for ${cleanEmail}`,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[Admin Dispatch Link API] Error:', detail);
    return NextResponse.json(
      { error: 'Failed to dispatch the link email. Please verify the recipient and try again.' },
      { status: 500 },
    );
  }
}
