import React from 'react';
import Link from 'next/link';
import { ServiceFamily } from '@/lib/servicesFamilyData';
import MarketPriceText, { MarketPriceTag } from '@/components/market/MarketPrice';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import {
  Check,
  HelpCircle,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  family: ServiceFamily;
}

/**
 * Server component — the market-aware price strings are injected by the tiny
 * <MarketPriceText /> client island, so the page ships fully static HTML and
 * only hydrates the price leaves (no GLOBAL→KE flash for Kenyan visitors).
 */
export default function ServiceFamilyView({ family }: Props) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: family.faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: typeof f.answer === 'string' ? f.answer : f.answer.GLOBAL,
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
                { name: 'Services', href: '/services' },
                { name: family.name },
              ]}
            />
          </div>

          <span className="inline-block text-xs font-bold tracking-widest uppercase text-[#14B8A6] bg-teal-950/60 px-3.5 py-1 rounded-full border border-teal-800/40 mb-4">
            {family.badge}
          </span>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            {family.name}
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            {family.heroSubtitle}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/quote?service=${family.slug}`}
              className="btn-primary text-sm px-7 py-3.5 shadow-md shadow-teal-500/20 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span>Configure Your Project Quote</span>
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Compare All Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Who It Is For ─── */}
      <section className="py-20">
        <div className="container-default max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Organizational Fit
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] mb-3">
              Who This Service Is Engineered For
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              Select the package tier that aligns with your operational maturity and growth goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {family.whoItsFor.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-black text-[#0D9488] mb-2">TIER 0{idx + 1}</div>
                  <h3 className="text-lg font-bold text-[#0F172A] mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">{item.profile}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 text-xs text-slate-700 font-semibold bg-teal-50/50 -mx-7 -mb-7 p-4 rounded-b-2xl">
                  {typeof item.fit === 'string'
                    ? item.fit
                    : <MarketPriceText ke={item.fit.KE} global={item.fit.GLOBAL} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Packages & Pricing Grid ─── */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="container-default">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Transparent Commercial Packages
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#0F172A] mb-3">
              Included Deliverables & Fixed Rates
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-slate-500 mt-2">
              <span>Commercial Price Book:</span>
              <strong className="text-[#0F172A] font-bold">
                <MarketPriceTag />
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {family.packages.map(pkg => {
              return (
                <div
                  key={pkg.id}
                  className={`bg-[#F8FAFC] rounded-2xl border-2 p-6 flex flex-col justify-between transition-all hover:shadow-xl ${
                    pkg.popular
                      ? 'border-[#0D9488] bg-white shadow-md'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    {pkg.badge && (
                      <span
                        className={`inline-block text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider mb-2 ${
                          pkg.popular ? 'bg-[#0D9488] text-white' : 'bg-[#0F172A] text-white'
                        }`}
                      >
                        {pkg.badge}
                      </span>
                    )}
                    <h3 className="font-bold text-[#0F172A] text-lg mb-1">{pkg.name}</h3>
                    <div className="text-2xl font-black text-[#0F172A] mb-1">
                      <MarketPriceText ke={pkg.priceKenya} global={pkg.priceIntl} />
                    </div>
                    <div className="text-xs font-semibold text-[#0D9488] mb-1">{pkg.pagesOrScale}</div>
                    <div className="text-[11px] text-slate-400 mb-4">{pkg.timeline} · {pkg.warranty}</div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6 min-h-[2.5rem]">
                      {pkg.description}
                    </p>

                    <div className="mb-6">
                      <Link
                        href={pkg.ctaHref}
                        className={
                          pkg.popular
                            ? 'btn-primary w-full justify-center text-xs py-2.5 shadow-sm'
                            : 'btn-secondary w-full justify-center text-xs py-2.5'
                        }
                      >
                        Select {pkg.name}
                      </Link>
                    </div>

                    <div className="space-y-2 border-t border-slate-200/70 pt-4 text-xs text-slate-600">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Deliverables:
                      </div>
                      {pkg.deliverables.map((del, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{del}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Key Engineering Capabilities ─── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="container-default max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Engineering Architecture
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] mb-3">
              Standard Across Every Build
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {family.keyFeatures.map((feat, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0D9488] font-bold text-sm flex items-center justify-center mb-3">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">{feat.title}</h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>

          {/* Add-ons & Out of scope grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Add-ons */}
            <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0D9488]" />
                <span>Optional Modular Add-Ons</span>
              </h3>
              <div className="space-y-3">
                {family.modularAddons.map((addon, i) => {
                  return (
                    <div key={i} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-800">{addon.name}</div>
                        <div className="text-slate-400">{addon.description}</div>
                      </div>
                      <div className="font-black text-[#0D9488] shrink-0 ml-3">
                        <MarketPriceText ke={addon.priceKenya} global={addon.priceIntl} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scope Boundaries */}
            <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Explicit Scope Boundaries</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-600">
                {family.outOfScope.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                Clear boundaries protect your project timeline and prevent unexpected costs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQs ─── */}
      <section className="py-20 bg-white border-t border-slate-200/80">
        <div className="container-default max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] mb-2 block">
              Operational Answers
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] mb-3">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {family.faqs.map((faq, i) => (
              <div key={i} className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/80">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[#0D9488] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] mb-2">{faq.question}</h3>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                      {typeof faq.answer === 'string'
                        ? faq.answer
                        : <MarketPriceText ke={faq.answer.KE} global={faq.answer.GLOBAL} />}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="bg-[#0F172A] py-16 text-white text-center">
        <div className="container-default max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black mb-4">
            Let&apos;s build your {family.name.toLowerCase()}
          </h2>
          <p className="text-slate-300 text-sm mb-8">
            Backed by our 100% Client Ownership Guarantee, itemized scope quotation, and included defect warranty.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/quote?service=${family.slug}`} className="btn-primary text-sm px-8 py-3.5">
              Start Free Assessment
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Contact Engineering
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
