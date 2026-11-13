-- Unify BazionWeb 2026 Commercial Price Books (KE-2026-v1 & GLOBAL-2026-v1) and Care Plans
-- Eliminates all discrepancies between public pricing, quote engine, store catalog, and portal checkout.

-- 1. Deactivate legacy $29/$59/$119/$299 template plans and ensure canonical 2026 Care Plans are active
UPDATE "plans"
SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

UPDATE "plans"
SET
  "price_monthly" = 75,
  "price_annual" = 720,
  "price_monthly_kes" = 5000,
  "price_annual_kes" = 48000,
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = '55555555-5555-4555-8555-555555555555';

UPDATE "plans"
SET
  "price_monthly" = 150,
  "price_annual" = 1440,
  "price_monthly_kes" = 10000,
  "price_annual_kes" = 96000,
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = '66666666-6666-4666-8666-666666666666';

UPDATE "plans"
SET
  "price_monthly" = 300,
  "price_annual" = 2880,
  "price_monthly_kes" = 20000,
  "price_annual_kes" = 192000,
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = '77777777-7777-4777-8777-777777777777';

INSERT INTO "plans" (
  "id", "name", "tier",
  "price_monthly", "price_annual", "price_monthly_kes", "price_annual_kes",
  "uptime_sla", "p1_response_minutes", "p2_response_minutes", "p3_response_minutes",
  "max_backup_retention", "has_maintenance", "has_security_mgmt", "has_performance_opt",
  "has_unlimited_updates", "has_dedicated_am", "has_custom_sla", "max_service_cred_pct",
  "is_active", "created_at", "updated_at"
) VALUES (
  '88888888-8888-4888-8888-888888888888', 'Care Enterprise', 'ENTERPRISE',
  400, 3840, 40000, 384000,
  '99.99%', 15, 30, 120,
  365, true, true, true,
  true, true, true, 25,
  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price_monthly" = EXCLUDED."price_monthly",
  "price_annual" = EXCLUDED."price_annual",
  "price_monthly_kes" = EXCLUDED."price_monthly_kes",
  "price_annual_kes" = EXCLUDED."price_annual_kes",

  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

-- Point clients that defaulted onto deactivated legacy Starter plan (without subscriptions) to Care Essential
UPDATE "clients"
SET "plan_id" = '55555555-5555-4555-8555-555555555555', "updated_at" = CURRENT_TIMESTAMP
WHERE "plan_id" = '11111111-1111-4111-8111-111111111111'
  AND NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."client_id" = "clients"."id");

-- 2. Remove stale non-canonical add-on keys from active price books
DELETE FROM "prices"
WHERE "product_id" IN ('addon-brand-identity', 'addon-maintenance-priority', 'addon-portal-client');

