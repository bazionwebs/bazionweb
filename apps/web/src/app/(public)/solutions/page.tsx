import type { Metadata } from 'next';
import Link from 'next/link';
import { SOLUTIONS_DATA } from '@/lib/solutionsData';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import {
  Building2,
  Church,
  GraduationCap,
  HeartHandshake,
  Rocket,
  Briefcase,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tailored Digital Solutions by Industry',
  description:
    'Domain-engineered web architectures for SMEs, Churches, Educational Institutions, NGOs, Tech Startups, and Professional Practices in Kenya and globally.',
  alternates: { canonical: 'https://bazionweb.com/solutions' },
};

const verticalIcons: Record<string, React.ElementType> = {
  smes: Building2,
  churches: Church,
  education: GraduationCap,
  ngos: HeartHandshake,
  startups: Rocket,
  'professional-services': Briefcase,
};

export default function SolutionsPage() {
  const verticals = Object.values(SOLUTIONS_DATA);

  return (
    <div className="bg-[#F8FAFC]">
      {/* ─── Hero ─── */}
      <section className="bg-[#0F172A] pt-32 pb-20 text-white relative overflow-hidden">
        <div className="container-default relative z-10 text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-4">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Solutions' }]} />
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
            Domain-Specific Digital Engineering
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Digital platforms engineered for your organization
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            We don&apos;t build generic brochure websites. We solve industry-specific bottlenecks: from M-Pesa tithe automation for churches to student portals for schools and high-converting funnels for SMEs.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/quote" className="btn-primary text-sm px-6 py-3">
              Configure Your Solution
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Explore Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Solutions Grid ─── */}
      <section className="py-20">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-4">
              Select Your Organizational Sector
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              Every vertical is backed by specialized feature stacks, compliance workflows, and proven case benchmarks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {verticals.map(vertical => {
              const Icon = verticalIcons[vertical.slug] || Building2;
              return (
                <div
                  key={vertical.slug}
                  className="bg-white rounded-2xl border border-slate-200/80 p-8 hover:shadow-xl hover:border-[#14B8A6]/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-6 group-hover:bg-[#14B8A6] transition-colors">
                      <Icon className="w-6 h-6 text-[#0D9488] group-hover:text-white transition-colors" />
                    </div>

                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {vertical.badge}
                    </span>

                    <h3 className="text-xl font-bold text-[#0F172A] mb-3 group-hover:text-[#0D9488] transition-colors">
                      {vertical.name}
                    </h3>

                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">
                      {vertical.shortDesc}
                    </p>

                    <div className="space-y-2 mb-6 pt-4 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Key Capabilities:
                      </div>
                      {vertical.solutionStack.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Link
                      href={`/solutions/${vertical.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#0D9488] group-hover:text-[#0f766e] transition-colors"
                    >
                      <span>Explore {vertical.name} Platform</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="bg-gradient-to-br from-[#0F172A] to-slate-900 py-16 text-white text-center">
        <div className="container-default max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4 text-white">
            Need a tailored solution for your organization?
          </h2>
          <p className="text-slate-300 text-sm md:text-base mb-8">
            Our systems engineers can walk you through architecture, data compliance, and return on investment during a free technical assessment.
          </p>
          <Link href="/quote" className="btn-primary text-sm px-8 py-3.5 shadow-lg">
            Request an Organizational Assessment
          </Link>
        </div>
      </section>
    </div>
  );
}
