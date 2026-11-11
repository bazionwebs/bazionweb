import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Registration',
  description: 'Client workspace account registration and plan onboarding.',
};

export default function PortalRegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
