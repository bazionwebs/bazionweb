import { Market } from '@/lib/pricingData';

export interface ProposalItem {
  title: string;
  subtitle?: string;
  price: number;
  quantity?: number;
  kind?: string;
  billingPeriod?: 'one-time' | 'month' | 'year';
}

export interface ProposalViewModel {
  proposalCode: string;
  currency: string;
  currencySymbol: string;
  totalAmount: number;
  depositAmount: number;
  finalAmount: number;
  status: 'LOCKED' | 'ACCEPTED' | 'EXPIRED';
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  marketCode?: 'KE' | 'GLOBAL';
  billingCountry?: string;
  createdAt: string;
  expiresAt: string;
  lineItems: ProposalItem[];
  recurringMonthlyCare?: { title: string; amount: number } | null;
  recurringAnnualHosting?: { title: string; amount: number } | null;
  totalYearOne?: number | null;
  depositInvoice?: {
    id?: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status?: string;
  } | null;
}

export type QuotePackageType =
  | 'existing'
  | 'launch'
  | 'business'
  | 'professional'
  | 'ecom-starter'
  | 'ecom-business'
  | 'custom';

export interface QuoteConfig {
  market: Market;
  packageType: QuotePackageType;
  extraPages: number;
  selectedAddOns: string[];
  rushDelivery: boolean;
  domainType?: string;
  domainName?: string;
  care: string;
  hosting: string;
  billingCycle?: string;
}

export interface ServiceMapping {
  packageType?: QuotePackageType;
  care?: string;
  hosting?: string;
  selectedAddOns?: string[];
}

export const SERVICE_TO_QUOTE_CONFIG: Record<string, ServiceMapping> = {
  // Websites service family
  existing: { packageType: 'existing' },
  'existing-website': { packageType: 'existing' },
  byow: { packageType: 'existing' },
  websites: { packageType: 'business' },
  website: { packageType: 'business' },
  web: { packageType: 'business' },
  launch: { packageType: 'launch' },
  business: { packageType: 'business' },
  professional: { packageType: 'professional' },

  // E-commerce service family
  ecommerce: { packageType: 'ecom-starter' },
  'e-commerce': { packageType: 'ecom-starter' },
  'ecom-starter': { packageType: 'ecom-starter' },
  'ecom-business': { packageType: 'ecom-business' },

  // Custom digital systems service family
  'custom-systems': { packageType: 'custom' },
  custom: { packageType: 'custom' },
  systems: { packageType: 'custom' },
  'custom-project': { packageType: 'custom' },

  // Care & ongoing maintenance service family
  care: { care: 'care-business' },
  maintenance: { care: 'care-business' },
  'website-care': { care: 'care-business' },

  // Managed technology & hosting
  'managed-technology': { hosting: 'host-business', care: 'care-business' },
  hosting: { hosting: 'host-business' },
  'cloud-hosting': { hosting: 'host-pro' },

  // Specialized services
  'specialized-services': { selectedAddOns: ['addon-seo-advanced'] },
  seo: { selectedAddOns: ['addon-seo-advanced'] },
  security: { care: 'care-professional' },
};

export const PACKAGE_DEFAULTS = {
  existing: { name: 'Existing Website (Bring Your Own)', basePages: 0, kenyaCost: 0, intlCost: 0 },
  launch: { name: 'Launch Website', basePages: 5, kenyaCost: 25000, intlCost: 450 },
  business: { name: 'Business Website', basePages: 10, kenyaCost: 90000, intlCost: 950 },
  professional: { name: 'Professional Website', basePages: 15, kenyaCost: 160000, intlCost: 1750 },
  'ecom-starter': { name: 'E-Commerce Starter', basePages: 8, kenyaCost: 90000, intlCost: 890 },
  'ecom-business': { name: 'E-Commerce Business', basePages: 15, kenyaCost: 175000, intlCost: 1650 },
  custom: { name: 'Custom Project Build', basePages: 5, kenyaCost: 320000, intlCost: 3600 },
};

