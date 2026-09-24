import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Target, Eye, Heart, Shield, Users, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About',
  description: 'BazionWeb is a managed website lifecycle company built for SMEs worldwide.',
  alternates: { canonical: 'https://bazionweb.com/about' },
};

const values = [
  {
    icon: Shield,
    name: 'Security-first',
    desc: 'Every decision assumes a hostile internet. WAF, MFA, encrypted backups — not options, defaults.',
  },
  {
    icon: TrendingUp,
    name: 'Reliability-first',
    desc: '99.95% uptime is a promise in our SLA, not a marketing phrase. We monitor everything, 24/7.',
  },
  {
    icon: Users,
    name: 'Client-first',
    desc: 'Every feature we build, every process we run — exists to make a client\'s business better.',
  },
  {
    icon: Eye,
    name: 'Transparency-first',
    desc: 'No hidden complexity, no hidden pricing. You see exactly what you\'re paying for and why.',
  },
];

const milestones = [
  { year: '2024', event: 'BazionWeb founded as a remote-first company' },
  { year: 'Q1 2025', event: 'MVP platform launched — first 10 clients onboarded' },
  { year: 'Q2 2025', event: 'Reached 30 managed websites worldwide' },
  { year: 'Q3 2025', event: 'Launched security management and performance optimization tiers' },
  { year: 'Q4 2025', event: 'Scaling toward 100-client milestone on Hetzner infrastructure' },
];

const team = [
  {
    name: 'Joseph M.',
    role: 'Founder & CTO',
    desc: 'Full-stack engineer and systems architect with deep roots in cloud infrastructure and managed services.',
    initials: 'JM',
    color: 'from-[#2563EB] to-[#14B8A6]',
    photo: '/team/joseph-m.jpg',
  },
  {
    name: 'Mary Mbuiya Kimani',
    role: 'Sales & Business Development',
    desc: 'Owns the outbound pipeline and client relationships — from discovery calls and proposals to onboarding and growth.',
    initials: 'MK',
    color: 'from-[#14B8A6] to-[#2563EB]',
    photo: '/team/mary-m.jpg',
  },
];

