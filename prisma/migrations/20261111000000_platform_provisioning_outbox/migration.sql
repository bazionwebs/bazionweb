-- CreateEnum
CREATE TYPE "PlatformOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'DEAD');

-- CreateTable
CREATE TABLE "platform_provisioning_outbox" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "line_index" INTEGER NOT NULL,
    "schema_version" TEXT NOT NULL DEFAULT '1.0.0',
    "event_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "external_customer_id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PlatformOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform_operation_id" TEXT,
    "last_http_status" INTEGER,
    "last_error_code" TEXT,
    "accepted_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provisioning_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_provisioning_projections" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "outbox_id" TEXT,
    "client_id" TEXT,
    "external_order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_step" TEXT,
    "platform_tenant_id" TEXT,
    "installation_id" TEXT,
    "failure_code" TEXT,
    "failure_retryable" BOOLEAN,
    "last_event_id" TEXT,
    "last_correlation_id" TEXT,
    "platform_updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provisioning_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_callback_inbox" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status_snapshot" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_callback_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_outbox_event_id_key" ON "platform_provisioning_outbox"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_outbox_idempotency_key_key" ON "platform_provisioning_outbox"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_outbox_external_order_id_key" ON "platform_provisioning_outbox"("external_order_id");

-- CreateIndex
CREATE INDEX "platform_provisioning_outbox_status_next_attempt_at_idx" ON "platform_provisioning_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "platform_provisioning_outbox_client_id_created_at_idx" ON "platform_provisioning_outbox"("client_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_outbox_invoice_id_line_index_key" ON "platform_provisioning_outbox"("invoice_id", "line_index");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_projections_operation_id_key" ON "platform_provisioning_projections"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_projections_outbox_id_key" ON "platform_provisioning_projections"("outbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provisioning_projections_external_order_id_key" ON "platform_provisioning_projections"("external_order_id");

-- CreateIndex
CREATE INDEX "platform_provisioning_projections_client_id_status_idx" ON "platform_provisioning_projections"("client_id", "status");

-- CreateIndex
CREATE INDEX "platform_provisioning_projections_status_platform_updated_a_idx" ON "platform_provisioning_projections"("status", "platform_updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_callback_inbox_event_id_key" ON "platform_callback_inbox"("event_id");

-- CreateIndex
CREATE INDEX "platform_callback_inbox_operation_id_received_at_idx" ON "platform_callback_inbox"("operation_id", "received_at");

-- AddForeignKey
ALTER TABLE "platform_provisioning_outbox" ADD CONSTRAINT "platform_provisioning_outbox_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_provisioning_outbox" ADD CONSTRAINT "platform_provisioning_outbox_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_provisioning_projections" ADD CONSTRAINT "platform_provisioning_projections_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "platform_provisioning_outbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_provisioning_projections" ADD CONSTRAINT "platform_provisioning_projections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
