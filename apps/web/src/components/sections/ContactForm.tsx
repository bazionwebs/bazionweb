'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface FormData {
  name: string;
  email: string;
  company: string;
  phone: string;
  plan: string;
  service: string;
  message: string;
  urgent: boolean;
}

const initialData: FormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  plan: '',
  service: '',
  message: '',
  urgent: false,
};

export default function ContactForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormData>(initialData);
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    const planParam = searchParams.get('plan') || searchParams.get('package');
    if (serviceParam || planParam) {
      setForm(prev => ({
        ...prev,
        service: serviceParam ? serviceParam : prev.service,
        plan: planParam ? planParam : prev.plan,
      }));
    }
  }, [searchParams]);

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.message.trim()) e.message = 'Tell us a bit about your website or needs';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState('submitting');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          phone: form.phone.trim(),
          serviceInterest: form.service || form.plan || 'General Inquiry',
          notes: `${form.urgent ? '[URGENT] ' : ''}${form.message}${form.plan ? ` (Plan: ${form.plan})` : ''}`,
          source: 'contact_page_form',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit message');
      }

      setState('success');
    } catch {
      setState('error');
    }
  }

  function field(id: keyof FormData) {
    return {
      value: form[id] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(prev => ({ ...prev, [id]: e.target.value })),
      className: `input${errors[id] ? ' input-error' : ''}`,
    };
  }

  if (state === 'success') {
    return (
      <div className="card p-10 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-[#22C55E]" />
        </div>
        <h3 className="text-xl font-bold text-[#0F172A]">Message received!</h3>
        <p className="text-slate-500 max-w-sm">
          We&apos;ll review your submission and get back to you within 24 hours (usually faster).
        </p>
        <button
          onClick={() => { setForm(initialData); setState('idle'); }}
          className="btn-secondary mt-2"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h2 className="text-xl font-bold text-[#0F172A] mb-2">Request a free assessment</h2>
      <p className="text-sm text-slate-500 mb-8">
        Fill in what you know — we&apos;ll follow up with any questions.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="label">Full name <span className="text-red-400">*</span></label>
            <input id="name" type="text" placeholder="Your name" {...field('name')} />
            {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">Email address <span className="text-red-400">*</span></label>
            <input id="email" type="email" placeholder="you@company.com" {...field('email')} />
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Company + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="company" className="label">Company / organisation</label>
            <input id="company" type="text" placeholder="Your business name" {...field('company')} />
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone number</label>
            <input id="phone" type="tel" placeholder="+1 555 123 4567" {...field('phone')} />
          </div>
        </div>

        {/* Plan + Service interest */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan" className="label">Plan interest</label>
            <select id="plan" {...field('plan')}>
              <option value="">Select a plan…</option>
              <option value="care-essential">Care Essential — KSh 5,000 / $75/mo</option>
              <option value="care-business">Care Business — KSh 10,000 / $150/mo</option>
              <option value="care-professional">Care Professional — KSh 20,000 / $300/mo</option>
              <option value="care-enterprise">Care Enterprise — Custom SLA</option>
              <option value="unsure">Not sure yet</option>
            </select>
          </div>
          <div>
            <label htmlFor="service" className="label">Primary service needed</label>
            <select id="service" {...field('service')}>
              <option value="">Select a service…</option>
              <option value="new-website">Build a new website</option>
              <option value="hosting">Hosting & management only</option>
              <option value="migration">Migrate existing website</option>
              <option value="security">Security audit/fix</option>
              <option value="performance">Performance optimization</option>
              <option value="maintenance">Ongoing maintenance</option>
              <option value="other">Something else</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="label">Tell us about your website <span className="text-red-400">*</span></label>
          <textarea
            id="message"
            rows={5}
            placeholder="What does your website do? What problems are you running into? What would success look like?"
            {...field('message')}
          />
          {errors.message && <p className="text-xs text-[#EF4444] mt-1">{errors.message}</p>}
        </div>

        {/* Urgent flag */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.urgent}
            onChange={e => setForm(prev => ({ ...prev, urgent: e.target.checked }))}
            className="w-4 h-4 accent-[#2563EB] rounded"
          />
          <span className="text-sm text-slate-600 group-hover:text-[#0F172A] transition-colors">
            This is urgent — I need a response within 4 hours
          </span>
        </label>

        {state === 'error' && (
          <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Something went wrong. Please try again or email us directly at hello@bazionweb.com
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="btn-primary w-full py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                Send message
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">
            By submitting, you agree to our Privacy Policy. We never share your data.
          </p>
        </div>
      </form>
    </div>
  );
}
