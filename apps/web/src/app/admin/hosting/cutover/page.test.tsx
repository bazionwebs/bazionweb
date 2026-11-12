import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HostingCutoverPage from './page';
import { useCanSeeBilling, useHostingCutover, useLinkHostingPlatformDeployment } from '@/hooks/useAdminData';
import type { AdminHostingCutoverReport } from '@/hooks/useAdminData';

jest.mock('@/hooks/useAdminData', () => ({
  useCanSeeBilling: jest.fn(),
  useHostingCutover: jest.fn(),
  useLinkHostingPlatformDeployment: jest.fn(),
}));

const mockUseCanSeeBilling = useCanSeeBilling as jest.MockedFunction<typeof useCanSeeBilling>;
const mockUseHostingCutover = useHostingCutover as jest.MockedFunction<typeof useHostingCutover>;
const mockUseLinkHostingPlatformDeployment = useLinkHostingPlatformDeployment as jest.MockedFunction<typeof useLinkHostingPlatformDeployment>;
const refetch = jest.fn();
const mutateAsync = jest.fn();
const resetMutation = jest.fn();

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
    domainClaimConflict: false,
    candidatePlatformDeploymentId: 'deployment-1',
    platformClaimStatuses: ['ready'],
    classification: 'ready_to_map',
  }],
};

describe('HostingCutoverPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCanSeeBilling.mockReturnValue(true);
    mutateAsync.mockResolvedValue({});
    mockUseLinkHostingPlatformDeployment.mockReturnValue({
      mutateAsync,
      reset: resetMutation,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useLinkHostingPlatformDeployment>);
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
    expect(screen.getByText(/report is read-only and never changes provider resources/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /map deployment/i })).not.toBeInTheDocument();
  });

  it('requires admin billing visibility before showing hosting cutover data', () => {
    mockUseCanSeeBilling.mockReturnValue(false);

    render(<HostingCutoverPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('ADMIN or SUPER_ADMIN');
  });

  it('shows an operator hint for a dead-lettered domain ownership conflict', () => {
    mockUseHostingCutover.mockReturnValue({
      data: {
        ...report,
        items: [{ ...report.items[0], domainClaimConflict: true }],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    } as unknown as ReturnType<typeof useHostingCutover>);

    render(<HostingCutoverPage />);

    expect(screen.getByText('Domain ownership conflict · resolve before replay')).toBeInTheDocument();
  });

  it('requires an evidence reference and manual review before recording a ready mapping', async () => {
    render(<HostingCutoverPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Review mapping' }));
    expect(screen.getByRole('heading', { name: 'Review hosting mapping' })).toBeInTheDocument();
    expect(screen.getAllByText('deployment-1')).toHaveLength(2);

    const submit = screen.getByRole('button', { name: 'Record audited mapping' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Change or migration evidence reference/), {
      target: { value: 'CHG-2026-0042' },
    });
    fireEvent.click(screen.getByLabelText(/I manually verified this exact client/));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      hostingAccountId: 'hosting-1',
      platformDeploymentId: 'deployment-1',
      evidenceRef: 'CHG-2026-0042',
    }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Review hosting mapping' })).not.toBeInTheDocument());
  });

  it('requests the next report page when the operator advances pagination', async () => {
    render(<HostingCutoverPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(mockUseHostingCutover).toHaveBeenLastCalledWith(2, 50));
  });
});
