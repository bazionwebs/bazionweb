import AuthGuard from '@/components/auth/AuthGuard';
import AdminDashboardClient from '@/components/sections/AdminDashboard';

export const metadata = { title: 'Admin | BazionWeb' };

export default function AdminPage() {
  return (
    <AuthGuard
      requiredRoles={['ADMIN', 'SUPER_ADMIN', 'SUPPORT']}
      redirectTo="/portal/login"
    >
      <AdminDashboardClient />
    </AuthGuard>
  );
}
