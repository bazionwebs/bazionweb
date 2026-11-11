import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claim Your Workspace',
  description: 'Activate your client workspace and set your master credentials.',
};

export default function PortalClaimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
