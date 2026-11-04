# Master Privacy Policy — Bazionweb

**Effective Date:** November 3, 2026  
**Last Updated:** November 3, 2026  
**Governing Laws:** Kenya Data Protection Act, 2019 (Act No. 24 of 2019), Data Protection (General) Regulations 2021, and Regulation (EU) 2016/679 (GDPR).

---

## 1. Introduction & Statutory Identity

Bazionweb ("Company", "we", "our", or "us"), based in Nairobi, Kenya, operates managed hosting, application deployment platforms, and web services accessible via [https://bazionweb.com](https://bazionweb.com) and associated client portals.

Under the Kenya Data Protection Act, 2019 (DPA) and international data protection standards:
1. **As a Data Controller:** Bazionweb determines the purpose and means of processing personal data collected directly from customers, visitors, and billing accounts.
2. **As a Data Processor:** When hosting client websites, databases, and Docker applications, Bazionweb stores and processes personal data solely on behalf of, and under the documented instructions of, our clients (who act as Data Controllers).

For inquiries or to exercise statutory privacy rights, contact our Data Protection Office at:
- **Email:** `privacy@bazionweb.com` / `legal@bazionweb.com`
- **Postal Address:** P.O. Box Nairobi, Kenya
- **Supervisory Authority:** Office of the Data Protection Commissioner (ODPC), Kenya

---

## 2. Principles of Data Protection

In compliance with Section 25 of the Kenya Data Protection Act, 2019, all personal data handled by Bazionweb is:
1. Processed lawfully, fairly, and transparently;
2. Collected for explicit, specified, and legitimate purposes;
3. Adequate, relevant, and limited to what is necessary (data minimization);
4. Accurate and kept up to date;
5. Kept in a form permitting identification of data subjects for no longer than necessary;
6. Processed in a manner that ensures appropriate security, including protection against unauthorized or unlawful processing, accidental loss, destruction, or damage.

---

## 3. Categories of Personal Data We Collect

### A. Information You Provide to Us Directly
- **Identity & Account Data:** Full name, business legal name, national ID or passport number (where required for domain verification or KYC), email address, telephone number, physical and billing addresses.
- **Authentication Data:** Securely salted and hashed passwords (scrypt), multi-factor authentication (MFA) tokens, API authorization keys.
- **Payment & Transaction Identifiers:** M-PESA mobile numbers, Safaricom M-PESA transaction references (`M-PESA Receipt Number`, `MerchantRequestID`, `CheckoutRequestID`), Paystack / card tokenized customer references, and transaction timestamps. *(Note: We never store unencrypted credit card numbers or banking PINs).*
- **Support & Communication Records:** Content of helpdesk tickets, technical logs provided for troubleshooting, and live-chat messages.

### B. Technical & Infrastructure Telemetry
- **Device & Connection Data:** IP address, browser type and version, operating system, network provider, and referring URL.
- **Log Files & Security Telemetry:** Server connection timestamps, HTTP request headers, Traefik edge proxy routing logs, Fail2ban triggers, and firewall block logs.

### C. Client Hosted Data (Processed in Processor Capacity)
- Application source code, database tables, customer-uploaded files, media assets, and application-specific audit logs deployed inside client Docker containers on our VPS nodes.

---

## 4. Legal Bases & Purposes of Processing

Pursuant to Section 30 of the Kenya Data Protection Act and Article 6 of the GDPR:

| Purpose of Processing | Categories of Data | Legal Basis (Kenya DPA 2019) |
| :--- | :--- | :--- |
| **Account Creation & Service Delivery** | Name, email, phone, authentication credentials | **Performance of a Contract** (Section 30(1)(b)) |
| **Billing & M-PESA / Card Processing** | Billing details, M-PESA receipt numbers, transaction IDs | **Performance of a Contract** & **Compliance with Legal Obligation** (Tax Laws) |
| **Infrastructure Security & Defense** | IP addresses, Traefik routing logs, firewall events | **Legitimate Interest** (Securing infrastructure against cyber threats & DoS attacks) |
| **Technical Support & Service Restoration** | Support tickets, server error logs | **Performance of a Contract** |
| **Regulatory & Statutory Compliance** | Transaction records, tax invoices, audit logs | **Compliance with Legal Obligation** (Section 30(1)(c)) |
| **Service Announcements & Critical Alerts** | Registered email address, SMS phone number | **Performance of a Contract** |

---

## 5. Security & Technical Safeguards

To prevent unauthorized access, alteration, disclosure, or destruction of personal data (Section 41 of the Kenya DPA), Bazionweb implements rigorous technical and organizational controls:
1. **Container-Level Workload Isolation:** Customer applications execute within isolated Docker containers constrained by Linux kernel cgroups v2 limits and unprivileged user mappings (`UID 1001:nextjs`).
2. **Encryption in Transit:** All external and internal communication is strictly encrypted using modern Transport Layer Security (TLS 1.3 / TLS 1.2) with strict HSTS enforcement.
3. **Encryption at Rest:** Sensitive database fields, server volumes, and backups are encrypted utilizing AES-256 standards.
4. **Disaster Recovery & Off-Site Backups:** Encrypted filesystem and database snapshots are generated via Restic and stored independently in off-site S3-compatible cloud storage (Backblaze B2).
5. **Access Control & Privileged Operations:** Administrative access to production workers and Dokploy control planes requires hardware MFA, restricted IP whitelists, and key-based SSH authentication. Root passwords and unencrypted API tokens are strictly prohibited.
6. **Masking & Privacy by Design:** Customer MSISDN phone numbers are automatically masked in non-essential audit views (`+254 7****1234`).

---

## 6. International Data Transfers (Section 48 & 49 Compliance)

Bazionweb operates a globally resilient, high-performance infrastructure network. As part of providing hosting services, certain data may be transferred to or processed on servers located outside Kenya:

| Sub-Processor / Service | Location | Purpose | Transfer Safeguards (Kenya DPA Sec 48/49) |
| :--- | :--- | :--- | :--- |
| **Leaseweb B.V.** | Netherlands / Germany (EU) | High-performance VPS worker nodes | EU GDPR Adequacy / Binding Contractual Safeguards |
| **Hetzner Online GmbH** | Germany / Finland (EU) | Secondary infrastructure & compute | EU GDPR Adequacy / Standard Contractual Clauses |
| **Backblaze Inc. (B2)** | United States | Encrypted off-site disaster recovery storage | Standard Contractual Clauses (SCCs) + Client-Side AES-256 Encryption prior to transit |
| **Cloudflare Inc.** | Global Edge / USA | Authoritative DNS, WAF & DDoS mitigation | Standard Contractual Clauses (SCCs) & Data Processing Addendum |
| **Safaricom PLC (Daraja)** | Kenya | M-PESA mobile payments | In-Country Processing (Kenya) |
| **Paystack Payments** | Kenya / Nigeria | Card & alternate payment gateway | Standard Contractual Clauses & PCI-DSS Level 1 Compliance |

By entering into the Hosting Agreement or subscribing to our services, you provide explicit consent to these cross-border transfers pursuant to Section 49(1)(a) of the Kenya Data Protection Act, subject to the robust encryption and contractual safeguards described above.

---

## 7. Data Retention & Destruction

1. **Active Customer Accounts:** Retained for the active duration of the service agreement.
2. **Financial, Invoicing & Tax Records:** Retained for seven (7) years following the transaction date to comply with Kenyan statutory tax and accounting laws (Tax Procedures Act).
3. **Hosted Client Applications & Databases:** Upon account termination or cancellation, client data is retained in a dormant, read-only state for thirty (30) calendar days to permit full data extraction. On day 31, all container volumes, databases, and related snapshot records are permanently destroyed and overwritten.
4. **Technical Access Logs:** Web server and proxy routing logs are retained for twelve (12) months for security incident investigations, after which they are automatically rotated and purged.

---

## 8. Data Subject Rights (Section 26, Kenya DPA 2019)

Under Section 26 of the Kenya Data Protection Act, 2019 and Chapter III of the GDPR, you have the right to:
1. **Right to be Informed:** Understand how your personal data is collected and processed.
2. **Right of Access:** Request a certified copy of your personal data held in our systems.
3. **Right to Rectification:** Request correction of inaccurate, misleading, or outdated personal information.
4. **Right to Erasure ("Right to be Forgotten"):** Request deletion of personal data where there is no statutory or contractual obligation for retention.
5. **Right to Object / Restrict Processing:** Object to processing based on legitimate interest or restrict automated profiling.
6. **Right to Data Portability:** Request transfer of your data in a structured, commonly used, and machine-readable format (JSON/CSV).

To exercise any of these rights, email `privacy@bazionweb.com`. We verify identity and respond within thirty (30) calendar days at zero charge.

---

## 9. Security Breach Notification Protocol

Pursuant to Section 43 of the Kenya Data Protection Act, 2019:
1. In the event of a confirmed personal data breach presenting a real risk of harm, Bazionweb will notify the **Office of the Data Protection Commissioner (ODPC)** within seventy-two (72) hours of becoming aware of the breach.
2. Where the breach is likely to adversely affect data subjects, Bazionweb will promptly notify the affected customers in writing, providing mitigation guidance, contact details of the incident response team, and description of remedial measures taken.

---

## 10. Complaints & Regulatory Recourse

If you believe your data protection rights have been violated, we encourage you to first contact our Data Protection Team at `privacy@bazionweb.com`.

You also have the statutory right to file a formal complaint with the regulator:
- **Office of the Data Protection Commissioner (ODPC)**  
  Britam Tower, 12th Floor, Hospital Road, Upper Hill, Nairobi, Kenya  
  P.O. Box 30920-00100, Nairobi, Kenya  
  **Email:** `complaints@odpc.go.ke` / `info@odpc.go.ke`  
  **Website:** [https://www.odpc.go.ke](https://www.odpc.go.ke)

