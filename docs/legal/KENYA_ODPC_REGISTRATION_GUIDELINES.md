# Kenya ODPC Registration Guide for Bazionweb

**Statutory Framework:** Data Protection Act, 2019 (Act No. 24 of 2019)  
**Applicable Regulations:** Data Protection (Registration of Data Controllers and Data Processors) Regulations, 2021  
**Regulatory Body:** Office of the Data Protection Commissioner (ODPC), Kenya  
**Official Portal:** [https://www.odpc.go.ke](https://www.odpc.go.ke) / [https://forms.odpc.go.ke](https://forms.odpc.go.ke)

---

## 1. Statutory Capacity & Classification

Under Section 18 of the Data Protection Act, 2019 and Regulation 3 of the Registration Regulations 2021:

### Why Bazionweb Must Register as BOTH Data Controller and Data Processor

1. **As a Data Controller:**
   - **Scope:** Bazionweb determines the purpose and means of collecting, storing, and utilizing personal data of its direct clients, website visitors, and billing contacts.
   - **Data Collected:** Client company names, contact representatives, email addresses, billing addresses, national ID / passport numbers (where KYC is requested), phone numbers, M-PESA transaction IDs (`M-PESA Receipt No.`, `CheckoutRequestID`), IP addresses, and user portal credentials.
   - **Statutory Purpose:** Account provisioning, billing, tax and statutory audit records (KRA compliance), customer technical support, and infrastructure security auditing.

2. **As a Data Processor:**
   - **Scope:** Bazionweb provides cloud hosting, Docker application environments, and database storage for third-party client websites and applications.
   - **Data Handled:** Databases, uploads, customer profiles, e-commerce transactions, and web logs hosted within client containers.
   - **Statutory Purpose:** Bazionweb processes and retains this data strictly on behalf of the client (who acts as the Data Controller), following the client’s documented technical instructions without independent determination of purpose.

---

## 2. Step-by-Step ODPC Portal Application Walkthrough

### Step 1: Account Creation & Entity Profile
1. Navigate to the [ODPC Online Registration Portal](https://forms.odpc.go.ke).
2. Create an organization account using your primary business email (`legal@bazionweb.com` or `admin@bazionweb.com`).
3. Select Legal Entity Type: **Private Limited Company** or **Registered Business Name** (enter Certificate of Incorporation / Business Registration Number, KRA PIN, and Registered Office Address in Nairobi, Kenya).

### Step 2: Role Selection
- In the application form under **"Capacity of Registration"**, select:
  - **[x] Data Controller and Data Processor**

### Step 3: Threshold & Fee Category Selection
Under the First Schedule of the Registration Regulations, select the applicable tier:
- **Micro and Small Entity:**
  - *Criteria:* Annual turnover / revenue up to KES 5,000,000 AND 1 to 50 employees.
  - *Registration Fee:* **KES 4,000** (Certificate valid for 2 years).
  - *Note:* If Bazionweb’s turnover exceeds KES 5,000,000, the fee is KES 16,000 (Medium Entity).

### Step 4: Description of Processing Activities
Use the following standardized answers for the portal fields:

- **Description of Personal Data Processed:**
  > *"Names, contact email addresses, telephone numbers, billing information, M-PESA mobile payment identifiers, portal authentication credentials, server access logs, and technical telemetry. In our capacity as a data processor, we also provide hosting infrastructure storing customer-managed web application databases and file uploads on behalf of our business clients."*

- **Categories of Data Subjects:**
  > *"1. Registered account holders and business representatives.*  
  > *2. Website visitors and prospective clients.*  
  > *3. End-users of client-hosted web applications (in our hosting capacity as a data processor)."*

- **Purpose of Processing:**
  > *"Provision of managed website hosting, software application deployment, domain management, subscription billing, customer identity authentication, technical customer support, payment transaction verification via Safaricom M-PESA and card gateways, and compliance with statutory tax obligations."*

- **Security Measures Implemented:**
  > *"Container-level workload isolation (Linux cgroups v2, isolated bridge networks), end-to-end encryption in transit (TLS 1.3), AES-256 encryption for data at rest and off-site backup snapshots, role-based access control (RBAC) with enforced Multi-Factor Authentication (MFA) for administrative operations, automated fail2ban firewall protection, hourly/daily encrypted off-site disaster recovery backups, and strict 72-hour security incident notification protocols."*

- **Cross-Border Transfers of Personal Data (Section 48/49 Compliance):**
  - **Transfer Destinies:** European Union (e.g., Leaseweb / Hetzner servers in Germany/Netherlands) and United States (e.g., Cloudflare CDN/DNS and Backblaze B2 encrypted backup storage).
  - **Legal Basis for Transfer:** Appropriate safeguards pursuant to Section 49(1) of the Data Protection Act (EU GDPR adequacy, Standard Contractual Clauses, and explicit client consent within the Hosting Terms of Service and Data Processing Agreement).

---

## 3. Mandatory Attachments Required by ODPC

Prepare the following PDF documents to upload with the application:
1. **Certificate of Incorporation / Business Registration Certificate**
2. **KRA PIN Certificate of the Entity**
3. **Bazionweb Master Privacy Policy** (`docs/legal/MASTER_PRIVACY_POLICY.md`)
4. **Data Protection Policy & Incident Response Procedure**
5. **Data Processing Agreement (DPA)** (`docs/legal/DATA_PROCESSING_AGREEMENT_DPA.md`)
6. **Payment Proof** (Government eCitizen payment slip of KES 4,000 via M-PESA / Bank Transfer generated by the portal).

---

## 4. Post-Registration Compliance Checklist

- [ ] Display the official **ODPC Certificate of Registration** number in the website footer and legal portal: `ODPC Registration No: ODPC/RC/XXXX/XXXX`.
- [ ] Maintain an updated **Register of Processing Activities (ROPA)** under Section 24 of the Act.
- [ ] Execute the **Data Processing Agreement (DPA)** with all enterprise and hosting clients upon registration.
- [ ] Enforce the **72-Hour Breach Notification Protocol** to notify ODPC (`complaints@odpc.go.ke` / `breach@odpc.go.ke`) and affected customers in the event of an unauthorized security compromise.
- [ ] Implement data subject request handling (Access, Rectification, Erasure, Objection) with statutory response SLA of ≤ 30 days.

