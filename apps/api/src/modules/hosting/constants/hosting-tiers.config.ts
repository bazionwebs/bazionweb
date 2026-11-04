export type RestartPolicy = 'unless-stopped' | 'always' | 'on-failure' | 'no';
export type TenancyModel = 'shared' | 'dedicated';

export interface HostingTierResourceProfile {
  tierId: string;
  name: string;
  cpus: number; // CPU quota (0.5 = 50% single core, 1.5 = 150%)
  memoryLimitMb: number; // Hard container memory limit (cgroups memory.max)
  memoryReservationMb: number; // Soft guaranteed reservation (cgroups memory.low)
  memorySwapMb: number; // Hard memory + swap limit (cgroups memory.swap.max; equal to limit = 0 swap)
  pidsLimit: number; // Max container thread/process count (cgroups pids.max)
  restartPolicy: RestartPolicy;
  storageQuotaGb: number;
  bandwidthQuotaGb: number;
  mailboxes: number;
  database: TenancyModel;
  redis: TenancyModel;
}

export const HOSTING_TIER_PROFILES: Record<string, HostingTierResourceProfile> = {
  'host-essential': {
    tierId: 'host-essential',
    name: 'Host Essential',
    cpus: 0.5,
    memoryLimitMb: 384,
    memoryReservationMb: 128,
    memorySwapMb: 384,
    pidsLimit: 100,
    restartPolicy: 'unless-stopped',
    storageQuotaGb: 10,
    bandwidthQuotaGb: 100,
    mailboxes: 0,
    database: 'shared',
    redis: 'shared',
  },
  'host-business': {
    tierId: 'host-business',
    name: 'Host Business',
    cpus: 1.5,
    memoryLimitMb: 768,
    memoryReservationMb: 256,
    memorySwapMb: 768,
    pidsLimit: 150,
    restartPolicy: 'unless-stopped',
    storageQuotaGb: 25,
    bandwidthQuotaGb: 500,
    mailboxes: 5,
    database: 'shared',
    redis: 'shared',
  },
  'host-professional': {
    tierId: 'host-professional',
    name: 'Host Professional',
    cpus: 2.0,
    memoryLimitMb: 1536,
    memoryReservationMb: 512,
    memorySwapMb: 1536,
    pidsLimit: 250,
    restartPolicy: 'unless-stopped',
    storageQuotaGb: 50,
    bandwidthQuotaGb: 1000,
    mailboxes: 10,
    database: 'shared',
    redis: 'shared',
  },
  'host-cloud': {
    tierId: 'host-cloud',
    name: 'Managed Cloud',
    cpus: 4.0,
    memoryLimitMb: 2048,
    memoryReservationMb: 1024,
    memorySwapMb: 2048,
    pidsLimit: 500,
    restartPolicy: 'unless-stopped',
    storageQuotaGb: 100,
    bandwidthQuotaGb: 2000,
    mailboxes: 25,
    database: 'dedicated',
    redis: 'dedicated',
  },
};

// Explicit canonical alias reference for host-pro -> host-professional
HOSTING_TIER_PROFILES['host-pro'] = HOSTING_TIER_PROFILES['host-professional'];

/**
 * Normalizes user-supplied or API-supplied plan strings to canonical HostingTierResourceProfile.
 * Supports exact IDs, case-insensitivity, hyphens/underscores, and commercial aliases.
 */
export function resolveHostingTier(planString?: string | null): HostingTierResourceProfile | null {
  if (!planString || typeof planString !== 'string') return null;

  const normalized = planString.toLowerCase().trim().replace(/[\s_]+/g, '-');

  // Direct profile key match
  if (HOSTING_TIER_PROFILES[normalized]) {
    return HOSTING_TIER_PROFILES[normalized];
  }

  // Commercial aliases
  const aliasMap: Record<string, string> = {
    starter: 'host-essential',
    essential: 'host-essential',
    'host-starter': 'host-essential',
    business: 'host-business',
    growth: 'host-business',
    'host-growth': 'host-business',
    pro: 'host-professional',
    professional: 'host-professional',
    'host-pro': 'host-professional',
    'host-professional': 'host-professional',
    scale: 'host-professional',
    cloud: 'host-cloud',
    'managed-cloud': 'host-cloud',
    enterprise: 'host-cloud',
    managed: 'host-cloud',
    'host-enterprise': 'host-cloud',
  };

  if (aliasMap[normalized]) {
    return HOSTING_TIER_PROFILES[aliasMap[normalized]] || null;
  }

  // Keyword contains fallback
  if (normalized.includes('essential') || normalized.includes('starter')) {
    return HOSTING_TIER_PROFILES['host-essential'];
  }
  if (normalized.includes('business') || normalized.includes('growth')) {
    return HOSTING_TIER_PROFILES['host-business'];
  }
  if (normalized.includes('pro') || normalized.includes('scale')) {
    return HOSTING_TIER_PROFILES['host-professional'];
  }
  if (normalized.includes('cloud') || normalized.includes('enterprise') || normalized.includes('managed')) {
    return HOSTING_TIER_PROFILES['host-cloud'];
  }

  return null;
}
