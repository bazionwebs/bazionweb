import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'Website Design & Development in Kenya | Next.js Corporate Websites',
  description:
    'Custom high-performance Next.js websites for startups, businesses, and corporations in Kenya and worldwide. Launch, Business, Professional, and Corporate packages with SEO built-in.',
  alternates: { canonical: 'https://bazionweb.com/services/websites' },
  keywords: [
    'website design Kenya',
    'web development Nairobi',
    'corporate website design Kenya',
    'Next.js web developer Kenya',
    'business web design Nairobi',
    'responsive website design Africa',
  ],
  openGraph: {
    title: 'Website Design & Development Services | BazionWeb',
    description:
      'Custom Next.js websites for startups, businesses, and corporations in Kenya and worldwide. Mobile-first UX, SEO readiness, and verified defect warranties.',
    url: 'https://bazionweb.com/services/websites',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb Website Design' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function WebsitesServicePage() {
  const family = SERVICE_FAMILIES_DATA['websites'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
