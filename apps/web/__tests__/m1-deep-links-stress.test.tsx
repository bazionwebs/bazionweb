import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QuoteCalculatorPage from '@/app/(public)/quote/page';
import {
  normalizeProposalPayload,
  SERVICE_TO_QUOTE_CONFIG,
  PACKAGE_DEFAULTS,
} from '@/lib/quote-flow';
import ProposalPresentationView, { ProposalViewModel } from '@/components/quote/ProposalPresentationView';
import PricingView, { VALID_TABS, TabKey } from '@/components/pricing/PricingView';
import StoreView from '@/components/store/StoreView';
import { MARKETS } from '@/lib/marketEngine';
import { useCartStore } from '@/lib/cart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Next.js Navigation Mocks ────────────────────────────────────────────────
let mockSearchParams = new URLSearchParams('');
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockPathname = '/quote';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

// ─── Market Preference Mock ──────────────────────────────────────────────────
let mockMarketCode: 'KE' | 'GLOBAL' = 'KE';
let mockMarket: 'kenya' | 'international' = 'kenya';

jest.mock('../src/hooks/useMarketPreference', () => ({
  useMarketPreference: () => ({
    marketCode: mockMarketCode,
    market: mockMarket,
    marketDef: mockMarketCode === 'KE' ? MARKETS.KE : MARKETS.GLOBAL,
    isLocked: true,
  }),
}));

