import { NextResponse } from 'next/server';
import { resolveApiV1Base } from '@/lib/api-base';
import { generateErrorReceiptHtml, generateReceiptHtml } from './receipt-template';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference')?.trim() || '';
  const wantReceipt = searchParams.get('format') === 'receipt';

  if (!reference || reference.length > 128) {
    const message = 'A valid transaction reference is required.';
    return wantReceipt
      ? new Response(generateErrorReceiptHtml(reference, message), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      : NextResponse.json({ success: false, status: 'MISSING_REFERENCE', message }, { status: 400 });
  }

  try {
    const response = await fetch(`${resolveApiV1Base()}/invoices/confirm/paystack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ reference }),
    });
    const envelope = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('Payment confirmation is temporarily unavailable.');

    const payment = envelope?.data ?? envelope;
    const receiptData = {
      reference,
      status: String(payment.status || 'UNVERIFIED'),
      amount: Number(payment.amount || 0),
      currency: String(payment.currency || 'KES'),
      channel: payment.channel,
      paidAt: payment.paidAt,
      description: payment.description,
      customer: { email: payment.email },
    };

    if (wantReceipt) {
      if (!payment.paid) {
        return new Response(generateErrorReceiptHtml(reference, 'This payment has not been confirmed for a BazionWeb invoice.'), {
          status: 409,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' },
        });
      }
      return new Response(generateReceiptHtml(receiptData), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    return NextResponse.json({
      success: payment.paid === true,
      status: receiptData.status,
      reference,
      amount: receiptData.amount,
      currency: receiptData.currency,
      channel: receiptData.channel,
      description: receiptData.description,
      paidAt: payment.paidAt,
      customerEmail: payment.email,
      invoiceNumber: payment.invoiceNumber,
      message: payment.paid ? 'Payment confirmed for your BazionWeb invoice.' : 'Payment is still processing or could not be matched to an invoice.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    const message = 'We could not confirm this payment yet. Please retry in a moment; do not pay again while the status is being checked.';
    return wantReceipt
      ? new Response(generateErrorReceiptHtml(reference, message), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      : NextResponse.json({ success: false, status: 'UNAVAILABLE', message }, { status: 503 });
  }
}
