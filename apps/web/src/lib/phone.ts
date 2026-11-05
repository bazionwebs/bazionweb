/**
 * Kenyan Mobile Phone Validation and Normalization
 * Standard Kenyan mobile numbers conform to the Safaricom / Airtel / Telkom numbering plan:
 * Regex: ^(?:254|\+254|0)?(7|1)\d{8}$
 */

export const KENYAN_PHONE_REGEX = /^(?:254|\+254|0)?(7|1)\d{8}$/;

/**
 * Validates a raw phone string against Kenyan mobile operator standards.
 * Permits local (07XX, 01XX), international (+254, 254), or short (7XX, 1XX) formats.
 */
export function isValidKenyanPhone(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const stripped = raw.replace(/[\s\-\(\)\.]/g, '');
  return KENYAN_PHONE_REGEX.test(stripped);
}

/**
 * Normalizes any valid Kenyan mobile phone number into the strict 12-digit
 * format without '+' (e.g. 2547XXXXXXXX or 2541XXXXXXXX) required by Safaricom Daraja
 * and Paystack M-Pesa APIs. Returns null if the phone is invalid.
 */
export function normalizeKenyanPhoneNumber(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const stripped = raw.replace(/[\s\-\(\)\.]/g, '');
  const match = stripped.match(KENYAN_PHONE_REGEX);
  if (!match) return null;
  const last9 = stripped.slice(-9);
  return `254${last9}`;
}

/**
 * Formats a Kenyan phone number into standard local display format: '0712 345 678' or '0110 123 456'
 */
export function formatKenyanPhoneDisplay(raw?: string | null): string {
  const normalized = normalizeKenyanPhoneNumber(raw);
  if (!normalized) return raw ?? '';
  const last9 = normalized.slice(3); // 7XXXXXXXX or 1XXXXXXXX
  return `0${last9.slice(0, 3)} ${last9.slice(3, 6)} ${last9.slice(6)}`;
}
