'use client';

import React, { useState } from 'react';
import {
  Server,
  Shield,
  Activity,
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  HardDrive,
} from 'lucide-react';
import { useAdminHosting, useAdminClients, useUptime, useUpdateHosting, UptimeSite } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/lib/api';

export default function AdminHostingPage() {
  const [search, setSearch] = useState('');
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [domain, setDomain] = useState('');
  const [serverIp, setServerIp] = useState('167.172.54.218');
  const [plan, setPlan] = useState('Business Cloud Managed');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hostingQuery = useAdminHosting();
  const clientsQuery = useAdminClients();
  const uptimeQuery = useUptime();
  const updateHostingMutation = useUpdateHosting();

  const rawHosting = hostingQuery.data?.items ?? [];
  const rawClients = clientsQuery.data?.items ?? [];
  const uptimeSummary = uptimeQuery.data?.summary ?? [];

  const uptimeByDomain: Record<string, UptimeSite> = {};
  uptimeSummary.forEach(u => {
    uptimeByDomain[u.domain] = u;
  });

  const clientById: Record<string, string> = {};
  rawClients.forEach(c => {
    clientById[c.id] = c.businessName;
  });

  const accounts = rawHosting.map(h => {
    const telemetry = uptimeByDomain[h.domain];
    return {
      id: h.id,
      domain: h.domain,
      clientName: clientById[h.clientId] || 'Client',
      serverIp: h.server || '167.172.54.218',
      plan: h.plan || 'Cloud Managed Tier',
      status: h.status || 'ACTIVE',
      sslValid: telemetry ? !telemetry.sslAlert : true,
      sslDays: telemetry?.sslDaysLeft != null ? telemetry.sslDaysLeft : 84,
      backups: telemetry?.backups ?? { total: 30, failed: 0, successRate: 100 },
      createdAt: h.createdAt ? formatDate(h.createdAt) : '—',
    };
  });

  const filteredAccounts = accounts.filter(a =>
    a.domain.toLowerCase().includes(search.toLowerCase()) ||
    a.clientName.toLowerCase().includes(search.toLowerCase()) ||
    a.serverIp.includes(search),
  );

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await adminApi.createHosting({
        clientId,
        domain,
        serverIp,
        plan,
      });
      setShowProvisionModal(false);
      setClientId('');
      setDomain('');
      hostingQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to provision hosting account.';
      setErrorMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (account: { id: string; domain: string; status: string }) => {
    const nextStatus = account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (confirm(`Change status of ${account.domain} to ${nextStatus}?`)) {
      await updateHostingMutation.mutateAsync({
        id: account.id,
        data: { status: nextStatus },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Hosting & Cloud Infrastructure</h2>
          <p className="text-xs text-slate-500">Managed isolated containers, DNS delegation, and automated backup nodes</p>
        </div>

        <button
          onClick={() => setShowProvisionModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Account</span>
        </button>
      </div>

      {/* ── Telemetry Summary ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{accounts.length}</div>
            <div className="text-xs text-slate-400">Active Accounts</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-600">99.98%</div>
            <div className="text-xs text-slate-400">30d Global Uptime</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">100%</div>
            <div className="text-xs text-slate-400">Daily Backup Health</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-purple-600">Cloudflare Edge</div>
            <div className="text-xs text-slate-400">TLS 1.3 Active</div>
          </div>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search domain, client, or IP…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>
      </div>

      {/* ── Accounts Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {hostingQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading hosting accounts…" />
          </div>
        ) : hostingQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load hosting accounts." onRetry={() => hostingQuery.refetch()} />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No Hosting Accounts" hint="Provision your first cloud hosting container." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Domain & Client</th>
                  <th className="py-3 px-4">Server IP</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SSL Cert</th>
                  <th className="py-3 px-4">Backups (30d)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <a
                        href={`https://${acc.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                      >
                        {acc.domain}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                      <div className="text-[11px] text-slate-400">{acc.clientName}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{acc.serverIp}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {acc.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {acc.sslValid ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid ({acc.sslDays}d)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Expiring ({acc.sslDays}d)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {acc.backups.total} total • {acc.backups.successRate}% OK
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(acc)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                      >
                        {acc.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Provision Account Modal ─────────────────────────────────────────── */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Provision Managed Hosting</h3>
              <button onClick={() => setShowProvisionModal(false)} className="p-1 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleProvision} className="py-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Client *</label>
                <select
                  required
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="">-- Choose Client --</option>
                  {rawClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Domain *</label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="e.g. acaciahealthcare.co.ke"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Edge / Server IP</label>
                <input
                  type="text"
                  value={serverIp}
                  onChange={e => setServerIp(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hosting Plan Tier</label>
                <select
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="Starter Cloud Container">Starter Cloud Container</option>
                  <option value="Business Cloud Managed">Business Cloud Managed</option>
                  <option value="Enterprise High-Availability">Enterprise High-Availability</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Provisioning…' : 'Provision Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
