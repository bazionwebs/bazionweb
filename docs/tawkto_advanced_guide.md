# BazionWeb — Tawk.to Advanced Implementation & Operations Guide

**Document ID:** BW-GUIDE-TAWK-001  
**Target Audience:** Non-technical operators, customer support agents, and frontend engineers  
**Property ID:** `6ae6de21896a4b3c3630071b` | **Widget ID:** `1k6at7dq5`  
**Hosted Help Center Domain:** `https://help.bazionweb.com`  
**Last Updated:** 2026-11-01  

---

## 1. Executive Summary & Overview

This guide provides click-by-click, beginner-friendly instructions to configure and operate the advanced features of **Tawk.to** for **BazionWeb**.

Tawk.to is BazionWeb's primary live customer engagement, self-service knowledge base, and asynchronous ticketing desk. When configured according to this operational runbook, it:
1. **Engages High-Intent Prospects Automatically**: Dwell time triggers reach out to prospects comparing pricing tiers, evaluating hosting specifications, or building quotes.
2. **Eliminates Repetitive Support Work**: The free hosted Knowledge Base on `https://help.bazionweb.com` provides self-service documentation for cPanel, webmail, DNS, and M-Pesa invoice payments.
3. **Speeds Up Agent Response Times**: 10 pre-written canned shortcuts allow agents to expand dual-market pricing (KES / USD) and SLA commitments in one keystroke (`/pricing`, `/hosting`, `/mpesa`).
4. **Ensures No Inquiry Is Lost**: Offline intake forms capture prospect WhatsApp numbers and automatically route tickets to **Sales**, **Technical Support**, or **Billing** according to Nairobi business hours (EAT / UTC+3).

---

## 2. Accessing the Dashboard & Property Selection

