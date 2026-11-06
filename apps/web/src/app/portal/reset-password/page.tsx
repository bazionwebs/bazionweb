'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import { toCleanUrl } from '@/lib/api-base';

/**
 * Self-service password recovery.
 *
 * Step 1 (no token): request a single-use reset link via the BFF route
 * POST /api/auth/forgot-password — the response is generic, so it never
 * reveals whether the email has an account.
 *
 * Step 2 (?token=…): consume the emailed token through the public API
 * POST /auth/reset-password. The token is stripped from the URL immediately
 * (Referer / shoulder-surfing hygiene) and every prior session is revoked
 * server-side once the new password is set.
 */

const GENERIC_REQUEST_MESSAGE =
  'If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return 'Use a mix of letters and numbers.';
  return null;
}

function ResetPasswordContent() {
  const clearSession = useAuthStore(s => s.clearSession);

  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [error, setError] = useState('');

  // Capture the token from the URL and scrub it from the address bar so it
  // does not leak via Referer headers or browser history beyond this visit.
  useEffect(() => {
    clearSession();
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || '';
    if (urlToken) {
      setToken(urlToken);
      params.delete('token');
      if (typeof window !== 'undefined') {
        const remaining = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (remaining ? `?${remaining}` : ''));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
      setError('Please enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(toCleanUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error(data.error || 'Too many requests. Try again shortly.');
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch reset link.');
      setRequestSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send the reset email. Please check your network.');
    } finally {
      setSending(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pwError = validatePassword(newPassword);
    if (pwError) { setError(pwError); return; }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(toCleanUrl('/api/v1/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: token, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      const payload = body?.data ?? body;
      if (!res.ok) throw new Error(payload?.message || payload?.error || 'This reset link is invalid or has expired.');
      setNewPassword('');
      setConfirmPassword('');
      setResetSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset the password. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  const resetLinkRequestMode = !token && !resetSuccess;
  const resetFormMode = !!token && !resetSuccess;

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo variant="dark" markClassName="h-16 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure Password Recovery
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {resetSuccess ? 'Password updated' : resetLinkRequestMode ? 'Forgot your password?' : 'Choose a new password'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {resetLinkRequestMode
              ? 'Enter your account email and we will send a secure, single-use reset link.'
              : resetFormMode
                ? 'Set a new password for your account.'
                : 'Use your new password to sign in.'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
          {/* Step 2 success */}
          {resetSuccess && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-[#0F172A]">Your password has been changed</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every previous session was signed out for security. Sign in with your new password now.
              </p>
              <Link href="/portal/login" className="btn-primary w-full py-3 text-xs font-bold inline-block">
                <KeyRound className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" /> Sign in
              </Link>
            </div>
          )}

          {/* Step 1: request reset link */}
          {!resetFormMode && !resetSuccess && (
            requestSent ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Check your inbox</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{GENERIC_REQUEST_MESSAGE}</p>
                </div>
                <div className="pt-2 space-y-2">
                  <Link
                    href="/portal/login"
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors block mx-auto"
                  >
                    &larr; Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestLink} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="label text-xs">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input text-xs"
                    placeholder="you@yourcompany.com"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    The link expires in 15 minutes and can only be used once.
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
                  disabled={sending || !email}
                  className="btn-primary w-full py-3 text-xs font-bold disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link…
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <Link
                  href="/portal/login"
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors block text-center"
                >
                  &larr; Back to sign in
                </Link>
              </form>
            )
          )}

          {/* Step 2: set new password from emailed token */}
          {resetFormMode && (
            <form onSubmit={handlePasswordReset} className="space-y-4" noValidate>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#2563EB] text-[10px] font-bold uppercase tracking-wider">
                  <KeyRound className="w-3 h-3" /> Emailed reset link verified
                </span>
              </div>

              <div>
                <label htmlFor="new-password" className="label text-xs">New Password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
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
                <p className="text-[11px] text-slate-400 mt-1">At least 8 characters, mixing letters and numbers.</p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="label text-xs">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input text-xs"
                  placeholder="••••••••••••"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={resetting || !newPassword || !confirmPassword}
                className="btn-primary w-full py-3 text-xs font-bold disabled:opacity-50"
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating Password…
                  </>
                ) : (
                  'Update Password'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setToken(''); setError(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors block text-center"
              >
                Link not working? Request a new one &larr;
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Trouble accessing your account?{' '}
          <Link href="/contact" className="text-[#14B8A6] hover:underline font-semibold">
            Contact Support →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
