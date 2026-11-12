import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminReportsPage from '../src/app/admin/reports/page';

jest.mock('@/hooks/useAdminData', () => ({
  useSla: () => ({ data: null, isLoading: false, isError: false, refetch: jest.fn() }),
  useUptime: () => ({ data: { totalSites: 0, summary: [] }, isLoading: false, isError: false, refetch: jest.fn() }),
  useCanSeeBilling: () => true,
}));

jest.mock('@/components/ui/QueryState', () => ({
  SectionLoading: () => null,
  QueryError: () => null,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('admin service report print layout', () => {
  it('provides a branded print header and hides the export control from printed pages', () => {
    render(<AdminReportsPage />);

    expect(screen.getByText('Service reliability report')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'BazionWeb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Report/i })).toHaveClass('admin-report-no-print');
    expect(screen.getByText('No Monitored Sites')).toBeInTheDocument();
  });
});
