import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Management',
  description: 'Manage client accounts, workspaces, and provisioning state.',
};

export default function AdminClientsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
