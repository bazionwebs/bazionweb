'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie } from 'lucide-react';

type ConsentState = 'pending' | 'accepted' | 'declined';

export default function CookieBanner() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('bw_cookie_consent') as ConsentState | null;
    if (!stored) {
      setState('pending');
      setTimeout(() => setVisible(true), 1500);
    } else {
      setState(stored);
    }
  }, []);

  function accept() {
    localStorage.setItem('bw_cookie_consent', 'accepted');
    setState('accepted');
    setVisible(false);
    // Enable PostHog analytics
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.opt_in_capturing();
    }
  }

  function decline() {
    localStorage.setItem('bw_cookie_consent', 'declined');
    setState('declined');
    setVisible(false);
    // Disable PostHog analytics
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.opt_out_capturing();
    }
  }

  if (!visible || state !== 'pending') return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-fade-up"
    >
      <div className="bg-[#0F172A] rounded-2xl shadow-2xl border border-white/10 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <span className="text-sm font-bold text-white">Cookie preferences</span>
          </div>
          <button
            onClick={decline}
            aria-label="Close cookie banner"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          We use strictly necessary cookies for authentication and optional analytics cookies (PostHog) to improve the site.
          {' '}
          <Link href="/legal/cookies" className="text-[#14B8A6] hover:underline">
            Cookie Policy
          </Link>
        </p>

        <div className="flex gap-2">
          <button
            onClick={decline}
            className="flex-1 px-4 py-2 rounded-xl border border-white/15 text-white text-xs font-semibold hover:bg-white/5 transition-colors"
          >
            Necessary only
          </button>
          <button
            onClick={accept}
            className="flex-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
