-- BazionWeb — Clients are global: drop the Kenya default, allow NULL country.
-- Existing rows keep their values; only the column default/requirement changes.

ALTER TABLE "clients" ALTER COLUMN "country" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "country" DROP NOT NULL;
