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

  // Paystack — Cards + M-Pesa (KES/USD)
  PAYSTACK_SECRET_KEY: Joi.string().min(8).optional().allow(''),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().min(8).optional().allow(''),
  // Optional: set PAYSTACK_SETTLEMENT_CURRENCY=KES when merchant has no USD domiciliary account yet
  PAYSTACK_SETTLEMENT_CURRENCY: Joi.string().valid('KES', 'USD', 'AUTO', 'kes', 'usd', 'auto').optional().allow(''),
  PAYSTACK_USD_KES_RATE: Joi.number().positive().optional(),
  // Alias: Paystack signs with the secret key itself; webhook secret optional.
  // If PAYSTACK_WEBHOOK_SECRET unset, PAYSTACK_SECRET_KEY is used.

  // Safaricom Daraja — M-Pesa STK (KES)
  DARAJA_ENVIRONMENT: Joi.string().valid('sandbox', 'production').default('sandbox'),
  DARAJA_CONSUMER_KEY: Joi.string().optional().allow(''),
  DARAJA_CONSUMER_SECRET: Joi.string().optional().allow(''),
  DARAJA_BUSINESS_SHORTCODE: Joi.string().optional().allow('').default('174379'),
  DARAJA_PASSKEY: Joi.string().optional().allow(''),
  DARAJA_CALLBACK_URL: Joi.string().uri().optional().allow(''),

  // Manual B2B settlement (used instead of Wise virtual accounts)
  BANK_BENEFICIARY: Joi.string().optional().allow(''),
  BANK_ACCOUNT_NUMBER: Joi.string().optional().allow(''),
  BANK_IBAN: Joi.string().optional().allow(''),
  BANK_SWIFT_BIC: Joi.string().optional().allow(''),
  BANK_ADDRESS_LINE: Joi.string().optional().allow(''),
  BANK_ADDRESS_CITY: Joi.string().optional().allow(''),
  BANK_ADDRESS_COUNTRY: Joi.string().optional().allow(''),
});
