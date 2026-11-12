import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HostingCutoverPage from './page';
import { useCanSeeBilling, useHostingCutover } from '@/hooks/useAdminData';
import type { AdminHostingCutoverReport } from '@/hooks/useAdminData';

jest.mock('@/hooks/useAdminData', () => ({
  useCanSeeBilling: jest.fn(),
  useHostingCutover: jest.fn(),
}));

const mockUseCanSeeBilling = useCanSeeBilling as jest.MockedFunction<typeof useCanSeeBilling>;
const mockUseHostingCutover = useHostingCutover as jest.MockedFunction<typeof useHostingCutover>;
const refetch = jest.fn();

const report: AdminHostingCutoverReport = {
  generatedAt: '2026-11-12T00:00:00.000Z',
  page: 1,
  pageSize: 50,
  totalPages: 2,
  summary: {
    activeHostingAccounts: 1,
    linked: 0,
    readyToMap: 1,
    ambiguousPlatformClaims: 0,
    domainClaimedByOtherClient: 0,
    platformClaimNotReady: 0,
    linkedConflicts: 0,
    legacyOnly: 0,
  },
  items: [{
    hostingAccountId: 'hosting-1',
    clientId: 'client-1',
    domain: 'example.org',
    hostingStatus: 'ACTIVE',
    platformDeploymentId: null,
    platformProjectionStatus: null,
    domainClaimCount: 1,
    clientDomainClaimCount: 1,
    candidatePlatformDeploymentId: 'deployment-1',
    platformClaimStatuses: ['ready'],
    classification: 'ready_to_map',
  }],
};

describe('HostingCutoverPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCanSeeBilling.mockReturnValue(true);
    mockUseHostingCutover.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    } as unknown as ReturnType<typeof useHostingCutover>);
  });

  it('shows the read-only cutover report and does not offer automatic mapping', () => {
    render(<HostingCutoverPage />);

    expect(screen.getByRole('heading', { name: 'Platform hosting cutover' })).toBeInTheDocument();
    expect(screen.getByText('example.org')).toBeInTheDocument();
    expect(screen.getByText('deployment-1')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('1 row(s) need review')).toBeInTheDocument();
    expect(screen.getAllByText('Ready to map')).toHaveLength(2);
    expect(screen.getByText(/never links accounts or changes provider resources/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /map deployment/i })).not.toBeInTheDocument();
  });

  it('requires admin billing visibility before showing hosting cutover data', () => {
    mockUseCanSeeBilling.mockReturnValue(false);

    render(<HostingCutoverPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('ADMIN or SUPER_ADMIN');
  });

  it('requests the next report page when the operator advances pagination', async () => {
    render(<HostingCutoverPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(mockUseHostingCutover).toHaveBeenLastCalledWith(2, 50));
  });
});