import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hosting & Domains',
  description: 'Manage fleet deployments, domain routing, and SSL status.',
};

export default function AdminHostingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
