import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubscriptionCheckout from '@/components/billing/SubscriptionCheckout';
import { useCartStore } from '@/lib/cart';

const mockMarketPreference = jest.fn(() => ({
  marketCode: 'KE',
  market: 'kenya',
  marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
  isLocked: true,
}));

jest.mock('../src/hooks/useMarketPreference', () => ({
  useMarketPreference: () => mockMarketPreference(),
}));

const carePlan = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'care-essential',
  name: 'Care Essential',
  tier: 'STARTER',
  priceMonthly: 75,
  priceAnnual: 810,
  priceMonthlyKes: 5000,
  priceAnnualKes: 54000,
  annualDiscountPct: 10,
};

const growthPlan = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'growth',
  name: 'Growth',
  tier: 'RECOMMENDED',
  priceMonthly: 150,
  priceAnnual: 1620,
  priceMonthlyKes: 6500,
  priceAnnualKes: 70200,
  annualDiscountPct: 10,
};

jest.mock('../src/lib/plans', () => {
  const actual = jest.requireActual('../src/lib/plans');
  return {
    ...actual,
    DEFAULT_PLAN_SLUG: 'growth',
    usePlans: () => ({
      plans: [growthPlan, carePlan],
      bySlug: { growth: growthPlan, 'care-essential': carePlan },
      loading: false,
      error: null,
    }),
  };
});

function renderCheckout(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Client Journey: checkout cart-plan sync & mandatory stack gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCartStore.getState().clear();
  });

  it('bills the care plan chosen in the store, not the URL default tier (cart-mode sync)', async () => {
    mockMarketPreference.mockReturnValue({
      marketCode: 'KE',
      market: 'kenya',
      marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
      isLocked: true,
    });

    useCartStore.getState().add({
      kind: 'PLAN',
      id: 'care-essential',
      name: 'Care Essential',
      cycle: 'MONTHLY',
      qty: 1,
      unitPrice: 5000,
      currency: 'KES',
    });
    useCartStore.getState().add({
      kind: 'CATALOG',
      id: 'host-essential',
      name: 'Host Essential',
      cycle: 'year',
      qty: 1,
      unitPrice: 4800,
      currency: 'KES',
    });

    // Store CTA lands on /checkout?cart=1 — no plan param — so the initial slug
    // falls back to the default growth tier. The cart plan must win.
    renderCheckout(<SubscriptionCheckout cartMode />);

    await screen.findByTestId('checkout-total');
    expect(screen.getByTestId('stack-care-row').textContent).toMatch(/Care plan chosen: Care Essential/i);
    expect(screen.queryByText(/Hosting missing/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('KES 9,800');
  });

  it('locks the pay rails until hosting is present in cart mode and unlocks once added', () => {
    mockMarketPreference.mockReturnValue({
      marketCode: 'KE',
      market: 'kenya',
      marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
      isLocked: true,
    });

    useCartStore.getState().add({
      kind: 'PLAN',
      id: 'care-essential',
      name: 'Care Essential',
      cycle: 'MONTHLY',
      qty: 1,
      unitPrice: 5000,
      currency: 'KES',
    });
    useCartStore.getState().add({
      kind: 'CATALOG',
      id: 'addon-mpesa',
      name: 'M-Pesa STK Push Integration',
      cycle: 'one-time',
      qty: 1,
      unitPrice: 5000,
      currency: 'KES',
    });

    renderCheckout(<SubscriptionCheckout cartMode />);

    expect(screen.getByTestId('stack-hosting-row').textContent).toMatch(/Hosting missing/i);
    expect(screen.getByRole('link', { name: /browse hosting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to starter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send mobile-money prompt/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Credit Card/i }));
    expect(screen.getByRole('button', { name: /Proceed to Card Gateway/i })).toBeDisabled();

    act(() => {
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-essential',
        name: 'Host Essential',
        cycle: 'year',
        qty: 1,
        unitPrice: 4800,
        currency: 'KES',
      });
    });

    expect(screen.getByTestId('stack-hosting-row').textContent).toMatch(/Hosting configured: Host Essential/i);
    expect(screen.getByRole('button', { name: /Proceed to Card Gateway/i })).toBeEnabled();
  });

  it('bundle tiers include hosting and never lock the pay rails on hosting grounds', () => {
    mockMarketPreference.mockReturnValue({
      marketCode: 'KE',
      market: 'kenya',
      marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
      isLocked: false,
    });

    useCartStore.getState().add({
      kind: 'PLAN',
      id: 'growth',
      name: 'Growth',
      cycle: 'MONTHLY',
      qty: 1,
      unitPrice: 6500,
      currency: 'KES',
    });

    renderCheckout(<SubscriptionCheckout cartMode />);

    expect(screen.getByTestId('stack-hosting-row').textContent).toMatch(/Hosting included in Growth/i);
    expect(screen.getByRole('button', { name: /Send mobile-money prompt/i })).toBeEnabled();
  });
});