1. Open your web browser and navigate to **[https://dashboard.tawk.to](https://dashboard.tawk.to)**.
2. Log in with your authorized BazionWeb administrator or agent email credentials.
3. In the top navigation bar, locate the **Property Dropdown** (top-left). Verify that **BazionWeb** is selected.
4. To access settings, click the **⚙️ Administration** gear icon in the lower-left corner of the sidebar.
5. In the Administration view, you will see three columns: **Property Settings**, **Channels**, and **Settings**.

---

## 3. Automated Proactive Chat Triggers

Proactive triggers automatically initiate a conversation with a visitor based on what page they are viewing and how long they have been reading.

### How to Add a Trigger in the Dashboard:
1. Click **⚙️ Administration** -> under **Settings**, click **Triggers**.
2. Click the green **+ Add Trigger** button in the top right.
3. Follow the exact specifications below for each high-intent page.

---

### Trigger 1: Pricing Page Dwell Time Consultation (High Intent)
- **Trigger Type:** Select **Advanced**
- **Trigger Name:** `Proactive: Pricing Dwell Time (25s)`
- **Trigger Description:** `Engages prospects reviewing 2026 pricing packages after 25 seconds`
- **Trigger Status:** Toggle to **Enabled**
- **Conditions:** Match **ALL** of the following conditions:
  - `Visitor page URL` | `contains` | `/pricing`
  - Click **+ Add Condition**
  - `Time on current page` | `is greater than or equal to` | `25`
  - Click **+ Add Condition**
  - `Visitor served` | `equals` | `false`
  - Click **+ Add Condition**
  - `Widget status` | `equals` | `online`
- **Action:**
  - **Action Type:** `Send message to visitor`
  - **Sender Name:** `BazionWeb Solutions Team`
  - **Message:**
    > "Hello! Are you exploring website or care packages for your business? We offer transparent fixed pricing in both KES (with instant M-Pesa STK push) and USD. Would you like a fast, tailored recommendation for your project size?"
- Click **Save Trigger**.

---

### Trigger 2: Web Hosting & Managed Cloud Spec Greeting
- **Trigger Type:** Select **Advanced**
- **Trigger Name:** `Proactive: Hosting & Infrastructure (15s)`
- **Trigger Description:** `Engages visitors reading hosting or server specifications`
- **Trigger Status:** Toggle to **Enabled**
- **Conditions:** Match **ALL** of the following conditions:
  - `Visitor page URL` | `contains` | `/services/hosting`
  - Click **+ Add Condition**
  - `Time on current page` | `is greater than or equal to` | `15`
  - Click **+ Add Condition**
  - `Visitor served` | `equals` | `false`
  - Click **+ Add Condition**
  - `Widget status` | `equals` | `online`
- **Action:**
  - **Action Type:** `Send message to visitor`
  - **Sender Name:** `BazionWeb Infrastructure Team`
  - **Message:**
    > "Need high-speed managed cloud hosting with automated daily backups, free SSL, and a 99.9% uptime SLA? Our Host Essential plan starts at just KSh 4,500/year, and we handle all website and mailbox migrations completely free of charge. Let us know if you have any questions!"
- Click **Save Trigger**.

---

### Trigger 3: Custom Development & Digital Systems Consultation
- **Trigger Type:** Select **Advanced**
- **Trigger Name:** `Proactive: Custom Systems & Portals (20s)`
- **Trigger Description:** `Engages enterprise leads reviewing portals, CRMs, and bespoke web apps`
- **Trigger Status:** Toggle to **Enabled**
- **Conditions:** Match **ALL** of the following conditions:
  - `Visitor page URL` | `contains` | `/services/custom-systems`
  - Click **+ Add Condition**
  - `Time on current page` | `is greater than or equal to` | `20`
  - Click **+ Add Condition**
  - `Visitor served` | `equals` | `false`
  - Click **+ Add Condition**
  - `Widget status` | `equals` | `online`
- **Action:**
  - **Action Type:** `Send message to visitor`
  - **Sender Name:** `Lead Software Engineer`
  - **Message:**
    > "Planning a custom client portal, CRM, or SaaS platform? Our engineering team builds full-stack Next.js and NestJS solutions with robust role-based security. Feel free to ask about our Discovery & Specification process!"
- Click **Save Trigger**.

---

### Trigger 4: E-Commerce & M-Pesa Store Consultation
- **Trigger Type:** Select **Advanced**
- **Trigger Name:** `Proactive: E-Commerce & Payments (20s)`
- **Trigger Description:** `Engages merchants reviewing online store packages`
- **Trigger Status:** Toggle to **Enabled**
- **Conditions:** Match **ALL** of the following conditions:
  - `Visitor page URL` | `contains` | `/services/ecommerce`
  - Click **+ Add Condition**
  - `Time on current page` | `is greater than or equal to` | `20`
  - Click **+ Add Condition**
  - `Visitor served` | `equals` | `false`
  - Click **+ Add Condition**
  - `Widget status` | `equals` | `online`
- **Action:**
  - **Action Type:** `Send message to visitor`
  - **Sender Name:** `BazionWeb E-Commerce Team`
  - **Message:**
    > "Looking to launch an e-commerce store with automated M-Pesa STK push and Card checkouts? Starter stores start from KSh 90,000. Ask us anything about inventory sync, delivery zones, or payment gateway setup!"
- Click **Save Trigger**.

---

### Trigger 5: Interactive Quote Calculator Assistant
- **Trigger Type:** Select **Advanced**
- **Trigger Name:** `Proactive: Quote Calculator Assistant (30s)`
- **Trigger Description:** `Assists prospects spending time customizing their quote on /quote`
- **Trigger Status:** Toggle to **Enabled**
- **Conditions:** Match **ALL** of the following conditions:
  - `Visitor page URL` | `contains` | `/quote`
  - Click **+ Add Condition**
  - `Time on current page` | `is greater than or equal to` | `30`
  - Click **+ Add Condition**
  - `Visitor served` | `equals` | `false`
  - Click **+ Add Condition**
  - `Widget status` | `equals` | `online`
- **Action:**
  - **Action Type:** `Send message to visitor`
  - **Sender Name:** `BazionWeb Estimations Team`
  - **Message:**
    > "Need a hand finalizing your quote or choosing between Launch, Business, or Custom tiers? An engineer is online to help clarify scope, timeline, and deliverables."
- Click **Save Trigger**.

---

## 4. Free Hosted Knowledge Base (Help Center on `help.bazionweb.com`)

Tawk.to provides a free hosted Knowledge Base with unlimited articles, responsive layout, search indexing, and custom domain SSL.

### 4.1 Activating Knowledge Base in Tawk.to
1. Go to **⚙️ Administration** -> under **Channels**, click **Knowledge Base**.
2. Click the toggle to **Enable Knowledge Base**.
3. Fill in **General Information**:
   - **Help Center Name:** `BazionWeb Help Center & Knowledge Base`
   - **Subdomain:** `bazionweb` (creating `bazionweb.tawk.help`)
   - **Site Title:** `BazionWeb Help Center — Hosting, Domains, Billing & Technical Documentation`
   - **Site Description:** `Search guides, cPanel tutorials, M-Pesa payment instructions, and SLA policies for BazionWeb clients.`
   - **Primary Language:** `English`
4. Under **Domain Settings**:
   - Click **Add Custom Domain**.
   - Enter: `help.bazionweb.com`
   - Note the destination CNAME target provided: `custom.tawk.help`.

### 4.2 Configuring DNS in Cloudflare Edge
To direct traffic to the Knowledge Base securely:
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) for `bazionweb.com`.
2. Navigate to **DNS -> Records** -> Click **Add Record**.
3. Create the CNAME entry:
   - **Type:** `CNAME`
   - **Name:** `help`
   - **Target:** `custom.tawk.help`
   - **Proxy status:** **DNS Only (Grey Cloud)** during initial verification so Tawk.to's automated Let's Encrypt bot can issue the SSL certificate.
   - **TTL:** `Auto`
