'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Layers,
  FileText,
  Receipt,
  CreditCard,
  Rocket,
  Check,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type JourneyStepId = 'package' | 'proposal' | 'invoicing' | 'payment' | 'onboarding';

export interface JourneyStep {
  id: JourneyStepId;
  stepNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    id: 'package',
    stepNumber: 1,
    title: 'Package Selection',
    shortTitle: 'Packages',
    description: 'Tiers, add-ons & care plans',
    href: '/pricing',
    icon: Layers,
  },
  {
    id: 'proposal',
    stepNumber: 2,
    title: 'Scope & Proposal',
    shortTitle: 'Proposal',
    description: 'Custom deliverables & formal quotation',
    href: '/quote',
    icon: FileText,
  },
  {
    id: 'invoicing',
    stepNumber: 3,
    title: 'Kickoff Invoicing',
    shortTitle: 'Invoicing',
    description: '50/50 commercial milestone terms',
    href: '/portal/invoices',
    icon: Receipt,
  },
  {
    id: 'payment',
    stepNumber: 4,
    title: 'Secure Settlement',
    shortTitle: 'Payment',
    description: 'M-Pesa STK push or Card rails',
    href: '/checkout',
    icon: CreditCard,
  },
  {
    id: 'onboarding',
    stepNumber: 5,
    title: 'Client Workspace',
    shortTitle: 'Onboarding',
    description: 'Keys vault, domain & roadmap kickoff',
    href: '/portal',
    icon: Rocket,
  },
] as const;

export interface ClientJourneyProgressProps {
  /** Explicit step number (1 to 5). If omitted, inferred automatically from route/URL. */
  currentStep?: 1 | 2 | 3 | 4 | 5;
  /** Visual variant: 'dark' for dark-hero sections (#0F172A), 'light' for white/slate-50 pages. */
  variant?: 'dark' | 'light';
  /** Optional custom CSS classes. */
  className?: string;
  /** If true, allows clicking completed or current steps to navigate. Default true. */
  interactive?: boolean;
}

/**
 * Automatically infers the current journey step from pathname and query parameters.
 */
function inferStepFromPath(pathname: string, searchParams?: URLSearchParams | null): 1 | 2 | 3 | 4 | 5 {
  if (!pathname) return 1;

  // Step 5: Portal onboarding / dashboard
  if (pathname === '/portal' || pathname.startsWith('/portal/onboarding') || pathname.startsWith('/portal/roadmap')) {
    return 5;
  }

  // Step 4: Checkout & Payment
  if (pathname.startsWith('/checkout')) {
    return 4;
  }

  // Step 3: Portal invoices / Deposit billing
  if (pathname.startsWith('/portal/invoices')) {
    return 3;
  }

  // Step 2 or 3: /quote
  if (pathname.startsWith('/quote')) {
    const stage = searchParams?.get('stage');
    if (stage === 'deposit' || stage === 'invoiced') {
      return 3;
    }
    return 2;
  }

  // Step 1: Pricing, Services, Store, Cart, Solutions
  if (
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/solutions')
  ) {
    return 1;
  }

  return 1;
}

