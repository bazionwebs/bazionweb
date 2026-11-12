'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState, QueryError, SectionLoading } from '@/components/ui/QueryState';
import { useCanSeeBilling, useHostingCutover } from '@/hooks/useAdminData';
import type { AdminHostingCutoverClassification } from '@/hooks/useAdminData';

const classificationLabels: Record<AdminHostingCutoverClassification, string> = {
  linked: 'Linked and consistent',
  linked_projection_missing: 'Linked projection missing',
  linked_client_mismatch: 'Linked client mismatch',
  linked_domain_mismatch: 'Linked domain mismatch',
  linked_domain_collision: 'Linked domain collision',
  linked_ambiguous_claims: 'Linked with duplicate claims',
  ready_to_map: 'Ready to map',
  ambiguous_platform_claims: 'Ambiguous claims',
  domain_claimed_by_other_client: 'Claimed by another client',
  platform_claim_not_ready: 'Platform claim not ready',
  legacy_only: 'Legacy only',
};

function classificationTone(classification: AdminHostingCutoverClassification): string {
  if (classification === 'linked' || classification === 'ready_to_map') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (classification === 'legacy_only') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function summaryCards(summary: {
  activeHostingAccounts: number;
  linked: number;
  readyToMap: number;
  ambiguousPlatformClaims: number;
  domainClaimedByOtherClient: number;
  platformClaimNotReady: number;
  linkedConflicts: number;
  legacyOnly: number;
}) {
  return [
    { label: 'Active hosting accounts', value: summary.activeHostingAccounts, icon: Server, tone: 'text-slate-700 bg-slate-100' },
    { label: 'Linked and consistent', value: summary.linked, icon: ShieldCheck, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Ready to map', value: summary.readyToMap, icon: CheckCircle2, tone: 'text-blue-700 bg-blue-50' },
    {
      label: 'Needs operator review',
      value: summary.readyToMap + summary.ambiguousPlatformClaims + summary.domainClaimedByOtherClient + summary.platformClaimNotReady + summary.linkedConflicts,
      icon: AlertTriangle,
      tone: 'text-amber-700 bg-amber-50',
    },
  ];
}

export default function HostingCutoverPage() {
  const [page, setPage] = useState(1);
  const allowed = useCanSeeBilling();
  const reportQuery = useHostingCutover(page, 50);
  const report = reportQuery.data;

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900" role="alert">
        Hosting cutover reports require the ADMIN or SUPER_ADMIN role.
      </div>
    );
  }

  if (reportQuery.isLoading) return <SectionLoading label="Loading Platform hosting cutover inventory…" />;
  if (reportQuery.isError) {
    return <QueryError message="Could not load the hosting cutover inventory." onRetry={() => reportQuery.refetch()} />;
  }

  const summary = report?.summary;
  const reviewCount = summary
    ? summary.readyToMap + summary.ambiguousPlatformClaims + summary.domainClaimedByOtherClient + summary.platformClaimNotReady + summary.linkedConflicts
    : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/hosting" className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900">
            <ArrowLeft className="h-4 w-4" />
            Back to hosting
          </Link>
          <h1 className="text-xl font-black text-slate-900">Platform hosting cutover</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Review legacy hosting rows against Platform deployment claims before any account is mapped or a legacy workload is retired.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reportQuery.refetch()}
          disabled={reportQuery.isFetching}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${reportQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh report
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>
          This report is read-only. It never links accounts or changes provider resources. Map only a manually verified “Ready to map” row through the evidence-backed hosting mapping flow.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Cutover summary">
        {summaryCards(report?.summary ?? {
          activeHostingAccounts: 0,
          linked: 0,
          readyToMap: 0,
          ambiguousPlatformClaims: 0,
          domainClaimedByOtherClient: 0,
          platformClaimNotReady: 0,
          linkedConflicts: 0,
          legacyOnly: 0,
        }).map(card => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">{card.value}</div>
            </article>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="inline-flex items-center gap-2"><Activity className="h-4 w-4" />{reviewCount} row(s) need review</div>
        {report?.generatedAt && <div>Generated {new Date(report.generatedAt).toLocaleString()}</div>}
      </div>

      {!report?.items.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <EmptyState title="No hosting rows to review" hint="The current report page contains no active hosting accounts." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Domain / client</th>
                  <th className="px-4 py-3">Legacy state</th>
                  <th className="px-4 py-3">Platform state</th>
                  <th className="px-4 py-3">Cutover classification</th>
                  <th className="px-4 py-3">Platform deployment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {report.items.map(item => {
                  const platformState = item.platformProjectionStatus || item.platformClaimStatuses.join(', ') || 'No Platform claim';
                  const deploymentId = item.platformDeploymentId || item.candidatePlatformDeploymentId;
                  return (
                    <tr key={item.hostingAccountId} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">{item.domain}</div>
                        <div className="mt-1 text-[10px] text-slate-400">Client {item.clientId}</div>
                      </td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{item.hostingStatus}</span></td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{platformState}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{item.domainClaimCount} domain claim(s), {item.clientDomainClaimCount} for this client</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${classificationTone(item.classification)}`}>
                          {classificationLabels[item.classification]}
                        </span>
                      </td>
                      <td className="max-w-[240px] break-all px-4 py-3 font-mono text-[10px] text-slate-500">{deploymentId || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-[11px] text-slate-500">Page {report?.page ?? page} of {report?.totalPages ?? 0} · {report?.summary.activeHostingAccounts ?? 0} active accounts</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous page" className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40">
                <ArrowLeftRight className="h-4 w-4 rotate-180" />
              </button>
              <button type="button" onClick={() => setPage(value => Math.min(report?.totalPages || value + 1, value + 1))} disabled={page >= (report?.totalPages ?? 0)} aria-label="Next page" className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      )}
      <p className="inline-flex items-center gap-2 text-[11px] text-slate-400"><Clock3 className="h-3.5 w-3.5" />Live deployment changes and rollback remain separate, audited operator actions.</p>
    </div>
  );
}