4. Click **Save**.
5. Back in Tawk.to, click **Verify Domain**. Once verified, a green SSL badge will appear next to `help.bazionweb.com`.

### 4.3 5-Pillar Category Architecture
Create the following 5 primary categories in **Knowledge Base -> Categories**:
1. **Web Hosting & Infrastructure**: Accessing cPanel, corporate webmail, DNS configuration, and automated backups.
2. **Domain Registration & Management**: Registering .KE domains, DNSSEC, domain renewals, and transfers.
3. **Billing, Invoicing & Payments**: M-Pesa STK push, Paybill manual settlement, card payments, and eTIMS tax receipts.
4. **Technical Support & SLAs**: Incident priority matrix (P1 to P4), 15-minute emergency hotline, and support care plans.
5. **WordPress, Next.js & CMS Management**: Updating portal pages, managing Strapi content, and optimizing media.

---

### 4.4 Sample Production Articles (Copy & Paste Ready)

#### Article 1: How to Access Your cPanel and Corporate Webmail
- **Category:** `Web Hosting & Infrastructure`
- **Title:** `How to Access Your cPanel and Configure Corporate Webmail`
- **Content:**
```markdown
# How to Access Your cPanel and Configure Corporate Webmail

Every BazionWeb managed hosting package includes secure access to your cPanel management dashboard and corporate email accounts (e.g., info@yourdomain.com).

---

## 1. Accessing Your cPanel Dashboard
You can access your cPanel control panel using any web browser:
1. Open your browser and navigate to:
   - `https://yourdomain.com:2083` (Secure SSL port)
   - OR `https://cpanel.yourdomain.com`
2. Enter the **Username** and **Password** provided in your Onboarding Credentials email.
3. Click **Log In**.

> **Security Note:** If you enter incorrect credentials more than 5 times consecutively, our server firewall will temporarily block your IP address for 30 minutes. Contact support@bazionweb.com for an immediate whitelist.

---

