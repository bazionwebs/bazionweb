ALTER TABLE "hosting_accounts"
  ADD COLUMN "deployment_provider" TEXT,
  ADD COLUMN "provider_workload_id" TEXT;

ALTER TABLE "hosting_accounts"
  ADD CONSTRAINT "hosting_accounts_provider_reference_pair_check"
  CHECK (("deployment_provider" IS NULL) = ("provider_workload_id" IS NULL));

CREATE UNIQUE INDEX "hosting_accounts_provider_workload_uq"
  ON "hosting_accounts"("deployment_provider", "provider_workload_id");
