import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'E-Commerce Website Development Kenya | M-Pesa STK Push Integration',
  description:
    'High-converting online stores with automated Safaricom M-Pesa STK Push checkout, Stripe/card processing, inventory sync, and PDF receipts in Kenya and worldwide.',
  alternates: { canonical: 'https://bazionweb.com/services/ecommerce' },
  keywords: [
    'ecommerce website Kenya',
    'ecommerce development Nairobi',
    'M-Pesa payment integration',
    'online store development Kenya',
    'Daraja STK push integration',
    'ecommerce developers Kenya',
  ],
  openGraph: {
    title: 'E-Commerce Website Development & M-Pesa Integration | BazionWeb',
    description:
      'High-converting online stores with automated M-Pesa STK Push, credit card gateways, inventory tracking, and automated receipts.',
    url: 'https://bazionweb.com/services/ecommerce',
    siteName: 'BazionWeb',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb E-Commerce Development' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function EcommerceServicePage() {
  const family = SERVICE_FAMILIES_DATA['ecommerce'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
