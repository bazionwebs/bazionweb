import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'BazionWeb Privacy Policy — how we collect, use, and protect your personal data under the Kenya Data Protection Act 2019 and GDPR.',
  alternates: { canonical: 'https://bazionweb.com/legal/privacy' },
};

const LAST_UPDATED = 'November 3, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Privacy Policy' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal & Compliance</span>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">
            Last updated: {LAST_UPDATED} · Compliant with Kenya Data Protection Act (2019) & GDPR (EU 2016/679)
          </p>
        </div>
      </div>

      <div className="container-default max-w-3xl py-16">
        <div className="card p-8 md:p-10 space-y-8 prose prose-slate max-w-none">

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Who We Are & Our Regulatory Roles</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              BazionWeb (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;), registered in Nairobi, Kenya, provides managed web hosting, cloud infrastructure, and application lifecycle platforms.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li>
                <strong>Data Controller:</strong> For personal data collected via bazionweb.com, the customer portal, client registrations, and Safaricom M-PESA billing records, BazionWeb determines the purpose and means of processing.
              </li>
              <li>
                <strong>Data Processor:</strong> When you deploy websites, databases, or container workloads on our servers, you act as the Data Controller, and BazionWeb acts as the Data Processor under our <a href="/legal/dpa" className="text-[#2563EB] underline">Data Processing Agreement (DPA)</a>.
              </li>
            </ul>
            <p className="text-slate-600 text-sm mt-3">
              Data Protection Contact: <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Personal Data We Collect</h2>
            <div className="overflow-x-auto not-prose">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Category</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Specific Data</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Statutory Basis (Kenya DPA Sec 30)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Account Identity', 'Full name, email address, phone number, company name', 'Performance of Contract'],
                    ['Payment & Billing', 'M-PESA phone number, M-PESA Receipt ID, CheckoutRequestID, card tokens, tax invoices', 'Performance of Contract / Legal Obligation'],
                    ['Authentication', 'Salted scrypt password hashes, MFA tokens, API authorization keys', 'Performance of Contract'],
                    ['Security & Telemetry', 'IP address, HTTP request headers, Traefik edge routing logs, firewall fail2ban events', 'Legitimate Interest (Cybersecurity)'],
                    ['Customer Support', 'Helpdesk tickets, incident logs, diagnostics', 'Performance of Contract'],
                    ['Client Workloads', 'Databases, uploads, container environments hosted on behalf of clients', 'Data Processing Agreement (Processor capacity)'],
                  ].map(([cat, data, basis]) => (
                    <tr key={cat}>
                      <td className="px-4 py-3 font-medium text-slate-800">{cat}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{data}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
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
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Technical & Organizational Security Measures</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              In accordance with Section 41 of the Kenya Data Protection Act and Article 32 of GDPR, we maintain robust defense-in-depth safeguards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
              {[
                ['Container Isolation', 'Strict Linux cgroups v2 resource limits and unprivileged container users (UID 1001)'],
                ['Encryption in Transit', 'Enforced TLS 1.3 / 1.2 with HSTS for all public routing and API communications'],
                ['Encrypted Off-Site Backups', 'Automated hourly/daily snapshots encrypted with client-side AES-256 via Restic'],
                ['Access Security', 'Hardware MFA and SSH key authentication required; zero direct root password access'],
                ['Network Segmentation', 'Isolated Docker bridge networks preventing inter-tenant cross-talk'],
                ['Data Masking', 'Customer MSISDN mobile numbers masked (+254 7****1234) in non-essential audit logs'],
              ].map(([title, desc]) => (
                <div key={title} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-sm font-bold text-slate-900 mb-1">{title}</div>
                  <div className="text-xs text-slate-600 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. International Transfers & Sub-Processors</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              Pursuant to Sections 48 and 49 of the Kenya Data Protection Act, 2019, transfers outside Kenya are governed by adequate data protection frameworks, Standard Contractual Clauses (SCCs), and strong encryption:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li><strong>Leaseweb B.V. (Netherlands/Germany):</strong> VPS worker nodes & compute infrastructure (EU GDPR Adequacy).</li>
              <li><strong>Hetzner Online GmbH (Germany):</strong> Secondary compute and failover capacity (EU GDPR Adequacy).</li>
              <li><strong>Backblaze Inc. (USA):</strong> Off-site disaster recovery storage (AES-256 client-encrypted snapshots prior to upload).</li>
              <li><strong>Cloudflare Inc. (Global Edge):</strong> Edge proxy, DDoS mitigation, and DNS security.</li>
              <li><strong>Safaricom PLC (Kenya):</strong> In-country M-PESA mobile billing gateway.</li>
              <li><strong>Paystack Payments (Kenya/Nigeria):</strong> PCI-DSS Level 1 certified payment processing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Data Retention & Destruction Schedule</h2>
            <p className="text-slate-600 leading-relaxed">
              We retain personal data strictly for as long as necessary:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li><strong>Active Client Accounts:</strong> Retained for contract duration plus 7 years for Kenya Revenue Authority (KRA) tax compliance.</li>
              <li><strong>Cancelled / Terminated Hosting Workloads:</strong> Retained in a dormant state for 30 calendar days to allow full data export, after which all volumes, databases, and snapshots are permanently and irrevocably shredded.</li>
              <li><strong>Server & Access Logs:</strong> Retained for 12 months for security and fraud auditing, then automatically purged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Your Statutory Rights (Section 26, Kenya DPA)</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              You possess enforceable rights regarding your personal information:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-sm">
              <li><strong>Right to be informed:</strong> Clear disclosure of all collection and processing activities.</li>
              <li><strong>Right of access:</strong> Obtain confirmation and copies of personal data held about you.</li>
              <li><strong>Right to rectification:</strong> Correct inaccurate or incomplete records without delay.</li>
              <li><strong>Right to erasure:</strong> Request deletion where statutory retention grounds no longer apply.</li>
              <li><strong>Right to object or restrict processing:</strong> Restrict processing or opt-out of marketing.</li>
              <li><strong>Right to data portability:</strong> Receive your data in a structured, machine-readable format.</li>
            </ul>
            <p className="text-slate-600 text-sm mt-3">
              To exercise your statutory rights, email <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>. We fulfill requests within thirty (30) days without charge.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Mandatory 72-Hour Breach Notification</h2>
            <p className="text-slate-600 leading-relaxed">
              In accordance with Section 43 of the Kenya Data Protection Act, in the event of an unauthorized security breach affecting personal data, BazionWeb will notify the Office of the Data Protection Commissioner (ODPC) within seventy-two (72) hours of confirmation, and promptly notify affected customers in writing with remedial actions and impact mitigation details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">8. Regulatory Contacts & Complaints</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have concerns regarding our data handling, please contact our Data Protection Team at <a href="mailto:privacy@bazionweb.com" className="text-[#2563EB]">privacy@bazionweb.com</a>.
            </p>
            <p className="text-slate-600 leading-relaxed mt-2 text-sm">
              You also have the statutory right to file a complaint directly with the national regulator:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1 not-prose mt-2">
              <div className="font-bold text-slate-900">Office of the Data Protection Commissioner (ODPC) Kenya</div>
              <div>Britam Tower, 12th Floor, Hospital Road, Upper Hill, Nairobi</div>
              <div>P.O. Box 30920 - 00100, Nairobi, Kenya</div>
              <div>Email: <a href="mailto:complaints@odpc.go.ke" className="text-[#2563EB]">complaints@odpc.go.ke</a> | Website: <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className="text-[#2563EB]">www.odpc.go.ke</a></div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
