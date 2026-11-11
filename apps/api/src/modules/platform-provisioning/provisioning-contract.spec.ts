import {
  validateProvisionProductRequestV1,
} from "./provisioning-contract";

const validRequest = {
  schemaVersion: "1.0.0",
  eventId: "76d60c98-a6ee-49fa-ae27-49a6b5920b98",
  correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
  idempotencyKey: "order:order-2026-0042:provision:v1",
  occurredAt: "2026-11-11T08:30:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "customer-1008",
    displayName: "Grace Community Church",
    primaryContact: { name: "Grace Admin", email: "admin@example.org" },
  },
  order: {
    externalOrderId: "order-2026-0042",
    offerId: "church-ministry-launch",
    offerVersion: "1.0.0",
  },
  composition: {
    product: { id: "church-ministry", version: "1.0.0" },
    solution: { id: "church-ministry", version: "1.0.0" },
    template: { id: "church-ministry", version: "1.0.0" },
  },
  requestedDomain: "www.grace.example.org",
};

describe("Bazion platform provisioning contract v1", () => {
  it("accepts a valid pinned product request", () => {
    expect(validateProvisionProductRequestV1(validRequest)).toEqual({
      valid: true,
      value: validRequest,
    });
  });

  it("rejects unsupported versions, unknown fields and non-normalized values", () => {
    expect(validateProvisionProductRequestV1({ ...validRequest, schemaVersion: "2.0.0" }).valid).toBe(false);
    expect(validateProvisionProductRequestV1({ ...validRequest, paid: true }).valid).toBe(false);
    expect(validateProvisionProductRequestV1({ ...validRequest, requestedDomain: "https://example.org/path" }).valid).toBe(false);
    expect(validateProvisionProductRequestV1({
      ...validRequest,
      customer: { ...validRequest.customer, primaryContact: { name: "Grace Admin", email: "ADMIN@example.org" } },
    }).valid).toBe(false);
  });

  it("returns only safe validation metadata, not customer input", () => {
    const result = validateProvisionProductRequestV1({ ...validRequest, customer: { ...validRequest.customer, displayName: "" } });
    expect(result.valid).toBe(false);
    if (result.valid !== false) throw new Error("Expected invalid payload");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.issues)).not.toContain("Grace");
  });
});