## 2. Accessing Webmail in Your Browser
To check and send emails directly through your web browser without configuring email software:
1. Navigate to `https://yourdomain.com:2096` or `https://webmail.yourdomain.com`.
2. Enter your full corporate email address and mailbox password.
3. Select **Roundcube** to enter your inbox.

---

## 3. Configuring Email on Outlook, iPhone, or Android
For desktop or mobile email apps, use the following secure IMAP settings:
- **Incoming Server:** `mail.yourdomain.com` | **Port:** `993` (SSL/TLS required)
- **Outgoing Server:** `mail.yourdomain.com` | **Port:** `465` (SSL/TLS required)
- **Username:** Full email address
- **Password:** Mailbox password

Need assistance? Reach out via live chat or email support@bazionweb.com.
```

---

#### Article 2: How to Pay Invoices via M-Pesa STK Push or Paybill
- **Category:** `Billing, Invoicing & Payments`
- **Title:** `How to Pay Invoices via M-Pesa STK Push or Paybill`
- **Content:**
```markdown
# How to Pay Invoices via M-Pesa STK Push or Paybill

BazionWeb provides instant automated payment reconciliation for all Kenyan Shilling (KES) invoices via Safaricom M-Pesa.

---

## Option 1: Instant M-Pesa STK Push (Recommended)
1. Open the electronic invoice link received in your email or open the **BazionWeb Client Portal**.
2. Click the green **Pay with M-Pesa** button.
3. Enter your Safaricom mobile phone number (format: `07XXXXXXXX` or `2547XXXXXXXX`).
4. Click **Request Payment Prompt**.
5. Within 5–10 seconds, an automated **STK Push dialog** will appear on your phone screen displaying:
   - **Payee:** BazionWeb Technologies (or IntaSend Gateway)
   - **Amount:** Exact invoice balance in KES
6. Enter your secret **M-Pesa PIN** and press OK.
7. Your invoice will automatically update to **PAID** within 15 seconds, and an official KRA compliant electronic tax receipt will be emailed to you immediately.

---

## Option 2: Manual Paybill Payment
If you prefer paying manually from your M-Pesa Sim Toolkit or M-Pesa App:
1. Open M-Pesa on your phone and select **Lipa na M-Pesa -> Paybill**.
2. Enter Business Number: **`400200`**
3. Enter Account Number: **`BW-[Invoice Number]`** (e.g. `BW-1042`).
4. Enter the exact invoice amount.
5. Enter your M-Pesa PIN and confirm.
6. Forward your confirmation SMS to **billing@bazionweb.com** or paste the code into our live chat for instant clearance.
```

---

#### Article 3: Support Tiers, Escalation Procedures, and SLA Response Times
- **Category:** `Technical Support & SLAs`
- **Title:** `Support Tiers, Escalation Procedures, and SLA Response Times`
- **Content:**
```markdown
# Support Tiers, Escalation Procedures, and SLA Response Times

At BazionWeb, every active website care and managed hosting subscription is protected by guaranteed Service Level Agreements (SLAs).

---

## 1. Incident Priority Matrix
- **P1 — Critical (Site Down):** Website completely unavailable or database connection broken. **Response: Under 15 Minutes (24/7/365)**. Target Resolution: < 2 Hours.
- **P2 — High (Major Degrade):** Core feature broken (checkout failing, forms not submitting), site accessible. **Response: Under 2 Hours (Mon–Sat)**. Target Resolution: < 8 Hours.
- **P3 — Normal (Routine):** Minor layout issues, content updates, new mailbox setups. **Response: Under 8 Hours (Mon–Fri)**. Target Resolution: < 24 Hours.
- **P4 — Low (General Inquiry):** Feature requests, general technical consultations. **Response: Under 24 Hours (Mon–Fri)**.

---

