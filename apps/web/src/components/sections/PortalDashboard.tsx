'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Globe,
  Layers,
  KeyRound,
  Ticket,
  FileText,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Download,
  Plus,
  X,
  Menu,
  Lock,
  Copy,
  Check,
  Clock,
  Smartphone,
  Monitor,
  Tablet,
  ArrowUpRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';
import {
  useClientProfile,
  useClientHosting,
  useClientTickets,
  useCreateTicket,
  useClientInvoices,
} from '@/hooks/usePortalData';
import { TableSkeletonRows, QueryError, EmptyState } from '@/components/ui/QueryState';
import { formatMoney, formatDate, titleCase, providerLabel, shortId } from '@/lib/format';

// ─── Client Profile & Data Model ─────────────────────────────────────────────

interface Milestone {
  id: number;
  title: string;
  phase: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  estimatedDate: string;
  deliverables: string[];
}

const mockClient = {
  name: 'Acacia Healthcare Ltd',
  contactName: 'Dr. Sarah Kamau',
  role: 'Managing Director & Founder',
  domain: 'acaciahealthcare.co.ke',
  stagingUrl: 'https://staging-acacia.bazionwebs.com',
  productionUrl: 'https://acaciahealthcare.co.ke',
  activePlan: 'Business Cloud Care',
  slaGuarantee: '4-Hour Critical SLA',
  nextRenewal: '2026-10-15',
  renewalAmount: 'KES 25,000 / mo',
  paymentMethod: 'M-Pesa Business Till #749210 (Auto-Renew)',
};

const projectMilestones: Milestone[] = [
  {
    id: 1,
    title: 'Discovery, Information Architecture & Scope Lock',
    phase: 'Phase 1',
    status: 'completed',
    progress: 100,
    estimatedDate: 'Aug 15, 2026',
    deliverables: [
      'Commercial scope & deliverables sign-off',
      'Site structure & conversion pathway mapping',
      'Stakeholder requirements interview',
    ],
  },
  {
    id: 2,
    title: 'Figma UI/UX Prototypes & Design Token System',
    phase: 'Phase 2',
    status: 'completed',
    progress: 100,
    estimatedDate: 'Aug 29, 2026',
    deliverables: [
      'High-fidelity mobile & desktop wireframes',
      'Brand palette, typography & asset kit',
      'Interactive Figma review & stakeholder approval',
    ],
  },
  {
    id: 3,
    title: 'Next.js Frontend, Payment Rails & System Integrations',
    phase: 'Phase 3',
    status: 'active',
    progress: 88,
    estimatedDate: 'Sep 28, 2026',
    deliverables: [
      'Responsive Next.js 14 App Router implementation',
      'M-Pesa Daraja STK Push & Stripe card gateway',
      'Doctor appointment booking engine & database schema',
    ],
  },
  {
    id: 4,
    title: 'Staging Sandbox Testing & Client Acceptance Audit',
    phase: 'Phase 4',
    status: 'pending',
    progress: 15,
    estimatedDate: 'Oct 05, 2026',
    deliverables: [
      'Cross-device responsive & retina QA',
      'Core Web Vitals & speed optimization pass',
      'Client UAT review & final sign-off',
    ],
  },
  {
    id: 5,
    title: 'Production Cutover, DNS Delegation & 60-Day Warranty',
    phase: 'Phase 5',
    status: 'pending',
    progress: 0,
    estimatedDate: 'Oct 12, 2026',
    deliverables: [
      'Zero-downtime DNS cutover to Cloudflare Edge',
      'SSL TLS 1.3 issuance & KRA eTIMS invoice generation',
      'Commencement of 60-day defect liability warranty',
    ],
  },
];

