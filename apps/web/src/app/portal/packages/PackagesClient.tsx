'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ShieldCheck,
  Server,
  Layers,
  Puzzle,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Building2,
  Loader2,
  AlertCircle,
  X,
  ArrowRight,
  Globe,
  ShoppingBag,
  Cpu,
  Clock,
  Plus,
  Minus,
  FileText,
  Check,
} from 'lucide-react';
import {
  WEBSITE_PACKAGES,
  ECOMMERCE_PACKAGES,
  CUSTOM_SYSTEM_TIERS,
  MANAGED_HOSTING_PLANS,
  ADD_ON_RATE_CARD,
  HOURLY_SUPPORT_RATES,
  type WebsitePlan,
  type EcommercePlan,
  type CustomSystemTier,
  type HostingPlan,
  type AddOnItem,
} from '@/lib/pricingData';
import { usePlans, planMarketing, type ApiPlan } from '@/lib/plans';
import { formatCurrency, getPriceBookForMarket } from '@/lib/priceBooks';
import { formatMoney } from '@/lib/format';
import { useMarketPreference } from '@/hooks/useMarketPreference';
import {
  useClientProfile,
  useClientProjects,
  useClientHosting,
  useCreateTicket,
} from '@/hooks/usePortalData';
import { useAuthStore } from '@/store/auth.store';
import { resolveApiV1Base } from '@/lib/api-base';
import { cn, isTrustedCheckoutUrl } from '@/lib/utils';

type CatalogTab = 'care' | 'builds' | 'hosting' | 'addons';
type Cycle = 'MONTHLY' | 'ANNUAL';
type CarePayMethod = 'MPESA' | 'CARD' | 'WIRE';
type BuildFamily = 'websites' | 'ecommerce' | 'custom';

interface FixedBuildTarget {
  packageType: string;
  name: string;
  familyLabel: string;
  kenyaPrice: string;
  intlPrice: string;
  includedScale: string;
  supportWindow: string;
  supportsExtraPages: boolean;
}

