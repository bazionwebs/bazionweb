'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/ui/Logo';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, hasRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated with admin role, jump straight to operations dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      const isStaff = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].some(r => hasRole(r));
      if (isStaff) {
        router.replace('/admin');
      }
    }
  }, [isAuthenticated, hasRole, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // login() routes staff to /admin and clients to /portal automatically
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Invalid administrator credentials. Access attempts are monitored and recorded.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo variant="dark" markClassName="h-16 w-auto" href={null} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold uppercase tracking-wider mb-2.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Operations Center Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Staff &amp; Admin Sign In
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Restricted access for BazionWeb engineering &amp; infrastructure staff
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0F172A] rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Staff Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="staff@bazionweb.com"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Master Security Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all font-mono"
                  placeholder="••••••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying Clearance…
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Authenticate &amp; Launch Console
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center space-y-2">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Protected by hardware-level rate limiting, zero trust policies &amp; audit logging.
            </p>
            <Link
              href="/portal/reset-password"
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              Forgot your password? Reset it with the email link
            </Link>
          </div>
        </div>

        {/* Portal redirect option */}
        <div className="text-center mt-6">
          <Link
            href="/portal/login"
            className="text-xs text-slate-400 hover:text-slate-300 inline-flex items-center gap-1.5 transition-colors"
          >
            Are you a client? Sign in to Client Hub <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

