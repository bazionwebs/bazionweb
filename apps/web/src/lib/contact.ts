const DEFAULT_WHATSAPP_NUMBER = '254721287053';
const DEFAULT_WHATSAPP_DISPLAY = '+254 721 287 053';

function normalizeWhatsAppNumber(value: string | undefined): string {
  if (!value) return DEFAULT_WHATSAPP_NUMBER;
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 8 ? digits : DEFAULT_WHATSAPP_NUMBER;
}

export const SITE_CONTACT = {
  email: 'hello@bazionweb.com',
  supportEmail: 'support@bazionweb.com',
  phoneDisplay: DEFAULT_WHATSAPP_DISPLAY,
  phoneE164: `+${DEFAULT_WHATSAPP_NUMBER}`,
  phoneHref: `tel:+${DEFAULT_WHATSAPP_NUMBER}`,
  whatsappNumber: normalizeWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  whatsappDisplay: process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY?.trim() || DEFAULT_WHATSAPP_DISPLAY,
  location: 'Remote-first · Worldwide',
} as const;

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hello BazionWeb, I'd like to discuss a digital project.";

export type WhatsAppSource =
  | 'floating_widget'
  | 'navbar'
  | 'footer'
  | 'contact_page'
  | 'homepage'
  | 'quote'
  | 'store'
  | 'support_page'
  | 'portal_widget'
  | 'portal_support';

export function buildWhatsAppLink(message?: string): string {
  const base = `https://wa.me/${SITE_CONTACT.whatsappNumber}`;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

type AnalyticsWindow = Window & {
  posthog?: { capture?: (event: string, properties?: Record<string, unknown>) => void };
  gtag?: (...args: unknown[]) => void;
};

export function trackWhatsAppOpen(source: WhatsAppSource) {
  if (typeof window === 'undefined') return;
  const properties = { sourcePage: window.location.pathname, source };
  try {
    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.posthog?.capture?.('whatsapp_opened', properties);
    analyticsWindow.gtag?.('event', 'whatsapp_opened', properties);
  } catch {
    /* Analytics must never block the chat handoff. */
  }
}
