'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  Mail,
  Building2,
  Phone,
  ArrowRight,
  CheckCircle2,
  Lock,
  Loader2,
  ShieldCheck,
  Globe,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';

const PLAN_META: Record<string, { name: string; price: string; priceKes: string; description: string; features: string[]; color: string }> = {
  starter: {
    name: 'Care Starter',
    price: '$29/mo',
    priceKes: 'KES 3,800/mo',
    description: 'SSL, daily backups, and continuous monitoring.',
    features: ['Cloud Deployment', 'Auto SSL', 'Daily Backups', 'Uptime Monitoring'],
    color: 'from-slate-600 to-slate-800',
  },
  growth: {
    name: 'Care Growth',
    price: '$59/mo',
    priceKes: 'KES 7,700/mo',
    description: 'Full maintenance, WAF security, and priority support.',
    features: ['Everything in Starter', 'WAF Security', 'Malware Scanning', 'Priority Support'],
    color: 'from-blue-600 to-blue-800',
  },
  'care-essential': {
    name: 'Care Essential',
    price: '$75/mo',
    priceKes: 'KES 5,000/mo',
    description: 'Peace-of-mind maintenance keeping your site secure and updated.',
    features: ['CMS & Plugin Updates', 'Offsite Backups', 'Security Monitoring', '1 hr Support/mo'],
    color: 'from-teal-600 to-emerald-700',
  },
  'care-business': {
    name: 'Care Business',
    price: '$150/mo',
    priceKes: 'KES 10,000/mo',
    description: 'Proactive management with weekly updates and SEO health reviews.',
    features: ['Weekly Updates', 'Daily Backups', 'Core Web Vitals', '2 hrs Support/mo'],
    color: 'from-blue-600 to-indigo-700',
  },
  'care-professional': {
    name: 'Care Professional',
    price: '$300/mo',
    priceKes: 'KES 20,000/mo',
    description: 'Full engineering partnership with development support included.',
    features: ['Active Development', 'SEO Monitoring', '5 hrs Support/mo', 'Strategy Calls'],
    color: 'from-violet-600 to-purple-800',
  },
  business: {
    name: 'Business Plan',
    price: '$119/mo',
    priceKes: 'KES 15,500/mo',
    description: 'Complete lifecycle management with unlimited content updates.',
    features: ['Unlimited Updates', 'Staging Environment', 'Optimization', 'Priority Support'],
    color: 'from-indigo-600 to-blue-800',
  },
  enterprise: {
    name: 'Enterprise Plan',
    price: 'Custom',
    priceKes: 'KES 39,000+/mo',
    description: 'Dedicated account manager and custom SLA.',
    features: ['Dedicated Manager', 'Custom SLA', 'Quarterly Reviews', 'Disaster Recovery'],
    color: 'from-slate-700 to-slate-900',
  },
};

