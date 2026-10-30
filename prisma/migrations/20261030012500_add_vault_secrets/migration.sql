DO $$ BEGIN
  CREATE TYPE "VaultCategory" AS ENUM (
    'DOMAIN_REGISTRAR',
    'HOSTING_SSH',
    'API_KEY',
    'PAYMENT_GATEWAY',
    'DATABASE',
    'CMS_ADMIN',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "vault_secrets" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "label" TEXT NOT NULL,
  "category" "VaultCategory" NOT NULL DEFAULT 'OTHER',
  "username" TEXT,
  "service_url" TEXT,
  "encrypted_value" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "auth_tag" TEXT NOT NULL,
  "masked_hint" TEXT NOT NULL,
  "notes" TEXT,
  "last_revealed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "vault_secrets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vault_secrets_client_id_idx" ON "vault_secrets"("client_id");
CREATE INDEX IF NOT EXISTS "vault_secrets_deleted_at_idx" ON "vault_secrets"("deleted_at");

DO $$ BEGIN
  ALTER TABLE "vault_secrets"
    ADD CONSTRAINT "vault_secrets_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

