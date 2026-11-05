'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  UserCog,
  Globe,
  KeyRound,
  FolderKanban,
  Sparkles,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { portalApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export type OnboardingStepKey = 'profile' | 'domain' | 'vault' | 'roadmap';

export interface OnboardingChecklistProps {
  client?: {
    id?: string;
    businessName?: string | null;
    contactName?: string | null;
    phone?: string | null;
    onboardedAt?: string | null;
  } | null;
  hasAssets?: boolean;
  hasProjects?: boolean;
  onCompleted?: (onboardedAt: string) => void;
}

const VALID_STEPS: OnboardingStepKey[] = ['profile', 'domain', 'vault', 'roadmap'];

export function sanitizeOnboardingSteps(steps?: string[] | null): OnboardingStepKey[] {
  if (!Array.isArray(steps)) return [];
  const valid = new Set<string>(VALID_STEPS);
  return Array.from(new Set(steps.filter((s): s is OnboardingStepKey => typeof s === 'string' && valid.has(s))));
}

const CHECKLIST_ITEMS: Array<{
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'profile',
    title: 'Complete Organization Profile',
    description: 'Confirm your company details, primary technical contact, and KRA tax PIN for compliant invoicing.',
    href: '/portal/account',
    ctaLabel: 'Review Profile',
    icon: <UserCog className="w-4 h-4" />,
  },
  {
    key: 'domain',
    title: 'Connect Domain & DNS',
    description: 'Register or point your primary domain and inspect live SSL & nameserver health in Sovereign Assets.',
    href: '/portal/assets',
    ctaLabel: 'Configure Domain',
    icon: <Globe className="w-4 h-4" />,
  },
  {
    key: 'vault',
    title: 'Deposit Registrar Credentials in Encrypted Vault',
    description: 'Share registrar, DNS, or API keys using AES-256-GCM zero-plaintext vault encryption.',
    href: '/portal/vault',
    ctaLabel: 'Open Vault',
    icon: <KeyRound className="w-4 h-4" />,
  },
  {
    key: 'roadmap',
    title: 'Review Kickoff Roadmap & Milestones',
    description: 'Inspect your sprint delivery schedule, acceptance criteria, and milestone sign-offs.',
    href: '/portal/milestones',
    ctaLabel: 'View Roadmap',
    icon: <FolderKanban className="w-4 h-4" />,
  },
];

const STORAGE_KEY_PREFIX = 'bazionweb-onboarding-steps';

export default function ClientOnboardingChecklist({
  client,
  hasAssets = false,
  hasProjects = false,
  onCompleted,
}: OnboardingChecklistProps) {
  const queryClient = useQueryClient();
  const storageKey = client?.id ? `${STORAGE_KEY_PREFIX}:${client.id}` : STORAGE_KEY_PREFIX;

  const [completedSteps, setCompletedSteps] = useState<OnboardingStepKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [localOnboardedAt, setLocalOnboardedAt] = useState<string | null>(client?.onboardedAt ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client?.onboardedAt) {
      setLocalOnboardedAt(client.onboardedAt);
    }
  }, [client?.onboardedAt]);

  useEffect(() => {
    const autoDetected: OnboardingStepKey[] = [];
    if (client?.businessName && client?.contactName && client?.phone) {
      autoDetected.push('profile');
    }
    if (hasAssets) {
      autoDetected.push('domain');
    }
    if (hasProjects) {
      autoDetected.push('roadmap');
    }

    let stored: OnboardingStepKey[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          stored = sanitizeOnboardingSteps(JSON.parse(raw));
        }
      } catch {
        // Ignore storage read errors
      }
    }

    setCompletedSteps(prev => sanitizeOnboardingSteps([...prev, ...stored, ...autoDetected]));
  }, [client?.businessName, client?.contactName, client?.phone, hasAssets, hasProjects, storageKey]);

  const toggleStep = (step: OnboardingStepKey) => {
    setCompletedSteps(prev => {
      const next = prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step];
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Ignore storage write errors
        }
      }
      return next;
    });
  };

  const handleCompleteOnboarding = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const stepsToSubmit = completedSteps.length > 0 ? completedSteps : VALID_STEPS;
      const res = await portalApi.markOnboarded(stepsToSubmit);
      const payload = res?.data ?? res;
      const timestamp = payload?.onboardedAt || new Date().toISOString();
      setLocalOnboardedAt(timestamp);
      onCompleted?.(timestamp);
      await queryClient.invalidateQueries({ queryKey: ['portal', 'client'] });
    } catch {
      setError('Could not save onboarding status right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (localOnboardedAt || client?.onboardedAt) {
    return null;
  }

  const completedCount = completedSteps.length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section
      aria-label="Client Onboarding Checklist"
      className="bg-white rounded-3xl border border-blue-200/80 shadow-sm overflow-hidden"
    >
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-teal-50/60 px-6 py-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600/10 text-[#2563EB] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Workspace Kickoff Guide
          </div>
          <h3 className="text-lg font-extrabold text-[#0F172A]">
            Complete Your Client Onboarding ({completedCount}/{totalCount})
          </h3>
          <p className="text-xs text-slate-600">
            Follow these four quick steps to connect your infrastructure and launch engineering delivery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-32 bg-slate-200/80 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-[#0F172A] tabular-nums">{progressPct}%</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHECKLIST_ITEMS.map(item => {
          const isDone = completedSteps.includes(item.key);
          return (
            <div
              key={item.key}
              className={cn(
                'rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3',
                isDone
                  ? 'bg-emerald-50/40 border-emerald-200/80'
                  : 'bg-slate-50/60 border-slate-200/80 hover:border-blue-300',
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleStep(item.key)}
                  aria-label={`Mark "${item.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                  className={cn(
                    'mt-0.5 shrink-0 rounded-full transition-colors',
                    isDone ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-[#2563EB]',
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', isDone ? 'text-emerald-900 line-through' : 'text-[#0F172A]')}>
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pl-8 pt-1">
                <button
                  type="button"
                  onClick={() => toggleStep(item.key)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {isDone ? 'Completed' : 'Mark as done'}
                </button>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-blue-700"
                >
                  {item.ctaLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-6 pb-3 text-xs font-semibold text-rose-600">{error}</div>
      )}

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>You can revisit any of these settings at any time from your sidebar navigation.</span>
        </div>

        <button
          type="button"
          onClick={handleCompleteOnboarding}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Complete Onboarding
            </>
          )}
        </button>
      </div>
    </section>
  );
}

