'use client';

import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2, AlertCircle, Save, ShieldCheck, Mail, Phone, User } from 'lucide-react';
import {
  useClientProfile,
  useUpdateClientProfile,
} from '@/hooks/usePortalData';
import { formatDate } from '@/lib/format';

export default function PortalAccountPage() {
  const { data: client, isLoading, isError, refetch } = useClientProfile();
  const updateProfile = useUpdateClientProfile();

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (client && !loaded) {
      setBusinessName(client.businessName ?? '');
      setContactName(client.contactName ?? '');
      setPhone(client.phone ?? '');
      setLoaded(true);
    }
  }, [client, loaded]);

  const dirty =
    client != null &&
    (businessName !== (client.businessName ?? '') ||
      contactName !== (client.contactName ?? '') ||
      phone !== (client.phone ?? ''));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setFeedback(null);
    updateProfile.mutate(
      {
        clientId: client.id,
        businessName: businessName.trim() || undefined,
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: () => setFeedback({ type: 'success', msg: 'Profile updated successfully.' }),
        onError: (err: Error) =>
          setFeedback({ type: 'error', msg: err.message || 'Could not save your changes. Try again shortly.' }),
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
          <Loader2 className={`w-3.5 h-3.5 ${refetch.isPending ? 'animate-spin' : ''}`} />
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

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Account &amp; Profile</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your organization details and review your subscription standing.
        </p>
      </div>

      {/* Subscription standing */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="font-bold text-[#0F172A] text-sm mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
          Subscription Standing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plan</div>
            <div className="font-bold text-[#0F172A]">
              {subscription?.plan?.name ?? client.plan?.name ?? 'Not linked'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</div>
            <div className="font-bold text-emerald-700">{subscription?.status ?? client.status}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Renewal</div>
            <div className="font-bold text-[#0F172A]">
              {subscription?.renewalDate ? formatDate(subscription.renewalDate) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <h3 className="font-bold text-[#0F172A] text-sm">Organization Details</h3>

        {feedback && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-100 text-red-600'
              : 'bg-emerald-50 border-emerald-100 text-emerald-700'
          }`}>
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {feedback.msg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-business" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
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
            <label htmlFor="acc-contact" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
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
            <label htmlFor="acc-email" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Billing Email
            </label>
            <input
              id="acc-email"
              type="email"
              value={client.email}
              disabled
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">Contact support to change your billing email.</p>
          </div>
          <div>
            <label htmlFor="acc-phone" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone
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

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Client since {client.createdAt ? formatDate(client.createdAt) : '—'}
          </span>
          <button
            type="submit"
            disabled={!dirty || updateProfile.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
          >
            {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
