import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MagicVerifyPage from '../src/app/portal/login/verify/page';
import AdminInvoicesPage from '../src/app/admin/invoices/page';
import { useAuthStore } from '../src/store/auth.store';

let mockSearchParamsString =
  'token=magic_single_use_tok_777&redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1';
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockGenerateInvoice = jest.fn();
const mockRefetchInvoices = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  usePathname: () => '/portal/login/verify',
}));

jest.mock('../src/hooks/useAdminData', () => ({
  useCanSeeBilling: () => true,
  useAdminInvoices: () => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
    refetch: mockRefetchInvoices,
  }),
  useAdminClients: () => ({
    data: {
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          businessName: 'Global Missions For Christ International',
          email: 'globalmissions@example.org',
          country: 'KE',
        },
      ],
    },
  }),
  useMarkInvoicePaid: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('../src/lib/api', () => ({
  __esModule: true,
  default: {},
  adminApi: {
    generateInvoice: (...args: unknown[]) => mockGenerateInvoice(...args),
    getInvoicePdfLink: jest.fn(),
  },
}));

describe('MagicVerifyPage — regression against Next.js history.replaceState hang', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.getState().clearSession();
    mockSearchParamsString =
      'token=magic_single_use_tok_777&redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1';
    window.history.replaceState(
      {},
      '',
      '/portal/login/verify?token=magic_single_use_tok_777&redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1',
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('completes verification, stores session, and redirects even when searchParams lose ?token mid-flight', async () => {
    const fetchMock = jest.fn().mockImplementation(async () => {
      // Simulate Next.js App Router clearing searchParams while fetch is still in flight
      mockSearchParamsString = 'redirect=%2Fcheckout%3Fplan%3Dcare-essential%26cart%3D1';
      await new Promise((r) => setTimeout(r, 25));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            accessToken: 'jwt_access_live_1',
            refreshToken: 'jwt_refresh_live_1',
            expiresIn: 900,
            user: {
              id: 'usr_123',
              email: 'bazion001@gmail.com',
              firstName: 'Bazion',
              lastName: 'Client',
              roles: ['CLIENT'],
            },
          },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <React.StrictMode>
        <MagicVerifyPage />
      </React.StrictMode>,
    );

    // Force a re-render after searchParams dropped `token` (reproduces Next 14 history.replaceState patch)
    mockSearchParamsString = '';
    rerender(
      <React.StrictMode>
        <MagicVerifyPage />
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Verifying Secure Link/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('jwt_access_live_1');
    expect(useAuthStore.getState().user?.email).toBe('bazion001@gmail.com');

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/checkout?plan=care-essential&cart=1');
      },
      { timeout: 2000 },
    );
  });
});

describe('AdminInvoicesPage — 6-cycle billing selector & mandatory 4-step public flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateInvoice.mockResolvedValue({ id: 'inv_new_1' });
  });

  it('enforces Step 1 -> Step 2 -> Step 3 mandatory flow and allows selecting any of the 6 billing cycles', async () => {
    render(<AdminInvoicesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Generate B2B Invoice/i }));

    // Select Kenyan client -> auto-switches currency to KES and VAT 16%
    const clientSelect = screen.getByDisplayValue('-- Choose Client --');
    fireEvent.change(clientSelect, {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });

    const issueBtn = screen.getByRole('button', { name: /Issue Itemized B2B Invoice/i });
    expect(issueBtn).toBeDisabled();

    // Step 1: Select Launch Website Package (KES 25,000)
    const launchCard = screen.getByText('Launch Website Package').closest('div.border-2')!;
    fireEvent.click(launchCard.querySelector('button')!);

    // Issue button still disabled because Step 2 (Domain) and Step 3 (Hosting) are mandatory
    expect(issueBtn).toBeDisabled();

    // Advance to Step 2: Domain Name
    fireEvent.click(screen.getByRole('button', { name: /Continue to Step 2: Domain/i }));
    const domainInput = screen.getByPlaceholderText(/e\.g\. clientbusiness\.co\.ke/i);
    fireEvent.change(domainInput, { target: { value: 'globalmissions.or.ke' } });

    const keDomainCard = screen
      .getByText('.co.ke / .or.ke / .me.ke Domain Registration')
      .closest('div.border-2')!;
    fireEvent.click(keDomainCard.querySelector('button')!);

    // Auto-advances to Step 3: Managed Cloud Hosting, where all 6 billing cycles are selectable!
    expect(
      screen.getByRole('group', { name: /Billing commitment cycles/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Months \(-5%\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /6 Months \(-10%\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 Years \(-32%\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Years \(-40%\)/i })).toBeInTheDocument();

    // Switch commitment pill to 6 Months (-10%)
    fireEvent.click(screen.getByRole('button', { name: /6 Months \(-10%\)/i }));

    const hostBusinessSelect = document.getElementById(
      'cycle-select-host-business',
    ) as HTMLSelectElement;
    expect(hostBusinessSelect).toBeTruthy();
    expect(hostBusinessSelect.value).toBe('semi-annually');

    const hostBusinessCard = screen
      .getByText('Host Business Container')
      .closest('div.border-2')!;
    fireEvent.click(hostBusinessCard.querySelector('button')!);

    // Mandatory Steps 1, 2, and 3 are now satisfied (Step 4 Care Plan is optional) -> Issue button enabled!
    expect(issueBtn).not.toBeDisabled();

    fireEvent.click(issueBtn);

    await waitFor(() => {
      expect(mockGenerateInvoice).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: '11111111-1111-4111-8111-111111111111',
        currency: 'KES',
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'Launch Website Package',
            unitPrice: 25000,
          }),
          expect.objectContaining({
            description:
              '.co.ke / .or.ke / .me.ke Domain Registration (globalmissions.or.ke)',
            unitPrice: 1500,
          }),
          expect.objectContaining({
            description: expect.stringContaining('Host Business Container — Bi-Annual (6 Months)'),
            unitPrice: 5130,
          }),
        ]),
      }),
    );
  }, 60000);
});
