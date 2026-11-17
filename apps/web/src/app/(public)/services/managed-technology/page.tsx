import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Website Maintenance, Hosting & Care Plans Kenya | BazionWeb',
  description:
    'Proactive website management & care retainers in Kenya: high-speed cloud hosting, weekly updates, daily off-site backups, firewall defense, and SLA support hours.',
  alternates: { canonical: 'https://bazionweb.com/services/managed-technology' },
  keywords: [
    'website maintenance services Kenya',
    'website care plans Nairobi',
    'managed website hosting Kenya',
    'website support retainer Nairobi',
    'WordPress and Next.js maintenance',
  ],
  openGraph: {
    title: 'Managed Technology, Cloud Hosting & Care Retainers | BazionWeb',
    description:
      'Proactive website management: SSD NVMe cloud hosting, weekly updates, daily encrypted backups, firewall security, and SLA support.',
    url: 'https://bazionweb.com/services/managed-technology',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb Managed Technology' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function ManagedTechnologyServicePage() {
  const family = SERVICE_FAMILIES_DATA['managed-technology'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
