import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Custom Web Systems, Portals & Software Development',
  description:
    'Bespoke client portals, booking engines, LMS educational platforms, and CRMs. Discovery-first software engineering with zero per-seat SaaS taxes.',
  alternates: { canonical: 'https://bazionweb.com/services/custom-systems' },
};

export default function CustomSystemsServicePage() {
  const family = SERVICE_FAMILIES_DATA['custom-systems'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
