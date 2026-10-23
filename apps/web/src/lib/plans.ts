'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveApiV1Base } from '@/lib/api-base';

export interface ApiPlan {
  id: string;
  slug: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceAnnual: number;
  priceMonthlyKes: number;
  priceAnnualKes: number;
  currency: string;
  annualDiscountPct: number;
  uptimeSla?: string | null;
}

interface PlanMarketing {
  description: string;
  features: string[];
  color: string;
  accent: string;
}

/**
 * Presentation-only copy. IDs and prices always come from `GET /api/v1/plans`
 * so the catalog cannot drift from the seeded Plan pricebook.
 */
export const PLAN_MARKETING: Record<string, PlanMarketing> = {
  starter: {
    description: 'SSL, daily backups, and continuous monitoring. Everything to stay online reliably.',
    features: ['Cloud Deployment Configuration', 'Auto SSL Certificates', 'Daily Automated Backups', 'Continuous Uptime Checks', 'Email Support'],
    color: 'from-slate-600 to-slate-700',
    accent: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  },
  growth: {
    description: 'Adds full maintenance, WAF security management, and priority response to your stack.',
    features: ['Everything in Starter', 'Monthly Core & Plugin Updates', 'Web Application Firewall (WAF)', 'Malware Scanning & Cleanup', '30-Minute P1 Response Support'],
    color: 'from-blue-600 to-blue-700',
    accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  business: {
    description: 'Complete lifecycle management. Performance optimization, unlimited updates, strategy calls.',
    features: ['Everything in Growth', 'Unlimited Minor Content Updates', 'Core Web Vitals Optimization', 'Staging Environment Setup', '15-Minute P1 Response Support'],
    color: 'from-indigo-600 to-blue-700',
    accent: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
  },
  enterprise: {
    description: 'Custom coverage, dedicated account manager, quarterly reviews and security testing.',
    features: ['Dedicated Technical Account Manager', 'Priority High-Availability Monitoring', 'Quarterly Security Reviews', 'Annual Disaster Recovery Drills', 'Fast Urgent Escalation'],
    color: 'from-amber-600 to-orange-700',
    accent: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  'care-essential': {
    description: 'Ongoing care for your live site: updates, fixes, backups and monitoring.',
    features: ['Monthly Backend & Security Updates', 'Daily Automated Backups', 'Uptime Monitoring', 'Content Change Requests', '2 Business-Hour Support'],
    color: 'from-teal-600 to-emerald-600',
    accent: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  'care-business': {
    description: 'Priority care with security management and performance tuning.',
    features: ['Everything in Care Essential', 'Weekly Performance Reports', 'WAF & Malware Management', '4 Change Requests / Month', '4 Business-Hour Support'],
    color: 'from-blue-600 to-indigo-600',
    accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  'care-professional': {
    description: 'Dedicated priority care for business-critical platforms.',
    features: ['Everything in Care Business', 'Dedicated Account Manager', 'Quarterly Strategy Reviews', 'Unlimited Minor Updates', '1 Business-Hour Critical Support'],
    color: 'from-violet-600 to-purple-600',
    accent: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
  },
};

export const DEFAULT_PLAN_SLUG = 'growth';

export function planMarketing(slug: string): PlanMarketing {
  return PLAN_MARKETING[slug] ?? PLAN_MARKETING[DEFAULT_PLAN_SLUG];
}

export function usePlans() {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${resolveApiV1Base()}/plans`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'Could not load plans');
        const list: ApiPlan[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        if (!list.length) throw new Error('No active plans are configured');
        if (!cancelled) setPlans(list);
      } catch (err: unknown) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Could not load plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const bySlug = useMemo(
    () => Object.fromEntries(plans.map(plan => [plan.slug, plan])),
    [plans],
  );

  return { plans, bySlug, loading, error };
}
