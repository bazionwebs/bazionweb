ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "intasend_customer_id" TEXT,
ADD COLUMN IF NOT EXISTS "wise_profile_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "clients_intasend_customer_id_key"
ON "clients"("intasend_customer_id");