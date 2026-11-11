import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoices & Billing',
  description: 'Manage manual billing, recurring retainers, and invoice settlement.',
};

export default function AdminInvoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
