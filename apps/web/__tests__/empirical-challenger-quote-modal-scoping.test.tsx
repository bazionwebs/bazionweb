import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuoteCalculatorPage from '@/app/(public)/quote/page';
import { MARKETS } from '@/lib/marketEngine';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/quote',
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock useMarketPreference to allow controlling the resolved market per test
const mockUseMarketPreference = jest.fn();
jest.mock('../src/hooks/useMarketPreference', () => ({
  useMarketPreference: () => mockUseMarketPreference(),
}));

describe('Empirical Challenger: Proposal Modal Country Scoping & Decoupling (Requirement R3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Market KE (Kenya & East Africa Domestic)', () => {
    beforeEach(() => {
      mockUseMarketPreference.mockReturnValue({
        marketCode: 'KE',
        market: 'kenya',
        marketDef: MARKETS.KE,
        isLocked: true,
      });
    });

    it('renders ONLY East African regional country options (KE, UG, TZ, RW, BI, SS, ET) in gs-country select', () => {
      render(<QuoteCalculatorPage />);

      // Open the proposal modal
      const openModalBtn = screen.getAllByRole('button', {
        name: /Request Official Project Proposal/i,
      })[0];
      fireEvent.click(openModalBtn);

      const countrySelect = document.getElementById('gs-country') as HTMLSelectElement;
      expect(countrySelect).not.toBeNull();

      const optionValues = Array.from(countrySelect.options).map((opt) => opt.value);

      // Verify exact East African scoped options
      expect(optionValues).toEqual(['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET']);

      // Verify that all international / global options are strictly ABSENT from the DOM
      const forbiddenGlobalCodes = ['US', 'GB', 'CA', 'AU', 'DE', 'OTHER'];
      for (const code of forbiddenGlobalCodes) {
        expect(optionValues).not.toContain(code);
      }

      // Check the entire modal DOM to ensure foreign countries do not appear
      const modalDialog = screen.getByRole('dialog');
      expect(modalDialog.textContent).not.toContain('United States');
      expect(modalDialog.textContent).not.toContain('United Kingdom');
      expect(modalDialog.textContent).not.toContain('Germany');
      expect(modalDialog.textContent).not.toContain('Australia');
    });

    it('changing gs-country option NEVER mutates active market or currency', () => {
      render(<QuoteCalculatorPage />);

      // Check baseline currency before opening modal
      expect(screen.getAllByText(/KSh/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/^\$950/)).toBeNull();

      // Open proposal modal
      const openModalBtn = screen.getAllByRole('button', {
        name: /Request Official Project Proposal/i,
      })[0];
      fireEvent.click(openModalBtn);

      const countrySelect = document.getElementById('gs-country') as HTMLSelectElement;
      expect(countrySelect.value).toBe('KE');

      // Change selection to Uganda (UG)
      fireEvent.change(countrySelect, { target: { value: 'UG' } });
      expect(countrySelect.value).toBe('UG');

      // Verify that pricing and currency remain locked in KES / Kenya market
      expect(screen.getAllByText(/KSh/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/^\$950/)).toBeNull();

      // Change selection to Tanzania (TZ)
      fireEvent.change(countrySelect, { target: { value: 'TZ' } });
      expect(countrySelect.value).toBe('TZ');
      expect(screen.getAllByText(/KSh/i).length).toBeGreaterThan(0);

      // Change selection to Rwanda (RW)
      fireEvent.change(countrySelect, { target: { value: 'RW' } });
      expect(countrySelect.value).toBe('RW');
      expect(screen.getAllByText(/KSh/i).length).toBeGreaterThan(0);
    });
  });

  describe('Market GLOBAL (International Market)', () => {
    beforeEach(() => {
      mockUseMarketPreference.mockReturnValue({
        marketCode: 'GLOBAL',
        market: 'international',
        marketDef: MARKETS.GLOBAL,
        isLocked: true,
      });
    });

    it('renders ONLY International country options (US, GB, CA, AU, DE, OTHER) in gs-country select', () => {
      render(<QuoteCalculatorPage />);

      // Open the proposal modal
      const openModalBtn = screen.getAllByRole('button', {
        name: /Request Official Project Proposal/i,
      })[0];
      fireEvent.click(openModalBtn);

      const countrySelect = document.getElementById('gs-country') as HTMLSelectElement;
      expect(countrySelect).not.toBeNull();

      const optionValues = Array.from(countrySelect.options).map((opt) => opt.value);

      // Verify exact Global scoped options
      expect(optionValues).toEqual(['US', 'GB', 'CA', 'AU', 'DE', 'OTHER']);

      // Verify that Kenya and East African options are strictly ABSENT from the DOM
      const forbiddenRegionalCodes = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS', 'ET'];
      for (const code of forbiddenRegionalCodes) {
        expect(optionValues).not.toContain(code);
      }

      // Check modal DOM text
      const modalDialog = screen.getByRole('dialog');
      expect(modalDialog.textContent).not.toContain('Kenya');
      expect(modalDialog.textContent).not.toContain('Uganda');
      expect(modalDialog.textContent).not.toContain('Tanzania');
      expect(modalDialog.textContent).not.toContain('Rwanda');
      expect(modalDialog.textContent).not.toContain('Burundi');
      expect(modalDialog.textContent).not.toContain('South Sudan');
      expect(modalDialog.textContent).not.toContain('Ethiopia');
    });

    it('changing gs-country option in GLOBAL market NEVER mutates active market or currency', () => {
      render(<QuoteCalculatorPage />);

      // Check baseline currency before opening modal: should show USD ($)
      expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/KSh 90,000/)).toBeNull();

      // Open proposal modal
      const openModalBtn = screen.getAllByRole('button', {
        name: /Request Official Project Proposal/i,
      })[0];
      fireEvent.click(openModalBtn);

      const countrySelect = document.getElementById('gs-country') as HTMLSelectElement;
      expect(countrySelect.value).toBe('US');

      // Change selection to United Kingdom (GB)
      fireEvent.change(countrySelect, { target: { value: 'GB' } });
      expect(countrySelect.value).toBe('GB');

      // Verify that currency and market remain locked in USD / GLOBAL
      expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/KSh 90,000/)).toBeNull();

      // Change selection to Germany (DE)
      fireEvent.change(countrySelect, { target: { value: 'DE' } });
      expect(countrySelect.value).toBe('DE');
      expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0);

      // Change selection to Australia (AU)
      fireEvent.change(countrySelect, { target: { value: 'AU' } });
      expect(countrySelect.value).toBe('AU');
      expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0);
    });
  });
});
