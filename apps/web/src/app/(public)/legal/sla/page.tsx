import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Level Agreement',
  description: 'BazionWeb SLA — uptime guarantees, response times, and service credit definitions per plan.',
};

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal</span>
          <h1 className="text-4xl font-bold text-white mb-3">Service Level Agreement</h1>
          <p className="text-slate-400 text-sm">Version 1.0 · Effective June 1, 2025 · Applies to all active subscriptions</p>
        </div>
      </div>

      <div className="container-default max-w-3xl py-16 space-y-8">
        <div className="card p-8 md:p-10 space-y-8">

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-4">1. Uptime Guarantee by Plan</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#0F172A] text-white">
                    <th className="text-left px-4 py-3 font-semibold">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold">Monthly Uptime SLA</th>
                    <th className="text-left px-4 py-3 font-semibold">Max Downtime/mo</th>
                    <th className="text-left px-4 py-3 font-semibold">Service Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Starter', '99.9%', '43.8 minutes', '5% of monthly fee'],
                    ['Growth', '99.95%', '21.9 minutes', '10% of monthly fee'],
                    ['Business', '99.95%', '21.9 minutes', '15% of monthly fee'],
                    ['Enterprise', '99.99%', '4.3 minutes', '25% of monthly fee'],
                  ].map(([plan, sla, downtime, credit]) => (
                    <tr key={plan} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{plan}</td>
                      <td className="px-4 py-3 font-mono text-[#22C55E]">{sla}</td>
                      <td className="px-4 py-3 text-slate-600">{downtime}</td>
                      <td className="px-4 py-3 text-slate-600">{credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-4">2. Support Response Times</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#0F172A] text-white">
                    <th className="text-left px-4 py-3 font-semibold">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold">Definition</th>
                    <th className="text-left px-4 py-3 font-semibold">Starter</th>
                    <th className="text-left px-4 py-3 font-semibold">Growth</th>
                    <th className="text-left px-4 py-3 font-semibold">Business</th>
                    <th className="text-left px-4 py-3 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['P1 — Critical', 'Site completely down or payment processing broken', '1 hour', '30 min', '15 min', '5 min'],
                    ['P2 — High', 'Major feature broken; significant user impact', '4 hours', '2 hours', '1 hour', '30 min'],
                    ['P3 — Normal', 'Minor feature broken; workaround available', '1 business day', '4 hours', '4 hours', '2 hours'],
                    ['P4 — Low', 'Cosmetic issue; enhancement; general question', '2 business days', '1 business day', '8 hours', '4 hours'],
                  ].map(([priority, def, s, g, b, e]) => (
                    <tr key={priority} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-[#0F172A] whitespace-nowrap">{priority}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px]">{def}</td>
                      <td className="px-4 py-3 text-slate-600">{s}</td>
                      <td className="px-4 py-3 text-slate-600">{g}</td>
                      <td className="px-4 py-3 text-slate-600">{b}</td>
                      <td className="px-4 py-3 text-slate-600">{e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Exclusions</h2>
            <p className="text-slate-600 mb-3">The SLA does not apply during:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li>Scheduled maintenance (notified ≥72 hours in advance)</li>
              <li>Emergency security patches (notified as soon as practicable)</li>
              <li>Force majeure events (natural disasters, war, major internet backbone failures)</li>
              <li>Downtime caused by client actions, third-party integrations, or content</li>
              <li>DNS propagation periods during initial setup or domain transfers</li>
              <li>Cloudflare or upstream provider outages beyond our control</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. How Service Credits Work</h2>
            <p className="text-slate-600 leading-relaxed">
              Credits are applied automatically to your next invoice — you do not need to request them. Our monitoring system (Uptime Kuma) calculates downtime and triggers credit calculation at month-end. Credits are capped per plan percentage and are the sole remedy for uptime failures. Credits are non-refundable as cash.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Monitoring & Measurement</h2>
            <p className="text-slate-600 leading-relaxed">
              Uptime is measured by Uptime Kuma checking your site at 60-second intervals from our monitoring server. A site is considered "down" when three consecutive checks fail with a non-2xx/3xx response. Status is visible at <a href="https://status.bazionweb.com" className="text-[#2563EB]">status.bazionweb.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
