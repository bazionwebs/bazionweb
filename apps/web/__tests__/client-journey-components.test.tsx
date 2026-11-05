import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientJourneyProgress, { JOURNEY_STEPS } from '@/components/navigation/ClientJourneyProgress';
import ProposalPresentationView, { ProposalViewModel } from '@/components/quote/ProposalPresentationView';
import SubscriptionCheckout from '@/components/billing/SubscriptionCheckout';
import CartView from '@/components/billing/CartView';
import { useCartStore } from '@/lib/cart';

const mockMarketPreference = jest.fn(() => ({
  marketCode: 'GLOBAL',
  market: 'international',
  marketDef: { code: 'GLOBAL', currency: 'USD', currencySymbol: '$' },
  isLocked: true,
}));

jest.mock('../src/hooks/useMarketPreference', () => ({
  useMarketPreference: () => mockMarketPreference(),
}));

const mockPlansList = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    slug: 'care-essential',
    name: 'Care Essential',
    tier: 'STARTER',
    priceMonthly: 75,
    priceAnnual: 810,
    priceMonthlyKes: 5000,
    priceAnnualKes: 54000,
    annualDiscountPct: 10,
  },
];

jest.mock('../src/lib/plans', () => {
  const actual = jest.requireActual('../src/lib/plans');
  return {
    ...actual,
    usePlans: () => ({
      plans: mockPlansList,
      bySlug: { 'care-essential': mockPlansList[0] },
      loading: false,
      error: null,
    }),
  };
});

// Mock next/navigation
const mockReplace = jest.fn();
const mockUseSearchParams = jest.fn(() => new URLSearchParams(''));
const mockUsePathname = jest.fn(() => '/pricing');

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
  }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
}));