/**
 * Normalizes raw API or calculator payloads into a consistent ProposalViewModel.
 * Safely handles:
 * - GET /api/quote envelope: `{ success: true, data: { ... } }`
 * - POST /api/quote envelope: `{ quote: { ... }, breakdown: { ... }, totals: { ... } }`
 * - Direct proposal payload: `{ proposalCode: ..., totalAmount: ... }`
 * - Empty or undefined inputs with safe defaults
 */
export function normalizeProposalPayload(
  rawInput: unknown,
  fallbackContact?: { name: string; email: string; company?: string }
): ProposalViewModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (rawInput && typeof rawInput === 'object') ? (rawInput as Record<string, any>) : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = (raw.data && typeof raw.data === 'object')
    ? raw.data
    : (raw.quote && typeof raw.quote === 'object')
      ? raw.quote
      : raw;

  const proposalCode = String(data.proposalCode || raw.proposalCode || '');
  const currency = String(data.currency || raw.currency || 'KES');
  const currencySymbol = String(
    data.currencySymbol || raw.currencySymbol || (currency === 'KES' ? 'KSh' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$')
  );
  const status = (data.status || raw.status || 'LOCKED') as 'LOCKED' | 'ACCEPTED' | 'EXPIRED';
  const clientName = String(data.clientName || fallbackContact?.name || 'Valued Client');
  const clientEmail = String(data.clientEmail || fallbackContact?.email || '');
  const clientCompany = (data.clientCompany || fallbackContact?.company || undefined) as string | undefined;
  const marketCode = (data.marketCode || raw.marketCode || (currency === 'KES' ? 'KE' : 'GLOBAL')) as 'KE' | 'GLOBAL';
  const createdAt = String(data.createdAt || raw.createdAt || new Date().toISOString());
  const expiresAt = String(data.expiresAt || raw.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString());

  // Handle POST /api/quote response with breakdown
  if (data.breakdown || raw.breakdown) {
    const bd = data.breakdown || raw.breakdown || {};
    const totals = data.totals || raw.totals || {};
    const totalAmount = Number(totals.totalBuild || bd.totalBuildGross || 0);
    const depositAmount = Math.round(totalAmount * 0.5);
    const finalAmount = totalAmount - depositAmount;

    const items: ProposalItem[] = [];
    const pkg = data.package || raw.package || bd.package || {};
    items.push({
      title: pkg.name || 'Custom Web Application Build',
      subtitle: 'Mobile-first Next.js architecture, Tailwind UI, SSL, SEO setup',
      price: Number(pkg.baseCost || bd.package?.amount || 0),
      kind: 'package',
      billingPeriod: 'one-time' as const,
    });

    if (bd.extraPages && Number(bd.extraPages.count) > 0) {
      items.push({
        title: `${bd.extraPages.count} Additional Custom Pages`,
        subtitle: `Custom layout & content structure @ ${currencySymbol} ${Number(bd.extraPages.ratePerPage || 0).toLocaleString()} per page`,
        price: Number(bd.extraPages.amount || 0),
        quantity: Number(bd.extraPages.count),
        kind: 'extra-pages',
        billingPeriod: 'one-time' as const,
      });
    }

    if (Array.isArray(bd.addOns)) {
      for (const addon of bd.addOns) {
        if (!addon || typeof addon !== 'object') continue;
        items.push({
          title: addon.name || 'Functional Module',
          subtitle: 'Included technical integration module',
          price: Number(addon.amount || 0),
          kind: 'add-on',
          billingPeriod: 'one-time' as const,
        });
      }
    }

    if (bd.rushDelivery && bd.rushDelivery.applied) {
      items.push({
        title: 'Priority Rush Delivery (+35%)',
        subtitle: 'Dedicated senior engineering sprint assignment for accelerated handover',
        price: Number(bd.rushDelivery.amount || 0),
        kind: 'rush-delivery',
        billingPeriod: 'one-time' as const,
      });
    }

    const monthlyCareAmount = Number(totals.monthlyCare || bd.careMonthly?.amount || 0);
    const recurringMonthlyCare = monthlyCareAmount > 0
      ? { title: 'Website Proactive Care & Support', amount: monthlyCareAmount }
      : null;

    const annualHostingAmount = Number(totals.annualHosting || bd.hostingAnnual?.amount || 0);
    const recurringAnnualHosting = annualHostingAmount > 0
      ? { title: 'Managed NVMe Cloud Hosting', amount: annualHostingAmount }
      : null;

    const totalYearOne = Number(totals.totalYearOne || 0) || (totalAmount + annualHostingAmount + monthlyCareAmount * 12);

    return {
      proposalCode,
      currency,
      currencySymbol,
      totalAmount,
      depositAmount,
      finalAmount,
      status,
      clientName,
      clientCompany,
      clientEmail,
      marketCode,
      createdAt,
      expiresAt,
      lineItems: items,
      recurringMonthlyCare,
      recurringAnnualHosting,
      totalYearOne,
      depositInvoice: data.depositInvoice || (data.invoice ? {
        id: data.invoice.id,
        invoiceNumber: data.invoice.invoiceNumber,
        amount: Number(data.invoice.amount),
        currency: data.invoice.currency || currency,
        status: data.invoice.status,
      } : null),
    };
  }

  // Handle GET /api/quote?code=... response with lineItems
  const totalAmount = Number(data.totalAmount || 0);
  const depositAmount = Number(data.depositAmount || Math.round(totalAmount * 0.5));
  const finalAmount = Number(data.finalAmount || (totalAmount - depositAmount));

  const items: ProposalItem[] = [];
  let recurringMonthlyCare: { title: string; amount: number } | null = null;
  let recurringAnnualHosting: { title: string; amount: number } | null = null;

  if (Array.isArray(data.lineItems)) {
    for (const item of data.lineItems) {
      if (!item || typeof item !== 'object') continue;
      const price = Number(item.price ?? item.amount ?? 0);
      const title = String(item.title || item.name || 'Line Item');
      const subtitle = item.subtitle ? String(item.subtitle) : undefined;
      const kind = item.kind || (items.length === 0 ? 'package' : 'add-on');
      const billingPeriod = item.billingPeriod || 'one-time';

      // Skip zero-amount tax/metadata rows from legacy proposal records
      if ((title === 'Project Item' || title === 'Line Item') && price === 0 && !item.subtitle) {
        continue;
      }

      if (billingPeriod === 'year' || subtitle === 'yearly recurring') {
        recurringAnnualHosting = { title, amount: price };
      } else if (kind === 'recurring' || billingPeriod === 'month' || subtitle === 'monthly recurring') {
        recurringMonthlyCare = { title, amount: price };
      } else if (kind !== 'tax' && kind !== 'discount') {
        items.push({
          title,
          subtitle,
          price,
          quantity: item.quantity ? Number(item.quantity) : undefined,
          kind,
          billingPeriod: 'one-time' as const,
        });
      }
    }
  }

  const careYear = recurringMonthlyCare ? recurringMonthlyCare.amount * 12 : 0;
  const hostYear = recurringAnnualHosting ? recurringAnnualHosting.amount : 0;
  const totalYearOne = totalAmount + careYear + hostYear;

  return {
    proposalCode,
    currency,
    currencySymbol,
    totalAmount,
    depositAmount,
    finalAmount,
    status,
    clientName,
    clientCompany,
    clientEmail,
    marketCode,
    createdAt,
    expiresAt,
    lineItems: items,
    recurringMonthlyCare,
    recurringAnnualHosting,
    totalYearOne,
    depositInvoice: data.depositInvoice || (data.invoice ? {
      id: data.invoice.id,
      invoiceNumber: data.invoice.invoiceNumber,
      amount: Number(data.invoice.amount),
      currency: data.invoice.currency || currency,
      status: data.invoice.status,
    } : null),
  };
}
