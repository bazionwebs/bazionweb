import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Loader2 } from 'lucide-react';
import PackagesClient from './PackagesClient';

export const metadata: Metadata = {
  title: 'Packages & Upgrades',
  description:
    'Browse, configure, subscribe, or commission Cloud Care retainers, website & e-commerce builds, managed hosting, and add-ons directly inside your BazionWeb workspace.',
};

export default function PortalPackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
          <span className="text-xs font-medium">Loading commercial catalog…</span>
        </div>
      }
    >
      <PackagesClient />
    </Suspense>
  );
}

