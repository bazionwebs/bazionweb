-- Define the original payment rails before provider-specific migrations extend the enum.
CREATE TYPE "PaymentProvider" AS ENUM (
    'INTASEND',
    'WISE',
    'MANUAL_BANK_TRANSFER'
);
