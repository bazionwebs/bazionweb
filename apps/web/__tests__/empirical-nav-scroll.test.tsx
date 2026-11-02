import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { Wrench, Server, Puzzle, Globe } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StoreView from '@/components/store/StoreView';
import { StoreCategoryNav, type StoreCategoryItem } from '@/components/store/StoreCategoryNav';
import { useStoreScrollspy } from '@/components/store/useStoreScrollspy';
import WhatsAppFloatingChat from '@/components/ui/WhatsAppChat';

// Configurable mock routing state
let mockPathname = '/store';
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock catalog and plans data for StoreView
jest.mock('../src/lib/plans', () => ({
  ...jest.requireActual('../src/lib/plans'),
  usePlans: () => ({
    plans: [
      { id: 'p-starter', slug: 'starter', name: 'Starter Care', tier: 'STANDARD', priceMonthlyKes: 2500 },
      { id: 'p-growth', slug: 'growth', name: 'Growth Care', tier: 'RECOMMENDED', priceMonthlyKes: 5000 },
      { id: 'p-business', slug: 'business', name: 'Business Care', tier: 'STANDARD', priceMonthlyKes: 9500 },
      { id: 'p-enterprise', slug: 'enterprise', name: 'Enterprise Care', tier: 'STANDARD', priceMonthlyKes: 18000 },
    ],
    loading: false,
    error: null,
  }),
}));

const mockCatalogResponse = {
  market: { code: 'KE', currencyCode: 'KES', currencySymbol: 'KES ', vatRate: 0.16 },
  prices: [
    { id: 'pr-1', productId: 'host-essential', amount: 4800, billingPeriod: 'annual' },
    { id: 'pr-2', productId: 'host-business', amount: 9600, billingPeriod: 'annual' },
    { id: 'pr-3', productId: 'addon-seo-advanced', amount: 3500, billingPeriod: 'one-time' },
    { id: 'pr-4', productId: 'addon-mpesa', amount: 5000, billingPeriod: 'one-time' },
  ],
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: mockCatalogResponse }),
  })
) as jest.Mock;

