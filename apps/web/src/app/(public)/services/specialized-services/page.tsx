import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Specialized Engineering: Migrations, Security & Speed',
  description:
    'Surgical technical interventions: zero-downtime platform migrations, security penetration audits, malware cleanup, and Core Web Vitals speed optimization.',
  alternates: { canonical: 'https://bazionweb.com/services/specialized-services' },
};

export default function SpecializedServicesPage() {
  const family = SERVICE_FAMILIES_DATA['specialized-services'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
