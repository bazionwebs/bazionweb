import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'BazionWeb Privacy Policy — how we collect, use, and protect your personal data. GDPR and POPIA compliant.',
  alternates: { canonical: 'https://bazionweb.com/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Privacy Policy' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal</span>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 1, 2025 · Compliant with GDPR (EU) 2016/679</p>
        </div>
      </div>

      <div className="container-default max-w-3xl py-16">
        <div className="card p-8 md:p-10 space-y-8 prose prose-slate max-w-none">

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Who We Are (Data Controller)</h2>
            <p className="text-slate-600 leading-relaxed">
              BazionWeb ("we", "our", "us") is the data controller for personal data collected via bazionweb.com and our client portal. Contact: <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Data We Collect (GDPR Art. 13)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Data</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Name, email, phone', 'Account creation, service delivery', 'Contract'],
                    ['Billing address, payment info', 'Invoice generation, payment processing', 'Contract'],
                    ['Usage data, logs', 'Security monitoring, debugging', 'Legitimate interest'],
                    ['IP address, browser info', 'Fraud prevention, uptime monitoring', 'Legitimate interest'],
                    ['Support ticket content', 'Service delivery, quality improvement', 'Contract'],
                    ['Email communications', 'Support, notifications, marketing (opt-in)', 'Consent / Contract'],
                  ].map(([data, purpose, basis]) => (
                    <tr key={data}>
                      <td className="px-4 py-3 text-slate-600">{data}</td>
                      <td className="px-4 py-3 text-slate-500">{purpose}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${basis === 'Contract' ? 'badge-blue' : basis === 'Consent' ? 'badge-green' : 'badge-slate'}`}>
                          {basis}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Data Retention</h2>
            <p className="text-slate-600 leading-relaxed">
              Active client data is retained for the duration of the contract plus 7 years for tax/legal compliance. Support tickets: 3 years. Marketing data: until opt-out or 2 years of inactivity. Audit logs: 5 years (GDPR compliance requirement). Backup data: per plan retention schedule (30–365 days).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Third-Party Processors</h2>
            <p className="text-slate-600 leading-relaxed mb-3">We share data with these processors under DPA agreements:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-sm">
              <li>Hetzner / Oracle Cloud — Infrastructure hosting (Germany / USA)</li>
              <li>Cloudflare — CDN, DNS, DDoS protection (USA — EU SCCs in place)</li>
              <li>Backblaze B2 — Encrypted backup storage (USA — EU SCCs in place)</li>
              <li>Resend — Transactional email (USA — EU SCCs in place)</li>
              <li>Sentry — Error monitoring (USA — EU SCCs in place)</li>
            </ul>
            <p className="text-slate-500 text-sm mt-3">We do not sell personal data to any third party.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed mb-3">Under GDPR and POPIA, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li><strong>Access</strong> — request a copy of your personal data</li>
              <li><strong>Rectification</strong> — correct inaccurate data</li>
              <li><strong>Erasure</strong> — request deletion (subject to legal retention obligations)</li>
              <li><strong>Portability</strong> — receive your data in machine-readable format</li>
              <li><strong>Object</strong> — opt out of legitimate-interest processing</li>
              <li><strong>Withdraw consent</strong> — at any time, for consent-based processing</li>
            </ul>
            <p className="text-slate-500 text-sm mt-3">
              Submit requests to: <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>. We respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Data Breach Notification</h2>
            <p className="text-slate-600 leading-relaxed">
              In the event of a personal data breach, we will notify affected clients within 72 hours of discovery, in accordance with GDPR Article 33. Notification will include the nature of the breach, data affected, likely consequences, and remediation actions taken.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Cookies</h2>
            <p className="text-slate-600 leading-relaxed">
              We use strictly necessary cookies for portal authentication and session management. Analytics cookies (PostHog) require your consent. See our <a href="/legal/cookies" className="text-[#2563EB]">Cookie Policy</a> for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">8. Contact & Complaints</h2>
            <p className="text-slate-600 leading-relaxed">
              Data Protection contact: <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a><br />
              You have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
