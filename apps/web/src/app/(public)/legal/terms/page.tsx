import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'BazionWeb Master Terms of Service & Hosting Agreement — the contract that governs your use of our managed hosting and cloud platforms.',
  alternates: { canonical: 'https://bazionweb.com/legal/terms' },
};

const LAST_UPDATED = 'November 3, 2026';
const EFFECTIVE_DATE = 'November 3, 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Terms of Service' }]} />
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">Legal & Agreement</span>
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
                By accessing, subscribing to, or provisioning services through BazionWeb (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;), you enter into a legally binding contract governed by these Terms of Service, our <a href="/legal/privacy" className="text-[#2563EB] underline">Privacy Policy</a>, <a href="/legal/dpa" className="text-[#2563EB] underline">Data Processing Agreement (DPA)</a>, and <a href="/legal/sla" className="text-[#2563EB] underline">Service Level Agreement (SLA)</a> under the laws of Kenya.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. Description of Managed Hosting Services</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                BazionWeb provides managed website and cloud hosting infrastructure, automated application deployments (Next.js, Node.js, Laravel, Python, Docker Compose), database services, SSL termination, and disaster recovery backups.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Specific technical resource allocations, server specifications, and support tiers are defined in your active subscription package.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Resource Allocation & Container Limits</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                To guarantee high platform performance and protect multi-tenant integrity (&ldquo;noisy neighbor&rdquo; prevention):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
                <li><strong>Cgroups v2 Resource Quotas:</strong> Each workload operates under strict CPU core and RAM allocations (e.g. 0.5 vCPU / 512 MB for Starter; 1.0 vCPU / 1024 MB for Business).</li>
                <li><strong>Out-of-Memory (OOM) Protection:</strong> Containers exceeding designated memory thresholds will trigger container restarts. Sustained excessive CPU consumption will be throttled.</li>
                <li><strong>Storage Use:</strong> Storage must be dedicated strictly to application code, active database records, and direct media assets. File-sharing repositories or personal streaming archives are strictly prohibited.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Acceptable Use Policy (AUP)</h2>
              <p className="text-slate-600 leading-relaxed mb-2">You agree NOT to host, deploy, or facilitate:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
                <li>Malware, viruses, trojans, ransomware, phishing, or botnet command-and-control operations;</li>
                <li>Proof-of-work cryptocurrency mining or distributed hash computation;</li>
                <li>Unsolicited commercial bulk email (spam) or unauthenticated mail relay exploits;</li>
                <li>Copyright-infringing media, unlicensed software (warez), or illegal torrent trackers;</li>
                <li>Network disruption attacks, port scanning, or attempts at container breakout and host privilege escalation.</li>
              </ul>
              <p className="text-rose-600 text-xs font-semibold mt-2">
                Violation of the AUP results in immediate service suspension and termination without refund.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Billing, Payments & Suspension</h2>
              <p className="text-slate-600 leading-relaxed mb-3">
                Hosting subscriptions are billed monthly or annually in advance in Kenyan Shillings (KES) for East African accounts and US Dollars (USD) for international clients. We accept Safaricom M-PESA, card payments via Paystack, and direct wire transfers.
              </p>
              <p className="text-slate-600 leading-relaxed text-sm">
                A seven (7) day grace period follows overdue invoices. On day 8, unpaid accounts are automatically suspended. If an account remains unpaid for thirty (30) days, the hosted container, database, and snapshots are permanently deprovisioned and deleted.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Service Level Agreement (SLA)</h2>
              <p className="text-slate-600 leading-relaxed">
                We guarantee a 99.9% monthly uptime target for managed cloud infrastructure, excluding scheduled maintenance announced 48 hours in advance. Unplanned downtime qualifies for invoice credits (10% to 50% of monthly hosting fees) as specified in our <a href="/legal/sla" className="text-[#2563EB] underline">SLA</a>, which constitutes the sole remedy for downtime.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Data Protection & International Transfers</h2>
              <p className="text-slate-600 leading-relaxed">
                BazionWeb operates in compliance with the Kenya Data Protection Act, 2019, acting in dual capacity as a Data Controller and Data Processor. By using our hosting services, you consent to our processing of personal data under our <a href="/legal/privacy" className="text-[#2563EB] underline">Privacy Policy</a> and <a href="/legal/dpa" className="text-[#2563EB] underline">DPA</a>, including international transfers to certified European and US data centers under Sections 48 and 49 of the Kenya Data Protection Act, 2019.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">8. Limitation of Liability</h2>
              <p className="text-slate-600 leading-relaxed">
                To the maximum extent permitted by Kenyan law, BazionWeb&apos;s aggregate liability for all claims arising out of or related to our services shall not exceed the total fees paid by you in the three (3) months preceding the claim. We are not liable for indirect, consequential, or punitive damages, including loss of business, data, or profits.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">9. Termination & Data Export</h2>
              <p className="text-slate-600 leading-relaxed">
                Either party may terminate services with thirty (30) days written notice. Upon termination, we provide a 30-day data export period for you to retrieve database dumps and file assets. On day 31, all data is permanently and irrevocably deleted.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">10. Governing Law</h2>
              <p className="text-slate-600 leading-relaxed">
                These terms are governed by the laws of Kenya. Any disputes shall first be resolved through good-faith negotiation, then mediation under the Nairobi Centre for International Arbitration (NCIA), and ultimately the competent courts of Nairobi, Kenya.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">11. Contact</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                Legal & Compliance: <a href="mailto:legal@bazionweb.com" className="text-[#2563EB]">legal@bazionweb.com</a><br />
                General Support: <a href="mailto:support@bazionweb.com" className="text-[#2563EB]">support@bazionweb.com</a>
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
