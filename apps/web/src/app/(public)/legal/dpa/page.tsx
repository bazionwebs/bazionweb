import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Data Processing Agreement',
  description: 'BazionWeb Data Processing Agreement (DPA) — GDPR Art. 28 compliant data processing terms.',
  alternates: { canonical: 'https://bazionwebs.com/legal/dpa' },
};

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Data Processing Agreement' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal</span>
          <h1 className="text-4xl font-bold text-white mb-3">Data Processing Agreement</h1>
          <p className="text-slate-400 text-sm">Version 1.0 · Effective June 1, 2025 · GDPR Art. 28 compliant</p>
        </div>
      </div>
      <div className="container-default max-w-3xl py-16">
        <div className="card p-8 md:p-10 space-y-8">

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-sm text-[#2563EB] font-medium">
              This DPA forms part of your Service Agreement with BazionWeb. It applies when we process personal data on your behalf (e.g. visitor data stored in your website&apos;s CMS or databases we host for you).
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Parties</h2>
            <p className="text-slate-600 leading-relaxed">
              <strong>Data Controller:</strong> You (the Client), as defined in your Service Order.<br />
              <strong>Data Processor:</strong> BazionWeb, Nairobi, Kenya.<br />
              This DPA supplements the Terms of Service and governs all processing of personal data by BazionWeb on the Controller&apos;s behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Subject Matter and Nature of Processing</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              BazionWeb processes personal data only to the extent necessary to provide the contracted services, including:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li>Hosting website databases that may contain visitor or customer data</li>
              <li>Creating and restoring backups of hosted data</li>
              <li>Log processing for security monitoring and uptime tracking</li>
              <li>CMS content management where user accounts exist</li>
              <li>Performance monitoring that may include anonymised visitor metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Processor Obligations</h2>
            <p className="text-slate-600 leading-relaxed mb-2">BazionWeb agrees to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
              <li>Process personal data only on documented instructions from the Controller</li>
              <li>Ensure persons authorised to process personal data are bound by confidentiality</li>
              <li>Implement appropriate technical and organisational security measures (GDPR Art. 32)</li>
              <li>Not engage sub-processors without prior written consent (our sub-processor list is published in our Privacy Policy)</li>
              <li>Assist the Controller in responding to data subject rights requests</li>
              <li>Notify the Controller within 48 hours of becoming aware of a personal data breach</li>
              <li>Delete or return all personal data upon termination of services</li>
              <li>Make available all information necessary to demonstrate GDPR Art. 28 compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Technical & Organisational Measures (Art. 32)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Encryption at rest', 'AES-256 for all backups and sensitive fields'],
                ['Encryption in transit', 'TLS 1.2+ for all data transmission'],
                ['Access control', 'Role-based access; MFA enforced for staff'],
                ['Audit logging', 'All data access logged and retained 5 years'],
                ['Backup & recovery', 'Daily encrypted backups, monthly verification'],
                ['Vulnerability management', 'Monthly security scans; patch SLA ≤72h (critical)'],
                ['Incident response', 'Documented IRP; 48h breach notification'],
                ['Sub-processor vetting', 'DPA in place with all sub-processors'],
              ].map(([measure, detail]) => (
                <div key={measure} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="font-semibold text-[#0F172A] text-sm mb-1">{measure}</div>
                  <div className="text-xs text-slate-500">{detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. International Transfers</h2>
            <p className="text-slate-600 leading-relaxed">
              Where personal data is transferred to sub-processors outside Kenya or the EEA (e.g. Cloudflare, Backblaze), such transfers are governed by Standard Contractual Clauses (EU SCCs) or equivalent mechanisms. A full list of sub-processors and their locations is maintained in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Requesting a Signed DPA</h2>
            <p className="text-slate-600 leading-relaxed">
              Enterprise clients and clients subject to GDPR or POPIA may request a countersigned copy of this DPA. Contact: <a href="mailto:legal@bazionwebs.com" className="text-[#2563EB]">legal@bazionwebs.com</a>. We process DPA signature requests within 5 business days.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
