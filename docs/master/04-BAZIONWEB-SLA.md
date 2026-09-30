# BazionWeb Service Level Agreement (SLA) & Support Matrix
## Contractual Response Times, Severity Tiers & Operational Protocols

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Governing Standard:** ISO/IEC 20000 & ITIL Incident Management  
**Applicability:** Active Care Retainers, Managed Hosting & Active Project Warranties  

---

## 1. Principles of BazionWeb Support

1. **Response Time vs. Resolution Time:**
   * **Response Time:** The guaranteed elapsed time between a client opening an incident ticket and a qualified BazionWeb systems engineer acknowledging the ticket, assessing severity, and initiating diagnostic or remediation actions.
   * **Resolution Time:** The operational target time required to deploy a temporary workaround or permanent fix that restores normal business functionality.
2. **Honest SLAs:** BazionWeb advertises only contractual response times backed by real monitoring and engineer rotations. We do not make baseless promises of "instant resolution."
3. **Multi-Channel Accountability:** Every incident is tracked with a unique immutable ticket ID in the BazionWeb Support System (powered by Zammad / Client Portal) to preserve an audit trail of timestamps, diagnostics, and resolutions.

---

## 2. Incident Severity Classification Matrix

| Severity Level | Definition | Impact Criteria | Concrete Examples |
| :--- | :--- | :--- | :--- |
| **P1 — Critical** | **Emergency / Total Outage** | Production system is inaccessible to all users; severe data loss imminent; active security breach. | Production website returns 502/500 to all visitors; database offline; active ransomware or defacement; primary DNS hijacked. |
| **P2 — Major** | **Core Functionality Blocked** | Primary business transaction flow is blocked; significant operational degradation; no immediate workaround. | M-Pesa or Card checkout failing on e-commerce store; user authentication loop preventing portal access; student fee payment gateway down. |
| **P3 — Normal** | **Non-Critical Bug / Defect** | System functions with minor defect; business operations continue; viable workaround available. | Contact form styling glitch on mobile; PDF report formatting misaligned; search filter pagination error; non-critical dashboard graph failing. |
| **P4 — Low** | **General Inquiries & Tasks** | General technical advice, text copy edits, minor styling tweaks, quotation inquiries, configuration guidance. | Updating staff bio on About page; changing phone number in footer; requesting Google Search Console report; general DNS query. |

---

## 3. Contractual Response & Resolution Targets by Care Plan

| Plan Tier | P1 (Critical Outage) | P2 (Major Degradation) | P3 (Normal Bug) | P4 (General Request) | Support Channels |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **No Retainer** *(Pay-As-You-Go)* | Best Effort (≤ 24h) | Best Effort (≤ 48h) | Best Effort (3–5 days) | 5 business days | Portal Ticket / Email |
| **Warranty Window** *(14–60d)* | ≤ 2 hours | ≤ 4 hours | ≤ 1 business day | 2 business days | Dedicated Onboarding Slack / WhatsApp / Ticket |
| **Care Essential** | ≤ 4 hours | ≤ 8 hours | ≤ 24 hours | 2 business days | Client Portal Ticket, Email |
| **Care Business** | ≤ 2 hours | ≤ 4 hours | ≤ 12 hours | 1 business day | Priority Portal, WhatsApp Emergency Desk |
| **Care Professional** | ≤ 1 hour | ≤ 2 hours | ≤ 8 hours | Same business day | Priority Line, WhatsApp Desk, Direct Engineer |
| **Care Enterprise** | **≤ 15 minutes** *(24/7/365)* | **≤ 1 hour** | **≤ 4 hours** | ≤ 8 hours | Dedicated On-Call Phone, 24/7 Slack Connect, Portal |

---

## 4. Target Resolution Objectives

While third-party dependencies (such as telecommunications backbones or cloud vendor outages) can impact recovery, BazionWeb operates to the following internal resolution benchmarks:

```
┌──────────┬─────────────────────────────┬────────────────────────────────────┐
│ Severity │ Initial Workaround Target   │ Permanent Root-Cause Fix Target    │
├──────────┼─────────────────────────────┼────────────────────────────────────┤
│ P1       │ Under 2 hours (Backup/Roll) │ Under 8 hours                      │
│ P2       │ Under 4 hours               │ Under 24 hours                     │
│ P3       │ Under 24 hours              │ Next scheduled maintenance release │
│ P4       │ As scheduled                │ Completed within allocated hours   │
└──────────┴─────────────────────────────┴────────────────────────────────────┘
```

---

## 5. Escalation Procedures & Incident Communication

### Step 1: Automated Detection or Ticket Initiation
* Incidents are flagged automatically via **Uptime Kuma** monitoring checks (evaluating every 60 seconds) or logged by the client via `support@bazionweb.com` or `/portal/tickets`.

### Step 2: Severity Triage & Acknowledgement
* The on-call engineer verifies service telemetry, categorizes severity, and responds with incident confirmation and ticket ID within the contractual SLA window.

### Step 3: Diagnostic & Remediation
* For P1 incidents, the engineer immediately initiates the **Incident Response Runbook** (e.g. `docs/runbooks/p1-site-down.md`):
  1. Inspect Edge WAF & DNS routing.
  2. Check reverse proxy (Nginx Proxy Manager) logs.
  3. Validate container health (`docker compose ps`).
  4. Restore from latest verified daily snapshot if database corruption is detected.

### Step 4: Status Updates
* For P1 incidents, BazionWeb provides status updates every **30 minutes** to the designated client emergency contact until full restoration.

### Step 5: Post-Mortem & Incident Report
* For any P1 incident on a Care Business, Professional, or Enterprise plan, BazionWeb issues a written **Root Cause Analysis (RCA)** report within 3 business days, detailing:
  * Chronological timeline of the incident.
  * Root cause diagnosis.
  * Corrective actions taken.
  * Preventive measures implemented to eliminate recurrence.

---

## 6. Service Exclusions & Dependencies

BazionWeb is released from SLA response penalties under the following conditions:
1. **Client Responsiveness:** When diagnosis requires client action (e.g. providing third-party API credentials, domain verification codes, content approvals) and the client does not respond, the SLA clock is paused.
2. **Third-Party Upstream Outages:** Global outages affecting cloud providers (e.g. Cloudflare, AWS, Safaricom Daraja, IntaSend, GitHub, Google Cloud) that are beyond BazionWeb's direct infrastructure control. BazionWeb will monitor upstream status and apply failovers where architected.
3. **Unauthorized Client Modifications:** Code modifications, database updates, or server alterations performed directly by client staff or unvetted third parties without BazionWeb's prior approval.
4. **Planned Maintenance Windows:** Scheduled maintenance notified at least 48 hours in advance, performed during off-peak hours (Sunday 01:00 – 04:00 EAT).

---

## 7. Uptime Guarantees & Service Credits

For clients on **Host Professional**, **Managed Cloud**, and **Care Enterprise** agreements:
* **Target Uptime:** **99.9%** availability across any calendar month (excluding planned maintenance windows).
* **Service Credits:** If monthly availability falls below 99.9%, the client is entitled upon written request to service credits applied against the subsequent renewal invoice:
  * **99.5% – 99.89% Uptime:** 10% monthly service credit.
  * **99.0% – 99.49% Uptime:** 25% monthly service credit.
  * **Below 99.0% Uptime:** 50% monthly service credit.
