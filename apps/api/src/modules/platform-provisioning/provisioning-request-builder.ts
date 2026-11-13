import {
  isPlatformProvisionableProductId,
  resolveCanonicalProductId,
} from '../pricing/canonical-catalog';
import {
  validateProvisionProductRequestV1,
  validateProvisioningBindingSnapshotV1,
  type CatalogReleaseReferenceV1,
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

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function sanitizeExternalId(raw: string, fallbackPrefix = 'ord'): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 110);
  if (!cleaned) return fallbackPrefix;
  return /^[A-Za-z0-9]/.test(cleaned) ? cleaned : `${fallbackPrefix}-${cleaned}`;
}

interface PinnedCatalogTuple {
  offerId: string;
  offerVersion: string;
  product: CatalogReleaseReferenceV1;
  solution: CatalogReleaseReferenceV1;
  template: CatalogReleaseReferenceV1;
}

function resolveCatalogTuple(line: Record<string, unknown>): PinnedCatalogTuple | null {
  const requiresPin =
    isPlatformProvisionableProductId(line.productId) || line.platformProvisioningBinding !== undefined;
  if (!requiresPin) {
    return null;
  }

  const validation = validateProvisioningBindingSnapshotV1(line.platformProvisioningBinding);
  if (!validation.valid) {
    throw new Error('PROVISIONING_CATALOG_BINDING_MISSING_OR_INVALID');
  }

  const binding = validation.value.binding;
  const lineProductId = typeof line.productId === 'string' ? line.productId.trim() : '';
  const canonicalProductId = lineProductId ? resolveCanonicalProductId(lineProductId) : '';
  if (!lineProductId || (lineProductId !== binding.offer.id && canonicalProductId !== binding.offer.id)) {
    throw new Error('PROVISIONING_CATALOG_BINDING_MISSING_OR_INVALID');
  }

  return {
    offerId: binding.offer.id,
    offerVersion: binding.offer.version,
    product: binding.composition.product,
    solution: binding.composition.solution,
    template: binding.composition.template,
  };
}

function safeDomain(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? '';
  return HOSTNAME_REGEX.test(normalized) ? normalized : undefined;
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

  const effectiveLines = rawLines.flatMap((line, lineIndex) => {
    const compositionTuple = resolveCatalogTuple(line);
    return compositionTuple ? [{ line, lineIndex, compositionTuple }] : [];
  });
  if (effectiveLines.length === 0) return [];
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

  return effectiveLines.map(({ line, lineIndex, compositionTuple }) => {
    const idempotencyKey = `bazionweb:order:${invoice.id}:line:${lineIndex}:v1`;
    const externalOrderId = `${orderBase}:line:${lineIndex}`;
    const eventId = deterministicUuidFromSeed(`bazionweb:event:${invoice.id}:line:${lineIndex}`);
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
