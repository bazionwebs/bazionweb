import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { ProvisionProductRequestV1 } from './provisioning-contract';

export const DEFAULT_COMMAND_ISSUER = 'bazionweb';
export const DEFAULT_COMMAND_AUDIENCE = 'bazion-platform:commercial-provisioning';
export const DEFAULT_CALLBACK_ISSUER = 'bazion-platform';
export const DEFAULT_CALLBACK_AUDIENCE = 'bazionweb:provisioning-status';
export const DEFAULT_MAX_TOKEN_TTL_SECONDS = 600;
export const DEFAULT_CALLBACK_MAX_SKEW_SECONDS = 300;

export const PROVISIONING_OPERATION_STATUSES = [
  'accepted',
  'validating',
  'provisioning_tenant',
  'configuring_installation',
  'provisioning_hosting',
  'ready',
  'compensating',
  'compensation_required',
  'compensated',
  'failed',
] as const;

export type ProvisioningOperationStatus = (typeof PROVISIONING_OPERATION_STATUSES)[number];

export interface ProvisioningOperationV1 {
  schemaVersion: '1.0.0';
  operationId: string;
  correlationId: string;
  externalOrderId: string;
  status: ProvisioningOperationStatus;
  currentStep: string | null;
  tenantId: string | null;
  installationId: string | null;
  failure: { code: string; retryable: boolean } | null;
  updatedAt: string;
}

export interface ProvisioningStatusEventV1 {
  schemaVersion: '1.0.0';
  eventType: 'product.provisioning.status.v1';
  eventId: string;
  correlationId: string;
  occurredAt: string;
  source: 'bazion-platform';
  operation: ProvisioningOperationV1;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_STEP_REGEX = /^[a-z][a-z0-9_]{0,79}$/;
const SAFE_CODE_REGEX = /^[A-Z][A-Z0-9_]{0,79}$/;

/** Deterministically derive an RFC-4122 UUID string from a stable domain seed. */
export function deterministicUuidFromSeed(seed: string): string {
  const bytes = Buffer.from(crypto.createHash('sha256').update(seed, 'utf8').digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Recursively sort object keys to match bazionwebs-platform's canonical JSON serialization. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function computeSha256Hex(raw: string | Buffer): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function computeProvisioningRequestFingerprint(request: ProvisionProductRequestV1): string {
  return computeSha256Hex(
    canonicalJson({
      schemaVersion: request.schemaVersion,
      source: request.source,
      customer: request.customer,
      order: request.order,
      composition: request.composition,
      requestedDomain: request.requestedDomain ?? null,
    }),
  );
}

/** Mint a short-lived audience-scoped HS256 JWT assertion for internal platform API calls. */
export function signCommercialCommandToken(
  input: {
    subject: string;
    issuer?: string;
    audience?: string;
    scopes: readonly string[];
    ttlSeconds?: number;
    nowSeconds?: number;
    jti?: string;
  },
  secret: string,
): string {
  if (!secret || secret.length < 32) {
    throw new Error('PLATFORM_PROVISIONING_COMMAND_SECRET must be at least 32 characters.');
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.min(Math.max(input.ttlSeconds ?? 120, 10), DEFAULT_MAX_TOKEN_TTL_SECONDS);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: input.issuer ?? DEFAULT_COMMAND_ISSUER,
      sub: input.subject,
      aud: input.audience ?? DEFAULT_COMMAND_AUDIENCE,
      scope: input.scopes.join(' '),
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      jti: input.jti ?? crypto.randomUUID(),
    }),
    'utf8',
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyShortLivedBearerToken(
  authorizationHeader: string | undefined,
  options: {
    secret: string;
    expectedIssuer: string;
    expectedAudience: string;
    requiredScope: string;
    maxTtlSeconds?: number;
    clockSkewSeconds?: number;
    nowSeconds?: number;
  },
): void {
  if (!options.secret || options.secret.length < 32) {
    throw new UnauthorizedException('Callback bearer credential verifier is not configured');
  }
  const match = /^Bearer\s+(\S+)$/i.exec((authorizationHeader ?? '').trim());
  if (!match?.[1]) {
    throw new UnauthorizedException('Missing callback bearer token');
  }
  const parts = match[1].split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new UnauthorizedException('Malformed callback bearer token');
  }

  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid callback bearer token encoding');
  }

