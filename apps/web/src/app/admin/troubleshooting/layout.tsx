import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Troubleshooting & Anomaly Radar',
  description: 'Proactive fleet diagnostics, orphan resolution, and remediation actions.',
};

export default function AdminTroubleshootingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