describe('Milestone 1 Frontend Components & Journey Flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ClientJourneyProgress Component', () => {
    it('renders all 5 canonical journey steps', () => {
      render(<ClientJourneyProgress currentStep={1} />);

      expect(JOURNEY_STEPS).toHaveLength(5);
      expect(JOURNEY_STEPS[0].title).toBe('Package Selection');
      expect(JOURNEY_STEPS[1].title).toBe('Scope & Proposal');
      expect(JOURNEY_STEPS[2].title).toBe('Kickoff Invoicing');
      expect(JOURNEY_STEPS[3].title).toBe('Secure Settlement');
      expect(JOURNEY_STEPS[4].title).toBe('Client Workspace');

      const step1Elements = screen.getAllByText('Package Selection');
      expect(step1Elements.length).toBeGreaterThan(0);

      const step2Elements = screen.getAllByText('Scope & Proposal');
      expect(step2Elements.length).toBeGreaterThan(0);
    });

    it('highlights current step with aria-current="step" and computes percent', () => {
      render(<ClientJourneyProgress currentStep={3} />);

      const activeStepElements = screen.getAllByText('Kickoff Invoicing');
      expect(activeStepElements.length).toBeGreaterThan(0);

      // Verify progress percent calculation (Step 3 of 5 = 60%)
      const progressPercentElements = screen.getAllByText('60% Complete');
      expect(progressPercentElements.length).toBeGreaterThan(0);

      const currentStepContainer = document.querySelector('[aria-current="step"]');
      expect(currentStepContainer).toBeInTheDocument();
      expect(currentStepContainer).toHaveTextContent('Kickoff Invoicing');
    });

    it('renders in light variant when specified', () => {
      const { container } = render(<ClientJourneyProgress currentStep={2} variant="light" />);
      expect(container.querySelector('nav')).toBeInTheDocument();
    });
  });

  describe('ProposalPresentationView Component', () => {
    const mockProposal: ProposalViewModel = {
      proposalCode: 'BZ-KE-2026-TESTPROPOSAL',
      currency: 'KES',
      currencySymbol: 'KSh',
      totalAmount: 160000,
      depositAmount: 80000,
      finalAmount: 80000,
      status: 'LOCKED',
      clientName: 'Dr. Mwangi',
      clientCompany: 'Nairobi Health Clinic',
      clientEmail: 'dr.mwangi@nairobihealth.co.ke',
      marketCode: 'KE',
      createdAt: '2026-04-10T12:00:00.000Z',
      expiresAt: '2026-05-10T12:00:00.000Z',
      lineItems: [
        {
          title: 'Business Digital Flagship',
          subtitle: 'Up to 10 bespoke pages, responsive UI, CMS integration',
          price: 130000,
          quantity: 1,
          kind: 'package',
        },
        {
          title: 'Automated Online Appointment Booking',
          subtitle: 'Real-time patient calendar and reminder system',
          price: 30000,
          quantity: 1,
          kind: 'addon',
        },
      ],
      recurringMonthlyCare: {
        title: 'Business Care Engine',
        amount: 15000,
      },
      recurringAnnualHosting: {
        title: 'Managed High-Availability Cloud VPS',
        amount: 45000,
      },
      totalYearOne: 160000 + 15000 * 12 + 45000,
      depositInvoice: null,
    };

    it('renders proposal header with reference code and client info', () => {
      render(<ProposalPresentationView proposal={mockProposal} />);

      expect(screen.getByText('BZ-KE-2026-TESTPROPOSAL')).toBeInTheDocument();
      expect(screen.getByText('Dr. Mwangi')).toBeInTheDocument();
      expect(screen.getByText('Nairobi Health Clinic')).toBeInTheDocument();
      expect(screen.getByText('dr.mwangi@nairobihealth.co.ke')).toBeInTheDocument();
    });

    it('displays 50/50 payment split terms and milestone amounts accurately', () => {
      render(<ProposalPresentationView proposal={mockProposal} />);

      expect(screen.getByText(/Transparent 50\/50 Milestone Payment Schedule/i)).toBeInTheDocument();
      expect(screen.getByText('50% Kickoff Deposit')).toBeInTheDocument();
      expect(screen.getByText('50% Final Launch Settlement')).toBeInTheDocument();

      // Check deposit and balance figures
      const depositFigures = screen.getAllByText(/80,000/);
      expect(depositFigures.length).toBeGreaterThan(0);
    });

    it('renders all 5 delivery roadmap phases', () => {
      render(<ProposalPresentationView proposal={mockProposal} />);

      expect(screen.getByText('Discovery & Spec')).toBeInTheDocument();
      expect(screen.getByText('UI/UX Design')).toBeInTheDocument();
      expect(screen.getByText('Core Build')).toBeInTheDocument();
      expect(screen.getByText('QA & Speed')).toBeInTheDocument();
      expect(screen.getByText('Launch & Handover')).toBeInTheDocument();
    });

    it('renders WhatsApp consultation link and print trigger', () => {
      const originalPrint = window.print;
      window.print = jest.fn();

      render(<ProposalPresentationView proposal={mockProposal} />);

      const printBtn = screen.getByRole('button', { name: /Download \/ Print PDF/i });
      expect(printBtn).toBeInTheDocument();
      fireEvent.click(printBtn);
      expect(window.print).toHaveBeenCalledTimes(1);

      const whatsappBtn = screen.getByRole('link', { name: /WhatsApp Engineer/i });
      expect(whatsappBtn).toBeInTheDocument();
      expect(whatsappBtn).toHaveAttribute('href');
      expect(whatsappBtn.getAttribute('href')).toContain('wa.me');

      window.print = originalPrint;
    });

    it('renders IP Safeguards and commercial guarantee statement', () => {
      render(<ProposalPresentationView proposal={mockProposal} />);

      expect(screen.getByText(/Contractual Safeguards & Intellectual Property/i)).toBeInTheDocument();
      expect(screen.getByText(/100% IP & Code Ownership/i)).toBeInTheDocument();
      expect(screen.getByText(/30-Day Defect Warranty/i)).toBeInTheDocument();
      expect(screen.getByText(/Guaranteed Fixed Pricing/i)).toBeInTheDocument();
    });
  });

  describe('SubscriptionCheckout Cart & Currency Consistency', () => {
    beforeEach(() => {
      useCartStore.getState().clear();
    });

    it('renders USD cart add-ons in USD and sums USD totals accurately without dividing by KES FX rate', () => {
      mockMarketPreference.mockReturnValue({
        marketCode: 'GLOBAL',
        market: 'international',
        marketDef: { code: 'GLOBAL', currency: 'USD', currencySymbol: '$' },
        isLocked: true,
      });

      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-business',
        name: 'Host Business',
        cycle: 'year',
        qty: 1,
        unitPrice: 99,
        currency: 'USD',
      });

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <SubscriptionCheckout initialPlanSlug="care-essential" initialCycle="MONTHLY" cartMode={true} />
        </QueryClientProvider>,
      );

      // Should display $99 for Host Business and Add-ons subtotal, never "KES 99"
      expect(screen.queryByText('KES 99')).not.toBeInTheDocument();
      expect(screen.getAllByText('$99').length).toBeGreaterThanOrEqual(2);

      // Care Essential ($75) + Host Business ($99) = $174 USD (never $76 USD)
      expect(screen.queryByText('$76 USD')).not.toBeInTheDocument();
      expect(screen.getAllByText('$174 USD').length).toBeGreaterThanOrEqual(2);
    });

    it('renders KES cart add-ons in KES when marketCode is KE', () => {
      mockMarketPreference.mockReturnValue({
        marketCode: 'KE',
        market: 'kenya',
        marketDef: { code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
        isLocked: true,
      });

      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-business',
        name: 'Host Business',
        cycle: 'year',
        qty: 1,
        unitPrice: 8500,
        currency: 'KES',
      });

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <SubscriptionCheckout initialPlanSlug="care-essential" initialCycle="MONTHLY" cartMode={true} />
        </QueryClientProvider>,
      );

      expect(screen.getAllByText('KES 8,500').length).toBeGreaterThanOrEqual(2);
      // Care Essential (KES 5,000) + Host Business (KES 8,500) = KES 13,500
      expect(screen.getAllByText('KES 13,500').length).toBeGreaterThanOrEqual(1);
    });

    it('resolves KES cart items to canonical USD priceBook price in GLOBAL market instead of dividing by PPP plan ratio', () => {
      mockMarketPreference.mockReturnValue({
        marketCode: 'GLOBAL',
        market: 'international',
        marketDef: { code: 'GLOBAL', currency: 'USD', currencySymbol: '$' },
        isLocked: true,
      });

      // Item was added while user was in KE market (KES 8,500), then user is in GLOBAL market
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-business',
        name: 'Host Business',
        cycle: 'year',
        qty: 1,
        unitPrice: 8500,
        currency: 'KES',
      });

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <SubscriptionCheckout initialPlanSlug="care-essential" initialCycle="MONTHLY" cartMode={true} />
        </QueryClientProvider>,
      );

      // Canonical GLOBAL priceBook price for host-business is $99 (not 8500 / (5000/75) = $128)
      expect(screen.getAllByText('$99').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('$174 USD').length).toBeGreaterThanOrEqual(2);
    });

    it('CartView normalizes mixed-currency items to the active market currency without summing raw KES + USD numbers', () => {
      mockMarketPreference.mockReturnValue({
        marketCode: 'GLOBAL',
        market: 'international',
        marketDef: { code: 'GLOBAL', currency: 'USD', currencySymbol: '$' },
        isLocked: true,
      });

      useCartStore.getState().add({
        kind: 'PLAN',
        id: 'care-essential',
        name: 'Care Essential',
        cycle: 'MONTHLY',
        qty: 1,
        unitPrice: 75,
        currency: 'USD',
      });
      useCartStore.getState().add({
        kind: 'CATALOG',
        id: 'host-business',
        name: 'Host Business',
        cycle: 'year',
        qty: 1,
        unitPrice: 8500,
        currency: 'KES',
      });

      render(<CartView />);

      // Host Business should be normalized to USD 99 and total to USD 174 (never 8,575)
      expect(screen.queryByText(/8,575/)).not.toBeInTheDocument();
      expect(screen.getAllByText('USD 99').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('USD 174')).toBeInTheDocument();
    });
  });
});
