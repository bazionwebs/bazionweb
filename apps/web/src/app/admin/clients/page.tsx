'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  ExternalLink,
  X,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  CreditCard,
  Server,
  Code2,
  Database,
  AlertCircle,
  Loader2,
  UserCheck,
  Pencil,
  RefreshCw,
  Mail,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  useAdminClients,
  useAdminHosting,
  useClientVault,
  useRevealClientVaultSecret,
  useUpdateClient,
  useResendClientInvite,
  useSyncClientOnboarding,
} from '@/hooks/useAdminData';
import { adminApi } from '@/lib/api';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { ManualClientCreateModal } from '@/components/admin/ManualClientCreateModal';

interface ClientRow {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  taxPin: string;
  domain: string;
  plan: string;
  tier: string;
  status: string;
  tickets: number;
  mrr: number;
  renewal: string;
}

function getCategoryMeta(cat: string) {
  switch (cat) {
    case 'DOMAIN_REGISTRAR':
      return { label: 'Domain Registrar', icon: Globe, badge: 'bg-teal-50 text-teal-800 border-teal-200' };
    case 'PAYMENT_GATEWAY':
      return { label: 'Payment Gateway (M-Pesa / Card)', icon: CreditCard, badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'API_KEY':
      return { label: 'Third-Party API Key', icon: Code2, badge: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'HOSTING_SSH':
      return { label: 'Server / SSH / Hosting', icon: Server, badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    case 'DATABASE':
      return { label: 'Database URI / Secret', icon: Database, badge: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'CMS_ADMIN':
      return { label: 'CMS / Workspace Admin', icon: KeyRound, badge: 'bg-amber-50 text-amber-800 border-amber-200' };
    default:
      return { label: 'Encrypted Credential', icon: Lock, badge: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
}

function ClientDetailModal({
  client,
  initialTab = 'overview',
  onClose,
  onUpdated,
}: {
  client: ClientRow;
  initialTab?: 'overview' | 'edit' | 'vault';
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'vault'>(initialTab);

  // Edit form state
  const [businessName, setBusinessName] = useState(client.name);
  const [contactName, setContactName] = useState(client.contact);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone);
  const [address, setAddress] = useState(client.address);
  const [country, setCountry] = useState(client.country || 'KE');
  const [taxPin, setTaxPin] = useState(client.taxPin);
  const [planTier, setPlanTier] = useState<string>(client.tier);
  const [status, setStatus] = useState<string>(client.status);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Quick Action in-flight states
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  // Vault state
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const updateClientMutation = useUpdateClient();
  const resendInviteMutation = useResendClientInvite();
  const syncOnboardingMutation = useSyncClientOnboarding();
  const vaultQuery = useClientVault(client.id);
  const revealMutation = useRevealClientVaultSecret();

  const secrets = vaultQuery.data ?? [];

  // Synchronize internal form state when client prop updates
  useEffect(() => {
    setBusinessName(client.name);
    setContactName(client.contact);
    setEmail(client.email);
    setPhone(client.phone);
    setAddress(client.address);
    setCountry(client.country || 'KE');
    setTaxPin(client.taxPin);
    setPlanTier(client.tier);
    setStatus(client.status);
  }, [client]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEditError(null);
    setEditSuccess(null);

    if (!businessName.trim()) {
      setEditError('Business organization name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!contactName.trim()) {
      setEditError('Primary contact name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEditError('A valid account email address is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      await updateClientMutation.mutateAsync({
        id: client.id,
        data: {
          businessName: businessName.trim(),
          contactName: contactName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          country: country.trim() || null,
          taxPin: taxPin.trim() || null,
          planTier: planTier as any,
          status: status as any,
        },
      });

      setEditSuccess('Client information, plan alignment, and user identity updated successfully.');
      onUpdated();
      setTimeout(() => setEditSuccess(null), 3500);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async () => {
    setIsActionRunning(true);
    setActionNotice(null);
    setActionError(null);
    try {
      const res = await resendInviteMutation.mutateAsync(client.id);
      if (res?.claimUrl) {
        await adminApi
          .dispatchAdminLinkEmail({
            to: client.email,
            url: res.claimUrl,
            clientName: client.name,
            type: 'claim',
          })
          .catch(() => undefined);
      }
      setActionNotice(`Fresh 72-hour claim link minted and emailed to ${client.email}!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not reissue claim link.');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleSyncOnboarding = async () => {
    setIsActionRunning(true);
    setActionNotice(null);
    setActionError(null);
    try {
      await syncOnboardingMutation.mutateAsync(client.id);
      setActionNotice(`Onboarding workspace synchronized and verified for ${client.name}.`);
      onUpdated();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to sync onboarding state.');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setIsActionRunning(true);
    setActionNotice(null);
    setActionError(null);
    try {
      await updateClientMutation.mutateAsync({
        id: client.id,
        data: { status: nextStatus as any },
      });
      setStatus(nextStatus);
      setActionNotice(`Account standing switched to ${nextStatus}.`);
      onUpdated();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || `Failed to switch status to ${nextStatus}.`);
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleReveal = async (secretId: string) => {
    if (revealedSecrets[secretId]) {
      setRevealedSecrets(prev => {
        const next = { ...prev };
        delete next[secretId];
        return next;
      });
      return;
    }
    setRevealingId(secretId);
    setRevealError(null);
    try {
      const res = await revealMutation.mutateAsync(secretId);
      const plaintext = (res as any)?.value || (res as any)?.data?.value || '';
      setRevealedSecrets(prev => ({ ...prev, [secretId]: plaintext }));

      setTimeout(() => {
        setRevealedSecrets(prev => {
          const next = { ...prev };
          delete next[secretId];
          return next;
        });
      }, 45000);
    } catch (err: any) {
      setRevealError(err?.response?.data?.message || err?.message || 'Failed to decrypt credential.');
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = (idKey: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-lg">{businessName || client.name}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'SUSPENDED'
                    ? 'bg-rose-100 text-rose-800'
                    : status === 'TRIAL'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">Client ID: {client.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Account Overview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Information &amp; Plan</span>
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Encrypted Vault</span>
            {secrets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                {secrets.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Global Action Alerts */}
          {actionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Domain</div>
                  <div className="text-slate-900 font-mono font-bold mt-1 text-sm truncate">{client.domain}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Plan Tier</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">{planTier}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Lifecycle Status</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">{status}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Monthly MRR</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">${client.mrr}</div>
                </div>
              </div>

              {/* Identity & Legal Details */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    Contact &amp; Tax Profile
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Profile</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400">Primary Contact:</span>
                    <div className="text-slate-900 font-bold text-sm mt-0.5">{contactName}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Account Email:</span>
                    <div className="text-slate-900 font-mono font-medium text-xs mt-0.5">{email}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <div className="text-slate-800 font-mono text-xs mt-0.5">{phone || '—'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Country / Market:</span>
                    <div className="text-slate-800 font-semibold text-xs mt-0.5">{country || 'KE'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Tax PIN / VAT:</span>
                    <div className="text-slate-800 font-mono text-xs mt-0.5">{taxPin || '—'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Next Billing Renewal:</span>
                    <div className="text-slate-800 font-semibold text-xs mt-0.5">{client.renewal}</div>
                  </div>
                </div>
                {address && (
                  <div className="pt-1 text-[11px] text-slate-500">
                    <span className="text-slate-400">Billing Address: </span>
                    {address}
                  </div>
                )}
              </div>

              {/* Superadmin Quick Action Suite */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">
                    Superadmin Actions Deck
                  </span>
                  <span className="text-[10px] text-slate-400">Append-Only Audit Log Enforced</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isActionRunning}
                    onClick={handleResendInvite}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>Resend Claim Link</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionRunning}
                    onClick={handleSyncOnboarding}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                    <span>Sync &amp; Repair Workspace</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionRunning}
                    onClick={handleToggleStatus}
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                      status === 'ACTIVE'
                        ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60'
                        : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{status === 'ACTIVE' ? 'Suspend Account' : 'Restore to Active'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT CLIENT & PLAN */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Company / Organization *</label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Primary Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">Account &amp; Login Email *</label>
                    <span className="text-[10px] text-blue-600 font-medium">SSOT Auth Synced</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Changing this updates both the Client profile and User credentials atomically.
                  </p>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 700 000 000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Country Market</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    <option value="KE">Kenya (KE - KES)</option>
                    <option value="US">United States (US - USD)</option>
                    <option value="GB">United Kingdom (GB - GBP)</option>
                    <option value="AE">United Arab Emirates (AE - AED)</option>
                    <option value="TZ">Tanzania (TZ - TZS)</option>
                    <option value="UG">Uganda (UG - UGX)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tax PIN / VAT</label>
                  <input
                    type="text"
                    value={taxPin}
                    onChange={(e) => setTaxPin(e.target.value)}
                    placeholder="P051234567Z"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Plan Tier</label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    <option value="STARTER">Starter Tier</option>
                    <option value="GROWTH">Growth Tier</option>
                    <option value="BUSINESS">Business Tier</option>
                    <option value="ENTERPRISE">Enterprise Tier</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Physical / Billing Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Westlands, Nairobi, Kenya"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lifecycle Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="SUSPENDED">SUSPENDED (Locked Out)</option>
                    <option value="TRIAL">TRIAL (Unclaimed)</option>
                    <option value="CANCELLED">CANCELLED (Terminated)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Client Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ENCRYPTED CREDENTIAL VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-purple-50/80 border border-purple-200/80 rounded-2xl text-purple-950 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Zero-Knowledge Encrypted Vault:</span>
                  <p className="mt-0.5 text-purple-800 text-[11px] leading-relaxed">
                    Credentials deposited by this client (domain registrar logins, Cloudflare DNS tokens, M-Pesa Daraja keys) are encrypted at rest with AES-256-GCM. Revealing any credential is authenticated and permanently recorded to the staff AuditLog.
                  </p>
                </div>
              </div>

              {revealError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{revealError}</span>
                </div>
              )}

              {vaultQuery.isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs">Loading encrypted vault items…</span>
                </div>
              ) : secrets.length === 0 ? (
                <div className="py-10 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2.5">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800">No Credentials in Vault Yet</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    When {client.name} deposits registrar logins, Cloudflare tokens, or API credentials in their client portal (/portal/vault), they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {secrets.map((secret) => {
                    const cat = getCategoryMeta(secret.category);
                    const Icon = cat.icon;
                    const isRevealed = Boolean(revealedSecrets[secret.id]);
                    const plaintext = revealedSecrets[secret.id] || '';
                    const isRevealing = revealingId === secret.id;

                    return (
                      <div
                        key={secret.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cat.badge}`}
                              >
                                <Icon className="w-3 h-3" />
                                <span>{cat.label}</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Added {formatDate(secret.createdAt)}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900">{secret.label}</h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReveal(secret.id)}
                            disabled={isRevealing}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs shrink-0 ${
                              isRevealed
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                          >
                            {isRevealing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Decrypting…</span>
                              </>
                            ) : isRevealed ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hide Secret</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Reveal (AES-256)</span>
                              </>
                            )}
                          </button>
                        </div>

                        {(secret.username || secret.serviceUrl) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                            {secret.username && (
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-400">Username / Email:</span>
                                <div className="flex items-center gap-1.5 font-mono font-medium text-slate-800">
                                  <span>{secret.username}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(`user-${secret.id}`, secret.username!)}
                                    className="text-slate-400 hover:text-slate-700"
                                    title="Copy username"
                                  >
                                    {copiedId === `user-${secret.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            {secret.serviceUrl && (
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-400">Portal / Host:</span>
                                <a
                                  href={secret.serviceUrl.startsWith('http') ? secret.serviceUrl : `https://${secret.serviceUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center gap-1 font-medium truncate max-w-[160px]"
                                >
                                  <span className="truncate">{secret.serviceUrl.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between font-mono text-xs">
                          <div className="truncate mr-2">
                            {isRevealed ? (
                              <span className="text-emerald-400 select-all font-semibold">{plaintext}</span>
                            ) : (
                              <span className="text-slate-500 tracking-widest">{secret.maskedHint || '••••••••••••••••'}</span>
                            )}
                          </div>
                          {isRevealed && (
                            <button
                              type="button"
                              onClick={() => handleCopy(secret.id, plaintext)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 shrink-0 transition-colors"
                            >
                              {copiedId === secret.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {secret.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                            &quot;{secret.notes}&quot;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Close
          </button>
          <Link
            href={`/admin/troubleshooting?impersonate=${client.id}`}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Launch Client Sandbox →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminClientsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'edit' | 'vault'>('overview');
  const [showAddModal, setShowAddModal] = useState(false);

  const clientsQuery = useAdminClients();
  const hostingQuery = useAdminHosting();

  const domainByClient: Record<string, string> = {};
  (hostingQuery.data?.items ?? []).forEach(h => {
    if (h.clientId && !domainByClient[h.clientId]) domainByClient[h.clientId] = h.domain;
  });

  const rawClients = clientsQuery.data?.items ?? [];

  const clients = rawClients.map(c => {
    const hasActiveSub = (c.subscriptions?.length ?? 0) > 0;
    const price = Number(c.plan?.priceMonthly ?? 0);
    return {
      id: c.id,
      name: c.businessName,
      contact: c.contactName || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      country: c.country || 'KE',
      taxPin: c.taxPin || '',
      domain: domainByClient[c.id] ?? '—',
      plan: c.plan?.name ?? 'Standard',
      tier: c.plan?.tier ?? 'GROWTH',
      status: c.status,
      tickets: c._count?.tickets ?? 0,
      mrr: hasActiveSub ? price : 0,
      renewal: c.subscriptions?.[0]?.renewalDate ? formatDate(c.subscriptions[0].renewalDate) : '—',
    };
  });

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* ── Header Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients &amp; Organizations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client identity, tax profiles, plan tiers, and encrypted credentials
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-1.5 text-xs font-bold self-start sm:self-auto px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Client</span>
        </button>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations, domains, or billing emails…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Client Roster Table ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {clientsQuery.isLoading ? (
          <SectionLoading label="Loading client roster…" />
        ) : clientsQuery.isError ? (
          <QueryError message={clientsQuery.error?.message} onRetry={() => clientsQuery.refetch()} />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title="No matching clients found"
            hint="Try adjusting your search terms or status filters above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Organization / Contact</th>
                  <th className="py-3 px-4">Primary Domain</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Tickets</th>
                  <th className="py-3 px-4">MRR</th>
                  <th className="py-3 px-4">Renewal</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.contact} · {c.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {c.domain}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                        {c.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'TRIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.tickets > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {c.tickets}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.mrr > 0 ? `$${c.mrr}` : <span className="text-slate-300 font-normal">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.renewal}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(c);
                            setModalTab('edit');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Pencil className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(c);
                            setModalTab('overview');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Client Detail Modal (Overview, Edit Form & Encrypted Credential Vault) ─── */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          initialTab={modalTab}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => {
            clientsQuery.refetch();
          }}
        />
      )}

      {/* ── Synced Manual Client Account Provisioning Modal ─────────────────── */}
      <ManualClientCreateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          clientsQuery.refetch();
        }}
      />
    </div>
  );
}
