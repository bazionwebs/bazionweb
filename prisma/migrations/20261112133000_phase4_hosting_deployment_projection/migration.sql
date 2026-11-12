-- Read-only Platform deployment reference carried into the Bazionweb commercial projection.
ALTER TABLE "platform_provisioning_projections"
  ADD COLUMN "requested_domain" TEXT,
  ADD COLUMN "platform_deployment_id" TEXT;

CREATE UNIQUE INDEX "platform_provisioning_projections_platform_deployment_id_key"
  ON "platform_provisioning_projections"("platform_deployment_id");

ALTER TABLE "hosting_accounts"
  ADD COLUMN "platform_deployment_id" TEXT,
  ADD COLUMN "platform_deployment_mapped_at" TIMESTAMPTZ(6),
  ADD COLUMN "platform_deployment_mapped_by" UUID,
  ADD COLUMN "platform_deployment_mapping_evidence" VARCHAR(300),
  ADD CONSTRAINT "hosting_accounts_platform_deployment_id_fkey"
    FOREIGN KEY ("platform_deployment_id")
    REFERENCES "platform_provisioning_projections"("platform_deployment_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hosting_accounts_platform_deployment_mapping_ck" CHECK (
    ("platform_deployment_id" IS NULL AND "platform_deployment_mapped_at" IS NULL
      AND "platform_deployment_mapped_by" IS NULL AND "platform_deployment_mapping_evidence" IS NULL)
    OR
    ("platform_deployment_id" IS NOT NULL AND "platform_deployment_mapped_at" IS NOT NULL
      AND "platform_deployment_mapped_by" IS NOT NULL
      AND "platform_deployment_mapping_evidence" IS NOT NULL
      AND length(trim("platform_deployment_mapping_evidence")) BETWEEN 5 AND 300)
  );

CREATE UNIQUE INDEX "hosting_accounts_platform_deployment_id_key"
  ON "hosting_accounts"("platform_deployment_id");
