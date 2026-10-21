/**
 * Resolves the NestJS API origin from env.
 *
 * Production env drift has produced values like
 *   "NEXT_PUBLIC_API_URL = https://api.bazionweb.com/api/v1"   (name pasted in)
 *   "https://api.bazionweb.com/api/v1\r"                       (trailing CRLF)
 *   "https://api.bazionweb.com/api/v1/"                        (trailing slash)
 *
 * This safely extracts the usable origin and never doubles the /api/v1 path
 * segment. Defaults cleanly to production origin if empty.
 */
export function resolveApiBase(): string {
  const raw = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const match = String(raw).match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) {
    return process.env.NODE_ENV === 'development'
      ? 'http://localhost:4000'
      : 'https://api.bazionweb.com';
  }
  const candidate = match[0].replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  try {
    return new URL(candidate).origin;
  } catch {
    return process.env.NODE_ENV === 'development'
      ? 'http://localhost:4000'
      : 'https://api.bazionweb.com';
  }
}

/**
 * Returns the versioned API v1 base URL (e.g. 'https://api.bazionweb.com/api/v1').
 * Guarantees no duplicate /api/v1, no trailing slashes, and no hostile prefixes.
 */
export function resolveApiV1Base(): string {
  const origin = resolveApiBase();
  return `${origin}/api/v1`;
}
