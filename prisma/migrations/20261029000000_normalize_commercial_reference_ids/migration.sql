-- Align the legacy identifiers used by newer commercial models and foreign keys.
-- UUID text conversion preserves the identifier values while matching Prisma's String columns.
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_client_fk";
ALTER TABLE "hosting_accounts" DROP CONSTRAINT IF EXISTS "hosting_accounts_client_fk";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_client_fk";
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_client_fk";
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_subscription_fk";
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_client_fk";

ALTER TABLE "clients" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "clients" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
ALTER TABLE "subscriptions" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
ALTER TABLE "invoices" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;

ALTER TABLE "projects" ALTER COLUMN "client_id" TYPE TEXT USING "client_id"::TEXT;
ALTER TABLE "hosting_accounts" ALTER COLUMN "client_id" TYPE TEXT USING "client_id"::TEXT;
ALTER TABLE "subscriptions" ALTER COLUMN "client_id" TYPE TEXT USING "client_id"::TEXT;
ALTER TABLE "invoices" ALTER COLUMN "client_id" TYPE TEXT USING "client_id"::TEXT;
ALTER TABLE "invoices" ALTER COLUMN "subscription_id" TYPE TEXT USING "subscription_id"::TEXT;
ALTER TABLE "tickets" ALTER COLUMN "client_id" TYPE TEXT USING "client_id"::TEXT;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hosting_accounts"
  ADD CONSTRAINT "hosting_accounts_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_subscription_fk" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
