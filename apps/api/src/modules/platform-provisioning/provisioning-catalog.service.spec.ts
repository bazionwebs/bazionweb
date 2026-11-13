import { BadGatewayException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parsePlatformProvisioningCatalog,
  PlatformProvisioningCatalogService,
} from './provisioning-catalog.service';

function catalog(overrides: Record<string, unknown> = {}): any {
  return {
    schemaVersion: '1.0.0',
    generatedAt: '2026-11-12T00:00:00.000Z',
    bindings: [
      {
        offer: { id: 'website-launch', version: '2026.1.0' },
        composition: {
          product: { id: 'bazion-site', version: '1.0.0' },
          solution: { id: 'business-website', version: '1.0.0' },
          template: { id: 'node-nextjs', version: '1.0.0' },
        },
        requiredModules: [{ id: 'website-content', version: '1.0.0' }],
        optionalModules: [],
        distributionMode: 'shared-managed',
      },
    ],
    ...overrides,
  };
}

function mockConfig(values: Record<string, string>) {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('PlatformProvisioningCatalogService', () => {
  it('validates only the strict price-free shared-managed catalog contract', () => {
    expect(parsePlatformProvisioningCatalog(catalog())?.bindings[0]?.offer.id).toBe('website-launch');
    expect(parsePlatformProvisioningCatalog({ ...catalog(), price: 100 })).toBeNull();
    expect(parsePlatformProvisioningCatalog(catalog({
      bindings: [{ ...catalog().bindings[0], distributionMode: 'dedicated' }],
    }))).toBeNull();
    expect(parsePlatformProvisioningCatalog(catalog({
      bindings: [...catalog().bindings, catalog().bindings[0]],
    }))).toBeNull();
  });

  it('pins exact catalog bindings to matching invoice products and caches by the API max-age', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => new Response(JSON.stringify(catalog()), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=60' },
    }));
    global.fetch = fetchMock as typeof fetch;
    const service = new PlatformProvisioningCatalogService(mockConfig({
      PLATFORM_API_BASE_URL: 'https://platform.example.test',
      PLATFORM_PROVISIONING_COMMAND_SECRET: 'platform-command-secret-value-long-enough',
    }));

    const first = await service.pinLineItems([
      { productId: 'website-launch' },
      { productId: 'domain-com' },
    ]);
    await service.pinLineItems([{ productId: 'website-launch' }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first[0]?.platformProvisioningBinding).toMatchObject({
      schemaVersion: '1.0.0',
      catalogGeneratedAt: '2026-11-12T00:00:00.000Z',
      binding: { offer: { id: 'website-launch', version: '2026.1.0' } },
    });
    expect(first[1]?.platformProvisioningBinding).toBeUndefined();

    const authorization = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const token = authorization.Authorization.replace(/^Bearer\s+/, '');
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
    expect(claims.scope).toBe('commercial:provisioning:read');
    expect(claims.aud).toBe('bazion-platform:commercial-provisioning');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example.test/v1/internal/commercial/provisioning-catalog');
  });

  it('strips caller-supplied snapshots and rejects ambiguous offer versions cleanly', async () => {
    const offer = catalog().bindings[0];
    const ambiguousCatalog = catalog({
      bindings: [
        offer,
        { ...offer, offer: { ...offer.offer, version: '2027.1.0' } },
      ],
    });
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => new Response(JSON.stringify(ambiguousCatalog), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=60' },
    }));
    global.fetch = fetchMock as typeof fetch;
    const service = new PlatformProvisioningCatalogService(mockConfig({
      PLATFORM_API_BASE_URL: 'https://platform.example.test',
      PLATFORM_PROVISIONING_COMMAND_SECRET: 'platform-command-secret-value-long-enough',
    }));
    const attackerSnapshot = { schemaVersion: '1.0.0', binding: { offer: { id: 'website-launch', version: 'attacker' } } };

    await expect(service.pinLineItems([
      { productId: 'website-launch', platformProvisioningBinding: attackerSnapshot },
    ])).rejects.toThrow(ConflictException);
  });

  it('requires HTTPS for production Platform catalog requests and fails closed', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    global.fetch = fetchMock as typeof fetch;
    const service = new PlatformProvisioningCatalogService(mockConfig({
      NODE_ENV: 'production',
      PLATFORM_API_BASE_URL: 'http://platform.example.test',
      PLATFORM_PROVISIONING_COMMAND_SECRET: 'platform-command-secret-value-long-enough',
    }));

    await expect(service.pinLineItems([{ productId: 'website-launch' }]))
      .rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when configuration, offer binding, or catalog contract validation fails', async () => {
    const unconfigured = new PlatformProvisioningCatalogService(mockConfig({}));
    await expect(unconfigured.pinLineItems([{ productId: 'website-launch', platformProvisioningBinding: { forged: true } }]))
      .rejects.toThrow(ServiceUnavailableException);

    const invalidFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => new Response(JSON.stringify({ ...catalog(), price: 25000 }), {
      status: 200,
      headers: { 'cache-control': 'private, max-age=60' },
    }));
    global.fetch = invalidFetch as typeof fetch;
    const configured = new PlatformProvisioningCatalogService(mockConfig({
      PLATFORM_API_BASE_URL: 'https://platform.example.test',
      PLATFORM_PROVISIONING_COMMAND_SECRET: 'platform-command-secret-value-long-enough',
    }));
    await expect(configured.pinLineItems([{ productId: 'website-launch' }])).rejects.toThrow(ServiceUnavailableException);

    const missingBindingFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => new Response(JSON.stringify(catalog()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    global.fetch = missingBindingFetch as typeof fetch;
    await expect(configured.pinLineItems([{ productId: 'website-business' }])).rejects.toThrow(BadGatewayException);
  });

  it('does not make a network call for invoices without Platform-provisionable offers', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    global.fetch = fetchMock as typeof fetch;
    const service = new PlatformProvisioningCatalogService(mockConfig({
      PLATFORM_API_BASE_URL: 'https://platform.example.test',
      PLATFORM_PROVISIONING_COMMAND_SECRET: 'platform-command-secret-value-long-enough',
    }));
    await expect(service.pinLineItems([
      { planId: 'care-plan' } as never,
      { productId: 'addon-blog-news', platformProvisioningBinding: { forged: true } },
    ])).resolves.toEqual([
      { planId: 'care-plan' },
      { productId: 'addon-blog-news' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
