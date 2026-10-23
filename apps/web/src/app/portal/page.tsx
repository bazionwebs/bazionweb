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
  ShieldCheck,
  Globe,
  CreditCard,
  FolderKanban,
} from 'lucide-react';
import {
  useClientProfile,
  useClientTickets,
  useClientHosting,
  useClientProjects,
  useClientInvoices,
} from '@/hooks/usePortalData';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function PortalDashboardPage() {
  const { data: liveClient } = useClientProfile();
  const { data: liveTickets = [] } = useClientTickets();
  const { data: hostingAccounts = [] } = useClientHosting();
  const { data: projects = [] } = useClientProjects();
  const { data: invoices = [] } = useClientInvoices();

  const contactName = liveClient?.contactName || liveClient?.businessName || 'there';
  const activeSubscription = liveClient?.subscriptions?.[0];
  const planName = activeSubscription?.plan?.name ?? liveClient?.plan?.name ?? 'Cloud Care';
  const openTickets = liveTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const pendingInvoices = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE');
  const activeProject = projects[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Hero Banner ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              {liveClient?.businessName ? `${liveClient.businessName} Workspace` : 'Client Workspace'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {contactName}
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl leading-relaxed">
              {activeProject
                ? `Active project "${activeProject.name}" is currently ${activeProject.completionPct ?? 0}% complete. Staging links and sprint deliverables are updated in your roadmap.`
                : `Your ${planName} client portal is active. Track delivery progress, open support requests, manage DNS assets, and settle invoices directly from your workspace.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/portal/milestones"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-colors whitespace-nowrap"
            >
              <FolderKanban className="w-4 h-4" />
              View Delivery Roadmap
            </Link>
            <Link
              href="/portal/support"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 text-white text-xs font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Support Request
            </Link>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── Overview Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Status</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {activeSubscription?.status ?? 'Active'}
            </span>
          </div>
          <div className="text-2xl font-black text-[#0F172A] tracking-tight">{planName}</div>
          <div className="text-xs text-slate-500 mt-1">
            {activeSubscription?.billingCycle ? `${activeSubscription.billingCycle} Billing` : 'Active Client Retainer'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Support SLA</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Guaranteed
            </span>
          </div>
          <div className="text-2xl font-black text-[#0F172A] tracking-tight">
            {openTickets.length > 0 ? `${openTickets.length} In Progress` : '0 Active'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {openTickets.length > 0 ? 'Engineering team triaging' : 'All requests resolved'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cloud Hosting</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
              {hostingAccounts.length > 0 ? 'Connected' : 'Provisioning'}
            </span>
          </div>
          <div className="text-2xl font-black text-[#0F172A] tracking-tight truncate">
            {hostingAccounts[0]?.domain ?? 'Primary Edge'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {hostingAccounts.length > 0 ? `${hostingAccounts.length} host account(s)` : 'Managed DNS & SSL'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoices</span>
            <span className={cn(
              'text-[11px] font-bold px-2 py-0.5 rounded-full',
              pendingInvoices.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            )}>
              {pendingInvoices.length > 0 ? 'Due' : 'Settled'}
            </span>
          </div>
          <div className="text-2xl font-black text-[#0F172A] tracking-tight">
            {pendingInvoices.length > 0 ? `${pendingInvoices.length} Pending` : 'Up to Date'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {invoices.length} statement(s) on record
          </div>
        </div>
      </div>

      {/* ── Operations Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Delivery Status */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#0F172A] text-base">Project Delivery Roadmap</h3>
              <p className="text-xs text-slate-400">
                {activeProject ? activeProject.name : 'Engineering sprints & scoped milestones'}
              </p>
            </div>
            {activeProject && (
              <span className="text-sm font-extrabold text-[#2563EB]">
                {activeProject.completionPct ?? 0}% Complete
              </span>
            )}
          </div>

          {activeProject ? (
            <div className="space-y-4">
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, activeProject.completionPct ?? 0))}%` }}
                />
              </div>

              {activeProject.tasks && activeProject.tasks.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  {activeProject.tasks.slice(0, 4).map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs">
                      <div className="flex items-center gap-2.5 font-medium text-slate-700">
                        <CheckCircle2 className={cn(
                          'w-4 h-4 shrink-0',
                          task.status === 'DONE' ? 'text-emerald-500' : 'text-slate-300'
                        )} />
                        <span>{task.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 text-[10px] font-semibold">
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4">
                  Sprint deliverables for this project are currently being sequenced with your lead engineer.
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {activeProject.dueDate ? `Target Delivery: ${formatDate(activeProject.dueDate)}` : 'Continuous Delivery'}
                </span>
                <Link
                  href="/portal/milestones"
                  className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  View Full Roadmap <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">No active project underway</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Project delivery roadmaps appear here once your custom build or migration sprint is scoped by our systems engineers.
              </p>
              <Link
                href="/portal/support"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Start a New Request
              </Link>
            </div>
          )}
        </div>

        {/* Engineering Desk */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#0F172A] text-base mb-1">Dedicated Engineering Desk</h3>
            <p className="text-xs text-slate-400 mb-4">Direct access to BazionWeb engineering</p>

            <div className="space-y-3 mb-6">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Response SLA
                </div>
                <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <span>Prioritized SLA Response Window</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Support Channel
                </div>
                <div className="text-sm font-bold text-[#0F172A]">Tickets & Engineering Thread</div>
                <div className="text-xs text-slate-400 mt-0.5">Direct updates from assigned engineers</div>
              </div>

              {openTickets.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Open Requests</div>
                  <div className="text-sm font-bold text-amber-900">{openTickets.length} request(s) being triaged</div>
                </div>
              )}

              {activeSubscription?.renewalDate && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Next Renewal Date
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    {formatDate(activeSubscription.renewalDate)}
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
          { href: '/portal/milestones', label: 'Delivery Roadmap', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { href: '/portal/support', label: 'Support & Tickets', icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50' },
          { href: '/portal/assets', label: 'DNS & Assets', icon: Globe, color: 'text-teal-600', bg: 'bg-teal-50' },
          { href: '/portal/invoices', label: 'Billing & Invoices', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
