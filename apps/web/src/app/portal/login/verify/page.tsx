'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser } from '@/store/auth.store';
import { resolveApiV1Base } from '@/lib/api-base';

const API_BASE = resolveApiV1Base();

/**
 * Magic-link verification — SERVER-VERIFIED.
 *
 * The emailed token is a single-use, DB-backed opaque string. It is sent to
 * the API (POST /auth/magic-link/verify), which checks its hash, expiry and
 * revocation before returning a real JWT session. The browser never decodes
 * or trusts token contents — the previous client-side base64 "auth" that
 * minted fake sessions is gone.
 */
function MagicVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const setSession = useAuthStore(s => s.setSession);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('No authentication token found in link.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/magic-link/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.data?.accessToken) {
          throw new Error(data.message || 'This sign-in link is invalid or has expired.');
        }

        if (cancelled) return;

        setEmail(data.user?.email || 'your account');
        setSession(
          {
            id: data.user?.id,
            email: data.user?.email || '',
            firstName: data.user?.firstName || '',
            lastName: data.user?.lastName || '',
            roles: data.user?.roles || ['CLIENT'],
            keycloakId: data.user?.keycloakId || '',
            subscriptionStatus: data.user?.subscriptionStatus,
          } as AuthUser,
          data.data.accessToken,
          data.data.refreshToken,
          data.data.expiresIn,
        );
        setSuccess(true);

        const timer = setTimeout(() => {
          router.push('/portal');
        }, 1200);
        return () => { cancelled = true; clearTimeout(timer); };
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Authentication link is invalid or has expired.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, setSession, router]);

  return (
    <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-slate-900 text-center">
      <div className="flex justify-center mb-6">
        <Logo variant="light" markClassName="h-12 w-auto" />
      </div>

      {loading && (
        <div className="py-8 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#2563EB] mx-auto" />
          <h2 className="text-xl font-bold text-[#0F172A]">Verifying Secure Link…</h2>
          <p className="text-xs text-slate-500">
            Confirming your one-time sign-in token with the server.
          </p>
        </div>
      )}

      {!loading && success && (
        <div className="py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A]">Welcome Back!</h2>
          <p className="text-xs text-slate-500">
            Signed in as <strong className="text-slate-800">{email}</strong>.
          </p>
          <p className="text-xs text-slate-400">
            Opening your Client Operating Hub…
          </p>
          <div className="pt-2">
            <Link
              href="/portal"
              className="btn-primary w-full py-3 justify-center text-xs font-bold shadow-lg"
            >
              Enter Workspace Now
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Sign-In Link Expired</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error}
          </p>
          <div className="pt-4">
            <Link
              href="/portal/login"
              className="btn-primary w-full py-3 justify-center text-xs font-bold"
            >
              Request a New Sign-In Link
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MagicVerifyPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="text-center text-white p-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        </div>
      }>
        <MagicVerifyContent />
      </Suspense>
    </div>
  );
}
