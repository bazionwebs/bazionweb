import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Data Processing Agreement (DPA) | BazionWeb',
  description: 'BazionWeb Data Processing Agreement — compliant with Kenya Data Protection Act 2019 (Section 30) and GDPR Article 28.',
  alternates: { canonical: 'https://bazionweb.com/legal/dpa' },
};

const LAST_UPDATED = 'November 3, 2026';

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Data Processing Agreement' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal & Compliance</span>
          <h1 className="text-4xl font-bold text-white mb-3">Data Processing Agreement</h1>
          <p className="text-slate-400 text-sm">
            Version 2.0 · Effective: {LAST_UPDATED} · Kenya DPA 2019 (Sec. 30) & GDPR (Art. 28) Compliant
          </p>
        </div>
      </div>

      <div className="container-default max-w-3xl py-16">
        <div className="card p-8 md:p-10 space-y-8 prose prose-slate max-w-none">

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 not-prose">
            <p className="text-sm text-[#1E40AF] font-medium leading-relaxed">
              This Data Processing Agreement (&ldquo;DPA&rdquo;) forms an integral part of the BazionWeb Service Agreement. It governs all processing of personal data by BazionWeb (as Data Processor) on behalf of our clients (as Data Controllers) within our managed hosting and cloud deployment infrastructure.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Parties & Capacities</h2>
            <p className="text-slate-600 leading-relaxed">
              <strong>Data Controller:</strong> The Client, as identified in the Service Order or customer portal account.<br />
              <strong>Data Processor:</strong> BazionWeb, registered in Nairobi, Kenya (ODPC Registered Data Controller & Data Processor).<br />
              This DPA supplements the Hosting Terms of Service and supersedes any conflicting terms regarding personal data processing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Subject Matter & Processing Scope</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              BazionWeb processes personal data solely to provide, operate, and maintain the contracted hosting and deployment services, including:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li>Hosting customer databases (PostgreSQL, MariaDB) and Docker application workloads;</li>
              <li>Performing automated, client-side encrypted off-site backups via Restic to Backblaze B2;</li>
              <li>Managing edge proxy routing, domain SSL termination, and DDoS mitigation via Traefik and Cloudflare;</li>
              <li>Collecting server health and error telemetry for performance and uptime guarantees;</li>
              <li>Executing customer-directed application deployments, rollbacks, and software upgrades.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Processor Obligations (Kenya DPA Sec. 30)</h2>
            <p className="text-slate-600 leading-relaxed mb-2">BazionWeb covenants and agrees to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li><strong>Documented Instructions:</strong> Process personal data strictly on documented instructions from the Controller;</li>
              <li><strong>Confidentiality:</strong> Ensure all engineers and staff authorized to access systems are bound by written non-disclosure obligations;</li>
              <li><strong>Security Measures:</strong> Implement technical and organizational security controls pursuant to Section 41 of the Kenya DPA (cgroups v2 container isolation, TLS 1.3, AES-256 backup encryption);</li>
              <li><strong>Sub-Processor Governance:</strong> Engage only vetted sub-processors under binding written agreements;</li>
              <li><strong>Data Subject Assistance:</strong> Provide technical tooling to enable the Controller to fulfill data subject requests under Section 26 of the Act (Access, Rectification, Erasure, Portability);</li>
              <li><strong>Breach Notification:</strong> Notify the Controller in writing within <strong>forty-eight (48) hours</strong> of confirming any personal data breach affecting hosted workloads;</li>
              <li><strong>Return and Deletion:</strong> Provide a 30-day export window upon service cancellation, followed by permanent, irreversible deletion of all container volumes and databases;</li>
              <li><strong>Audits & Records:</strong> Maintain processing records and make available all information necessary to demonstrate compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Technical & Organizational Safeguards (Kenya DPA Sec. 41)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
              {[
                ['Container Isolation', 'Independent Linux namespaces, cgroups v2 resource quotas, non-root user execution'],
                ['Encryption at Rest', 'AES-256 encryption applied to off-site database and filesystem backup snapshots'],
                ['Encryption in Transit', 'Strict TLS 1.3 / 1.2 with HSTS across all public and internal communications'],
                ['Privileged Access', 'SSH key authentication, hardware MFA, and strict IP whitelisting for infrastructure nodes'],
                ['Automated DR', 'Hourly/daily encrypted snapshots to independent S3 storage targeting RPO ≤ 15 min'],
                ['Network Defense', 'Isolated Docker bridge networks, UFW DOCKER-USER firewall rules, and Fail2ban'],
              ].map(([measure, detail]) => (
                <div key={measure} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="font-semibold text-[#0F172A] text-sm mb-1">{measure}</div>
                  <div className="text-xs text-slate-600">{detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Sub-Processors & International Transfers</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              The Controller authorizes the following infrastructure sub-processors in accordance with Sections 48 and 49 of the Kenya Data Protection Act, 2019:
            </p>
            <div className="overflow-x-auto not-prose">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Sub-Processor</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Jurisdiction</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Role</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Transfer Safeguards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Leaseweb B.V.', 'Netherlands / Germany', 'Primary VPS worker compute nodes', 'EU GDPR Adequacy / Binding DPA'],
                    ['Hetzner Online GmbH', 'Germany (EU)', 'Secondary compute & failover', 'EU GDPR Adequacy / Binding DPA'],
                    ['Backblaze Inc.', 'California, USA', 'S3 encrypted off-site backup storage', 'Client-side AES-256 + SCCs'],
                    ['Cloudflare Inc.', 'Global Edge / USA', 'Authoritative DNS, Edge WAF & CDN', 'Standard Contractual Clauses (SCCs)'],
                    ['Safaricom PLC', 'Nairobi, Kenya', 'M-PESA mobile billing gateway', 'In-Country (Kenya)'],
                  ].map(([sp, jur, role, safe]) => (
                    <tr key={sp}>
                      <td className="px-3 py-2 font-medium text-slate-800">{sp}</td>
                      <td className="px-3 py-2 text-slate-600">{jur}</td>
                      <td className="px-3 py-2 text-slate-600">{role}</td>
                      <td className="px-3 py-2 text-slate-500">{safe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-slate-500 text-xs mt-3">
              BazionWeb provides thirty (30) days advance notice for any intended changes to sub-processors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Requesting a Countersigned DPA</h2>
            <p className="text-slate-600 leading-relaxed">
              Corporate clients, financial institutions, and organizations requiring an individually executed and countersigned copy of this DPA for statutory compliance may email <a href="mailto:legal@bazionweb.com" className="text-[#2563EB]">legal@bazionweb.com</a>. Countersigned agreements are processed within three (3) business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              This DPA is governed by the laws of Kenya. Disputes shall be resolved under the jurisdiction of the competent courts of Nairobi, Kenya, without limiting the right of any party to petition the Office of the Data Protection Commissioner (ODPC).
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