const DEFAULT_PLAN = 'care-business';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get('plan') || DEFAULT_PLAN;
  const plan = PLAN_META[planSlug] || PLAN_META[DEFAULT_PLAN];

  const setSession = useAuthStore(s => s.setSession);
  const setPendingPlan = useAuthStore(s => s.setPendingPlan);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [password, setPassword] = useState('');

  const step1Valid = firstName.trim() && lastName.trim() && email.trim();
  const step2Valid = password.length >= 8;

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!step2Valid) return;
    setError('');
    setLoading(true);

    // Simulate account creation — replace with real API call
    await new Promise(r => setTimeout(r, 1400));

    setPendingPlan(planSlug);

    setSession(
      {
        id: `new-${Date.now()}`,
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roles: ['CLIENT'],
        keycloakId: `new-${Date.now()}`,
        subscriptionStatus: 'PENDING',
      },
      'provisional-token',
      'provisional-refresh-token',
      86400 * 7,
    );

    setLoading(false);
    router.push('/portal/onboarding');
  }

  return (
    <div className="min-h-screen bg-[#0A0F1D] flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left sidebar: plan preview ─────────── */}
      <div className={`hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-12 bg-gradient-to-br ${plan.color} relative overflow-hidden shrink-0`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative z-10">
          <Logo variant="dark" markClassName="h-12 w-auto" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60 bg-white/10 px-3 py-1 rounded-full mb-4">
              <Sparkles className="w-3 h-3" />
              Your Selected Plan
            </span>
            <h2 className="text-3xl font-extrabold text-white mb-1">{plan.name}</h2>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black text-white">{plan.price}</span>
            </div>
            <span className="text-white/60 text-sm font-mono">{plan.priceKes}</span>
            <p className="mt-4 text-white/80 text-sm leading-relaxed">{plan.description}</p>
          </div>
          <ul className="space-y-3">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                <CheckCircle2 className="w-4 h-4 text-white/70 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>256-bit SSL · Paystack Certified · M-Pesa enabled</span>
          </div>
        </div>
      </div>

      {/* ── Right: form ─────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 overflow-y-auto">
        <div className="lg:hidden mb-6 flex flex-col items-center gap-3">
          <Logo variant="dark" markClassName="h-10 w-auto" />
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${plan.color} text-white text-xs font-bold shadow-lg`}>
            <Sparkles className="w-3.5 h-3.5" />
            {plan.name} — {plan.price}
          </span>
        </div>

        <div className="w-full max-w-md">
          {/* Progress indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all ${step >= 1 ? 'bg-[#2563EB] text-white' : 'bg-slate-800 text-slate-500'}`}>
              {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <span className={`text-xs font-semibold ${step === 1 ? 'text-white' : 'text-slate-500'}`}>Account Details</span>
            <div className={`flex-1 h-px transition-all ${step > 1 ? 'bg-[#2563EB]' : 'bg-slate-800'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all ${step === 2 ? 'bg-[#2563EB] text-white' : 'bg-slate-800 text-slate-500'}`}>
              2
            </div>
            <span className={`text-xs font-semibold ${step === 2 ? 'text-white' : 'text-slate-500'}`}>Set Password</span>
          </div>

          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">
              {step === 1 ? 'Step 1 of 2' : 'Step 2 of 2 — Almost there!'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {step === 1 ? 'Create your account' : 'Set your password'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {step === 1
                ? 'Your client hub will be ready in seconds. No credit card required yet.'
                : 'You can activate your plan by paying inside the dashboard after sign-up.'}
            </p>
          </div>

          {/* Step 1: Account details */}
          {step === 1 && (
            <form
              onSubmit={e => { e.preventDefault(); if (step1Valid) setStep(2); }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Wanjiku"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@yourcompany.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="company" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Company <span className="text-slate-600 font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Acacia Healthcare Ltd"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone <span className="text-slate-600 font-normal normal-case">(opt.)</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="website" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Website <span className="text-slate-600 font-normal normal-case">(opt.)</span></label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="website"
                      type="url"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="yoursite.co.ke"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!step1Valid}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-950/50 text-sm mt-2"
              >
                Continue to Password Setup
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-white">{firstName} {lastName}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{email}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-[#14B8A6] text-xs font-semibold hover:underline">Edit</button>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Create Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-11 py-3 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= n * 2
                          ? password.length >= 10 ? 'bg-emerald-500' : 'bg-yellow-500'
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {password.length < 8
                    ? 'Minimum 8 characters required'
                    : password.length >= 10
                    ? '✓ Strong password'
                    : 'Good — try to make it longer for more security'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!step2Valid || loading}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-950/50 text-sm mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Activate Account &amp; Continue</>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                By creating an account you agree to our{' '}
                <Link href="/legal/terms" className="text-[#14B8A6] hover:underline">Terms of Service</Link>
                {' '}&amp;{' '}
                <Link href="/legal/privacy" className="text-[#14B8A6] hover:underline">Privacy Policy</Link>.
                Your plan activates only after payment.
              </p>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/portal/login" className="text-[#14B8A6] font-semibold hover:underline">
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

