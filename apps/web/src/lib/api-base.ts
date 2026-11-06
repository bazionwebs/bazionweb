/**
 * Resolves the base origin for calling the NestJS API.
 *
 * Deployment layout (docker-compose.dokploy.yml + Traefik): `web` is public
 * at Host(bazionweb.com, www) and the API is served on the SAME origin at
 * /api/v1 (higher-priority Traefik edge route wired to the api container).
 * The web container declares API_INTERNAL_URL=http://api:4000 on the shared
 * docker network so the runtime catch-all proxy can forward any /api/v1
 * request the edge did not intercept.
 *
 * Resolution order:
 *   1. Browser: NEXT_PUBLIC_API_URL if set, else the current origin —
 *      browser requests go to /api/v1/... on the same domain. Only bake a
 *      dedicated API host (e.g. api.bazionweb.com) into the image when its
 *      DNS record exists and is verified — it is currently NXDOMAIN on all
 *      resolvers.
 *   2. Server: API_INTERNAL_URL (Docker/Dokploy), then NEXT_PUBLIC_API_URL
 *      (external API hosts), then http://localhost:4000 in development /
 *      https://bazionweb.com in production (edge routes /api/v1 to the api
 *      service).
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
    : 'https://bazionweb.com';
}

/**
 * Returns the versioned API v1 base URL (e.g. 'https://<shared-domain>/api/v1').
 * Guarantees no duplicate /api/v1, no trailing slashes, and no hostile prefixes.
 */
export function resolveApiV1Base(): string {
  const origin = resolveApiBase();
  return `${origin}/api/v1`;
}

/**
 * Resolves any relative or absolute URL into a clean absolute URL stripped of any
 * embedded credentials (username/password).
 *
 * This directly prevents the browser error:
 * "Failed to execute 'fetch' on 'Window': Request cannot be constructed from a URL that includes credentials"
 * which browsers throw whenever fetch() is called with a relative path on a document
 * loaded via HTTP Basic Auth or `https://user@domain`.
 */
export function toCleanUrl(pathOrUrl: string): string {
  if (typeof window === 'undefined') {
    return pathOrUrl;
  }
  // If already absolute (http:// or https://)
  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const parsed = new URL(pathOrUrl);
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    } catch {
      return pathOrUrl;
    }
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  // window.location.protocol + '//' + window.location.host is strictly scheme + host[:port]
  // and NEVER contains userinfo/credentials.
  return `${window.location.protocol}//${window.location.host}${cleanPath}`;
}

// Client-side fetch sanitizer safeguard:
// Intercepts window.fetch to automatically strip credentials from relative and absolute string URLs.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch;
  const isPatchedKey = '__bazion_clean_fetch_installed__';
  if (!(window as any)[isPatchedKey]) {
    (window as any)[isPatchedKey] = true;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string') {
        return originalFetch.call(this, toCleanUrl(input), init);
      }
      if (input instanceof URL) {
        const clean = new URL(input.toString());
        clean.username = '';
        clean.password = '';
        return originalFetch.call(this, clean, init);
      }
      return originalFetch.call(this, input, init);
    };
  }
}