-- 3. Upsert canonical Kenya Price Book (KE-2026-v1)
WITH ke_book AS (
  SELECT pb."id"
  FROM "price_books" pb
  JOIN "markets" m ON m."id" = pb."market_id"
  WHERE m."code" = 'KE' AND pb."status" = 'active'
  ORDER BY pb."effective_from" DESC
  LIMIT 1
)
INSERT INTO "prices" ("id", "price_book_id", "product_id", "amount", "billing_period", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  ke_book."id",
  v.product_id,
  v.amount,
  v.billing_period,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ke_book
CROSS JOIN (
  VALUES
    ('website-launch',          25000::numeric,  'one-time'),
    ('website-business',        90000::numeric,  'one-time'),
    ('website-professional',   160000::numeric,  'one-time'),
    ('website-enterprise',     320000::numeric,  'starting'),
    ('ecommerce-starter',       90000::numeric,  'one-time'),
    ('ecommerce-business',     175000::numeric,  'one-time'),
    ('ecommerce-enterprise',   320000::numeric,  'starting'),
    ('custom-tier-1',          180000::numeric,  'starting'),
    ('custom-tier-2',          350000::numeric,  'starting'),
    ('custom-tier-3',          750000::numeric,  'starting'),
    ('care-essential',           5000::numeric,  'month'),
    ('care-business',           10000::numeric,  'month'),
    ('care-professional',       20000::numeric,  'month'),
    ('care-enterprise',         40000::numeric,  'month'),
    ('host-essential',           4500::numeric,  'year'),
    ('host-business',            8500::numeric,  'year'),
    ('host-pro',                15000::numeric,  'year'),
    ('rate-extra-page',          2000::numeric,  'one-time'),
    ('addon-blog-news',          7500::numeric,  'one-time'),
    ('addon-advanced-form',      5000::numeric,  'one-time'),
    ('addon-booking',           15000::numeric,  'one-time'),
    ('addon-payment-gateway',   10000::numeric,  'one-time'),
    ('addon-mpesa',             10000::numeric,  'one-time'),
    ('addon-newsletter',         5000::numeric,  'one-time'),
    ('addon-seo-advanced',      15000::numeric,  'one-time'),
    ('addon-copywriting',       10000::numeric,  'one-time'),
    ('addon-migration',          5000::numeric,  'one-time'),
    ('addon-extra-revision',     3000::numeric,  'one-time'),
    ('addon-custom-api',        15000::numeric,  'one-time'),
    ('addon-multilingual',      15000::numeric,  'one-time'),
    ('addon-document-hub',       6000::numeric,  'one-time')
) AS v(product_id, amount, billing_period)
ON CONFLICT ("price_book_id", "product_id") DO UPDATE SET
  "amount" = EXCLUDED."amount",
  "billing_period" = EXCLUDED."billing_period",
  "updated_at" = CURRENT_TIMESTAMP;

-- 4. Upsert canonical International Price Book (GLOBAL-2026-v1)
WITH gl_book AS (
  SELECT pb."id"
  FROM "price_books" pb
  JOIN "markets" m ON m."id" = pb."market_id"
  WHERE m."code" = 'GLOBAL' AND pb."status" = 'active'
  ORDER BY pb."effective_from" DESC
  LIMIT 1
)
INSERT INTO "prices" ("id", "price_book_id", "product_id", "amount", "billing_period", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  gl_book."id",
  v.product_id,
  v.amount,
  v.billing_period,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM gl_book
CROSS JOIN (
  VALUES
    ('website-launch',            450::numeric,  'one-time'),
    ('website-business',          950::numeric,  'one-time'),
    ('website-professional',     1750::numeric,  'one-time'),
    ('website-enterprise',       3600::numeric,  'starting'),
    ('ecommerce-starter',         890::numeric,  'one-time'),
    ('ecommerce-business',       1650::numeric,  'one-time'),
    ('ecommerce-enterprise',     3600::numeric,  'starting'),
    ('custom-tier-1',            2200::numeric,  'starting'),
    ('custom-tier-2',            3900::numeric,  'starting'),
    ('custom-tier-3',            8500::numeric,  'starting'),
    ('care-essential',             75::numeric,  'month'),
    ('care-business',             150::numeric,  'month'),
    ('care-professional',         300::numeric,  'month'),
    ('care-enterprise',           400::numeric,  'month'),
    ('host-essential',             49::numeric,  'year'),
    ('host-business',              99::numeric,  'year'),
    ('host-pro',                  189::numeric,  'year'),
    ('rate-extra-page',            40::numeric,  'one-time'),
    ('addon-blog-news',           120::numeric,  'one-time'),
    ('addon-advanced-form',        80::numeric,  'one-time'),
    ('addon-booking',             220::numeric,  'one-time'),
    ('addon-payment-gateway',     150::numeric,  'one-time'),
    ('addon-mpesa',               150::numeric,  'one-time'),
    ('addon-newsletter',           80::numeric,  'one-time'),
    ('addon-seo-advanced',        220::numeric,  'one-time'),
    ('addon-copywriting',         180::numeric,  'one-time'),
    ('addon-migration',            80::numeric,  'one-time'),
    ('addon-extra-revision',       50::numeric,  'one-time'),
    ('addon-custom-api',          240::numeric,  'one-time'),
    ('addon-multilingual',        240::numeric,  'one-time'),
    ('addon-document-hub',        120::numeric,  'one-time')
) AS v(product_id, amount, billing_period)
ON CONFLICT ("price_book_id", "product_id") DO UPDATE SET
  "amount" = EXCLUDED."amount",
  "billing_period" = EXCLUDED."billing_period",
  "updated_at" = CURRENT_TIMESTAMP;
