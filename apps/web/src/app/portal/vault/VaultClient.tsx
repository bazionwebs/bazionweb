'use client';

import React, { useState } from 'react';
import {
  Lock,
  Plus,
  ShieldCheck,
  KeyRound,
  Trash2,
  X,
} from 'lucide-react';

interface VaultSecret {
  id: string;
  key: string;
  preview: string;
  env: string;
  addedAt: string;
}

const INITIAL_SECRETS: VaultSecret[] = [
  { id: '1', key: 'M-Pesa Daraja Consumer Secret', preview: '••••••••••••••••94b2', env: 'Production API', addedAt: 'Sep 12, 2026' },
  { id: '2', key: 'Google Maps JavaScript API Key', preview: 'AIzaSyD••••••••••••••••kX02', env: 'Client Maps', addedAt: 'Sep 14, 2026' },
  { id: '3', key: 'SendGrid Transactional API Token', preview: 'SG.••••••••••••••••a821', env: 'Notification Mailer', addedAt: 'Sep 20, 2026' },
];

export default function VaultClient() {
  const [secrets, setSecrets] = useState<VaultSecret[]>(INITIAL_SECRETS);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newEnv, setNewEnv] = useState('Production API');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newVal.trim()) return;
    setSecrets(prev => [
      ...prev,
      {
        id: String(Date.now()),
        key: newKey.trim(),
        preview: '••••••••••••••••' + newVal.slice(-4),
        env: newEnv,
        addedAt: new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }),
      },
    ]);
    setNewKey('');
    setNewVal('');
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    setSecrets(prev => prev.filter(s => s.id !== id));
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F172A]">Zero-Knowledge Credentials Vault</h2>
          <p className="text-xs text-slate-400 mt-1">
            Safely deposit API keys, payment webhooks, and registrar secrets without sending them over unencrypted emails.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Deposit Encrypted Secret
        </button>
      </div>

      {/* Security Policy Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#14B8A6]" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm">AES-256 Encryption at Rest</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              All secrets are encrypted using AES-256-GCM before storage. The encryption key is derived using PBKDF2 and stored in a separate key management service — no Bazion engineer can read the raw plaintext value. Accessible exclusively to your assigned lead engineer for deployment.
            </p>
          </div>
        </div>
      </div>

      {/* Vault Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#2563EB]" />
            Stored Credentials ({secrets.length})
          </h3>
        </div>

        {secrets.length === 0 ? (
          <div className="p-12 text-center">
            <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No secrets stored yet</p>
            <p className="text-xs text-slate-400 mt-1">Deposit your first encrypted credential above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 text-left">
                <tr>
                  <th className="py-3 px-4">Secret Name</th>
                  <th className="py-3 px-4">Environment</th>
                  <th className="py-3 px-4">Encrypted Preview</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {secrets.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                        {s.key}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{s.env}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.preview}</td>
                    <td className="py-3 px-4 text-slate-400">{s.addedAt}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                        AES-256 Encrypted
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {deleteConfirmId === s.id ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Deposit Secret to Vault</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Encrypted at database level — never transmitted in plain text.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Secret Name</label>
                <input
                  type="text"
                  required
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="e.g. M-Pesa Passkey / Mailgun API Key"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Environment / Scope</label>
                <select
                  value={newEnv}
                  onChange={e => setNewEnv(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option>Production API</option>
                  <option>Staging API</option>
                  <option>Client Maps</option>
                  <option>Notification Mailer</option>
                  <option>Payment Gateway</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Secret Value</label>
                <textarea
                  required
                  value={newVal}
                  onChange={e => setNewVal(e.target.value)}
                  placeholder="Paste sensitive token or credential..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none min-h-[90px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Save Encrypted Secret
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
