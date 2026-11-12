import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  signCommercialCommandToken,
} from './provisioning-crypto';

export interface PlatformReleaseReference {
  id: string;
  version: string;
}

export interface PlatformProvisioningCatalogBinding {
  offer: PlatformReleaseReference;
  composition: {
    product: PlatformReleaseReference;
    solution: PlatformReleaseReference;
    template: PlatformReleaseReference;
  };
  requiredModules: PlatformReleaseReference[];
  optionalModules: PlatformReleaseReference[];
  distributionMode: 'shared-managed';
}

export interface PlatformProvisioningCatalog {
  schemaVersion: '1.0.0';
  generatedAt: string;
  bindings: PlatformProvisioningCatalogBinding[];
}

export interface PlatformProvisioningBindingSnapshot {
  schemaVersion: '1.0.0';
  catalogGeneratedAt: string;
  binding: PlatformProvisioningCatalogBinding;
}

const MAX_CATALOG_BYTES = 1_000_000;
const MAX_CACHE_SECONDS = 60;
const DEFAULT_TIMEOUT_MS = 5_000;
const idPattern = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/;

type UnknownRecord = Record<string, unknown>;
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasExactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseReleaseReference(value: unknown): PlatformReleaseReference | null {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'version'])) return null;
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) return null;
  if (typeof value.version !== 'string' || !versionPattern.test(value.version)) return null;
  return { id: value.id, version: value.version };
}

function parseModuleReferences(value: unknown, minimum: number): PlatformReleaseReference[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > 100) return null;
  const references = value.map(parseReleaseReference);
  if (references.some((reference) => reference === null)) return null;
  const result = references as PlatformReleaseReference[];
  if (new Set(result.map((reference) => reference.id)).size !== result.length) return null;
  return result;
}

function parseBinding(value: unknown): PlatformProvisioningCatalogBinding | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'offer', 'composition', 'requiredModules', 'optionalModules', 'distributionMode',
  ])) return null;
  if (value.distributionMode !== 'shared-managed' || !isRecord(value.composition)) return null;
  if (!hasExactKeys(value.composition, ['product', 'solution', 'template'])) return null;
  const offer = parseReleaseReference(value.offer);
  const product = parseReleaseReference(value.composition.product);
  const solution = parseReleaseReference(value.composition.solution);
  const template = parseReleaseReference(value.composition.template);
  const requiredModules = parseModuleReferences(value.requiredModules, 1);
  const optionalModules = parseModuleReferences(value.optionalModules, 0);
  if (!offer || !product || !solution || !template || !requiredModules || !optionalModules) return null;
  const moduleIds = [...requiredModules, ...optionalModules].map((module) => module.id);
  if (new Set(moduleIds).size !== moduleIds.length) return null;
  return {
    offer,
    composition: { product, solution, template },
    requiredModules,
    optionalModules,
    distributionMode: 'shared-managed',
  };
}

/** Strictly validate the price-free Platform catalog wire contract before pinning it to an invoice. */
export function parsePlatformProvisioningCatalog(value: unknown): PlatformProvisioningCatalog | null {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'generatedAt', 'bindings'])) return null;
  if (value.schemaVersion !== '1.0.0' || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))) {
    return null;
  }
  if (!Array.isArray(value.bindings) || value.bindings.length > 1_000) return null;
  const bindings = value.bindings.map(parseBinding);
  if (bindings.some((binding) => binding === null)) return null;
  const parsedBindings = bindings as PlatformProvisioningCatalogBinding[];
  const offerKeys = parsedBindings.map((binding) => `${binding.offer.id}@${binding.offer.version}`);
  if (new Set(offerKeys).size !== offerKeys.length) return null;
  return {
    schemaVersion: '1.0.0',
    generatedAt: value.generatedAt,
    bindings: parsedBindings,
  };
}

/** Fetch and freeze exact Platform-owned release pins when a commercial invoice is quoted. */
@Injectable()
export class PlatformProvisioningCatalogService {
  private readonly logger = new Logger(PlatformProvisioningCatalogService.name);
  private cachedCatalog: { value: PlatformProvisioningCatalog; expiresAt: number } | null = null;
  private requestInFlight: Promise<PlatformProvisioningCatalog | null> | null = null;

  constructor(private readonly config: ConfigService) {}

