'use client';

import React, { useState } from 'react';
import {
  Globe,
  Check,
  Copy,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useClientHosting } from '@/hooks/usePortalData';
import { formatDate } from '@/lib/format';

const assetSovereigntyChecklist = [
  {
    asset: 'Domain Name & DNS Control',
    status: 'Client Sovereign (Delegated Access)',
    authority: 'Cloudflare / Safaricom Domains',
    details: 'Owned directly by your organization. Bazion Web holds delegated engineering member rights for managed hosting.',
    verified: true,
    color: 'border-emerald-200 bg-emerald-50/50',
  },
  {
    asset: 'SSL Certificate & Edge Security',
    status: 'Active (Automated TLS 1.3)',
    authority: 'Cloudflare Universal SSL',
    details: 'Next auto-renewal: April 2027. Full HSTS and DDoS Edge Protection enabled with certificate pinning.',
    verified: true,
    color: 'border-blue-200 bg-blue-50/50',
  },
  {
    asset: 'Google Search Console & Analytics',
    status: 'Verified Property Owner',
    authority: 'Google Workspace',
    details: 'Direct client ownership with bazion-dev service account mapped for sitemap submission and crawl reports.',
    verified: true,
    color: 'border-teal-200 bg-teal-50/50',
  },
  {
    asset: 'Codebase & Intellectual Property',
    status: '100% Client Owned',
    authority: 'Bazion Commercial Deed',
    details: 'Complete assignment of all custom code, assets, and databases upon milestone completion. No lock-in clauses.',
    verified: true,
    color: 'border-purple-200 bg-purple-50/50',
  },
];

const dnsRecords = [
  { type: 'A', name: '@', target: '172.67.194.82', proxy: 'Proxied (Cloudflare)', ttl: 'Auto' },
  { type: 'CNAME', name: 'www', target: 'acaciahealthcare.co.ke', proxy: 'Proxied', ttl: 'Auto' },
  { type: 'CNAME', name: 'staging', target: 'staging-acacia.bazionweb.com', proxy: 'Proxied', ttl: 'Auto' },
  { type: 'TXT', name: '@', target: 'v=spf1 include:_spf.google.com ~all', proxy: 'DNS Only', ttl: '300' },
  { type: 'MX', name: '@', target: 'mail.acaciahealthcare.co.ke', proxy: 'DNS Only', ttl: '300' },
];

export default function AssetsClient() {
  const { data: hostingAccounts } = useClientHosting();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const hostingAccount = hostingAccounts?.[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Asset Sovereignty & Infrastructure Hub</h2>
        <p className="text-xs text-slate-400 mt-1">
          Transparent proof of client ownership for domains, DNS, SSL, and intellectual property.
        </p>
      </div>

      {/* Live Hosting Status Banner */}
      {hostingAccount && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Globe className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#0F172A] font-mono">{hostingAccount.domain}</div>
              <div className="text-xs text-slate-400">{hostingAccount.plan} · {hostingAccount.server}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {hostingAccount.status}
            </span>
            {hostingAccount.sslExpiry && (
              <span className="text-xs text-slate-500">
                SSL expires: {formatDate(hostingAccount.sslExpiry)}
              </span>
            )}
            <a
              href={`https://${hostingAccount.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Visit Site <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Ownership Guarantee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assetSovereigntyChecklist.map((item, i) => (
          <div key={i} className={`rounded-2xl p-6 border flex flex-col justify-between shadow-xs ${item.color}`}>
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h4 className="font-bold text-[#0F172A] text-sm">{item.asset}</h4>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                  <Check className="w-3 h-3" /> {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{item.details}</p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
              <span>Registrar / Authority:</span>
              <strong className="text-slate-700">{item.authority}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* DNS Records Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#14B8A6]" />
              Active Edge DNS Records (Cloudflare Managed)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              High-speed global routing with automatic TLS 1.3 encryption and DDoS mitigation.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
              <tr>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Target Value</th>
                <th className="py-3 px-4">Proxy Status</th>
                <th className="py-3 px-4">TTL</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dnsRecords.map((record, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 font-mono">
                      {record.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">{record.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 max-w-xs truncate">{record.target}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      {record.proxy}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{record.ttl}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => copyToClipboard(record.target, `dns-${i}`)}
                      className="text-xs text-[#2563EB] hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copiedKey === `dns-${i}` ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