  if (header.alg !== 'HS256' || (header.typ !== undefined && header.typ !== 'JWT')) {
    throw new UnauthorizedException('Unsupported callback token algorithm');
  }

  const expectedSig = crypto.createHmac('sha256', options.secret).update(`${parts[0]}.${parts[1]}`).digest();
  let suppliedSig: Buffer;
  try {
    suppliedSig = Buffer.from(parts[2], 'base64url');
  } catch {
    throw new UnauthorizedException('Invalid callback token signature');
  }
  if (suppliedSig.length !== expectedSig.length || !crypto.timingSafeEqual(suppliedSig, expectedSig)) {
    throw new UnauthorizedException('Invalid callback token signature');
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSeconds ?? 30;
  const maxTtl = options.maxTtlSeconds ?? DEFAULT_MAX_TOKEN_TTL_SECONDS;
  const audienceMatches = Array.isArray(claims.aud)
    ? claims.aud.includes(options.expectedAudience)
    : claims.aud === options.expectedAudience;

  if (claims.iss !== options.expectedIssuer || !audienceMatches) {
    throw new UnauthorizedException('Invalid callback token issuer or audience');
  }
  if (typeof claims.sub !== 'string' || !claims.sub.trim() || typeof claims.jti !== 'string' || !claims.jti.trim()) {
    throw new UnauthorizedException('Invalid callback token identity claims');
  }
  if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
    throw new UnauthorizedException('Invalid callback token timestamps');
  }
  if (claims.exp - claims.iat <= 0 || claims.exp - claims.iat > maxTtl) {
    throw new UnauthorizedException('Callback token lifetime exceeded');
  }
  if (claims.iat > now + skew || claims.exp <= now - skew) {
    throw new UnauthorizedException('Callback token expired or not yet valid');
  }

  const scopes =
    typeof claims.scope === 'string'
      ? new Set(claims.scope.split(/\s+/).filter(Boolean))
      : Array.isArray(claims.scope)
        ? new Set(claims.scope.filter((x): x is string => typeof x === 'string'))
        : new Set<string>();
  if (!scopes.has(options.requiredScope)) {
    throw new UnauthorizedException('Callback token lacks required scope');
  }
}

