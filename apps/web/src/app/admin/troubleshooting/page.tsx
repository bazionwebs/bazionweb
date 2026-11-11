'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  Globe,
  Radio,
  Search,
  CheckCircle2,
  RefreshCw,
  Terminal,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Eye,
  Check,
  Cpu,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Key,
  Lock,
  Server,
  ShieldCheck,
  Copy,
  AlertTriangle,
  Zap,
  FileText,
} from 'lucide-react';
import {
  useAdminClients,
  useClusterHealth,
  useWebhookLogs,
  useReplayWebhook,
  useReconcilePayments,
  useResolveDns,
  useImpersonateClient,
  useTroubleshootingOverview,
  useOrphanPayments,
  useRemediateOrphanPayment,
  useDnsSslFleet,
  useRemediateDnsSsl,
  useWebhookFailures,
  useRetryWebhooksBatch,
  useUnsyncedInvoices,
  useRemediateInvoiceSync,
  useClientAccessIssues,
  useRemediateClientAccess,
  useSuspendedDomains,
  useRemediateDomainState,
  useProactiveHealthScan,
  useRemediateProactiveAnomaly,
  type ProactiveAnomaly,
} from '@/hooks/useAdminData';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/lib/api';
import { useAdminPolling } from '@/hooks/useAdminPolling';
import AdminPollingControlBar from '@/components/admin/AdminPollingControlBar';

type TroubleshootingTab =
  | 'health'
  | 'orphans'
  | 'dns'
  | 'webhooks'
  | 'invoices'
  | 'access'
  | 'domains'
  | 'impersonation';

