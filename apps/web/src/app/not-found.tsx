import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <Logo variant="dark" markClassName="h-24 w-auto" className="justify-center mb-8" />

        {/* 404 */}
        <div className="text-8xl font-black text-white/10 mb-2 leading-none">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-slate-400 mb-10 leading-relaxed">
          This page doesn&apos;t exist — or has been moved. Let&apos;s get you back somewhere useful.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="btn-primary px-6 py-3">
            <Home className="w-4 h-4" />
            Back to home
          </Link>
          <Link
            href="javascript:history.back()"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Link>
        </div>
      </div>
    </div>
  );
}
