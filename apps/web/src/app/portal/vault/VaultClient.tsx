'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Lock,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  Globe,
  Server,
  CreditCard,
  Database,
  Code2,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  useVaultSecrets,
  useCreateVaultSecret,
  useRevealVaultSecret,
  useDeleteVaultSecret,
  ApiVaultSecret,
} from '@/hooks/usePortalData';
import { EmptyState, QueryError, SectionLoading } from '@/components/ui/QueryState';
import { formatDate, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'DOMAIN_REGISTRAR', label: 'Domain / DNS Registrar', icon: Globe, badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'PAYMENT_GATEWAY', label: 'Payment Gateway (M-Pesa / Card)', icon: CreditCard, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'API_KEY', label: 'Third-Party API Key', icon: Code2, badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'HOSTING_SSH', label: 'Server / SSH / Hosting', icon: Server, badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'DATABASE', label: 'Database URI / Secret', icon: Database, badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'CMS_ADMIN', label: 'CMS / Workspace Admin', icon: KeyRound, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'OTHER', label: 'Other Secret', icon: Lock, badge: 'bg-slate-100 text-slate-700 border-slate-200' },
] as const;

function categoryMeta(category: string) {
  return CATEGORIES.find(c => c.id === category) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function VaultClient() {
  const { data: secrets = [], isLoading, isError, error, refetch } = useVaultSecrets();
  const createSecret = useCreateVaultSecret();
  const revealSecret = useRevealVaultSecret();
  const deleteSecret = useDeleteVaultSecret();

  const [filterCat, setFilterCat] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<string>('DOMAIN_REGISTRAR');
  const [username, setUsername] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [showInputSecret, setShowInputSecret] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Revealed secrets cache (auto-cleared after 30s)
  const [revealedMap, setRevealedMap] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Clear any revealed secrets on unmount
  useEffect(() => {
    return () => setRevealedMap({});
  }, []);

  const filteredSecrets = useMemo(() => {
    if (filterCat === 'ALL') return secrets;
    return secrets.filter(s => s.category === filterCat);
  }, [secrets, filterCat]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !secretValue.trim() || createSecret.isPending) return;
    setFormError(null);
    try {
      await createSecret.mutateAsync({
        label: label.trim(),
        category,
        username: username.trim() || undefined,
        serviceUrl: serviceUrl.trim() || undefined,
        value: secretValue,
        notes: notes.trim() || undefined,
      });
      setLabel('');
      setCategory('DOMAIN_REGISTRAR');
      setUsername('');
      setServiceUrl('');
      setSecretValue('');
      setShowInputSecret(false);
      setNotes('');
      setShowAddModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg[0] : msg || 'Failed to encrypt and save credential.');
    }
  };

  const handleToggleReveal = async (secret: ApiVaultSecret) => {
    if (revealedMap[secret.id] !== undefined) {
      setRevealedMap(prev => {
        const next = { ...prev };
        delete next[secret.id];
        return next;
      });
      return;
    }

    setActionError(null);
    setRevealingId(secret.id);
    try {
      const res = await revealSecret.mutateAsync(secret.id);
      setRevealedMap(prev => ({ ...prev, [secret.id]: res.value }));
      // Auto-mask after 30 seconds
      setTimeout(() => {
        setRevealedMap(prev => {
          if (prev[secret.id] === undefined) return prev;
          const next = { ...prev };
          delete next[secret.id];
          return next;
        });
      }, 30_000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg || 'Could not decrypt credential. Please try again.');
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (secret: ApiVaultSecret) => {
    setActionError(null);
    try {
      let plain = revealedMap[secret.id];
      if (plain === undefined) {
        setRevealingId(secret.id);
        const res = await revealSecret.mutateAsync(secret.id);
        plain = res.value;
        setRevealingId(null);
      }
      await navigator.clipboard.writeText(plain);
      setCopiedId(secret.id);
      setTimeout(() => setCopiedId(curr => (curr === secret.id ? null : curr)), 2500);
    } catch {
      setRevealingId(null);
      setActionError('Could not copy secret to clipboard.');
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteSecret.mutateAsync(id);
      setConfirmDeleteId(null);
      setRevealedMap(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setActionError('Could not delete credential. Please try again.');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-400/20 text-teal-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>AES-256-GCM Authenticated Encryption • Tenant-Bound AAD</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Encrypted Credentials Vault
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Share domain registrar logins, Daraja/Paystack API keys, and third-party tokens safely with your assigned BazionWeb engineers. Every reveal is cryptographically verified and logged to the audit trail.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Encrypted Credential
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterCat('ALL')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors',
            filterCat === 'ALL'
              ? 'bg-[#0F172A] text-white border-[#0F172A]'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
          )}
        >
          All ({secrets.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = secrets.filter(s => s.category === cat.id).length;
          if (count === 0 && filterCat !== cat.id) return null;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCat(cat.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                filterCat === cat.id
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Vault List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#2563EB]" />
            Stored Secrets ({filteredSecrets.length})
          </h3>
          <span className="text-[11px] text-slate-400">Revealed secrets auto-mask after 30s</span>
        </div>

        {isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading encrypted vault metadata…" />
          </div>
        ) : isError ? (
          <div className="p-8">
            <QueryError message={error?.message} onRetry={() => refetch()} />
          </div>
        ) : filteredSecrets.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="No credentials in your vault yet"
              hint="Click 'Add Encrypted Credential' above to securely store registrar logins, M-Pesa Daraja keys, or SMTP tokens for your engineering team."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSecrets.map(secret => {
              const cat = categoryMeta(secret.category);
              const CatIcon = cat.icon;
              const isRevealed = revealedMap[secret.id] !== undefined;
              const isBusy = revealingId === secret.id;

              return (
                <div key={secret.id} className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <CatIcon className="w-4 h-4 text-slate-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">{secret.label}</span>
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', cat.badge)}>
                            {cat.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                          {secret.username && (
                            <span>
                              Login / Key ID: <strong className="font-mono text-slate-700">{secret.username}</strong>
                            </span>
                          )}
                          {secret.serviceUrl && (
                            <a
                              href={secret.serviceUrl.startsWith('http') ? secret.serviceUrl : `https://${secret.serviceUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-medium"
                            >
                              Portal Link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {secret.notes && (
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{secret.notes}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                          <span>Added {formatDate(secret.createdAt)}</span>
                          <span>
                            {secret.lastRevealedAt
                              ? `Last decrypted ${timeAgo(secret.lastRevealedAt)}`
                              : 'Never decrypted since upload'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ciphertext / Reveal Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div
                        className={cn(
                          'px-3 py-2 rounded-xl border font-mono text-xs max-w-[260px] truncate',
                          isRevealed
                            ? 'bg-amber-50 border-amber-200 text-amber-950 font-semibold select-all'
                            : 'bg-slate-50 border-slate-200 text-slate-500',
                        )}
                      >
                        {isRevealed ? revealedMap[secret.id] : secret.maskedHint}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleReveal(secret)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isRevealed ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        {isRevealed ? 'Hide' : 'Reveal'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(secret)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50"
                      >
                        {copiedId === secret.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {confirmDeleteId === secret.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(secret.id)}
                            disabled={deleteSecret.isPending}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                          >
                            Confirm Revoke
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(secret.id)}
                          aria-label="Revoke credential"
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-[#0F172A]">Store Encrypted Credential</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Encrypted at rest with AES-256-GCM before database persistence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Credential Label *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Cloudflare Registrar Login or Daraja Consumer Secret"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Username / Key ID (optional)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin@yourdomain.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Service URL (optional)
                  </label>
                  <input
                    type="text"
                    value={serviceUrl}
                    onChange={e => setServiceUrl(e.target.value)}
                    placeholder="https://dash.cloudflare.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Secret Value / Password / API Token *
                </label>
                <div className="relative">
                  <input
                    type={showInputSecret ? 'text' : 'password'}
                    required
                    value={secretValue}
                    onChange={e => setSecretValue(e.target.value)}
                    placeholder="Paste password, private key, or API secret…"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInputSecret(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >
                    {showInputSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Engineering Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="2FA instructions, environment scope (staging vs production), or IP allowlist notes…"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSecret.isPending || !label.trim() || !secretValue.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {createSecret.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  Encrypt &amp; Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
