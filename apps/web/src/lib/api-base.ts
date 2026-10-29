/**
 * Resolves the base origin for calling the NestJS API.
 *
 * Vercel Services layout (see /vercel.json): `web` is public at /(.*) and
 * `api` at /api/(.*) on the SAME deployment domain. The web service declares
 * a service binding to `api`, so Vercel injects the api service's internal
 * base URL into API_INTERNAL_URL — at function runtime only (never during
 * builds, and not visible in the browser).
 *
 * Resolution order:
 *   1. Browser: NEXT_PUBLIC_API_URL if set (dev .env.local, legacy external
 *      API hosts), else the current origin — browser requests go to /api/v1/...
 *      on the same domain and the top-level rewrite routes /api/(.*) to `api`.
 *   2. Server: API_INTERNAL_URL (Vercel services binding), then
 *      NEXT_PUBLIC_API_URL (legacy separate-domain deploys), then
 *      http://localhost:4000 in development / https://www.bazionwebs.com in
 *      production (same-origin rewrite routes /api/v1 to the api service).
 *
 * Production env drift has produced values like
 *   "NEXT_PUBLIC_API_URL = https://api.bazionweb.com/api/v1"   (name pasted in)
 *   "https://api.bazionweb.com/api/v1\r"                       (trailing CRLF)
 *   "https://api.bazionweb.com/api/v1/"                        (trailing slash)
 * normalizeOrigin() safely extracts the usable origin and never doubles the
 * /api/v1 path segment.
 */
function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = String(raw).match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return null;
  const candidate = match[0].replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export function resolveApiBase(): string {
  // ── Browser ──────────────────────────────────────────────────────────────
  // API_INTERNAL_URL is a server-only function binding and is undefined here.
  if (typeof window !== 'undefined') {
    const publicUrl = normalizeOrigin(process.env.NEXT_PUBLIC_API_URL);
    return publicUrl ?? window.location.origin;
  }

  // ── Server ───────────────────────────────────────────────────────────────
  const internalUrl = normalizeOrigin(process.env.API_INTERNAL_URL);
  if (internalUrl) return internalUrl;

  const publicUrl = normalizeOrigin(process.env.NEXT_PUBLIC_API_URL);
  if (publicUrl) return publicUrl;

  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000'
    : 'https://www.bazionwebs.com';
}

/**
 * Returns the versioned API v1 base URL (e.g. 'https://<shared-domain>/api/v1').
 * Guarantees no duplicate /api/v1, no trailing slashes, and no hostile prefixes.
 */
export function resolveApiV1Base(): string {
  const origin = resolveApiBase();
  return `${origin}/api/v1`;
}
