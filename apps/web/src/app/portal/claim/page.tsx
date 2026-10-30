'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Mail, ArrowLeft,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { resolveApiV1Base } from '@/lib/api-base';

const API_BASE = resolveApiV1Base();

function ClaimContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const claimToken = searchParams.get('token') || '';

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [devPreviewUrl, setDevPreviewUrl] = useState('');
  const [devNotice, setDevNotice] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (claimToken && typeof window !== 'undefined') {
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (email ? `?email=${encodeURIComponent(email)}` : '')
      );
    }
  }, [claimToken, email]);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDevPreviewUrl('');
    setDevNotice('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter the billing email you used during payment.');
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch('/api/auth/claim-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) setError('Too many attempts. Wait a minute and try again.');
        else setError(data.error || 'Could not send the claim link. Please try again shortly.');
        return;
      }

      if (typeof data.devPreviewUrl === 'string' && data.devPreviewUrl) {
        setDevPreviewUrl(data.devPreviewUrl);
      }
      if (typeof data.devNotice === 'string' && data.devNotice) {
        setDevNotice(data.devNotice);
      }

      // Generic response by design: never reveal whether the email is known,
      // paid, or already claimed.
      setRequestSent(true);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setRequesting(false);
    }
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!claimToken) {
      setError('Open the claim link from your inbox first.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter the billing email you used during payment.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/claim-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          claimToken,
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const payload = body?.data ?? body;

      if (res.ok && payload?.accessToken) {
        try {
          const { useAuthStore } = await import('@/store/auth.store');
          useAuthStore.getState().setSession(
            payload.user,
            payload.accessToken,
            payload.refreshToken,
            payload.expiresIn,
          );
        } catch {
          // Session storage failures shouldn't block the redirect.
        }
        setDone(true);
        router.replace('/portal');
        return;
      }

      if (res.status === 403) {
        setError(body.message || 'This claim link is invalid or has expired. Request a new one.');
      } else if (res.status === 429) {
        setError('Too many attempts. Wait a minute and try again.');
      } else {
        setError(body.message || 'Could not activate the account. Contact support if this persists.');
      }
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-slate-900 text-center">
        <div className="space-y-4 py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-[#0F172A]">Account Ready</h1>
          <p className="text-xs text-slate-500">Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-slate-900">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-[#0F172A]">
          {claimToken ? 'Set Your Password' : 'Claim Your Account'}
        </h1>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {claimToken
            ? 'Your payment is confirmed. Set a password to open your workspace.'
            : 'Enter the billing email you used at checkout. We will send a one-time link to set your password.'}
        </p>
      </div>

      {!claimToken && requestSent ? (
        <div className="space-y-5 py-4 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Check your inbox</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              If <strong className="text-slate-700">{email.trim()}</strong> has a paid,
              unclaimed account, a secure claim link is on its way. It expires in 15 minutes.
            </p>
          </div>
          {devPreviewUrl && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-2.5">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Local Dev Fallback:</strong> {devNotice || 'Live email delivery was skipped in local development.'}
              </p>
              <a
                href={devPreviewUrl}
                className="btn-primary w-full py-2.5 justify-center text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Open Claim Link Directly (Dev)
              </a>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setRequestSent(false); setError(''); }}
              className="btn-primary w-full py-3 justify-center text-xs font-bold"
            >
              Send Another Link
            </button>
            <Link href="/portal/login" className="text-xs text-slate-500 hover:text-slate-700 py-1">
              Already set up? Sign in
            </Link>
          </div>
        </div>
      ) : !claimToken ? (
        <form onSubmit={handleRequestLink} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Billing Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={requesting}
            className="btn-primary w-full py-3.5 justify-center text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-60"
          >
            {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Email Me a Claim Link</>}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            We only send claim links to paid billing addresses.
          </div>
        </form>
      ) : (
        <form onSubmit={handleClaim} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Billing Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              This must match the address that received the claim link.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                autoComplete="given-name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Wanjiku"
                autoComplete="family-name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {error}
                {(error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid')) && (
                  <> <Link href="/portal/claim" className="font-bold underline">Request a new link</Link></>
                )}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3.5 justify-center text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Activate My Dashboard</>}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Passwords are stored salted & hashed — we never see them.
          </div>

          <button
            type="button"
            onClick={() => router.replace('/portal/claim')}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 pt-1"
          >
            <ArrowLeft className="w-3 h-3" /> Use a different email
          </button>
        </form>
      )}

      {!requestSent && (
        <p className="text-center text-xs text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/portal/login" className="font-bold text-[#2563EB] hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}

export default function PortalClaimPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="mb-6">
          <Logo variant="dark" markClassName="h-16 w-auto" />
        </div>

        <Suspense
          fallback={
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563EB] mb-2" />
              <span className="text-xs">Preparing your account…</span>
            </div>
          }
        >
          <ClaimContent />
        </Suspense>
      </div>
    </div>
  );
}