## 2. How to Report an Emergency P1 Outage
If your production website goes offline:
1. Open live chat at **bazionweb.com** and type: `P1 SITE DOWN: yourdomain.com`.
2. Select department: **Technical Support & Maintenance**.
3. Call our 24/7 Emergency Incident Hotline: **`+254 721 287 053`**.
4. Send an email with `[P1 CRITICAL]` in the subject line to **alerts@bazionweb.com**.
```

---

## 5. 10 Production Canned Shortcuts (Quick Replies)

Canned shortcuts allow any agent to type `/` in the chat input and immediately expand complete, formatted responses.

### How to Add Shortcuts in the Dashboard:
1. Go to **⚙️ Administration** -> under **Settings**, click **Shortcuts**.
2. Click the green **+ Add Shortcut** button.
3. Fill in the **Shortcut Name** (identifier) and set **Scope** to `Public`.
4. Paste the exact text from the table below and click **Save**.

| Shortcut Command | Identifier | Scope | Purpose & Summary |
|:---|:---|:---|:---|
| `/pricing` | `pricing` | Public | Dual-market commercial breakdown (KES Launch KSh 25k, Business KSh 90k, Pro KSh 160k; USD $450, $950, $1,750). |
| `/hosting` | `hosting` | Public | Host Essential (KSh 4,500/yr), Host Business (KSh 8,500/yr), Managed Cloud (from KSh 30,000/yr). |
| `/migration` | `migration` | Public | Explains 100% free zero-downtime website and mailbox migration process. |
| `/mpesa` | `mpesa` | Public | Instant automated STK push instructions and Paybill 400200 guide. |
| `/cards` | `cards` | Public | International Visa, Mastercard, AMEX checkout instructions with bank-grade TLS. |
| `/sla` | `sla` | Public | 99.9% uptime commitment, under 15-minute response SLA for P1 outages, and 24/7 hotline. |
| `/custom` | `custom` | Public | Discovery & Specification phase (KSh 25k–75k / $500–$1,500) credited 100% toward build. |
| `/quote` | `quote` | Public | Direct link to interactive quote builder (`https://bazionweb.com/quote`). |
| `/hours` | `hours` | Public | Operating hours (Mon-Fri 8am-6pm EAT, Sat 9am-1pm) and 24/7 emergency incident coverage. |
| `/dns` | `dns` | Public | Nameserver details (`ns1.bazionweb.com`, `ns2.bazionweb.com`) and edge IP mapping. |

---

### Full Text for All 10 Canned Shortcuts:

#### Shortcut 1: `/pricing`
```text
Hi {name}! At BazionWeb, we believe in transparent, fixed-scope pricing with no hidden fees. We operate two commercial price schedules:

🇰🇪 Kenya Market (KES):
• Launch Package: KSh 25,000 (up to 5 pages, mobile-first, SSL, SEO, 14-day warranty)
• Business Package: KSh 90,000 (up to 10 pages, custom CMS, lead gen, 30-day warranty)
• Professional Package: KSh 160,000 (up to 15 pages, advanced integrations, 60-day warranty)

🌍 International Market (USD):
• Launch: $450 | Business: $950 | Professional: $1,750

View our full price schedule and interactive quote calculator here: https://bazionweb.com/pricing
```

#### Shortcut 2: `/hosting`
```text
We offer fully managed high-speed cloud hosting backed by automated backups, Cloudflare edge caching, and 99.9% uptime:

• Host Essential: KSh 4,500/year ($45/yr) — High-speed SSD, free SSL, DNS management, weekly backups, basic support.
• Host Business: KSh 8,500/year ($85/yr) — 5x resources, business email accounts, daily backups, priority support, free migration.
• Host Professional: KSh 15,000/year ($150/yr) — Staging environments, enhanced resources, proactive security hardening.
• Managed Cloud: From KSh 30,000/year ($300/yr) — Dedicated Node.js/Next.js/PostgreSQL cloud instances for web applications.

Would you like us to review your current website hosting and assist with migration?
```

