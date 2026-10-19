import * as Joi from 'joi';

/**
 * Fail-fast env validation.
 * Missing / placeholder payment secrets crash boot in production
 * instead of silently simulating payments.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(4000),
  FRONTEND_URL: Joi.string().uri().default('https://bazionweb.com'),

  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_URL_UNPOOLED: Joi.string().uri().optional().allow(''),

  // Auth & JWT (Enforce minimum 32 characters to prevent weak HMAC keys)
  AUTH_PROVIDER: Joi.string().valid('local', 'keycloak').default('local'),
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid('CHANGE_ME_256BIT_SECRET_KEY_FOR_LOCAL_DEV', 'secret', 'password'),
  JWT_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // IntaSend — M-Pesa STK (KES)
  INTASEND_ENVIRONMENT: Joi.string().valid('sandbox', 'production').default('sandbox'),
  INTASEND_PUBLISHABLE_KEY: Joi.string().min(8).required(),
  INTASEND_SECRET_KEY: Joi.string()
    .min(16)
    .required()
    .invalid('ISSecretKey_sandbox_placeholder', 'CHANGE_ME', 'placeholder'),

  // Paystack — Cards + international (KES/USD)
  PAYSTACK_SECRET_KEY: Joi.string().min(8).optional().allow(''),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().min(8).optional().allow(''),
  // Alias: Paystack signs with the secret key itself; webhook secret optional.
  // If PAYSTACK_WEBHOOK_SECRET unset, PAYSTACK_SECRET_KEY is used.

  // Wise — payouts + invoice links only (no virtual receiving accounts in KE)
  WISE_ENVIRONMENT: Joi.string().valid('sandbox', 'production').default('sandbox'),
  WISE_API_TOKEN: Joi.string().min(8).optional().allow(''),
  WISE_PROFILE_ID: Joi.string().min(1).optional().allow(''),
  WISE_WEBHOOK_SECRET: Joi.string().min(8).optional().allow(''),

  // Manual B2B settlement (used instead of Wise virtual accounts)
  BANK_BENEFICIARY: Joi.string().optional().allow(''),
  BANK_ACCOUNT_NUMBER: Joi.string().optional().allow(''),
  BANK_IBAN: Joi.string().optional().allow(''),
  BANK_SWIFT_BIC: Joi.string().optional().allow(''),
  BANK_ADDRESS_LINE: Joi.string().optional().allow(''),
  BANK_ADDRESS_CITY: Joi.string().optional().allow(''),
  BANK_ADDRESS_COUNTRY: Joi.string().optional().allow(''),
});
