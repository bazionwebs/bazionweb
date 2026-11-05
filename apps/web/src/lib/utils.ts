import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapes characters that are meaningful in HTML text or attributes.
 * Prevents HTML and attribute injection in transactional emails and server-rendered HTML.
 */
export function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and normalizes an external URL. Only permits http: and https: protocols,
 * preventing javascript:, data:, and vbscript: XSS vectors.
 */
export function toSafeExternalUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates hosted checkout redirect destinations (e.g. Paystack).
 * Strictly requires HTTPS and ensures the destination hostname matches
 * an approved payment processor domain (e.g. paystack.com, checkout.paystack.com, paystack.co)
 * rejecting javascript:, data:, relative, protocol-relative (//evil.com), or deceptive spoofing.
 */
export function isTrustedCheckoutUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const trustedDomains = ['paystack.com', 'paystack.co'];
    return (
      trustedDomains.includes(hostname) ||
      trustedDomains.some((domain) => hostname.endsWith('.' + domain))
    );
  } catch {
    return false;
  }
}

export {
  KENYAN_PHONE_REGEX,
  isValidKenyanPhone,
  normalizeKenyanPhoneNumber,
  formatKenyanPhoneDisplay,
} from './phone';