function AdminTroubleshootingContent() {
  const searchParams = useSearchParams();

  // ── Tab State
  const [activeTool, setActiveTool] = useState<TroubleshootingTab>('health');

  // ── Controlled Polling Controller
  const polling = useAdminPolling({
    defaultInterval: 15000,
  });

  // Queries (scoped strictly to activeTool tab to eliminate ~85% idle background queries)
  const clientsQuery = useAdminClients();
  const clusterHealthQuery = useClusterHealth({
    refetchInterval: polling.getTabInterval(activeTool === 'health', 15000),
  });
  const overviewQuery = useTroubleshootingOverview({
    refetchInterval: polling.isPollingEnabled && polling.isVisible ? polling.pollingInterval : false,
  });
  const orphanQuery = useOrphanPayments({
    refetchInterval: polling.getTabInterval(activeTool === 'orphans', 15000),
  });
  const dnsFleetQuery = useDnsSslFleet({
    refetchInterval: polling.getTabInterval(activeTool === 'dns', 30000),
  });
  const webhookFailuresQuery = useWebhookFailures(50, {
    refetchInterval: polling.getTabInterval(activeTool === 'webhooks', 10000),
  });
  const webhookStreamQuery = useWebhookLogs(50, {
    refetchInterval: polling.getTabInterval(activeTool === 'webhooks', 10000),
  });
  const unsyncedInvoicesQuery = useUnsyncedInvoices({
    refetchInterval: polling.getTabInterval(activeTool === 'invoices', 15000),
  });
  const clientAccessQuery = useClientAccessIssues({
    refetchInterval: polling.getTabInterval(activeTool === 'access', 15000),
  });
  const suspendedDomainsQuery = useSuspendedDomains({
    refetchInterval: polling.getTabInterval(activeTool === 'domains', 15000),
  });
  const proactiveScanQuery = useProactiveHealthScan();

  // Mutations
  const replayMutation = useReplayWebhook();
  const retryBatchMutation = useRetryWebhooksBatch();
  const reconcileMutation = useReconcilePayments();
  const resolveDnsMutation = useResolveDns();
  const impersonateMutation = useImpersonateClient();
  const remediateOrphanMutation = useRemediateOrphanPayment();
  const remediateDnsSslMutation = useRemediateDnsSsl();
  const remediateInvoiceMutation = useRemediateInvoiceSync();
  const remediateAccessMutation = useRemediateClientAccess();
  const remediateDomainMutation = useRemediateDomainState();
  const remediateProactiveMutation = useRemediateProactiveAnomaly();

  // ── Action Feedback State
  const [inFlightActionId, setInFlightActionId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // ── DNS Inspector State (Manual Single Domain)
  const [dnsDomain, setDnsDomain] = useState('acaciahealthcare.co.ke');
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);

  // ── Webhook Filter State
  const [webhookFilter, setWebhookFilter] = useState<'failures' | 'all'>('failures');

  // ── Generated Magic Link Modal State
  const [generatedMagicLink, setGeneratedMagicLink] = useState<{
    clientId: string;
    clientName: string;
    url: string;
    email?: string;
    emailDispatched?: boolean;
    isClaim?: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [emailResentSuccess, setEmailResentSuccess] = useState(false);

  // ── Impersonation State
  const [impersonateClient, setImpersonateClient] = useState('');
  const [impersonationSession, setImpersonationSession] = useState<{
    token: string;
    clientName: string;
  } | null>(null);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  // Deep-linking from query params
  useEffect(() => {
    const tabParam = (searchParams?.get('tab') || searchParams?.get('tool')) as TroubleshootingTab | null;
    if (
      tabParam &&
      [
        'health',
        'orphans',
        'dns',
        'webhooks',
        'invoices',
        'access',
        'domains',
        'impersonation',
      ].includes(tabParam)
    ) {
      setActiveTool(tabParam);
    }
    const impersonateParam = searchParams?.get('impersonate');
    if (impersonateParam) {
      setActiveTool('impersonation');
      setImpersonateClient(impersonateParam);
    }
  }, [searchParams]);

  // Flash feedback helper
  const showFeedback = (successMsg: string | null, errorMsg: string | null = null) => {
    if (successMsg) {
      setFeedbackSuccess(successMsg);
      setTimeout(() => setFeedbackSuccess(null), 4500);
    }
    if (errorMsg) {
      setFeedbackError(errorMsg);
      setTimeout(() => setFeedbackError(null), 6000);
    }
  };

  // ── Handler: Single Domain DNS Resolve
  const handleCheckDns = async () => {
    if (!dnsDomain.trim()) return;
    setDnsError(null);
    setDnsResults(null);
    try {
      const res = await resolveDnsMutation.mutateAsync(dnsDomain.trim());
      setDnsResults(res);
    } catch (err: any) {
      setDnsError(err?.response?.data?.message || err?.message || 'Failed to inspect domain.');
    }
  };

  // ── Handler: Orphan Payment Remediation
  const handleRemediateOrphan = async (
    paymentLogId: string,
    action: 'LINK_AND_SETTLE' | 'CREDIT_CLIENT',
    targetInvoiceId?: string,
    targetClientId?: string,
  ) => {
    setInFlightActionId(`orphan-${paymentLogId}-${action}`);
    try {
      const res = await remediateOrphanMutation.mutateAsync({
        paymentLogId,
        action,
        targetInvoiceId,
        targetClientId,
      });
      showFeedback(res.message || 'Payment successfully resolved and reconciled.');
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Orphan remediation failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Fleet DNS / SSL Remediation
  const handleRemediateDnsSsl = async (
    domain: string,
    action: 'REFRESH_SSL' | 'REISSUE_SSL',
    hostingAccountId?: string,
  ) => {
    setInFlightActionId(`ssl-${domain}-${action}`);
    try {
      const res = await remediateDnsSslMutation.mutateAsync({
        domain,
        action,
        hostingAccountId,
      });
      showFeedback(res.message || `SSL action ${action} completed successfully for ${domain}.`);
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || `SSL remediation failed for ${domain}.`);
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Single Webhook Replay
  const handleReplaySingleWebhook = async (id: string) => {
    setInFlightActionId(`wh-single-${id}`);
    try {
      const res = await replayMutation.mutateAsync(id);
      showFeedback(`Webhook payment re-verified. Settle status: ${res?.settled ? 'Settled' : 'Not settled'}`);
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Webhook re-verification failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Batch Webhooks Retry
  const handleRetryWebhooksBatch = async () => {
    setInFlightActionId('wh-batch');
    try {
      const res = await retryBatchMutation.mutateAsync(24);
      showFeedback(`Batch retry complete: scanned ${res?.scanned || 0}, settled ${res?.settled || 0}, failed ${res?.failed || 0}.`);
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Batch webhook retry failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Invoice Sync Remediation
  const handleRemediateInvoice = async (
    invoiceId: string,
    action: 'SYNC_FROM_PAYMENTS' | 'RECALCULATE_FROM_ITEMS' | 'MARK_PAID' | 'MARK_OVERDUE',
  ) => {
    setInFlightActionId(`inv-${invoiceId}-${action}`);
    try {
      const res = await remediateInvoiceMutation.mutateAsync({ invoiceId, action });
      showFeedback(res.message || 'Invoice synchronization action completed successfully.');
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Invoice sync remediation failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Client Access Remediation
  const handleRemediateAccess = async (
    clientId: string,
    clientName: string,
    action: 'UNLOCK_ACCOUNT' | 'GENERATE_RESET_LINK' | 'RESTORE_USER',
    fallbackEmail?: string,
  ) => {
    setInFlightActionId(`access-${clientId}-${action}`);
    try {
      const res = await remediateAccessMutation.mutateAsync({ clientId, action });
      if (action === 'GENERATE_RESET_LINK' && res.resetLink) {
        const targetEmail = res.recipientEmail || fallbackEmail;
        const isClaim = res.resetLink.includes('/claim');

        let effectiveUrl = res.resetLink;
        if (typeof window !== 'undefined' && res.resetLink) {
          try {
            const parsed = new URL(res.resetLink);
            effectiveUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
          } catch {
            // Keep original
          }
        }

        // Automatically dispatch email via Next.js mailer
        let emailDispatched = false;
        if (targetEmail) {
          try {
            const dispatchRes = await adminApi.dispatchAdminLinkEmail({
              to: targetEmail,
              url: effectiveUrl,
              clientName,
              type: isClaim ? 'claim' : 'magic',
            });
            emailDispatched = dispatchRes?.delivered ?? true;
          } catch (dispatchErr) {
            console.warn('[Troubleshooting] Auto-email dispatch warning:', dispatchErr);
          }
        }

        setGeneratedMagicLink({
          clientId,
          clientName,
          url: effectiveUrl,
          email: targetEmail,
          emailDispatched,
          isClaim,
        });

        showFeedback(
          targetEmail
            ? `${isClaim ? 'Activation claim link' : 'Magic login link'} generated and automatically emailed to ${targetEmail}!`
            : 'Access link generated successfully.',
        );
      } else {
        showFeedback(res.message || `Account for ${clientName} restored to ACTIVE standing.`);
      }
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Client access remediation failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Domain State Remediation
  const handleRemediateDomain = async (
    hostingAccountId: string,
    domain: string,
    action: 'UNSUSPEND' | 'NORMALIZE_STATUS',
  ) => {
    setInFlightActionId(`dom-${hostingAccountId}-${action}`);
    try {
      const res = await remediateDomainMutation.mutateAsync({ hostingAccountId, action });
      showFeedback(res.message || `Domain ${domain} unsuspended and restored to ACTIVE.`);
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || `Failed to unsuspend ${domain}.`);
    } finally {
      setInFlightActionId(null);
    }
  };

  // ── Handler: Impersonation Minting
  const handleImpersonate = async () => {
    if (!impersonateClient) return;
    setImpersonationError(null);
    setImpersonationSession(null);
    try {
      const res = await impersonateMutation.mutateAsync(impersonateClient);
      setImpersonationSession({
        token: res.token,
        clientName: res.client?.businessName || 'Client',
      });
    } catch (err: any) {
      setImpersonationError(err?.response?.data?.message || 'Could not mint impersonation session.');
    }
  };

  // ── Handler: Proactive Anomaly Remediation (M3 / R3)
  const handleRemediateProactive = async (anomaly: ProactiveAnomaly) => {
    const actionKey = `proactive-${anomaly.id}`;
    setInFlightActionId(actionKey);
    try {
      const res = await remediateProactiveMutation.mutateAsync({
        anomalyId: anomaly.id,
        rule: anomaly.rule,
        remediationAction: anomaly.remediationAction,
        remediationPayload: anomaly.remediationPayload,
      });
      showFeedback(res.message || `Remediation executed for ${anomaly.title}`);
      await proactiveScanQuery.refetch();
    } catch (err: any) {
      showFeedback(null, err?.response?.data?.message || 'Proactive remediation failed.');
    } finally {
      setInFlightActionId(null);
    }
  };

  const getProactiveActionLabel = (action: string) => {
    switch (action) {
      case 'REFRESH_SSL':
        return 'Renew / Refresh SSL';
      case 'REISSUE_SSL':
        return "Reissue Let's Encrypt SSL";
      case 'RETRY_WEBHOOK_BURST':
        return 'Retry Webhook Burst (1h)';
      case 'AUTO_APPLY_PAYMENT':
        return 'Auto-Apply & Settle Payment';
      case 'EXTEND_AND_ACTIVATE_QUOTE':
        return 'Extend Quote & Provision Project';
      default:
        return action.replace(/_/g, ' ');
    }
  };

  const health = clusterHealthQuery.data;
  const overview = overviewQuery.data;
  const orphanCount = orphanQuery.data?.count ?? overview?.orphanPaymentsCount ?? 0;
  const dnsRiskCount = dnsFleetQuery.data?.issuesCount ?? overview?.dnsSslIssuesCount ?? 0;
  const webhookBurst = webhookFailuresQuery.data?.burstDetected ?? overview?.burstAnomalyDetected ?? false;
  const unsyncedCount = unsyncedInvoicesQuery.data?.totalUnsynced ?? 0;
  const accessItems = clientAccessQuery.data?.items ?? [];
  const actualLockedCount = accessItems.filter(
    (i: any) => i.lockoutReason === 'CLIENT_SUSPENDED' || i.lockoutReason === 'CLIENT_SOFT_DELETED' || i.lockoutReason === 'USER_SOFT_DELETED',
  ).length;
  const unclaimedCount = accessItems.filter((i: any) => i.lockoutReason === 'PASSWORD_UNSET').length;
  const suspendedDomainCount = suspendedDomainsQuery.data?.totalSuspended ?? overview?.suspendedDomainsCount ?? 0;

  const handleGlobalRefresh = async () => {
    await Promise.allSettled([
      proactiveScanQuery.refetch(),
      clusterHealthQuery.refetch(),
      overviewQuery.refetch(),
      orphanQuery.refetch(),
      dnsFleetQuery.refetch(),
      webhookFailuresQuery.refetch(),
      webhookStreamQuery.refetch(),
      unsyncedInvoicesQuery.refetch(),
      clientAccessQuery.refetch(),
      suspendedDomainsQuery.refetch(),
      clientsQuery.refetch(),
    ]);
    showFeedback('Refreshed diagnostic telemetry across all systems.');
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">Admin Troubleshooting &amp; Operations Workstation</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              OPERATIONS DESK
            </span>
          </div>
          <p className="text-xs text-slate-500">
            One-click diagnostics and transactional remediation suite for infrastructure, gateways, billing, and tenant access
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {proactiveScanQuery.data?.scannedAt && (
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline mr-1">
              Last scanned: <span className="font-semibold text-slate-700">{new Date(proactiveScanQuery.data.scannedAt).toLocaleTimeString()}</span>
            </span>
          )}

          <button
            onClick={async () => {
              await proactiveScanQuery.refetch();
              showFeedback('Proactive health scan completed.');
            }}
            disabled={proactiveScanQuery.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${proactiveScanQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>{proactiveScanQuery.isFetching ? 'Scanning Platform…' : 'Run Proactive Health Scan'}</span>
          </button>

          <button
            onClick={handleGlobalRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {/* ── Polling & Workstation Telemetry Control Bar ──────────────────────── */}
      <AdminPollingControlBar controller={polling} onRefresh={handleGlobalRefresh} />

      {/* ── Real-Time Anomaly & Feedback Banners ───────────────────────────────── */}
      {feedbackSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedbackSuccess}</span>
          </div>
          <button onClick={() => setFeedbackSuccess(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {feedbackError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{feedbackError}</span>
          </div>
          <button onClick={() => setFeedbackError(null)} className="text-rose-700 hover:text-rose-950 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {webhookBurst && (
        <div className="p-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide">
                Proactive Alert: Payment Gateway Webhook Burst Spike Detected
              </h4>
              <p className="text-[11px] text-rose-100 mt-0.5">
                3 or more payment gateway webhooks failed within the last 15 minutes. Check gateway credentials or rerun batch verification.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTool('webhooks');
              handleRetryWebhooksBatch();
            }}
            disabled={inFlightActionId === 'wh-batch'}
            className="px-3.5 py-1.5 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-sm shrink-0 transition-colors"
          >
            {inFlightActionId === 'wh-batch' ? 'Retrying…' : 'Batch Retry All Failed (24h)'}
          </button>
        </div>
      )}

      {/* ── Proactive Intelligence Radar & Anomaly Action Deck (M3 / R3) ────── */}
      {proactiveScanQuery.isLoading && !proactiveScanQuery.data && (
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
            <span className="text-xs font-semibold text-slate-700">
              Running automated proactive health scans across SSL, webhooks, payments, and quotes…
            </span>
          </div>
        </div>
      )}

      {proactiveScanQuery.data && proactiveScanQuery.data.anomalies.length === 0 && (
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-900">
                Proactive Intelligence Radar Clean: 0 Operational Anomalies Detected
              </span>
              <p className="text-[11px] text-emerald-700">
                All 4 proactive monitors clean: SSL fleet healthy (&gt;7 days), payment webhooks stable, payments applied, and quotes synchronized.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-200 text-emerald-900 rounded-full shrink-0">
            RADAR CLEAN
          </span>
        </div>
      )}

      {proactiveScanQuery.data && proactiveScanQuery.data.anomalies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider">
                {proactiveScanQuery.data.anomalies.length} Flagged Anomaly{proactiveScanQuery.data.anomalies.length > 1 ? 'ies' : ''}
              </span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Actionable Proactive Intelligence Alerts
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {proactiveScanQuery.data.summary.critical > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  {proactiveScanQuery.data.summary.critical} Critical
                </span>
              )}
              {proactiveScanQuery.data.summary.warning > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                  {proactiveScanQuery.data.summary.warning} Warning
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {proactiveScanQuery.data.anomalies.map((anomaly) => {
              const isCritical = anomaly.severity === 'CRITICAL';
              const isWarning = anomaly.severity === 'WARNING';
              const inFlight = inFlightActionId === `proactive-${anomaly.id}`;

              return (
                <div
                  key={anomaly.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCritical
                      ? 'bg-rose-50/70 border-rose-300 shadow-sm'
                      : isWarning
                      ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          isCritical
                            ? 'bg-rose-100 text-rose-700'
                            : isWarning
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {anomaly.rule === 'SSL_EXPIRING_7D' && <Globe className="w-4 h-4" />}
                        {anomaly.rule === 'WEBHOOK_BURST' && <Radio className="w-4 h-4" />}
                        {anomaly.rule === 'UNAPPLIED_PAYMENT' && <DollarSign className="w-4 h-4" />}
                        {anomaly.rule === 'EXPIRED_QUOTE_DEPOSIT' && <FileText className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isCritical
                                ? 'bg-rose-600 text-white'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-500 text-white'
                            }`}
                          >
                            {anomaly.severity}
                          </span>
                          <span className="text-[10px] font-mono uppercase text-slate-500">
                            {anomaly.rule.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">
                          {anomaly.title}
                        </h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {anomaly.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500 font-mono">
                          {anomaly.metadata.domain && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              domain: {anomaly.metadata.domain}
                            </span>
                          )}
                          {anomaly.metadata.daysLeft !== undefined && anomaly.metadata.daysLeft !== null && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              days left: {anomaly.metadata.daysLeft}
                            </span>
                          )}
                          {anomaly.metadata.failureCount && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              failures: {anomaly.metadata.failureCount} / 60m
                            </span>
                          )}
                          {anomaly.metadata.amount && anomaly.metadata.currency && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              {anomaly.metadata.currency} {anomaly.metadata.amount}
                            </span>
                          )}
                          {anomaly.metadata.proposalCode && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              quote: {anomaly.metadata.proposalCode}
                            </span>
                          )}
                          {anomaly.metadata.clientEmail && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              client: {anomaly.metadata.clientEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemediateProactive(anomaly)}
                      disabled={inFlight}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0 ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50'
                          : 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50'
                      }`}
                    >
                      {inFlight ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Remediating…</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>{getProactiveActionLabel(anomaly.remediationAction)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Proactive Intelligence Summary Cards Deck ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Card 1: Orphan Payments */}
        <button
          onClick={() => setActiveTool('orphans')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            orphanCount > 0
              ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <DollarSign className={`w-4 h-4 ${orphanCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            {orphanCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                {orphanCount} RISK
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">CLEAN</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">{orphanCount}</div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Orphan Payments</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Unsettled / unlinked</div>
        </button>

        {/* Card 2: DNS & SSL Risks */}
        <button
          onClick={() => setActiveTool('dns')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            dnsRiskCount > 0
              ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <Globe className={`w-4 h-4 ${dnsRiskCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            {dnsRiskCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                {dnsRiskCount} RISK
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">HEALTHY</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">{dnsRiskCount}</div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">SSL / DNS Risks</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Expiring ≤ 7d / IP desync</div>
        </button>

        {/* Card 3: Webhook Failures */}
        <button
          onClick={() => setActiveTool('webhooks')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            webhookBurst
              ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <Radio className={`w-4 h-4 ${webhookBurst ? 'text-rose-600' : 'text-slate-400'}`} />
            {webhookBurst ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">BURST</span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">NORMAL</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">
            {webhookFailuresQuery.data?.totalFailed ?? 0}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Failed Webhooks</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Needs gateway retry</div>
        </button>

        {/* Card 4: Unsynced Invoices */}
        <button
          onClick={() => setActiveTool('invoices')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            unsyncedCount > 0
              ? 'bg-blue-50/80 border-blue-200 hover:bg-blue-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <FileText className={`w-4 h-4 ${unsyncedCount > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
            {unsyncedCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                {unsyncedCount} DESYNC
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">SYNCED</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">{unsyncedCount}</div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Unsynced Invoices</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Math &amp; status drift</div>
        </button>

        {/* Card 5: Locked & Unclaimed Accounts */}
        <button
          onClick={() => setActiveTool('access')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            actualLockedCount > 0
              ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80'
              : unclaimedCount > 0
              ? 'bg-blue-50/80 border-blue-200 hover:bg-blue-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <Lock
              className={`w-4 h-4 ${
                actualLockedCount > 0
                  ? 'text-rose-600'
                  : unclaimedCount > 0
                  ? 'text-[#2563EB]'
                  : 'text-slate-400'
              }`}
            />
            {actualLockedCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                {actualLockedCount} LOCKED
              </span>
            ) : unclaimedCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                {unclaimedCount} UNCLAIMED
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">HEALTHY</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">
            {actualLockedCount > 0 ? actualLockedCount : unclaimedCount}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
            {actualLockedCount > 0 ? 'Locked Accounts' : unclaimedCount > 0 ? 'Unclaimed Accounts' : 'Client Access'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            {actualLockedCount > 0
              ? `${actualLockedCount} suspended/disabled`
              : unclaimedCount > 0
              ? 'Active · Awaiting client password setup'
              : 'All accounts active & claimed'}
          </div>
        </button>

        {/* Card 6: Suspended Domains */}
        <button
          onClick={() => setActiveTool('domains')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            suspendedDomainCount > 0
              ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <Server className={`w-4 h-4 ${suspendedDomainCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            {suspendedDomainCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                {suspendedDomainCount} STOPPED
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-bold">ACTIVE</span>
            )}
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">{suspendedDomainCount}</div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Suspended Domains</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Inconsistent or stuck</div>
        </button>

        {/* Card 7: Client Sandbox (View-As) */}
        <button
          onClick={() => setActiveTool('impersonation')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTool === 'impersonation'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <UserCheck className={`w-4 h-4 ${activeTool === 'impersonation' ? 'text-[#2563EB]' : 'text-slate-500'}`} />
            <span className="text-[10px] text-blue-700 font-bold bg-blue-100/80 px-1.5 py-0.5 rounded border border-blue-200">
              VIEW-AS
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">Sandbox</div>
          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Client View-As</div>
          <div className="text-[9px] text-slate-400 mt-0.5">15m Scoped Session</div>
        </button>
      </div>

      {/* ── 8 Operational Tabs Navigation (Responsive Wrapping: Never Offscreen) ── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {[
          { id: 'health', label: '1. Service & Cluster Health', icon: Activity },
          { id: 'orphans', label: '2. Orphan Payments', icon: DollarSign, badge: orphanCount },
          { id: 'dns', label: '3. Fleet DNS & SSL', icon: Globe, badge: dnsRiskCount },
          { id: 'webhooks', label: '4. Webhooks & Retries', icon: Radio, badge: webhookFailuresQuery.data?.totalFailed },
          { id: 'invoices', label: '5. Invoices & Reconciliation', icon: RefreshCw, badge: unsyncedCount },
          {
            id: 'access',
            label: '6. Client Access & Lockouts',
            icon: Key,
            badge: actualLockedCount > 0 ? actualLockedCount : unclaimedCount,
            badgeVariant: actualLockedCount > 0 ? 'rose' : 'blue',
          },
          { id: 'domains', label: '7. Suspended Domains', icon: Server, badge: suspendedDomainCount },
          { id: 'impersonation', label: '8. Client Sandbox', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-rose-500 text-white'
                      : (tab as any).badgeVariant === 'blue'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Generated Magic Token Copy Modal ─────────────────────────────────── */}
      {generatedMagicLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#2563EB]" />
                <h3 className="font-bold text-sm text-slate-900">
                  {generatedMagicLink.url.includes('/claim')
                    ? 'One-Time Activation Claim Link Minted'
                    : 'One-Time Magic Access Link Minted'}
                </h3>
              </div>
              <button
                onClick={() => setGeneratedMagicLink(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            {/* Automatic Email Notification Pill */}
            {generatedMagicLink.email && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-950 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Sent Automatically via Email:</span>
                    <span className="ml-1 text-emerald-800">
                      Dispatched to <strong>{generatedMagicLink.email}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isResendingEmail}
                  onClick={async () => {
                    if (!generatedMagicLink.email) return;
                    setIsResendingEmail(true);
                    try {
                      await adminApi.dispatchAdminLinkEmail({
                        to: generatedMagicLink.email,
                        url: generatedMagicLink.url,
                        clientName: generatedMagicLink.clientName,
                        type: generatedMagicLink.isClaim ? 'claim' : 'magic',
                      });
                      setEmailResentSuccess(true);
                      setTimeout(() => setEmailResentSuccess(false), 3000);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsResendingEmail(false);
                    }
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold shadow-2xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {isResendingEmail ? 'Sending…' : emailResentSuccess ? 'Sent!' : 'Resend Email'}
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500">
              {generatedMagicLink.url.includes('/claim') ? (
                <>
                  A single-use account claim link has been generated and dispatched to{' '}
                  <strong>{generatedMagicLink.email || generatedMagicLink.clientName}</strong>. You can also copy it directly below.
                </>
              ) : (
                <>
                  A single-use magic login link has been generated and dispatched to{' '}
                  <strong>{generatedMagicLink.email || generatedMagicLink.clientName}</strong>. You can also copy it directly below.
                </>
              )}
            </p>
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <input
                type="text"
                readOnly
                value={generatedMagicLink.url}
                className="flex-1 bg-white px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 font-mono select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedMagicLink.url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setGeneratedMagicLink(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SERVICE & CLUSTER HEALTH                                         */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Cpu className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">NestJS Core Runtime</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {health?.status === 'ok' ? 'Online' : 'Degraded'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Uptime: {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m` : '—'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">PostgreSQL DB Latency</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {health?.database?.latencyMs ?? '—'} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Prisma Client Healthy</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Radio className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Rails</span>
              </div>
              <div className="space-y-1 mt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Paystack Gateway:</span>
                  <span className={`font-bold ${health?.environment?.paystackConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {health?.environment?.paystackConfigured ? 'READY' : 'STANDBY'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">M-PESA Daraja:</span>
                  <span className={`font-bold ${health?.environment?.darajaConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {health?.environment?.darajaConfigured ? 'READY' : 'STANDBY'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Terminal className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Node Heap Memory</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {health?.memory?.heapUsedMb ?? '—'} <span className="text-xs font-normal text-slate-400">MB</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Allocated Heap: {health?.memory?.heapTotalMb ?? '—'} MB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ORPHAN & UNAPPLIED PAYMENTS                                      */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'orphans' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Orphan &amp; Unapplied Payment Resolver</h3>
              <p className="text-xs text-slate-400">
                Transactions with missing invoice relations, orphan webhook errors, or unapplied successful payments
              </p>
            </div>
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold shrink-0">
              {orphanQuery.data?.count || 0} Orphan Transactions Found
            </span>
          </div>

          {orphanQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Scanning payment logs for orphan transactions…</div>
          ) : (orphanQuery.data?.items ?? []).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-700">All Payments Reconciled Cleanly</div>
              <div>No orphan or unapplied payment records detected across Paystack and Daraja rails.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Gateway</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Error / Reason</th>
                    <th className="py-2.5 px-3">Detected Candidate</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(orphanQuery.data?.items ?? []).map((item: any) => {
                    const isLinking = inFlightActionId === `orphan-${item.id}-LINK_AND_SETTLE`;
                    const isCrediting = inFlightActionId === `orphan-${item.id}-CREDIT_CLIENT`;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-700">{item.provider}</span>
                          <span className="text-[10px] text-slate-400 block">{item.method}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {item.currency} {item.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{item.providerRef}</td>
                        <td className="py-3 px-3 max-w-xs text-rose-600 font-medium text-[11px]">
                          {item.errorMessage || 'Successful payment unlinked to invoice'}
                        </td>
                        <td className="py-3 px-3">
                          {item.candidateClient ? (
                            <div>
                              <div className="font-semibold text-slate-800">{item.candidateClient.businessName}</div>
                              {item.candidateInvoice && (
                                <div className="text-[10px] text-slate-500">
                                  Candidate Inv: {item.candidateInvoice.invoiceNumber} (
                                  {item.currency} {Number(item.candidateInvoice.amount).toFixed(2)})
                                </div>
                              )}
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold mt-0.5 ${
                                  item.matchConfidence === 'HIGH'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.matchConfidence} MATCH CONFIDENCE
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">No candidate match found</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                          {item.candidateInvoice && (
                            <button
                              onClick={() =>
                                handleRemediateOrphan(
                                  item.id,
                                  'LINK_AND_SETTLE',
                                  item.candidateInvoice.id,
                                )
                              }
                              disabled={isLinking || isCrediting}
                              className="px-2.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              {isLinking ? 'Linking…' : 'Link & Settle'}
                            </button>
                          )}
                          {item.candidateClient && (
                            <button
                              onClick={() =>
                                handleRemediateOrphan(
                                  item.id,
                                  'CREDIT_CLIENT',
                                  undefined,
                                  item.candidateClient.id,
                                )
                              }
                              disabled={isLinking || isCrediting}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              {isCrediting ? 'Crediting…' : 'Credit Client'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: FLEET DNS & SSL RESOLVER                                         */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'dns' && (
        <div className="space-y-6">
          {/* Sub-panel 1: Single Domain Resolver */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Interactive Single Domain Inspector</h3>
              <p className="text-xs text-slate-400">
                Inspect public DNS records, Cloudflare edge proxying, and live TLS peer certificates for any domain
              </p>
            </div>

            <div className="flex gap-2 max-w-lg">
              <input
                type="text"
                value={dnsDomain}
                onChange={(e) => setDnsDomain(e.target.value)}
                placeholder="e.g. acaciahealthcare.co.ke"
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
              />
              <button
                onClick={handleCheckDns}
                disabled={resolveDnsMutation.isPending}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{resolveDnsMutation.isPending ? 'Resolving…' : 'Resolve DNS & SSL'}</span>
              </button>
            </div>

            {dnsError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{dnsError}</span>
              </div>
            )}

            {dnsResults && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Apex IP:</span>
                    <span className="font-mono font-bold text-slate-800">{dnsResults.ip}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Cloudflare Edge:</span>
                    <span className={`font-bold ${dnsResults.cloudflareProxied ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {dnsResults.cloudflareProxied ? 'Proxied (Active)' : 'Direct DNS'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">SSL Certificate:</span>
                    <span className={`font-bold ${dnsResults.sslValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {dnsResults.sslValid ? 'Valid & Trusted' : 'Invalid / Expired'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Issuer / Days Left:</span>
                    <span className="font-medium text-slate-700">
                      {dnsResults.sslIssuer} ({dnsResults.sslDaysLeft ?? '—'} days)
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200/60 max-h-40 overflow-y-auto">
                  {(dnsResults.records || []).map((r: any, idx: number) => (
                    <div key={idx}>
                      <span className="text-blue-600 font-bold">{r.type.padEnd(6)}</span> {r.target}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sub-panel 2: Fleet Health Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Platform Fleet DNS &amp; SSL Resolver</h3>
                <p className="text-xs text-slate-400">
                  Continuous scan across all registered client hosting domains, detecting expiration and IP drift
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                {dnsFleetQuery.data?.totalScanned || 0} Domains Scanned
              </span>
            </div>

            {dnsFleetQuery.isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Scanning fleet hosting accounts…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Domain</th>
                      <th className="py-2.5 px-3">Client Organization</th>
                      <th className="py-2.5 px-3">Resolved IP</th>
                      <th className="py-2.5 px-3">SSL Issuer</th>
                      <th className="py-2.5 px-3">Days Left</th>
                      <th className="py-2.5 px-3">Anomaly Status</th>
                      <th className="py-2.5 px-3 text-right">One-Click Remediation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dnsFleetQuery.data?.domains ?? []).map((d: any) => {
                      const isRefreshing = inFlightActionId === `ssl-${d.domain}-REFRESH_SSL`;
                      const isReissuing = inFlightActionId === `ssl-${d.domain}-REISSUE_SSL`;

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-900">{d.domain}</td>
                          <td className="py-3 px-3 text-slate-600">{d.client}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                            {d.resolvedIp}
                            {d.isCloudflare && (
                              <span className="ml-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                                CF
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-[11px]">{d.sslIssuer}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-bold ${
                                d.sslDaysLeft !== null && d.sslDaysLeft <= 7
                                  ? 'text-rose-600'
                                  : d.sslDaysLeft !== null && d.sslDaysLeft <= 30
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {d.sslDaysLeft !== null ? `${d.sslDaysLeft}d` : 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.anomaly === 'HEALTHY'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.anomaly === 'SSL_EXPIRING_7D'
                                  ? 'bg-amber-100 text-amber-800'
                                  : d.anomaly === 'SSL_EXPIRED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {d.anomaly}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => handleRemediateDnsSsl(d.domain, 'REFRESH_SSL', d.id)}
                              disabled={isRefreshing || isReissuing}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isRefreshing ? 'Refreshing…' : 'Refresh SSL'}
                            </button>
                            <button
                              onClick={() => handleRemediateDnsSsl(d.domain, 'REISSUE_SSL', d.id)}
                              disabled={isRefreshing || isReissuing}
                              className="px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                              {isReissuing ? 'Reissuing…' : 'Reissue SSL'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: WEBHOOK STREAM & BURSTS                                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'webhooks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Payment Gateway Webhook Stream &amp; Retry Desk</h3>
              <p className="text-xs text-slate-400">
                Monitor Paystack &amp; M-PESA Daraja events, inspect failure reasons, and replay dropped checkouts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setWebhookFilter('failures')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    webhookFilter === 'failures' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Failures &amp; Stale Only ({webhookFailuresQuery.data?.totalFailed || 0})
                </button>
                <button
                  onClick={() => setWebhookFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    webhookFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Full Stream
                </button>
              </div>

              <button
                onClick={handleRetryWebhooksBatch}
                disabled={inFlightActionId === 'wh-batch'}
                className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{inFlightActionId === 'wh-batch' ? 'Retrying…' : 'Batch Retry All Failed (24h)'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Client / Invoice</th>
                  <th className="py-2.5 px-3">Status / Category</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(webhookFilter === 'failures'
                  ? webhookFailuresQuery.data?.items ?? []
                  : webhookStreamQuery.data ?? []
                ).map((log: any) => {
                  const isRetrying = inFlightActionId === `wh-single-${log.id}`;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{log.gateway}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {log.currency} {Number(log.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{log.reference}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{log.client}</span>
                        {log.invoiceNumber && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Inv #{log.invoiceNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.errorMessage && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">
                            {log.errorMessage}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleReplaySingleWebhook(log.id)}
                          disabled={isRetrying}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-all"
                        >
                          {isRetrying ? 'Re-verifying…' : 'Re-verify & Settle'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: INVOICES & RECONCILIATION                                        */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Invoice Total &amp; Status Synchronization Desk</h3>
              <p className="text-xs text-slate-400">
                Identify invoices where line items sum differs from recorded total, or where successful payments exist without PAID status
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const rep = await reconcileMutation.mutateAsync();
                  showFeedback(`Gateway reconciliation scan complete: scanned ${rep?.scanned || 0}, settled ${rep?.settled || 0}.`);
                } catch (err: any) {
                  showFeedback(null, err?.message || 'Reconciliation failed.');
                }
              }}
              disabled={reconcileMutation.isPending}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{reconcileMutation.isPending ? 'Scanning Gateways…' : 'Run Live Gateway Reconciliation'}</span>
            </button>
          </div>

          {unsyncedInvoicesQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Evaluating invoices for mathematical discrepancies…</div>
          ) : (unsyncedInvoicesQuery.data?.items ?? []).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-700">All Invoice Totals and Statuses Match</div>
              <div>Zero line item mathematical discrepancies or payment status drifts detected.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Recorded Total</th>
                    <th className="py-2.5 px-3">Line Items Sum</th>
                    <th className="py-2.5 px-3">Applied Payments</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Discrepancy Details</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(unsyncedInvoicesQuery.data?.items ?? []).map((inv: any) => {
                    const isSyncing = inFlightActionId === `inv-${inv.id}-SYNC_FROM_PAYMENTS`;
                    const isRecalc = inFlightActionId === `inv-${inv.id}-RECALCULATE_FROM_ITEMS`;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-slate-700 font-semibold">{inv.client}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {inv.currency} {inv.recordedAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {inv.currency} {inv.sumLineItems.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-600 whitespace-nowrap">
                          {inv.currency} {inv.sumPayments.toFixed(2)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-amber-700 font-medium max-w-xs">
                          {inv.discrepancyDetails}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                          {inv.discrepancy === 'STATUS_DESYNC_PAID_AS_UNPAID' && (
                            <button
                              onClick={() => handleRemediateInvoice(inv.id, 'SYNC_FROM_PAYMENTS')}
                              disabled={isSyncing}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              {isSyncing ? 'Syncing…' : 'Sync to PAID'}
                            </button>
                          )}
                          {inv.discrepancy === 'LINE_ITEM_MISMATCH' && (
                            <button
                              onClick={() => handleRemediateInvoice(inv.id, 'RECALCULATE_FROM_ITEMS')}
                              disabled={isRecalc}
                              className="px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              {isRecalc ? 'Recalculating…' : 'Recalculate Total'}
                            </button>
                          )}
                          {inv.discrepancy === 'OVERDUE_DRIFT' && (
                            <button
                              onClick={() => handleRemediateInvoice(inv.id, 'MARK_OVERDUE')}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
                            >
                              Mark Overdue
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: CLIENT ACCESS & LOCKOUT DESK                                     */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'access' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Client Access &amp; Activation Desk</h3>
              <p className="text-xs text-slate-400">
                Surfaces suspended client accounts, soft-deleted user records, and active accounts awaiting password activation
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {actualLockedCount > 0 && (
                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">
                  {actualLockedCount} Suspended
                </span>
              )}
              {unclaimedCount > 0 && (
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                  {unclaimedCount} Unclaimed / Password Pending
                </span>
              )}
              {actualLockedCount === 0 && unclaimedCount === 0 && (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                  All Accounts Good
                </span>
              )}
            </div>
          </div>

          {clientAccessQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Scanning client accounts and auth status…</div>
          ) : (clientAccessQuery.data?.items ?? []).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-700">All Client Accounts in Good Standing</div>
              <div>No administrative suspensions or soft-deleted client users detected.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Organization</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Access / Lockout Standing</th>
                    <th className="py-2.5 px-3">Password Status</th>
                    <th className="py-2.5 px-3 text-right">One-Click Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(clientAccessQuery.data?.items ?? []).map((acc: any) => {
                    const isUnlocking = inFlightActionId === `access-${acc.clientId}-UNLOCK_ACCOUNT`;
                    const isGenerating = inFlightActionId === `access-${acc.clientId}-GENERATE_RESET_LINK`;
                    const isTrulyLocked =
                      acc.lockoutReason === 'CLIENT_SUSPENDED' ||
                      acc.lockoutReason === 'USER_SOFT_DELETED' ||
                      acc.lockoutReason === 'CLIENT_SOFT_DELETED' ||
                      acc.clientStatus === 'SUSPENDED';

                    return (
                      <tr key={acc.clientId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">{acc.businessName}</td>
                        <td className="py-3 px-3 text-slate-600">{acc.contactName || '—'}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{acc.email}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              acc.lockoutReason === 'CLIENT_SUSPENDED'
                                ? 'bg-amber-100 text-amber-800'
                                : acc.lockoutReason === 'USER_SOFT_DELETED' || acc.lockoutReason === 'CLIENT_SOFT_DELETED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {acc.lockoutReason === 'PASSWORD_UNSET' ? 'AWAITING_CLAIM' : acc.lockoutReason}
                          </span>
                          {acc.clientStatus === 'ACTIVE' && (
                            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Status: ACTIVE</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px]">
                          {acc.hasPassword ? (
                            <span className="text-emerald-700 font-medium">Password Set</span>
                          ) : (
                            <span className="text-blue-700 font-medium">Unclaimed / Passwordless</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                          {isTrulyLocked ? (
                            <button
                              onClick={() => handleRemediateAccess(acc.clientId, acc.businessName, 'UNLOCK_ACCOUNT')}
                              disabled={isUnlocking}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              {isUnlocking ? 'Unlocking…' : 'Unlock Account'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              ✓ Unlocked
                            </span>
                          )}
                          <button
                            onClick={() =>
                              handleRemediateAccess(acc.clientId, acc.businessName, 'GENERATE_RESET_LINK', acc.email)
                            }
                            disabled={isGenerating}
                            className="px-2.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                          >
                            {isGenerating
                              ? 'Sending…'
                              : acc.hasPassword
                              ? 'Send Magic Link'
                              : 'Send Claim Link'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 7: SUSPENDED DOMAINS DESK                                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'domains' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Suspended &amp; Stuck Domain States</h3>
              <p className="text-xs text-slate-400">
                Identifies domains suspended inconsistently (client has zero overdue invoices) or stuck in provisioning
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold shrink-0">
              {suspendedDomainsQuery.data?.totalSuspended || 0} Domains Flagged
            </span>
          </div>

          {suspendedDomainsQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Scanning hosting records and billing standing…</div>
          ) : (suspendedDomainsQuery.data?.items ?? []).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-700">All Client Workloads Active</div>
              <div>Zero inconsistent domain suspensions or stuck container deployments detected.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Domain</th>
                    <th className="py-2.5 px-3">Server Node</th>
                    <th className="py-2.5 px-3">Client Organization</th>
                    <th className="py-2.5 px-3">Overdue Invoices</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3 text-right">One-Click Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(suspendedDomainsQuery.data?.items ?? []).map((dom: any) => {
                    const isUnsuspending = inFlightActionId === `dom-${dom.id}-UNSUSPEND`;

                    return (
                      <tr key={dom.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">{dom.domain}</td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">{dom.server}</td>
                        <td className="py-3 px-3 text-slate-700 font-semibold">{dom.client}</td>
                        <td className="py-3 px-3">
                          {dom.overdueInvoicesCount === 0 ? (
                            <span className="font-bold text-emerald-600 text-[11px]">0 (Paid Up)</span>
                          ) : (
                            <span className="font-bold text-rose-600 text-[11px]">
                              {dom.overdueInvoicesCount} Overdue
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              dom.suspensionType === 'INCONSISTENT_SUSPENSION'
                                ? 'bg-rose-100 text-rose-800'
                                : dom.suspensionType === 'STUCK_PROVISIONING'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {dom.suspensionType === 'INCONSISTENT_SUSPENSION'
                              ? 'INCONSISTENT (Client Paid)'
                              : dom.suspensionType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleRemediateDomain(dom.id, dom.domain, 'UNSUSPEND')}
                            disabled={isUnsuspending}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                          >
                            {isUnsuspending ? 'Unsuspending…' : 'Unsuspend Domain'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 8: CLIENT IMPERSONATION / VIEW-AS SANDBOX                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTool === 'impersonation' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Safe Client Impersonation (&quot;View As Client&quot;)</h3>
            <p className="text-xs text-slate-400">
              Troubleshoot client dashboard issues in a scoped sandbox session without requesting client credentials
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Security Enforcement Policy:</span>
              <p className="mt-0.5 text-amber-800">
                Impersonation sessions automatically expire after 15 minutes. Every launch is logged permanently to the append-only `AuditLog` table.
              </p>
            </div>
          </div>

          <div className="flex gap-2 max-w-md">
            <select
              value={impersonateClient}
              onChange={(e) => setImpersonateClient(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="">-- Select Client Organization --</option>
              {(clientsQuery.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.contactName || c.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleImpersonate}
              disabled={impersonateMutation.isPending || !impersonateClient}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{impersonateMutation.isPending ? 'Minting…' : 'Launch Sandbox'}</span>
            </button>
          </div>

          {impersonationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{impersonationError}</span>
            </div>
          )}

          {impersonationSession && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-emerald-950">Scoped Session Ready:</span>
                <span className="text-emerald-800 ml-1">
                  Minted 15-minute access token for <strong>{impersonationSession.clientName}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const url = `/portal?sandbox_token=${encodeURIComponent(impersonationSession.token)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="px-3.5 py-1.5 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <span>Open Client Portal Sandbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTroubleshootingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-medium">Loading troubleshooting workstation…</div>}>
      <AdminTroubleshootingContent />
    </Suspense>
  );
}
