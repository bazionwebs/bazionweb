import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Settings',
  description: 'Manage platform parameters, API gateways, and operational policies.',
};

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
