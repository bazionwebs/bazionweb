import React from 'react';
import { PRICING_PRINCIPLES } from '@/lib/pricingData';
import { ShieldCheck, Lock, DollarSign, Layers, Clock, CheckCircle } from 'lucide-react';

const icons = [
  ShieldCheck,
  Layers,
  DollarSign,
  CheckCircle,
  Clock,
  Lock,
];

export default function PricingPrinciplesSection() {
  return (
    <section className="section bg-white border-t border-slate-100">
      <div className="container-default max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#2563EB] mb-3">
            BazionWeb Code of Integrity
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
            Our Commercial & Pricing Principles
          </h2>
          <p className="text-slate-500 text-base leading-relaxed">
            We operate on radical scope clarity, zero technical hostage-taking, and transparent client ownership.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRICING_PRINCIPLES.map((principle, index) => {
            const Icon = icons[index % icons.length];
            return (
              <div
                key={principle.title}
                className="bg-slate-50/70 rounded-2xl p-7 border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100/60 text-[#2563EB] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[#0F172A] text-base mb-2">
                  {principle.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {principle.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Post-launch warranty table */}
        <div className="mt-12 bg-blue-50/50 rounded-2xl border border-blue-100 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h4 className="font-bold text-[#0F172A] text-lg">
                Included Post-Launch Defect Warranty by Tier
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Every website build includes an ironclad warranty covering defect fixes and launch stability.
              </p>
            </div>
            <span className="text-xs font-bold bg-[#2563EB] text-white px-3 py-1.5 rounded-full">
              Zero Billable Extras During Window
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { tier: 'Launch', days: '14 Days Free Support', for: 'Startups & Brochure Sites' },
              { tier: 'Business', days: '30 Days Free Support', for: 'SMEs & Organizations' },
              { tier: 'Professional', days: '60 Days Free Support', for: 'High-Touch Corporate' },
              { tier: 'Corporate', days: '90 Days Dedicated SLA', for: 'Custom Enterprise & Portals' },
            ].map(w => (
              <div key={w.tier} className="bg-white rounded-xl p-4 border border-blue-100/70 shadow-xs text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{w.tier}</div>
                <div className="text-sm font-extrabold text-[#2563EB] mb-1">{w.days}</div>
                <div className="text-[11px] text-slate-500">{w.for}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
