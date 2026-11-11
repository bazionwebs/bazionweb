import {
  validateProvisionProductRequestV1,
  type ProvisionProductRequestV1,
} from './provisioning-contract';
import {
  computeProvisioningRequestFingerprint,
  deterministicUuidFromSeed,
} from './provisioning-crypto';

export interface SettledInvoiceLineSource {
  id: string;
  invoiceNumber?: string | null;
  clientId: string;
  subscriptionId?: string | null;
  lineItems?: unknown;
}

export interface SettledClientSource {
  id: string;
  businessName?: string | null;
  contactName?: string | null;
  email?: string | null;
  planId?: string | null;
  plan?: {
    id?: string | null;
    name?: string | null;
    tier?: string | null;
  } | null;
}

export interface BuiltProvisioningOutboxCommand {
  lineIndex: number;
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  externalCustomerId: string;
  externalOrderId: string;
  requestFingerprint: string;
  payload: ProvisionProductRequestV1;
}

const SLUG_NON_ALNUM = /[^a-z0-9]+/g;
const HOSTNAME_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function sanitizeExternalId(raw: string, fallbackPrefix = 'ord'): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 110);
  if (!cleaned) return fallbackPrefix;
  return /^[A-Za-z0-9]/.test(cleaned) ? cleaned : `${fallbackPrefix}-${cleaned}`;
}

function toSlug(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(SLUG_NON_ALNUM, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned) ? cleaned : fallback;
}

function resolveVersion(raw: unknown, fallback = '1.0.0'): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/i.test(trimmed) ? trimmed : fallback;
}

function safeDomain(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? '';
  return HOSTNAME_REGEX.test(normalized) ? normalized : undefined;
}

function resolveCatalogTuple(
  line: Record<string, unknown> | null,
  client: SettledClientSource,
): {
  offerId: string;
  offerVersion: string;
  product: { id: string; version: string };
  solution: { id: string; version: string };
  template: { id: string; version: string };
} {
  const tier = typeof client.plan?.tier === 'string' ? client.plan.tier.toLowerCase() : '';
  const tierOfferMap: Record<string, string> = {
    starter: 'website-launch',
    growth: 'website-business',
    business: 'website-business',
    professional: 'website-professional',
    enterprise: 'website-enterprise',
  };

  const explicitOffer =
    line?.offerId ??
    line?.productId ??
    tierOfferMap[tier] ??
    client.plan?.name ??
    line?.planId ??
    client.planId ??
    'website-business';

  const offerId = toSlug(explicitOffer, 'website-business');
  const offerVersion = resolveVersion(line?.offerVersion, '1.0.0');

  const isEcommerce = offerId.includes('ecommerce') || offerId.includes('shop') || offerId.includes('store');
  const isChurch = offerId.includes('church') || offerId.includes('ministry');

  const defaultProductId = isChurch
    ? 'church-ministry'
    : isEcommerce
      ? 'bazion-commerce'
      : offerId.startsWith('addon-')
        ? 'bazion-addon'
        : 'bazion-site';

  const defaultSolutionId = isChurch
    ? 'church-ministry'
    : isEcommerce
      ? 'ecommerce-storefront'
      : offerId;

  const defaultTemplateId = isChurch
    ? 'church-ministry'
    : isEcommerce
      ? 'ecommerce'
      : 'node-nextjs';

  return {
    offerId,
    offerVersion,
    product: {
      id: toSlug(line?.catalogProductId ?? line?.platformProductId, defaultProductId),
      version: resolveVersion(line?.productVersion, '1.0.0'),
    },
    solution: {
      id: toSlug(line?.solutionId, defaultSolutionId),
      version: resolveVersion(line?.solutionVersion, '1.0.0'),
    },
    template: {
      id: toSlug(line?.templateId, defaultTemplateId),
      version: resolveVersion(line?.templateVersion, '1.0.0'),
    },
  };
}

/**
 * Derive 1 validated, deterministic ProvisionProductRequestV1 outbox command per settled invoice line.
 * Never includes prices, invoice amounts, payment secrets, or credentials.
 */
export function buildProvisioningRequestsForSettledInvoice(input: {
  invoice: SettledInvoiceLineSource;
  client: SettledClientSource;
  occurredAt?: Date;
}): BuiltProvisioningOutboxCommand[] {
  const { invoice, client } = input;
  const rawLines = Array.isArray(invoice.lineItems)
    ? invoice.lineItems.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];

  const effectiveLines: Array<Record<string, unknown> | null> = rawLines.length > 0 ? rawLines : [null];
  const occurredAtIso = (input.occurredAt ?? new Date()).toISOString();

  const normalizedEmail = (client.email ?? '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('PROVISIONING_CLIENT_EMAIL_INVALID');
  }
  const displayName = (client.businessName ?? client.contactName ?? `Client ${client.id}`).trim().slice(0, 120) || 'Bazion Client';
  const contactName = (client.contactName ?? client.businessName ?? 'Account Owner').trim().slice(0, 120) || 'Account Owner';

  const orderBase = sanitizeExternalId(invoice.invoiceNumber ?? invoice.id, 'ord');
  const customerExternalId = sanitizeExternalId(client.id, 'cust');
  const correlationId = deterministicUuidFromSeed(`bazionweb:correlation:${invoice.id}`);

  return effectiveLines.map((line, lineIndex) => {
    const idempotencyKey = `bazionweb:order:${invoice.id}:line:${lineIndex}:v1`;
    const externalOrderId = `${orderBase}:line:${lineIndex}`;
    const eventId = deterministicUuidFromSeed(`bazionweb:event:${invoice.id}:line:${lineIndex}`);
    const compositionTuple = resolveCatalogTuple(line, client);
    const requestedDomain = safeDomain(line?.requestedDomain ?? line?.domain);

    const candidate: ProvisionProductRequestV1 = {
      schemaVersion: '1.0.0',
      eventId,
      correlationId,
      idempotencyKey,
      occurredAt: occurredAtIso,
      source: 'bazionweb',
      customer: {
        externalCustomerId: customerExternalId,
        displayName,
        primaryContact: {
          name: contactName,
          email: normalizedEmail,
        },
      },
      order: {
        externalOrderId,
        offerId: compositionTuple.offerId,
        offerVersion: compositionTuple.offerVersion,
      },
      composition: {
        product: compositionTuple.product,
        solution: compositionTuple.solution,
        template: compositionTuple.template,
      },
      ...(requestedDomain ? { requestedDomain } : {}),
    };

    const validation = validateProvisionProductRequestV1(candidate);
    if (validation.valid === false && 'issues' in validation) {
      throw new Error(
        `PROVISIONING_CONTRACT_VALIDATION_FAILED:${validation.issues.map((i) => `${i.path}:${i.keyword}`).join(',')}`,
      );
    }
    const validatedValue = (validation as { valid: true; value: ProvisionProductRequestV1 }).value;

    return {
      lineIndex,
      eventId,
      correlationId,
      idempotencyKey,
      externalCustomerId: client.id,
      externalOrderId,
      requestFingerprint: computeProvisioningRequestFingerprint(validatedValue),
      payload: validatedValue,
    };
  });
}
