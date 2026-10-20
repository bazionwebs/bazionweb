import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Fail-closed verify proxy — no demo amounts. Requires server secret. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing transaction reference' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Payments misconfigured' }, { status: 503 });
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = await res.json();

    if (data.status && data.data.status === 'success') {
      const tx = data.data;

      // ?format=receipt — future: generate PDF. For now return JSON with receipt hint.
      const { searchParams: sp } = new URL(req.url);
      const wantReceipt = sp.get('format') === 'receipt';

      const payload = {
        success: true,
        status: tx.status,
        reference: tx.reference,
        amount: tx.amount / 100,
        currency: tx.currency,
        channel: tx.channel,
        paidAt: tx.paid_at,
        customer: tx.customer,           // { email, first_name, last_name }
        metadata: tx.metadata,           // { planSlug, phone, customer_type, source }
        ...(wantReceipt ? { receiptNote: 'PDF generation coming soon. Keep this reference for your records.' } : {}),
      };

      return NextResponse.json(payload);
    }

    return NextResponse.json(
      { success: false, message: data.message || 'Payment verification failed' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Paystack verification error:', error);
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 });
  }
}
