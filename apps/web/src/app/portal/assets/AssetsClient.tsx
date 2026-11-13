'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe,
  Check,
  Clock,
  ShieldCheck,
  ExternalLink,
  Server,
  HardDrive,
  Database,
  KeyRound,
} from 'lucide-react';
import { useClientHosting, useClientProjects } from '@/hooks/usePortalData';
import { QueryError, SectionLoading } from '@/components/ui/QueryState';
import { formatDate, titleCase } from '@/lib/format';
import { cn, toSafeExternalUrl } from '@/lib/utils';

const HOST_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PROVISIONING: 'bg-blue-100 text-blue-800 border-blue-200',
  MIGRATING: 'bg-amber-100 text-amber-800 border-amber-200',
  SUSPENDED: 'bg-rose-100 text-rose-800 border-rose-200',
  DECOMMISSIONED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AssetsClient() {
  const { data: hostingAccounts = [], isLoading, isError, error, refetch } = useClientHosting();
  const { data: projects = [] } = useClientProjects();

  const primaryHost = hostingAccounts[0];
  const hasLiveHost = hostingAccounts.length > 0;
  const activeProject = projects[0];

  const sovereigntyCards = [
    {
      asset: 'Codebase & Intellectual Property',
      status: '100% Client Owned',
      verified: true,
      authority: 'BazionWeb Commercial Deed',
      details:
        'Full legal assignment of custom application source code, design tokens, and database schemas upon project completion — zero vendor lock-in.',
      color: 'border-purple-200 bg-purple-50/40',
    },
    {
      asset: 'Domain Name & DNS Sovereignty',
      status: hasLiveHost ? 'Delegated & Active' : 'Pending Domain Cutover',
      verified: hasLiveHost,
      authority: hasLiveHost
        ? hostingAccounts.map(h => h.domain).join(', ')
        : 'Client Registrar Account',
      details: hasLiveHost
        ? `Primary domain (${primaryHost.domain}) remains registered in your organization's name with delegated Cloudflare DNS routing.`
        : 'Your domain always stays registered under your own registrar account. Share DNS/registrar access via the Encrypted Vault when ready for cutover.',
      color: hasLiveHost ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white',
    },
    {
      asset: 'TLS / SSL Edge Encryption',
      status: primaryHost?.sslExpiry ? 'Active TLS 1.3' : 'Issued at Cutover',
      verified: Boolean(primaryHost?.sslExpiry),
      authority: primaryHost?.sslIssuer || 'Cloudflare / Let’s Encrypt Automated CA',
      details: primaryHost?.sslExpiry
        ? `Active SSL certificate verified through ${formatDate(primaryHost.sslExpiry)} with automatic renewal and HSTS headers.`
        : 'Automated TLS 1.3 certificates and HSTS edge headers are issued automatically as soon as your production domain points to our edge.',
      color: primaryHost?.sslExpiry ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white',
    },
    {
      asset: 'Search Console & First-Party Analytics',
      status: hasLiveHost ? 'Client Property' : 'Configured at Launch',
      verified: hasLiveHost,
      authority: 'Client Google Workspace',
      details:
        'Google Search Console, sitemap indexing, and analytics properties are provisioned directly under your corporate email.',
      color: hasLiveHost ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-white',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F172A]">
            Asset Sovereignty &amp; Infrastructure Hub
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Live hosting telemetry, SSL expiry tracking, backup verification, and contractual ownership guarantees.
          </p>
        </div>

        <Link
          href="/portal/vault"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-colors self-start sm:self-auto"
        >
          <KeyRound className="w-3.5 h-3.5 text-[#14B8A6]" />
          Manage Domain Credentials
        </Link>
      </div>

      {isLoading && <SectionLoading label="Checking managed hosting & DNS accounts…" />}

      {isError && !isLoading && (
        <QueryError message={error?.message} onRetry={() => refetch()} />
      )}

      {/* Live Hosting Accounts */}
      {!isLoading && !isError && hostingAccounts.length > 0 && (
        <div className="space-y-4">
          {hostingAccounts.map(account => {
            const badgeClass =
              HOST_STATUS_STYLE[account.status] ?? 'bg-slate-100 text-slate-700 border-slate-200';
            const backups = account.backups ?? [];

            return (
              <div
                key={account.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base font-black text-[#0F172A] font-mono">
                          {account.domain}
                        </span>
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', badgeClass)}>
                          {titleCase(account.status)}
                        </span>
                        {account.platformProvisioning && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700">
                            Platform managed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {account.plan} · Node: <span className="font-mono text-slate-600">{account.server}</span>
                        {account.ipAddress ? ` · IP ${account.ipAddress}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {(() => {
                      const platformUrl = toSafeExternalUrl(process.env.NEXT_PUBLIC_PLATFORM_APP_URL);
                      if (!platformUrl || !account.platformProvisioning) return null;
                      return (
                        <a
                          href={`${platformUrl.replace(/\/+$/, '')}/workspace?ref=${encodeURIComponent(account.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          Open Product Workspace <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      );
                    })()}
                    <a
                      href={`https://${account.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#2563EB] hover:bg-blue-50 transition-colors"
                    >
                      Visit Live Domain <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {account.platformProvisioning && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-950">
                    <span className="font-bold">Platform provisioning:</span>{' '}
                    {titleCase(account.platformProvisioning.status)}
                    {account.platformProvisioning.currentStep
                      ? ` · ${titleCase(account.platformProvisioning.currentStep.replaceAll('_', ' '))}`
                      : ''}
                    {account.platformProvisioning.updatedAt
                      ? ` · Updated ${formatDate(account.platformProvisioning.updatedAt)}`
                      : ''}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">SSL Expiry</div>
                    <div className="font-bold text-[#0F172A] mt-0.5">
                      {account.sslExpiry ? formatDate(account.sslExpiry) : 'Pending Issuance'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> Disk Usage
                    </div>
                    <div className="font-bold text-[#0F172A] mt-0.5">
                      {account.diskUsageMb != null
                        ? `${(account.diskUsageMb / 1024).toFixed(2)} GB`
                        : 'Managed Elastic'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Server className="w-3 h-3" /> Runtime Stack
                    </div>
                    <div className="font-bold text-[#0F172A] mt-0.5">
                      {account.serverOs || 'Linux Edge Container'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Database className="w-3 h-3" /> Recent Backups
                    </div>
                    <div className="font-bold text-[#0F172A] mt-0.5">
                      {backups.length > 0 ? `${backups.length} snapshots` : 'Scheduled nightly'}
                    </div>
                  </div>
                </div>

                {backups.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Latest Offsite Snapshots
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {backups.slice(0, 3).map((b, idx) => (
                        <div
                          key={b.id ?? idx}
                          className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600 font-medium">{formatDate(b.createdAt)}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              b.status === 'COMPLETED' || b.status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800',
                            )}
                          >
                            {titleCase(b.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && hostingAccounts.length === 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">
                {activeProject
                  ? `Domain cutover scheduled for "${activeProject.name}"`
                  : 'No managed domain linked yet'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                {activeProject
                  ? 'Your application is currently in engineering build before production DNS cutover. If you already own a domain, deposit registrar or Cloudflare credentials into the Encrypted Vault so our engineers can prepare zero-downtime cutover.'
                  : 'Once your production domain is connected, live SSL validity, edge node details, and nightly backup snapshots appear here.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/portal/packages?tab=hosting"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-700 text-xs font-bold transition-colors"
            >
              Explore Managed Hosting
            </Link>
            <Link
              href="/portal/support?category=HOSTING"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              Request DNS Onboarding
            </Link>
          </div>
        </div>
      )}

      {/* Ownership Guarantee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sovereigntyCards.map((item, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl p-6 border flex flex-col justify-between shadow-xs',
              item.color,
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h4 className="font-bold text-[#0F172A] text-sm">{item.asset}</h4>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border',
                    item.verified
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200',
                  )}
                >
                  {item.verified ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{item.details}</p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400 gap-2">
              <span>Authority / Scope:</span>
              <strong className="text-slate-700 truncate">{item.authority}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* DNS Governance Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm">
              Need custom MX, TXT, or subdomain DNS records?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
              To prevent accidental apex or mail-routing outages, live DNS zone edits go through peer-reviewed engineering change requests or your own Cloudflare account.
            </p>
          </div>
        </div>
        <Link
          href="/portal/support?category=HOSTING"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shrink-0 transition-colors"
        >
          Request DNS Record Change
        </Link>
      </div>
    </div>
  );
}
