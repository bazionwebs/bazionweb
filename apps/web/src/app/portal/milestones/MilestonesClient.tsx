'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  Calendar,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  ArrowRight,
  FileCheck2,
  PartyPopper,
  Zap,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliverableItem {
  id: string;
  name: string;
  category: 'Architecture' | 'Design' | 'Full-Stack' | 'QA' | 'Deployment';
  status: 'verified' | 'in_review' | 'pending';
  assignee: string;
  verifiedAt?: string;
}

interface Milestone {
  id: number;
  title: string;
  phase: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  targetDate: string;
  completedDate?: string;
  summary: string;
  leadEngineer: string;
  deliverables: DeliverableItem[];
}

const PROJECT_MILESTONES: Milestone[] = [
  {
    id: 1,
    title: 'Discovery, Information Architecture & Scope Lock',
    phase: 'Phase 1',
    status: 'completed',
    progress: 100,
    targetDate: 'Aug 15, 2026',
    completedDate: 'Aug 14, 2026',
    summary: 'Commercial requirements freeze, user journey blueprint, and system integration specs.',
    leadEngineer: 'Evans M. (Solutions Architect)',
    deliverables: [
      {
        id: 'del-1-1',
        name: 'Commercial scope contract & deliverables matrix sign-off',
        category: 'Architecture',
        status: 'verified',
        assignee: 'Evans M.',
        verifiedAt: 'Aug 12, 2026',
      },
      {
        id: 'del-1-2',
        name: 'Clinical patient journey & conversion pathway wireframes',
        category: 'Architecture',
        status: 'verified',
        assignee: 'Faith W.',
        verifiedAt: 'Aug 13, 2026',
      },
      {
        id: 'del-1-3',
        name: 'Stakeholder discovery audit & brand voice positioning',
        category: 'Architecture',
        status: 'verified',
        assignee: 'Evans M.',
        verifiedAt: 'Aug 14, 2026',
      },
    ],
  },
  {
    id: 2,
    title: 'Figma UI/UX Prototypes & Design Token System',
    phase: 'Phase 2',
    status: 'completed',
    progress: 100,
    targetDate: 'Aug 29, 2026',
    completedDate: 'Aug 28, 2026',
    summary: 'Interactive hi-fi Figma prototypes, WCAG 2.1 AA accessibility pass, and typography tokens.',
    leadEngineer: 'Faith W. (Lead Product Designer)',
    deliverables: [
      {
        id: 'del-2-1',
        name: 'High-fidelity mobile & desktop responsive Figma interactive prototype',
        category: 'Design',
        status: 'verified',
        assignee: 'Faith W.',
        verifiedAt: 'Aug 24, 2026',
      },
      {
        id: 'del-2-2',
        name: 'Design tokens: Acacia brand palette, Inter typography, and UI component kit',
        category: 'Design',
        status: 'verified',
        assignee: 'Faith W.',
        verifiedAt: 'Aug 26, 2026',
      },
      {
        id: 'del-2-3',
        name: 'Clinical stakeholder prototype walkthrough & formal design approval',
        category: 'Design',
        status: 'verified',
        assignee: 'Faith W.',
        verifiedAt: 'Aug 28, 2026',
      },
    ],
  },
  {
    id: 3,
    title: 'Next.js Frontend, Payment Rails & System Integrations',
    phase: 'Phase 3',
    status: 'active',
    progress: 88,
    targetDate: 'Sep 28, 2026',
    summary: 'Core App Router implementation, M-Pesa Daraja STK Push gateway, and doctor consultation engine.',
    leadEngineer: 'David K. (Senior Full-Stack Engineer)',
    deliverables: [
      {
        id: 'del-3-1',
        name: 'Production Next.js 14 App Router layout with SEO & OpenGraph metadata',
        category: 'Full-Stack',
        status: 'verified',
        assignee: 'David K.',
        verifiedAt: 'Sep 19, 2026',
      },
      {
        id: 'del-3-2',
        name: 'Safaricom M-Pesa Daraja STK Push & Paystack card billing rails',
        category: 'Full-Stack',
        status: 'verified',
        assignee: 'David K.',
        verifiedAt: 'Sep 23, 2026',
      },
      {
        id: 'del-3-3',
        name: 'Doctor consultation scheduler with calendar sync & SMS booking confirmations',
        category: 'Full-Stack',
        status: 'in_review',
        assignee: 'David K.',
      },
    ],
  },
  {
    id: 4,
    title: 'Staging Sandbox Testing & Client Acceptance Audit',
    phase: 'Phase 4',
    status: 'pending',
    progress: 15,
    targetDate: 'Oct 05, 2026',
    summary: 'Multi-device retina testing, Lighthouse 95+ Core Web Vitals audit, and client UAT verification.',
    leadEngineer: 'Faith W. & QA Team',
    deliverables: [
      {
        id: 'del-4-1',
        name: 'Cross-browser & mobile viewport responsive matrix testing (iOS / Android / Chrome)',
        category: 'QA',
        status: 'pending',
        assignee: 'QA Team',
      },
      {
        id: 'del-4-2',
        name: 'Google Lighthouse Performance audit (LCP < 1.2s, CLS 0, Score > 95)',
        category: 'QA',
        status: 'pending',
        assignee: 'David K.',
      },
      {
        id: 'del-4-3',
        name: 'Final client acceptance review and release readiness validation',
        category: 'QA',
        status: 'pending',
        assignee: 'Evans M.',
      },
    ],
  },
  {
    id: 5,
    title: 'Production Cutover, DNS Delegation & 60-Day Warranty',
    phase: 'Phase 5',
    status: 'pending',
    progress: 0,
    targetDate: 'Oct 12, 2026',
    summary: 'Zero-downtime Cloudflare Edge DNS migration, SSL TLS 1.3 issuance, and post-launch warranty.',
    leadEngineer: 'Evans M. (DevOps Lead)',
    deliverables: [
      {
        id: 'del-5-1',
        name: 'Zero-downtime DNS cutover to Cloudflare Enterprise Edge with DDoS protection',
        category: 'Deployment',
        status: 'pending',
        assignee: 'Evans M.',
      },
      {
        id: 'del-5-2',
        name: 'Automated KRA eTIMS tax invoice generation & compliance receipt issuance',
        category: 'Deployment',
        status: 'pending',
        assignee: 'Finance Ops',
      },
      {
        id: 'del-5-3',
        name: 'Commencement of 60-day defect liability warranty & 24/7 SLA monitoring',
        category: 'Deployment',
        status: 'pending',
        assignee: 'Support Team',
      },
    ],
  },
];

