import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendMagicLinkEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function createMagicToken(email: string): string {
  const secret = process.env.JWT_SECRET || process.env.PAYSTACK_SECRET_KEY || 'bazion-magic-token-secret-2026';
  const payload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + 15 * 60 * 1000, // 15 mins
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = createMagicToken(cleanEmail);

    // Get origin
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = req.headers.get('origin') || `${proto}://${host}`;

    const magicLinkUrl = `${origin}/portal/login/verify?token=${token}`;

    const sendResult = await sendMagicLinkEmail({
      to: cleanEmail,
      magicLinkUrl,
    });

    return NextResponse.json({
      success: true,
      delivered: sendResult.delivered,
      provider: sendResult.provider,
      previewUrl: sendResult.previewUrl || magicLinkUrl,
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
