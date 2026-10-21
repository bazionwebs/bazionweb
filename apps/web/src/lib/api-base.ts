/**
 * Resolves the NestJS API origin from env.
 *
 * Production env drift has produced values like
 *   "NEXT_PUBLIC_API_URL = https://api.bazionweb.com/api/v1"   (name pasted in)
 *   "https://api.bazionweb.com/api/v1\r"                       (trailing CRLF)
 * This pulls out the usable origin and never doubles the /api/v1 path
 * segment. Returns '' when nothing usable is configured.
 */
export function resolveApiBase(): string {
  const raw = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const match = String(raw).match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = (match ? match[0] : String(raw)).replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  if (!candidate) return '';
  try {
    return new URL(candidate).origin;
  } catch {
    return '';
  }
}
