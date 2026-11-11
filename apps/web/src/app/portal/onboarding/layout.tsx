import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Onboarding',
  description: 'Complete your client project intake and requirements briefing.',
};

export default function PortalOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
