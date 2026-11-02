import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Wrench, Server, Puzzle, Globe } from 'lucide-react';
import { StoreCategoryNav, type StoreCategoryItem } from '../StoreCategoryNav';

describe('StoreCategoryNav Component', () => {
  const mockCategories: StoreCategoryItem[] = [
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

  it('renders all category pills with labels and count badges', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={2}
      />
    );

    expect(screen.getByText('Care Plans')).toBeInTheDocument();
    expect(screen.getByText('Hosting')).toBeInTheDocument();
    expect(screen.getByText('Add-ons')).toBeInTheDocument();
    expect(screen.getByText('Website Builds')).toBeInTheDocument();

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders the cart quick CTA with accurate count', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={5}
      />
    );

    const cartLink = screen.getByRole('link', { name: /View Cart/i });
    expect(cartLink).toBeInTheDocument();
    expect(cartLink).toHaveAttribute('href', '/cart');
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('applies active styling and ARIA attributes to the selected category', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="hosting"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const hostingTab = screen.getByRole('tab', { name: /Hosting/i });
    expect(hostingTab).toHaveAttribute('aria-selected', 'true');
    expect(hostingTab).toHaveAttribute('tabIndex', '0');
    expect(hostingTab.className).toContain('bg-[#2563EB]');

    const plansTab = screen.getByRole('tab', { name: /Care Plans/i });
    expect(plansTab).toHaveAttribute('aria-selected', 'false');
    expect(plansTab).toHaveAttribute('tabIndex', '-1');
    expect(plansTab.className).not.toContain('bg-[#2563EB]');
  });

  it('calls onSelectCategory when a category pill is clicked', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const addonsTab = screen.getByRole('tab', { name: /Add-ons/i });
    fireEvent.click(addonsTab);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('addons');
  });

  it('conforms to ARIA accessibility requirements for tabs and tablist', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Store category navigation' });
    expect(nav).toBeInTheDocument();

    const tablist = screen.getByRole('tablist', { name: 'Store Categories' });
    expect(tablist).toBeInTheDocument();

    mockCategories.forEach((cat) => {
      const tab = screen.getByRole('tab', { name: new RegExp(cat.label, 'i') });
      expect(tab).toHaveAttribute('id', `tab-${cat.id}`);
      expect(tab).toHaveAttribute('aria-controls', cat.id);
    });
  });

  it('supports keyboard navigation: ArrowRight and ArrowLeft cycle through tabs', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

    // ArrowRight from index 0 ('plans') should select index 1 ('hosting')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('hosting');

    // ArrowLeft from index 0 ('plans') wraps to index 3 ('websites')
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith('websites');

    // End key jumps to last category ('websites')
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onSelect).toHaveBeenCalledWith('websites');

    // Home key jumps to first category ('plans')
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith('plans');
  });

  it('updates overflow fade indicators dynamically on scroll', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const leftFade = screen.getByTestId('fade-left');
    const rightFade = screen.getByTestId('fade-right');
    const tablist = screen.getByRole('tablist', { name: 'Store Categories' });

    expect(leftFade).toHaveClass('opacity-0');

    // Simulate scrolling right: scrollLeft = 50, scrollWidth = 800, clientWidth = 400
    Object.defineProperty(tablist, 'scrollLeft', { value: 50, configurable: true, writable: true });
    Object.defineProperty(tablist, 'scrollWidth', { value: 800, configurable: true, writable: true });
    Object.defineProperty(tablist, 'clientWidth', { value: 400, configurable: true, writable: true });

    fireEvent.scroll(tablist);

    expect(leftFade).toHaveClass('opacity-100');
    expect(rightFade).toHaveClass('opacity-100');

    // Simulate reaching the right boundary: scrollLeft = 400
    Object.defineProperty(tablist, 'scrollLeft', { value: 400, configurable: true, writable: true });
    fireEvent.scroll(tablist);

    expect(leftFade).toHaveClass('opacity-100');
    expect(rightFade).toHaveClass('opacity-0');
  });

  it('auto-centers active pill when activeId changes', () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const tablist = screen.getByRole('tablist', { name: 'Store Categories' });
    const scrollToMock = jest.fn();
    tablist.scrollTo = scrollToMock;

    rerender(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="addons"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    expect(scrollToMock).toHaveBeenCalled();
  });

  it('prevents default page scrolling and activates category on Space and Enter key down', () => {
    const onSelect = jest.fn();
    render(
      <StoreCategoryNav
        categories={mockCategories}
        activeId="plans"
        onSelectCategory={onSelect}
        cartCount={0}
      />
    );

    const hostingTab = screen.getByRole('tab', { name: /Hosting/i });

    // 1. Space key on tab anchor must call preventDefault and trigger onSelectCategory
    const spaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    const spacePreventDefaultSpy = jest.spyOn(spaceEvent, 'preventDefault');
    hostingTab.dispatchEvent(spaceEvent);

    expect(spacePreventDefaultSpy).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('hosting');

    // 2. Enter key on tab anchor must call preventDefault and trigger onSelectCategory
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    const enterPreventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault');
    hostingTab.dispatchEvent(enterEvent);

    expect(enterPreventDefaultSpy).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('hosting');

    // 3. Space key on tablist container activates current tab with preventDefault
    const tablist = screen.getByRole('tablist', { name: 'Store Categories' });
    const tablistSpaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    const tablistPreventDefaultSpy = jest.spyOn(tablistSpaceEvent, 'preventDefault');
    tablist.dispatchEvent(tablistSpaceEvent);

    expect(tablistPreventDefaultSpy).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('plans');
  });
});