export default function PackagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const accessToken = useAuthStore(s => s.accessToken);
  const setSubscriptionStatus = useAuthStore(s => s.setSubscriptionStatus);
  const apiBase = resolveApiV1Base();

  const { data: client } = useClientProfile();
  const { data: projects = [] } = useClientProjects();
  const { data: hostingAccounts = [] } = useClientHosting();
  const createTicket = useCreateTicket();

  const { marketCode } = useMarketPreference();
  const { plans, loading: plansLoading, error: plansError } = usePlans();

  const isKenya = marketCode === 'KE';
  const activeCurrency = isKenya ? 'KES' : 'USD';
  const priceBook = useMemo(() => getPriceBookForMarket(isKenya ? 'KE' : 'GLOBAL'), [isKenya]);

  // ── Active Tab synced with ?tab= query param ──────────────────────────────
  const initialTab = (searchParams.get('tab') as CatalogTab) || 'care';
  const validTabs: CatalogTab[] = ['care', 'builds', 'hosting', 'addons'];
  const [activeTab, setActiveTab] = useState<CatalogTab>(
    validTabs.includes(initialTab) ? initialTab : 'care',
  );

  useEffect(() => {
    const paramTab = searchParams.get('tab') as CatalogTab | null;
    if (paramTab && validTabs.includes(paramTab)) {
      setActiveTab(paramTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const switchTab = (nextTab: CatalogTab) => {
    setActiveTab(nextTab);
    router.replace(`/portal/packages?tab=${nextTab}`, { scroll: false });
  };

  const activeSubscription = client?.subscriptions?.[0];
  const activeProject = projects[0];

  // ── Cloud Care State & Checkout Drawer ────────────────────────────────────
  const [careCycle, setCareCycle] = useState<Cycle>('MONTHLY');
  const [selectedCarePlan, setSelectedCarePlan] = useState<ApiPlan | null>(null);
  const [carePayMethod, setCarePayMethod] = useState<CarePayMethod>(isKenya ? 'MPESA' : 'CARD');
  const [carePhone, setCarePhone] = useState('');
  const [careEmail, setCareEmail] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [careSubmitting, setCareSubmitting] = useState(false);
  const [careFeedback, setCareFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    msg: string;
  } | null>(null);
  const [careWireInvoice, setCareWireInvoice] = useState<{
    invoiceNumber: string;
    amount: number;
    currency: string;
    bankDetails?: Record<string, string>;
  } | null>(null);
  const [careStkAttempt, setCareStkAttempt] = useState<{
    trackingId: string;
    invoiceNumber: string;
  } | null>(null);
  const [carePayStatus, setCarePayStatus] = useState<'IDLE' | 'AWAITING' | 'CONFIRMED' | 'FAILED'>(
    'IDLE',
  );
  const carePollRef = useRef(0);

  useEffect(() => {
    if (client?.phone && !carePhone) setCarePhone(client.phone);
    if (client?.email && !careEmail) setCareEmail(client.email);
  }, [client?.phone, client?.email, carePhone, careEmail]);

  useEffect(() => {
    if (!isKenya && carePayMethod === 'MPESA') {
      setCarePayMethod('CARD');
    }
  }, [isKenya, carePayMethod]);

  // Poll M-Pesa settlement for Care Subscription
  useEffect(() => {
    if (!careStkAttempt || carePayStatus !== 'AWAITING') return;
    let cancelled = false;

    const poll = async () => {
      carePollRef.current += 1;
      try {
        const res = await fetch(
          `${apiBase}/invoices/payments/${encodeURIComponent(careStkAttempt.trackingId)}/status`,
          { cache: 'no-store' },
        );
        const body = await res.json().catch(() => ({}));
        const payload = body?.data ?? body;
        const status = String(payload?.status || '').toUpperCase();

        if (cancelled) return;
        if (status === 'SUCCESS') {
          setCarePayStatus('CONFIRMED');
          setSubscriptionStatus('ACTIVE');
          queryClient.invalidateQueries({ queryKey: ['portal'] });
          setCareFeedback({
            type: 'success',
            msg: 'Payment settled! Your Cloud Care plan is now active.',
          });
          return;
        }
        if (status === 'FAILED') {
          setCarePayStatus('FAILED');
          setCareFeedback({
            type: 'error',
            msg: 'M-Pesa prompt was cancelled or timed out. You may retry below.',
          });
          return;
        }
      } catch {
        // Ignore transient poll failure
      }

      if (cancelled) return;
      if (carePollRef.current >= 40) {
        setCarePayStatus('FAILED');
        setCareFeedback({
          type: 'error',
          msg: 'Confirmation timed out. Check Invoices & Cloud Care if you entered your PIN.',
        });
        return;
      }
      setTimeout(poll, 3000);
    };

    const timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [careStkAttempt, carePayStatus, apiBase, queryClient, setSubscriptionStatus]);

  const openCareCheckout = (plan: ApiPlan) => {
    setSelectedCarePlan(plan);
    setCarePayMethod(isKenya ? 'MPESA' : 'CARD');
    setCareFeedback(null);
    setCareWireInvoice(null);
    setCareStkAttempt(null);
    setCarePayStatus('IDLE');
  };

  async function handleCareMpesa(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCarePlan || !accessToken) return;
    setCareSubmitting(true);
    setCareFeedback(null);
    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/mpesa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planId: selectedCarePlan.id,
          billingCycle: careCycle,
          mpesaPhoneNumber: carePhone.replace(/[^0-9+]/g, ''),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'M-Pesa initialization failed');
      const trackingId = data.trackingId ?? body.trackingId;
      const invoiceNumber = String(data.invoiceNumber || body.invoiceNumber || 'Invoice');
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
      setCareFeedback({
        type: 'info',
        msg: `STK Push sent for ${invoiceNumber}. Enter your M-Pesa PIN on your handset.`,
      });
      if (trackingId) {
        carePollRef.current = 0;
        setCareStkAttempt({ trackingId: String(trackingId), invoiceNumber });
        setCarePayStatus('AWAITING');
      }
    } catch (err: unknown) {
      setCareFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Could not initiate M-Pesa prompt.',
      });
    } finally {
      setCareSubmitting(false);
    }
  }

  async function handleCareCard() {
    if (!selectedCarePlan || !accessToken) return;
    setCareSubmitting(true);
    setCareFeedback(null);
    try {
      const res = await fetch(`${apiBase}/invoices/subscribe/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planId: selectedCarePlan.id,
          billingCycle: careCycle,
          currency: isKenya ? 'KES' : 'USD',
          ...(careEmail.trim() ? { email: careEmail.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Card gateway error');
      if (data.checkoutUrl && isTrustedCheckoutUrl(data.checkoutUrl)) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('Card gateway did not return a checkout URL.');
    } catch (err: unknown) {
      setCareFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Card gateway error.',
      });
      setCareSubmitting(false);
    }
  }

  async function handleCareWire(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCarePlan || !accessToken) return;
    setCareSubmitting(true);
    setCareFeedback(null);
    try {
      const res = await fetch(`${apiBase}/invoices/corporate-invoice/bank-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planId: selectedCarePlan.id,
          billingCycle: careCycle,
          currency: isKenya ? 'KES' : 'USD',
          ...(poNumber.trim() ? { purchaseOrderNumber: poNumber.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Could not generate invoice');
      const inv = data.invoice ?? data;
      setCareWireInvoice({
        invoiceNumber: String(inv.invoiceNumber || data.invoiceNumber || 'Generated'),
        amount: Number(inv.amount || data.amount || 0),
        currency: String(inv.currency || (isKenya ? 'KES' : 'USD')),
        bankDetails: data.bankDetails,
      });
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
      setCareFeedback({
        type: 'success',
        msg: 'Official corporate proforma invoice generated and added to your billing statements.',
      });
    } catch (err: unknown) {
      setCareFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Could not generate bank transfer invoice.',
      });
    } finally {
      setCareSubmitting(false);
    }
  }

  // ── Builds Sub-filter & In-Dashboard Configurator State ───────────────────
  const [buildFamily, setBuildFamily] = useState<BuildFamily>('websites');
  const [configBuild, setConfigBuild] = useState<FixedBuildTarget | null>(null);
  const [extraPages, setExtraPages] = useState(0);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [buildHosting, setBuildHosting] = useState<string>('none');
  const [rushBuild, setRushBuild] = useState(false);
  const [lockedProposal, setLockedProposal] = useState<{
    proposalCode: string;
    invoiceNumber: string;
    totalAmount: number;
    depositAmount: number;
    currency: string;
  } | null>(null);
  const [buildPayTab, setBuildPayTab] = useState<'MPESA' | 'CARD'>(isKenya ? 'MPESA' : 'CARD');
  const [buildPhone, setBuildPhone] = useState('');
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildFeedback, setBuildFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    msg: string;
  } | null>(null);
  const [buildStkAttempt, setBuildStkAttempt] = useState<{
    trackingId: string;
    invoiceNumber: string;
  } | null>(null);
  const [buildPayStatus, setBuildPayStatus] = useState<
    'IDLE' | 'AWAITING' | 'CONFIRMED' | 'FAILED'
  >('IDLE');
  const buildPollRef = useRef(0);

  useEffect(() => {
    if (client?.phone && !buildPhone) setBuildPhone(client.phone);
  }, [client?.phone, buildPhone]);

  useEffect(() => {
    if (!isKenya && buildPayTab === 'MPESA') setBuildPayTab('CARD');
  }, [isKenya, buildPayTab]);

  // Poll M-Pesa settlement for Build Kickoff Deposit -> auto-provisions Project & 5 Milestones!
  useEffect(() => {
    if (!buildStkAttempt || buildPayStatus !== 'AWAITING') return;
    let cancelled = false;

    const poll = async () => {
      buildPollRef.current += 1;
      try {
        const res = await fetch(
          `${apiBase}/invoices/payments/${encodeURIComponent(buildStkAttempt.trackingId)}/status`,
          { cache: 'no-store' },
        );
        const body = await res.json().catch(() => ({}));
        const payload = body?.data ?? body;
        const status = String(payload?.status || '').toUpperCase();

        if (cancelled) return;
        if (status === 'SUCCESS') {
          setBuildPayStatus('CONFIRMED');
          queryClient.invalidateQueries({ queryKey: ['portal'] });
          setBuildFeedback({
            type: 'success',
            msg: 'Kickoff deposit confirmed! Your project delivery roadmap has been provisioned.',
          });
          return;
        }
        if (status === 'FAILED') {
          setBuildPayStatus('FAILED');
          setBuildFeedback({
            type: 'error',
            msg: 'M-Pesa prompt was not completed. Retry below or settle from Invoices.',
          });
          return;
        }
      } catch {
        // Ignore transient network error
      }

      if (cancelled) return;
      if (buildPollRef.current >= 40) {
        setBuildPayStatus('FAILED');
        setBuildFeedback({
          type: 'error',
          msg: 'Confirmation timed out. Your deposit invoice is saved in Invoices & Cloud Care.',
        });
        return;
      }
      setTimeout(poll, 3000);
    };

    const timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildStkAttempt, buildPayStatus, apiBase, queryClient]);

  const openFixedBuildConfigurator = (target: FixedBuildTarget) => {
    setConfigBuild(target);
    setExtraPages(0);
    setSelectedAddOns([]);
    setBuildHosting('none');
    setRushBuild(false);
    setLockedProposal(null);
    setBuildFeedback(null);
    setBuildStkAttempt(null);
    setBuildPayStatus('IDLE');
    setBuildPayTab(isKenya ? 'MPESA' : 'CARD');
  };

  // Live canonical calculation using priceBooks.ts (matches /api/quote & NestJS PricingService 100%)
  const buildEstimate = useMemo(() => {
    if (!configBuild) return null;
    const pkgMap: Record<string, string> = {
      launch: 'website-launch',
      business: 'website-business',
      professional: 'website-professional',
      'ecom-starter': 'ecommerce-starter',
      'ecom-business': 'ecommerce-business',
    };
    const productKey = pkgMap[configBuild.packageType] ?? 'website-business';
    const baseCost = priceBook.items[productKey]?.amount ?? 0;
    const extraPageRate = priceBook.items['rate-extra-page']?.amount ?? (isKenya ? 2000 : 40);
    const pagesCost = configBuild.supportsExtraPages ? extraPages * extraPageRate : 0;

    let addOnsCost = 0;
    for (const id of selectedAddOns) {
      const item = ADD_ON_RATE_CARD.find(a => a.id === id);
      if (item) addOnsCost += isKenya ? item.rawKes : item.rawUsd;
    }

    const subtotal = baseCost + pagesCost + addOnsCost;
    const rushSurcharge = rushBuild ? Math.round(subtotal * 0.25) : 0;
    const totalBuild = subtotal + rushSurcharge;

    const hostMap: Record<string, string> = {
      'host-essential': 'host-essential',
      'host-business': 'host-business',
      'host-professional': 'host-pro',
    };
    const hostCost =
      buildHosting !== 'none'
        ? priceBook.items[hostMap[buildHosting] ?? '']?.amount ?? 0
        : 0;

    const deposit50 = Math.round(totalBuild * 0.5 * 100) / 100;

    return {
      baseCost,
      pagesCost,
      addOnsCost,
      rushSurcharge,
      totalBuild,
      hostCost,
      deposit50,
    };
  }, [configBuild, priceBook, isKenya, extraPages, selectedAddOns, rushBuild, buildHosting]);

  async function handleLockProposalAndCreateDeposit() {
    if (!configBuild || !client) return;
    setBuildBusy(true);
    setBuildFeedback(null);
    try {
      const nameParts = (client.contactName || client.businessName || 'Valued Client')
        .trim()
        .split(/\s+/);
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'Client';

      const quoteRes = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCountry: isKenya ? 'KE' : client.country || 'US',
          packageType: configBuild.packageType,
          extraPages: configBuild.supportsExtraPages ? extraPages : 0,
          selectedAddOns,
          rushDelivery: rushBuild,
          care: 'none',
          hosting: buildHosting,
          clientName: client.contactName || client.businessName,
          clientEmail: client.email,
          clientCompany: client.businessName,
        }),
      });
      const quoteBody = await quoteRes.json().catch(() => ({}));
      if (!quoteRes.ok || !quoteBody?.proposalCode) {
        throw new Error(quoteBody?.error || 'Could not generate locked proposal.');
      }

      const acceptRes = await fetch(
        `${apiBase}/invoices/proposals/${encodeURIComponent(quoteBody.proposalCode)}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: quoteBody.proposalCode,
            email: client.email,
            firstName,
            lastName,
            businessName: client.businessName,
            ...(client.phone ? { phone: client.phone.replace(/[^0-9+]/g, '') } : {}),
          }),
        },
      );
      const acceptBody = await acceptRes.json().catch(() => ({}));
      const acceptData = acceptBody?.data ?? acceptBody;
      if (!acceptRes.ok) {
        throw new Error(
          acceptData?.message || acceptBody?.message || 'Could not generate kickoff deposit invoice.',
        );
      }

      const inv = acceptData.invoice ?? acceptData;
      setLockedProposal({
        proposalCode: String(quoteBody.proposalCode),
        invoiceNumber: String(inv.invoiceNumber || acceptData.invoiceNumber || 'Deposit Invoice'),
        totalAmount: Number(quoteBody?.totals?.totalBuild || buildEstimate?.totalBuild || 0),
        depositAmount: Number(inv.amount || acceptData.depositAmount || buildEstimate?.deposit50 || 0),
        currency: String(inv.currency || activeCurrency),
      });
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
      setBuildFeedback({
        type: 'info',
        msg: `Proposal ${quoteBody.proposalCode} locked! Settle the 50% kickoff deposit below to launch your roadmap.`,
      });
    } catch (err: unknown) {
      setBuildFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to lock proposal.',
      });
    } finally {
      setBuildBusy(false);
    }
  }

  async function handlePayBuildMpesa(e: React.FormEvent) {
    e.preventDefault();
    if (!lockedProposal) return;
    setBuildBusy(true);
    setBuildFeedback(null);
    try {
      const res = await fetch(
        `${apiBase}/invoices/proposals/${encodeURIComponent(lockedProposal.proposalCode)}/pay/mpesa`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mpesaPhoneNumber: buildPhone.replace(/[^0-9+]/g, ''),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'M-Pesa prompt failed');
      const trackingId = data.trackingId ?? body.trackingId;
      setBuildFeedback({
        type: 'info',
        msg: `M-Pesa STK Push sent for ${lockedProposal.invoiceNumber}. Enter your PIN on your phone.`,
      });
      if (trackingId) {
        buildPollRef.current = 0;
        setBuildStkAttempt({
          trackingId: String(trackingId),
          invoiceNumber: lockedProposal.invoiceNumber,
        });
        setBuildPayStatus('AWAITING');
      }
    } catch (err: unknown) {
      setBuildFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Could not initiate M-Pesa deposit.',
      });
    } finally {
      setBuildBusy(false);
    }
  }

  async function handlePayBuildCard() {
    if (!lockedProposal || !client) return;
    setBuildBusy(true);
    setBuildFeedback(null);
    try {
      const res = await fetch(
        `${apiBase}/invoices/proposals/${encodeURIComponent(lockedProposal.proposalCode)}/pay/card`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: client.email }),
        },
      );
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (!res.ok) throw new Error(data.message || body.message || 'Card checkout failed');
      if (data.checkoutUrl && isTrustedCheckoutUrl(data.checkoutUrl)) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('Card gateway did not return a redirect URL.');
    } catch (err: unknown) {
      setBuildFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Card checkout failed.',
      });
      setBuildBusy(false);
    }
  }

  // ── In-Dashboard Scope / Hosting / Add-On Ticket Request Modal ────────────
  const [scopeRequestModal, setScopeRequestModal] = useState<{
    kind: 'CUSTOM_BUILD' | 'HOSTING' | 'ADDON';
    title: string;
    priceLabel: string;
    category: 'DEVELOPMENT' | 'HOSTING';
    subtitle: string;
  } | null>(null);
  const [reqDomain, setReqDomain] = useState('');
  const [reqNeedMigration, setReqNeedMigration] = useState(true);
  const [reqNotes, setReqNotes] = useState('');
  const [reqFeedback, setReqFeedback] = useState<string | null>(null);

  const openScopeModal = (opts: {
    kind: 'CUSTOM_BUILD' | 'HOSTING' | 'ADDON';
    title: string;
    priceLabel: string;
    category: 'DEVELOPMENT' | 'HOSTING';
    subtitle: string;
  }) => {
    setScopeRequestModal(opts);
    setReqDomain(hostingAccounts[0]?.domain ?? '');
    setReqNeedMigration(true);
    setReqNotes('');
    setReqFeedback(null);
  };

  async function handleSubmitScopeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!scopeRequestModal) return;
    setReqFeedback(null);

    const lines = [
      `In-Portal Commercial Request: ${scopeRequestModal.title}`,
      `Authoritative Price Book: ${priceBook.id} (${scopeRequestModal.priceLabel})`,
      activeProject ? `Linked Active Project: ${activeProject.name}` : null,
      scopeRequestModal.kind === 'HOSTING' && reqDomain.trim()
        ? `Target Domain: ${reqDomain.trim()}`
        : null,
      scopeRequestModal.kind === 'HOSTING'
        ? `Zero-Downtime Migration Needed: ${reqNeedMigration ? 'Yes' : 'No (Fresh Setup)'}`
        : null,
      '',
      'Client Notes / Scope Brief:',
      reqNotes.trim() || 'Please provision and issue milestone/service confirmation in my workspace.',
    ]
      .filter(v => v !== null)
      .join('\n');

    try {
      const res = await createTicket.mutateAsync({
        subject: `[Workspace Order] ${scopeRequestModal.title} (${scopeRequestModal.priceLabel})`,
        priority: 'P2',
        category: scopeRequestModal.category,
        body: lines,
      });
      const created = res?.data ?? res;
      setScopeRequestModal(null);
      if (created?.id) {
        router.push(`/portal/support?ticket=${encodeURIComponent(created.id)}`);
      } else {
        router.push('/portal/support');
      }
    } catch (err: unknown) {
      setReqFeedback(
        err instanceof Error ? err.message : 'Could not dispatch request. Please try again.',
      );
    }
  }

  // ── Add-ons filter ────────────────────────────────────────────────────────
  const [addonCategory, setAddonCategory] = useState<string>('all');
  const filteredAddons = useMemo(() => {
    const fixedItems = ADD_ON_RATE_CARD.filter(a => a.id !== 'rush-delivery');
    if (addonCategory === 'all') return fixedItems;
    return fixedItems.filter(a => a.category === addonCategory);
  }, [addonCategory]);

  const toFixedBuildFromWebsite = (pkg: WebsitePlan): FixedBuildTarget | null => {
    if (pkg.id === 'corporate') return null;
    return {
      packageType: pkg.id,
      name: `${pkg.name} Website`,
      familyLabel: 'Website Engineering',
      kenyaPrice: pkg.kenyaPrice,
      intlPrice: pkg.intlPrice,
      includedScale: pkg.pages,
      supportWindow: pkg.support,
      supportsExtraPages: true,
    };
  };

  const toFixedBuildFromEcommerce = (pkg: EcommercePlan): FixedBuildTarget | null => {
    if (pkg.id === 'ecom-pro') return null;
    return {
      packageType: pkg.id,
      name: pkg.name,
      familyLabel: 'E-Commerce Storefront',
      kenyaPrice: pkg.kenyaPrice,
      intlPrice: pkg.intlPrice,
      includedScale: pkg.products,
      supportWindow: pkg.support,
      supportsExtraPages: false,
    };
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-14">
      {/* ── Workspace Commercial Header ──────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>In-Portal Commercial Catalog · Price Book {priceBook.id}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Packages, Cloud Care &amp; Upgrades
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Activate SLA Cloud Care retainers, commission new Website or E-Commerce builds with instant 50% deposit provisioning, or attach Managed Hosting &amp; Add-Ons — right inside your workspace with verified single-source pricing.
            </p>
          </div>

          {/* Read-Only Market Status Badge */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 self-start lg:self-auto shrink-0 select-none">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1">
              Billing Price Book
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
              <span>{isKenya ? '🇰🇪 Kenya (KSh)' : '🌐 International (USD)'}</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-12 -bottom-12 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── Primary Catalog Tabs ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 grid grid-cols-2 lg:grid-cols-4 gap-1.5 shadow-xs">
        {[
          { id: 'care' as const, label: 'Cloud Care & SLA', sub: 'Monthly / Annual Retainers', icon: ShieldCheck },
          { id: 'builds' as const, label: 'Websites & Systems', sub: 'Builds & E-Commerce', icon: Layers },
          { id: 'hosting' as const, label: 'Managed Hosting', sub: 'NVMe, SSL & Cloud', icon: Server },
          { id: 'addons' as const, label: 'Modular Add-Ons', sub: 'Features & Hourly Desk', icon: Puzzle },
        ].map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                active
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]',
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  active ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                <t.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">{t.label}</div>
                <div
                  className={cn(
                    'text-[10px] truncate',
                    active ? 'text-slate-300' : 'text-slate-400',
                  )}
                >
                  {t.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: CLOUD CARE & SLA RETAINERS (Live from GET /api/v1/plans)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'care' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Managed Cloud Care &amp; Engineering Retainers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Proactive security patching, verified S3 backups, 24/7 uptime monitoring, and monthly developer hours.
              </p>
            </div>

            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCareCycle('MONTHLY')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                  careCycle === 'MONTHLY'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCareCycle('ANNUAL')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  careCycle === 'ANNUAL'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <span>Annual</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  Save 10%
                </span>
              </button>
            </div>
          </div>

          {plansLoading ? (
            <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span className="text-xs">Loading live SLA plans…</span>
            </div>
          ) : plansError ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{plansError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {plans.map(plan => {
                const mkt = planMarketing(plan.slug);
                const isCurrentPlan =
                  activeSubscription?.status === 'ACTIVE' &&
                  activeSubscription?.plan?.id === plan.id;
                const isPopular = plan.slug === 'care-business';
                const amount =
                  careCycle === 'ANNUAL'
                    ? isKenya
                      ? plan.priceAnnualKes
                      : plan.priceAnnual
                    : isKenya
                      ? plan.priceMonthlyKes
                      : plan.priceMonthly;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'bg-white rounded-3xl p-6 border flex flex-col justify-between transition-all shadow-xs relative',
                      isCurrentPlan
                        ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                        : isPopular
                          ? 'border-[#2563EB] ring-2 ring-blue-500/10'
                          : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {plan.uptimeSla ? `${plan.uptimeSla}% SLA` : plan.tier}
                        </span>
                        {isCurrentPlan ? (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Current Plan
                          </span>
                        ) : isPopular ? (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Most Popular
                          </span>
                        ) : null}
                      </div>

                      <h4 className="text-lg font-black text-[#0F172A]">{plan.name}</h4>
                      <div className="mt-3 mb-2">
                        <span className="text-2xl font-black text-[#0F172A]">
                          {formatCurrency(amount, activeCurrency)}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold ml-1">
                          /{careCycle === 'ANNUAL' ? 'year' : 'month'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        {mkt.description}
                      </p>

                      <ul className="space-y-2 border-t border-slate-100 pt-4 mb-6">
                        {mkt.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCareCheckout(plan)}
                      className={cn(
                        'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                        isCurrentPlan
                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                          : isPopular
                            ? 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm'
                            : 'bg-[#0F172A] hover:bg-slate-800 text-white',
                      )}
                    >
                      <span>
                        {isCurrentPlan
                          ? 'Renew / Switch Billing Cycle'
                          : activeSubscription
                            ? `Switch to ${plan.name}`
                            : `Activate ${plan.name}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: WEBSITES, E-COMMERCE & CUSTOM SYSTEMS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'builds' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Commission a New Build or Digital Platform
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure scope and lock a 50% kickoff deposit right here — your 5-stage Delivery Roadmap provisions automatically upon settlement.
              </p>
            </div>
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
              {[
                { id: 'websites' as const, label: 'Websites', icon: Globe },
                { id: 'ecommerce' as const, label: 'E-Commerce', icon: ShoppingBag },
                { id: 'custom' as const, label: 'Custom Systems', icon: Cpu },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setBuildFamily(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5',
                    buildFamily === f.id
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  <f.icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {buildFamily === 'websites' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {WEBSITE_PACKAGES.map(pkg => {
                const fixedTarget = toFixedBuildFromWebsite(pkg);
                const displayPrice = isKenya ? pkg.kenyaPrice : pkg.intlPrice;
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      'bg-white rounded-3xl p-6 border flex flex-col justify-between shadow-xs',
                      pkg.popular
                        ? 'border-[#2563EB] ring-2 ring-blue-500/10'
                        : 'border-slate-200',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {pkg.pages}
                        </span>
                        {pkg.badge && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-[#0F172A]">{pkg.name} Website</h4>
                      <div className="text-2xl font-black text-[#0F172A] mt-2">{displayPrice}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {pkg.timeline} · {pkg.support}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-3 mb-4">
                        {pkg.description}
                      </p>
                      <ul className="space-y-1.5 border-t border-slate-100 pt-4 mb-6">
                        {pkg.deliverables.slice(0, 6).map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {fixedTarget ? (
                      <button
                        type="button"
                        onClick={() => openFixedBuildConfigurator(fixedTarget)}
                        className={cn(
                          'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                          pkg.popular
                            ? 'bg-[#2563EB] hover:bg-blue-700 text-white'
                            : 'bg-[#0F172A] hover:bg-slate-800 text-white',
                        )}
                      >
                        <span>Configure &amp; Start Build</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          openScopeModal({
                            kind: 'CUSTOM_BUILD',
                            title: `${pkg.name} Website Architecture`,
                            priceLabel: displayPrice,
                            category: 'DEVELOPMENT',
                            subtitle:
                              'Share your corporate stakeholders, integrations, and timeline so our lead architect scopes your bespoke contract.',
                          })
                        }
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Request Enterprise Scope</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {buildFamily === 'ecommerce' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ECOMMERCE_PACKAGES.map(pkg => {
                const fixedTarget = toFixedBuildFromEcommerce(pkg);
                const displayPrice = isKenya ? pkg.kenyaPrice : pkg.intlPrice;
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      'bg-white rounded-3xl p-6 border flex flex-col justify-between shadow-xs',
                      pkg.popular
                        ? 'border-[#2563EB] ring-2 ring-blue-500/10'
                        : 'border-slate-200',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {pkg.products}
                        </span>
                        {pkg.badge && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-[#0F172A]">{pkg.name}</h4>
                      <div className="text-2xl font-black text-[#0F172A] mt-2">{displayPrice}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{pkg.support}</div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-3 mb-4">
                        {pkg.description}
                      </p>
                      <ul className="space-y-1.5 border-t border-slate-100 pt-4 mb-6">
                        {pkg.features.slice(0, 6).map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {fixedTarget ? (
                      <button
                        type="button"
                        onClick={() => openFixedBuildConfigurator(fixedTarget)}
                        className={cn(
                          'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                          pkg.popular
                            ? 'bg-[#2563EB] hover:bg-blue-700 text-white'
                            : 'bg-[#0F172A] hover:bg-slate-800 text-white',
                        )}
                      >
                        <span>Configure &amp; Launch Store</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          openScopeModal({
                            kind: 'CUSTOM_BUILD',
                            title: pkg.name,
                            priceLabel: displayPrice,
                            category: 'DEVELOPMENT',
                            subtitle:
                              'Tell us about your SKU volume, ERP/accounting sync, and payment currencies for a formal commerce specification.',
                          })
                        }
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Schedule Commerce Discovery</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {buildFamily === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CUSTOM_SYSTEM_TIERS.map((tier: CustomSystemTier, idx: number) => {
                const displayPrice = isKenya ? tier.kenyaStarting : tier.intlStarting;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-3xl p-6 border border-slate-200 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 mb-3">
                        Custom Engineering
                      </span>
                      <h4 className="text-base font-black text-[#0F172A]">{tier.category}</h4>
                      <div className="text-xl font-black text-[#2563EB] mt-2">{displayPrice}</div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-3 mb-4">
                        {tier.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-6">
                        {tier.examples.map((ex, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-600"
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openScopeModal({
                          kind: 'CUSTOM_BUILD',
                          title: tier.category,
                          priceLabel: displayPrice,
                          category: 'DEVELOPMENT',
                          subtitle:
                            'Outline your user roles, core workflows, and target launch window to initiate your Discovery & SRS blueprint inside Support.',
                        })
                      }
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Initiate Discovery Brief</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: MANAGED CLOUD HOSTING
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hosting' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Managed Cloud Hosting &amp; Sovereign Infrastructure
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Annual NVMe SSD &amp; Docker hosting with Cloudflare Edge DNS, automated SSL, offsite backups, and 100% domain ownership.
              </p>
            </div>
            {hostingAccounts.length > 0 && (
              <Link
                href="/portal/assets"
                className="text-xs font-bold text-[#2563EB] hover:underline shrink-0"
              >
                {hostingAccounts.length} linked domain(s) in Assets →
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {MANAGED_HOSTING_PLANS.map((host: HostingPlan) => {
              const displayPrice = isKenya ? host.kenyaPrice : host.intlPrice;
              return (
                <div
                  key={host.id}
                  className={cn(
                    'bg-white rounded-3xl p-6 border flex flex-col justify-between shadow-xs',
                    host.popular
                      ? 'border-[#2563EB] ring-2 ring-blue-500/10'
                      : 'border-slate-200',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {host.billingPeriod}
                      </span>
                      {host.badge && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800">
                          {host.badge}
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-black text-[#0F172A]">{host.name}</h4>
                    <div className="text-2xl font-black text-[#0F172A] mt-2">{displayPrice}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{host.resources}</div>
                    <p className="text-xs text-slate-500 leading-relaxed mt-3 mb-4">
                      {host.description}
                    </p>
                    <ul className="space-y-1.5 border-t border-slate-100 pt-4 mb-6">
                      {host.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openScopeModal({
                        kind: 'HOSTING',
                        title: host.name,
                        priceLabel: displayPrice,
                        category: 'HOSTING',
                        subtitle:
                          'Enter the domain you want hosted or migrated. Our infrastructure desk will provision your server node and issue the annual statement.',
                      })
                    }
                    className={cn(
                      'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      host.popular
                        ? 'bg-[#2563EB] hover:bg-blue-700 text-white'
                        : 'bg-[#0F172A] hover:bg-slate-800 text-white',
                    )}
                  >
                    <span>Provision {host.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: STANDARDIZED ADD-ON RATE CARD & ON-DEMAND ENGINEERING
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'addons' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Standardized Modular Add-Ons &amp; Hourly Support
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Transparent fixed-rate modules you can attach to an active project or existing production site at any time.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Modules' },
                { id: 'feature', label: 'Features' },
                { id: 'integration', label: 'Integrations' },
                { id: 'marketing', label: 'SEO & Copy' },
                { id: 'workflow', label: 'Workflow' },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAddonCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    addonCategory === cat.id
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAddons.map((addon: AddOnItem) => {
              const displayPrice = isKenya ? addon.kenyaPrice : addon.intlPrice;
              return (
                <div
                  key={addon.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col justify-between shadow-xs hover:border-blue-300 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-extrabold text-[#0F172A]">{addon.name}</h4>
                      <span className="text-sm font-black text-[#2563EB] shrink-0">
                        {displayPrice}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      {addon.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openScopeModal({
                        kind: 'ADDON',
                        title: `Add-On: ${addon.name}`,
                        priceLabel: displayPrice,
                        category: 'DEVELOPMENT',
                        subtitle:
                          'Add implementation details or target pages below to attach this module to your workspace.',
                      })
                    }
                    className="w-full py-2 px-3.5 rounded-xl border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Workspace</span>
                  </button>
                </div>
              );
            })}

            {/* On-Demand Hourly Engineering Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col justify-between shadow-md">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-teal-300 mb-2">
                  <Clock className="w-3 h-3" />
                  <span>Pay-As-You-Go Desk</span>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  On-Demand Systems Engineering
                </h4>
                <div className="text-lg font-black text-emerald-400 mt-1">
                  {isKenya ? HOURLY_SUPPORT_RATES.kenya : HOURLY_SUPPORT_RATES.international}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-2 mb-4">
                  Need a surgical feature tweak, DNS intervention, or custom report without a monthly retainer? Book tracked senior developer hours directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openScopeModal({
                    kind: 'ADDON',
                    title: 'On-Demand Hourly Engineering',
                    priceLabel: isKenya
                      ? HOURLY_SUPPORT_RATES.kenya
                      : HOURLY_SUPPORT_RATES.international,
                    category: 'DEVELOPMENT',
                    subtitle:
                      'Describe the task or intervention needed. Our engineer will confirm the exact hour count before billing.',
                  })
                }
                className="w-full py-2 px-3.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Request Engineering Hours</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: IN-PORTAL CLOUD CARE CHECKOUT (M-PESA / CARD / CORPORATE WIRE)
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedCarePlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-5 bg-[#0F172A] text-white flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                  In-Workspace Subscription Checkout
                </span>
                <h3 className="text-lg font-extrabold mt-0.5">
                  {selectedCarePlan.name} ({careCycle === 'ANNUAL' ? 'Annual -10%' : 'Monthly'})
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Total:{' '}
                  <strong className="text-white">
                    {formatCurrency(
                      careCycle === 'ANNUAL'
                        ? isKenya
                          ? selectedCarePlan.priceAnnualKes
                          : selectedCarePlan.priceAnnual
                        : isKenya
                          ? selectedCarePlan.priceMonthlyKes
                          : selectedCarePlan.priceMonthly,
                      activeCurrency,
                    )}
                  </strong>{' '}
                  · {priceBook.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCarePlan(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Rail Switcher */}
            <div
              className={cn(
                'grid border-b border-slate-200 bg-slate-50',
                isKenya ? 'grid-cols-3' : 'grid-cols-2',
              )}
            >
              {isKenya && (
                <button
                  type="button"
                  onClick={() => {
                    setCarePayMethod('MPESA');
                    setCareFeedback(null);
                  }}
                  className={cn(
                    'py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all',
                    carePayMethod === 'MPESA'
                      ? 'border-emerald-600 text-emerald-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>M-Pesa STK</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCarePayMethod('CARD');
                  setCareFeedback(null);
                }}
                className={cn(
                  'py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all',
                  carePayMethod === 'CARD'
                    ? 'border-[#2563EB] text-[#2563EB] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCarePayMethod('WIRE');
                  setCareFeedback(null);
                }}
                className={cn(
                  'py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all',
                  carePayMethod === 'WIRE'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>B2B Invoice</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {careFeedback && (
                <div
                  className={cn(
                    'p-3.5 rounded-xl border text-xs flex items-start gap-2.5',
                    careFeedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : careFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800',
                  )}
                >
                  {careFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : carePayStatus === 'AWAITING' ? (
                    <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{careFeedback.msg}</span>
                </div>
              )}

              {carePayStatus === 'CONFIRMED' ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-extrabold text-[#0F172A]">
                    {selectedCarePlan.name} Activated
                  </div>
                  <p className="text-xs text-slate-500">
                    Your workspace SLA and receipt have been updated in real time.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCarePlan(null);
                      router.push('/portal/invoices');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold"
                  >
                    <span>View Receipt in Invoices</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : carePayMethod === 'MPESA' ? (
                <form onSubmit={handleCareMpesa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Safaricom M-Pesa Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={carePhone}
                      onChange={e => setCarePhone(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={careSubmitting || !carePhone.trim() || carePayStatus === 'AWAITING'}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {careSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Send M-Pesa STK Prompt</span>
                      </>
                    )}
                  </button>
                </form>
              ) : carePayMethod === 'CARD' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Receipt Email
                    </label>
                    <input
                      type="email"
                      value={careEmail}
                      onChange={e => setCareEmail(e.target.value)}
                      placeholder="billing@yourcompany.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Processed via PCI-DSS Level 1 Paystack card checkout ({activeCurrency}) and returned straight back to your portal workspace.
                  </p>
                  <button
                    type="button"
                    onClick={handleCareCard}
                    disabled={careSubmitting}
                    className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {careSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Proceed to Secure Card Payment</span>
                      </>
                    )}
                  </button>
                </div>
              ) : careWireInvoice ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Number:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {careWireInvoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Due:</span>
                      <span className="font-bold text-[#0F172A]">
                        {formatMoney(careWireInvoice.amount, careWireInvoice.currency)}
                      </span>
                    </div>
                    {careWireInvoice.bankDetails &&
                      Object.entries(careWireInvoice.bankDetails).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-slate-500 capitalize">
                            {k.replace(/([A-Z])/g, ' $1')}:
                          </span>
                          <span className="font-semibold text-slate-800 text-right">{v}</span>
                        </div>
                      ))}
                  </div>
                  <Link
                    href="/portal/invoices"
                    onClick={() => setSelectedCarePlan(null)}
                    className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Statement in Invoices &amp; Cloud Care</span>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleCareWire} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Purchase Order / Internal Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={e => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-014"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Generates an official B2B tax/proforma invoice in {activeCurrency} for EFT/RTGS or online settlement inside Invoices &amp; Cloud Care.
                  </p>
                  <button
                    type="submit"
                    disabled={careSubmitting}
                    className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {careSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Generate Official B2B Invoice</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: IN-PORTAL BUILD CONFIGURATOR & 50% KICKOFF DEPOSIT DRAWER
         ══════════════════════════════════════════════════════════════════════ */}
      {configBuild && buildEstimate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-5 bg-[#0F172A] text-white flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                  {configBuild.familyLabel} · {priceBook.id}
                </span>
                <h3 className="text-lg font-extrabold mt-0.5">Configure {configBuild.name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {configBuild.includedScale} · {configBuild.supportWindow} · 50% milestone kickoff deposit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigBuild(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close configurator"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[78vh] overflow-y-auto custom-scrollbar space-y-5">
              {buildFeedback && (
                <div
                  className={cn(
                    'p-3.5 rounded-xl border text-xs flex items-start gap-2.5',
                    buildFeedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : buildFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800',
                  )}
                >
                  {buildFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : buildPayStatus === 'AWAITING' ? (
                    <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{buildFeedback.msg}</span>
                </div>
              )}

              {buildPayStatus === 'CONFIRMED' ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-[#0F172A]">
                    Kickoff Deposit Settled — Roadmap Provisioned!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Your 5-stage Delivery Roadmap is now live in Mission Control and Delivery Roadmap.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConfigBuild(null);
                      router.push('/portal/milestones');
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold"
                  >
                    <span>Open Delivery Roadmap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : !lockedProposal ? (
                <>
                  {/* Extra Pages Counter */}
                  {configBuild.supportsExtraPages && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-[#0F172A]">
                          Additional Pages ({isKenya ? 'KSh 2,000' : '$40'} / page)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Beyond {configBuild.includedScale.toLowerCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExtraPages(p => Math.max(0, p - 1))}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-[#0F172A]">
                          {extraPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExtraPages(p => Math.min(30, p + 1))}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modular Add-Ons */}
                  <div>
                    <div className="text-xs font-bold text-[#0F172A] mb-2">
                      Optional Modular Add-Ons
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ADD_ON_RATE_CARD.filter(
                        a => a.id !== 'extra-page' && a.id !== 'rush-delivery',
                      ).map(addon => {
                        const checked = selectedAddOns.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() =>
                              setSelectedAddOns(prev =>
                                prev.includes(addon.id)
                                  ? prev.filter(x => x !== addon.id)
                                  : [...prev, addon.id],
                              )
                            }
                            className={cn(
                              'p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 text-xs',
                              checked
                                ? 'border-[#2563EB] bg-blue-50/50 text-[#0F172A]'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700',
                            )}
                          >
                            <span className="font-semibold truncate">{addon.name}</span>
                            <span className="font-bold text-[#2563EB] shrink-0">
                              {isKenya ? addon.kenyaPrice : addon.intlPrice}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Annual Hosting */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                        Managed Annual Hosting (Optional)
                      </label>
                      <select
                        value={buildHosting}
                        onChange={e => setBuildHosting(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-[#0F172A] bg-white"
                      >
                        <option value="none">Self-hosted / Decide at launch</option>
                        <option value="host-essential">
                          Host Essential ({isKenya ? 'KSh 4,500/yr' : '$49/yr'})
                        </option>
                        <option value="host-business">
                          Host Business ({isKenya ? 'KSh 8,500/yr' : '$99/yr'})
                        </option>
                        <option value="host-professional">
                          Host Professional ({isKenya ? 'KSh 15,000/yr' : '$189/yr'})
                        </option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="w-full p-2.5 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer text-xs">
                        <div>
                          <span className="font-bold text-[#0F172A] block">
                            Priority Rush (+25%)
                          </span>
                          <span className="text-[10px] text-slate-500">Accelerated sprint</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={rushBuild}
                          onChange={e => setRushBuild(e.target.checked)}
                          className="w-4 h-4 accent-[#2563EB]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Canonical Price Summary */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Base Package ({configBuild.name})</span>
                      <span>{formatCurrency(buildEstimate.baseCost, activeCurrency)}</span>
                    </div>
                    {buildEstimate.pagesCost > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Extra Pages ({extraPages})</span>
                        <span>{formatCurrency(buildEstimate.pagesCost, activeCurrency)}</span>
                      </div>
                    )}
                    {buildEstimate.addOnsCost > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Selected Add-Ons ({selectedAddOns.length})</span>
                        <span>{formatCurrency(buildEstimate.addOnsCost, activeCurrency)}</span>
                      </div>
                    )}
                    {buildEstimate.rushSurcharge > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>Priority Rush Surcharge (+25%)</span>
                        <span>{formatCurrency(buildEstimate.rushSurcharge, activeCurrency)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm">
                      <span>Total Scoped Build</span>
                      <span>{formatCurrency(buildEstimate.totalBuild, activeCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-extrabold text-sm">
                      <span>50% Kickoff Deposit Due Now</span>
                      <span>{formatCurrency(buildEstimate.deposit50, activeCurrency)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLockProposalAndCreateDeposit}
                    disabled={buildBusy}
                    className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {buildBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Lock Proposal &amp; Continue to 50% Kickoff Deposit</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Step 2: Settle Locked 50% Kickoff Deposit Inline */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Locked Proposal Reference:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {lockedProposal.proposalCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Deposit Invoice:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {lockedProposal.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-emerald-700 pt-1 border-t border-slate-200">
                      <span>50% Kickoff Deposit:</span>
                      <span>
                        {formatMoney(lockedProposal.depositAmount, lockedProposal.currency)}
                      </span>
                    </div>
                  </div>

                  {isKenya && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBuildPayTab('MPESA')}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-bold border',
                          buildPayTab === 'MPESA'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 text-slate-600',
                        )}
                      >
                        M-Pesa STK Push
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuildPayTab('CARD')}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-bold border',
                          buildPayTab === 'CARD'
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                            : 'border-slate-200 text-slate-600',
                        )}
                      >
                        Visa / Mastercard
                      </button>
                    </div>
                  )}

                  {buildPayTab === 'MPESA' && isKenya ? (
                    <form onSubmit={handlePayBuildMpesa} className="space-y-3">
                      <input
                        type="tel"
                        required
                        value={buildPhone}
                        onChange={e => setBuildPhone(e.target.value)}
                        placeholder="Safaricom number e.g. 0712 345 678"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                      <button
                        type="submit"
                        disabled={buildBusy || !buildPhone.trim() || buildPayStatus === 'AWAITING'}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                      >
                        {buildBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Smartphone className="w-4 h-4" />
                            <span>Pay 50% Kickoff via M-Pesa STK</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePayBuildCard}
                      disabled={buildBusy}
                      className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
                    >
                      {buildBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Pay 50% Kickoff by Card</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="text-center pt-1">
                    <Link
                      href="/portal/invoices"
                      onClick={() => setConfigBuild(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-[#2563EB]"
                    >
                      Or view/print invoice in Invoices &amp; Cloud Care →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 3: IN-PORTAL HOSTING / ADD-ON / CUSTOM DISCOVERY DISPATCH
         ══════════════════════════════════════════════════════════════════════ */}
      {scopeRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-[#0F172A] text-white flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                  Direct Workspace Order · {priceBook.id}
                </span>
                <h3 className="text-lg font-extrabold mt-0.5">{scopeRequestModal.title}</h3>
                <p className="text-xs text-emerald-300 font-bold mt-0.5">
                  {scopeRequestModal.priceLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScopeRequestModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitScopeRequest} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">{scopeRequestModal.subtitle}</p>

              {reqFeedback && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {reqFeedback}
                </div>
              )}

              {scopeRequestModal.kind === 'HOSTING' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Primary Domain Name
                    </label>
                    <input
                      type="text"
                      required
                      value={reqDomain}
                      onChange={e => setReqDomain(e.target.value)}
                      placeholder="yourorganization.co.ke"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A]"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reqNeedMigration}
                      onChange={e => setReqNeedMigration(e.target.checked)}
                      className="w-4 h-4 accent-[#2563EB]"
                    />
                    <span>Include zero-downtime migration from existing host</span>
                  </label>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Scope Details / Instructions
                </label>
                <textarea
                  rows={4}
                  required={scopeRequestModal.kind !== 'HOSTING'}
                  value={reqNotes}
                  onChange={e => setReqNotes(e.target.value)}
                  placeholder="Share target timeline, pages, integrations, or domain notes…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-[#0F172A] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScopeRequestModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicket.isPending}
                  className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2"
                >
                  {createTicket.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Dispatch to Engineering Desk</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
