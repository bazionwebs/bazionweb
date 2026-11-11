/**
 * In-memory sliding window rate limiter for Next.js Route Handlers.
 * Protects public endpoints from flooding without external dependencies.
 *
 * IP extraction is hardened for a Cloudflare -> Traefik -> app chain:
 *   1. `cf-connecting-ip` is set (and scrubbed) by the Cloudflare edge itself,
 *      so an inbound client cannot spoof it.
 *   2. `x-real-ip` is normally (re)written by the nearest trusted reverse proxy.
 *   3. `x-forwarded-for` — the FIRST entry is client-controlled spoofable
 *      input; only the LAST entry is appended by the nearest trusted hop.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Keep the store bounded: an attacker rotating IPs must not grow memory forever.
const MAX_STORE_KEYS = 50_000;

// Cleanup stale keys every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 900_000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300_000);
}

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(identifier);
  if (!record) {
    if (rateLimitStore.size >= MAX_STORE_KEYS) {
      // Drop oldest entries (first inserted) to cap memory usage.
      let evicted = 0;
      for (const key of rateLimitStore.keys()) {
        rateLimitStore.delete(key);
        if (++evicted >= 1_000) break;
      }
    }
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Keep timestamps within window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return { allowed: false, remaining: 0, resetMs };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

/** Plausible IPv4 / IPv6 (incl. IPv4-mapped) token, no whitespace, max 45 chars. */
const IP_TOKEN_RE = /^[0-9A-Fa-f:.]{1,45}$/;

function normalizeIp(raw: string): string {
  const trimmed = raw.trim().split('%')[0];
  if (!IP_TOKEN_RE.test(trimmed)) return '127.0.0.1';
  // Handle IPv4-mapped IPv6 (e.g. '::ffff:203.0.113.10')
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

export function getClientIp(req: Request): string {
  const headers = req.headers;

  // 1. Cloudflare edge value — trustworthy: Cloudflare strips client-supplied
  //    CF-* headers and sets its own on every proxied request.
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return normalizeIp(cfIp);

  // 2. Nearest reverse proxy value (Traefik typically rewrites this).
  const realIp = headers.get('x-real-ip');
  if (realIp) return normalizeIp(realIp);

  // 3. X-Forwarded-For — the LAST entry is the one our edge appended;
  //    earlier entries (including the first) are attacker-controllable.
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const entries = forwarded.split(',').map((v) => v.trim()).filter(Boolean);
    if (entries.length > 0) return normalizeIp(entries[entries.length - 1]);
  }

  return '127.0.0.1';
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