const targetMarkets = [
  { icon: '🏥', label: 'Healthcare & Clinics' },
  { icon: '⚖️', label: 'Professional Services' },
  { icon: '🏗️', label: 'Construction & Real Estate' },
  { icon: '🌱', label: 'NGOs & Non-profits' },
  { icon: '🎓', label: 'Education & Training' },
  { icon: '🛍️', label: 'E-commerce & Retail' },
  { icon: '🚀', label: 'Startups & Tech' },
  { icon: '🏢', label: 'SMEs (5–50 staff)' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="section bg-[#0F172A] pt-32 overflow-hidden relative">
        <div className="absolute -top-40 right-0 w-[600px] h-[600px] rounded-full bg-[#2563EB]/8 blur-[120px] pointer-events-none" />
        <div className="container-default relative z-10">
          <div className="max-w-3xl">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'About' }]} />
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              About BazionWeb
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Built for businesses that don&apos;t have time to manage their website
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed max-w-2xl">
              We started BazionWeb because we kept seeing the same story: great businesses with slow, broken, or abandoned websites — because no single provider owned the whole picture.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section bg-white">
        <div className="container-default">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Target className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Our Mission</h2>
              </div>
              <p className="text-slate-600 leading-relaxed text-lg mb-6">
                To provide enterprise-grade website lifecycle management for small and medium enterprises through transparent pricing, exceptional support, and complete lifecycle ownership.
              </p>
              <p className="text-slate-500 leading-relaxed">
                That means a single provider who builds your site, hosts it, secures it, maintains it, and supports you when something goes wrong — on one predictable monthly invoice.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#14B8A6]" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Our Vision</h2>
              </div>
              <p className="text-slate-600 leading-relaxed text-lg mb-6">
                To become the most trusted managed web services provider for SMEs worldwide, known for reliability, transparency, and measurable business impact.
              </p>
              <p className="text-slate-500 leading-relaxed">
                We started with a simple belief: every business deserves enterprise-grade web management. And we&apos;re delivering it to the same standard that enterprise businesses expect — just packaged for the businesses that actually need it most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-[#2563EB]" />
              <span className="eyebrow">Core Values</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A]">How we operate</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(v => (
              <div key={v.name} className="card p-6">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">{v.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The problem we solve */}
      <section className="section bg-white">
        <div className="container-default">
          <div className="max-w-3xl">
            <span className="eyebrow">The Problem We Solve</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-6">
                Most SMEs deal with the same website nightmare
              </h2>
              <div className="space-y-5">
                {[
                  ['Multiple vendors', 'Businesses juggle 3–7 vendors for design, hosting, support, and security. Nobody owns the whole picture.'],
                  ['Hidden costs', 'Hosting renewals, SSL charges, plugin fees arrive as surprise invoices. Budgeting is impossible.'],
                  ['No real support', 'Hosting providers don\'t do technical fixes. Freelancers disappear. You\'re on your own when things break.'],
                  ['Security gaps', 'SMEs have no capacity to manage WAF, malware scanning, or SSL rotation. Most find out about problems after they happen.'],
                ].map(([title, text]) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-1.5 rounded-full bg-gradient-to-b from-[#2563EB] to-[#14B8A6] shrink-0 my-1" />
                    <div>
                      <div className="font-semibold text-[#0F172A] mb-1">{title}</div>
                      <div className="text-sm text-slate-500 leading-relaxed">{text}</div>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </div>
      </section>

      {/* Who we serve */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <span className="eyebrow">Who We Serve</span>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">Built for real businesses</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              We work best with SMEs and organisations that have serious digital presence needs but no internal IT team.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {targetMarkets.map(m => (
              <div key={m.label} className="card p-4 text-center">
                <span className="text-2xl mb-2 block">{m.icon}</span>
                <span className="text-xs font-semibold text-slate-600">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section bg-white">
        <div className="container-default max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="eyebrow">Our Story</span>
            <h2 className="text-3xl font-bold text-[#0F172A]">Where we&apos;ve been</h2>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[#2563EB] via-[#14B8A6] to-transparent" />
            <div className="space-y-8 pl-12">
              {milestones.map((m, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-8 w-4 h-4 rounded-full bg-white border-2 border-[#2563EB] flex items-center justify-center top-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  </div>
                  <div className="text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-1">{m.year}</div>
                  <div className="text-slate-700">{m.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          <div className="text-center mb-12">
            <span className="eyebrow">The Team</span>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">People behind BazionWeb</h2>
            <p className="text-slate-500">A lean, expert team with a single focus: keeping your website healthy.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {team.map(t => (
              <div key={t.name} className="card p-8 text-center max-w-xs">
                {'photo' in t && t.photo ? (
                  <Image
                    src={t.photo}
                    alt={`${t.name}, ${t.role} at BazionWeb`}
                    width={320}
                    height={320}
                    className="w-20 h-20 rounded-2xl object-cover object-top mb-5 mx-auto shadow-md"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-black text-xl mb-5 mx-auto shadow-md`}>
                    {t.initials}
                  </div>
                )}
                <div className="font-bold text-[#0F172A] text-lg mb-1">{t.name}</div>
                <div className="text-sm font-medium text-[#2563EB] mb-3">{t.role}</div>
                <p className="text-sm text-slate-500 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-400 mt-8">
            Growing team — we&apos;re hiring across engineering, support, and client success.{' '}
            <Link href="/careers" className="text-[#2563EB] font-medium hover:underline">View open roles →</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-[#0F172A]">
        <div className="container-default text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
            Ready to work with us?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Tell us about your website. We&apos;ll give you an honest assessment and a clear path forward.
          </p>
          <Link href="/contact" className="btn-primary px-8 py-4 text-base">
            Start the conversation
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
