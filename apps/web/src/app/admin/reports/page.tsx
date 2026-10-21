'use client';

import React from 'react';
import {
  BarChart2,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Calendar,
} from 'lucide-react';
import { useSla, useUptime, useMrr, useCanSeeBilling } from '@/hooks/useAdminData';
import { SectionLoading, QueryError, EmptyState } from '@/components/ui/QueryState';

export default function AdminReportsPage() {
  const slaQuery = useSla();
  const uptimeQuery = useUptime();
  const mrrQuery = useMrr();
  const canSeeBilling = useCanSeeBilling();

  const sla = slaQuery.data;
  const uptime = uptimeQuery.data;

  return (
    <div className="space-y-6">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Reports, SLA & Service Telemetry</h2>
          <p className="text-xs text-slate-500">Service Level Agreement compliance rates, uptime verification, and operational health</p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Report</span>
        </button>
      </div>

      {/* ── SLA Compliance Card ──────────────────────────────────────────────── */}
      {canSeeBilling && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">SLA Compliance Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">Calculated over period: {sla?.period || 'Current 30 Days'}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Contract Target: 99.5%
            </span>
          </div>

          {slaQuery.isLoading ? (
            <SectionLoading label="Loading SLA compliance statistics…" />
          ) : slaQuery.isError ? (
            <QueryError message="Could not load SLA data." onRetry={() => slaQuery.refetch()} />
          ) : !sla ? (
            <EmptyState title="No SLA Data" hint="SLA data will aggregate as tickets are resolved." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-400 font-medium">Compliance Rate</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{sla.complianceRate}%</div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Target Achieved
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-400 font-medium">Resolved Tickets</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {sla.resolvedTickets} / {sla.totalTickets}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{sla.resolutionRate}% resolution rate</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-400 font-medium">Avg Resolution Time</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{sla.avgResolutionMinutes}m</div>
                <div className="text-[11px] text-slate-400 mt-1">Median across all tiers</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-400 font-medium">SLA Breaches</div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    sla.slaBreaches > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {sla.slaBreaches}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Past contract threshold</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Domain Uptime & Backups Table ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Managed Site Telemetry & Uptime</h3>
            <p className="text-xs text-slate-400 mt-0.5">30-day continuous health check per client domain</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total Sites: {uptime?.totalSites ?? 0}
          </span>
        </div>

        {uptimeQuery.isLoading ? (
          <div className="p-8">
            <SectionLoading label="Loading uptime matrix…" />
          </div>
        ) : uptimeQuery.isError ? (
          <div className="p-8">
            <QueryError message="Could not load uptime summary." onRetry={() => uptimeQuery.refetch()} />
          </div>
        ) : !uptime || uptime.summary.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No Monitored Sites" hint="Uptime checks will register once hosting accounts are active." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SSL Validity</th>
                  <th className="py-3 px-4">Automated Backups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {uptime.summary.map(s => (
                  <tr key={s.domain} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.domain}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{s.client}</td>
                    <td className="py-3 px-4 text-slate-500">{s.plan}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {s.sslAlert ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {s.sslDaysLeft ?? '?'}d left
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.backups.total} runs • {s.backups.successRate}% success rate
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
