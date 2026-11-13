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
  AUTH_PROVIDER: Joi.string().valid('local', 'keycloak', 'oidc').default('local'),
  PLATFORM_SSOT_MODE: Joi.string().valid('true', 'false', '1', '0').optional().allow(''),
  CUSTOMER_LOCAL_AUTH_DISABLED: Joi.string().valid('true', 'false', '1', '0').optional().allow(''),
  ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH: Joi.string().valid('true', 'false', '1', '0').optional().allow(''),
  STAFF_LOCAL_AUTH_POLICY: Joi.string().valid('allow_staff_only', 'disabled', 'oidc_only').default('allow_staff_only'),
  OIDC_ISSUER: Joi.string().uri().optional().allow(''),
  OIDC_BFF_SESSION_SECRET: Joi.string().min(32).optional().allow(''),
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid('CHANGE_ME_256BIT_SECRET_KEY_FOR_LOCAL_DEV', 'secret', 'password'),
  // Optional dedicated document key; the billing service falls back to JWT_SECRET.
  DOCUMENT_SIGNING_SECRET: Joi.string().min(32).optional().allow(''),
  DOCUMENT_SIGNING_PREVIOUS_SECRET: Joi.string().min(32).optional().allow(''),
  JWT_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  // Dedicated AES-256-GCM vault encryption key for client credentials at rest (min 32 chars).
  VAULT_MASTER_KEY: Joi.string().min(32).optional().allow(''),
  // Dedicated BFF→API token-minting handoff secret. Must be ≥ 12 chars when
  // provided; do NOT reuse PAYSTACK_SECRET_KEY or JWT_SECRET here.
  INTERNAL_DISPATCH_SECRET: Joi.string().min(12).optional().allow(''),

  // Reverse-proxy chain depth (Cloudflare → Traefik/Nginx → app). Express
  // `trust proxy` is set from this so request IPs resolve correctly.
  TRUST_PROXY: Joi.number().integer().positive().default(1),

  // Rate limiting (ThrottlerModule) — bounded so a mis-set env var can't
  // effectively disable throttling at boot.
  RATE_LIMIT_TTL: Joi.number().integer().positive().max(3600).default(60),
  RATE_LIMIT_MAX: Joi.number().integer().positive().min(1).max(10000).default(100),

  // Redis (cache/session backend) — optional, but must be non-empty when set.
  REDIS_URL: Joi.string().optional().allow(''),

  // Transactional Email (Resend HTTP API + SMTP fallback)
  RESEND_API_KEY: Joi.string().optional().allow(''),
  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().optional().allow(''),

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

  // Bazion Platform Provisioning Synchronization (Phase 3)
  PLATFORM_API_BASE_URL: Joi.string().uri().optional().allow(''),
  PLATFORM_PROVISIONING_COMMAND_SECRET: Joi.string().min(32).optional().allow(''),
  PLATFORM_PROVISIONING_COMMAND_ISSUER: Joi.string().optional().default('bazionweb'),
  PLATFORM_PROVISIONING_COMMAND_AUDIENCE: Joi.string().optional().default('bazion-platform:commercial-provisioning'),
  PLATFORM_CALLBACK_SIGNING_SECRET: Joi.string().min(32).optional().allow(''),
  PLATFORM_CALLBACK_BEARER_SECRET: Joi.string().min(32).optional().allow(''),
  PLATFORM_CALLBACK_MAX_SKEW_SECONDS: Joi.number().integer().min(30).max(900).default(300),
  PLATFORM_PROVISIONING_WORKER_ENABLED: Joi.string().valid('true', 'false').default('false'),
  PLATFORM_PROVISIONING_BATCH_SIZE: Joi.number().integer().min(1).max(50).default(10),
  PLATFORM_PROVISIONING_LEASE_SECONDS: Joi.number().integer().min(30).max(900).default(120),
  PLATFORM_PROVISIONING_TIMEOUT_MS: Joi.number().integer().min(500).max(30000).default(5000),
}).custom((value, helpers) => {
  if (value.NODE_ENV !== 'production') {
    return value;
  }

  const ssotActive = value.PLATFORM_SSOT_MODE === 'true' || value.PLATFORM_SSOT_MODE === '1';
  const oidcSelected = String(value.AUTH_PROVIDER ?? 'local').toLowerCase() === 'oidc';
  const explicitDisabled =
    value.CUSTOMER_LOCAL_AUTH_DISABLED === 'true' || value.CUSTOMER_LOCAL_AUTH_DISABLED === '1';
  const explicitEnabled =
    value.CUSTOMER_LOCAL_AUTH_DISABLED === 'false' || value.CUSTOMER_LOCAL_AUTH_DISABLED === '0';
  const allowLegacy =
    value.ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH === 'true' || value.ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH === '1';

  if ((ssotActive || oidcSelected) && (explicitEnabled || allowLegacy)) {
    return helpers.message({
      custom:
        'CUSTOMER_LOCAL_AUTH_CONFLICT: Customer local password authentication cannot be enabled in production when AUTH_PROVIDER=oidc or PLATFORM_SSOT_MODE=true.',
    });
  }

  if (explicitEnabled && !allowLegacy) {
    return helpers.message({
      custom:
        'CUSTOMER_AUTH_POLICY_REQUIRED: Setting CUSTOMER_LOCAL_AUTH_DISABLED=false in production requires explicit ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH=true prior to OIDC cutover.',
    });
  }

  if (!explicitDisabled && !explicitEnabled && !allowLegacy) {
    value.CUSTOMER_LOCAL_AUTH_DISABLED = 'true';
  }

  if (oidcSelected || (ssotActive && Boolean(value.OIDC_ISSUER || value.OIDC_BFF_SESSION_SECRET))) {
    const issuer = typeof value.OIDC_ISSUER === 'string' ? value.OIDC_ISSUER.trim() : '';
    const sessionSecret = typeof value.OIDC_BFF_SESSION_SECRET === 'string' ? value.OIDC_BFF_SESSION_SECRET.trim() : '';
    if (!issuer.startsWith('https://')) {
      return helpers.message({
        custom: 'OIDC_ISSUER must be an https:// URL in production when Platform OIDC is active.',
      });
    }
    if (sessionSecret.length < 32) {
      return helpers.message({
        custom: 'OIDC_BFF_SESSION_SECRET (>= 32 chars) is required in production when Platform OIDC is active.',
      });
    }
  }

  return value;
});
