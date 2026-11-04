export type ServerNodeRole = 'control-plane' | 'worker';

export interface ServerNodeTopology {
  nodeId: string;
  name: string;
  role: ServerNodeRole;
  provider: 'Leaseweb' | 'Virtarix' | 'Contabo' | 'Oracle' | 'Local';
  region: string;
  totalCpus: number;
  totalMemoryMb: number;
  reservedMemoryMb: number; // Dedicated to OS, Docker daemon, Traefik edge router, telemetry
  usableMemoryMb: number; // Total tenant workload allocatable headroom (total - reserved)
  maxTenantCount: number; // Safe density boundary before node saturation
  notes?: string;
}

export const SERVER_TOPOLOGIES: Record<string, ServerNodeTopology> = {
  'leaseweb-london-worker-baseline': {
    nodeId: 'leaseweb-london-worker-baseline',
    name: 'Leaseweb London Worker (Baseline)',
    role: 'worker',
    provider: 'Leaseweb',
    region: 'London, UK (LON-1)',
    totalCpus: 4,
    totalMemoryMb: 6144, // 6 GB RAM (£4.99/mo)
    reservedMemoryMb: 1344, // 1344 MB reserved (800 MB Host OS/Daemons + 544 MB Kernel buffer)
    usableMemoryMb: 4800, // 4800 MB usable tenant headroom
    maxTenantCount: 23, // 23 tenants modeled capacity portfolio
    notes: 'Baseline production worker node for multi-tenant container workloads (23 client capacity)',
  },
  'leaseweb-london-worker-expansion': {
    nodeId: 'leaseweb-london-worker-expansion',
    name: 'Leaseweb London Worker (Expansion)',
    role: 'worker',
    provider: 'Leaseweb',
    region: 'London, UK (LON-1)',
    totalCpus: 6,
    totalMemoryMb: 16384, // 16 GB RAM
    reservedMemoryMb: 1504, // 1504 MB reserved (900 MB Host OS/Daemons + 604 MB Kernel buffer)
    usableMemoryMb: 14880, // 14880 MB usable tenant headroom
    maxTenantCount: 61, // 61 tenants modeled capacity portfolio
    notes: 'High-density expansion worker node for scaling customer workloads (61 client capacity)',
  },
  'virtarix-control-plane': {
    nodeId: 'virtarix-control-plane',
    name: 'Virtarix Control Plane',
    role: 'control-plane',
    provider: 'Virtarix',
    region: 'Frankfurt / London',
    totalCpus: 4,
    totalMemoryMb: 8192,
    reservedMemoryMb: 8192,
    usableMemoryMb: 0, // Zero tenant workloads allowed
    maxTenantCount: 0,
    notes: 'Hosts Dokploy UI, PostgreSQL DB, Redis cache, and NestJS API. Strict no-tenant policy.',
  },
};

export const DEFAULT_WORKER_NODE_ID = 'leaseweb-london-worker-baseline';

/**
 * Resolves a server identifier into its canonical ServerNodeTopology.
 * Maps exact node IDs, common aliases, and provides fallbacks for legacy server strings in test fixtures.
 */
export function resolveServerTopology(serverIdentifier?: string | null): ServerNodeTopology {
  if (!serverIdentifier || typeof serverIdentifier !== 'string') {
    return SERVER_TOPOLOGIES[DEFAULT_WORKER_NODE_ID];
  }

  const normalized = serverIdentifier.toLowerCase().trim().replace(/[\s_]+/g, '-');

  // Exact ID match
  if (SERVER_TOPOLOGIES[normalized]) {
    return SERVER_TOPOLOGIES[normalized];
  }

  // Control plane aliases
  if (
    normalized.includes('control-plane') ||
    normalized.includes('virtarix') ||
    normalized.includes('mgmt')
  ) {
    return SERVER_TOPOLOGIES['virtarix-control-plane'];
  }

  // Expansion worker aliases
  if (
    normalized.includes('expansion') ||
    normalized.includes('worker-2') ||
    normalized.includes('16gb')
  ) {
    return SERVER_TOPOLOGIES['leaseweb-london-worker-expansion'];
  }

  // Baseline worker aliases
  if (
    normalized.includes('baseline') ||
    normalized.includes('leaseweb') ||
    normalized.includes('london') ||
    normalized.includes('worker')
  ) {
    return SERVER_TOPOLOGIES['leaseweb-london-worker-baseline'];
  }

  // Fallback for legacy fixtures (e.g. 'Contabo Cloud VPS', 'Oracle Cloud (Frankfurt)')
  return SERVER_TOPOLOGIES[DEFAULT_WORKER_NODE_ID];
}
