'use client';

import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Copy,
  Check,
  Building,
  User,
  Mail,
  Phone,
  Layers,
  Globe,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useManualProvisionClient } from '@/hooks/useAdminData';
import { adminApi } from '@/lib/api';
import { pulse } from '@/components/pulse';

interface ManualClientCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManualClientCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualClientCreateModalProps) {
  const provisionMutation = useManualProvisionClient();

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [planTier, setPlanTier] = useState('GROWTH');
  const [marketCode, setMarketCode] = useState('KE');
  const [currency, setCurrency] = useState('USD');
  const [projectTitle, setProjectTitle] = useState('');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<{
    claimUrl: string;
    invitationToken: string;
    client: any;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!businessName.trim() || !contactName.trim() || !email.trim()) {
      setErrorMsg('Business name, contact name, and billing email are required.');
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await pulse.track(
        () => provisionMutation.mutateAsync({
          businessName: businessName.trim(),
          contactName: contactName.trim(),
          email: cleanEmail,
          phone: phone.trim() || undefined,
          planTier,
          marketCode,
          currency,
          projectTitle: projectTitle.trim() || undefined,
        }),
        {
          pending: `Provisioning client ${businessName.trim()}…`,
          success: `Client ${businessName.trim()} provisioned successfully`,
          scope: 'clients',
        },
      );

      let effectiveClaimUrl = res?.claimUrl;
      if (effectiveClaimUrl && typeof window !== 'undefined') {
        try {
          const parsed = new URL(effectiveClaimUrl);
          effectiveClaimUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
        } catch {
          // Keep original
        }
      }

      if (effectiveClaimUrl) {
        adminApi
          .dispatchAdminLinkEmail({
            to: cleanEmail,
            url: effectiveClaimUrl,
            clientName: businessName.trim(),
            type: 'claim',
          })
          .catch(err => console.warn('[ManualProvision] Auto-email dispatch warning:', err));
      }

      setProvisionResult(res ? { ...res, claimUrl: effectiveClaimUrl } : res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Failed to provision client account.',
      );
    }
  };

  const handleCopyLink = () => {
    if (!provisionResult?.claimUrl) return;
    navigator.clipboard.writeText(provisionResult.claimUrl);
    pulse.success('Claim link copied to clipboard');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetForm = () => {
    setBusinessName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setPlanTier('GROWTH');
    setMarketCode('KE');
    setCurrency('USD');
    setProjectTitle('');
    setErrorMsg(null);
    setProvisionResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Manual Client Account Provisioning</h3>
              <p className="text-[11px] text-slate-300">
                Atomically provision client entity, user account, initial project &amp; claim token
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {provisionResult ? (
            /* Success State with Claim Link */
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-emerald-500 rounded-xl text-white shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Client Organization &amp; Account Successfully Provisioned!
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Workspace synchronized for{' '}
                    <strong>{provisionResult.client?.businessName || businessName}</strong>. An activation claim email has been automatically sent to <strong>{email}</strong>.
                  </p>
                </div>
              </div>

              {/* Claim Link Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    One-Time Account Activation Link (72-Hour Claim Token)
                  </label>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Expires in 72 hours
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={provisionResult.claimUrl}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 select-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Claim Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Provide this secure link to the client contact so they can set their permanent
                  password and access the customer portal.
                </p>
              </div>

              {/* Summary metadata */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400">Target Email:</span>{' '}
                  <span className="font-semibold text-slate-800">{email}</span>
                </div>
                <div>
                  <span className="text-slate-400">Plan Assigned:</span>{' '}
                  <span className="font-semibold text-slate-800">{planTier}</span>
                </div>
                <div>
                  <span className="text-slate-400">Market / Currency:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {marketCode} ({currency})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Workspace Status:</span>{' '}
                  <span className="font-bold text-emerald-600">ACTIVE</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center justify-center"
                >
                  Add Another Client
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm inline-flex items-center justify-center"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Entry Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Business Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Business / Organization Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acacia Healthcare Ltd"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>

                {/* Contact Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Primary Contact Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Jane Mwangi"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contact / Billing Email *</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane@acaciahealthcare.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number (Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +254 712 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>

                {/* Plan Tier */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Service Plan Tier</span>
                  </label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    <option value="STARTER">Starter Tier</option>
                    <option value="GROWTH">Growth Tier (Recommended)</option>
                    <option value="BUSINESS">Business Tier</option>
                    <option value="ENTERPRISE">Enterprise Tier</option>
                  </select>
                </div>

                {/* Market & Currency */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Market &amp; Currency</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={marketCode}
                      onChange={(e) => setMarketCode(e.target.value)}
                      className="px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                    >
                      <option value="KE">Kenya (KE)</option>
                      <option value="UG">Uganda (UG)</option>
                      <option value="TZ">Tanzania (TZ)</option>
                      <option value="RW">Rwanda (RW)</option>
                      <option value="US">United States (US)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="ZA">South Africa (ZA)</option>
                    </select>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Initial Project Workspace Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Initial Project Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Defaults to '[Business Name] Launch Project'"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionMutation.isPending}
                  className="min-h-[44px] px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
                >
                  {provisionMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Provisioning Workspace…</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create &amp; Generate Claim Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
