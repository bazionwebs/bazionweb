/** Shared display formatters for dashboard data (no fakes — format real values only). */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
};

export function formatMoney(amount: string | number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  const symbol = CURRENCY_SYMBOLS[currency?.toUpperCase()] ?? `${currency ?? ''} `;
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "OPEN" -> "Open", "IN_PROGRESS" -> "In Progress" */
export function titleCase(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Relative time for activity/age columns ("3d ago", "5h ago"). */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return '—';
  return id.replace(/-/g, '').slice(0, len).toUpperCase();
}

const PROVIDER_LABELS: Record<string, string> = {
  PAYSTACK: 'Paystack (Card / M-Pesa)',
  DARAJA: 'M-Pesa Direct (Daraja)',
  INTASEND: 'IntaSend',
  WISE: 'Corporate Wire (Wise)',
  MANUAL_BANK_TRANSFER: 'Manual Bank Transfer',
  MANUAL: 'Manual',
};

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return '—';
  return PROVIDER_LABELS[provider.toUpperCase()] ?? titleCase(provider);
}