  async pinLineItems<T extends { productId?: string | null; platformProvisioningBinding?: unknown }>(
    lineItems: readonly T[],
  ): Promise<Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>> {
    const stripUntrustedSnapshot = (item: T) => {
      const sanitized = { ...item };
      Reflect.deleteProperty(sanitized, 'platformProvisioningBinding');
      return sanitized;
    };
    const hasOfferItems = lineItems.some((item) => typeof item.productId === 'string' && item.productId.trim());
    if (lineItems.length === 0 || !hasOfferItems) {
      return lineItems.map(stripUntrustedSnapshot) as Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>;
    }

    const catalog = await this.loadCatalog().catch(() => {
      this.logger.warn('Platform provisioning catalog is unavailable; invoice items remain unpinned.');
      return null;
    });
    if (!catalog) {
      return lineItems.map(stripUntrustedSnapshot) as Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>;
    }

    return lineItems.map((item) => {
      const sanitized = stripUntrustedSnapshot(item);
      if (typeof item.productId !== 'string') return sanitized;
      const matchingBindings = catalog.bindings.filter((candidate) => candidate.offer.id === item.productId);
      // Checkout products currently carry an offer ID, not a version. Pin only
      // when the Platform catalog has one unambiguous active version.
      if (matchingBindings.length !== 1) return sanitized;
      const binding = matchingBindings[0];
      const snapshot: PlatformProvisioningBindingSnapshot = {
        schemaVersion: '1.0.0',
        catalogGeneratedAt: catalog.generatedAt,
        binding,
      };
      return { ...sanitized, platformProvisioningBinding: snapshot };
    }) as Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>;
  }

  private async loadCatalog(): Promise<PlatformProvisioningCatalog | null> {
    const now = Date.now();
    if (this.cachedCatalog && this.cachedCatalog.expiresAt > now) return this.cachedCatalog.value;
    if (this.requestInFlight) return this.requestInFlight;
    const request = this.fetchCatalog();
    this.requestInFlight = request;
    try {
      return await request;
    } finally {
      if (this.requestInFlight === request) this.requestInFlight = null;
    }
  }

  private async fetchCatalog(): Promise<PlatformProvisioningCatalog | null> {
    const baseUrl = (this.config.get<string>('PLATFORM_API_BASE_URL') ?? '').trim().replace(/\/+$/, '');
    const secret = (this.config.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!baseUrl || secret.length < 32) return null;

    const url = new URL(baseUrl);
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (
      !['http:', 'https:'].includes(url.protocol)
      || (isProduction && url.protocol !== 'https:' && !isLoopback)
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      throw new Error('PLATFORM_CATALOG_CONFIGURATION_INVALID');
    }
    const issuer = this.config.get<string>('PLATFORM_PROVISIONING_COMMAND_ISSUER') ?? DEFAULT_COMMAND_ISSUER;
    const audience = this.config.get<string>('PLATFORM_PROVISIONING_COMMAND_AUDIENCE') ?? DEFAULT_COMMAND_AUDIENCE;
    const token = signCommercialCommandToken({
      subject: 'bazionweb-checkout',
      issuer,
      audience,
      scopes: ['commercial:provisioning:read'],
      ttlSeconds: 120,
    }, secret);
    const response = await fetch(`${baseUrl}/v1/internal/commercial/provisioning-catalog`, {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error('PLATFORM_CATALOG_HTTP_ERROR');
    const declaredBytes = Number(response.headers.get('content-length') ?? 0);
    if (declaredBytes > MAX_CATALOG_BYTES) throw new Error('PLATFORM_CATALOG_TOO_LARGE');
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_CATALOG_BYTES) throw new Error('PLATFORM_CATALOG_TOO_LARGE');
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Error('PLATFORM_CATALOG_INVALID_JSON');
    }
    const catalog = parsePlatformProvisioningCatalog(body);
    if (!catalog) throw new Error('PLATFORM_CATALOG_CONTRACT_INVALID');

    const cacheControl = response.headers.get('cache-control') ?? '';
    const maxAgeMatch = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl);
    const maxAgeSeconds = Math.min(MAX_CACHE_SECONDS, Number(maxAgeMatch?.[1] ?? 0));
    if (maxAgeSeconds > 0) {
      this.cachedCatalog = { value: catalog, expiresAt: Date.now() + maxAgeSeconds * 1_000 };
    }
    return catalog;
  }
}
