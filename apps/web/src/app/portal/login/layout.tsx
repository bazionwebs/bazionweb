import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Sign In',
  description: 'Sign in to access your projects, hosting fleet, and invoices.',
};

export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
