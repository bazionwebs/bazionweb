'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/ui/Logo';
import { toCleanUrl } from '@/lib/api-base';

export default function PortalLoginPage() {
  const { login } = useAuth();

  const [authMethod, setAuthMethod] = useState<'magic-link' | 'password'>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState('');

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid credentials. If you recently paid, claim your account from the link in your payment confirmation.');
    } finally {
      setLoading(false);
    }
  }

  const [deliveryInfo, setDeliveryInfo] = useState<{ delivered?: boolean; previewUrl?: string; message?: string } | null>(null);

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(toCleanUrl('/api/auth/magic-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch sign-in link');

      setDeliveryInfo(data);
      setMagicLinkSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch magic link. Please check your network.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo variant="dark" markClassName="h-16 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Client Operating Space
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sign in to your client hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Access live project milestones, encrypted credentials & billing
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
          {/* Auth Method Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMethod('magic-link'); setMagicLinkSent(false); setError(''); }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMethod === 'magic-link' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('password'); setError(''); }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMethod === 'password' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              Password
            </button>
          </div>

          {/* Magic Link Mode */}
          {authMethod === 'magic-link' && (
            <div>
              {!magicLinkSent ? (
                <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="magic-email" className="label text-xs">Work Email Address</label>
                    <input
                      id="magic-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input text-xs"
                      placeholder="e.g. sarah.kamau@yourcompany.com"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      We will email you a secure, passwordless authentication link.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="btn-primary w-full py-3 text-xs font-bold disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Sending Link…
                      </>
                    ) : (
                      'Send Secure Magic Link'
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0F172A]">Check your inbox</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {deliveryInfo?.delivered ? (
                        <>
                          A secure sign-in email was dispatched to <strong className="text-slate-800">{email}</strong>. Please check your inbox and spam folder.
                        </>
                      ) : (
                        <>
                          Sign-in link created for <strong className="text-slate-800">{email}</strong>.
                        </>
                      )}
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Open the link from your inbox to finish signing in. It expires in 15 minutes.
                  </p>
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => { setMagicLinkSent(false); setDeliveryInfo(null); }}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors block mx-auto pt-1"
                    >
                      &larr; Use another email
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standard Password Mode */}
          {authMethod === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="label text-xs">Email Address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input text-xs"
                  placeholder="you@yourcompany.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="label text-xs mb-0">Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('magic-link'); setMagicLinkSent(false); setError(''); }}
                    className="text-[11px] text-[#2563EB] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input text-xs pr-11"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full py-3 text-xs font-bold disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Just completed payment?{' '}
              <Link href="/portal/claim" className="font-semibold text-[#2563EB] hover:underline">
                Claim your account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Need onboarding assistance?{' '}
          <Link href="/contact" className="text-[#14B8A6] hover:underline font-semibold">
            Contact Engineering Support →
          </Link>
        </p>
      </div>
    </div>
  );
}
