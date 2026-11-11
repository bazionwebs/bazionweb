import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Request a secure password reset link for your account.',
};

export default function PortalResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
