'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  useAdminClients,
  useAdminHosting,
  useClientVault,
  useRevealClientVaultSecret,
} from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { ManualClientCreateModal } from '@/components/admin/ManualClientCreateModal';

interface ClientRow {
  id: string;
  name: string;
  contact: string;
  email: string;
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
  onClose,
}: {
  client: ClientRow;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vault'>('overview');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const vaultQuery = useClientVault(client.id);
  const revealMutation = useRevealClientVaultSecret();

  const secrets = vaultQuery.data ?? [];

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

  const handleCopy = (secretId: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(secretId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-lg">{client.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 uppercase">
                {client.status}
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
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Encrypted Credential Vault</span>
            {secrets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                {secrets.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {activeTab === 'overview' ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Domain</div>
                  <div className="text-slate-900 font-mono font-bold mt-1 text-sm">{client.domain}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Plan Tier</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">{client.plan} ({client.tier})</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Lifecycle Status</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">{client.status}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 font-medium">Monthly MRR</div>
                  <div className="text-slate-900 font-bold mt-1 text-sm">${client.mrr}</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">Primary Contact</div>
                <div className="text-slate-900 font-bold text-sm">{client.contact}</div>
                <div className="text-slate-600 font-mono">{client.email}</div>
                <div className="text-slate-400 text-[11px] mt-1">Next Renewal: {client.renewal}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Vault Security Banner */}
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

                        {/* Username & URL Meta */}
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

                        {/* Secret Plaintext or Masked Hint */}
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
      contact: c.contactName || '—',
      email: c.email || '—',
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
          <h2 className="text-lg font-black text-slate-900">Clients & Organizations</h2>
          <p className="text-xs text-slate-500">Manage client accounts, assigned subscriptions, and domains</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client Manually</span>
          </button>
        </div>
      </div>

      {/* ── Filters & Search Bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, domain, or email…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Clients' : st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clients Data Table ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {clientsQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading client directory…" />
          </div>
        ) : clientsQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load clients directory." onRetry={() => clientsQuery.refetch()} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No clients found" hint="Try adjusting your search criteria or add a new client." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Client & Contact</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Tickets</th>
                  <th className="py-3 px-4">MRR</th>
                  <th className="py-3 px-4">Renewal</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[11px] font-normal text-slate-400">{c.contact} • {c.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {c.domain !== '—' ? (
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2563EB] hover:underline inline-flex items-center gap-1"
                        >
                          {c.domain}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <button
                        onClick={() => setSelectedClient(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Client Detail Modal (Overview + Encrypted Credential Vault) ─── */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
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
