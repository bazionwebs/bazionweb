import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import provisionProductRequestV1JsonSchema from './contracts/provision-product-request-v1.schema.json';
import provisioningOfferCatalogV1JsonSchema from './contracts/provisioning-offer-catalog-v1.schema.json';
import provisioningOperationV1JsonSchema from './contracts/provisioning-operation-v1.schema.json';
import provisioningStatusEventV1JsonSchema from './contracts/provisioning-status-event-v1.schema.json';
import subscriptionLifecycleCommandV1JsonSchema from './contracts/subscription-lifecycle-command-v1.schema.json';
import subscriptionLifecycleStatusEventV1JsonSchema from './contracts/subscription-lifecycle-status-event-v1.schema.json';

export const CONTRACT_COMPATIBILITY_V1 = {
  contractName: 'bazion-commercial-platform-v1',
  currentVersion: '1.0.0',
  minimumSupportedVersion: '1.0.0',
  supportedVersions: ['1.0.0'] as const,
  deprecationWindowDays: 90,
} as const;

export const PROVISIONING_OPERATION_STATUSES = [
  'accepted',
  'validating',
  'provisioning_tenant',
  'configuring_installation',
  'provisioning_hosting',
  'ready',
  'compensating',
  'compensation_required',
  'compensated',
  'failed',
] as const;

export type ProvisioningOperationStatus = (typeof PROVISIONING_OPERATION_STATUSES)[number];

export const SUBSCRIPTION_LIFECYCLE_ACTIONS = [
  'activate',
  'grace',
  'suspend',
  'reactivate',
  'cancel',
] as const;

export type SubscriptionLifecycleAction = (typeof SUBSCRIPTION_LIFECYCLE_ACTIONS)[number];

export const SUBSCRIPTION_LIFECYCLE_INSTALLATION_STATUSES = [
  'requested',
  'provisioning',
  'ready',
  'suspended',
  'failed',
  'offboarding',
  'offboarded',
] as const;

export type SubscriptionLifecycleInstallationStatus =
  (typeof SUBSCRIPTION_LIFECYCLE_INSTALLATION_STATUSES)[number];

export interface ProvisionProductRequestV1 {
  schemaVersion: '1.0.0';
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  source: 'bazionweb';
  customer: {
    externalCustomerId: string;
    displayName: string;
    primaryContact: { name: string; email: string };
  };
  order: { externalOrderId: string; offerId: string; offerVersion: string };
  composition: {
    product: { id: string; version: string };
    solution: { id: string; version: string };
    template: { id: string; version: string };
  };
  requestedDomain?: string;
}

export interface CatalogReleaseReferenceV1 {
  id: string;
  version: string;
}

export interface ProvisioningOfferBindingV1 {
  offer: CatalogReleaseReferenceV1;
  composition: {
    product: CatalogReleaseReferenceV1;
    solution: CatalogReleaseReferenceV1;
    template: CatalogReleaseReferenceV1;
  };
  requiredModules: CatalogReleaseReferenceV1[];
  optionalModules: CatalogReleaseReferenceV1[];
  distributionMode: 'shared-managed';
}

export interface ProvisioningOfferCatalogV1 {
  schemaVersion: '1.0.0';
  generatedAt: string;
  bindings: ProvisioningOfferBindingV1[];
}

export interface ProvisioningOperationV1 {
  schemaVersion: '1.0.0';
  operationId: string;
  correlationId: string;
  externalOrderId: string;
  status: ProvisioningOperationStatus;
  currentStep: string | null;
  tenantId: string | null;
  installationId: string | null;
  failure: { code: string; retryable: boolean } | null;
  updatedAt: string;
}

export interface ProvisioningStatusEventV1 {
  schemaVersion: '1.0.0';
  eventType: 'product.provisioning.status.v1';
  eventId: string;
  correlationId: string;
  occurredAt: string;
  source: 'bazion-platform';
  operation: ProvisioningOperationV1;
}

export interface SubscriptionLifecycleCommandV1 {
  schemaVersion: '1.0.0';
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  effectiveAt: string;
  source: 'bazionweb';
  action: SubscriptionLifecycleAction;
  subscriptionId: string;
  externalCustomerId: string;
  externalOrderId: string;
  installationId?: string;
  reasonCode: string;
  graceEndsAt?: string | null;
  targetConfigurationSchemaVersion?: string;
}

