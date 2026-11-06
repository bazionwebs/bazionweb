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
    description: '1. Website & Add-Ons · 2. Domain · 3. Hosting · 4. Care',
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
          'hidden md:block rounded-2xl p-4 border-2 transition-colors shadow-lg',
          isDark
            ? 'bg-[#0F172A] border-slate-700 text-white'
            : 'bg-white border-slate-300 text-slate-900'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#14B8A6] text-slate-950 shadow-xs">
              Step {activeStep} of 5
            </span>
            <span className={cn('text-xs font-bold tracking-wide', isDark ? 'text-slate-100' : 'text-slate-800')}>
              Unified Client Journey &amp; Mandatory Stack Flow:
            </span>
            <span className={cn('text-xs font-semibold hidden lg:inline', isDark ? 'text-teal-300' : 'text-teal-700')}>
              1. Website &amp; Add-Ons (Required) → 2. Domain (Required) → 3. Hosting (Required) → 4. Care Plan (Optional)
            </span>
          </div>
          <span
            className={cn(
              'text-xs font-extrabold px-3 py-1 rounded-full border',
              isDark
                ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
                : 'bg-teal-50 text-teal-800 border-teal-300'
            )}
          >
            {progressPercent}% Complete
          </span>
        </div>

        <ol role="list" className="grid grid-cols-5 gap-3 items-stretch">
          {JOURNEY_STEPS.map((step) => {
            const isCompleted = step.stepNumber < activeStep;
            const isCurrent = step.stepNumber === activeStep;
            const isUpcoming = step.stepNumber > activeStep;

            const isClickable = interactive && (isCompleted || isCurrent);

            const StepContent = (
              <div
                className={cn(
                  'group relative flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200 text-left w-full h-full border-2',
                  isCurrent && (isDark
                    ? 'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] border-[#14B8A6] text-white shadow-lg shadow-blue-600/30 ring-2 ring-[#14B8A6]/40'
                    : 'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] border-[#14B8A6] text-white shadow-md ring-2 ring-blue-500/30'),
                  isCompleted && (isDark
                    ? 'bg-emerald-950/90 border-emerald-400/70 text-white hover:bg-emerald-900/90'
                    : 'bg-emerald-50 border-emerald-400 text-slate-900 hover:bg-emerald-100/80'),
                  isUpcoming && (isDark
                    ? 'bg-slate-800/95 border-slate-600 text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-900')
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step Node Icon / Number */}
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-transform duration-200 shadow-xs',
                    isCurrent && 'bg-[#14B8A6] text-slate-950 scale-105 ring-2 ring-white/40',
                    isCompleted && 'bg-emerald-500 text-slate-950',
                    isUpcoming && (isDark
                      ? 'bg-slate-700 text-white border border-slate-500'
                      : 'bg-white text-slate-800 border border-slate-300')
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4 stroke-[3]" aria-hidden="true" />
                  ) : (
                    <span>{step.stepNumber}</span>
                  )}
                </div>

                {/* Step Text Metadata — High Contrast & Never Truncated */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs lg:text-sm font-extrabold leading-snug',
                        isCurrent && 'text-white',
                        isCompleted && (isDark ? 'text-emerald-100' : 'text-emerald-950'),
                        isUpcoming && (isDark ? 'text-white' : 'text-slate-900')
                      )}
                    >
                      {step.title}
                    </span>
                    {isCurrent && (
                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-[#14B8A6] text-slate-950">
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-[11px] leading-snug mt-1',
                      isCurrent && 'text-blue-100 font-medium',
                      isCompleted && (isDark ? 'text-emerald-200/90' : 'text-emerald-800'),
                      isUpcoming && (isDark ? 'text-slate-200' : 'text-slate-700')
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={step.id} className="relative h-full">
                {isClickable ? (
                  <Link href={step.href} className="block h-full outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400 rounded-xl">
                    {StepContent}
                  </Link>
                ) : (
                  <div className="h-full">{StepContent}</div>
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
