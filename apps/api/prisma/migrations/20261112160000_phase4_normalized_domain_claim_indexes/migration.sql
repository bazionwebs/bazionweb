-- Match normalized domain claim lookups used by legacy hosting and Platform provisioning.
CREATE INDEX "hosting_accounts_normalized_domain_claim_idx"
  ON "hosting_accounts" (lower(regexp_replace(trim("domain"), '\.$', '')));

CREATE INDEX "platform_provisioning_projections_normalized_domain_claim_idx"
  ON "platform_provisioning_projections" (lower(regexp_replace(trim("requested_domain"), '\.$', '')))
  WHERE "requested_domain" IS NOT NULL;

CREATE INDEX "platform_provisioning_outbox_normalized_domain_claim_idx"
  ON "platform_provisioning_outbox" (lower(regexp_replace(trim("payload" ->> 'requestedDomain'), '\.$', '')))
  WHERE NULLIF(trim("payload" ->> 'requestedDomain'), '') IS NOT NULL;
