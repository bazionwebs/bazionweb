import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Operations & Vault Audit',
  description: 'Audit cryptographic secrets, token revocations, and system integrity.',
};

export default function AdminSecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