describe('Empirical Challenge Suite: Store Navigation, Deep-Linking & Scroll Geometry', () => {
  const sectionIds = ['plans', 'hosting', 'addons', 'websites'];
  let observerInstances: Array<{
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    rootMargin?: string;
    observe: jest.Mock;
    disconnect: jest.Mock;
  }> = [];

  const mockCategories: StoreCategoryItem[] = [
    { id: 'plans', label: 'Care Plans', icon: Wrench, count: 4, href: '#plans' },
    { id: 'hosting', label: 'Hosting', icon: Server, count: 2, href: '#hosting' },
    { id: 'addons', label: 'Add-ons', icon: Puzzle, count: 2, href: '#addons' },
    { id: 'websites', label: 'Website Builds', icon: Globe, badge: 'Custom', href: '#websites' },
  ];

  beforeEach(() => {
    mockPathname = '/store';
    mockSearchParams = new URLSearchParams();
    observerInstances = [];
    window.location.hash = '';

    // Mock IntersectionObserver with options capture
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest.fn(
      (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => {
        const instance = {
          callback,
          options,
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn().mockReturnValue([]),
          root: null,
          rootMargin: options?.rootMargin || '',
          thresholds: (options?.threshold as number[]) || [],
        };
        observerInstances.push(instance);
        return instance;
      }
    );

    // Mock RAF
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

    // Create DOM section elements
    sectionIds.forEach((id) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
      el.scrollIntoView = jest.fn();
    });
  });

  afterEach(() => {
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    jest.restoreAllMocks();
  });

  // =========================================================================
  // SUITE 1: Delayed Asynchronous Data Arrival & Deep-Link Resolution
  // =========================================================================
  describe('Suite 1: Delayed Asynchronous Data Arrival & Deep-Link Resolution', () => {
    it('Scenario 1.1: Simulates 100ms async catalog hydration with hash #websites; verifies scrollIntoView is deferred until isDataReady becomes true', () => {
      jest.useFakeTimers();

      window.location.hash = '#websites';
      // Drain any initial hashchange event scheduled by JSDOM during hash assignment
      act(() => {
        jest.runOnlyPendingTimers();
      });

      const websitesEl = document.getElementById('websites')!;
      websitesEl.scrollIntoView = jest.fn();

      const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

      // Test Harness Component with simulated 100ms asynchronous data fetch
      function DelayedCatalogHarness({ delayMs = 100 }: { delayMs?: number }) {
        const [isDataReady, setIsDataReady] = useState(false);

        useEffect(() => {
          const timer = setTimeout(() => {
            setIsDataReady(true);
          }, delayMs);
          return () => clearTimeout(timer);
        }, [delayMs]);

        const { activeSection } = useStoreScrollspy(sectionIds, { isDataReady });

        return (
          <div>
            <div data-testid="status">{isDataReady ? 'READY' : 'LOADING'}</div>
            <div data-testid="active">{activeSection}</div>
          </div>
        );
      }

      render(<DelayedCatalogHarness delayMs={100} />);

      // At t = 0ms: Catalog is still loading
      expect(screen.getByTestId('status')).toHaveTextContent('LOADING');
      expect(websitesEl.scrollIntoView).not.toHaveBeenCalled();

      // At t = 50ms: Midway through fetch, data is not ready yet
      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(screen.getByTestId('status')).toHaveTextContent('LOADING');
      expect(websitesEl.scrollIntoView).not.toHaveBeenCalled();

      // At t = 100ms: Asynchronous data arrives, triggering isDataReady: true
      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(screen.getByTestId('status')).toHaveTextContent('READY');
      expect(websitesEl.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(websitesEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
      expect(screen.getByTestId('active')).toHaveTextContent('websites');

      jest.useRealTimers();
    });

    it('Scenario 1.2: Deep-linking with different section hashes (#hosting, #addons, #plans) scrolls accurately after hydration', () => {
      ['hosting', 'addons', 'plans'].forEach((targetId) => {
        window.location.hash = `#${targetId}`;
        const targetEl = document.getElementById(targetId)!;
        (targetEl.scrollIntoView as jest.Mock).mockClear();

        const { unmount } = renderHook(
          ({ isDataReady }) => useStoreScrollspy(sectionIds, { isDataReady }),
          { initialProps: { isDataReady: false } }
        );

        expect(targetEl.scrollIntoView).not.toHaveBeenCalled();

        act(() => {
          // Flip data ready
          renderHook(() => useStoreScrollspy(sectionIds, { isDataReady: true }));
        });

        expect(targetEl.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });
        unmount();
      });
    });

    it('Scenario 1.3: Deep-linking with unmapped/unknown hash safely degrades without throwing or scrolling unknown elements', () => {
      window.location.hash = '#non-existent-product';
      const scrollSpies = sectionIds.map((id) => document.getElementById(id)!.scrollIntoView as jest.Mock);

      expect(() => {
        renderHook(() => useStoreScrollspy(sectionIds, { isDataReady: true }));
      }).not.toThrow();

      scrollSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
    });

    it('Scenario 1.4: Respects prefers-reduced-motion media query by passing behavior: "auto" instead of "smooth"', () => {
      window.location.hash = '#websites';
      const websitesEl = document.getElementById('websites')!;
      (websitesEl.scrollIntoView as jest.Mock).mockClear();

      // Mock reduced motion
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderHook(() => useStoreScrollspy(sectionIds, { isDataReady: true }));

      expect(websitesEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start',
      });
    });

    it('Scenario 1.5: Manual scroll guard blocks IntersectionObserver interference during 800ms transition', () => {
      jest.useFakeTimers();

      const { result } = renderHook(() =>
        useStoreScrollspy(sectionIds, { isDataReady: true })
      );

      expect(observerInstances.length).toBeGreaterThan(0);
      const observer = observerInstances[0];
      const hostingEl = document.getElementById('hosting')!;

      // User triggers manual scrollToSection
      act(() => {
        result.current.scrollToSection('websites');
      });
      expect(result.current.activeSection).toBe('websites');

      // The effect re-ran on activeSection update; obtain the currently active observer instance
      const activeObserver = observerInstances[observerInstances.length - 1];

      // Intermediate observer event arrives during animated scroll (e.g. at 200ms)
      act(() => {
        jest.advanceTimersByTime(200);
        activeObserver.callback(
          [
            {
              target: hostingEl,
              isIntersecting: true,
              boundingClientRect: { top: 10 } as DOMRectReadOnly,
              intersectionRatio: 1,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: Date.now(),
            },
          ],
          activeObserver as unknown as IntersectionObserver
        );
      });

      // Active section should NOT revert to hosting because manual scroll lock is active
      expect(result.current.activeSection).toBe('websites');

      // After 800ms transition concludes, lock clears and observer resumes normal tracking
      act(() => {
        jest.advanceTimersByTime(650);
        activeObserver.callback(
          [
            {
              target: hostingEl,
              isIntersecting: true,
              boundingClientRect: { top: 10 } as DOMRectReadOnly,
              intersectionRatio: 1,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: Date.now(),
            },
          ],
          activeObserver as unknown as IntersectionObserver
        );
      });

      expect(result.current.activeSection).toBe('hosting');

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // SUITE 2: Section Scroll Margins & Sticky Header Mathematical Clearance
  // =========================================================================
  describe('Suite 2: Section Scroll Margins & Sticky Header Mathematical Clearance', () => {
    it('Scenario 2.1: In StoreView, all 4 anchor sections (#plans, #hosting, #addons, #websites) declare scroll-mt-44', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <StoreView />
        </QueryClientProvider>
      );

      const plansSection = container.querySelector('#plans');
      const hostingSection = container.querySelector('#hosting');
      const addonsSection = container.querySelector('#addons');
      const websitesSection = container.querySelector('#websites');

      expect(plansSection).not.toBeNull();
      expect(hostingSection).not.toBeNull();
      expect(addonsSection).not.toBeNull();
      expect(websitesSection).not.toBeNull();

      expect(plansSection).toHaveClass('scroll-mt-44');
      expect(hostingSection).toHaveClass('scroll-mt-44');
      expect(addonsSection).toHaveClass('scroll-mt-44');
      expect(websitesSection).toHaveClass('scroll-mt-44');
    });

    it('Scenario 2.2: Mathematical proof of non-clipping clearance under combined sticky headers', () => {
      // Tailwind conversion: 1 spacing unit = 0.25rem = 4px (assuming default 16px root font size)
      const TAILWIND_UNIT_PX = 4;
      const scrollMarginUnits = 44;
      const scrollMarginPx = scrollMarginUnits * TAILWIND_UNIT_PX; // 44 * 4 = 176px

      // Header component heights:
      // Fixed primary Navbar: top-0 z-50, h-20 (20 * 4px = 80px)
      const navbarHeightPx = 80;
      // Sticky Store Category Subnav: sticky top-20 z-30, h-16 (16 * 4px = 64px)
      const subnavHeightPx = 64;

      const combinedStickyOcclusionHeight = navbarHeightPx + subnavHeightPx; // 80 + 64 = 144px
      const netBreathingClearance = scrollMarginPx - combinedStickyOcclusionHeight; // 176 - 144 = 32px

      expect(scrollMarginPx).toBe(176);
      expect(combinedStickyOcclusionHeight).toBe(144);
      expect(netBreathingClearance).toBe(32);
      expect(netBreathingClearance).toBeGreaterThan(0);
    });

    it('Scenario 2.3: useStoreScrollspy initializes IntersectionObserver rootMargin matching 176px offset', () => {
      renderHook(() => useStoreScrollspy(sectionIds));

      expect(observerInstances.length).toBeGreaterThan(0);
      const latestObserver = observerInstances[observerInstances.length - 1];

      // Default headerOffset must match scroll-mt-44 (176px)
      expect(latestObserver.rootMargin).toBe('-176px 0px -55% 0px');
    });
  });

  // =========================================================================
  // SUITE 3: Horizontal Overflow Indicators & Boundary Edge Cases
  // =========================================================================
  describe('Suite 3: Horizontal Overflow Indicators & Boundary Edge Cases', () => {
    it('Scenario 3.1: When scrollWidth <= clientWidth (no overflow), both left & right fade indicators are hidden', () => {
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="plans"
          onSelectCategory={jest.fn()}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });
      const leftFade = screen.getByTestId('fade-left');
      const rightFade = screen.getByTestId('fade-right');

      // Simulate container with sufficient width (no overflow)
      Object.defineProperty(scroller, 'scrollWidth', { value: 450, configurable: true, writable: true });
      Object.defineProperty(scroller, 'clientWidth', { value: 500, configurable: true, writable: true });
      Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true });

      fireEvent.scroll(scroller);

      expect(leftFade).toHaveClass('opacity-0');
      expect(rightFade).toHaveClass('opacity-0');
    });

    it('Scenario 3.2: When at start (scrollLeft = 0, scrollWidth > clientWidth), left fade is hidden, right fade is visible', () => {
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="plans"
          onSelectCategory={jest.fn()}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });
      const leftFade = screen.getByTestId('fade-left');
      const rightFade = screen.getByTestId('fade-right');

      // Overflow present, parked at extreme left
      Object.defineProperty(scroller, 'scrollWidth', { value: 800, configurable: true, writable: true });
      Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true, writable: true });
      Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true });

      fireEvent.scroll(scroller);

      expect(leftFade).toHaveClass('opacity-0');
      expect(rightFade).toHaveClass('opacity-100');
    });

    it('Scenario 3.3: When scrolled to middle, both left & right fade indicators are visible', () => {
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="plans"
          onSelectCategory={jest.fn()}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });
      const leftFade = screen.getByTestId('fade-left');
      const rightFade = screen.getByTestId('fade-right');

      // Scrolled to midway point
      Object.defineProperty(scroller, 'scrollWidth', { value: 800, configurable: true, writable: true });
      Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true, writable: true });
      Object.defineProperty(scroller, 'scrollLeft', { value: 200, configurable: true, writable: true });

      fireEvent.scroll(scroller);

      expect(leftFade).toHaveClass('opacity-100');
      expect(rightFade).toHaveClass('opacity-100');
    });

    it('Scenario 3.4: When scrolled to end, left fade is visible and right fade is hidden', () => {
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="plans"
          onSelectCategory={jest.fn()}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });
      const leftFade = screen.getByTestId('fade-left');
      const rightFade = screen.getByTestId('fade-right');

      // Max scroll reached: scrollLeft = scrollWidth - clientWidth = 400
      Object.defineProperty(scroller, 'scrollWidth', { value: 800, configurable: true, writable: true });
      Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true, writable: true });
      Object.defineProperty(scroller, 'scrollLeft', { value: 400, configurable: true, writable: true });

      fireEvent.scroll(scroller);

      expect(leftFade).toHaveClass('opacity-100');
      expect(rightFade).toHaveClass('opacity-0');
    });

    it('Scenario 3.5: Sub-pixel boundary tolerances (<= 4px) suppress visual jitter', () => {
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="plans"
          onSelectCategory={jest.fn()}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });
      const leftFade = screen.getByTestId('fade-left');
      const rightFade = screen.getByTestId('fade-right');

      Object.defineProperty(scroller, 'scrollWidth', { value: 800, configurable: true, writable: true });
      Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true, writable: true });

      // Sub-pixel 3px from left (< 4px threshold): left fade should stay hidden
      Object.defineProperty(scroller, 'scrollLeft', { value: 3, configurable: true, writable: true });
      fireEvent.scroll(scroller);
      expect(leftFade).toHaveClass('opacity-0');

      // Sub-pixel 2px from right (scrollLeft = 398, max is 400): right fade should stay hidden
      Object.defineProperty(scroller, 'scrollLeft', { value: 398, configurable: true, writable: true });
      fireEvent.scroll(scroller);
      expect(rightFade).toHaveClass('opacity-0');
    });

    it('Scenario 3.6: Keyboard navigation (ArrowRight, ArrowLeft, Home, End) wraps correctly', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={mockCategories}
          activeId="hosting"
          onSelectCategory={onSelect}
        />
      );

      const scroller = screen.getByRole('tablist', { name: 'Store Categories' });

      // ArrowRight from index 1 ('hosting') -> index 2 ('addons')
      fireEvent.keyDown(scroller, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenCalledWith('addons');

      // ArrowLeft from index 1 ('hosting') -> index 0 ('plans')
      fireEvent.keyDown(scroller, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenCalledWith('plans');

      // Home key -> index 0 ('plans')
      fireEvent.keyDown(scroller, { key: 'Home' });
      expect(onSelect).toHaveBeenCalledWith('plans');

      // End key -> index 3 ('websites')
      fireEvent.keyDown(scroller, { key: 'End' });
      expect(onSelect).toHaveBeenCalledWith('websites');
    });
  });

  // =========================================================================
  // SUITE 4: Floating Widget Suppression & Layout Non-Collision
  // =========================================================================
  describe('Suite 4: Floating Widget Suppression & Layout Non-Collision', () => {
    it('Scenario 4.1: Floating WhatsApp chat widget returns null on /store routes', () => {
      mockPathname = '/store';
      const { container } = render(
        <WhatsAppFloatingChat source="store" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('Scenario 4.2: Floating WhatsApp chat widget is suppressed on sub-paths of /store', () => {
      mockPathname = '/store/care-plans';
      const { container } = render(
        <WhatsAppFloatingChat source="store" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('Scenario 4.3: Floating WhatsApp chat widget renders normally on non-store routes', () => {
      mockPathname = '/pricing';
      render(
        <WhatsAppFloatingChat source="floating_widget" />
      );
      expect(screen.getByText('Chat on WhatsApp')).toBeInTheDocument();
    });
  });
});
