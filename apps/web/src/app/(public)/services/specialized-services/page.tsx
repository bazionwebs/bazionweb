import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Specialized Web Engineering: Migrations, Security & Speed | BazionWeb',
  description:
    'Surgical technical interventions: zero-downtime platform migrations, security audits, malware cleanup, and Core Web Vitals speed optimization for high-traffic sites.',
  alternates: { canonical: 'https://bazionweb.com/services/specialized-services' },
  keywords: [
    'website migration services',
    'website speed optimization Kenya',
    'Core Web Vitals optimization',
    'hacked website malware removal',
    'website security audit Kenya',
  ],
  openGraph: {
    title: 'Specialized Engineering: Migrations, Security & Speed | BazionWeb',
    description:
      'Zero-downtime platform migrations, security audits, malware cleanup, and Core Web Vitals speed optimization.',
    url: 'https://bazionweb.com/services/specialized-services',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb Specialized Engineering' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function SpecializedServicesPage() {
  const family = SERVICE_FAMILIES_DATA['specialized-services'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
