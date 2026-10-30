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
  p1ResponseMinutes?: number | null;
  p2ResponseMinutes?: number | null;
  p3ResponseMinutes?: number | null;
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
    description: 'Peace-of-mind maintenance: monthly CMS updates, verified offsite backups, uptime monitoring, and 1 hour developer support.',
    features: ['Monthly CMS & Security Patch Updates', 'Verified Offsite Backups & Restore Drills', '24/7 Uptime & SSL Monitoring', '1 Hour Developer Support / Month', 'Monthly Digital Health Summary'],
    color: 'from-teal-600 to-emerald-600',
    accent: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  'care-business': {
    description: 'Proactive management with weekly update cycles, daily backups, WAF defense, SEO health audits, and 2 priority hours.',
    features: ['Everything in Care Essential', 'Weekly Updates & Compatibility Testing', 'Daily Automated Encrypted Backups', 'WAF Security & Core Web Vitals Tuning', 'Up to 2 Priority Engineering Hours / Month'],
    color: 'from-blue-600 to-indigo-600',
    accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  'care-professional': {
    description: 'Full digital engineering partnership with active code support, staging rollbacks, penetration monitoring, and 5 engineering hours.',
    features: ['Everything in Care Business', 'Proactive Security & Penetration Monitoring', 'On-Demand Staging Backups & Rollbacks', 'Up to 5 Dedicated Engineering Hours / Month', 'Priority Emergency Response (15-min P1 SLA)'],
    color: 'from-violet-600 to-purple-600',
    accent: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
  },
  'care-enterprise': {
    description: 'Dedicated SLA coverage for high-traffic e-commerce, SaaS, institutions, and portals with named account engineering.',
    features: ['Guaranteed 15-Minute P1 Incident Response', 'Dedicated Named Technical Account Manager', 'Disaster Recovery & Database Failover Drills', 'Dedicated Monthly Engineering Sprint Allocation', 'Quarterly Executive Architecture Reviews'],
    color: 'from-amber-600 to-orange-700',
    accent: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
};

export const DEFAULT_PLAN_SLUG = 'care-business';

const PLAN_CACHE_TTL_MS = 10 * 60 * 1000;
let planCache: { plans: ApiPlan[]; expiresAt: number } | null = null;
let planRequest: Promise<ApiPlan[]> | null = null;

async function fetchPlans(): Promise<ApiPlan[]> {
  if (planCache && planCache.expiresAt > Date.now()) return planCache.plans;
  if (planRequest) return planRequest;

  planRequest = fetch(`${resolveApiV1Base()}/plans`, {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not load plans');
      const list: ApiPlan[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
      if (!list.length) throw new Error('No active plans are configured');
      planCache = { plans: list, expiresAt: Date.now() + PLAN_CACHE_TTL_MS };
      return list;
    })
    .finally(() => {
      planRequest = null;
    });

  return planRequest;
}

export function planMarketing(slug: string): PlanMarketing {
  return PLAN_MARKETING[slug] ?? PLAN_MARKETING[DEFAULT_PLAN_SLUG];
}

export function usePlans() {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const list = await fetchPlans();
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
    };
  }, []);

  const bySlug = useMemo(
    () => Object.fromEntries(plans.map(plan => [plan.slug, plan])),
    [plans],
  );

  return { plans, bySlug, loading, error };
}
