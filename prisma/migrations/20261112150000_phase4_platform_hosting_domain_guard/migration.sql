-- Index domain ownership lookups before legacy hosting creates a Dokploy workload.
CREATE INDEX "platform_provisioning_projections_requested_domain_lower_idx"
  ON "platform_provisioning_projections" (lower("requested_domain"));

CREATE INDEX "platform_provisioning_outbox_requested_domain_lower_idx"
  ON "platform_provisioning_outbox" (lower(("payload" ->> 'requestedDomain')));