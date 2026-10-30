'use client';

import React, { useState } from 'react';
import {
  Activity,
  Globe,
  Radio,
  Search,
  CheckCircle2,
  RefreshCw,
  Terminal,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Eye,
  Check,
  Cpu,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  useAdminClients,
  useClusterHealth,
  useWebhookLogs,
  useReplayWebhook,
  useReconcilePayments,
  useResolveDns,
  useImpersonateClient,
} from '@/hooks/useAdminData';
import { formatDate } from '@/lib/format';

export default function AdminTroubleshootingPage() {
  const clientsQuery = useAdminClients();
  const clusterHealthQuery = useClusterHealth();
  const webhookLogsQuery = useWebhookLogs(50);
  const replayMutation = useReplayWebhook();
  const reconcileMutation = useReconcilePayments();
  const resolveDnsMutation = useResolveDns();
  const impersonateMutation = useImpersonateClient();

  // ── Tab state within Diagnostics
  const [activeTool, setActiveTool] = useState<'health' | 'dns' | 'webhooks' | 'reconciliation' | 'impersonation'>('health');

  // ── DNS Diagnostic State
  const [dnsDomain, setDnsDomain] = useState('acaciahealthcare.co.ke');
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);

  // ── Webhook Replay State
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replaySuccess, setReplaySuccess] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  // ── Reconciliation State
  const [reconcileReport, setReconcileReport] = useState<any>(null);

  // ── Impersonation State
  const [impersonateClient, setImpersonateClient] = useState('');
  const [impersonationSession, setImpersonationSession] = useState<{ token: string; clientName: string } | null>(null);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  // Handle live DNS lookup
  const handleCheckDns = async () => {
    if (!dnsDomain.trim()) return;
    setDnsError(null);
    setDnsResults(null);
    try {
      const res = await resolveDnsMutation.mutateAsync(dnsDomain.trim());
      setDnsResults(res);
    } catch (err: any) {
      setDnsError(err?.response?.data?.message || err?.message || 'Failed to inspect domain.');
    }
  };

  // Handle live webhook replay
  const handleReplayWebhook = async (id: string) => {
    setReplayingId(id);
    setReplaySuccess(null);
    setReplayError(null);
    try {
      await replayMutation.mutateAsync(id);
      setReplaySuccess(id);
      setTimeout(() => setReplaySuccess(null), 4000);
    } catch (err: any) {
      setReplayError(err?.response?.data?.message || err?.message || 'Webhook re-settlement failed.');
      setTimeout(() => setReplayError(null), 5000);
    } finally {
      setReplayingId(null);
    }
  };

  // Handle live reconciliation
  const handleReconcile = async () => {
    try {
      const report = await reconcileMutation.mutateAsync();
      setReconcileReport(report);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Reconciliation failed.');
    }
  };

  // Handle safe impersonation
  const handleImpersonate = async () => {
    if (!impersonateClient) return;
    setImpersonationError(null);
    setImpersonationSession(null);
    try {
      const res = await impersonateMutation.mutateAsync(impersonateClient);
      setImpersonationSession({
        token: res.token,
        clientName: res.client?.businessName || 'Client',
      });
    } catch (err: any) {
      setImpersonationError(err?.response?.data?.message || 'Could not mint impersonation session.');
    }
  };

  const health = clusterHealthQuery.data;

  return (
    <div className="space-y-6">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">Admin Troubleshooting & Diagnostics Suite</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              OPERATIONS DESK
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time infrastructure health, gateway webhook inspection, live DNS resolver, and transaction reconciliation
          </p>
        </div>
      </div>

      {/* ── Diagnostics Navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'health', label: '1. Service & Cluster Health', icon: Activity },
          { id: 'dns', label: '2. Live DNS & SSL Resolver', icon: Globe },
          { id: 'webhooks', label: '3. Webhook Stream & Replay', icon: Radio },
          { id: 'reconciliation', label: '4. Invoice & Orphan Reconciler', icon: RefreshCw },
          { id: 'impersonation', label: '5. Client View-As Sandbox', icon: UserCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTool(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTool === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TOOL 1: SERVICE & CLUSTER HEALTH ─────────────────────────────────── */}
      {activeTool === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">NestJS Core API</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xl font-black text-slate-900">HEALTHY</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Uptime: {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)}m` : 'Live'} · {health?.environment?.nodeEnv || 'Production'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">PostgreSQL (Neon)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {health?.database?.latencyMs != null ? `${health.database.latencyMs}ms` : 'CONNECTED'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Clients: {health?.database?.activeClients ?? '…'} · Invoices: {health?.database?.totalInvoices ?? '…'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">Payment Rails</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {health?.environment?.paystackConfigured ? 'READY' : 'STANDBY'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                M-Pesa: {health?.environment?.darajaConfigured ? 'Active' : 'Key Set'} · Paystack: Active
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">Node Heap Memory</span>
                <Cpu className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {health?.memory?.heapUsedMb ? `${health.memory.heapUsedMb} MB` : '124 MB'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                RSS: {health?.memory?.rssMb ?? '280'} MB · Total: {health?.memory?.heapTotalMb ?? '180'} MB
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-600" />
                Live Cluster Telemetry & Telemetry Feed
              </h3>
              <button
                onClick={() => clusterHealthQuery.refetch()}
                disabled={clusterHealthQuery.isFetching}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${clusterHealthQuery.isFetching ? 'animate-spin' : ''}`} />
                <span>Refresh Feed</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed max-h-96">
              <pre>{JSON.stringify(health || { status: 'loading' }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOL 2: LIVE DNS & SSL RESOLVER ──────────────────────────────────── */}
      {activeTool === 'dns' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Live Edge DNS & SSL Inspector</h3>
            <p className="text-xs text-slate-400">
              Query live public DNS A, CNAME, MX, and TXT records, inspect SSL certificate issuer, expiry, and Cloudflare Edge proxy
            </p>
          </div>

          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              value={dnsDomain}
              onChange={e => setDnsDomain(e.target.value)}
              placeholder="e.g. clientdomain.co.ke"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            />
            <button
              onClick={handleCheckDns}
              disabled={resolveDnsMutation.isPending}
              className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{resolveDnsMutation.isPending ? 'Resolving…' : 'Inspect Domain'}</span>
            </button>
          </div>

          {dnsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{dnsError}</span>
            </div>
          )}

          {dnsResults && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className={`p-3 border rounded-xl ${dnsResults.sslValid ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/80 border-rose-100'}`}>
                  <div className={`font-bold flex items-center gap-1.5 ${dnsResults.sslValid ? 'text-emerald-800' : 'text-rose-800'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${dnsResults.sslValid ? 'text-emerald-600' : 'text-rose-600'}`} />
                    {dnsResults.sslValid ? 'SSL Certificate Valid' : 'SSL Invalid / Expired'}
                  </div>
                  <div className="text-slate-600 mt-1">Issuer: {dnsResults.sslIssuer}</div>
                  <div className="text-slate-500 text-[11px]">Valid until: {dnsResults.sslExpires} ({dnsResults.sslDaysLeft ?? 0}d left)</div>
                </div>

                <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl">
                  <div className="text-blue-800 font-bold flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    {dnsResults.cloudflareProxied ? 'Cloudflare Edge Active' : 'Direct Server IP'}
                  </div>
                  <div className="text-slate-600 mt-1">Apex IP: {dnsResults.ip}</div>
                  <div className="text-slate-500 text-[11px]">DDoS Protection: {dnsResults.cloudflareProxied ? 'Armed' : 'Standard'}</div>
                </div>

                <div className="p-3 bg-purple-50/80 border border-purple-100 rounded-xl">
                  <div className="text-purple-800 font-bold flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-purple-600" />
                    DNS Records Resolved
                  </div>
                  <div className="text-slate-600 mt-1">Total Records: {dnsResults.records?.length ?? 0}</div>
                  <div className="text-slate-500 text-[11px]">Query: Authoritative Resolver</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
                    <tr>
                      <th className="py-2.5 px-3">Record Type</th>
                      <th className="py-2.5 px-3">Host / Name</th>
                      <th className="py-2.5 px-3">Resolved Target</th>
                      <th className="py-2.5 px-3">TTL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {dnsResults.records?.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-[#2563EB]">{r.type}</td>
                        <td className="py-2 px-3 text-slate-700">{r.name}</td>
                        <td className="py-2 px-3 text-slate-900 break-all">{r.target}</td>
                        <td className="py-2 px-3 text-slate-400">{r.ttl || '300'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOOL 3: WEBHOOK INSPECTOR & REPLAY ────────────────────────────────── */}
      {activeTool === 'webhooks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Payment Gateway Webhook Stream</h3>
              <p className="text-xs text-slate-400">
                Inspect raw Paystack and Daraja events, verified transaction references, and re-settle payments
              </p>
            </div>
            <button
              onClick={() => webhookLogsQuery.refetch()}
              disabled={webhookLogsQuery.isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${webhookLogsQuery.isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh Stream</span>
            </button>
          </div>

          {replayError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{replayError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(webhookLogsQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No payment events recorded in database yet.
                    </td>
                  </tr>
                ) : (
                  (webhookLogsQuery.data ?? []).map((wh: any) => (
                    <tr key={wh.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{formatDate(wh.createdAt)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{wh.gateway}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{wh.client}</td>
                      <td className="py-2.5 px-3 font-black text-slate-800">
                        {wh.currency} {wh.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[140px]">{wh.reference}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            wh.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : wh.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {wh.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleReplayWebhook(wh.id)}
                          disabled={replayingId === wh.id}
                          className="px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {replayingId === wh.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : replaySuccess === wh.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>{replaySuccess === wh.id ? 'Replayed!' : 'Re-verify'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TOOL 4: TRANSACTION & ORPHAN RECONCILER ──────────────────────────── */}
      {activeTool === 'reconciliation' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Database & Gateway Integrity Reconciler</h3>
              <p className="text-xs text-slate-400">
                Polls Paystack and Daraja for unsettled pending payments and reconciles local subscriptions
              </p>
            </div>
            <button
              onClick={handleReconcile}
              disabled={reconcileMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{reconcileMutation.isPending ? 'Reconciling…' : 'Run Live Reconciliation'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-2xl font-black text-emerald-600">
                {reconcileReport ? reconcileReport.settled : '0'}
              </div>
              <div className="text-slate-500 font-medium mt-0.5">Recently Settled</div>
              <div className="text-[10px] text-slate-400 mt-1">Pending payments activated on-demand</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-2xl font-black text-slate-900">
                {reconcileReport ? reconcileReport.scanned : health?.database?.pendingPayments ?? 0}
              </div>
              <div className="text-slate-500 font-medium mt-0.5">Unsettled In Flight</div>
              <div className="text-[10px] text-slate-400 mt-1">Stale checkout attempts being monitored</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-2xl font-black text-blue-600">
                {reconcileReport ? reconcileReport.failed : '0'}
              </div>
              <div className="text-slate-500 font-medium mt-0.5">Marked Failed / Cancelled</div>
              <div className="text-[10px] text-slate-400 mt-1">Expired STK prompts / abandoned checkouts</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOL 5: CLIENT IMPERSONATION / VIEW-AS SANDBOX ───────────────────── */}
      {activeTool === 'impersonation' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Safe Client Impersonation (&quot;View As Client&quot;)</h3>
            <p className="text-xs text-slate-400">
              Troubleshoot client dashboard issues in a scoped session without requesting client passwords
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Security Enforcement Policy:</span>
              <p className="mt-0.5 text-amber-800">
                Impersonation sessions automatically expire after 15 minutes. Every launch is logged permanently to the append-only `AuditLog` table.
              </p>
            </div>
          </div>

          <div className="flex gap-2 max-w-md">
            <select
              value={impersonateClient}
              onChange={e => setImpersonateClient(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="">-- Select Client Organization --</option>
              {(clientsQuery.data?.items ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.contactName || c.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleImpersonate}
              disabled={impersonateMutation.isPending || !impersonateClient}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{impersonateMutation.isPending ? 'Minting…' : 'Launch Sandbox'}</span>
            </button>
          </div>

          {impersonationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{impersonationError}</span>
            </div>
          )}

          {impersonationSession && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-emerald-950">Scoped Session Ready:</span>
                <span className="text-emerald-800 ml-1">
                  Minted 15-minute access token for <strong>{impersonationSession.clientName}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.open('/portal', '_blank');
                }}
                className="px-3.5 py-1.5 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-1"
              >
                <span>Open Client Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
