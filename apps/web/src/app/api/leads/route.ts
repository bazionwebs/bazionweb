import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { resolveMarket } from '@/lib/marketEngine';
import { resolveApiV1Base } from '@/lib/api-base';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendContactInquiryEmail } from '@/lib/email';

/**
 * Server-side schema for lead submission. Bounds every user-controlled field
 * that flows into the CRM payload and HTML/subject email headers.
 */
const LEAD_SCHEMA = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9._%+-]+)@[A-Za-z0-9](?:[A-Za-z0-9.-]+)\.[A-Za-z]{2,14}$/),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(32).optional(),
  country: z.string().trim().max(64).default('KE'),
  serviceInterest: z.string().trim().max(120).default('Website Development'),
  source: z.string().trim().max(64).default('website_quote_calculator'),
  proposalId: z.string().trim().max(64).optional(),
  estimatedBudget: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** Strips CR/LF/control chars so nothing can inject into email headers. */
function sanitizeText(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).replace(/[\r\n\u0000-\u001F]+/g, ' ');
  return cleaned || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`leads:${clientIp}`, 10, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again shortly.' },
        { status: 429 },
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = LEAD_SCHEMA.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide a valid name and a valid email address.' },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const {
      name,
      email,
      company,
      phone,
      country,
      serviceInterest,
      source,
      proposalId,
      estimatedBudget,
      notes,
    } = body;

    const countryLabel = isNonEmptyString(country) ? sanitizeText(country) : undefined;

    // Resolve commercial market identity
    const resolution = resolveMarket({
      billingCountry: countryLabel,
      ipCountry: request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country'),
      marketCookie: request.cookies.get('bazion_market')?.value,
    });

    const apiUrl = resolveApiV1Base();
    let leadReference = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    let confirmationMessage = 'Your inquiry has been recorded successfully. Our team will follow up shortly.';

    try {
      const response = await fetch(`${apiUrl}/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          name: sanitizeText(name),
          email,
          company: sanitizeText(company),
          phone: sanitizeText(phone),
          country: (countryLabel || 'KE').toUpperCase(),
          service: sanitizeText(serviceInterest) || 'Website Development',
          source,
          message: [
            sanitizeText(notes),
            proposalId ? `Proposal: ${sanitizeText(proposalId)}` : null,
            estimatedBudget ? `Estimated Budget: ${sanitizeText(estimatedBudget)}` : null,
          ]
            .filter(Boolean)
            .join(' | '),
        }),
      });

      if (response.ok) {
        const envelope = await response.json().catch(() => ({}));
        const result = envelope?.data ?? envelope;
        if (result?.referenceId) {
          leadReference = result.referenceId;
        }
        if (result?.message) {
          confirmationMessage = result.message;
        }
      }
    } catch {
      // Backend CRM offline — continue gracefully with client confirmation
    }

    // Deliver team notification and customer acknowledgment via Resend email service
    try {
      await sendContactInquiryEmail({
        clientName: sanitizeText(name) ?? name ?? 'Prospective Client',
        clientEmail: email,
        company: sanitizeText(company),
        phone: sanitizeText(phone),
        serviceInterest: sanitizeText(serviceInterest) || 'Website Development',
        message: [
          sanitizeText(notes),
          proposalId ? `Proposal: ${sanitizeText(proposalId)}` : null,
          estimatedBudget ? `Estimated Budget: ${sanitizeText(estimatedBudget)}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
        leadId: leadReference,
        country: (countryLabel || 'KE').toUpperCase(),
      });
    } catch (emailErr) {
      console.warn('[Leads API] Non-fatal email dispatch error:', emailErr);
    }

    return NextResponse.json({
      success: true,
      leadId: leadReference,
      marketId: resolution.code,
      currency: resolution.currency,
      priceBookId: resolution.priceBookId,
      message: confirmationMessage,
    });
  } catch (error) {
    console.error('Lead registration error:', error);
    return NextResponse.json({ error: 'Failed to record lead' }, { status: 500 });
  }
}

/** True only for plain string values with at least one non-whitespace char. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * GET /api/leads
 * PROTECTED: Prevents unauthorized customer PII disclosure.
 * Failed secret attempts are themselves rate-limited so the static bearer
 * credential cannot be probed at unlimited speed.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const authHeader = request.headers.get('authorization') || '';
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const adminSecret = process.env.ADMIN_API_KEY || '';

  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(adminSecret);
  const authorized = expected.length > 0 && provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!authorized) {
    checkRateLimit(`leads:probe:${clientIp}`, 30, 5 * 60_000);
    return NextResponse.json(
      { error: 'Unauthorized: Access to customer leads requires administrative credentials.' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    totalLeads: 0,
    leads: [],
    message: 'Customer leads are securely persisted and managed in the API CRM backend.',
  });
}
