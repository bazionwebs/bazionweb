import { ConflictException } from '@nestjs/common';

export interface PlatformSsotConfigReader {
  get<T = string>(key: string): T | undefined;
}

/**
 * Returns true when bazion-platform is the authoritative tenant & workload SSoT.
 */
export function isPlatformSsotAuthoritative(config?: PlatformSsotConfigReader): boolean {
  const explicit = (
    config?.get<string>('PLATFORM_SSOT_MODE') ??
    process.env.PLATFORM_SSOT_MODE ??
    ''
  )
    .trim()
    .toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const nodeEnv = (config?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '')
    .trim()
    .toLowerCase();
  const hasPlatformApi = Boolean(
    (config?.get<string>('PLATFORM_API_BASE_URL') ?? process.env.PLATFORM_API_BASE_URL ?? '').trim(),
  );
  return nodeEnv === 'production' && hasPlatformApi;
}

/**
 * Blocks legacy direct database/Dokploy tenant mutations while Platform SSoT mode
 * is active, unless `ALLOW_LEGACY_PROVISIONING=true` is explicitly enabled for a
 * documented rollback drill.
 */
export function assertLegacyProvisioningPermitted(
  operation: string,
  config?: PlatformSsotConfigReader,
): void {
  const rollbackOverride =
    (
      config?.get<string>('ALLOW_LEGACY_PROVISIONING') ??
      process.env.ALLOW_LEGACY_PROVISIONING ??
      ''
    )
      .trim()
      .toLowerCase() === 'true';
  if (!rollbackOverride && isPlatformSsotAuthoritative(config)) {
    throw new ConflictException(
      `${operation} is disabled while bazion-platform is the authoritative provisioning SSoT (PLATFORM_SSOT_MODE). Use Platform commercial workflows or set ALLOW_LEGACY_PROVISIONING=true during a documented rollback drill.`,
    );
  }
}