/** Verify timestamped HMAC-SHA256 `t=<sec>,v1=<hex>` webhook header against exact raw bytes and replay window. */
export function verifyPlatformStatusWebhook(input: {
  rawBody: Buffer | string;
  signatureHeader: string | undefined;
  signingSecret: string;
  maxSkewSeconds?: number;
  nowSeconds?: number;
  authorizationHeader?: string;
  bearerSecret?: string;
}): void {
  if (!input.signingSecret || input.signingSecret.length < 32) {
    throw new UnauthorizedException('Platform callback signing secret is not configured');
  }

  const header = (input.signatureHeader ?? '').trim();
  const segments = Object.fromEntries(
    header
      .split(',')
      .map((part) => part.trim().split('=', 2))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  const tsRaw = segments.t;
  const sigHex = segments.v1;
  if (!tsRaw || !sigHex || !/^\d+$/.test(tsRaw) || !/^[a-f0-9]{64}$/i.test(sigHex)) {
    throw new UnauthorizedException('Invalid or missing X-Bazion-Signature header');
  }

  const timestampSeconds = Number(tsRaw);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkewSeconds = input.maxSkewSeconds ?? DEFAULT_CALLBACK_MAX_SKEW_SECONDS;
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > maxSkewSeconds) {
    throw new UnauthorizedException('Webhook timestamp outside allowed replay window');
  }

  const bodyBuf = Buffer.isBuffer(input.rawBody) ? input.rawBody : Buffer.from(input.rawBody, 'utf8');
  const signedPayload = Buffer.concat([Buffer.from(`${timestampSeconds}.`, 'utf8'), bodyBuf]);
  const expected = crypto.createHmac('sha256', input.signingSecret).update(signedPayload).digest();
  const supplied = Buffer.from(sigHex, 'hex');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new UnauthorizedException('Invalid platform webhook HMAC signature');
  }

  if (input.bearerSecret) {
    verifyShortLivedBearerToken(input.authorizationHeader, {
      secret: input.bearerSecret,
      expectedIssuer: DEFAULT_CALLBACK_ISSUER,
      expectedAudience: DEFAULT_CALLBACK_AUDIENCE,
      requiredScope: 'provisioning:status:write',
      nowSeconds,
    });
  }
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/** Validate strict ProvisioningOperationV1 wire shape without trusting arbitrary extra fields. */
export function validateProvisioningOperationV1(value: unknown): ProvisioningOperationV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const op = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'schemaVersion',
    'operationId',
    'correlationId',
    'externalOrderId',
    'status',
    'currentStep',
    'tenantId',
    'installationId',
    'failure',
    'updatedAt',
  ]);
  if (Object.keys(op).length !== allowedKeys.size || Object.keys(op).some((k) => !allowedKeys.has(k))) {
    return null;
  }
  if (op.schemaVersion !== '1.0.0') return null;
  if (typeof op.operationId !== 'string' || !UUID_REGEX.test(op.operationId)) return null;
  if (typeof op.correlationId !== 'string' || !UUID_REGEX.test(op.correlationId)) return null;
  if (typeof op.externalOrderId !== 'string' || !op.externalOrderId.trim() || op.externalOrderId.length > 128) return null;
  if (
    typeof op.status !== 'string' ||
    !PROVISIONING_OPERATION_STATUSES.includes(op.status as ProvisioningOperationStatus)
  ) {
    return null;
  }
  if (op.currentStep !== null && (typeof op.currentStep !== 'string' || !SAFE_STEP_REGEX.test(op.currentStep))) {
    return null;
  }
  if (op.tenantId !== null && (typeof op.tenantId !== 'string' || !UUID_REGEX.test(op.tenantId))) return null;
  if (op.installationId !== null && (typeof op.installationId !== 'string' || !UUID_REGEX.test(op.installationId))) return null;
  if (!isIsoDateTime(op.updatedAt)) return null;

  if (op.failure !== null) {
    if (!op.failure || typeof op.failure !== 'object' || Array.isArray(op.failure)) return null;
    const f = op.failure as Record<string, unknown>;
    if (Object.keys(f).length !== 2 || typeof f.code !== 'string' || !SAFE_CODE_REGEX.test(f.code) || typeof f.retryable !== 'boolean') {
      return null;
    }
  }
  if (op.status === 'ready' && (!op.tenantId || !op.installationId)) return null;
  if ((op.status === 'failed' || op.status === 'compensation_required') && !op.failure) return null;

  return value as ProvisioningOperationV1;
}

/** Validate strict ProvisioningStatusEventV1 webhook event payload. */
export function validateProvisioningStatusEventV1(value: unknown): ProvisioningStatusEventV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evt = value as Record<string, unknown>;
  const allowedTopKeys = new Set([
    'schemaVersion',
    'eventType',
    'eventId',
    'correlationId',
    'occurredAt',
    'source',
    'operation',
  ]);
  if (Object.keys(evt).length !== allowedTopKeys.size || Object.keys(evt).some((k) => !allowedTopKeys.has(k))) {
    return null;
  }
  if (evt.schemaVersion !== '1.0.0') return null;
  if (evt.eventType !== 'product.provisioning.status.v1') return null;
  if (evt.source !== 'bazion-platform') return null;
  if (typeof evt.eventId !== 'string' || !UUID_REGEX.test(evt.eventId)) return null;
  if (typeof evt.correlationId !== 'string' || !UUID_REGEX.test(evt.correlationId)) return null;
  if (!isIsoDateTime(evt.occurredAt)) return null;

  const operation = validateProvisioningOperationV1(evt.operation);
  if (!operation || operation.correlationId !== evt.correlationId) return null;

  return evt as unknown as ProvisioningStatusEventV1;
}

