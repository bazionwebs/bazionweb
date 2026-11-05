'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Mail, ArrowLeft,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { resolveApiV1Base } from '@/lib/api-base';
import { useAuthStore } from '@/store/auth.store';

const API_BASE = resolveApiV1Base();

function ClaimContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlToken = searchParams.get('token') || '';
  const urlEmail = searchParams.get('email') || '';

  // Keep claimToken in state and sessionStorage so refreshing or remounting
  // never wipes out the active claim token.
  const [claimToken, setClaimToken] = useState(() => {
    if (urlToken) return urlToken;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bazionweb_active_claim_token') || '';
    }
    return '';
  });
  const [email, setEmail] = useState(() => {
    if (urlEmail) return urlEmail;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bazionweb_active_claim_email') || '';
    }
    return '';
  });
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
  const autoRequestedRef = useRef(false);
  const autostart = searchParams.get('autostart') === '1' || searchParams.get('claim') === '1';

  const storeHydrated = useAuthStore(s => s._hasHydrated);
  const sessionUser = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (urlToken) {
      setClaimToken(urlToken);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bazionweb_active_claim_token', urlToken);
        if (urlEmail) sessionStorage.setItem('bazionweb_active_claim_email', urlEmail);
      }
    }
  }, [urlToken, urlEmail]);

  useEffect(() => {
    if (urlEmail && !email) {
      setEmail(urlEmail);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bazionweb_active_claim_email', urlEmail);
      }
    }
  }, [urlEmail, email]);

  // If the user is already signed in with a valid session for this email and is not
  // consuming a new claim token, take them straight to their portal dashboard.
  useEffect(() => {
    if (!storeHydrated || urlToken || claimToken) return;
    if (isAuthenticated() && sessionUser) {
      const target = email.trim().toLowerCase();
      if (!target || sessionUser.email?.toLowerCase() === target) {
        router.replace('/portal');
      }
    }
  }, [storeHydrated, urlToken, claimToken, isAuthenticated, sessionUser, email, router]);

  const dispatchClaimLink = useCallback(async (targetEmail: string, autoOpenInDev = false) => {
    setError('');
    setDevPreviewUrl('');
    setDevNotice('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Enter the billing email you used during payment.');
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch('/api/auth/claim-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) setError('Too many attempts. Wait a minute and try again.');
        else setError(data.error || 'Could not send the claim link. Please try again shortly.');
        return;
      }

      if (typeof data.devPreviewUrl === 'string' && data.devPreviewUrl) {
        setDevPreviewUrl(data.devPreviewUrl);
        if (autoOpenInDev && typeof window !== 'undefined') {
          try {
            const parsed = new URL(data.devPreviewUrl, window.location.origin);
            const extractedToken = parsed.searchParams.get('token') || '';
            if (extractedToken.startsWith('claim_')) {
              setClaimToken(extractedToken);
              return;
            }
          } catch {
            // Fall through to showing the inbox/dev preview screen
          }
        }
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
  }, []);

  // Streamlined post-payment claim: auto-dispatch when arriving from /checkout/verify with ?email=...&autostart=1
  useEffect(() => {
    if (!claimToken && !urlToken && autostart && email && !autoRequestedRef.current) {
      autoRequestedRef.current = true;
      void dispatchClaimLink(email, true);
    }
  }, [claimToken, urlToken, autostart, email, dispatchClaimLink]);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    await dispatchClaimLink(email, false);
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
      const rawUser = payload?.user ?? body?.user;

      if (res.ok && payload?.accessToken) {
        try {
          useAuthStore.getState().setSession(
            {
              id: rawUser?.id || '',
              email: rawUser?.email || email.trim().toLowerCase(),
              firstName: rawUser?.firstName ?? firstName.trim(),
              lastName: rawUser?.lastName ?? lastName.trim(),
              roles:
                Array.isArray(rawUser?.roles) && rawUser.roles.length > 0
                  ? rawUser.roles
                  : ['CLIENT'],
              keycloakId: rawUser?.keycloakId || rawUser?.id || '',
              subscriptionStatus: rawUser?.subscriptionStatus || 'ACTIVE',
            },
            payload.accessToken,
            payload.refreshToken,
            Number(payload.expiresIn) || 900,
          );
        } catch {
          // Session storage failures shouldn't block the redirect.
        }
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('bazionweb_active_claim_token');
          sessionStorage.removeItem('bazionweb_active_claim_email');
          window.history.replaceState({}, '', window.location.pathname);
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
          {claimToken ? 'Set Your Account Password' : 'Claim Your Account'}
        </h1>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {claimToken
            ? 'Your account is active. Choose a secure password below to open your client portal workspace.'
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
                onClick={(e) => {
                  try {
                    const parsed = new URL(devPreviewUrl, window.location.origin);
                    const extractedToken = parsed.searchParams.get('token') || '';
                    if (extractedToken.startsWith('claim_')) {
                      e.preventDefault();
                      setClaimToken(extractedToken);
                    }
                  } catch {
                    // Allow normal link navigation
                  }
                }}
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
              disabled={requesting}
              onClick={() => void dispatchClaimLink(email, false)}
              className="btn-primary w-full py-3 justify-center text-xs font-bold disabled:opacity-60"
            >
              {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Another Link'}
            </button>
            <button
              type="button"
              onClick={() => { setRequestSent(false); setError(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Use a different email
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase">Billing Email</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Recipient
              </span>
            </div>
            <input
              type="email"
              value={email}
              readOnly={Boolean(urlEmail || (typeof window !== 'undefined' && sessionStorage.getItem('bazionweb_active_claim_email')))}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-medium focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Claim token is cryptographically bound to this address.
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
                {(error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('already been used')) && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => {
                        setClaimToken('');
                        setRequestSent(false);
                        setError('');
                        router.replace('/portal/claim');
                      }}
                      className="font-bold underline"
                    >
                      Request a new link
                    </button>
                  </>
                )}
                {(error.toLowerCase().includes('already has an account') || error.toLowerCase().includes('sign in instead')) && (
                  <>
                    {' '}
                    <Link href="/portal/login" className="font-bold underline">
                      Sign in here
                    </Link>
                  </>
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
            onClick={() => {
              setClaimToken('');
              setRequestSent(false);
              setError('');
              router.replace('/portal/claim');
            }}
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
