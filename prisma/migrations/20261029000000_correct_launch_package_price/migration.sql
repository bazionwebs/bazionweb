-- Correct the Kenya Launch Website package to the advertised KSh 25,000 price.
UPDATE "prices"
SET "amount" = 25000,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "price_book_id" = 'KE-2026-v1'
  AND "product_id" = 'website-launch';
