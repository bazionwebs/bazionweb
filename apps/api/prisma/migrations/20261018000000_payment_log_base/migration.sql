-- Restore the payment-log objects required by the following pricing migration.
CREATE TYPE "PaymentMethodType" AS ENUM ('MPESA', 'CARD', 'BANK_TRANSFER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED');

CREATE TABLE "payment_logs" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT,
    "method" "PaymentMethodType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB NOT NULL,
    "error_message" TEXT,
    "client_id" TEXT,
    "subscription_id" TEXT,
    "invoice_id" TEXT,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_logs_idempotency_key_key" ON "payment_logs"("idempotency_key");
CREATE INDEX "payment_logs_provider_ref_idx" ON "payment_logs"("provider_ref");
CREATE INDEX "payment_logs_status_idx" ON "payment_logs"("status");
CREATE INDEX "payment_logs_client_id_idx" ON "payment_logs"("client_id");
CREATE INDEX "payment_logs_subscription_id_idx" ON "payment_logs"("subscription_id");
CREATE INDEX "payment_logs_invoice_id_idx" ON "payment_logs"("invoice_id");
CREATE INDEX "payment_logs_user_id_idx" ON "payment_logs"("user_id");
CREATE INDEX "payment_logs_created_at_idx" ON "payment_logs"("created_at");
CREATE INDEX "payment_logs_status_created_at_idx" ON "payment_logs"("status", "created_at");
