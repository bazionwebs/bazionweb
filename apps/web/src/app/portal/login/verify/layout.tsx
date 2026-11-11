import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Two-Factor Verification',
  description: 'Enter your MFA verification code to confirm your identity.',
};

export default function PortalLoginVerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
