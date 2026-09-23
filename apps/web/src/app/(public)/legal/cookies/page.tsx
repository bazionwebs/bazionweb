import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'BazionWeb Cookie Policy — what cookies and local storage items we use and why.',
  alternates: { canonical: 'https://bazionweb.com/legal/cookies' },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Cookie Policy' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal</span>
          <h1 className="text-4xl font-bold text-white mb-3">Cookie Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 1, 2025</p>
        </div>
      </div>
      <div className="container-default max-w-3xl py-16">
        <div className="card p-8 md:p-10 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">What Cookies We Use</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Cookie</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Type</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['bw_session', 'Strictly Necessary', 'Portal authentication session', '24 hours'],
                    ['bw_csrf', 'Strictly Necessary', 'CSRF protection token', 'Session'],
                    ['ph_distinct_id', 'Analytics (Opt-in)', 'PostHog user analytics', '1 year'],
                    ['ph_session', 'Analytics (Opt-in)', 'PostHog session tracking', '30 min'],
                    ['cf_clearance', 'Strictly Necessary', 'Cloudflare bot protection', '30 min'],
                  ].map(([name, type, purpose, duration]) => (
                    <tr key={name}>
                      <td className="px-4 py-3 font-mono text-xs text-[#2563EB]">{name}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${type.includes('Strictly') ? 'badge-blue' : 'badge-yellow'}`}>
                          {type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{purpose}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">Your Choices</h2>
            <p className="text-slate-600 leading-relaxed">
              Strictly necessary cookies cannot be disabled as they are required for the portal to function. You can opt out of analytics cookies via our cookie consent banner or by contacting <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>. Disabling analytics cookies does not affect your service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">Third-Party Cookies</h2>
            <p className="text-slate-600 leading-relaxed">
              We use Cloudflare for security and CDN. Their cookies (cf_clearance) are strictly necessary and governed by Cloudflare's privacy policy. We do not use advertising or social media tracking cookies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