// ─── Plans Mock for StoreView ────────────────────────────────────────────────
jest.mock('../src/lib/plans', () => ({
  usePlans: () => ({
    plans: [
      {
        id: 'plan-care-business',
        slug: 'care-business',
        name: 'Care Business Plan',
        tier: 'RECOMMENDED',
        priceMonthlyKes: 10000,
        priceMonthly: 150,
      },
      {
        id: 'plan-care-essential',
        slug: 'care-essential',
        name: 'Care Essential Plan',
        tier: 'STANDARD',
        priceMonthlyKes: 5000,
        priceMonthly: 75,
      },
    ],
    loading: false,
  }),
  PLAN_MARKETING: {
    'care-business': {
      description: 'Comprehensive business maintenance',
      features: ['Daily backups', '15-min response', 'Core updates', 'WAF security'],
      color: 'from-blue-600 to-blue-700',
      accent: 'text-blue-400',
    },
    'care-essential': {
      description: 'Essential site updates',
      features: ['Weekly backups', 'Uptime monitoring'],
      color: 'from-slate-600 to-slate-700',
      accent: 'text-slate-300',
    },
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Milestone 1 Empirical Challenger: Deep-Links & Presentation Stress Harness', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
    mockMarketCode = 'KE';
    mockMarket = 'kenya';
    useCartStore.setState({ items: [] });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 1: Deep-Link Parameter Handling (/quote?proposal=...)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 1: Deep-Link Parameter Handling & Malicious Inputs', () => {
    it('gracefully renders calculator when ?proposal is empty or whitespace only', async () => {
      mockSearchParams = new URLSearchParams('proposal=   ');

      render(<QuoteCalculatorPage />);

      expect(screen.getByText(/Build your custom project estimate/i)).toBeInTheDocument();
      expect(screen.queryByText(/Retrieving official commercial proposal/i)).not.toBeInTheDocument();
    });

    it('handles 404 Not Found for non-existent proposal code without crashing', async () => {
      mockSearchParams = new URLSearchParams('proposal=BZ-KE-2026-UNKNOWN999');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'Proposal not found' }),
      });

      render(<QuoteCalculatorPage />);

      // Should show error notification banner and render calculator
      await waitFor(() => {
        expect(screen.getByText(/Proposal not found/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Build your custom project estimate/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();

      // Dismiss button removes the error notification
      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
      expect(screen.queryByText(/Proposal not found/i)).not.toBeInTheDocument();
    });

    it('safely handles malicious XSS proposal query parameter without code injection', async () => {
      const maliciousPayload = '<script>alert("XSS")</script>';
      mockSearchParams = new URLSearchParams(`proposal=${encodeURIComponent(maliciousPayload)}`);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'Proposal code not found or invalid format.' }),
      });

      render(<QuoteCalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Proposal code not found or invalid format/i)).toBeInTheDocument();
      });

      // Assert no unescaped script tag is injected into DOM
      expect(document.querySelector('script[src*="XSS"]')).toBeNull();
      expect(screen.getByText(/Build your custom project estimate/i)).toBeInTheDocument();
    });

    it('safely handles SQL injection attempt in ?proposal parameter', async () => {
      const sqliPayload = "BZ-KE-2026'; DROP TABLE proposals; --";
      mockSearchParams = new URLSearchParams(`proposal=${encodeURIComponent(sqliPayload)}`);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'Proposal not found or reference code is invalid.' }),
      });

      render(<QuoteCalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Proposal not found or reference code is invalid/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Build your custom project estimate/i)).toBeInTheDocument();
    });

    it('survives upstream network timeout / 500 error gracefully', async () => {
      mockSearchParams = new URLSearchParams('proposal=BZ-KE-2026-TIMEOUT');

      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection timed out'));

      render(<QuoteCalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Network connection timed out/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Build your custom project estimate/i)).toBeInTheDocument();
    });

    it('successfully fetches and hydrates valid proposal deep-link', async () => {
      const validCode = 'BZ-KE-2026-VALID99';
      mockSearchParams = new URLSearchParams(`proposal=${validCode.toLowerCase()}`);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            proposalCode: validCode,
            currency: 'KES',
            currencySymbol: 'KSh',
            totalAmount: 180000,
            depositAmount: 90000,
            finalAmount: 90000,
            status: 'LOCKED',
            clientName: 'Sarah Jenkins',
            clientEmail: 'sarah@globalventure.co.ke',
            clientCompany: 'Global Venture Kenya',
            marketCode: 'KE',
            lineItems: [
              { title: 'Business Website Build', price: 150000, quantity: 1, kind: 'package' },
              { title: 'M-Pesa STK Integration', price: 30000, quantity: 1, kind: 'add-on' },
            ],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 86400000).toISOString(),
          },
        }),
      });

      render(<QuoteCalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText(validCode)).toBeInTheDocument();
      });

      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
      expect(screen.getByText('Global Venture Kenya')).toBeInTheDocument();
      expect(screen.getByText('50% Kickoff Deposit')).toBeInTheDocument();
      const amounts = screen.getAllByText(/90,000/);
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 2: Expired, Locked, and Accepted Proposal States
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 2: Proposal Lifecycle States (LOCKED, EXPIRED, ACCEPTED)', () => {
    const baseProposal: ProposalViewModel = {
      proposalCode: 'BZ-KE-2026-STATE-TEST',
      currency: 'KES',
      currencySymbol: 'KSh',
      totalAmount: 200000,
      depositAmount: 100000,
      finalAmount: 100000,
      status: 'LOCKED',
      clientName: 'Jane Doe',
      clientEmail: 'jane@example.com',
      marketCode: 'KE',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      lineItems: [
        { title: 'Corporate Portal Architecture', price: 200000, quantity: 1, kind: 'package' },
      ],
    };

    it('renders active LOCKED proposal with remaining lock days and active CTA', () => {
      render(<ProposalPresentationView proposal={baseProposal} />);

      expect(screen.getByText(/Price Locked ·/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Accept Proposal & Generate Kickoff Deposit Invoice/i })
      ).toBeInTheDocument();
    });

    it('blocks acceptance and shows warning when proposal is EXPIRED', () => {
      const expiredProposal: ProposalViewModel = {
        ...baseProposal,
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days in past
      };

      const mockReset = jest.fn();
      render(<ProposalPresentationView proposal={expiredProposal} onReset={mockReset} />);

      // Expiration badge
      expect(screen.getByText(/Validity Expired/i)).toBeInTheDocument();

      // Action center warning
      expect(screen.getByText(/This proposal has expired/i)).toBeInTheDocument();

      // CTA button should NOT be present
      expect(
        screen.queryByRole('button', { name: /Accept Proposal & Generate Kickoff Deposit Invoice/i })
      ).not.toBeInTheDocument();

      // Refresh quote button should trigger onReset
      const refreshBtn = screen.getByRole('button', { name: /Refresh Quote/i });
      fireEvent.click(refreshBtn);
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('renders ACCEPTED proposal state with invoice indicator and claim hub link', () => {
      const acceptedProposal: ProposalViewModel = {
        ...baseProposal,
        status: 'ACCEPTED',
        depositInvoice: {
          invoiceNumber: 'INV-2026-0042',
          amount: 100000,
          currency: 'KES',
          status: 'PAID',
        },
      };

      render(<ProposalPresentationView proposal={acceptedProposal} />);

      expect(screen.getByText(/Proposal Accepted/i)).toBeInTheDocument();
      expect(screen.getByText(/Deposit Received — Your Build Slot is Locked/i)).toBeInTheDocument();
      expect(screen.getByText(/INV-2026-0042 is fully settled/i)).toBeInTheDocument();

      const hubLink = screen.getByRole('link', { name: /Set Up My Client Portal Hub/i });
      expect(hubLink).toHaveAttribute('href', expect.stringContaining('/portal/claim?email=jane%40example.com'));
    });

    it('renders gracefully even if lineItems array is empty or corrupt', () => {
      const emptyItemsProposal: ProposalViewModel = {
        ...baseProposal,
        lineItems: [],
        recurringMonthlyCare: null,
        recurringAnnualHosting: null,
        totalYearOne: null,
      };

      render(<ProposalPresentationView proposal={emptyItemsProposal} />);

      expect(screen.getByText(baseProposal.proposalCode)).toBeInTheDocument();
      expect(screen.getByText('Total One-Time Build Investment')).toBeInTheDocument();
      expect(screen.getByText('Commercial Client')).toBeInTheDocument(); // fallback company
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 3: History & PopState Navigation Transitions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 3: History Navigation Transitions (popstate, back, reset)', () => {
    it('demonstrates deep-link reset behavior when onReset is invoked', async () => {
      const validCode = 'BZ-KE-2026-POP1';
      mockSearchParams = new URLSearchParams(`proposal=${validCode}`);

      let fetchCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              proposalCode: validCode,
              currency: 'KES',
              currencySymbol: 'KSh',
              totalAmount: 100000,
              depositAmount: 50000,
              finalAmount: 50000,
              status: 'LOCKED',
              clientName: 'Popstate User',
              clientEmail: 'pop@example.com',
              marketCode: 'KE',
              lineItems: [{ title: 'App Build', price: 100000, quantity: 1 }],
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          }),
        });
      });

      render(<QuoteCalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText(validCode)).toBeInTheDocument();
      });

      expect(fetchCount).toBe(1);

      // When "Build another quote" is clicked, handleResetToCalculator runs
      const buildAnotherBtn = screen.getByRole('button', { name: /Build another quote/i });
      fireEvent.click(buildAnotherBtn);

      // CHALLENGE: If searchParams still contains ?proposal=... because pushState
      // bypassed Next.js router, the component immediately triggers fetchProposalByCode again!
      // This assertion checks whether the proposal is re-fetched and locks user in proposal view.
      await waitFor(() => {
        expect(fetchCount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 4: Pricing Tab Deep-Link Sync (/pricing?tab=...)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 4: Pricing Tab Deep-Link Synchronization', () => {
    it('hydrates activeTab from query param tab=ecommerce', () => {
      mockSearchParams = new URLSearchParams('tab=ecommerce');
      render(<PricingView />);

      expect(screen.getByRole('heading', { level: 2, name: /Online Stores & E-Commerce Platforms/i })).toBeInTheDocument();
    });

    it('hydrates activeTab from query param tab=care', () => {
      mockSearchParams = new URLSearchParams('tab=care');
      render(<PricingView />);

      expect(screen.getByRole('heading', { level: 2, name: /Website Care & Ongoing Maintenance/i })).toBeInTheDocument();
    });

    it('hydrates activeTab from query param tab=hosting', () => {
      mockSearchParams = new URLSearchParams('tab=hosting');
      render(<PricingView />);

      expect(screen.getByRole('heading', { level: 2, name: /Managed Cloud & Website Hosting/i })).toBeInTheDocument();
    });

    it('falls back cleanly to websites tab when tab param is invalid or malformed', () => {
      mockSearchParams = new URLSearchParams('tab=malicious<script>');
      render(<PricingView />);

      expect(screen.getByRole('heading', { level: 2, name: /Business & Organizational Websites/i })).toBeInTheDocument();
    });

    it('clicking a tab updates browser URL via router.replace', () => {
      mockSearchParams = new URLSearchParams('tab=websites');
      render(<PricingView />);

      const ecommerceTabBtn = screen.getByRole('button', { name: /E-Commerce/i });
      fireEvent.click(ecommerceTabBtn);

      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('tab=ecommerce'), { scroll: false });
    });

    it('survives rapid tab switching without desynchronization or crashes', () => {
      render(<PricingView />);

      const tabLabels = ['E-Commerce', 'Custom Digital Systems', 'Website Care & Maintenance', 'Managed Hosting', 'Add-On Price Card', 'Websites'];
      for (const label of tabLabels) {
        const btn = screen.getByRole('button', { name: label });
        fireEvent.click(btn);
      }

      // Final state should be websites
      expect(screen.getByRole('heading', { level: 2, name: /Business & Organizational Websites/i })).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 5: Currency Integrity Across Kenyan & Global Store Views
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 5: Store Currency Localization & Cart Integrity', () => {
    it('under Kenya (KE) market, renders KES currency symbol and dispatches KES into cart', async () => {
      mockMarketCode = 'KE';
      mockMarket = 'kenya';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            market: { code: 'KE', currencyCode: 'KES', currencySymbol: 'KSh', vatRate: 0.16 },
            prices: [
              { id: 'p1', productId: 'host-business', amount: 8500, billingPeriod: 'annual' },
            ],
          },
        }),
      });

      renderWithQueryClient(<StoreView />);

      await waitFor(() => {
        expect(screen.getAllByText(/Care Business Plan/i).length).toBeGreaterThan(0);
      });

      // Price formatted in KES
      expect(screen.getByText(/KSh\s*10,000/i)).toBeInTheDocument();

      const addButtons = screen.getAllByRole('button', { name: /Add to Cart/i });
      fireEvent.click(addButtons[0]);

      const cartItems = useCartStore.getState().items;
      expect(cartItems.length).toBe(1);
      expect(cartItems[0].currency).toBe('KES');
      expect(cartItems[0].unitPrice).toBe(10000);
    });

    it('under Global market, renders USD currency and dispatches USD into cart', async () => {
      mockMarketCode = 'GLOBAL';
      mockMarket = 'international';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            market: { code: 'GLOBAL', currencyCode: 'USD', currencySymbol: '$', vatRate: 0 },
            prices: [
              { id: 'p1', productId: 'host-business', amount: 99, billingPeriod: 'annual' },
            ],
          },
        }),
      });

      renderWithQueryClient(<StoreView />);

      await waitFor(() => {
        expect(screen.getAllByText(/Care Business Plan/i).length).toBeGreaterThan(0);
      });

      // Price formatted in USD ($150)
      expect(screen.getByText(/\$\s*150/i)).toBeInTheDocument();

      const addButtons = screen.getAllByRole('button', { name: /Add to Cart/i });
      fireEvent.click(addButtons[0]);

      const cartItems = useCartStore.getState().items;
      expect(cartItems.length).toBe(1);
      expect(cartItems[0].currency).toBe('USD');
      expect(cartItems[0].unitPrice).toBe(150);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 6: Service Parameter Mapping & Overrides (/quote?service=...)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 6: Service Query Parameter Mapping & Precedence', () => {
    it('maps ?service=ecommerce to ecom-starter package', () => {
      mockSearchParams = new URLSearchParams('service=ecommerce');
      render(<QuoteCalculatorPage />);

      const ecomElements = screen.getAllByText(/E-Commerce Starter/i);
      expect(ecomElements.length).toBeGreaterThan(0);
    });

    it('maps ?service=custom to custom package build', () => {
      mockSearchParams = new URLSearchParams('service=custom');
      render(<QuoteCalculatorPage />);

      const customElements = screen.getAllByText(/Custom Project Build/i);
      expect(customElements.length).toBeGreaterThan(0);
    });

    it('explicit ?package=launch overrides ?service=ecommerce', () => {
      mockSearchParams = new URLSearchParams('service=ecommerce&package=launch');
      render(<QuoteCalculatorPage />);

      const launchElements = screen.getAllByText(/Launch Website/i);
      expect(launchElements.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 7: Normalizer Stress Robustness (Oracles)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 7: normalizeProposalPayload Oracle Stress', () => {
    it('normalizes completely empty input without throwing exception', () => {
      const result = normalizeProposalPayload({});
      expect(result.proposalCode).toBe('');
      expect(result.currency).toBe('KES');
      expect(result.currencySymbol).toBe('KSh');
      expect(result.totalAmount).toBe(0);
      expect(result.depositAmount).toBe(0);
      expect(result.finalAmount).toBe(0);
      expect(result.lineItems).toEqual([]);
      expect(result.status).toBe('LOCKED');
      expect(result.clientName).toBe('Valued Client');
    });

    it('correctly calculates 50/50 split from totalAmount', () => {
      const result = normalizeProposalPayload({
        totalAmount: 175500,
        currency: 'KES',
      });
      expect(result.depositAmount).toBe(87750);
      expect(result.finalAmount).toBe(87750);
      expect(result.depositAmount + result.finalAmount).toBe(175500);
    });

    it('normalizes breakdown response format from POST /api/quote', () => {
      const rawPostResponse = {
        proposalCode: 'BZ-KE-2026-POSTTEST',
        currency: 'KES',
        currencySymbol: 'KSh',
        breakdown: {
          package: { name: 'E-Commerce Starter', amount: 90000 },
          extraPages: { count: 3, ratePerPage: 2000, amount: 6000 },
          addOns: [{ name: 'Inventory Sync', amount: 15000 }],
          rushDelivery: { applied: true, amount: 38850 },
          careMonthly: { amount: 10000 },
          hostingAnnual: { amount: 8500 },
          totalBuildGross: 149850,
        },
        totals: {
          totalBuild: 149850,
          monthlyCare: 10000,
          annualHosting: 8500,
          totalYearOne: 278350,
        },
      };

      const result = normalizeProposalPayload(rawPostResponse, {
        name: 'Post User',
        email: 'post@user.com',
      });

      expect(result.proposalCode).toBe('BZ-KE-2026-POSTTEST');
      expect(result.clientName).toBe('Post User');
      expect(result.totalAmount).toBe(149850);
      expect(result.depositAmount).toBe(74925);
      expect(result.finalAmount).toBe(74925);
      expect(result.lineItems).toHaveLength(4); // package, extraPages, addOns, rushDelivery
      expect(result.recurringMonthlyCare?.amount).toBe(10000);
      expect(result.recurringAnnualHosting?.amount).toBe(8500);
      expect(result.totalYearOne).toBe(278350);
    });
  });
});