function ClientJourneyProgressInner({
  currentStep: propStep,
  variant = 'dark',
  className,
  interactive = true,
}: ClientJourneyProgressProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStep = propStep ?? inferStepFromPath(pathname, searchParams);
  const activeStepMeta = JOURNEY_STEPS[activeStep - 1] ?? JOURNEY_STEPS[0];
  const progressPercent = Math.round((activeStep / 5) * 100);

  const isDark = variant === 'dark';

  return (
    <nav
      aria-label="Client Journey Lifecycle Progress"
      className={cn(
        'w-full mx-auto select-none',
        className
      )}
    >
      {/* ─── Mobile View (< md screens) ─── */}
      <div
        className={cn(
          'md:hidden rounded-2xl p-4 border transition-colors',
          isDark
            ? 'bg-slate-900/80 border-white/10 text-white backdrop-blur-md'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center size-6 rounded-full text-xs font-extrabold',
                isDark ? 'bg-[#14B8A6] text-slate-950' : 'bg-teal-600 text-white'
              )}
            >
              {activeStep}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Stage {activeStep} of 5
            </span>
          </div>
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full',
              isDark ? 'bg-teal-500/10 text-[#14B8A6] border border-teal-500/20' : 'bg-teal-50 text-teal-700 border border-teal-200'
            )}
          >
            {progressPercent}% Complete
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-extrabold flex items-center gap-1.5">
              <activeStepMeta.icon className="size-4 text-[#14B8A6]" />
              <span>{activeStepMeta.title}</span>
            </div>
            <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {activeStepMeta.description}
            </p>
          </div>
          {activeStep < 5 && (
            <div className="text-right pl-3 shrink-0">
              <span className="text-[10px] text-slate-400 block">Next</span>
              <span className={cn('text-xs font-semibold flex items-center justify-end gap-0.5', isDark ? 'text-slate-200' : 'text-slate-700')}>
                {JOURNEY_STEPS[activeStep]?.shortTitle}
                <ChevronRight className="size-3 text-slate-400" />
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar Track */}
        <div className={cn('mt-3 h-1.5 w-full rounded-full overflow-hidden', isDark ? 'bg-white/10' : 'bg-slate-100')}>
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ─── Desktop View (>= md screens) ─── */}
      <div
        className={cn(
          'hidden md:block rounded-2xl p-3 border transition-colors shadow-xs',
          isDark
            ? 'bg-slate-900/60 border-white/10 backdrop-blur-md'
            : 'bg-white/95 border-slate-200/90'
        )}
      >
        <ol role="list" className="grid grid-cols-5 gap-2 items-center">
          {JOURNEY_STEPS.map((step) => {
            const isCompleted = step.stepNumber < activeStep;
            const isCurrent = step.stepNumber === activeStep;
            const isUpcoming = step.stepNumber > activeStep;

            const isClickable = interactive && (isCompleted || isCurrent);

            const StepContent = (
              <div
                className={cn(
                  'group relative flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left w-full',
                  isCurrent && (isDark
                    ? 'bg-white/10 border border-teal-400/40 shadow-md shadow-teal-500/10'
                    : 'bg-teal-50/80 border border-teal-500/40 shadow-xs'),
                  isCompleted && (isDark
                    ? 'hover:bg-white/5 border border-transparent'
                    : 'hover:bg-slate-50 border border-transparent'),
                  isUpcoming && 'opacity-50 border border-transparent cursor-not-allowed'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step Node Icon / Number */}
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-transform duration-200',
                    isCurrent && (isDark ? 'bg-[#14B8A6] text-slate-950 scale-105' : 'bg-teal-600 text-white scale-105'),
                    isCompleted && (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'),
                    isUpcoming && (isDark ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-400 border border-slate-200')
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4 stroke-[2.5]" aria-hidden="true" />
                  ) : (
                    <span>{step.stepNumber}</span>
                  )}
                </div>

                {/* Step Text Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs font-extrabold truncate',
                        isCurrent && (isDark ? 'text-white' : 'text-slate-900'),
                        isCompleted && (isDark ? 'text-slate-200' : 'text-slate-800'),
                        isUpcoming && (isDark ? 'text-slate-400' : 'text-slate-500')
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-[10px] leading-tight truncate mt-0.5',
                      isCurrent && (isDark ? 'text-teal-300 font-medium' : 'text-teal-700 font-medium'),
                      isCompleted && (isDark ? 'text-slate-400' : 'text-slate-500'),
                      isUpcoming && (isDark ? 'text-slate-500' : 'text-slate-400')
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={step.id} className="relative">
                {isClickable ? (
                  <Link href={step.href} className="block outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400 rounded-xl">
                    {StepContent}
                  </Link>
                ) : (
                  <div>{StepContent}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default function ClientJourneyProgress(props: ClientJourneyProgressProps) {
  return (
    <React.Suspense fallback={null}>
      <ClientJourneyProgressInner {...props} />
    </React.Suspense>
  );
}
