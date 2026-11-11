import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support Tickets & Triage',
  description: 'Manage SLA escalations, triage client inquiries, and assign engineers.',
};

export default function AdminTicketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
