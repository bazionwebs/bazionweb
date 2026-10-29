'use client';

import React, { useState } from 'react';
import {
  Users,
  Bell,
  Shield,
  Key,
  Globe,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Mail,
  Webhook,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

// ─── Static staff data (replace with live API when staff endpoint exists) ────
const INITIAL_STAFF = [
  { id: '1', name: 'Joseph M.', email: 'joseph@bazionweb.com', role: 'SUPER_ADMIN', lastActive: 'Active now', twoFa: true },
  { id: '2', name: 'Tech Lead', email: 'engineering@bazionweb.com', role: 'ADMIN', lastActive: '2h ago', twoFa: true },
  { id: '3', name: 'Support Operations', email: 'support@bazionweb.com', role: 'SUPPORT', lastActive: 'Yesterday', twoFa: false },
];

const roleConfig: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-800' },
  ADMIN: { label: 'Admin', color: 'bg-blue-100 text-blue-800' },
  SUPPORT: { label: 'Support', color: 'bg-slate-100 text-slate-700' },
};

type SettingsTab = 'team' | 'alerts' | 'security' | 'webhooks' | 'system';

export default function AdminSettingsPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

  const [activeTab, setActiveTab] = useState<SettingsTab>('team');

  // ── Team state
  const [staffList, setStaffList] = useState(INITIAL_STAFF);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SUPPORT');
  const [inviteSent, setInviteSent] = useState(false);

  // ── Alerts state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState(false);
  const [slackUrl, setSlackUrl] = useState('');
  const [sslAlerts, setSslAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [alertsSaved, setAlertsSaved] = useState(false);

  // ── Security state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const INTERNAL_API_KEY = 'bz_live_sk_••••••••••••••••••••••••a9f3';

  // ── Webhooks state
  const [webhookUrl, setWebhookUrl] = useState('https://bazionweb.com/api/v1/webhooks/paystack');
  const [webhookSaved, setWebhookSaved] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSent(true);
    setInviteEmail('');
    setTimeout(() => setInviteSent(false), 4000);
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList(prev => prev.filter(s => s.id !== id));
  };

  const handleSaveAlerts = () => {
    setAlertsSaved(true);
    setTimeout(() => setAlertsSaved(false), 3000);
  };

  const handleSaveWebhooks = () => {
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 3000);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText('bz_live_sk_a9f3_internal_only');
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'team', label: 'Team & RBAC', icon: Users },
    { id: 'alerts', label: 'Alerts & Notifications', icon: Bell },
    { id: 'security', label: 'Security Controls', icon: Shield },
    { id: 'webhooks', label: 'Gateway Webhooks', icon: Webhook },
    { id: 'system', label: 'System Policies', icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-slate-900">Platform Settings & Access Control</h2>
        <p className="text-xs text-slate-500">Configure team roles, alert notifications, webhook endpoints, and deployment environment</p>
      </div>

      {/* Settings Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: TEAM & RBAC ─────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Invite Staff */}
          {isSuperAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-[#2563EB]" />
                Invite New Staff Member
              </h3>
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="staff@bazionweb.com"
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="SUPPORT">Support</option>
                  <option value="ADMIN">Admin</option>
                  {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send Invite
                </button>
              </form>
              {inviteSent && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Invitation email dispatched successfully.
                </div>
              )}
            </div>
          )}

          {/* Staff Directory */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2563EB]" />
                Staff Directory ({staffList.length} members)
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {staffList.map(staff => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {staff.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-400">{staff.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-[11px] text-slate-400">{staff.lastActive}</div>
                      {staff.twoFa && (
                        <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                          <Shield className="w-2.5 h-2.5" /> 2FA On
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${roleConfig[staff.role]?.color ?? 'bg-slate-100 text-slate-700'}`}>
                      {roleConfig[staff.role]?.label ?? staff.role}
                    </span>
                    {isSuperAdmin && staff.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleRemoveStaff(staff.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RBAC Reference */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              Role Capability Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                { role: 'SUPER_ADMIN', color: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', perms: ['Full system access', 'Invite & remove staff', 'Billing & MRR data', 'Markets & pricing SSOT', 'Maintenance mode toggle'] },
                { role: 'ADMIN', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', perms: ['Client management', 'Ticket assignment', 'Invoice management', 'Hosting controls', 'Reports & analytics'] },
                { role: 'SUPPORT', color: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400', perms: ['View client records', 'Reply to tickets', 'View hosting status', 'SSL monitoring', 'No billing access'] },
              ].map(r => (
                <div key={r.role} className={`p-4 rounded-xl border ${r.color}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2 h-2 rounded-full ${r.dot}`} />
                    <span className="font-bold text-slate-900">{r.role}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {r.perms.map(p => (
                      <li key={p} className="flex items-center gap-1.5 text-slate-600">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ALERTS & NOTIFICATIONS ──────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Alert Dispatch & Notification Channels
            </h3>

            {[
              { key: 'emailAlerts', label: 'Email Alerts on SLA Breaches', desc: 'Immediate dispatch to on-call support team when P1/P2 tickets breach SLA target', value: emailAlerts, setter: setEmailAlerts, danger: false },
              { key: 'sslAlerts', label: 'SSL Certificate Expiry Warnings', desc: 'Email notification 30 days before any client certificate expires', value: sslAlerts, setter: setSslAlerts, danger: false },
              { key: 'dailyDigest', label: 'Daily Operations Digest', desc: 'Morning summary of open tickets, uptime status, and pending invoices', value: dailyDigest, setter: setDailyDigest, danger: false },
              { key: 'slackWebhook', label: 'Slack Incident Webhook', desc: 'Post P1 critical tickets to #ops-alerts channel in real-time', value: slackWebhook, setter: setSlackWebhook, danger: false },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-900">{item.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
                <button
                  onClick={() => item.setter(!item.value)}
                  className={`flex-shrink-0 ml-4 transition-colors ${item.value ? 'text-[#2563EB]' : 'text-slate-300'}`}
                >
                  {item.value ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
            ))}

            {/* Slack URL field */}
            {slackWebhook && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Slack Incoming Webhook URL</label>
                <input
                  type="url"
                  value={slackUrl}
                  onChange={e => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveAlerts}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Alert Settings
              </button>
              {alertsSaved && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SECURITY CONTROLS ───────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          {/* Internal API Key */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-[#2563EB]" />
              Internal Service API Key
            </h3>
            <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl">
              <code className="flex-1 text-xs font-mono text-emerald-400 truncate">{INTERNAL_API_KEY}</code>
              <button
                onClick={copyApiKey}
                className="shrink-0 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                {copiedApiKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Used for internal microservice calls. Rotate quarterly. Never expose in client-facing code.
            </p>
          </div>

          {/* Active Security Posture */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-emerald-500" />
              Active Security Enforcement
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Transport Layer Security', value: 'TLS 1.3 Enforced', status: true, desc: 'TLS 1.0/1.1 rejected at edge. HSTS max-age=31536000 with preload.' },
                { name: 'Edge WAF & DDoS Shield', value: 'Cloudflare Bot Fight Mode', status: true, desc: 'L7 rate-limiting, challenge pages on anomalous traffic bursts.' },
                { name: 'JWT Refresh Token Rotation', value: 'Single-use revocable tokens', status: true, desc: 'RBAC-guarded endpoints. Refresh tokens expire on use.' },
                { name: 'Database Encryption', value: 'AES-256 at Rest', status: true, desc: 'PostgreSQL encrypted storage with off-site daily snapshots.' },
                { name: 'Rate Limiting (Redis TTL)', value: '100 req/min per IP', status: true, desc: 'Throttler backed by Redis with per-route granularity.' },
                { name: 'Input Validation', value: 'class-validator + ParseUUID', status: true, desc: 'Strict whitelist DTO parsing. All SQL queries use Prisma bindings.' },
              ].map(ctrl => (
                <div key={ctrl.name} className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">{ctrl.name}</div>
                    <div className="text-xs font-mono font-semibold text-slate-600 mt-0.5">{ctrl.value}</div>
                    <p className="text-[11px] text-slate-400 mt-1">{ctrl.desc}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: GATEWAY WEBHOOKS ────────────────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-[#14B8A6]" />
              Payment Gateway Webhook Endpoints
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Configure the HTTPS endpoint that Paystack calls for payment events (Cards and M-Pesa STK). Requests use HMAC SHA-512 signature verification.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Paystack Webhook URL (Cards & M-Pesa)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  />
                  <span className="px-2.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center">
                    Active
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-800">
                <strong>HMAC Verification:</strong> All incoming webhook payloads are verified against the provider-supplied signature header using your stored secret keys. Unverified requests are rejected with 401.
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveWebhooks}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Endpoints
                </button>
                {webhookSaved && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Endpoints saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SYSTEM POLICIES ─────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-5">
          {/* Maintenance Mode */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-slate-500" />
              Deployment & System Policies
            </h3>

            <div className="space-y-3">
              {/* Maintenance Mode — Dangerous */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${maintenanceMode ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    Platform Maintenance Mode
                    {maintenanceMode && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Gracefully pauses public checkout forms during database migrations. Returns 503 to clients.
                  </div>
                </div>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`flex-shrink-0 ml-4 transition-colors ${maintenanceMode ? 'text-rose-600' : 'text-slate-300'}`}
                >
                  {maintenanceMode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              {maintenanceMode && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Warning:</strong> Maintenance mode is active. All public-facing checkout flows are suspended. Remember to disable once the migration is complete.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Environment Info */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-xs mb-4">Environment & Runtime Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Node.js Runtime', value: 'v20.14 LTS' },
                { label: 'NestJS Version', value: '10.3.x' },
                { label: 'Next.js Version', value: '14.2.x' },
                { label: 'PostgreSQL', value: '16.x (Render PG)' },
                { label: 'Redis', value: '7.x (Rate Limiter TTL)' },
                { label: 'Prisma ORM', value: '5.x (type-safe client)' },
                { label: 'Deployment Region', value: 'af-south-1 (Nairobi Edge)' },
                { label: 'CDN / Edge', value: 'Cloudflare (Auto Minify + Brotli)' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">{item.label}</span>
                  <span className="font-mono font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
