import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubscriptionCheckout from '@/components/billing/SubscriptionCheckout';
import { useCartStore } from '@/lib/cart';
import { useAuthStore } from '@/store/auth.store';
import { sanitizeRedirectPath } from '@/lib/utils';
import {
  ADD_ON_RATE_CARD,
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  DOMAIN_PACKAGES,
  MANAGED_HOSTING_PLANS,
} from '@/lib/pricingData';
import {
  BILLING_CYCLES_META,
  CANONICAL_SERVICE_CATALOG,
  PRICE_BOOK_GLOBAL_2026_V1,
  PRICE_BOOK_KE_2026_V1,
  getProductPrice,
  normalizeCatalogProductId,
  resolveHostingCycleProductId,
} from '@/lib/priceBooks';

const mockMarketPreference = jest.fn(() => ({
  marketCode: 'KE' as const,
  market: 'kenya' as const,
  marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
  isLocked: true,
}));

jest.mock('../src/hooks/useMarketPreference', () => ({
  useMarketPreference: () => mockMarketPreference(),
}));

const carePlan = {
  id: '55555555-5555-4555-8555-555555555555',
  slug: 'care-essential',
  name: 'Care Essential',
  tier: 'STARTER',
  priceMonthly: 75,
  priceAnnual: 810,
  priceMonthlyKes: 5000,
  priceAnnualKes: 54000,
  annualDiscountPct: 10,
};

jest.mock('../src/lib/plans', () => {
  const actual = jest.requireActual('../src/lib/plans');
  return {
    ...actual,
    DEFAULT_PLAN_SLUG: 'care-essential',
    usePlans: () => ({
      plans: [carePlan],
      bySlug: { 'care-essential': carePlan },
      loading: false,
      error: null,
    }),
  };
});

