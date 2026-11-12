import { ConfigService } from '@nestjs/config';
import sharedFixtures from './contracts/fixtures/v1-contract-fixtures.json';
import {
  CONTRACT_COMPATIBILITY_V1,
  validateProvisionProductRequestV1,
  validateProvisioningOfferCatalogV1,
  validateProvisioningOperationV1Contract,
  validateProvisioningStatusEventV1Contract,
  validateSubscriptionLifecycleCommandV1,
  validateSubscriptionLifecycleStatusEventV1Contract,
  type ProvisioningContractResult,
} from './provisioning-contract';
import { buildProvisioningRequestsForSettledInvoice } from './provisioning-request-builder';
import { SubscriptionLifecycleOutboxService } from './subscription-lifecycle-outbox.service';

interface FixtureCase {
  name: string;
  payload: unknown;
}

interface FixtureGroup {
  valid: FixtureCase[];
  invalid: FixtureCase[];
}

const fixtures = sharedFixtures as {
  schemaVersion: string;
  provisionProductRequest: FixtureGroup;
  provisioningOfferCatalog: FixtureGroup;
  provisioningOperation: FixtureGroup;
  provisioningStatusEvent: FixtureGroup;
  subscriptionLifecycleCommand: FixtureGroup;
  subscriptionLifecycleStatusEvent: FixtureGroup;
};