export interface SubscriptionLifecycleStatusEventV1 {
  schemaVersion: '1.0.0';
  eventType: 'product.subscription.lifecycle.status.v1';
  eventId: string;
  correlationId: string;
  occurredAt: string;
  source: 'bazion-platform';
  lifecycle: {
    schemaVersion: '1.0.0';
    commandId: string;
    action: SubscriptionLifecycleAction;
    subscriptionId: string;
    externalOrderId: string;
    tenantId: string | null;
    installationId: string | null;
    installationStatus: SubscriptionLifecycleInstallationStatus | null;
    applied: boolean;
    reasonCode: string;
    effectiveAt: string;
    updatedAt: string;
  };
}

export type ProvisioningContractIssue = { path: string; keyword: string };
export type ProvisioningContractResult<T = ProvisionProductRequestV1> =
  | { valid: true; value: T }
  | { valid: false; issues: ProvisioningContractIssue[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

function createContractValidator<T>(
  schema: Record<string, unknown>,
  checkCrossFieldInvariants?: (value: T) => ProvisioningContractIssue[],
): (value: unknown) => ProvisioningContractResult<T> {
  const compiled: ValidateFunction = ajv.compile(schema);
  return (value: unknown): ProvisioningContractResult<T> => {
    if (!compiled(value)) {
      return {
        valid: false,
        // Keep the response safe to log: never include invalid values or raw payload fragments.
        issues: (compiled.errors ?? []).map((error) => ({
          path: error.instancePath,
          keyword: error.keyword,
        })),
      };
    }

    const typed = value as T;
    const extraIssues = checkCrossFieldInvariants ? checkCrossFieldInvariants(typed) : [];
    if (extraIssues.length > 0) {
      return { valid: false, issues: extraIssues };
    }
    return { valid: true, value: typed };
  };
}

export const validateProvisionProductRequestV1 = createContractValidator<ProvisionProductRequestV1>(
  provisionProductRequestV1JsonSchema as Record<string, unknown>,
);

export const validateProvisioningOfferCatalogV1 = createContractValidator<ProvisioningOfferCatalogV1>(
  provisioningOfferCatalogV1JsonSchema as Record<string, unknown>,
  (catalog) => {
    const issues: ProvisioningContractIssue[] = [];
    const seenOfferVersions = new Set<string>();

    catalog.bindings.forEach((binding, bindingIndex) => {
      const offerKey = `${binding.offer.id}@${binding.offer.version}`;
      if (seenOfferVersions.has(offerKey)) {
        issues.push({ path: `/bindings/${bindingIndex}/offer`, keyword: 'uniqueOfferVersion' });
      }
      seenOfferVersions.add(offerKey);

      const seenModules = new Set<string>();
      for (const mod of [...binding.requiredModules, ...binding.optionalModules]) {
        if (seenModules.has(mod.id)) {
          issues.push({ path: `/bindings/${bindingIndex}`, keyword: 'uniqueModuleId' });
        }
        seenModules.add(mod.id);
      }
    });

    return issues;
  },
);

export const validateProvisioningOperationV1Contract = createContractValidator<ProvisioningOperationV1>(
  provisioningOperationV1JsonSchema as Record<string, unknown>,
);

export const validateProvisioningStatusEventV1Contract = createContractValidator<ProvisioningStatusEventV1>(
  provisioningStatusEventV1JsonSchema as Record<string, unknown>,
  (event) =>
    event.correlationId === event.operation.correlationId
      ? []
      : [{ path: '/operation/correlationId', keyword: 'correlationMatch' }],
);

export const validateSubscriptionLifecycleCommandV1 =
  createContractValidator<SubscriptionLifecycleCommandV1>(
    subscriptionLifecycleCommandV1JsonSchema as Record<string, unknown>,
  );

export const validateSubscriptionLifecycleStatusEventV1Contract =
  createContractValidator<SubscriptionLifecycleStatusEventV1>(
    subscriptionLifecycleStatusEventV1JsonSchema as Record<string, unknown>,
  );