#### Shortcut 3: `/migration`
```text
Migrating your website and business emails to BazionWeb is 100% free with any annual hosting or website care plan!

Our Zero-Downtime Migration Process:
1. We clone your website files, databases, and mailboxes to our high-speed staging servers.
2. We conduct a complete QA test (forms, checkout, SSL, speed) on temporary URLs.
3. We cut over your DNS records without a single minute of downtime.

All we need to get started is access to your current cPanel or hosting dashboard. Would you like to schedule your migration today?
```

#### Shortcut 4: `/mpesa`
```text
You can easily settle your BazionWeb invoice via Safaricom M-Pesa:

📱 Automated STK Push (Fastest):
Click the payment link on your invoice, select M-Pesa, enter your phone number, and accept the instant PIN prompt on your handset.

🏢 Manual Paybill:
• Paybill Number: 400200
• Account Number: BW-[Your Invoice #]

Once submitted, our system automatically clears your invoice and dispatches a verified KRA electronic tax receipt. Let us know if you need assistance!
```

#### Shortcut 5: `/cards`
```text
For international clients or card payments, we support Visa, Mastercard, and American Express processed securely via Paystack:

• 0% foreign transaction surcharges on USD billing.
• 256-bit bank-grade TLS encryption.
• Instant invoice clearance and downloadable PDF receipt.

Simply click the secure credit card button on your electronic invoice to complete payment.
```

#### Shortcut 6: `/sla`
```text
All BazionWeb clients on active care or hosting plans are protected by strict Service Level Agreements:

• 99.9% Production Uptime Guarantee
• P1 Critical (Site Down): Response in under 15 minutes, 24/7/365.
• P2 High (Major Bug): Response in under 2 hours.
• P3 Normal (Routine Support): Response in under 8 hours.

For urgent P1 outages, our 24/7 emergency dispatch line is available at +254 721 287 053.
```

#### Shortcut 7: `/custom`
```text
Custom software projects (such as client portals, booking systems, SaaS platforms, or enterprise CRMs) begin with our structured Discovery & Specification Phase (KSh 25,000–75,000 / $500–$1,500).

Deliverables include:
• Complete Functional Requirements Document (FRD)
• Database schema and system architecture blueprints
• User role workflows & clickable UI wireframes
• Itemized timeline, milestone plan, and fixed build quotation

Bonus: 100% of your discovery fee is credited toward development when you proceed with the build! Would you like to schedule an introductory discovery call with our tech lead?
```

#### Shortcut 8: `/quote`
```text
You can generate an instant, itemized estimate tailored to your exact specifications using our online Calculator:

👉 https://bazionweb.com/quote

You can select your package tier, add-ons (extra pages, M-Pesa checkout, multi-language, SEO audits), hosting options, and care plans. You can download a formal PDF quote or submit it directly to our engineering team!
```

#### Shortcut 9: `/hours`
```text
Our engineering and client support teams operate on the following schedule (East Africa Time / UTC+3):

• Monday to Friday: 8:00 AM – 6:00 PM (Live Chat, Phone & Ticket Support)
• Saturday: 9:00 AM – 1:00 PM (Live Chat & Scheduled Deployments)
• Sundays & Public Holidays: Closed for routine support.
• Emergency P1 Outages: Monitored 24/7/365 via on-call infrastructure alerts.

Outside standard hours, any message submitted through this chat is automatically converted into an urgent ticket for opening hours.
```

#### Shortcut 10: `/dns`
```text
To connect your domain to BazionWeb's high-speed Cloudflare edge infrastructure, please point your domain nameservers to:

• Primary NS: ns1.bazionweb.com (or Cloudflare assigned NS)
• Secondary NS: ns2.bazionweb.com

If you manage your own DNS records, point your A record to our edge IP address provided in your provisioning email. DNS propagation typically takes between 15 minutes and 2 hours. Need us to configure this for you? Just let us know!
```

---

## 6. Ticketing & Routing Configuration