describe('Bazion platform provisioning & lifecycle contract v1 (Ajv strict parity)', () => {
  it('enforces governance compatibility metadata matching platform contract', () => {
    expect(CONTRACT_COMPATIBILITY_V1).toMatchObject({
      contractName: 'bazion-commercial-platform-v1',
      currentVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      deprecationWindowDays: 90,
      upgradeIdentificationRule: {
        orderLineKeyFormat: '<orderId>:line:<index>',
        targetIdentifierField: 'installationId',
        compatibilityField: 'targetConfigurationSchemaVersion',
        mutatePinnedCompositionInPlace: false,
      },
      piiBoundaryPolicy: {
        transientCustomerFields: ['customer.displayName', 'customer.primaryContact'],
        persistedInPlatformDeliveryTables: false,
        redactedInStructuredLogs: true,
        normalizePrimaryContactOnEmission: true,
      },
    });
    expect(CONTRACT_COMPATIBILITY_V1.evolutionRules.unsupportedVersionBehavior).toContain('400');

    const baseProvisioningValid = fixtures.provisionProductRequest.valid[0]?.payload as Record<string, unknown>;
    expect(
      validateProvisionProductRequestV1({
        ...baseProvisioningValid,
        installationId: '4954ba5a-6c50-4881-a3bc-c43076c7abc8',
      }).valid,
    ).toBe(false);
    expect(
      validateProvisionProductRequestV1({
        ...baseProvisioningValid,
        targetInstallationId: '4954ba5a-6c50-4881-a3bc-c43076c7abc8',
      }).valid,
    ).toBe(false);
    expect(
      validateSubscriptionLifecycleCommandV1({
        schemaVersion: '1.0.0',
        eventId: '33333333-3333-4333-8333-333333333333',
        correlationId: '44444444-4444-4444-8444-444444444444',
        idempotencyKey: 'bazionweb:sub:sub-100:reactivate:v1',
        occurredAt: '2026-11-12T08:00:00.000Z',
        effectiveAt: '2026-11-12T08:00:00.000Z',
        source: 'bazionweb',
        action: 'reactivate',
        subscriptionId: 'sub-100',
        externalCustomerId: 'customer-1008',
        externalOrderId: 'order-2026-0042:line:0',
        installationId: '4954ba5a-6c50-4881-a3bc-c43076c7abc8',
        reasonCode: 'INVOICE_SETTLED',
        targetConfigurationSchemaVersion: '1.0.0',
      }).valid,
    ).toBe(true);
  });

  const validatorEntries: Array<[keyof Omit<typeof fixtures, 'schemaVersion'>, (v: unknown) => ProvisioningContractResult<unknown>]> = [
    ['provisionProductRequest', validateProvisionProductRequestV1],
    ['provisioningOfferCatalog', validateProvisioningOfferCatalogV1],
    ['provisioningOperation', validateProvisioningOperationV1Contract],
    ['provisioningStatusEvent', validateProvisioningStatusEventV1Contract],
    ['subscriptionLifecycleCommand', validateSubscriptionLifecycleCommandV1],
    ['subscriptionLifecycleStatusEvent', validateSubscriptionLifecycleStatusEventV1Contract],
  ];

  it.each(validatorEntries)(
    'validates all shared positive and negative fixtures for %s',
    (sectionKey, validator) => {
      const group = fixtures[sectionKey];
      expect(group.valid.length).toBeGreaterThan(0);
      expect(group.invalid.length).toBeGreaterThan(0);

      for (const sample of group.valid) {
        const result = validator(sample.payload);
        expect(result.valid).toBe(true);
      }

      for (const sample of group.invalid) {
        const result = validator(sample.payload);
        expect(result.valid).toBe(false);
      }
    },
  );

  it('normalizes mixed-case whitespace contact email before emission while wire validator stays strict', () => {
    const built = buildProvisioningRequestsForSettledInvoice({
      invoice: {
        id: 'inv-norm-1',
        invoiceNumber: 'INV-2026-0042',
        clientId: 'customer-1008',
        lineItems: [
          {
            productId: 'website-launch',
            offerId: 'website-launch',
            offerVersion: '1.0.0',
            quantity: 1,
            requestedDomain: 'HTTPS://WWW.Acacia.Example.ORG/welcome',
            platformProvisioningBinding: {
              schemaVersion: '1.0.0',
              catalogGeneratedAt: '2026-11-11T08:30:00.000Z',
              binding: {
                offer: { id: 'website-launch', version: '1.0.0' },
                composition: {
                  product: { id: 'bazion-site', version: '1.0.0' },
                  solution: { id: 'business-website', version: '1.0.0' },
                  template: { id: 'node-nextjs', version: '1.0.0' },
                },
                requiredModules: [{ id: 'website-content', version: '1.0.0' }],
                optionalModules: [{ id: 'forms-leads', version: '1.0.0' }],
                distributionMode: 'shared-managed',
              },
            },
          },
        ],
      },
      client: {
        id: 'customer-1008',
        businessName: 'Acacia Studio Ltd',
        contactName: 'Grace Wanjiku',
        email: '  ADMIN@Acacia.Example.ORG  ',
      },
      occurredAt: new Date('2026-11-11T08:30:00.000Z'),
    });

    expect(built).toHaveLength(1);
    expect(built[0].payload.customer.primaryContact.email).toBe('admin@acacia.example.org');
    expect(built[0].payload.requestedDomain).toBe('www.acacia.example.org');
    expect(validateProvisionProductRequestV1(built[0].payload).valid).toBe(true);
  });

  it('returns only safe validation metadata without leaking customer PII', () => {
    const validSample = fixtures.provisionProductRequest.valid[0].payload as Record<string, unknown>;
    const customer = validSample.customer as Record<string, unknown>;
    const result = validateProvisionProductRequestV1({
      ...validSample,
      customer: { ...customer, displayName: '' },
    });
    expect(result.valid).toBe(false);
    if (result.valid !== false) throw new Error('Expected invalid payload');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.issues)).not.toContain('Acacia');
  });

  it('rejects invalid outbound lifecycle commands (e.g. grace without graceEndsAt) before persistence', async () => {
    const createMock = jest.fn();
    const dbMock = {
      subscriptionLifecycleOutbox: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const service = new SubscriptionLifecycleOutboxService(
      dbMock as any,
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );

    await expect(
      service.enqueueCommand(dbMock, {
        subscriptionId: 'sub-100',
        clientId: 'customer-1008',
        externalOrderId: 'order-2026-0042:line:0',
        action: 'grace',
        reasonCode: 'RENEWAL_PAST_DUE',
        effectiveAt: new Date('2026-11-11T10:00:00.000Z'),
      }),
    ).rejects.toThrow(/PROVISIONING_LIFECYCLE_CONTRACT_VALIDATION_FAILED/);
    expect(createMock).not.toHaveBeenCalled();
  });
});
