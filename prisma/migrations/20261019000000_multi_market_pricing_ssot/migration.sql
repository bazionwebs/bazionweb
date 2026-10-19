-- AlterTable: Make payment_logs.client_id nullable to support orphan payment logs
ALTER TABLE "payment_logs" ALTER COLUMN "client_id" DROP NOT NULL;

-- CreateTable: currencies
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "exchange_rate_to_base" DECIMAL(14,6) NOT NULL DEFAULT 1.0,
    "base_currency" BOOLEAN NOT NULL DEFAULT false,
    "rate_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable: markets
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "country_codes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_locale" TEXT NOT NULL DEFAULT 'en-US',
    "vat_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.1600,
    "tax_included_in_price" BOOLEAN NOT NULL DEFAULT true,
    "rounding_rule" TEXT NOT NULL DEFAULT 'INTEGER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_rules
CREATE TABLE "tax_rules" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL DEFAULT 'VAT',
    "rate" DECIMAL(5,4) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "country_code" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: price_books
CREATE TABLE "price_books" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_until" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable: prices
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "price_book_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billing_period" TEXT,
    "min_price" DECIMAL(12,2),
    "max_price" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: market_adjustments
CREATE TABLE "market_adjustments" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "adjustment_type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "min_spend" DECIMAL(12,2),
    "max_discount" DECIMAL(12,2),
    "coupon_code" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: proposals
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "proposal_code" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "price_book_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "billing_country" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "client_name" TEXT,
    "client_company" TEXT,
    "line_items" JSONB NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: leads
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "country" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "price_book_id" TEXT NOT NULL,
    "service_interest" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pricing_audit_logs
CREATE TABLE "pricing_audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "change_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX "markets_code_key" ON "markets"("code");
CREATE INDEX "markets_currency_code_idx" ON "markets"("currency_code");

CREATE INDEX "tax_rules_market_id_idx" ON "tax_rules"("market_id");
CREATE INDEX "tax_rules_active_idx" ON "tax_rules"("active");
CREATE INDEX "tax_rules_effective_from_effective_until_idx" ON "tax_rules"("effective_from", "effective_until");

CREATE INDEX "price_books_market_id_idx" ON "price_books"("market_id");
CREATE INDEX "price_books_status_idx" ON "price_books"("status");
CREATE INDEX "price_books_effective_from_effective_until_idx" ON "price_books"("effective_from", "effective_until");

CREATE UNIQUE INDEX "prices_price_book_id_product_id_key" ON "prices"("price_book_id", "product_id");
CREATE INDEX "prices_product_id_idx" ON "prices"("product_id");

CREATE INDEX "market_adjustments_market_id_idx" ON "market_adjustments"("market_id");
CREATE INDEX "market_adjustments_coupon_code_idx" ON "market_adjustments"("coupon_code");
CREATE INDEX "market_adjustments_active_idx" ON "market_adjustments"("active");
CREATE INDEX "market_adjustments_effective_from_effective_until_idx" ON "market_adjustments"("effective_from", "effective_until");

CREATE UNIQUE INDEX "proposals_proposal_code_key" ON "proposals"("proposal_code");
CREATE INDEX "proposals_market_id_idx" ON "proposals"("market_id");
CREATE INDEX "proposals_price_book_id_idx" ON "proposals"("price_book_id");
CREATE INDEX "proposals_client_email_idx" ON "proposals"("client_email");

CREATE INDEX "leads_market_id_idx" ON "leads"("market_id");
CREATE INDEX "leads_price_book_id_idx" ON "leads"("price_book_id");
CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_country_idx" ON "leads"("country");

CREATE INDEX "pricing_audit_logs_entity_type_entity_id_idx" ON "pricing_audit_logs"("entity_type", "entity_id");
CREATE INDEX "pricing_audit_logs_changed_by_idx" ON "pricing_audit_logs"("changed_by");
CREATE INDEX "pricing_audit_logs_timestamp_idx" ON "pricing_audit_logs"("timestamp");

-- Foreign Keys
ALTER TABLE "markets" ADD CONSTRAINT "markets_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prices" ADD CONSTRAINT "prices_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "price_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_adjustments" ADD CONSTRAINT "market_adjustments_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "price_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "price_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
