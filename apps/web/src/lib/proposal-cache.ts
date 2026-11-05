/**
 * Resilient In-Memory Proposal Cache (Node.js Runtime Fallback)
 * Isolated from Next.js App Router route handlers to strictly preserve route export conventions.
 */

export interface LocalProposalCacheItem {
  data: unknown;
  timestamp: number;
}

export const LOCAL_PROPOSAL_CACHE = new Map<string, LocalProposalCacheItem>();
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CACHE_ENTRIES = 500;

export function saveProposalToLocalCache(code: string, data: unknown): void {
  if (!code) return;
  if (LOCAL_PROPOSAL_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldest = LOCAL_PROPOSAL_CACHE.keys().next().value;
    if (oldest) LOCAL_PROPOSAL_CACHE.delete(oldest);
  }
  LOCAL_PROPOSAL_CACHE.set(code.trim().toUpperCase(), {
    data,
    timestamp: Date.now(),
  });
}

export function getProposalFromLocalCache<T = unknown>(code: string): T | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  const entry = LOCAL_PROPOSAL_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    LOCAL_PROPOSAL_CACHE.delete(key);
    return null;
  }
  return entry.data as T;
}

export function clearProposalLocalCache(): void {
  LOCAL_PROPOSAL_CACHE.clear();
}
