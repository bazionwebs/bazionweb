import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Wrench, Server, Puzzle, Globe } from 'lucide-react';
import WhatsAppFloatingChat from '@/components/ui/WhatsAppChat';
import { StoreCategoryNav, type StoreCategoryItem } from '@/components/store/StoreCategoryNav';
import { SITE_CONTACT } from '@/lib/contact';

// Dynamic mock pathname for next/navigation
let currentMockPathname: string | null = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => currentMockPathname,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

describe('Empirical Challenger: Floating Widget Collision & Store Nav Suite', () => {
  const sampleCategories: StoreCategoryItem[] = [
    {
      id: 'plans',
      label: 'Care Plans',
      icon: Wrench,
      count: 4,
      href: '#plans',
    },
    {
      id: 'hosting',
      label: 'Hosting',
      icon: Server,
      count: 3,
      href: '#hosting',
    },
    {
      id: 'addons',
      label: 'Add-ons',
      icon: Puzzle,
      count: 16,
      href: '#addons',
    },
    {
      id: 'websites',
      label: 'Website Builds',
      icon: Globe,
      badge: 'Custom',
      href: '#websites',
    },
  ];

  beforeEach(() => {
    currentMockPathname = '/';
    jest.clearAllMocks();
    delete (window as any).posthog;
    delete (window as any).gtag;
  });

  afterEach(() => {
    delete (window as any).posthog;
    delete (window as any).gtag;
  });

  // =========================================================================
  // CHALLENGE 1: Route Suppression & Floating Widget Collision Elimination
  // =========================================================================
  describe('Challenge 1: WhatsAppFloatingChat Route Collision Suppression', () => {
    it('suppresses widget on exact /store route (renders 0 DOM nodes, completely preventing UI collision)', () => {
      currentMockPathname = '/store';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).toBeNull();
      expect(container.innerHTML).toBe('');
      expect(screen.queryByRole('link', { name: /Chat on WhatsApp/i })).not.toBeInTheDocument();
    });

    it('suppresses widget on hash subpath /store#websites (renders 0 DOM nodes)', () => {
      currentMockPathname = '/store#websites';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).toBeNull();
      expect(container.innerHTML).toBe('');
      expect(screen.queryByRole('link', { name: /Chat on WhatsApp/i })).not.toBeInTheDocument();
    });

    it('suppresses widget on other store sub-routes e.g. /store/plans', () => {
      currentMockPathname = '/store/plans';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).toBeNull();
      expect(container.innerHTML).toBe('');
    });

    it('suppresses widget on exact /checkout route (renders 0 DOM nodes, preventing form occlusion)', () => {
      currentMockPathname = '/checkout';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).toBeNull();
      expect(container.innerHTML).toBe('');
      expect(screen.queryByRole('link', { name: /Chat on WhatsApp/i })).not.toBeInTheDocument();
    });

    it('suppresses widget on nested checkout routes e.g. /checkout/success', () => {
      currentMockPathname = '/checkout/success';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).toBeNull();
      expect(container.innerHTML).toBe('');
    });

    it('renders active widget on home route "/" without suppression', () => {
      currentMockPathname = '/';
      const { container } = render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(container.firstChild).not.toBeNull();
      const link = screen.getByRole('link', { name: /Chat on WhatsApp/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining(`https://wa.me/${SITE_CONTACT.whatsappNumber}`)
      );
    });

    it('renders active widget on "/services" route', () => {
      currentMockPathname = '/services';
      render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(screen.getByRole('link', { name: /Chat on WhatsApp/i })).toBeInTheDocument();
    });

    it('renders active widget on "/pricing" route', () => {
      currentMockPathname = '/pricing';
      render(<WhatsAppFloatingChat source="floating_widget" />);

      expect(screen.getByRole('link', { name: /Chat on WhatsApp/i })).toBeInTheDocument();
    });

    it('gracefully handles null or undefined pathname without throwing', () => {
      currentMockPathname = null;
      expect(() => {
        render(<WhatsAppFloatingChat source="floating_widget" />);
      }).not.toThrow();

      expect(screen.getByRole('link', { name: /Chat on WhatsApp/i })).toBeInTheDocument();
    });

    it('fires analytics tracking when clicked on unsuppressed route', () => {
      currentMockPathname = '/';
      const mockPosthog = { capture: jest.fn() };
      const mockGtag = jest.fn();
      (window as any).posthog = mockPosthog;
      (window as any).gtag = mockGtag;

      render(<WhatsAppFloatingChat source="floating_widget" />);

      const link = screen.getByRole('link', { name: /Chat on WhatsApp/i });
      fireEvent.click(link);

      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'whatsapp_opened',
        expect.objectContaining({ source: 'floating_widget' })
      );
      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'whatsapp_opened',
        expect.objectContaining({ source: 'floating_widget' })
      );
    });
  });

  // =========================================================================
  // CHALLENGE 2: ARIA Landmark & Contract Verification
  // =========================================================================
  describe('Challenge 2: StoreCategoryNav ARIA Landmark & Contract Verification', () => {
    it('provides proper navigation landmark and sticky styling structure', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const navLandmark = screen.getByRole('navigation', { name: 'Store category navigation' });
      expect(navLandmark).toBeInTheDocument();
      expect(navLandmark).toHaveClass('sticky', 'top-20', 'z-30');
    });

    it('exposes a compliant tablist container with accessible name and keyboard index', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });
      expect(tablist).toBeInTheDocument();
      expect(tablist).toHaveAttribute('tabIndex', '0');
    });

    it('satisfies ARIA tab contract on every category pill (role, id, aria-controls, href)', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="hosting"
          onSelectCategory={onSelect}
          cartCount={1}
        />
      );

      sampleCategories.forEach((cat) => {
        const tab = screen.getByRole('tab', { name: new RegExp(cat.label, 'i') });
        expect(tab).toBeInTheDocument();
        expect(tab).toHaveAttribute('id', `tab-${cat.id}`);
        expect(tab).toHaveAttribute('aria-controls', cat.id);
        expect(tab).toHaveAttribute('href', cat.href);
      });
    });

    it('synchronizes aria-selected and tabIndex strictly with active category state', () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const plansTab = screen.getByRole('tab', { name: /Care Plans/i });
      const hostingTab = screen.getByRole('tab', { name: /Hosting/i });
      const addonsTab = screen.getByRole('tab', { name: /Add-ons/i });
      const websitesTab = screen.getByRole('tab', { name: /Website Builds/i });

      // Initially 'plans' is active
      expect(plansTab).toHaveAttribute('aria-selected', 'true');
      expect(plansTab).toHaveAttribute('tabIndex', '0');
      expect(plansTab).toHaveClass('bg-[#2563EB]');

      expect(hostingTab).toHaveAttribute('aria-selected', 'false');
      expect(hostingTab).toHaveAttribute('tabIndex', '-1');
      expect(hostingTab).not.toHaveClass('bg-[#2563EB]');

      expect(addonsTab).toHaveAttribute('aria-selected', 'false');
      expect(websitesTab).toHaveAttribute('aria-selected', 'false');

      // Rerender with 'addons' active
      rerender(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="addons"
          onSelectCategory={onSelect}
          cartCount={3}
        />
      );

      expect(addonsTab).toHaveAttribute('aria-selected', 'true');
      expect(addonsTab).toHaveAttribute('tabIndex', '0');
      expect(plansTab).toHaveAttribute('aria-selected', 'false');
      expect(plansTab).toHaveAttribute('tabIndex', '-1');
    });

    it('renders category count badges and custom text badges accurately', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('renders quick cart CTA link with accessible label and badge count', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={7}
        />
      );

      const cartLink = screen.getByRole('link', { name: /View Cart, 7 items/i });
      expect(cartLink).toBeInTheDocument();
      expect(cartLink).toHaveAttribute('href', '/cart');
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // CHALLENGE 3: Comprehensive Keyboard Navigation & Rapid Simulation
  // =========================================================================
  describe('Challenge 3: Keyboard Navigation & Stress Testing', () => {
    it('executes ArrowRight sequential navigation through categories', () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // Step 1: ArrowRight from plans (0) -> hosting (1)
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenLastCalledWith('hosting');

      // Update activeId to simulate parent state update
      rerender(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="hosting"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      // Step 2: ArrowRight from hosting (1) -> addons (2)
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenLastCalledWith('addons');

      // Update activeId
      rerender(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="addons"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      // Step 3: ArrowRight from addons (2) -> websites (3)
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenLastCalledWith('websites');
    });

    it('executes ArrowRight cyclic wrap from the last tab to the first tab', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="websites" // Last tab (index 3)
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // ArrowRight from last tab must wrap around to index 0 ('plans')
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('plans');
    });

    it('executes ArrowLeft cyclic wrap from the first tab to the last tab', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans" // First tab (index 0)
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // ArrowLeft from first tab must wrap around to index 3 ('websites')
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('websites');
    });

    it('executes ArrowLeft reverse sequential navigation through categories', () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="websites" // index 3
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // websites (3) -> addons (2)
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenLastCalledWith('addons');

      rerender(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="addons"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      // addons (2) -> hosting (1)
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenLastCalledWith('hosting');

      rerender(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="hosting"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      // hosting (1) -> plans (0)
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenLastCalledWith('plans');
    });

    it('executes Home key jump directly to the first tab from any position', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="addons" // Index 2
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      fireEvent.keyDown(tablist, { key: 'Home' });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('plans');
    });

    it('executes End key jump directly to the last tab from any position', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans" // Index 0
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      fireEvent.keyDown(tablist, { key: 'End' });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('websites');
    });

    it('simulates rapid keyboard event bursts without degradation or state desync', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // Simulate 12 rapid keyboard events in quick succession
      const keys = [
        'ArrowRight',
        'ArrowLeft',
        'End',
        'Home',
        'ArrowRight',
        'ArrowLeft',
        'End',
        'Home',
        'ArrowRight',
        'ArrowRight',
        'ArrowLeft',
        'End',
      ];

      keys.forEach((key) => {
        fireEvent.keyDown(tablist, { key });
      });

      expect(onSelect).toHaveBeenCalledTimes(12);
    });

    it('activates category on mouse click / keyboard Enter equivalent', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const hostingTab = screen.getByRole('tab', { name: /Hosting/i });

      // In HTML / WAI-ARIA, user clicks or presses Enter on focused anchor tab
      fireEvent.click(hostingTab);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('hosting');

      const websitesTab = screen.getByRole('tab', { name: /Website Builds/i });
      fireEvent.click(websitesTab);
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onSelect).toHaveBeenCalledWith('websites');
    });

    it('gracefully handles unmapped keys without throwing or erroneous selections', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // Unmapped keys e.g. Tab, Escape, ArrowDown, ArrowUp, letters
      ['Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'KeyA'].forEach((key) => {
        fireEvent.keyDown(tablist, { key });
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('empirically verifies Enter and Space key events on tabs and tablist', () => {
      const onSelect = jest.fn();
      render(
        <StoreCategoryNav
          categories={sampleCategories}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });
      const hostingTab = screen.getByRole('tab', { name: /Hosting/i });

      // Tablist with automatic activation activates on Arrow navigation immediately.
      // Arrow to hosting tab:
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenCalledWith('hosting');

      // Verify Enter/Space keys do not throw or trigger invalid navigation
      expect(() => {
        fireEvent.keyDown(tablist, { key: 'Enter' });
        fireEvent.keyDown(tablist, { key: ' ' });
        fireEvent.keyDown(hostingTab, { key: 'Enter' });
        fireEvent.keyDown(hostingTab, { key: ' ' });
      }).not.toThrow();
    });

    it('handles boundary conditions: single category list does not crash on Arrow navigation', () => {
      const onSelect = jest.fn();
      const singleCategory: StoreCategoryItem[] = [sampleCategories[0]];

      render(
        <StoreCategoryNav
          categories={singleCategory}
          activeId="plans"
          onSelectCategory={onSelect}
          cartCount={0}
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

      // Navigating in a single-element list wraps to index 0 safely
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenCalledWith('plans');

      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelect).toHaveBeenCalledWith('plans');
    });
  });
});

