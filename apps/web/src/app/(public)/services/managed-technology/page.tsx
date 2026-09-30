import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Managed Technology, Cloud Hosting & Care Retainers | BazionWeb',
  description:
    'Proactive website management: high-speed SSD NVMe hosting, weekly updates, daily off-site backups, firewall security, and included SLA support hours.',
  alternates: { canonical: 'https://bazionweb.com/services/managed-technology' },
};

export default function ManagedTechnologyServicePage() {
  const family = SERVICE_FAMILIES_DATA['managed-technology'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
