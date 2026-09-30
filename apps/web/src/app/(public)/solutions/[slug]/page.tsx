import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SOLUTIONS_DATA } from '@/lib/solutionsData';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import SolutionPricingCard from './SolutionPricingCard';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return Object.keys(SOLUTIONS_DATA).map(slug => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const data = SOLUTIONS_DATA[params.slug];
  if (!data) return {};

  return {
    title: `${data.name} Digital Platforms & Systems | BazionWeb`,
    description: data.heroSubtitle,
    alternates: { canonical: `https://bazionweb.com/solutions/${params.slug}` },
    keywords: [
      `${data.name} website Kenya`,
      `${data.name} digital platform`,
      `${data.name} management system`,
      'BazionWeb solutions',
    ],
  };
}

export default function SolutionDetailPage({ params }: Props) {
  const data = SOLUTIONS_DATA[params.slug];
  if (!data) notFound();

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return (
    <div className="bg-[#F8FAFC]">
      <JsonLd data={faqSchema} />

      {/* ─── Hero ─── */}
      <section className="bg-[#0F172A] pt-32 pb-20 text-white relative overflow-hidden">
        <div className="container-default relative z-10 max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Breadcrumbs
              trail={[
                { name: 'Home', href: '/' },
                { name: 'Solutions', href: '/solutions' },
                { name: data.name },
              ]}
            />
          </div>

          <span className="inline-block text-xs font-bold tracking-widest uppercase text-[#14B8A6] bg-teal-950/60 px-3.5 py-1 rounded-full border border-teal-800/40 mb-4">
            {data.badge}
          </span>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            {data.heroTitle}
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            {data.heroSubtitle}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/quote?solution=${data.slug}`}
              className="btn-primary text-sm px-7 py-3.5 shadow-md shadow-teal-500/20"
            >
              Configure Your Platform Quote
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Book Solutions Call
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Sector Overview & Pain Points ─── */}
      <section className="py-20">
        <div className="container-default max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              The Reality of the Sector
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#0F172A] mb-4">
              Common Bottlenecks We Eliminate
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              {data.overview}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {data.painPoints.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>The Problem</span>
                  </div>
                  <h3 className="font-bold text-[#0F172A] text-base mb-2">{item.problem}</h3>
                  <p className="text-xs text-slate-500 mb-4">{item.consequence}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 bg-teal-50/50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                  <div className="flex items-center gap-1.5 text-teal-700 text-xs font-bold uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>BazionWeb Solution</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {item.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Proven Metric Banner ─── */}
          <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#0F172A] text-white rounded-2xl p-8 text-center flex flex-col sm:flex-row items-center justify-around gap-6 border border-slate-800">
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#14B8A6] mb-1">
                {data.proofMetric.stat}
              </div>
              <div className="text-xs md:text-sm text-slate-300 font-medium">
                {data.proofMetric.label}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-3 text-left">
              <ShieldCheck className="w-10 h-10 text-[#14B8A6] shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">100% Client Asset Ownership</div>
                <div className="text-xs text-slate-400">Domains, code, databases, and credentials.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Solution Stack ─── */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="container-default max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Engineered Architecture
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#0F172A] mb-4">
              What We Build for {data.name}
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              A comprehensive system built around your team&apos;s exact workflows and compliance guidelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {data.solutionStack.map((stack, idx) => (
              <div
                key={idx}
                className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200/70 hover:border-[#0D9488]/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-[#0D9488] font-bold text-sm flex items-center justify-center mb-4">
                  0{idx + 1}
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2">{stack.title}</h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  {stack.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Recommended Bundle & Pricing ─── */}
      <section className="py-20">
        <div className="container-default max-w-4xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Investment Blueprint
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] mb-3">
              Recommended Solution Package
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              Transparent baseline quotation with zero hidden licensing markups.
            </p>
          </div>

          <SolutionPricingCard bundle={data.recommendedBundle} addons={data.recommendedAddons} />
        </div>
      </section>

      {/* ─── Sector FAQs ─── */}
      <section className="py-20 bg-white border-t border-slate-200/80">
        <div className="container-default max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Operational Clarity
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] mb-3">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {data.faqs.map((faq, i) => (
              <div key={i} className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/80">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[#0D9488] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] mb-2">{faq.question}</h3>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-[#0F172A] py-16 text-white text-center">
        <div className="container-default max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black mb-4">
            Ready to upgrade your organization&apos;s digital platform?
          </h2>
          <p className="text-slate-300 text-sm mb-8">
            Speak directly with a senior systems engineer. We assess your workflows, compliance requirements, and timeline.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/quote?solution=${data.slug}`} className="btn-primary text-sm px-8 py-3.5">
              Start Free Assessment
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Contact Us Directly
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