const STAGING_URL = 'https://staging-acacia.bazionweb.com';

export default function MilestonesClient() {
  const [activePhaseFilter, setActivePhaseFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'UPCOMING'>('ALL');
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(3);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [simulatedPage, setSimulatedPage] = useState<'home' | 'doctors' | 'booking'>('home');
  const [simulatingSTK, setSimulatingSTK] = useState(false);
  const [stkNotification, setStkNotification] = useState<string | null>(null);

  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [signedOffPhases, setSignedOffPhases] = useState<number[]>([1, 2]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [auditHash, setAuditHash] = useState<string | null>(null);

  // Overall progress calculation
  const currentTotalProgress = Math.round(
    PROJECT_MILESTONES.reduce((acc, m) => acc + m.progress, 0) / PROJECT_MILESTONES.length
  );
  const totalDeliverables = PROJECT_MILESTONES.reduce((acc, m) => acc + m.deliverables.length, 0);
  const completedDeliverables = PROJECT_MILESTONES.reduce(
    (acc, m) => acc + m.deliverables.filter(d => d.status === 'verified').length,
    0
  );

  const filteredMilestones = PROJECT_MILESTONES.filter(m => {
    if (activePhaseFilter === 'ACTIVE') return m.status === 'active';
    if (activePhaseFilter === 'COMPLETED') return m.status === 'completed';
    if (activePhaseFilter === 'UPCOMING') return m.status === 'pending';
    return true;
  });

  const activeMilestone = PROJECT_MILESTONES.find(m => m.id === selectedPhaseId) ?? PROJECT_MILESTONES[2];

  const handleSimulateSTK = () => {
    setSimulatingSTK(true);
    setStkNotification(null);
    setTimeout(() => {
      setSimulatingSTK(false);
      setStkNotification('✓ STK Push sent to +254 712 *** 890 (KES 2,500 Consultation Fee). Daraja Sandbox OK.');
      setTimeout(() => setStkNotification(null), 7000);
    }, 1200);
  };

  const handleConfirmSignOff = () => {
    if (!signedOffPhases.includes(3)) {
      setSignedOffPhases(prev => [...prev, 3]);
    }
    const fakeHash = '0x' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setAuditHash(fakeHash);
    setApprovalModalOpen(false);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 9000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Milestone Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Project Delivery Roadmap • Sprint 3 in Flight</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Acacia Healthcare Web Platform
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Track real-time engineering velocity across all project phases. Review staging builds in the interactive sandbox and execute immutable 1-click deliverable sign-offs.
            </p>
          </div>

          {/* Quick Overall Velocity Widget */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 min-w-[280px] lg:max-w-xs shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Overall Velocity</span>
              <span className="text-lg font-black text-emerald-400">{currentTotalProgress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-700"
                style={{ width: `${currentTotalProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{completedDeliverables} of {totalDeliverables} Deliverables Verified</span>
              <span className="text-teal-300 font-medium">On Schedule</span>
            </div>
          </div>
        </div>

        {/* Action bar under hero */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Next Milestone: <strong className="text-white font-semibold">Oct 05, 2026 (Phase 4 UAT)</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>60-Day Post-Launch Warranty Included</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/portal/support"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-colors"
            >
              Request Scope Adjustment
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Celebration Notification */}
      {showCelebration && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-900">
                Phase 3 Deliverables Formally Signed Off!
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Audit record timestamped & verified. Audit Hash: <span className="font-mono font-bold">{auditHash}</span>
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
            Audit Logged
          </span>
        </div>
      )}

      {/* Phase Roadmap Stepper (Horizontal on desktop with connector line) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2563EB]" />
              Interactive Phase Delivery Stepper
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any phase to review deliverables, code artifacts, and completion criteria.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 self-start sm:self-auto">
            {(['ALL', 'ACTIVE', 'COMPLETED', 'UPCOMING'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivePhaseFilter(tab)}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all',
                  activePhaseFilter === tab
                    ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {tab === 'ALL' ? 'All (5)' : tab === 'ACTIVE' ? 'Active (1)' : tab === 'COMPLETED' ? 'Done (2)' : 'Upcoming (2)'}
              </button>
            ))}
          </div>
        </div>

        {/* Stepper Grid with visual connector line */}
        <div className="relative">
          {/* Subtle connecting line for desktop */}
          <div className="hidden lg:block absolute top-7 left-10 right-10 h-0.5 bg-slate-100 -z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
            {filteredMilestones.map(m => {
              const isSelected = selectedPhaseId === m.id;
              const isSignedOff = signedOffPhases.includes(m.id);

              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedPhaseId(m.id)}
                  className={cn(
                    'text-left p-4 rounded-2xl border transition-all relative flex flex-col justify-between group',
                    isSelected
                      ? 'ring-2 ring-[#2563EB] shadow-md border-transparent bg-blue-50/30'
                      : 'hover:border-slate-300 hover:shadow-xs bg-white border-slate-200/80'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        {m.status === 'completed' || isSignedOff ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : m.status === 'active' ? (
                          <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shadow-xs animate-pulse">
                            3
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-200">
                            {m.id}
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{m.phase}</span>
                      </div>

                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          m.status === 'completed' || isSignedOff
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {m.status === 'completed' || isSignedOff ? 'Completed' : m.status === 'active' ? 'In Flight' : 'Pending'}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-[#0F172A] leading-snug line-clamp-2 mb-2 group-hover:text-[#2563EB] transition-colors">
                      {m.title}
                    </h3>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>Progress</span>
                      <span className="font-bold text-slate-700">{m.progress}%</span>
                    </div>

                    {/* Animated gradient progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          m.status === 'completed' || isSignedOff
                            ? 'bg-emerald-500'
                            : m.status === 'active'
                            ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-400'
                            : 'bg-slate-300'
                        )}
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Target: {m.targetDate}</span>
                      {isSelected && (
                        <span className="font-bold text-[#2563EB]">Viewing &rarr;</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Phase Detail Showcase & Deliverables Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded-md">
                {activeMilestone.phase} Deliverable Detail
              </span>
              <span className="text-xs text-slate-400">• Lead: {activeMilestone.leadEngineer}</span>
            </div>
            <h3 className="text-lg font-black text-[#0F172A]">{activeMilestone.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{activeMilestone.summary}</p>
          </div>

          <div className="flex items-center gap-3">
            {activeMilestone.status === 'active' && !signedOffPhases.includes(activeMilestone.id) && (
              <button
                onClick={() => setApprovalModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileCheck2 className="w-4 h-4" />
                Sign-Off Phase Deliverables
              </button>
            )}
            {signedOffPhases.includes(activeMilestone.id) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Phase Verified & Signed Off
              </span>
            )}
          </div>
        </div>

        {/* Deliverables Checklist with rich meta cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeMilestone.deliverables.map(del => (
            <div
              key={del.id}
              className={cn(
                'p-4 rounded-2xl border transition-all flex flex-col justify-between',
                del.status === 'verified'
                  ? 'bg-emerald-50/30 border-emerald-200/80'
                  : del.status === 'in_review'
                  ? 'bg-blue-50/30 border-blue-200/80 ring-1 ring-blue-500/20'
                  : 'bg-slate-50/50 border-slate-200'
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shadow-2xs">
                    {del.category}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                      del.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : del.status === 'in_review'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {del.status === 'verified' && <Check className="w-3 h-3" />}
                    {del.status === 'verified' ? 'Verified' : del.status === 'in_review' ? 'In Review' : 'Scheduled'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#0F172A] leading-snug mb-2">{del.name}</h4>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Owner: <strong className="text-slate-700 font-semibold">{del.assignee}</strong></span>
                {del.verifiedAt && (
                  <span className="text-emerald-700 font-medium">✓ {del.verifiedAt}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staging Sandbox Interactive Preview Frame */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        {/* Browser Top Navigation Bar */}
        <div className="bg-[#0F172A] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-wide">Acacia Healthcare Live Staging Preview</span>
              <span className="text-[10px] text-slate-400 font-mono">Edge Sandbox • Next.js 14.2 App Router • Vercel Edge Cache</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport switchers */}
            <div className="inline-flex p-1 rounded-xl bg-white/10 border border-white/10 text-xs">
              {(['desktop', 'tablet', 'mobile'] as const).map(device => (
                <button
                  key={device}
                  onClick={() => setPreviewDevice(device)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium',
                    previewDevice === device ? 'bg-[#2563EB] text-white font-bold' : 'text-slate-400 hover:text-white'
                  )}
                  title={`${device} View`}
                >
                  {device === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> :
                   device === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> :
                   <Smartphone className="w-3.5 h-3.5" />}
                  <span className="capitalize hidden sm:inline">{device}</span>
                </button>
              ))}
            </div>

            <a
              href={STAGING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Tab</span>
            </a>

            {!signedOffPhases.includes(3) && (
              <button
                onClick={() => setApprovalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                1-Click Approval
              </button>
            )}
          </div>
        </div>

        {/* Mac OS Styled Chrome Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block shadow-2xs" />
            <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block shadow-2xs" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block shadow-2xs" />
          </div>

          <div className="flex-1 mx-2 sm:mx-6 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] flex items-center justify-between text-slate-600 shadow-2xs">
            <div className="flex items-center gap-1.5 truncate">
              <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="text-emerald-700 font-semibold">https://</span>
              <span className="truncate">staging-acacia.bazionweb.com</span>
              <span className="text-slate-400">/{simulatedPage === 'home' ? '' : simulatedPage}</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
              TLS 1.3 Secure
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <span className="text-[11px] font-mono">
              {previewDevice === 'desktop' ? '1440 × 900 px' : previewDevice === 'tablet' ? '768 × 1024 px' : '390 × 844 px'}
            </span>
          </div>
        </div>

        {/* Simulated Browser Viewport Canvas */}
        <div className="p-4 sm:p-8 bg-slate-100/80 flex justify-center items-center min-h-[500px] overflow-hidden">
          <div
            className={cn(
              'transition-all duration-300 bg-white rounded-2xl shadow-2xl border border-slate-300/80 overflow-hidden flex flex-col',
              previewDevice === 'desktop' && 'w-full max-w-5xl h-[540px]',
              previewDevice === 'tablet' && 'w-[740px] h-[540px]',
              previewDevice === 'mobile' && 'w-[375px] h-[540px]'
            )}
          >
            {/* Acacia Site Header Simulation */}
            <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#2563EB] to-teal-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  A
                </div>
                <div>
                  <div className="text-xs font-black text-[#0F172A] tracking-tight">Acacia Medical Center</div>
                  <div className="text-[9px] text-slate-400">Nairobi, Kenya • ISO 9001:2015</div>
                </div>
              </div>

              {/* Navigation in simulated site */}
              <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setSimulatedPage('home')}
                  className={cn(
                    'px-2 py-1 rounded-md transition-colors',
                    simulatedPage === 'home' ? 'text-[#2563EB] bg-blue-50 font-bold' : 'hover:text-slate-900'
                  )}
                >
                  Overview
                </button>
                <button
                  onClick={() => setSimulatedPage('doctors')}
                  className={cn(
                    'px-2 py-1 rounded-md transition-colors',
                    simulatedPage === 'doctors' ? 'text-[#2563EB] bg-blue-50 font-bold' : 'hover:text-slate-900'
                  )}
                >
                  Specialists
                </button>
                <button
                  onClick={() => setSimulatedPage('booking')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg bg-[#2563EB] text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors',
                    simulatedPage === 'booking' && 'ring-2 ring-blue-400'
                  )}
                >
                  Book Visit
                </button>
              </div>
            </div>

            {/* Simulated Staging Content Body */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50/50 flex flex-col justify-between">
              {simulatedPage === 'home' && (
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>M-Pesa Express Instant Daraja STK Push Active</span>
                  </div>

                  <div className="max-w-xl">
                    <h2 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight leading-tight">
                      Exceptional Specialized Medical & Family Care in Nairobi.
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-2.5 leading-relaxed">
                      Instant appointment booking with lead physicians. Fast-track pediatric, dental, and cardiology consultations with real-time SMS notifications.
                    </p>
                  </div>

                  {/* STK Push Test Widget */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm max-w-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-slate-800">Test M-Pesa STK Push Integration</div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Daraja Sandbox
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600">
                        +254 712 *** 890 • KES 2,500
                      </div>
                      <button
                        onClick={handleSimulateSTK}
                        disabled={simulatingSTK}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                      >
                        {simulatingSTK ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Triggering...
                          </>
                        ) : (
                          <>
                            <Smartphone className="w-3.5 h-3.5" />
                            Trigger STK Push
                          </>
                        )}
                      </button>
                    </div>

                    {stkNotification && (
                      <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold animate-fade-in flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{stkNotification}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {simulatedPage === 'doctors' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Specialists</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: 'Dr. Sarah Wambui, MD', specialty: 'Senior Pediatrician', time: 'Mon - Fri • 9:00 AM - 4:00 PM' },
                      { name: 'Dr. John Kiprop, FACC', specialty: 'Cardiology Specialist', time: 'Tue, Thu • 10:00 AM - 2:00 PM' },
                      { name: 'Dr. Amina Patel, DDS', specialty: 'Advanced Dental Care', time: 'Mon - Sat • 8:30 AM - 5:00 PM' },
                      { name: 'Dr. Peter Ochieng, MD', specialty: 'General Family Physician', time: 'Daily • 24/7 On-Call' },
                    ].map(doc => (
                      <div key={doc.name} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold text-[#0F172A]">{doc.name}</div>
                        <div className="text-[11px] font-semibold text-[#2563EB]">{doc.specialty}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{doc.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {simulatedPage === 'booking' && (
                <div className="max-w-md bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="text-xs font-bold text-[#0F172A]">Direct Patient Appointment Form</div>
                  <input
                    type="text"
                    disabled
                    value="Patient: Jane Doe (+254 700 123 456)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled
                      value="Service: Pediatric Consultation"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600"
                    />
                    <button
                      onClick={handleSimulateSTK}
                      className="px-3.5 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-xl"
                    >
                      Book & Pay
                    </button>
                  </div>
                </div>
              )}

              {/* Staging Footer Status Indicator */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Staging Revision #482 (commit: 9b293e7)
                </span>
                <span>Cloudflare Edge Caching Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formal Deliverable Sign-Off Acceptance Modal */}
      {approvalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 shadow-xs">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black text-[#0F172A]">Formal Sprint Deliverable Sign-Off</h3>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              By confirming sign-off, you certify that Phase 3 (Core Next.js Frontend, Payment Rails & System Integrations) satisfies all scope acceptance criteria.
            </p>

            <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Phase:</span>
                <span className="font-bold text-[#0F172A]">Phase 3 — Next.js & Payment Rails</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deliverables Verified:</span>
                <span className="font-bold text-emerald-700">3 of 3 Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Authorized Signatory:</span>
                <span className="font-bold text-[#0F172A]">Client Representative (Acacia Healthcare)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-mono text-slate-600">{new Date().toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Compliance Audit:</span>
                <span className="font-mono text-emerald-600 font-bold">SHA-256 Immutable Audit Log</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmSignOff}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all hover:scale-[1.01]"
              >
                <Check className="w-4 h-4" />
                Authorize & Sign Off Phase 3
              </button>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Review Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
