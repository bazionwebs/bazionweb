import type { Metadata } from 'next';
import ContactForm from '@/components/sections/ContactForm';
import { Mail, Phone, MapPin, Clock, Calendar } from 'lucide-react';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Contact Our Engineering & Sales Team | BazionWeb',
  description: 'Get in touch for a free website assessment, custom software consultation, or e-commerce quote. Based in Nairobi, Kenya, serving clients worldwide.',
  alternates: { canonical: 'https://bazionweb.com/contact' },
};

const contactMethods = [
  {
    icon: Mail,
    label: 'Email us',
    value: 'hello@bazionweb.com',
    href: 'mailto:hello@bazionweb.com',
    sub: 'We reply within 24 hours',
  },
  {
    icon: Phone,
    label: 'Call us',
    value: '+254 721 287 053',
    href: 'tel:+254721287053',
    sub: 'Mon–Fri, 8am–6pm (UTC+3)',
  },
  // TODO: restore the support-ticket card (value: 'support.bazionweb.com',
  // icon: MessageSquare) once the Zammad portal is live —
  // see infrastructure/scripts/setup-support.sh and CHANGELOG.
];

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact BazionWeb',
          url: 'https://bazionweb.com/contact',
          description: 'Get in touch for a free website assessment, custom software consultation, or e-commerce quote.',
          mainEntity: {
            '@type': 'Organization',
            name: 'BazionWeb',
            email: 'hello@bazionweb.com',
            telephone: '+254721287053',
            contactPoint: {
              '@type': 'ContactPoint',
              email: 'hello@bazionweb.com',
              telephone: '+254721287053',
              contactType: 'customer support and sales',
              availableLanguage: ['English', 'Swahili'],
            },
          },
        }}
      />
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default">
          <div className="max-w-2xl">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Contact' }]} />
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              Get In Touch
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Let&apos;s talk about your website
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Whether you need a new website, better hosting, or full lifecycle management —
              we&apos;ll give you an honest assessment and a clear plan. No sales pressure.
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact methods */}
              <div className="card p-6">
                <h2 className="font-bold text-[#0F172A] mb-5">Contact options</h2>
                <div className="space-y-5">
                  {contactMethods.map(m => (
                    <a
                      key={m.label}
                      href={m.href}
                      className="flex items-start gap-3 group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                        <m.icon className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-0.5">{m.label}</div>
                        <div className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">{m.value}</div>
                        <div className="text-xs text-slate-400">{m.sub}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Response SLA */}
              <div className="card p-6 border-l-4 border-[#14B8A6]">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[#14B8A6]" />
                  <span className="font-semibold text-[#0F172A] text-sm">Our promise</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Every quote request receives a response within <strong className="text-[#0F172A]">24 business hours</strong>.
                  Urgent enquiries marked as such are responded to within 4 hours.
                </p>
              </div>

              {/* Location */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#2563EB]" />
                  <span className="font-semibold text-[#0F172A] text-sm">Remote-first, worldwide</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  We serve clients across the globe. Remote-first team with video meetings in your timezone.
                </p>
              </div>

              {/* Office hours */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#2563EB]" />
                  <span className="font-semibold text-[#0F172A] text-sm">Office hours</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {[
                    { day: 'Mon – Fri', hours: '8:00am – 6:00pm (UTC+3)' },
                    { day: 'Saturday', hours: '9:00am – 1:00pm (UTC+3)' },
                    { day: 'Sunday', hours: 'Emergency only' },
                  ].map(h => (
                    <div key={h.day} className="flex justify-between">
                      <span className="text-slate-400">{h.day}</span>
                      <span className="font-medium text-[#0F172A]">{h.hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
