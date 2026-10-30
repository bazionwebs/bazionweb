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
 */
export function isTrustedCheckoutUrl(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.paystack.com' ||
        parsed.hostname === 'standard.paystack.co' ||
        parsed.hostname.endsWith('.paystack.co') ||
        parsed.hostname.endsWith('.paystack.com'))
    );
  } catch {
    return false;
  }
}
