import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import provisionProductRequestV1JsonSchema from "./contracts/provision-product-request-v1.schema.json";

export interface ProvisionProductRequestV1 {
  schemaVersion: "1.0.0";
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  source: "bazionweb";
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

export type ProvisioningContractIssue = { path: string; keyword: string };
export type ProvisioningContractResult =
  | { valid: true; value: ProvisionProductRequestV1 }
  | { valid: false; issues: ProvisioningContractIssue[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(provisionProductRequestV1JsonSchema);

export function validateProvisionProductRequestV1(value: unknown): ProvisioningContractResult {
  if (validate(value)) return { valid: true, value: value as ProvisionProductRequestV1 };
  return {
    valid: false,
    // Keep the response safe to log: never include invalid values or raw payload fragments.
    issues: (validate.errors ?? []).map((error) => ({
      path: error.instancePath,
      keyword: error.keyword,
    })),
  };
}