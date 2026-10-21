'use client';

import React from 'react';
import Link from 'next/link';
import {
  Layers,
  Ticket,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Plus,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useClientProfile, useClientTickets, useClientHosting } from '@/hooks/usePortalData';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const webVitalsTelemetry = [
  { metric: 'LCP', name: 'Largest Contentful Paint', value: '0.84s', rating: 'Good (Sub-1s)', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { metric: 'FID', name: 'First Input Delay', value: '14ms', rating: 'Instantaneous (<50ms)', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { metric: 'CLS', name: 'Cumulative Layout Shift', value: '0.01', rating: 'Stable Zero-Jitter', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { metric: 'Lighthouse', name: 'Google Lighthouse Score', value: '98/100', rating: 'Top 1% Tier', color: 'text-[#2563EB]', bg: 'bg-blue-50', border: 'border-blue-200' },
];

const currentDeliverables = [
  'Responsive Next.js 14 App Router implementation',
  'M-Pesa Daraja STK Push & Stripe card gateway',
  'Doctor appointment booking engine & database schema',
];

export default function PortalDashboardPage() {
  const { data: liveClient } = useClientProfile();
  const { data: liveTickets = [] } = useClientTickets();
  const { data: hostingAccounts } = useClientHosting();

  const contactName = liveClient?.contactName ?? 'there';
  const activeSubscription = liveClient?.subscriptions?.[0];
  const openTicketCount = liveTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  const workspaceDomain = hostingAccounts?.[0]?.domain ?? '—';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Hero Banner ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Active Engineering Sprint • {workspaceDomain}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {contactName}
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl leading-relaxed">
              Your Phase 3 engineering sprint is <strong className="text-white">88% complete</strong>. Payment gateways (M-Pesa + Stripe) are integrated and staging is available for client acceptance testing.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/portal/milestones"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-colors whitespace-nowrap"
            >
              Inspect Staging Sandbox
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/portal/support"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 text-white text-xs font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              Request Sprint Change
            </Link>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── Core Web Vitals ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-[#0F172A] text-lg">Core Web Vitals & Production Health</h3>
            <p className="text-xs text-slate-400">Continuous real-user performance monitoring powered by Cloudflare Edge</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {webVitalsTelemetry.map(t => (
            <div
              key={t.metric}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.metric}</span>
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', t.bg, t.color)}>
                  {t.rating}
                </span>
              </div>
              <div className="text-3xl font-black text-[#0F172A] tracking-tight">{t.value}</div>
              <div className="text-xs text-slate-500 mt-1">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Operations Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Sprint Deliverables */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#0F172A] text-base">Current Sprint Deliverables</h3>
              <p className="text-xs text-slate-400">Phase 3: Core Next.js Build & Payment Integrations</p>
            </div>
            <span className="text-sm font-extrabold text-[#2563EB]">88% Complete</span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-full w-[88%]" />
          </div>

          <div className="space-y-3">
            {currentDeliverables.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs">
                <div className="flex items-center gap-2.5 font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{d}</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 text-[10px] font-semibold">
                  Verified
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Target Delivery: Sep 28, 2026</span>
            <Link
              href="/portal/milestones"
              className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
            >
              View All 5 Phases <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Engineering Desk */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#0F172A] text-base mb-1">Dedicated Engineering Desk</h3>
            <p className="text-xs text-slate-400 mb-4">Direct access to your assigned lead engineers</p>

            <div className="space-y-3 mb-6">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Response Guarantee
                </div>
                <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <span>4-Hour Critical Response SLA</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Lead Engineer
                </div>
                <div className="text-sm font-bold text-[#0F172A]">Peter Mwangi (Bazion Lead)</div>
                <div className="text-xs text-slate-400">peter@bazionweb.com</div>
              </div>

              {openTicketCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Open Requests</div>
                  <div className="text-sm font-bold text-amber-900">{openTicketCount} ticket{openTicketCount !== 1 ? 's' : ''} in progress</div>
                </div>
              )}

              {activeSubscription && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Next Renewal
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    {activeSubscription.renewalDate ? formatDate(activeSubscription.renewalDate) : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Link
            href="/portal/support"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Submit Engineering Request
          </Link>
        </div>
      </div>

      {/* ── Quick Links ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/portal/milestones', label: 'View Roadmap', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { href: '/portal/support', label: 'Open Ticket', icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50' },
          { href: '/portal/assets', label: 'DNS & Assets', icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50' },
          { href: '/portal/invoices', label: 'View Invoices', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#2563EB]/40 hover:shadow-md transition-all group flex flex-col items-center gap-2 text-center"
          >
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', item.bg)}>
              <item.icon className={cn('w-4 h-4', item.color)} />
            </div>
            <span className="text-xs font-semibold text-slate-700 group-hover:text-[#2563EB] transition-colors">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
