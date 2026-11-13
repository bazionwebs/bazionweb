import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';

export interface PlatformSsotConfigReader {
  get<T = string>(key: string): T | undefined;
}

export interface LegacyProvisioningRollbackAuditEntry {
  operation: string;
  ticket: string;
  actor: string;
  expiresAt: string;
  permittedAt: string;
}

export interface LegacyProvisioningRollbackEvaluation {
  permitted: boolean;
  reason?: string;
  auditEntry?: LegacyProvisioningRollbackAuditEntry;
}

export const MAX_LEGACY_ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
const ROLLBACK_TICKET_PATTERN =
  /^(?:CHG|INC|MIG|ROLLBACK|DRILL|TICKET)[-:/#][A-Za-z0-9][A-Za-z0-9._:/#-]{2,292}$/i;

const logger = new Logger('PlatformSsotGuard');
const rollbackAuditTrail: LegacyProvisioningRollbackAuditEntry[] = [];

function readConfigValue(
  key: string,
  config?: PlatformSsotConfigReader,
): string {
  return (config?.get<string>(key) ?? process.env[key] ?? '').trim();
}

export function getLegacyProvisioningRollbackAuditTrail(): LegacyProvisioningRollbackAuditEntry[] {
  return [...rollbackAuditTrail];
}

export function clearLegacyProvisioningRollbackAuditTrail(): void {
  rollbackAuditTrail.length = 0;
}

/**
 * Returns true when bazion-platform is the authoritative tenant & workload SSoT.
 */
export function isPlatformSsotAuthoritative(
  config?: PlatformSsotConfigReader,
): boolean {
  const explicit = readConfigValue('PLATFORM_SSOT_MODE', config).toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const nodeEnv = readConfigValue('NODE_ENV', config).toLowerCase();
  const hasPlatformApi = Boolean(
    readConfigValue('PLATFORM_API_BASE_URL', config),
  );
  return nodeEnv === 'production' && hasPlatformApi;
}

/**
 * Evaluates whether an explicitly authorized, time-limited, ticket-backed,
 * operation-scoped legacy rollback window permits the requested operation.
 */
export function evaluateLegacyProvisioningRollbackWindow(
  operation: string,
  config?: PlatformSsotConfigReader,
  options?: { now?: Date; onAudit?: (entry: LegacyProvisioningRollbackAuditEntry) => void },
): LegacyProvisioningRollbackEvaluation {
  const rawAllow = readConfigValue('ALLOW_LEGACY_PROVISIONING', config).toLowerCase();
  if (rawAllow !== 'true' && rawAllow !== '1') {
    return { permitted: false };
  }

  const ticket = readConfigValue('LEGACY_PROVISIONING_ROLLBACK_TICKET', config);
  if (!ticket || !ROLLBACK_TICKET_PATTERN.test(ticket)) {
    return {
      permitted: false,
      reason:
        'LEGACY_PROVISIONING_ROLLBACK_TICKET must match an approved ticket reference (e.g., CHG-1234 or ROLLBACK-2026-01).',
    };
  }

  const actor = readConfigValue('LEGACY_PROVISIONING_ROLLBACK_ACTOR', config);
  if (!actor || actor.length < 3) {
    return {
      permitted: false,
      reason:
        'LEGACY_PROVISIONING_ROLLBACK_ACTOR must identify the authorizing operator (minimum 3 characters).',
    };
  }

  const untilRaw = readConfigValue('LEGACY_PROVISIONING_ROLLBACK_UNTIL', config);
  const untilMs = Date.parse(untilRaw);
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  if (!untilRaw || Number.isNaN(untilMs)) {
    return {
      permitted: false,
      reason:
        'LEGACY_PROVISIONING_ROLLBACK_UNTIL must be a valid ISO-8601 expiration timestamp.',
    };
  }
  if (untilMs <= nowMs) {
    return {
      permitted: false,
      reason: `Legacy provisioning rollback window expired at ${new Date(untilMs).toISOString()}.`,
    };
  }
  if (untilMs - nowMs > MAX_LEGACY_ROLLBACK_WINDOW_MS) {
    return {
      permitted: false,
      reason:
        'LEGACY_PROVISIONING_ROLLBACK_UNTIL cannot exceed 24 hours from the current time.',
    };
  }

  const operationsRaw = readConfigValue(
    'LEGACY_PROVISIONING_ROLLBACK_OPERATIONS',
    config,
  );
  const allowedOperations = operationsRaw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    allowedOperations.length === 0 ||
    allowedOperations.some((entry) => entry === '*' || entry.toUpperCase() === 'ALL')
  ) {
    return {
      permitted: false,
      reason:
        'LEGACY_PROVISIONING_ROLLBACK_OPERATIONS must list explicit operation names and must not contain wildcards (* or ALL).',
    };
  }
  if (!allowedOperations.includes(operation)) {
    return {
      permitted: false,
      reason: `Operation "${operation}" is not listed in LEGACY_PROVISIONING_ROLLBACK_OPERATIONS.`,
    };
  }

  const auditEntry: LegacyProvisioningRollbackAuditEntry = {
    operation,
    ticket,
    actor,
    expiresAt: new Date(untilMs).toISOString(),
    permittedAt: now.toISOString(),
  };

  return {
    permitted: true,
    auditEntry,
  };
}

/**
 * Blocks legacy direct database/Dokploy tenant mutations while Platform SSoT mode
 * is active, unless an explicit, time-limited, ticket-backed, operation-scoped
 * rollback window is authorized.
 */
export function assertLegacyProvisioningPermitted(
  operation: string,
  config?: PlatformSsotConfigReader,
  options?: { now?: Date; onAudit?: (entry: LegacyProvisioningRollbackAuditEntry) => void },
): void {
  if (!isPlatformSsotAuthoritative(config)) {
    return;
  }

  const rawAllow = readConfigValue('ALLOW_LEGACY_PROVISIONING', config).toLowerCase();
  if (rawAllow !== 'true' && rawAllow !== '1') {
    throw new ConflictException(
      `${operation} is disabled while bazion-platform is the authoritative provisioning SSoT (PLATFORM_SSOT_MODE). Use Platform commercial workflows or configure a scoped rollback window.`,
    );
  }

  const evaluation = evaluateLegacyProvisioningRollbackWindow(
    operation,
    config,
    options,
  );
  if (!evaluation.permitted || !evaluation.auditEntry) {
    throw new ForbiddenException({
      code: 'PLATFORM_SSOT_ROLLBACK_INVALID',
      operation,
      reason:
        evaluation.reason ||
        'Legacy provisioning rollback override is missing required authorization metadata.',
      message: `${operation} cannot use legacy rollback override: ${evaluation.reason || 'invalid rollback window'}`,
    });
  }

  rollbackAuditTrail.push(evaluation.auditEntry);
  if (rollbackAuditTrail.length > 500) {
    rollbackAuditTrail.shift();
  }
  options?.onAudit?.(evaluation.auditEntry);
  logger.warn(
    JSON.stringify({
      event: 'platform_ssot.legacy_rollback_permitted',
      ...evaluation.auditEntry,
    }),
  );
}
