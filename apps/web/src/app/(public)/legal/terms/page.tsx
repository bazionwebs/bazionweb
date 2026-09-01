import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'BazionWeb Terms of Service — the contract that governs your use of our managed web services.',
};

const LAST_UPDATED = 'June 1, 2025';
const EFFECTIVE_DATE = 'June 1, 2025';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal</span>
          <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-slate-400 text-sm">
            Last updated: {LAST_UPDATED} · Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </div>

      <div className="container-default max-w-3xl py-16">
        <div className="prose prose-slate max-w-none">
          <div className="card p-8 md:p-10 space-y-8">

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Agreement to Terms</h2>
              <p className="text-slate-600 leading-relaxed">
                By accessing or using any service provided by BazionWeb ("Company", "we", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use our services. These terms constitute a legally binding agreement under the laws of Kenya and applicable international law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Services Provided</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                BazionWeb provides managed website lifecycle services including but not limited to: website development, managed cloud hosting, website maintenance, security management, performance optimization, and technical support. The specific services, deliverables, and SLAs applicable to your subscription are defined in your Service Order.
              </p>
              <p className="text-slate-600 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any service with 30 days' written notice, except where required by law, security necessity, or violation of these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Client Responsibilities</h2>
              <p className="text-slate-600 leading-relaxed mb-3">You agree to:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>Provide accurate account and billing information</li>
                <li>Maintain the confidentiality of your portal login credentials</li>
                <li>Use our services only for lawful purposes and in compliance with our Acceptable Use Policy</li>
                <li>Not host content that infringes intellectual property rights, contains malware, or facilitates illegal activity</li>
                <li>Respond to security or compliance notices within the timeframes specified</li>
                <li>Provide timely approvals and feedback during project delivery phases</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Payment Terms</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                Subscriptions are billed monthly in advance on your billing date. One-time project fees are invoiced per your Service Order payment schedule. Payment is due within 14 days of invoice date. Overdue accounts may be suspended after 7 days' notice.
              </p>
              <p className="text-slate-600 leading-relaxed">
                All prices are in USD unless otherwise stated. Taxes applicable in your jurisdiction are your responsibility.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Service Level Agreement</h2>
              <p className="text-slate-600 leading-relaxed">
                Uptime guarantees and response time commitments are defined per plan in our SLA document. Service credits for SLA breaches are issued as credits against your next invoice — not as cash refunds. Credits are capped at the percentage defined per plan (5–25% of monthly fee). Credits are the sole remedy for uptime failures.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Intellectual Property</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                Upon full payment, you own the website design and content we create for you. We retain ownership of our proprietary tools, processes, code templates, and infrastructure configurations.
              </p>
              <p className="text-slate-600 leading-relaxed">
                You grant us a limited licence to access, modify, and host your website content solely for the purpose of delivering the contracted services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Limitation of Liability</h2>
              <p className="text-slate-600 leading-relaxed">
                To the maximum extent permitted by law, BazionWeb's total liability to you for any claim arising from or related to these terms or our services shall not exceed the total fees paid by you in the three months preceding the claim. We are not liable for indirect, consequential, incidental, or punitive damages, including loss of business, data, or profits.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">8. Termination</h2>
              <p className="text-slate-600 leading-relaxed">
                Either party may terminate with 30 days' written notice. We may terminate immediately for material breach, non-payment, or illegal use. Upon termination, we will provide a 30-day data export period. After that period, data will be permanently deleted per our Data Retention Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">9. Governing Law</h2>
              <p className="text-slate-600 leading-relaxed">
                These terms are governed by the laws of Kenya. Disputes shall first be attempted through good-faith negotiation, then mediation, then the courts of Nairobi, Kenya.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">10. Contact</h2>
              <p className="text-slate-600 leading-relaxed">
                Legal notices: <a href="mailto:legal@bazionweb.com" className="text-[#2563EB] hover:underline">legal@bazionweb.com</a><br />
                BazionWeb, Nairobi, Kenya
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
