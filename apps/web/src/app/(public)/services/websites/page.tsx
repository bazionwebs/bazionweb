import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Website Design & Development Services',
  description:
    'Custom Next.js websites for startups, businesses, and corporations in Kenya and worldwide. Launch, Business, Professional, and Corporate packages.',
  alternates: { canonical: 'https://bazionweb.com/services/websites' },
};

export default function WebsitesServicePage() {
  const family = SERVICE_FAMILIES_DATA['websites'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
