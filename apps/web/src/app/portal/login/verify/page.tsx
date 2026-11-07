'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser } from '@/store/auth.store';
import { resolveApiV1Base } from '@/lib/api-base';
import { sanitizeRedirectPath } from '@/lib/utils';

interface VerifyApiResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Deduplicate single-use token verification requests across React StrictMode
 * double-effects or Suspense boundary remounts so the single-use DB token is
 * only posted once and every active mount receives the same settled result.
 */
const inFlightTokenRequests = new Map<string, Promise<VerifyApiResult>>();

function verifyTokenOnce(apiBase: string, activeToken: string): Promise<VerifyApiResult> {
  const existing = inFlightTokenRequests.get(activeToken);
  if (existing) return existing;

  const reqPromise = (async (): Promise<VerifyApiResult> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${apiBase}/auth/magic-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, status: res.status, body };
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  inFlightTokenRequests.set(activeToken, reqPromise);
  return reqPromise;
}

/**
 * Magic-link verification — SERVER-VERIFIED.
 *
 * The emailed token is a single-use, DB-backed opaque string. It is sent to
 * the API (POST /auth/magic-link/verify), which checks its hash, expiry and
 * revocation before returning a real JWT session.
 */
function MagicVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture token & redirect once on initial mount so scrubbing the URL bar via
  // history.replaceState never mutates effect dependencies or cancels an in-flight verify call.
  const [initialToken] = useState(() => {
    const fromHook = searchParams.get('token');
    if (fromHook) return fromHook.trim();
    if (typeof window !== 'undefined') {
      return (new URLSearchParams(window.location.search).get('token') || '').trim();
    }
    return '';
  });

  const [redirectPath] = useState(() => {
    const fromHook = sanitizeRedirectPath(searchParams.get('redirect'));
    if (fromHook) return fromHook;
    if (typeof window !== 'undefined') {
      const rawRedirect = new URLSearchParams(window.location.search).get('redirect');
      return sanitizeRedirectPath(rawRedirect) || '/portal';
    }
    return '/portal';
  });

  const setSession = useAuthStore((s) => s.setSession);
  const unmountedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!initialToken) {
      setLoading(false);
      setError('No authentication token found in link. Please request a fresh sign-in link.');
      return;
    }

    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const apiBase = resolveApiV1Base();
        const { ok, body } = await verifyTokenOnce(apiBase, initialToken);

        // Scrub single-use token from address bar AFTER verification settles so Next.js's
        // patched history.replaceState never cancels our effect while fetch is in flight.
        if (typeof window !== 'undefined' && window.location.search.includes('token=')) {
          const cleanParams = new URLSearchParams(window.location.search);
          cleanParams.delete('token');
          const qs = cleanParams.toString();
          window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
        }

        const payload = ((body?.data as Record<string, unknown> | undefined) ?? body) || {};
        const rawUser =
          (payload?.user as Record<string, unknown> | undefined) ??
          (body?.user as Record<string, unknown> | undefined);
        const accessToken = typeof payload?.accessToken === 'string' ? payload.accessToken : '';
        const refreshToken = typeof payload?.refreshToken === 'string' ? payload.refreshToken : '';

        if (!ok || !accessToken) {
          const msg =
            (typeof payload?.message === 'string' && payload.message) ||
            (typeof body?.message === 'string' && body.message) ||
            'This sign-in link is invalid or has expired.';
          throw new Error(msg);
        }

        if (unmountedRef.current) return;

        const resolvedEmail = typeof rawUser?.email === 'string' ? rawUser.email : 'your account';
        setEmail(resolvedEmail);
        setSession(
          {
            id: typeof rawUser?.id === 'string' ? rawUser.id : '',
            email: typeof rawUser?.email === 'string' ? rawUser.email : '',
            firstName: typeof rawUser?.firstName === 'string' ? rawUser.firstName : '',
            lastName: typeof rawUser?.lastName === 'string' ? rawUser.lastName : '',
            roles:
              Array.isArray(rawUser?.roles) && rawUser.roles.length > 0
                ? (rawUser.roles as string[])
                : ['CLIENT'],
            keycloakId:
              typeof rawUser?.keycloakId === 'string'
                ? rawUser.keycloakId
                : typeof rawUser?.id === 'string'
                ? rawUser.id
                : '',
            subscriptionStatus: rawUser?.subscriptionStatus as AuthUser['subscriptionStatus'],
          } as AuthUser,
          accessToken,
          refreshToken,
          Number(payload?.expiresIn) || 900,
        );
        setSuccess(true);
        setLoading(false);

        redirectTimer = setTimeout(() => {
          router.replace(redirectPath);
        }, 900);
      } catch (err: unknown) {
        if (unmountedRef.current) return;
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        setError(
          isTimeout
            ? 'Verification timed out while contacting the server. Please request a fresh sign-in link and try again.'
            : err instanceof Error
            ? err.message
            : 'Authentication link is invalid or has expired.',
        );
        setLoading(false);
      }
    })();

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [initialToken, redirectPath, setSession, router]);

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
            {redirectPath.startsWith('/checkout')
              ? 'Returning you to your checkout…'
              : 'Opening your Client Operating Hub…'}
          </p>
          <div className="pt-2">
            <Link
              href={redirectPath}
              className="btn-primary w-full py-3 justify-center text-xs font-bold shadow-lg"
            >
              {redirectPath.startsWith('/checkout') ? 'Return to Checkout' : 'Enter Workspace Now'}
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
              href={
                redirectPath && redirectPath !== '/portal'
                  ? `/portal/login?redirect=${encodeURIComponent(redirectPath)}`
                  : '/portal/login'
              }
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
      <Suspense
        fallback={
          <div className="text-center text-white p-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          </div>
        }
      >
        <MagicVerifyContent />
      </Suspense>
    </div>
  );
}