### 6.1 Creating Departments
To ensure inquiries reach the correct staff:
1. Go to **⚙️ Administration** -> under **Settings**, click **Departments**.
2. Click **+ Add Department**.
3. Create the three required departments:
   - **Sales & New Projects**: Handles pre-sales, package recommendations, quote follow-ups. Forwarding: `sales@bazionweb.com`.
   - **Technical Support & Maintenance**: Handles bug fixes, email setup, DNS changes, and P1 outage reports. Forwarding: `support@bazionweb.com`.
   - **Billing & Invoicing**: Handles M-Pesa clearance, invoice requests, and renewal queries. Forwarding: `billing@bazionweb.com`.
4. Add the appropriate team members to each department.

### 6.2 Operating Hours Scheduler (Nairobi EAT)
1. Go to **⚙️ Administration** -> under **Settings**, click **Scheduler**.
2. Toggle the Scheduler to **ON**.
3. Select Timezone: `(GMT+03:00) Nairobi / East Africa Time`.
4. Configure working hours:
   - **Monday to Friday:** `08:00 to 18:00`
   - **Saturday:** `09:00 to 13:00`
   - **Sunday:** Toggle to **OFF** (all day offline ticket intake)
5. Click **Save**.

### 6.3 Customized Offline Ticket Form
When agents are offline or after-hours, the chat widget displays an offline intake form:
1. Go to **⚙️ Administration** -> under **Channels**, click **Chat Widget** -> select **BazionWeb Widget** -> **Widget Content**.
2. Click the **Offline** tab.
3. Form Fields configuration:
   - **Name:** Enabled & Required
   - **Email:** Enabled & Required
   - **Phone / WhatsApp:** Enabled & Required (Label: `Phone Number (WhatsApp preferred)`)
   - **Department:** Enabled & Required (Dropdown: `Sales & New Projects`, `Technical Support & Maintenance`, `Billing & Invoicing`)
   - **Message:** Enabled & Required (Placeholder: `Describe your project, inquiry, or issue...`)
4. Click **Save Changes**.

---

## 7. Next.js App Router Code Helpers Reference

The BazionWeb Next.js codebase provides pre-built helpers in `apps/web`:
- `src/hooks/useTawk.ts`: Clean React client hook (`maximize`, `minimize`, `toggle`, `setAttributes`, `addEvent`, `onLoaded`).
- `src/components/ui/TawkTrigger.tsx`: Declarative trigger component for dwell timers, scroll depth, and exit intent.
- `src/components/ui/TawkToChat.tsx`: Global script loader with SPA route change tracking.

### Example: Triggering Dwell Consultation on a Custom Landing Page
```tsx
import TawkTrigger from '@/components/ui/TawkTrigger';

export default function EnterpriseLandingPage() {
  return (
    <>
      <TawkTrigger
        dwellSeconds={20}
        customEventName="enterprise_page_dwell"
        eventData={{ plan: 'enterprise_portal' }}
      />
      <div>{/* Landing page content */}</div>
    </>
  );
}
```

---

## 8. Operational Verification Checklist

Before opening live chat to customers, complete this verification runbook:
- [ ] **Proactive Trigger Test:** Visit `https://bazionweb.com/pricing` in an incognito window. Stay on the page for 25 seconds without clicking. Verify the tailored consultation bubble pops up from "BazionWeb Solutions Team".
- [ ] **Canned Shortcuts Test:** As an agent in `dashboard.tawk.to`, open a test chat, type `/pricing`, `/hosting`, and `/mpesa`. Verify that each shortcut expands into the full 2026 pricing text.
- [ ] **Help Center Verification:** Visit `https://help.bazionweb.com`. Verify the SSL lock is active, the 5 category cards are visible, and the sample articles render cleanly.
- [ ] **Offline Form Routing Test:** Set agent status to "Offline" in the dashboard. Visit `bazionweb.com`, open the chat widget, and verify the offline intake form asks for Name, Email, WhatsApp Phone, and Department.
- [ ] **Ticket Delivery Test:** Submit an offline message. Verify that an email ticket notification arrives at `support@bazionweb.com` / `hello@bazionweb.com` within 60 seconds.
