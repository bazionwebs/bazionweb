import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutError from '@/app/(public)/checkout/error';
import InvoicesError from '@/app/portal/invoices/error';

describe('Next.js App Router Error Boundaries', () => {
  const originalConsoleError = console.error;
  let consoleErrorMock: jest.Mock;

  beforeEach(() => {
    consoleErrorMock = jest.fn();
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  describe('Checkout Error Boundary (/checkout/error.tsx)', () => {
    it('renders checkout error interface and logs error to console on mount', () => {
      const resetMock = jest.fn();
      const mockError = new Error('Stripe/Paystack script initialization timed out');
      (mockError as any).digest = 'chk_digest_9981';

      render(<CheckoutError error={mockError} reset={resetMock} />);

      expect(screen.getByText(/We couldn't load the checkout session/i)).toBeInTheDocument();
      expect(screen.getByText(/No Charges Processed/i)).toBeInTheDocument();
      expect(screen.getByText(/Payment Session Interrupted/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Checkout/i })).toBeInTheDocument();

      const pricingLink = screen.getByRole('link', { name: /Choose Another Plan/i });
      expect(pricingLink).toHaveAttribute('href', '/pricing');

      const cartLink = screen.getByRole('link', { name: /View Cart/i });
      expect(cartLink).toHaveAttribute('href', '/cart');

      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('[Checkout Error Boundary Caught Exception]'),
        expect.objectContaining({
          message: 'Stripe/Paystack script initialization timed out',
          digest: 'chk_digest_9981',
        })
      );
    });

    it('triggers reset callback when Retry Checkout button is clicked', () => {
      const resetMock = jest.fn();
      const mockError = new Error('Cart serialization error');

      render(<CheckoutError error={mockError} reset={resetMock} />);

      const retryBtn = screen.getByRole('button', { name: /Retry Checkout/i });
      fireEvent.click(retryBtn);

      expect(resetMock).toHaveBeenCalledTimes(1);
    });

    it('toggles diagnostic trace drawer on demand', () => {
      const resetMock = jest.fn();
      const mockError = new Error('Specific checkout runtime assertion failed');
      (mockError as any).digest = 'digest_chk_123';

      render(<CheckoutError error={mockError} reset={resetMock} />);

      expect(screen.queryByText(/Specific checkout runtime assertion failed/i)).not.toBeInTheDocument();

      const toggleBtn = screen.getByRole('button', { name: /Show error details/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText(/Specific checkout runtime assertion failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Digest ID: digest_chk_123/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Hide error details/i }));
      expect(screen.queryByText(/Specific checkout runtime assertion failed/i)).not.toBeInTheDocument();
    });
  });

  describe('Portal Invoices Error Boundary (/portal/invoices/error.tsx)', () => {
    it('renders portal invoices error interface and logs error on mount', () => {
      const resetMock = jest.fn();
      const mockError = new Error('Failed to deserialize invoice line items');
      (mockError as any).digest = 'inv_digest_5541';

      render(<InvoicesError error={mockError} reset={resetMock} />);

      expect(screen.getByText(/Unable to display your invoices/i)).toBeInTheDocument();
      expect(screen.getByText(/Ledger Records Intact/i)).toBeInTheDocument();
      expect(screen.getByText(/Billing Workspace Notice/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reload Invoices/i })).toBeInTheDocument();

      const supportLink = screen.getByRole('link', { name: /Contact Support/i });
      expect(supportLink).toHaveAttribute('href', '/portal/support');

      const missionControlLink = screen.getByRole('link', { name: /Mission Control/i });
      expect(missionControlLink).toHaveAttribute('href', '/portal');

      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('[Portal Invoices Error Boundary Caught Exception]'),
        expect.objectContaining({
          message: 'Failed to deserialize invoice line items',
          digest: 'inv_digest_5541',
        })
      );
    });

    it('triggers reset callback when Reload Invoices button is clicked', () => {
      const resetMock = jest.fn();
      const mockError = new Error('Currency formatting error');

      render(<InvoicesError error={mockError} reset={resetMock} />);

      const reloadBtn = screen.getByRole('button', { name: /Reload Invoices/i });
      fireEvent.click(reloadBtn);

      expect(resetMock).toHaveBeenCalledTimes(1);
    });

    it('toggles technical trace drawer on demand', () => {
      const resetMock = jest.fn();
      const mockError = new Error('SyntaxError: Unexpected token in JSON at position 0');
      (mockError as any).digest = 'digest_inv_abc';

      render(<InvoicesError error={mockError} reset={resetMock} />);

      expect(screen.queryByText(/SyntaxError: Unexpected token/i)).not.toBeInTheDocument();

      const toggleBtn = screen.getByRole('button', { name: /View technical trace/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText(/SyntaxError: Unexpected token in JSON at position 0/i)).toBeInTheDocument();
      expect(screen.getByText(/Digest Code: digest_inv_abc/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Hide technical trace/i }));
      expect(screen.queryByText(/SyntaxError: Unexpected token/i)).not.toBeInTheDocument();
    });
  });
});