const webVitalsTelemetry = [
  {
    metric: 'LCP',
    name: 'Largest Contentful Paint',
    value: '0.84s',
    rating: 'Good (Sub-1s)',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    metric: 'FID',
    name: 'First Input Delay',
    value: '14ms',
    rating: 'Instantaneous (<50ms)',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    metric: 'CLS',
    name: 'Cumulative Layout Shift',
    value: '0.01',
    rating: 'Stable Zero-Jitter',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    metric: 'SEO & Speed',
    name: 'Google Lighthouse Score',
    value: '98 / 100',
    rating: 'Top 1% Tier',
    color: 'text-[#2563EB]',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
];

const assetSovereigntyChecklist = [
  {
    asset: 'Domain Name & DNS Control',
    status: 'Client Sovereign (Delegated Access)',
    authority: 'Cloudflare / Safaricom Domains',
    details: 'Owned directly by Acacia Healthcare Ltd. Bazion Web holds delegated engineering member rights.',
    verified: true,
  },
  {
    asset: 'SSL Certificate & Edge Security',
    status: 'Active (Automated TLS 1.3)',
    authority: 'Cloudflare Universal SSL',
    details: 'Next auto-renewal: April 2027. Full HSTS and DDoS Edge Protection enabled.',
    verified: true,
  },
  {
    asset: 'Google Search Console & Analytics',
    status: 'Verified Property Owner',
    authority: 'Google Workspace',
    details: 'Direct client ownership with bazion-dev service account mapped for sitemap submission.',
    verified: true,
  },
  {
    asset: 'Codebase & Intellectual Property',
    status: '100% Client Owned',
    authority: 'Bazion Commercial Deed',
    details: 'Complete assignment of all custom code, assets, and databases upon milestone completion.',
    verified: true,
  },
];

const PRIORITY_MAP: Record<string, string> = { Critical: 'P1', Urgent: 'P2', Normal: 'P3' };
const TICKET_CATEGORIES = ['HOSTING', 'DEVELOPMENT', 'MAINTENANCE', 'SECURITY', 'BILLING', 'PERFORMANCE', 'OTHER'];

type PortalTab = 'dashboard' | 'milestones' | 'assets' | 'vault' | 'support' | 'invoices';

export default function PortalDashboard() {
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Staging frame device preview state
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedSuccess, setApprovedSuccess] = useState(false);

  // New Vault Secret state
  const [vaultSecrets, setVaultSecrets] = useState([
    { id: '1', key: 'M-Pesa Daraja Consumer Secret', preview: '••••••••••••••••94b2', env: 'Production API' },
    { id: '2', key: 'Google Maps JavaScript API Key', preview: 'AIzaSyD••••••••••••••••kX02', env: 'Client Maps' },
    { id: '3', key: 'SendGrid Transactional API Token', preview: 'SG.••••••••••••••••a821', env: 'Notification Mailer' },
  ]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretVal, setNewSecretVal] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);

  // Support Request state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState('Normal');
  const [newTicketCategory, setNewTicketCategory] = useState('HOSTING');
  const [newTicketBody, setNewTicketBody] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);

  // ── Live data (API-backed; demo narrative sections below stay local) ──────
  const { data: liveClient } = useClientProfile();
  const { data: hostingAccounts } = useClientHosting();
  const {
    data: liveTickets = [],
    isLoading: ticketsLoading,
    isError: ticketsError,
    refetch: refetchTickets,
  } = useClientTickets();
  const {
    data: liveInvoices = [],
    isLoading: invoicesLoading,
    isError: invoicesError,
    refetch: refetchInvoices,
  } = useClientInvoices();
  const createTicket = useCreateTicket();

  const clientName = liveClient?.businessName ?? mockClient.name;
  const contactName = liveClient?.contactName ?? mockClient.contactName;
  const workspaceDomain = hostingAccounts?.[0]?.domain ?? '—';
  const openTicketCount = liveTickets.filter(
    t => t.status === 'OPEN' || t.status === 'IN_PROGRESS',
  ).length;
  const activeSubscription = liveClient?.subscriptions?.[0];
  const planPrice = activeSubscription?.plan?.priceMonthly ?? liveClient?.plan?.priceMonthly;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretKey || !newSecretVal) return;
    setVaultSecrets(prev => [
      ...prev,
      {
        id: String(Date.now()),
        key: newSecretKey,
        preview: '••••••••••••••••' + newSecretVal.slice(-4),
        env: 'Encrypted Vault',
      },
    ]);
    setNewSecretKey('');
    setNewSecretVal('');
    setShowSecretModal(false);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || newTicketBody.trim().length < 20 || createTicket.isPending) return;
    setTicketError(null);
    createTicket.mutate(
      {
        subject: newTicketSubject.trim(),
        priority: PRIORITY_MAP[newTicketPriority] ?? 'P3',
        category: newTicketCategory,
        body: newTicketBody.trim(),
      },
      {
        onSuccess: () => {
          setNewTicketSubject('');
          setNewTicketBody('');
          setShowNewTicketModal(false);
        },
        onError: () => setTicketError('Could not submit your request. Please try again.'),
      },
    );
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Mission Control', id: 'dashboard' as PortalTab },
    { icon: Layers, label: 'Delivery Roadmap & Sandbox', id: 'milestones' as PortalTab },
    { icon: Globe, label: 'Asset Sovereignty & DNS', id: 'assets' as PortalTab },
    { icon: KeyRound, label: 'Encrypted Vault', id: 'vault' as PortalTab },
    { icon: Ticket, label: 'Engineering Support', id: 'support' as PortalTab, count: openTicketCount || undefined },
    { icon: FileText, label: 'Invoices & Cloud Care', id: 'invoices' as PortalTab },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ─── Sidebar ─── */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#0F172A] flex flex-col transition-transform duration-300 border-r border-white/5',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand Header */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <Logo variant="dark" markClassName="h-12 w-auto" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client Co-Branded Card (Sense of Belonging) */}
        <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white font-bold text-sm shadow-md">
              AH
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{clientName}</div>
              <div className="text-xs text-slate-400 truncate">{contactName}</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Active SLA:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              4-Hour SLA
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={cn(
                activeTab === item.id
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5',
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left group',
              )}
            >
              <item.icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-white" />
              <span className="flex-1">{item.label}</span>
              {item.count && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Client Sovereignty Guarantee Badge */}
        <div className="p-4 mx-3 mb-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white mb-1">
            <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
            <span>Asset Sovereignty</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            100% Client ownership of domain, code, and databases guaranteed by commercial SLA.
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit to Main Site</span>
          </Link>
          <span className="text-[10px] text-slate-500 font-mono">v2.4.0</span>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Main Content Canvas ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#0F172A]">
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
              <p className="text-xs text-slate-400">
                Connected Workspace: <strong className="text-slate-600">{workspaceDomain}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                SK
              </div>
            </div>
          </div>
        </header>

        {/* ─── Tab Content ─── */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* ═════════ MISSION CONTROL (DASHBOARD) ═════════ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Hero Banner with belonging message */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-3">
                      <Sparkles className="w-3.5 h-3.5" />
                      Active Engineering Sprint
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      Welcome, {contactName}
                    </h2>
                    <p className="text-slate-300 text-sm mt-1 max-w-xl leading-relaxed">
                      Your Phase 3 engineering sprint is <strong className="text-white">88% complete</strong>. Payment gateways (M-Pesa + Stripe) are integrated and staging is available for client acceptance testing.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setActiveTab('milestones')}
                      className="btn-primary text-xs py-2.5 px-4 shadow-lg shadow-blue-600/30 whitespace-nowrap"
                    >
                      Inspect Staging Sandbox
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab('support')}
                      className="px-4 py-2.5 rounded-xl border border-white/20 text-white text-xs font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
                    >
                      Request Sprint Change
                    </button>
                  </div>
                </div>

                {/* Background decorative glow */}
                <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
              </div>

              {/* Core Web Vitals & Real UX Telemetry */}
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
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.bg} ${t.color}`}>
                          {t.rating}
                        </span>
                      </div>
                      <div className="text-3xl font-black text-[#0F172A] tracking-tight">{t.value}</div>
                      <div className="text-xs text-slate-500 mt-1">{t.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Progress & Quick Support Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Milestone Progress (2 Cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Current Sprint Deliverables</h3>
                      <p className="text-xs text-slate-400">Phase 3: Core Next.js Build & Payment Integrations</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#2563EB]">88% Complete</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-6">
                    <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-full w-[88%]" />
                  </div>

                  <div className="space-y-3">
                    {projectMilestones[2].deliverables.map((d, i) => (
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
                    <span className="text-xs text-slate-400">Target Delivery Date: Sep 28, 2026</span>
                    <button
                      onClick={() => setActiveTab('milestones')}
                      className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                    >
                      View All 5 Phases <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Verified SLA & Engineering Desk */}
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
                        <div className="text-xs text-slate-400">peter@bazionwebs.com</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('support');
                      setShowNewTicketModal(true);
                    }}
                    className="btn-primary w-full justify-center text-xs py-2.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Submit Engineering Request
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ MILESTONES & STAGING SANDBOX ═════════ */}
          {activeTab === 'milestones' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">Project Delivery Roadmap & Staging Sandbox</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Follow every development sprint from discovery to production cutover with 1-click deliverable sign-offs.
                </p>
              </div>

              {/* Milestone Stepper */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {projectMilestones.map(m => (
                    <div
                      key={m.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        m.status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : m.status === 'active'
                          ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-slate-50/50 opacity-70',
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.phase}</span>
                        {m.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <Check className="w-3 h-3" /> Done
                          </span>
                        ) : m.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 animate-pulse">
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Pending</span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-[#0F172A] leading-snug line-clamp-2 mb-2">{m.title}</div>
                      <div className="text-[11px] text-slate-400">{m.estimatedDate}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staging Sandbox Interactive Preview */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-[#0F172A] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-sm">Live Staging Sandbox</span>
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">{mockClient.stagingUrl}</span>
                  </div>

                  {/* Device selector */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex p-1 rounded-lg bg-white/10 border border-white/10 text-xs">
                      <button
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          previewDevice === 'desktop' ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white',
                        )}
                        title="Desktop View"
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewDevice('tablet')}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          previewDevice === 'tablet' ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white',
                        )}
                        title="Tablet View"
                      >
                        <Tablet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          previewDevice === 'mobile' ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white',
                        )}
                        title="Mobile View"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => setApprovalModalOpen(true)}
                      className="btn-primary text-xs py-2 px-3.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      1-Click Approval
                    </button>
                  </div>
                </div>

                {/* Staging Frame Container */}
                <div className="p-6 bg-slate-100 flex justify-center items-center min-h-[460px]">
                  <div
                    className={cn(
                      'transition-all duration-300 bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden flex flex-col',
                      previewDevice === 'desktop' && 'w-full max-w-5xl h-[520px]',
                      previewDevice === 'tablet' && 'w-[768px] h-[520px]',
                      previewDevice === 'mobile' && 'w-[375px] h-[520px]',
                    )}
                  >
                    {/* Simulated Browser Address Bar */}
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      <div className="flex-1 mx-2 px-3 py-1 rounded bg-white border border-slate-200 font-mono text-[11px] truncate text-slate-600">
                        🔒 {mockClient.stagingUrl}
                      </div>
                    </div>

                    {/* Simulated Staging Content Frame */}
                    <div className="flex-1 p-8 overflow-y-auto bg-white flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                          <div className="text-lg font-black text-[#0F172A]">Acacia Healthcare</div>
                          <div className="flex gap-4 text-xs font-semibold text-slate-500">
                            <span>Services</span>
                            <span>Doctors</span>
                            <span>Appointments</span>
                          </div>
                        </div>

                        <div className="space-y-4 max-w-md">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            Staging Preview Active
                          </span>
                          <h4 className="text-2xl font-extrabold text-[#0F172A] leading-tight">
                            Comprehensive Family & Specialized Medical Care in Nairobi
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Book appointments seamlessly with instant M-Pesa verification and digital patient scheduling.
                          </p>
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold">
                            Book Doctor Consultation
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Built with Next.js 14 App Router</span>
                        <span>M-Pesa Express STK Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Modal */}
              {approvalModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0F172A] mb-2">Formal Deliverable Sign-Off</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      By approving, you verify that Phase 3 (Core Next.js Build & Payment Integrations) meets your acceptance criteria. An immutable audit record will be logged.
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 mb-6">
                      <div>Signee: <strong>{mockClient.contactName}</strong></div>
                      <div>Organization: <strong>{mockClient.name}</strong></div>
                      <div>Timestamp: <strong>{new Date().toLocaleString()}</strong></div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setApprovedSuccess(true);
                          setApprovalModalOpen(false);
                          setTimeout(() => setApprovedSuccess(false), 5000);
                        }}
                        className="btn-primary flex-1 justify-center text-xs py-2.5"
                      >
                        Confirm Sign-Off
                      </button>
                      <button
                        onClick={() => setApprovalModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {approvedSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Deliverable successfully signed off and recorded in compliance audit log.</span>
                </div>
              )}
            </div>
          )}

          {/* ═════════ ASSET SOVEREIGNTY & DNS ═════════ */}
          {activeTab === 'assets' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">Asset Sovereignty & Infrastructure Hub</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Transparent proof of client ownership for domains, DNS, SSL, and intellectual property.
                </p>
              </div>

              {/* Ownership Guarantee Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assetSovereigntyChecklist.map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h4 className="font-bold text-[#0F172A] text-sm">{item.asset}</h4>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                          <Check className="w-3 h-3" /> {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">{item.details}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Registrar / Authority:</span>
                      <strong className="text-slate-700">{item.authority}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* DNS Delegation Records */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="font-bold text-[#0F172A] text-base mb-1">Active Edge DNS Records (Cloudflare Managed)</h3>
                <p className="text-xs text-slate-400 mb-5">
                  High-speed global routing with automatic TLS 1.3 encryption and DDoS mitigation.
                </p>

                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Type</th>
                        <th className="table-header">Name</th>
                        <th className="table-header">Target Value</th>
                        <th className="table-header">Proxy Status</th>
                        <th className="table-header">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { type: 'A', name: '@', target: '172.67.194.82', proxy: 'Proxied (Cloudflare)' },
                        { type: 'CNAME', name: 'www', target: 'acaciahealthcare.co.ke', proxy: 'Proxied' },
                        { type: 'CNAME', name: 'staging', target: 'staging-acacia.bazionwebs.com', proxy: 'Proxied' },
                        { type: 'TXT', name: '@', target: 'v=spf1 include:_spf.google.com ~all', proxy: 'DNS Only' },
                      ].map((record, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="table-cell">
                            <span className="badge badge-blue font-mono">{record.type}</span>
                          </td>
                          <td className="table-cell font-mono text-xs font-semibold text-slate-700">{record.name}</td>
                          <td className="table-cell font-mono text-xs text-slate-600 max-w-xs truncate">{record.target}</td>
                          <td className="table-cell">
                            <span className="badge badge-green">{record.proxy}</span>
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => copyToClipboard(record.target, `dns-${i}`)}
                              className="text-xs text-[#2563EB] hover:underline flex items-center gap-1 font-semibold"
                            >
                              {copiedKey === `dns-${i}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ ENCRYPTED SECRETS VAULT ═════════ */}
          {activeTab === 'vault' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0F172A]">Zero-Knowledge Credentials Vault</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Safely deposit API keys, payment webhooks, and registrar secrets without sending them over unencrypted emails.
                  </p>
                </div>
                <button
                  onClick={() => setShowSecretModal(true)}
                  className="btn-primary text-xs py-2 px-4 shadow-sm self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Deposit Encrypted Secret
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Secret Key Name</th>
                        <th className="table-header">Environment / Scope</th>
                        <th className="table-header">Encrypted Preview</th>
                        <th className="table-header">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vaultSecrets.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="table-cell font-semibold text-slate-800 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-[#14B8A6]" />
                            {s.key}
                          </td>
                          <td className="table-cell text-xs text-slate-500">{s.env}</td>
                          <td className="table-cell font-mono text-xs text-slate-400">{s.preview}</td>
                          <td className="table-cell">
                            <span className="badge badge-green">Encrypted (AES-256)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Secret Modal */}
              {showSecretModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-1">Add Secret to Vault</h3>
                    <p className="text-xs text-slate-500 mb-5">
                      The key will be encrypted at the database level and accessible exclusively to assigned Bazion engineers.
                    </p>

                    <form onSubmit={handleAddSecret} className="space-y-4">
                      <div>
                        <label className="label">Secret Name</label>
                        <input
                          type="text"
                          required
                          value={newSecretKey}
                          onChange={e => setNewSecretKey(e.target.value)}
                          placeholder="e.g. M-Pesa Passkey / Mailgun API Key"
                          className="input text-xs"
                        />
                      </div>

                      <div>
                        <label className="label">Secret Value</label>
                        <textarea
                          required
                          value={newSecretVal}
                          onChange={e => setNewSecretVal(e.target.value)}
                          placeholder="Paste sensitive token or credential..."
                          className="input text-xs font-mono min-h-[90px]"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button type="submit" className="btn-primary flex-1 justify-center text-xs py-2.5">
                          Save Encrypted Secret
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSecretModal(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════ SUPPORT & REQUESTS ═════════ */}
          {activeTab === 'support' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0F172A]">Direct Engineering Support</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Submit sprint modifications or technical tickets with transparent SLA response countdowns.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewTicketModal(true)}
                  className="btn-primary text-xs py-2 px-4 shadow-sm self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Request
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Request ID</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">Priority</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Category</th>
                        <th className="table-header">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ticketsLoading ? (
                        <TableSkeletonRows rows={4} cols={6} />
                      ) : ticketsError ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6">
                            <QueryError message="Your requests couldn't be loaded." onRetry={() => refetchTickets()} />
                          </td>
                        </tr>
                      ) : liveTickets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6">
                            <EmptyState title="No requests yet" hint="Submit your first engineering request above." />
                          </td>
                        </tr>
                      ) : (
                        liveTickets.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="table-cell font-mono text-xs font-semibold text-slate-400">#{shortId(t.id, 6)}</td>
                            <td className="table-cell font-medium text-[#0F172A]">{t.subject}</td>
                            <td className="table-cell">
                              <span
                                className={cn(
                                  'badge',
                                  t.priority === 'P1'
                                    ? 'badge-red'
                                    : t.priority === 'P2'
                                    ? 'badge-yellow'
                                    : t.priority === 'P3'
                                    ? 'badge-blue'
                                    : 'badge-slate',
                                )}
                              >
                                {t.priority}
                              </span>
                            </td>
                            <td className="table-cell">
                              <span
                                className={cn(
                                  'badge',
                                  t.status === 'RESOLVED' || t.status === 'CLOSED'
                                    ? 'badge-green'
                                    : 'badge-yellow',
                                )}
                              >
                                {titleCase(t.status)}
                              </span>
                            </td>
                            <td className="table-cell text-xs font-semibold text-slate-600">{titleCase(t.category)}</td>
                            <td className="table-cell text-xs text-slate-400">{formatDate(t.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* New Ticket Modal */}
              {showNewTicketModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-1">Submit Engineering Request</h3>
                    <p className="text-xs text-slate-500 mb-5">
                      Your request will be assigned to Peter Mwangi under the 4-Hour SLA Guarantee.
                    </p>

                    <form onSubmit={handleCreateTicket} className="space-y-4">
                      <div>
                        <label className="label">Request Description</label>
                        <input
                          type="text"
                          required
                          value={newTicketSubject}
                          onChange={e => setNewTicketSubject(e.target.value)}
                          placeholder="e.g. Update emergency contact phone on landing page"
                          className="input text-xs"
                        />
                      </div>

                      <div>
                        <label className="label">Priority Level</label>
                        <select
                          value={newTicketPriority}
                          onChange={e => setNewTicketPriority(e.target.value)}
                          className="input text-xs"
                        >
                          <option value="Normal">Normal (Standard sprint adjustment)</option>
                          <option value="Urgent">Urgent (Customer-facing block)</option>
                          <option value="Critical">Critical (Immediate SLA response)</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Category</label>
                        <select
                          value={newTicketCategory}
                          onChange={e => setNewTicketCategory(e.target.value)}
                          className="input text-xs"
                        >
                          {TICKET_CATEGORIES.map(c => (
                            <option key={c} value={c}>{titleCase(c)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label">Details (min. 20 characters)</label>
                        <textarea
                          required
                          rows={4}
                          value={newTicketBody}
                          onChange={e => setNewTicketBody(e.target.value)}
                          placeholder="Describe the issue, where it happens, and what you expected…"
                          className="input text-xs"
                        />
                      </div>

                      {ticketError && (
                        <p className="text-xs font-semibold text-[#EF4444]">{ticketError}</p>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={createTicket.isPending}
                          className="btn-primary flex-1 justify-center text-xs py-2.5 disabled:opacity-50"
                        >
                          {createTicket.isPending ? 'Submitting…' : 'Submit to Engineering'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewTicketModal(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════ INVOICES & CLOUD CARE ═════════ */}
          {activeTab === 'invoices' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">Invoices & Cloud Care Subscriptions</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Itemized commercial statements with official KRA eTIMS tax receipts and direct M-Pesa statements.
                </p>
              </div>

              {/* Active Subscription Summary */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Active Subscription
                  </span>
                  <h3 className="text-lg font-bold text-[#0F172A] mt-1">
                    {activeSubscription?.plan?.name ?? liveClient?.plan?.name ?? '—'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {planPrice !== undefined && planPrice !== null
                      ? `${formatMoney(planPrice)} / mo`
                      : 'No active plan'}{' '}
                    · Next cycle: {activeSubscription?.renewalDate ? formatDate(activeSubscription.renewalDate) : '—'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-400">Payment Channel</div>
                  <div className="text-xs font-bold text-[#0F172A] mt-0.5">
                    {providerLabel(activeSubscription?.provider)}
                  </div>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="table-wrapper">
                  <table className="table-default">
                    <thead>
                      <tr>
                        <th className="table-header">Invoice #</th>
                        <th className="table-header">Description</th>
                        <th className="table-header">Amount</th>
                        <th className="table-header">Currency</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Date</th>
                        <th className="table-header">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoicesLoading ? (
                        <TableSkeletonRows rows={4} cols={7} />
                      ) : invoicesError ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6">
                            <QueryError message="Your invoices couldn't be loaded." onRetry={() => refetchInvoices()} />
                          </td>
                        </tr>
                      ) : liveInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6">
                            <EmptyState title="No invoices yet" hint="Invoices appear here after your first billing cycle." />
                          </td>
                        </tr>
                      ) : (
                        liveInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="table-cell font-mono text-xs font-semibold text-slate-400">{inv.invoiceNumber}</td>
                            <td className="table-cell font-medium text-[#0F172A] text-xs max-w-xs">{inv.notes ?? 'Subscription billing'}</td>
                            <td className="table-cell font-bold text-[#0F172A] text-xs">{formatMoney(inv.amount, inv.currency)}</td>
                            <td className="table-cell text-xs text-slate-600">{inv.currency}</td>
                            <td className="table-cell">
                              <span
                                className={cn(
                                  'badge',
                                  inv.status === 'PAID'
                                    ? 'badge-green'
                                    : inv.status === 'OVERDUE'
                                    ? 'badge-red'
                                    : inv.status === 'CANCELLED'
                                    ? 'badge-slate'
                                    : 'badge-yellow',
                                )}
                              >
                                {titleCase(inv.status)}
                              </span>
                            </td>
                            <td className="table-cell text-xs text-slate-400">{formatDate(inv.createdAt)}</td>
                            <td className="table-cell">
                              {inv.pdfUrl ? (
                                <a
                                  href={inv.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" /> PDF
                                </a>
                              ) : (
                                <span className="text-xs text-slate-300 font-medium">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
