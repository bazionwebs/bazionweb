import type { Metadata } from 'next';
import { Suspense } from 'react';
import StoreView from '@/components/store/StoreView';

export const metadata: Metadata = {
  title: 'Store — Care Plans, Hosting & Add-ons | BazionWeb',
  description:
    'Browse BazionWeb managed care plans, hosting, and add-ons. Add multiple items to your cart and check out once with M-Pesa or card.',
};

export default function StorePage() {
  return (
    <Suspense fallback={null}>
      <StoreView />
    </Suspense>
  );
}
