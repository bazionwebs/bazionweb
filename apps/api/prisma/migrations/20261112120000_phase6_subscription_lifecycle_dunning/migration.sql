-- AlterTable
ALTER TABLE "platform_provisioning_projections"
ADD COLUMN IF NOT EXISTS "subscription_status" TEXT,
ADD COLUMN IF NOT EXISTS "grace_ends_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lifecycle_reason_code" TEXT,
ADD COLUMN IF NOT EXISTS "customer_status_message" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscription_lifecycle_outbox" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "grace_ends_at" TIMESTAMP(3),
    "event_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PlatformOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_http_status" INTEGER,
    "last_error_code" TEXT,
    "accepted_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_lifecycle_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_lifecycle_outbox_event_id_key" ON "subscription_lifecycle_outbox"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_lifecycle_outbox_idempotency_key_key" ON "subscription_lifecycle_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscription_lifecycle_outbox_status_next_attempt_at_idx" ON "subscription_lifecycle_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscription_lifecycle_outbox_subscription_id_created_at_idx" ON "subscription_lifecycle_outbox"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscription_lifecycle_outbox_client_id_created_at_idx" ON "subscription_lifecycle_outbox"("client_id", "created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "subscription_lifecycle_outbox" ADD CONSTRAINT "subscription_lifecycle_outbox_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "subscription_lifecycle_outbox" ADD CONSTRAINT "subscription_lifecycle_outbox_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