function renderCheckout(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Checkout Direct Sign-In & Price-Book Sync', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    useCartStore.getState().clear();
    useAuthStore.getState().clearSession();
    mockMarketPreference.mockReturnValue({
      marketCode: 'KE',
      market: 'kenya',
      marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
      isLocked: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sanitizeRedirectPath security boundaries', () => {
    it('allows internal checkout paths and blocks external/protocol-relative/auth-loop URLs', () => {
      expect(sanitizeRedirectPath('/checkout?plan=care-essential&cycle=MONTHLY&cart=1')).toBe(
        '/checkout?plan=care-essential&cycle=MONTHLY&cart=1',
      );
      expect(sanitizeRedirectPath('https://evil.example/steal')).toBeNull();
      expect(sanitizeRedirectPath('//evil.example/steal')).toBeNull();
      expect(sanitizeRedirectPath('/\\evil.example')).toBeNull();
      expect(sanitizeRedirectPath('/portal/login?redirect=/checkout')).toBeNull();
      expect(sanitizeRedirectPath('/admin/login')).toBeNull();
    });
  });

  describe('ACCOUNT_EXISTS inline sign-in & magic-link actions + legacy extra-page cart normalization', () => {
    it('normalizes legacy extra-page cart items to rate-extra-page (KES 39,000) and offers direct sign-in + magic-link on HTTP 409 ACCOUNT_EXISTS', async () => {
      // Exact cart from production screenshot: Launch (25,000) + .co.ke (1,500) + Host Business (8,500) + extra-page x2 (4,000) = KES 39,000
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'website-launch',
        name: 'Launch',
        cycle: 'one-time',
        qty: 1,
        unitPrice: 25000,
        currency: 'KES',
      });
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'domain-co-ke',
        name: 'Register .co.ke / .or.ke Domain',
        cycle: 'year',
        qty: 1,
        unitPrice: 1500,
        currency: 'KES',
      });
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-business',
        name: 'Host Business (1 Year (12 Months))',
        cycle: 'year',
        qty: 1,
        unitPrice: 8500,
        currency: 'KES',
      });
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'extra-page',
        name: 'Additional Page',
        cycle: 'one-time',
        qty: 2,
        unitPrice: 2000,
        currency: 'KES',
      });

      const fetchMock = jest.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/invoices/guest/subscribe/paystack')) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              statusCode: 409,
              code: 'ACCOUNT_EXISTS',
              message: 'An account already exists for this email. Sign in to complete payment.',
            }),
          };
        }
        if (String(url).includes('/api/auth/magic-link')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              delivered: true,
              message: 'A secure sign-in link has been delivered.',
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      renderCheckout(<SubscriptionCheckout initialPlanSlug="care-essential" initialCycle="MONTHLY" cartMode />);

      expect(await screen.findByTestId('checkout-total')).toHaveTextContent('KES 39,000');

      // Switch to Credit Card tab and submit as guest with an existing account email
      fireEvent.click(screen.getByRole('button', { name: /Credit Card/i }));
      fireEvent.change(screen.getByPlaceholderText('billing@yourcompany.com'), {
        target: { value: 'bazion001@gmail.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Jane'), { target: { value: 'Abazion' } });
      fireEvent.change(screen.getByPlaceholderText('Wanjiku'), { target: { value: 'Client' } });

      fireEvent.click(screen.getByRole('button', { name: /Proceed to Card Gateway/i }));

      // Verify payload normalized "extra-page" -> "rate-extra-page" before sending to API
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.extras).toEqual(
        expect.arrayContaining([
          { productId: 'website-launch', qty: 1 },
          { productId: 'domain-co-ke', qty: 1 },
          { productId: 'host-business', qty: 1 },
          { productId: 'rate-extra-page', qty: 2 },
        ]),
      );

      // Verify direct sign-in link + inline magic-link button appear right inside the alert banner
      const signInLink = await screen.findByTestId('checkout-direct-signin-link');
      expect(signInLink).toHaveAttribute(
        'href',
        expect.stringContaining('/portal/login?'),
      );
      expect(signInLink.getAttribute('href')).toContain('email=bazion001%40gmail.com');
      expect(signInLink.getAttribute('href')).toContain('redirect=%2Fcheckout');

      const magicBtn = screen.getByTestId('checkout-inline-magic-link');
      fireEvent.click(magicBtn);

      await waitFor(() => {
        expect(screen.getByTestId('checkout-inline-magic-sent')).toHaveTextContent(
          /Sign-in link sent to bazion001@gmail\.com/i,
        );
      });

      const magicCall = fetchMock.mock.calls[1];
      expect(String(magicCall[0])).toContain('/api/auth/magic-link');
      expect(JSON.parse(magicCall[1].body)).toEqual(
        expect.objectContaining({
          email: 'bazion001@gmail.com',
          redirect: expect.stringMatching(/^\/checkout/),
        }),
      );

      // Editing the email clears the ACCOUNT_EXISTS gate automatically
      fireEvent.change(screen.getByPlaceholderText('billing@yourcompany.com'), {
        target: { value: 'freshguest@gmail.com' },
      });
      await waitFor(() => {
        expect(screen.queryByTestId('checkout-direct-signin-link')).not.toBeInTheDocument();
      });
    });
  });

  describe('Exhaustive frontend catalog & rate-card price-book coverage', () => {
    it('resolves every ADD_ON_RATE_CARD item (with rawKes > 0) and naive addon-* variant in both KE and GLOBAL price books', () => {
      const pricedAddOns = ADD_ON_RATE_CARD.filter((a) => a.rawKes > 0);
      expect(pricedAddOns.length).toBeGreaterThanOrEqual(13);

      for (const addon of pricedAddOns) {
        const canonicalId = normalizeCatalogProductId(addon.id);
        const naivePrefixedId = addon.id.startsWith('addon-') ? addon.id : `addon-${addon.id}`;

        const keItem = getProductPrice(addon.id, 'KE');
        const kePrefixed = getProductPrice(naivePrefixedId, 'KE');
        const globalItem = getProductPrice(addon.id, 'GLOBAL');
        const globalPrefixed = getProductPrice(naivePrefixedId, 'GLOBAL');

        expect(keItem).not.toBeNull();
        expect(kePrefixed).not.toBeNull();
        expect(globalItem).not.toBeNull();
        expect(globalPrefixed).not.toBeNull();

        expect(keItem!.productId).toBe(canonicalId);
        expect(keItem!.amount).toBe(addon.rawKes);
        expect(globalItem!.amount).toBe(addon.rawUsd);
      }
    });

    it('resolves every Website, E-Commerce, Custom System, Domain, Canonical B2B Catalog, and Multi-Cycle Hosting SKU in both KE and GLOBAL', () => {
      const allIds = new Set<string>([
        'website-existing',
        ...WEBSITE_PACKAGES.map((p) => (p.id === 'corporate' ? 'website-enterprise' : `website-${p.id}`)),
        ...ECOMMERCE_PACKAGES.map((p) => `ecommerce-${p.id.replace(/^ecom-/, '')}`),
        'custom-tier-1',
        'custom-tier-2',
        'custom-tier-3',
        'service-admin-hub-starter',
        'service-admin-hub-corporate',
        'service-admin-hub-pro',
        ...DOMAIN_PACKAGES.map((d) => d.id),
        ...CANONICAL_SERVICE_CATALOG.map((c) => c.id),
        ...Object.keys(PRICE_BOOK_KE_2026_V1.items),
        ...Object.keys(PRICE_BOOK_GLOBAL_2026_V1.items),
      ]);

      for (const host of MANAGED_HOSTING_PLANS) {
        allIds.add(host.id);
        for (const cycle of BILLING_CYCLES_META) {
          allIds.add(resolveHostingCycleProductId(host.id, cycle.cycle));
        }
      }

      for (const id of allIds) {
        const ke = getProductPrice(id, 'KE');
        const gl = getProductPrice(id, 'GLOBAL');
        expect(ke).not.toBeNull();
        expect(gl).not.toBeNull();
        expect(Number.isFinite(ke!.amount)).toBe(true);
        expect(Number.isFinite(gl!.amount)).toBe(true);
      }
    });
  });
});
