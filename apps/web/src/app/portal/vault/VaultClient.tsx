'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ShieldCheck, KeyRound, Mail, AlertCircle } from 'lucide-react';

/**
 * Credential handoff preview.
 *
 * The previous screen kept secrets only in React state while claiming
 * AES-256-GCM encryption at rest. Nothing was persisted or encrypted, which
 * is unsafe and misleading. The feature is disabled until a real encrypted
 * backend (envelope encryption + audit log) exists.
 */
export default function VaultClient() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Credentials Vault</h2>
        <p className="text-xs text-slate-400 mt-1">
          Secure handoff for API keys, payment webhooks, and registrar credentials.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 text-sm">Vault storage is not enabled yet</h3>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-2xl">
            Do not paste live credentials into this page — they are not stored.
            Until the encrypted vault ships, share secrets through the
            agreed secure channel with your account manager. Never send
            passwords or API keys by email or chat.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#14B8A6]" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm">How credential handoff works</h3>
            <ol className="list-decimal list-inside text-xs text-slate-600 mt-2 space-y-1 leading-relaxed">
              <li>Your lead engineer sends a single-use secret-sharing link from the agreed provider (for example 1Password or Bitwarden Send).</li>
              <li>You paste the credential there, with an expiry you control.</li>
              <li>The engineer stores it in the deployment secret manager and confirms receipt. The link expires.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#2563EB]" />
            Stored Credentials (0)
          </h3>
        </div>
        <div className="p-12 text-center">
          <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No credentials stored</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            This workspace will list encrypted credentials once the vault backend is live.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
          >
            <Mail className="w-3.5 h-3.5" />
            Request a secure handoff link
          </Link>
        </div>
      </div>
    </div>
  );
}
