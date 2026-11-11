import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVICE_FAMILIES_DATA } from '@/lib/servicesFamilyData';
import ServiceFamilyView from '@/components/services/ServiceFamilyView';

export const metadata: Metadata = {
  title: 'E-Commerce Website Development & M-Pesa Integration',
  description:
    'High-converting online stores with Safaricom M-Pesa STK Push prompts, credit card gateways, inventory alerts, and automated receipts.',
  alternates: { canonical: 'https://bazionweb.com/services/ecommerce' },
};

export default function EcommerceServicePage() {
  const family = SERVICE_FAMILIES_DATA['ecommerce'];
  if (!family) notFound();

  return <ServiceFamilyView family={family} />;
}
