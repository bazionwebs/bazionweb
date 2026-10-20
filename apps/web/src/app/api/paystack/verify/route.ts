import { NextResponse } from 'next/server';
import { generateReceiptHtml, generateErrorReceiptHtml } from './receipt-template';

export const dynamic = 'force-dynamic';

/** Fail-closed verify proxy — returns JSON for API calls or printable HTML receipt when format=receipt */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');
  const wantReceipt = searchParams.get('format') === 'receipt';

  try {
    if (!reference) {
      if (wantReceipt) {
        return new Response(generateErrorReceiptHtml('', 'Missing transaction reference in receipt request'), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return NextResponse.json({ error: 'Missing transaction reference' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      if (wantReceipt) {
        return new Response(generateErrorReceiptHtml(reference, 'Payment gateway configuration is missing'), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return NextResponse.json({ error: 'Payments misconfigured' }, { status: 503 });
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = await res.json();

    if (data.status && data.data.status === 'success') {
      const tx = data.data;

      const payload = {
        success: true,
        status: tx.status,
        reference: tx.reference,
        amount: tx.amount / 100,
        currency: tx.currency,
        channel: tx.channel,
        paidAt: tx.paid_at,
        customer: tx.customer,
        metadata: tx.metadata,
      };

      if (wantReceipt) {
        const html = generateReceiptHtml(payload);
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }

      return NextResponse.json(payload);
    }

    if (wantReceipt) {
      return new Response(generateErrorReceiptHtml(reference, data.message || 'Payment verification failed'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json(
      { success: false, message: data.message || 'Payment verification failed' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Paystack verification error:', error);
    if (wantReceipt) {
      return new Response(generateErrorReceiptHtml(reference || '', 'An unexpected error occurred while loading your receipt.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 });
  }
}
