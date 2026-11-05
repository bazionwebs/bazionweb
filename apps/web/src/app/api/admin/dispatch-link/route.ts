import { NextResponse } from 'next/server';
import { sendClaimLinkEmail, sendMagicLinkEmail } from '@/lib/email';
import { getTrustedSiteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, url, clientName, type } = body ?? {};

    if (!to || typeof to !== 'string' || !to.includes('@') || !url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Valid recipient email address and link URL are required.' },
        { status: 400 },
      );
    }

    const cleanEmail = to.trim().toLowerCase();
    const isClaim = type === 'claim' || url.includes('/claim');

    // Ensure the dispatched email link matches the current active environment's origin
    const origin = getTrustedSiteOrigin();
    let normalizedUrl = url;
    try {
      const parsed = new URL(url);
      normalizedUrl = `${origin}${parsed.pathname}${parsed.search}`;
    } catch {
      normalizedUrl = url;
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
  } catch (err: any) {
    console.error('[Admin Dispatch Link API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to dispatch email' },
      { status: 500 },
    );
  }
}
