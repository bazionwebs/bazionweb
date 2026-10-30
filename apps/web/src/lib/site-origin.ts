/**
 * Returns the trusted site origin for magic-link and claim-link tokens.
 * Backed strictly by environment variables — NEVER by untrusted request
 * headers (such as Host or Origin), preventing account takeover via header injection.
 */
export function getTrustedSiteOrigin(): string {
  const envUrl =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // Fall through to default if invalid URL string
    }
  }

  // Canonical production fallback if not set in local env
  if (process.env.NODE_ENV === 'production') {
    return 'https://bazionweb.com';
  }

  return 'http://localhost:3000';
}

