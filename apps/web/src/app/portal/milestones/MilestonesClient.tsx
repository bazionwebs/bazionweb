'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Check,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Milestone {
  id: number;
  title: string;
  phase: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  estimatedDate: string;
  deliverables: string[];
}

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

const STAGING_URL = 'https://staging-acacia.bazionweb.com';

export default function MilestonesClient() {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedSuccess, setApprovedSuccess] = useState(false);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mb-2">
                <div
                  className={cn(
                    'h-full rounded-full',
                    m.status === 'completed' ? 'bg-emerald-500' : 'bg-[#2563EB]',
                  )}
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400">{m.estimatedDate}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Deliverables Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projectMilestones.map(m => (
          <div key={m.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.phase}</span>
                <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">{m.title}</h4>
              </div>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                m.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                m.status === 'active' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-100 text-slate-600',
              )}>
                {m.status === 'completed' ? '✓ Complete' : m.status === 'active' ? `${m.progress}%` : 'Upcoming'}
              </span>
            </div>
            <ul className="space-y-2">
              {m.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle2 className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', m.status === 'completed' ? 'text-emerald-500' : m.status === 'active' ? 'text-blue-500' : 'text-slate-300')} />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Staging Sandbox Interactive Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-[#0F172A] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-sm">Live Staging Sandbox</span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">{STAGING_URL}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-lg bg-white/10 border border-white/10 text-xs">
              {(['desktop', 'tablet', 'mobile'] as const).map(device => (
                <button
                  key={device}
                  onClick={() => setPreviewDevice(device)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    previewDevice === device ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white',
                  )}
                  title={`${device.charAt(0).toUpperCase() + device.slice(1)} View`}
                >
                  {device === 'desktop' ? <Monitor className="w-4 h-4" /> :
                   device === 'tablet' ? <Tablet className="w-4 h-4" /> :
                   <Smartphone className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setApprovalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
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
                🔒 {STAGING_URL}
              </div>
            </div>

            {/* Simulated Staging Content */}
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

      {/* Approval Success Banner */}
      {approvedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Deliverable successfully signed off and recorded in compliance audit log.</span>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">Formal Deliverable Sign-Off</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              By approving, you verify that Phase 3 (Core Next.js Build & Payment Integrations) meets your acceptance criteria. An immutable audit record will be logged.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 mb-6">
              <div>Milestone: <strong>Phase 3 — Core Next.js Build</strong></div>
              <div>Timestamp: <strong>{new Date().toLocaleString()}</strong></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setApprovedSuccess(true);
                  setApprovalModalOpen(false);
                  setTimeout(() => setApprovedSuccess(false), 6000);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
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
    </div>
  );
}
