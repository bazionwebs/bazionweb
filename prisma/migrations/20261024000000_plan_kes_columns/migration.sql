-- Add KES pricing columns and intasend_plan_id to plans table.
-- These fields were added to schema.prisma after the initial migration
-- but the ALTER TABLE statements were never written. This migration
-- creates them idempotently so the production DB can be brought in sync.

ALTER TABLE "plans"
  ADD COLUMN IF NOT EXISTS "intasend_plan_id"  TEXT,
  ADD COLUMN IF NOT EXISTS "price_monthly_kes" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "price_annual_kes"  DECIMAL(12,2);

-- intasend_plan_id must be unique when set
CREATE UNIQUE INDEX IF NOT EXISTS "plans_intasend_plan_id_key"
  ON "plans"("intasend_plan_id")
  WHERE "intasend_plan_id" IS NOT NULL;
