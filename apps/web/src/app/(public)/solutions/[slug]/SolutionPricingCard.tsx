'use client';

import Link from 'next/link';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface BundleProps {
  bundle: {
    packageName: string;
    packagePriceKenya: string;
    packagePriceIntl: string;
    carePlan: string;
    carePriceKenya: string;
    carePriceIntl: string;
    summary: string;
  };
  addons: string[];
}

export default function SolutionPricingCard({ bundle, addons }: BundleProps) {
  const { market } = useMarketPreference();
  const buildPrice = market === 'kenya' ? bundle.packagePriceKenya : bundle.packagePriceIntl;
  const carePrice = market === 'kenya' ? bundle.carePriceKenya : bundle.carePriceIntl;

  return (
    <div className="bg-white rounded-3xl border-2 border-[#0D9488]/40 shadow-xl overflow-hidden">
      <div className="bg-[#0F172A] text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6] mb-1 block">
            Integrated Solution Stack
          </span>
          <h3 className="text-2xl font-black text-white">{bundle.packageName}</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-md">{bundle.summary}</p>
        </div>

        <div className="text-left md:text-right shrink-0">
          <div className="text-xs text-slate-400 font-medium">Build Investment</div>
          <div className="text-3xl font-black text-white tracking-tight">{buildPrice}</div>
          <div className="text-xs text-teal-400 font-semibold mt-0.5">
            + {bundle.carePlan} ({carePrice})
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Core Scope Deliverables:
          </h4>
          <div className="space-y-2.5">
            {[
              'Custom UI/UX architecture aligned with your sector',
              'Full CMS & self-service administration',
              'Enterprise security hardening & automated daily backups',
              'Core Web Vitals performance tuning (Lighthouse 90+)',
              'Staff training video & operational documentation',
              'Dedicated defect warranty period included',
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Recommended Modular Add-Ons:
          </h4>
          <div className="space-y-2 mb-6">
            {addons.map((addon, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-medium text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                <span>{addon}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
            <Link
              href="/quote"
              className="btn-primary w-full justify-center text-xs py-3 shadow-md"
            >
              Configure in Digital Quotation Engine <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>100% Client Asset & Data Ownership Guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
