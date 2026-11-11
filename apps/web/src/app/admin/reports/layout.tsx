import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports & Analytics',
  description: 'View financial aggregates, conversion funnels, and fleet metrics.',
};

export default function AdminReportsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
