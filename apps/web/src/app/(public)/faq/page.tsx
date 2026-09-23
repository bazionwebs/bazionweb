import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import FaqAccordion, { type FaqItem } from '@/components/faq/FaqAccordion';
import JsonLd from '@/components/seo/JsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers about managed website services: timelines, ownership, pricing, SEO guarantees, support response times, and cancellation.',
  alternates: { canonical: 'https://bazionweb.com/faq' },
};

const faqs: FaqItem[] = [
  {
    q: 'How fast can you build my website?',
    a: 'Simple sites (up to 10 pages) typically launch within 30 days, larger sites within 60 days, and custom-programmed builds within 120–180 days. You approve a design mockup before we write code, and we keep you updated at every phase.',
  },
  {
    q: 'Do I own my website, domain, and content?',
    a: 'Yes — 100%. Your domain stays in your name, and you own the website and all its content outright. We only ask for the access needed to manage it on your behalf.',
  },
  {
    q: 'Are there hidden costs on top of the plan price?',
    a: 'No. Plans are flat monthly rates covering everything listed on the pricing page. Third-party costs like domain renewals or ad budgets are quoted separately before anything is spent.',
  },
  {
    q: 'Will my website rank on Google?',
    a: 'Every site we build ships SEO-ready (semantic HTML, meta tags, sitemap, structured data, Core Web Vitals). Rankings themselves require ongoing work, which is exactly what our management and maintenance plans cover.',
  },
  {
    q: 'What happens if I cancel my subscription?',
    a: 'You can cancel anytime with 30 days notice. Your website, domain, and content remain yours, and we hand over full access plus documentation. There is a 30-day money-back guarantee on new subscriptions.',
  },
  {
    q: 'Can you redesign my existing site without losing rankings?',
    a: 'Yes. We preserve your URL structure, meta tags, and content, then re-submit the site to search engines after launch. Protecting existing rankings is an explicit step in our build process.',
  },
  {
    q: 'Can I update the website myself?',
    a: 'Yes. Content-managed pages can be edited by your team at any time. Most clients still let us handle updates under their plan so nothing breaks — the choice is yours.',
  },
  {
    q: 'How fast do you respond to support requests?',
    a: 'Critical (P1) incidents get responses from 5 to 60 minutes depending on your plan, 24/7. Lower-priority tickets follow published SLA windows from 2 hours to 2 business days.',
  },
  {
    q: 'Do you handle hosting, backups, and security too?',
    a: 'Yes — that is the point of managed services. Hosting with 99.95% uptime SLA, daily encrypted backups, SSL management, WAF, and malware scanning are included in the relevant plans.',
  },
  {
    q: 'What does onboarding look like?',
    a: 'A free assessment first, then a proposal with fixed scope and timeline. After signup we migrate or build your site on staging, you approve it, and we launch with zero-downtime cutover.',
  },
  {
    q: 'Do you work with our existing tools and vendors?',
    a: 'Yes. We coordinate with your domain registrar, email provider, CRM, and any other vendors so you have a single point of accountability: us.',
  },
  {
    q: 'How do I track what you are doing each month?',
    a: 'Every plan includes a monthly report: updates applied, security scans, backups verified, uptime stats, and content changes — plus a client portal with tickets, invoices, and project tracking.',
  },
  {
    q: 'What happens if my website gets hacked?',
    a: 'We isolate the incident, restore from a clean encrypted backup, patch the entry point, and document everything. Managed-security clients get proactive WAF and malware monitoring to prevent it in the first place.',
  },
  {
    q: 'How do we get started?',
    a: 'Use the instant quote calculator for ballpark pricing, then request a free assessment. We reply within 24 hours with next steps and a fixed proposal.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'FAQ' }]} />
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
            Frequently asked questions
          </h1>
          <p className="text-lg text-slate-400">
            Straight answers about timelines, ownership, pricing, and support.
          </p>
        </div>
      </section>

      {/* Questions */}
      <section className="section bg-white">
        <div className="container-default max-w-3xl">
          <FaqAccordion items={faqs} />

          <div className="card p-6 mt-10 flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1">
              <p className="font-bold text-[#0F172A] mb-1">Still have questions?</p>
              <p className="text-sm text-slate-500">
                Send us a message — a real engineer replies within 24 hours.
              </p>
            </div>
            <Link href="/contact" className="btn-primary shrink-0">
              Contact us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
