import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isPlatformProvisionableProductId,
  resolveCanonicalProductId,
} from '../pricing/canonical-catalog';
import {
  validateProvisioningOfferCatalogV1,
  type CatalogReleaseReferenceV1,
  type ProvisioningBindingSnapshotV1,
  type ProvisioningOfferBindingV1,
  type ProvisioningOfferCatalogV1,
} from './provisioning-contract';
import {
  assertSafePlatformBaseUrl,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  readJsonResponseWithSizeLimit,
  signCommercialCommandToken,
} from './provisioning-crypto';

export type PlatformReleaseReference = CatalogReleaseReferenceV1;
export type PlatformProvisioningCatalogBinding = ProvisioningOfferBindingV1;
export type PlatformProvisioningCatalog = ProvisioningOfferCatalogV1;
export type PlatformProvisioningBindingSnapshot = ProvisioningBindingSnapshotV1;

const MAX_CATALOG_BYTES = 1_000_000;
const MAX_CACHE_SECONDS = 60;
const DEFAULT_TIMEOUT_MS = 5_000;

/** Strictly validate the price-free Platform catalog wire contract against the shared JSON Schema. */
export function parsePlatformProvisioningCatalog(value: unknown): PlatformProvisioningCatalog | null {
  const result = validateProvisioningOfferCatalogV1(value);
  return result.valid ? result.value : null;
}

/** Fetch and freeze exact Platform-owned release pins when a commercial invoice is quoted. */
@Injectable()
export class PlatformProvisioningCatalogService {
  private readonly logger = new Logger(PlatformProvisioningCatalogService.name);
  private cachedCatalog: { value: PlatformProvisioningCatalog; expiresAt: number } | null = null;
  private requestInFlight: Promise<PlatformProvisioningCatalog> | null = null;

  constructor(private readonly config: ConfigService) {}

  async pinLineItems<T extends { productId?: string | null; platformProvisioningBinding?: unknown }>(
    lineItems: readonly T[],
  ): Promise<Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>> {
    const stripUntrustedSnapshot = (item: T) => {
      const sanitized = { ...item };
      Reflect.deleteProperty(sanitized, 'platformProvisioningBinding');
      return sanitized;
    };
    const sanitizedItems = lineItems.map(stripUntrustedSnapshot);
    const hasProvisionableOffer = sanitizedItems.some((item) =>
      isPlatformProvisionableProductId(item.productId),
    );
    if (sanitizedItems.length === 0 || !hasProvisionableOffer) {
      return sanitizedItems as Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>;
    }

    let catalog: PlatformProvisioningCatalog;
    try {
      catalog = await this.loadCatalog();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PLATFORM_CATALOG_UNAVAILABLE';
      this.logger.error(`Platform provisioning catalog lookup failed (${code}); failing closed.`);
      throw new ServiceUnavailableException(
        `Platform provisioning catalog is unavailable (${code}). Checkout cannot proceed without verified catalog bindings.`,
      );
    }

    return sanitizedItems.map((sanitized) => {
      if (!isPlatformProvisionableProductId(sanitized.productId) || typeof sanitized.productId !== 'string') {
        return sanitized;
      }
      const canonicalOfferId = resolveCanonicalProductId(sanitized.productId);
      const matchingBindings = catalog.bindings.filter(
        (candidate) => candidate.offer.id === sanitized.productId || candidate.offer.id === canonicalOfferId,
      );
      if (matchingBindings.length === 0) {
        throw new BadGatewayException(
          `Platform provisioning catalog does not publish an active binding for offer "${canonicalOfferId}".`,
        );
      }
      if (matchingBindings.length > 1) {
        throw new ConflictException(
          `Platform provisioning catalog has ambiguous active versions (${matchingBindings.length}) for offer "${canonicalOfferId}".`,
        );
      }
      const binding = matchingBindings[0];
      const snapshot: PlatformProvisioningBindingSnapshot = {
        schemaVersion: '1.0.0',
        catalogGeneratedAt: catalog.generatedAt,
        binding,
      };
      return { ...sanitized, platformProvisioningBinding: snapshot };
    }) as Array<T & { platformProvisioningBinding?: PlatformProvisioningBindingSnapshot }>;
  }

  private async loadCatalog(): Promise<PlatformProvisioningCatalog> {
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

  private async fetchCatalog(): Promise<PlatformProvisioningCatalog> {
    const rawBaseUrl = (this.config.get<string>('PLATFORM_API_BASE_URL') ?? '').trim();
    const secret = (this.config.get<string>('PLATFORM_PROVISIONING_COMMAND_SECRET') ?? '').trim();
    if (!rawBaseUrl || secret.length < 32) {
      throw new Error('PLATFORM_CATALOG_CONFIGURATION_MISSING');
    }

    const baseUrl = assertSafePlatformBaseUrl(rawBaseUrl, {
      isProduction: this.config.get<string>('NODE_ENV') === 'production',
      errorCode: 'PLATFORM_CATALOG_CONFIGURATION_INVALID',
    });
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
    if (!response.ok) throw new Error(`PLATFORM_CATALOG_HTTP_${response.status}`);
    const body = await readJsonResponseWithSizeLimit(
      response,
      MAX_CATALOG_BYTES,
      'PLATFORM_CATALOG_TOO_LARGE',
    );
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
