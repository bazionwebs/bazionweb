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

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function sanitizeExternalId(raw: string, fallbackPrefix = 'ord'): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 110);
  if (!cleaned) return fallbackPrefix;
  return /^[A-Za-z0-9]/.test(cleaned) ? cleaned : `${fallbackPrefix}-${cleaned}`;
}

interface CatalogReleaseReference {
  id: string;
  version: string;
}

interface PinnedCatalogTuple {
  offerId: string;
  offerVersion: string;
  product: CatalogReleaseReference;
  solution: CatalogReleaseReference;
  template: CatalogReleaseReference;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseReleaseReference(value: unknown): CatalogReleaseReference | null {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'version'])) return null;
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(value.id)) return null;
  if (typeof value.version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/.test(value.version)) return null;
  return { id: value.id, version: value.version };
}

function parseCatalogReferences(value: unknown, minimum: number): CatalogReleaseReference[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > 100) return null;
  const references = value.map(parseReleaseReference);
  if (references.some((reference) => reference === null)) return null;
  const parsed = references as CatalogReleaseReference[];
  return new Set(parsed.map((reference) => reference.id)).size === parsed.length ? parsed : null;
}

function resolveCatalogTuple(line: Record<string, unknown>): PinnedCatalogTuple | null {
  const snapshot = line.platformProvisioningBinding;
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, ['schemaVersion', 'catalogGeneratedAt', 'binding'])) return null;
  if (
    snapshot.schemaVersion !== '1.0.0'
    || typeof snapshot.catalogGeneratedAt !== 'string'
    || !Number.isFinite(Date.parse(snapshot.catalogGeneratedAt))
  ) return null;

  const binding = snapshot.binding;
  if (!isRecord(binding) || !hasExactKeys(binding, [
    'offer', 'composition', 'requiredModules', 'optionalModules', 'distributionMode',
  ])) return null;
  if (binding.distributionMode !== 'shared-managed' || !isRecord(binding.composition)) return null;
  if (!hasExactKeys(binding.composition, ['product', 'solution', 'template'])) return null;

  const offer = parseReleaseReference(binding.offer);
  const product = parseReleaseReference(binding.composition.product);
  const solution = parseReleaseReference(binding.composition.solution);
  const template = parseReleaseReference(binding.composition.template);
  const requiredModules = parseCatalogReferences(binding.requiredModules, 1);
  const optionalModules = parseCatalogReferences(binding.optionalModules, 0);
  if (!offer || !product || !solution || !template || !requiredModules || !optionalModules) return null;
  if (new Set([...requiredModules, ...optionalModules].map((module) => module.id)).size !== requiredModules.length + optionalModules.length) {
    return null;
  }
  if (typeof line.productId !== 'string' || line.productId !== offer.id) return null;

  return {
    offerId: offer.id,
    offerVersion: offer.version,
    product,
    solution,
    template,
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
