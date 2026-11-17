import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Custom Web Applications & Client Portal Development | BazionWeb Kenya',
  description:
    'Bespoke client portals, booking engines, LMS education platforms, and custom CRMs engineered on Next.js, NestJS, and PostgreSQL with 100% IP ownership.',
  alternates: { canonical: 'https://bazionweb.com/services/custom-systems' },
  keywords: [
    'custom web application Kenya',
    'client portal development Nairobi',
    'custom software company Kenya',
    'bespoke web portal development',
    'custom CRM development Nairobi',
  ],
  openGraph: {
    title: 'Custom Web Systems, Portals & Software Development | BazionWeb',
    description:
      'Bespoke client portals, booking engines, LMS educational platforms, and CRMs engineered around your exact workflow.',
    url: 'https://bazionweb.com/services/custom-systems',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb Custom Systems' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function CustomSystemsServicePage() {
  const family = SERVICE_FAMILIES_DATA['custom-systems'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
