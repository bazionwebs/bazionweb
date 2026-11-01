# BazionWeb — Cloudflare Edge Setup & Operations Guide

**Document ID:** BW-GUIDE-CF-001  
**Target Audience:** DevOps, systems administrators, web engineers, and technical founders  
**Target Domain:** `bazionweb.com`  
**Last Updated:** 2026-11-01  

---

## 1. Executive Summary & Edge Architecture

This operational guide details the complete configuration of **Cloudflare Edge** for **BazionWeb**.

Cloudflare acts as the front-line reverse proxy, DDoS shield, Anycast DNS engine, and edge caching layer sitting in front of BazionWeb's origin infrastructure (Vercel Edge Platform and Docker VPS hosting Next.js 14, NestJS REST API, and PostgreSQL 16).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUDFLARE EDGE LAYER                            │
│                                                                             │
│  [Anycast DNS] ──► [DDoS & Bot Shield] ──► [WAF Rules & Rate Limiting]      │
│                                                       │                     │
│  [Full (Strict) SSL] ◄── [Edge Cache Engine] ◄────────┘                     │
│         │                                                                   │
│         ├─────────► Cache HIT (/_next/static/*) ──► Instant Edge Response   │
│         │                                                                   │
│         └─────────► Cache BYPASS (/api/*, dynamic) ──► Origin Server        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (TLS 1.3)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORIGIN INFRASTRUCTURE                            │
│  Vercel Edge Platform  OR  VPS Nginx Reverse Proxy (bazionweb.com)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DNS Management & Zone Setup

### 2.1 Zone Creation & Nameserver Delegation
1. Log into [dash.cloudflare.com](https://dash.cloudflare.com) and click **+ Add a Site**.
2. Enter domain: `bazionweb.com` -> Select the **Free Plan** (or Pro Plan).
3. Cloudflare will scan existing DNS records.
4. Replace registrar nameservers (at Namecheap, GoDaddy, Kenya Web Experts, or Safaricom) with Cloudflare's assigned Anycast nameservers:
   - Nameserver 1: `adam.ns.cloudflare.com` (or assigned CF NS)
   - Nameserver 2: `zoe.ns.cloudflare.com` (or assigned CF NS)
5. Save nameservers at the registrar. Propagation typically completes within 15–30 minutes.

---

### 2.2 Canonical DNS Records Table
Configure the following records in **Cloudflare Dashboard > Websites > bazionweb.com > DNS > Records**:

| Type | Name / Host | Target / IP | TTL | Proxy Status | Description |
|:---|:---|:---|:---|:---|:---|
| **A** | `@` | `76.76.21.21` *(or VPS IP)* | Auto | **Proxied (Orange Cloud)** | Apex domain routing to Vercel/VPS |
| **CNAME** | `www` | `bazionweb.com` | Auto | **Proxied (Orange Cloud)** | Subdomain redirect to apex |
| **A** | `api` | `<VPS_IP>` *(or API host)* | Auto | **Proxied (Orange Cloud)** | NestJS REST API endpoint |
| **CNAME** | `help` | `custom.tawk.help` | Auto | **DNS Only (Grey Cloud)** | Hosted Tawk.to Knowledge Base |
| **CNAME** | `status` | `statuspage.betteruptime.com` *(or VPS IP)* | Auto | **DNS Only (Grey Cloud)** | Public status dashboard |
| **A** | `auth` | `<VPS_IP>` | Auto | **Proxied (Orange Cloud)** | Keycloak IAM provider |
| **A** | `support` | `<VPS_IP>` | Auto | **Proxied (Orange Cloud)** | Zammad ticketing helpdesk |

---

### 2.3 Email & Deliverability Records (Strict Grey Cloud Rule)

> **⚠️ CRITICAL OPERATIONAL RULE: GREY CLOUD ENFORCEMENT FOR MAIL**  
> Cloudflare's Orange Cloud proxy only supports HTTP/HTTPS traffic on ports 80/443. All email authentication records (MX, SPF, DKIM, DMARC) **MUST BE GREY CLOUD (DNS Only)**. Enabling the Orange Cloud on mail records will break email delivery and cause SPF/DKIM verification failures.

Configure these records exactly as shown:

| Type | Name / Host | Target / Value | Priority | Proxy Status | Purpose |
|:---|:---|:---|:---|:---|:---|
| **TXT** | `@` | `v=spf1 include:amazonses.com ~all` | — | **DNS Only (Grey)** | SPF authorization for Resend |
| **CNAME** | `resend._domainkey` | `dkim.resend.com` *(or AWS SES DKIM)* | — | **DNS Only (Grey)** | Primary DKIM signature key |
| **CNAME** | `s1._domainkey` | `s1.domainkey.resend.com` | — | **DNS Only (Grey)** | Secondary DKIM selector |
| **CNAME** | `s2._domainkey` | `s2.domainkey.resend.com` | — | **DNS Only (Grey)** | Tertiary DKIM selector |
| **MX** | `bounces` | `feedback-smtp.us-east-1.amazonses.com` | `10` | **DNS Only (Grey)** | Resend return-path bounce handler |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@bazionweb.com; pct=100; adkim=r; aspf=r` | — | **DNS Only (Grey)** | DMARC spoofing policy |

*Note on Merged SPF:* If your organization also uses Google Workspace or Zoho Mail on the apex domain, merge them into a single TXT record:
```text
v=spf1 include:amazonses.com include:_spf.google.com ~all
```

---

## 3. SSL/TLS Encryption (Full Strict Mode & HSTS)

### 3.1 Encryption Mode
1. In Cloudflare Dashboard, navigate to **SSL/TLS -> Overview**.
2. Set SSL/TLS encryption mode to: **Full (strict)**.
   - *Why Full (strict)?* This forces Cloudflare to validate the origin server's TLS certificate. It prevents Man-in-the-Middle attacks and avoids the infinite redirect loop bug common with "Flexible" mode.

### 3.2 Edge Certificates Configuration
Navigate to **SSL/TLS -> Edge Certificates**:
- **Always Use HTTPS:** `ON` (Automatically redirects HTTP requests to HTTPS with 301).
- **HTTP Strict Transport Security (HSTS):**
  - Enable HSTS: `ON`
  - Max Age: `1 year (31536000 seconds)`
  - Include subdomains: `ON`
  - Preload: `ON`
  - No-sniff header: `ON`
- **Minimum TLS Version:** Set to `TLS 1.2` or `TLS 1.3`.
- **TLS 1.3:** `ON`
- **Automatic HTTPS Rewrites:** `ON` (Prevents mixed content warnings by rewriting insecure `http://` image and script tags).

### 3.3 Cloudflare Origin CA Certificate (For Docker VPS / Nginx)
When hosting the API or Web container on a dedicated Linux VPS:
1. Navigate to **SSL/TLS -> Origin Server -> Create Certificate**.
2. Select RSA (2048) and hostnames: `bazionweb.com`, `*.bazionweb.com`.
3. Validity: `15 years`.
4. Copy the Origin Certificate to `/etc/ssl/certs/cloudflare_origin.pem` on your VPS.
5. Copy the Private Key to `/etc/ssl/private/cloudflare_origin.key` on your VPS.

---

## 4. Next.js 14 Edge Caching Rules

Modern Cloudflare setups use **Cache Rules** (found in **Caching -> Cache Rules**). Configure these rules in exact priority order:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CACHE RULES PRIORITY ORDER                      │
│                                                                        │
│  Priority 1: BYPASS Cache for Dynamic Routes & APIs (/api/*, /portal/*)│
│       │                                                                │
│  Priority 2: CACHE Next.js Static Chunks (/_next/static/*) for 1 Year  │
│       │                                                                │
│  Priority 3: CACHE Resized Next.js Images (/_next/image) for 7 Days    │
└────────────────────────────────────────────────────────────────────────┘
```

### Rule 1: Bypass Cache for Dynamic Routes & APIs (Priority: 1)
- **Rule Name:** `Bypass Cache - Dynamic & APIs`
- **Expression:**
  ```text
  (http.request.uri.path starts_with "/api/") or 
  (http.request.uri.path starts_with "/portal/") or 
  (http.request.uri.path starts_with "/admin/") or 
  (http.request.uri.path starts_with "/auth/") or 
  (http.request.method ne "GET" and http.request.method ne "HEAD")
  ```
- **Action:** **Bypass cache**
- **Reason:** Prevents user sessions, leads, or quote calculations from being served from edge cache to other users.

### Rule 2: Next.js Static Asset Caching (Priority: 2)
- **Rule Name:** `Cache - Next.js Static Chunks`
- **Expression:**
  ```text
  (http.request.uri.path starts_with "/_next/static/") or 
  (http.request.uri.path starts_with "/static/") or 
  (http.request.uri.path eq "/favicon.ico") or 
  (http.request.uri.path eq "/robots.txt") or 
  (http.request.uri.path eq "/sitemap.xml")
  ```
- **Action:** **Eligible for cache**
- **Edge Cache TTL:** Override origin -> `1 year (31536000s)`.
- **Browser Cache TTL:** Override origin -> `1 year (31536000s)`.
- **Reason:** Next.js static asset filenames contain unique content hashes. They are immutable and can be safely cached globally for instant loading.

### Rule 3: Next.js Image Optimization Cache (Priority: 3)
- **Rule Name:** `Cache - Next.js Resized Images`
- **Expression:**
  ```text
  (http.request.uri.path starts_with "/_next/image") and (http.response.status_code eq 200)
  ```
- **Action:** **Eligible for cache**
- **Edge Cache TTL:** Override origin -> `7 days`.
- **Browser Cache TTL:** Override origin -> `1 day`.

---

## 5. Edge Security, WAF & Rate Limiting

### 5.1 Managed Security & Bot Protection
1. Navigate to **Security -> WAF -> Managed Rules**:
   - Enable: **Cloudflare Managed Ruleset** (Sensitivity: Medium, Action: Challenge).
   - Enable: **Cloudflare OWASP Core Ruleset** (Paranoia Level: 1).
2. Navigate to **Security -> Bots**:
   - Enable: **Bot Fight Mode** (`ON`).
3. **Whitelist Uptime Checkers:** Navigate to **Security -> WAF -> Custom Rules** -> Click **Create Rule**:
   - Rule Name: `Allow Uptime Checkers`
   - Expression: `(http.user_agent contains "BetterUptime") or (http.user_agent contains "Uptime-Kuma")`
   - Action: **Skip** (WAF components: Bot Fight Mode, Rate Limiting).

---

### 5.2 Rate Limiting Rules (Protecting Forms & Quotes)
Navigate to **Security -> WAF -> Rate Limiting Rules** -> Click **Create Rule**:

#### Rate Limit 1: Protect Contact Lead Form (`/api/leads`)
- **Rule Name:** `Protect Contact & Lead Submission`
- **When incoming request matches:**
  ```text
  (http.request.method eq "POST" and http.request.uri.path eq "/api/leads")
  ```
- **Rate:** `5 requests per 10 minutes` per client IP.
- **Action:** `Managed Challenge` (Displays interactive Turnstile challenge instead of a hard block, protecting legitimate office users on shared WiFi).

#### Rate Limit 2: Protect Quote Configurator (`/api/quote`)
- **Rule Name:** `Protect Quote Calculator Engine`
- **When incoming request matches:**
  ```text
  (http.request.method eq "POST" and http.request.uri.path eq "/api/quote")
  ```
- **Rate:** `10 requests per 1 minute` per client IP.
- **Action:** `Managed Challenge`.

---

## 6. Terminal Verification & Diagnostic Recipes

Use these commands to verify that Cloudflare edge is functioning correctly:

### 1. Verify DNS Nameservers & CNAME Flattening:
```bash
dig NS bazionweb.com +short
# Expected output: adam.ns.cloudflare.com, zoe.ns.cloudflare.com

dig A bazionweb.com +short
# Expected output: Cloudflare Anycast edge IP (e.g., 104.21.x.x, 172.67.x.x)
```

### 2. Verify Full (Strict) SSL & HSTS Headers:
```bash
curl -I https://bazionweb.com
```
*Expected response headers:*
```text
HTTP/2 200
cf-ray: ...
strict-transport-security: max-age=63072000; includeSubDomains; preload
cf-cache-status: DYNAMIC
```

### 3. Verify Next.js Static Asset Edge Cache HIT:
```bash
# Request a static chunk twice:
curl -I https://bazionweb.com/_next/static/chunks/main.js
curl -I https://bazionweb.com/_next/static/chunks/main.js
```
*Expected header on second request:*
```text
cf-cache-status: HIT
cache-control: public, max-age=31536000, immutable
```

### 4. Verify API Route Cache BYPASS:
```bash
curl -I https://bazionweb.com/api/health
```
*Expected header:*
```text
cf-cache-status: BYPASS
```

### 5. Verify SPF & DKIM Grey Cloud Mail Records:
```bash
dig TXT bazionweb.com +short
# Must include: "v=spf1 include:amazonses.com ~all"

dig CNAME resend._domainkey.bazionweb.com +short
# Must return: dkim.resend.com.
```
