# Hosting Terms of Service & Acceptable Use Policy (AUP) — Bazionweb

**Effective Date:** November 3, 2026  
**Last Updated:** November 3, 2026  
**Governing Jurisdiction:** Republic of Kenya  
**Statutory Framework:** Kenya Information and Communications Act (KICA), Computer Misuse and Cybercrimes Act, 2018, and Kenya Data Protection Act, 2019.

---

## 1. Acceptance of Terms

By subscribing to, provisioning, or accessing web hosting, Docker deployment containers, database instances, or domain services provided by Bazionweb ("Company", "we", "our", or "us"), the client ("Subscriber", "you") agrees to be bound by these Hosting Terms of Service, the Acceptable Use Policy (AUP), the Master Privacy Policy, and the Data Processing Agreement (DPA).

---

## 2. Description of Hosting Services

Bazionweb provides multi-tiered managed cloud hosting and application deployment infrastructure:
1. **Managed Website Hosting:** Optimized containerized hosting for CMS platforms (WordPress, headless CMS) with isolated databases and automated TLS certificate management.
2. **Managed Application Hosting:** Continuous deployment of custom web applications (Next.js, Node.js, Laravel, Python, Docker Compose stacks) managed via our automated provisioning engine and Dokploy API.
3. **Dedicated & High-Resource Compute:** Dedicated virtual servers and private clusters for enterprise workloads.

---

## 3. Resource Allocation & Container Quotas

To ensure platform stability and protect multi-tenant integrity ("noisy neighbor" prevention):
1. **CPU & Memory Quotas:** Each subscription tier includes defined resource constraints enforced via Linux kernel cgroups v2 (e.g., Starter: 0.50 vCPU / 512 MB RAM; Business: 1.00 vCPU / 1024 MB RAM).
2. **Bursting & OOM Protection:** Applications exceeding allocated memory limits are subject to operating system out-of-memory (OOM) management. Sustained excessive CPU consumption (>95% for >30 continuous minutes) will trigger automatic container throttling.
3. **Storage & Bandwidth:** Disk storage must be utilized strictly for application code, active database records, and direct media assets. Storing off-site archives, personal media streaming libraries, or peer-to-peer file caches on standard hosting volumes is prohibited.
4. **Fair Use Policy:** Accounts that disproportionately affect overall server performance will be notified and required to optimize their application or upgrade to dedicated compute resources.

---

## 4. Acceptable Use Policy (AUP)

Subscribers must strictly adhere to this AUP. Operating any of the following activities on Bazionweb infrastructure constitutes a material breach resulting in immediate service suspension or termination without refund:

### A. Prohibited Content & Applications
1. **Malicious Software & Cyber Warfare:** Hosting, distributing, or executing malware, viruses, trojans, ransomware, keyloggers, botnet command-and-control servers, or phishing pages.
2. **Cryptocurrency Mining:** Executing Proof-of-Work cryptocurrency miners or distributed computation software on shared or standard VPS infrastructure.
3. **Unsolicited Bulk Email (Spam):** Operating bulk email sending services, mail relay exploits, unverified list blasting, or failing to maintain SPF, DKIM, and DMARC compliance on transactional mail.
4. **Copyright Infringement & Piracy:** Hosting unlicensed software, cracked executables (warez), copyrighted media streams, or torrent trackers.
5. **Illegal or Harmful Material:** Any content that violates the Computer Misuse and Cybercrimes Act of Kenya, including child exploitation material, hate speech, terrorism propaganda, or unlicensed online gambling.

### B. Network & Security Violations
1. Running unauthorized port scanners, vulnerability scanning suites, or brute-force password cracking tools against internal or external networks.
2. Participating in Denial of Service (DoS/DDoS) attacks as an attacker, reflector, or testing ground.
3. Attempting container breakout, Docker daemon manipulation, host kernel tampering, or unauthorized inter-tenant lateral movement.

---

## 5. Billing, Payments & Renewals

1. **Currencies & Invoicing:** Hosting services are billed in Kenyan Shillings (KES) for Kenyan/East African accounts and US Dollars (USD) for international accounts.
2. **Payment Channels:** We accept Safaricom M-PESA (STK Push and Paybill), credit/debit cards via Paystack, and direct bank transfers.
3. **Prepayment:** Hosting fees are billed monthly or annually in advance.
4. **Grace Period & Suspension:**
   - Invoices are due on the anniversary date.
   - A seven (7) calendar day grace period is granted following invoice due date.
   - If payment is not confirmed by day 8, container services are automatically suspended (routing displays an account suspension page).
   - If payment remains outstanding for thirty (30) days following suspension, the application container, database, and snapshots are permanently deprovisioned and purged.

---

## 6. Backups & Disaster Recovery

1. **Automated Platform Backups:** Bazionweb performs automated incremental backups using Restic with client-side AES-256 encryption, archived to off-site S3-compatible cloud storage (Backblaze B2).
2. **Client Responsibility:** While Bazionweb maintains high-availability snapshots, the Subscriber is ultimately responsible for maintaining independent, local backup copies of their proprietary database and code assets.
3. **Recovery SLA:** In the event of catastrophic server hardware failure, platform restoration to backup snapshots targets an RPO (Recovery Point Objective) ≤ 15 minutes and RTO (Recovery Time Objective) ≤ 15 minutes.

---

## 7. Service Level Agreement (SLA) & Uptime

1. **Uptime Target:** Bazionweb targets 99.9% monthly network and server availability (excluding scheduled maintenance windows announced at least 48 hours in advance).
2. **SLA Credits:** If monthly availability drops below 99.9% due to infrastructure failure under Bazionweb’s direct control, Subscribers are eligible for service invoice credits:
   - 99.0% – 99.8% Uptime: 10% credit of monthly hosting fee;
   - 95.0% – 98.9% Uptime: 25% credit of monthly hosting fee;
   - < 95.0% Uptime: 50% credit of monthly hosting fee.
3. **Sole Remedy:** SLA service credits applied to future billing cycles are the Subscriber's sole and exclusive financial remedy for downtime or service interruptions.

---

## 8. Limitation of Liability

1. To the maximum extent permitted by the laws of Kenya, Bazionweb’s cumulative financial liability for all claims arising out of or related to the provision of hosting services shall not exceed the total fees actually paid by the Subscriber in the three (3) months immediately preceding the event giving rise to liability.
2. Bazionweb shall not be liable for any indirect, consequential, punitive, special, or incidental damages, including loss of business profits, lost revenue, lost customer data, or reputational harm.

---

## 9. Governing Law & Dispute Resolution

These Hosting Terms are governed by and construed in accordance with the laws of Kenya. Any unresolved dispute shall be submitted to good-faith mediation under the Nairobi Centre for International Arbitration (NCIA) rules, failing which disputes shall be determined by the competent courts of Nairobi, Kenya.

