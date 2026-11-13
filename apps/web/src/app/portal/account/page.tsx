'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save,
  ShieldCheck,
  Mail,
  Phone,
  User,
  MapPin,
  Globe2,
  FileBadge,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  ArrowUpRight,
} from 'lucide-react';
import {
  useClientProfile,
  useClientProjects,
  useUpdateClientProfile,
  useCancelSubscription,
} from '@/hooks/usePortalData';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, titleCase } from '@/lib/format';
import { pulse } from '@/components/pulse';

export default function PortalAccountPage() {
  const router = useRouter();
  const { data: client, isLoading, isError, isFetching, refetch } = useClientProfile();
  const { data: projects = [] } = useClientProjects();
  const updateProfile = useUpdateClientProfile();
  const cancelSubscription = useCancelSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('CUSTOMER_REQUESTED');
  const [cancelFeedback, setCancelFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const sessionUser = useAuthStore(s => s.user);
  const setSession = useAuthStore(s => s.setSession);
  const clearSession = useAuthStore(s => s.clearSession);

  // Organization form state
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [taxPin, setTaxPin] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null,
  );

  useEffect(() => {
    if (client && !loaded) {
      setBusinessName(client.businessName ?? '');
      setContactName(client.contactName ?? '');
      setPhone(client.phone ?? '');
      setAddress(client.address ?? '');
      setCountry(client.country ?? '');
      setTaxPin(client.taxPin ?? '');
      setLoaded(true);
    }
  }, [client, loaded]);

  const dirty =
    client != null &&
    (businessName !== (client.businessName ?? '') ||
      contactName !== (client.contactName ?? '') ||
      phone !== (client.phone ?? '') ||
      address !== (client.address ?? '') ||
      country !== (client.country ?? '') ||
      taxPin !== (client.taxPin ?? ''));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setFeedback(null);
    try {
      await pulse.track(
        () => updateProfile.mutateAsync({
          clientId: client.id,
          businessName: businessName.trim() || undefined,
          contactName: contactName.trim() || undefined,
          phone: phone.trim(),
          address: address.trim(),
          country: country.trim(),
          taxPin: taxPin.trim(),
        }),
        {
          pending: 'Updating organization & profile…',
          success: 'Profile details updated',
          scope: 'account',
        },
      );
      setFeedback({ type: 'success', msg: 'Organization & billing details updated.' });
      if (sessionUser && contactName.trim()) {
        const parts = contactName.trim().split(/\s+/);
        const state = useAuthStore.getState();
        if (state.accessToken && state.refreshToken) {
          setSession(
            {
              ...sessionUser,
              firstName: parts[0] || sessionUser.firstName,
              lastName: parts.slice(1).join(' ') || sessionUser.lastName,
            },
            state.accessToken,
            state.refreshToken,
            900,
          );
        }
      }
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setFeedback({
        type: 'error',
        msg: Array.isArray(serverMsg)
          ? serverMsg[0]
          : serverMsg || 'Could not save your changes. Try again shortly.',
      });
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdFeedback(null);
    if (newPassword.length < 8) {
      setPwdFeedback({ type: 'error', msg: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdFeedback({ type: 'error', msg: 'New password and confirmation do not match.' });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await pulse.track(
        () => authApi.changePassword({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
        {
          pending: 'Updating password securely…',
          success: 'Password updated successfully',
          scope: 'security',
        },
      );
      const tokens = res?.data ?? res;
      if (sessionUser && tokens?.accessToken && tokens?.refreshToken) {
        setSession(
          sessionUser,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresIn ?? 900,
        );
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdFeedback({
        type: 'success',
        msg: 'Password updated and all other active sessions have been signed out.',
      });
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setPwdFeedback({
        type: 'error',
        msg: Array.isArray(serverMsg)
          ? serverMsg[0]
          : serverMsg || 'Could not update password. Verify your current password.',
      });
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleSignOutEverywhere() {
    const confirmed = await pulse.confirm({
      title: 'Sign out of all sessions?',
      detail: 'This will revoke your active tokens and log you out across all devices and browser sessions.',
      confirmLabel: 'Sign out everywhere',
      danger: true,
    });
    if (!confirmed) return;
    await pulse.track(
      async () => {
        await authApi.logout().catch(() => undefined);
        await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
        await fetch('/api/auth/oidc/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
        clearSession();
        router.replace('/portal/login');
      },
      {
        pending: 'Signing out across all devices…',
        success: 'Signed out everywhere',
        scope: 'auth',
      },
    );
  }

  if (isError && !client) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-bold text-slate-700">Could not load your account</p>
        <p className="text-xs text-slate-400 max-w-sm">
          The service is temporarily unreachable. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
        >
          <Loader2 className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !client) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
        <span className="text-xs">Loading your account…</span>
      </div>
    );
  }

  const subscription = client.subscriptions?.[0];
  const hasProject = projects.length > 0;

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Account, Billing &amp; Security</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your organization details, tax invoice identity, and workspace security credentials.
        </p>
      </div>

      {/* Subscription standing */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
            Workspace &amp; Service Standing
          </h3>
          <Link
            href="/portal/packages?tab=care"
            className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
          >
            {subscription ? 'Manage / Upgrade Plan' : 'Add Managed Cloud Care'}{' '}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active Engagement
            </div>
            <div className="font-bold text-[#0F172A]">
              {subscription?.plan?.name ??
                (hasProject ? 'Custom Build Contract' : client.plan?.name ?? 'Workspace')}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Status
            </div>
            <div className="font-bold text-emerald-700">
              {titleCase(subscription?.status ?? client.status)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {subscription ? 'Next Care Renewal' : 'Client Since'}
            </div>
            <div className="font-bold text-[#0F172A]">
              {subscription?.renewalDate
                ? formatDate(subscription.renewalDate)
                : client.createdAt
                  ? formatDate(client.createdAt)
                  : '—'}
            </div>
          </div>
        </div>

        {cancelFeedback && (
          <div
            className={`mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
              cancelFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {cancelFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{cancelFeedback.msg}</span>
          </div>
        )}

        {subscription && subscription.status !== 'CANCELLED' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {!cancelOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Cancelling immediately notifies the provisioned commercial platform runtime to deprovision or suspend this entitlement.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCancelFeedback(null);
                    setCancelOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Cancel Subscription
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3">
                <div className="text-xs font-bold text-rose-900">
                  Confirm subscription cancellation
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Select a reason below and confirm to enqueue cancellation across billing and commercial platform provisioning.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Cancellation reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={cancelSubscription.isPending}
                    className="px-3 py-2 rounded-xl border border-rose-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="CUSTOMER_REQUESTED">Customer requested</option>
                    <option value="SWITCHING_PLAN">Switching plan</option>
                    <option value="COST_OPTIMIZATION">Cost optimization</option>
                    <option value="PROJECT_COMPLETED">Project completed</option>
                  </select>
                  <button
                    type="button"
                    disabled={cancelSubscription.isPending}
                    onClick={() => {
                      setCancelFeedback(null);
                      cancelSubscription.mutate(
                        {
                          subscriptionId: subscription.id,
                          reasonCode: cancelReason,
                        },
                        {
                          onSuccess: () => {
                            setCancelOpen(false);
                            setCancelFeedback({
                              type: 'success',
                              msg: 'Subscription cancellation recorded and queued for commercial platform lifecycle sync.',
                            });
                          },
                          onError: (err) => {
                            setCancelFeedback({
                              type: 'error',
                              msg:
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to cancel subscription. Please try again.',
                            });
                          },
                        },
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {cancelSubscription.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Confirm Cancellation
                  </button>
                  <button
                    type="button"
                    disabled={cancelSubscription.isPending}
                    onClick={() => setCancelOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Organization & Tax Profile form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5"
      >
        <div>
          <h3 className="font-bold text-[#0F172A] text-sm">Organization &amp; Invoice Details</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Appears on your commercial invoices and official payment receipts.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-100 text-red-600'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            {feedback.msg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="acc-business"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <Building2 className="w-3.5 h-3.5" /> Business Name
            </label>
            <input
              id="acc-business"
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Your company name"
            />
          </div>
          <div>
            <label
              htmlFor="acc-contact"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <User className="w-3.5 h-3.5" /> Primary Contact
            </label>
            <input
              id="acc-contact"
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Full name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="acc-email"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <Mail className="w-3.5 h-3.5" /> Billing Email
            </label>
            <input
              id="acc-email"
              type="email"
              value={client.email}
              disabled
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Open a support ticket to transfer billing ownership.
            </p>
          </div>
          <div>
            <label
              htmlFor="acc-phone"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <Phone className="w-3.5 h-3.5" /> Phone / M-Pesa Default
            </label>
            <input
              id="acc-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="+254 712 345 678"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="acc-address"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <MapPin className="w-3.5 h-3.5" /> Billing Address
            </label>
            <input
              id="acc-address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Westlands Commercial Center, Nairobi"
            />
          </div>
          <div>
            <label
              htmlFor="acc-country"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              <Globe2 className="w-3.5 h-3.5" /> Country
            </label>
            <input
              id="acc-country"
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Kenya"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="acc-taxpin"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
          >
            <FileBadge className="w-3.5 h-3.5" /> KRA PIN / Corporate Tax ID (optional)
          </label>
          <input
            id="acc-taxpin"
            type="text"
            value={taxPin}
            onChange={e => setTaxPin(e.target.value)}
            className="w-full sm:w-1/2 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="P051234567X"
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Workspace ID: <span className="font-mono">{client.id.slice(0, 8).toUpperCase()}</span>
          </span>
          <button
            type="submit"
            disabled={!dirty || updateProfile.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
          >
            {updateProfile.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </form>

      {/* Password & Session Security */}
      <form
        onSubmit={handlePasswordChange}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#2563EB]" />
              Password &amp; Session Security
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Rotate your portal password or revoke active login tokens across other browsers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOutEverywhere}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out All Devices
          </button>
        </div>

        {pwdFeedback && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
              pwdFeedback.type === 'error'
                ? 'bg-red-50 border-red-100 text-red-600'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}
          >
            {pwdFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            {pwdFeedback.msg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Min 8 characters"
                className="w-full border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              minLength={8}
              placeholder="Repeat new password"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pwdLoading || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
          >
            {pwdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}
