import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings',
  description: 'Manage your client profile, security credentials, and preferences.',
};

export default function PortalAccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
