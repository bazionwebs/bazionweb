-- Add the subscription lifecycle fields used by Prisma and payment reconciliation.
ALTER TABLE "subscriptions"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'INTASEND',
  ADD COLUMN "provider_subscription_id" TEXT,
  ADD COLUMN "card_token" TEXT,
  ADD COLUMN "mpesa_phone_number" TEXT,
  ADD COLUMN "current_period_start" TIMESTAMP(3),
  ADD COLUMN "current_period_end" TIMESTAMP(3),
  ADD COLUMN "grace_period_end" TIMESTAMP(3),
  ADD COLUMN "dunning_attempts_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_dunning_at" TIMESTAMP(3);

-- Existing subscriptions used start_date and renewal_date as their billing window.
UPDATE "subscriptions"
SET
  "current_period_start" = "start_date" AT TIME ZONE 'UTC',
  "current_period_end" = "renewal_date" AT TIME ZONE 'UTC'
WHERE "current_period_start" IS NULL OR "current_period_end" IS NULL;

CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key"
  ON "subscriptions"("provider_subscription_id");
