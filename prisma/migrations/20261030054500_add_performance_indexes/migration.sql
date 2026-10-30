-- Idempotent performance & foreign-key composite indexes across core hot paths
CREATE INDEX IF NOT EXISTS "users_role_deleted_at_idx" ON "users"("role", "deleted_at");
CREATE INDEX IF NOT EXISTS "hosting_accounts_status_deleted_at_idx" ON "hosting_accounts"("status", "deleted_at");
CREATE INDEX IF NOT EXISTS "subscriptions_client_id_status_current_period_end_idx" ON "subscriptions"("client_id", "status", "current_period_end");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices"("created_at");
CREATE INDEX IF NOT EXISTS "invoices_client_id_created_at_idx" ON "invoices"("client_id", "created_at");
CREATE INDEX IF NOT EXISTS "payment_logs_invoice_id_idx" ON "payment_logs"("invoice_id");
CREATE INDEX IF NOT EXISTS "payment_logs_user_id_idx" ON "payment_logs"("user_id");
CREATE INDEX IF NOT EXISTS "payment_logs_status_created_at_idx" ON "payment_logs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "tickets_created_at_idx" ON "tickets"("created_at");
CREATE INDEX IF NOT EXISTS "tickets_client_id_created_at_idx" ON "tickets"("client_id", "created_at");
CREATE INDEX IF NOT EXISTS "ticket_comments_ticket_id_is_internal_created_at_idx" ON "ticket_comments"("ticket_id", "is_internal", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_idx" ON "notifications"("user_id", "read");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "vault_secrets_client_id_deleted_at_idx" ON "vault_secrets"("client_id", "deleted_at");

