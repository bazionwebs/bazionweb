import type { Metadata } from 'next';
import AuthGuard from '@/components/auth/AuthGuard';
import PortalDashboard from '@/components/sections/PortalDashboard';

export const metadata: Metadata = {
  title: 'Client Portal | BazionWeb',
  description: 'Manage your website, view reports, and track support tickets.',
};

export default function PortalPage() {
  return (
    <AuthGuard requiredRoles={['CLIENT', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT']}>
      <PortalDashboard />
    </AuthGuard>
  );
}
