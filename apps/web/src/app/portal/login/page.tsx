'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/ui/Logo';

export default function PortalLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo variant="light" markClassName="h-10 w-auto" className="mb-6" />
          <h1 className="text-2xl font-bold text-[#0F172A]">Sign in to your portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your website, tickets, and invoices</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@yourcompany.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
                <a href="https://auth.bazionweb.com/realms/bazionweb/login-actions/reset-credentials"
                   className="text-xs text-[#2563EB] hover:underline" target="_blank" rel="noopener noreferrer">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-11"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Not a client yet?{' '}
          <Link href="/contact" className="text-[#2563EB] hover:underline">Get started →</Link>
        </p>
      </div>
    </div>
  );
}
