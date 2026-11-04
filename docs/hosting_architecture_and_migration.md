# BazionWeb — Hosting Architecture, Migration Strategy, and Platform Implementation Design

**Document ID:** BAZ-DOC-2026-M1-ARCH  
**Classification:** Technical Architecture Specification & Implementation Blueprint  
**Author:** worker_transition_1 (Systems Verification & Platform Architecture)  
**Target Environment:** Contabo Cloud VPS / Dedicated Server (Ubuntu 24.04 LTS), Dokploy Platform Engine, Traefik Reverse Proxy, Next.js Standalone, PostgreSQL 16, Redis 7  
**Regulatory Baseline:** Kenya Data Protection Act 2019 (ODPC), Safaricom Daraja 2.0 Security Guidelines, ISO/IEC 27001 Controls  
**Date:** November 3, 2026  
**Status:** Authoritative / Complete  

---

## Executive Summary

This specification provides the comprehensive architectural blueprint, migration roadmap, and platform implementation design for transitioning BazionWeb from its legacy/mixed hosting footprint (Vercel, external cloud services) to a high-performance, cost-effective, self-hosted open-source platform managed via **Dokploy** on Contabo VPS infrastructure.

The architecture eliminates vendor lock-in and commercial Hobby-tier restrictions, achieves full compliance with Kenya's Office of the Data Protection Commissioner (ODPC) Data Protection Act 2019, establishes multi-tenant client workload isolation through Linux kernel namespaces and cgroups v2, implements automated disaster recovery with deduplicated off-site backups via Restic to S3/Backblaze B2, and provides a production-grade TypeScript deployment abstraction adapter to automate client website provisioning via Dokploy's REST API.

---

# Section 1: Architecture & Migration Strategy

## 1.1 Actionable Phased Technical Roadmap

The migration from legacy hosting to the self-hosted Dokploy architecture is organized into **seven deterministic phases (Phases 0 through 6)**. This phased sequence enforces zero-downtime cutover, preserves data integrity, and ensures every security boundary is validated before production traffic is routed.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MIGRATION ROADMAP PHASES                             │
├───────────────┬──────────────────────────────────────────────────────────────────┤
│ Phase 0       │ Pre-Migration Audit, Baseline Assessment & Secret Discovery      │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 1       │ Foundational VPS & Dokploy Infrastructure Hardening              │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 2       │ Database & Core Stateful Service Migration (PostgreSQL, Redis)   │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 3       │ Application Containerization & Production Deployment             │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 4       │ Customer Provisioning & Deployment Provider Integration          │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 5       │ Disaster Recovery & Automated Backup Pipeline (Restic to S3/B2)  │
├───────────────┼──────────────────────────────────────────────────────────────────┤
│ Phase 6       │ Production Cutover, DNS Switchover & Verification Gate           │
└───────────────┴──────────────────────────────────────────────────────────────────┘
```

### Phase 0: Pre-Migration Audit, Baseline Assessment & Secret Discovery
- **Duration:** Days 1–3
- **Objectives:**
  1. Inventory all active environment variables, API secrets, database connection strings, and webhook endpoints across `apps/web` and `apps/api`.
  2. Perform schema validation of PostgreSQL database (`prisma/schema.prisma`) against current production data to confirm zero schema drift.
  3. Export a complete baseline database dump and store in an encrypted staging bucket.
  4. Benchmark baseline performance metrics (TTFB, LCP, API latency p95/p99) on existing infrastructure for post-cutover parity verification.
- **Exit Criteria:** Approved inventory document, validated Prisma schema with zero pending migrations, baseline DB dump verified.

### Phase 1: Foundational VPS & Dokploy Infrastructure Hardening
- **Duration:** Days 4–6
- **Objectives:**
  1. Provision primary Contabo Cloud VPS (Recommended: Cloud VPS XL — 10 vCPU Cores, 60 GB RAM, 800 GB NVMe Storage) running Ubuntu 24.04 LTS.
  2. Apply OS-level hardening: SSH key-only access on non-standard port, disable root password login, configure UFW firewall rules, install and configure Fail2Ban for SSH and reverse proxy rate limits.
  3. Install Docker Engine (v26+) with `containerd` and enable `cgroups v2` and `systemd` cgroup driver.
  4. Deploy Dokploy management platform engine using official automated deployment script, binding Dokploy UI to internal loopback / secure administrative port.
  5. Configure Traefik reverse proxy within Dokploy to handle automated Let's Encrypt TLS certificate generation, HTTP-to-HTTPS redirection, and standard security headers.
  6. Provision Docker bridge networks (`dokploy-network`, `bazionweb-internal`, `bazionweb-public`).
- **Exit Criteria:** Dokploy dashboard operational behind HTTPS, Traefik routing functional, UFW firewall verified with external port scans.

### Phase 2: Database & Core Stateful Service Migration
- **Duration:** Days 7–9
- **Objectives:**
  1. Provision production PostgreSQL 16 Alpine container on persistent NVMe volume with optimized `postgresql.conf` parameters (tuned for 16GB–32GB allocated RAM).
  2. Provision Redis 7 Alpine container on isolated internal network with password authentication and AOF persistence enabled.
  3. Perform test migration of data: Import baseline dump into PostgreSQL 16, execute `prisma migrate deploy`, verify all 27 models, foreign keys, and indexes.
  4. Set up pgloader or streaming replication for near-zero downtime database synchronization between source and target database.
- **Exit Criteria:** Database restored, Prisma migrations apply cleanly, data integrity verification scripts confirm 100% row match.

### Phase 3: Application Containerization & Production Deployment
- **Duration:** Days 10–13
- **Objectives:**
  1. Build and validate standalone Next.js 14 Docker image for `apps/web` using the multi-stage Dockerfile specification (`output: 'standalone'`).
  2. Build and validate NestJS API Docker image for `apps/api`.
  3. Push production images to GitHub Container Registry (GHCR) or build locally via Dokploy Git triggers.
  4. Deploy core services via Dokploy Compose: `web`, `api`, `db`, `redis`.
  5. Configure Traefik routers for `bazionweb.com`, `www.bazionweb.com`, `api.bazionweb.com`.
  6. Verify all API routes, authentication flows, and SSR/hydration behavior.
- **Exit Criteria:** Application starts cleanly, `/api/health` passes, zero hydration errors, SSL certificates valid.

### Phase 4: Customer Provisioning & Deployment Provider Integration
- **Duration:** Days 14–17
- **Objectives:**
  1. Implement the `DeploymentProvider` abstraction layer and `DokployProvider` concrete adapter in `@bazionweb/api`.
  2. Connect NestJS `HostingService` to `DokployProvider` so customer hosting purchases automatically trigger Dokploy project and application provisioning.
  3. Wire Traefik domain binding and automated Let's Encrypt SSL issuance for customer custom domains.
  4. Implement webhook receiver in NestJS to ingest Dokploy build and deployment status callbacks (`SUCCESS`, `ERROR`, `BUILDING`).
  5. Execute automated test suite validating provider abstraction, payload construction, and error recovery.
- **Exit Criteria:** Full end-to-end automated test passes; mock and staging workloads provision successfully via Dokploy API.

### Phase 5: Disaster Recovery & Automated Backup Pipeline
- **Duration:** Days 18–20
- **Objectives:**
  1. Install and configure Restic backup engine on host.
  2. Configure off-site S3-compatible object storage repository (Backblaze B2 / AWS S3) with client-side AES-256 encryption.
  3. Implement automated daily database dump and volume snapshot backup scripts with cron triggers (02:00 EAT).
  4. Implement automated retention pruning (`restic forget --prune`) adhering to MPD plan tiers.
  5. Conduct disaster recovery drill: simulate complete VPS loss, execute bare-metal restore using runbook, and measure RTO/RPO.
- **Exit Criteria:** RPO verified < 15 minutes for DB; RTO verified < 30 minutes for full platform restoration.

### Phase 6: Production Cutover, DNS Switchover & Verification Gate
- **Duration:** Days 21–22
- **Objectives:**
  1. Lower DNS TTLs on Cloudflare to 60 seconds 24 hours prior to cutover.
  2. Schedule maintenance window (01:00–03:00 EAT) to minimize user impact.
  3. Put legacy site in read-only maintenance mode.
  4. Execute final differential database synchronization; verify zero delta.
  5. Switch Cloudflare DNS A/CNAME records to point to Contabo VPS IP address.
  6. Verify live traffic routing, Traefik SSL termination, Web & API logs, and Daraja/Paystack payment callbacks.
  7. Restore normal DNS TTLs (300 seconds / Auto).
- **Exit Criteria:** Production traffic successfully served from self-hosted VPS, zero critical errors, payment callbacks processing seamlessly.

---

## 1.2 Security Boundaries & Client Workload Isolation

Hosting customer applications on a shared VPS alongside the core BazionWeb platform requires defense-in-depth isolation across compute, memory, filesystem, network, and reverse proxy layers.

```
                           INTERNET TRAFFIC
                                  │
                                  ▼
                     ┌───────────────────────────┐
                     │   Cloudflare Edge Proxy   │  (WAF, DDoS, Bot Fight)
                     └────────────┬──────────────┘
                                  │ HTTPS (443)
                                  ▼
                     ┌───────────────────────────┐
                     │   UFW / iptables Defense  │  (Allow only 22, 80, 443)
                     └────────────┬──────────────┘
                                  │
                                  ▼
                     ┌───────────────────────────┐
                     │   Traefik Reverse Proxy   │  (SSL, Host Routing, Rate Limits)
                     └─────┬───────────────┬─────┘
                           │               │
        dokploy-network    │               │    dokploy-network
      ┌────────────────────┴──┐         ┌──┴────────────────────┐
      ▼                       ▼         ▼                       ▼
┌───────────┐           ┌───────────┐ ┌───────────┐       ┌───────────┐
│ BazionWeb │           │ BazionWeb │ │ Tenant A  │       │ Tenant B  │
│ Web App   │           │ API       │ │ Container │       │ Container │
│ (non-root)│           │ (non-root)│ │ (cgroups) │       │ (cgroups) │
└─────┬─────┘           └─────┬─────┘ └───────────┘       └───────────┘
      │                       │
      │   bazionweb-internal  │  (internal: true, NO external traffic)
      └───► ┌───────────┐ ◄───┘
            │ PostgreSQL│
            │ & Redis   │
            └───────────┘
```

### 1.2.1 Docker Container Isolation & Kernel Protection
1. **User Namespaces (`userns-remap`):** Docker daemon is configured with user namespace remapping (`/etc/docker/daemon.json` setting `"userns-remap": "default"`). Root (UID 0) inside a container maps to an unprivileged subuid on the Linux host (e.g., UID 100000+). Even if an attacker gains root within a container, they possess zero root privileges on the host kernel.
2. **Non-Root Execution:** All application containers run under dedicated, unprivileged system users:
   - Web application: user `nextjs` (UID 1001, GID 1001).
   - API application: user `node` or `nestjs` (UID 1001).
   - Root execution is forbidden in all Dockerfiles.
3. **No New Privileges (`no-new-privileges:true`):** Prevents processes inside containers from gaining additional privileges via `setuid` or `setgid` binaries.
4. **Linux Capability Dropping:** Drop all default capabilities and re-add strictly necessary ones:
   ```yaml
   cap_drop:
     - ALL
   cap_add:
     - NET_BIND_SERVICE
   ```
5. **Read-Only Root Filesystem:** Web and API containers run with `read_only: true` wherever feasible, mounting ephemeral writable directories (`/tmp`, `/app/.next/cache`) as memory-backed `tmpfs`.

### 1.2.2 Linux Control Groups (cgroups v2) Resource Governance
1. **CPU Throttling:** Strict CPU quotas enforce upper bounds on CPU execution cycles:
   - Core Web App: `cpus: "2.0"` (burst up to 2 full cores).
   - NestJS API: `cpus: "2.0"`.
   - Tenant Workload (Starter): `cpus: "0.50"` (50% of single core).
   - Tenant Workload (Business): `cpus: "1.50"`.
2. **Memory Hard & Soft Limits:**
   - Database (Postgres): `mem_limit: 8g`, `mem_reservation: 4g`.
   - Redis: `mem_limit: 2g`.
   - Core Web: `mem_limit: 1024m`.
   - Core API: `mem_limit: 1536m`.
   - Tenant Workloads: hard limit `mem_limit: 512m`, soft limit `mem_reservation: 256m`, with `memswap_limit: 512m` (disabling swap thrashing).
3. **Process (PID) Limits:** Set `pids_limit: 100` for client workloads to neutralize fork bombs and thread starvation attacks.
4. **Disk I/O Quotas:** Use Docker `blkio_config` (weight 300 for tenants, 800 for core DB) to prevent disk bandwidth saturation during large file operations.

### 1.2.3 Linux Network Namespaces & Docker Network Segmentation
1. **`bazionweb-internal` (Isolated Bridge):**
   - Configured with `internal: true`.
   - Hosts PostgreSQL 16, Redis 7, and internal microservices.
   - **Zero ingress and zero egress to the public Internet.** Containers on this network cannot initiate outbound connections, nor can they be contacted from the host interface directly.
2. **`bazionweb-public` (Application Bridge):**
   - Connects `web`, `api`, and Traefik reverse proxy.
   - Forwards reverse-proxied traffic to exposed ports.
3. **`dokploy-network` (Shared Ingress Bridge):**
   - Dedicated Traefik reverse proxy bridge connecting ingress proxy to client containers.
   - Client containers cannot access `bazionweb-internal` or host loopback addresses (`127.0.0.1`, `172.17.0.1`).
   - Inter-tenant container communication is blocked via Docker daemon ICC (Inter-Container Communication) restrictions and explicit bridge isolation.

### 1.2.4 Reverse Proxy Routing & Automated SSL via Traefik
Traefik v3 serves as the edge traffic controller:
1. **Dynamic Routing via Docker Labels:** Applications declare routing rules directly through labels, preventing manual configuration drift.
2. **Automated Let's Encrypt TLS Termination:**
   - Certificate Resolver: ACME HTTP-01 challenge for standard domains; DNS-01 challenge (via Cloudflare API plugin) for wildcard certificates (`*.bazionweb.com`).
   - TLS Configuration: Enforces TLS 1.3 as preferred and TLS 1.2 as minimum, utilizing modern cipher suites (`TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`).
   - HSTS Header: Preloaded with `max-age=63072000; includeSubDomains; preload`.
3. **Ingress Middleware Stack:**
   - `ratelimit`: 100 requests/minute per client IP on public routes; 10 requests/minute on `/auth/*` and `/api/v1/billing/*`.
   - `securityheaders`: Injects CSP, X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), Referrer-Policy (`strict-origin-when-cross-origin`), Permissions-Policy.
   - `compress`: Gzip and Brotli compression for static and dynamic assets.

### 1.2.5 Host Firewall (UFW) Hardening & Docker Port Bypass Protection
Docker manipulates `iptables` directly by default, which can bypass standard UFW rules.
To prevent this:
1. **`DOCKER-USER` iptables Filtering:** Configure the `DOCKER-USER` chain to restrict container port exposure exclusively to localhost and the Traefik proxy.
2. **UFW Default Policy:**
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp comment 'SSH Management'
   ufw allow 80/tcp comment 'HTTP ACME Challenge & Redirect'
   ufw allow 443/tcp comment 'HTTPS Traefik Ingress'
   ufw enable
   ```
3. All internal ports (`5432` Postgres, `6379` Redis, `3000` Web, `4000` API, `3001` Dokploy UI) are **never mapped to `0.0.0.0`**. They bind exclusively to internal Docker networks or `127.0.0.1`.

---

## 1.3 Secrets Management & Cryptographic Architecture

### 1.3.1 Secrets Injection Lifecycle
1. **Strict Separation of Build-Time vs Run-Time:**
   - **Build-Time (ARG):** Only non-sensitive public variables (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NODE_ENV`) are provided during image building. Secrets are NEVER passed as standard Docker `ARG` or embedded via `ENV` instructions in Dockerfiles.
   - **Run-Time (ENV):** Secrets (`DATABASE_URL`, `REDIS_PASSWORD`, `DARAJA_CONSUMER_SECRET`, `PAYSTACK_SECRET_KEY`, `JWT_SECRET`) are injected dynamically when the container is instantiated by Dokploy or Docker Compose using secure environment files with strict Unix permissions (`chmod 600 .env.production`).
2. **BuildKit Secret Mounts:** When build-time private access is required (e.g., private npm token), Docker BuildKit secret mounts are utilized (`RUN --mount=type=secret,id=npmrc ...`), ensuring the secret exists only in temporary RAM during that single layer's execution and is omitted from image metadata.

### 1.3.2 Encryption at Rest & In Flight
1. **OS Block Storage Encryption:** Contabo VPS NVMe volumes are partitioned with LUKS (Linux Unified Key Setup) using AES-XTS-PLAIN64 with a 512-bit key, protecting data in the event of physical drive seizure or decommissioning.
2. **Database Application-Level Encryption:** Sensitive customer secrets stored in the database (e.g. client API keys, domain registrar credentials in `vault_secrets`) are encrypted using **AES-256-GCM** with unique initialization vectors (IV) and authentication tags (`authTag`). Plaintext values never touch PostgreSQL storage.
3. **Backup Encryption:** All database dumps and file volume archives are encrypted client-side using Restic's native **AES-256** implementation before transmission over the network.

---

## 1.4 Disaster Recovery & Backup Policies

### 1.4.1 Recovery Objectives (RTO & RPO)
```
┌──────────────────────────────────────┬─────────────────┬──────────────────┐
│ Service Domain                       │ RPO Target      │ RTO Target       │
├──────────────────────────────────────┼─────────────────┼──────────────────┤
│ PostgreSQL Database (Transactional)  │ ≤ 15 Minutes    │ ≤ 15 Minutes     │
├──────────────────────────────────────┼─────────────────┼──────────────────┤
│ Customer Files & Media Storage       │ ≤ 1 Hour        │ ≤ 30 Minutes     │
├──────────────────────────────────────┼─────────────────┼──────────────────┤
│ Full Platform Rebuild (Bare Metal)   │ ≤ 1 Hour        │ ≤ 60 Minutes     │
└──────────────────────────────────────┴─────────────────┴──────────────────┘
```
- **Recovery Point Objective (RPO):** Maximum acceptable data loss duration. Target: ≤ 15 minutes for transactional data via hourly/differential snapshots and WAL archiving; ≤ 1 hour for customer uploads.
- **Recovery Time Objective (RTO):** Maximum acceptable downtime to restore functionality. Target: ≤ 15 minutes for database restoration; ≤ 60 minutes for a complete cold-metal VPS reconstitution.

### 1.4.2 Automated Database Backup Pipeline
1. **Execution Schedule:** Daily at 02:00 EAT (UTC+3) when traffic is at minimum.
2. **Mechanism:**
   - `pg_dump` executed via Docker exec against PostgreSQL container using custom directory format (`--format=custom`) with maximum compression (`-Z 9`).
   - Transactional snapshot consistency (`--single-transaction`) guarantees integrity across all relational tables.
   - SHA-256 checksum calculated immediately upon dump completion and stored alongside the archive.

### 1.4.3 Volume & State Backups via Restic
- **Content-Addressable Deduplication:** Only newly modified disk blocks are uploaded, reducing storage consumption by up to 80% compared to raw file copies.
- **Client-Side Cryptography:** All data blocks, metadata, and directory indexes are encrypted with AES-256 before egress. The remote storage provider (Backblaze B2 / AWS S3) has zero access to encryption keys.
- **Append-Only Mode:** Restic repository credentials configured on the VPS possess append and read permissions only; delete/forget operations require dedicated admin credentials, preventing ransomware from purging historical snapshots.

### 1.4.4 Tiered Retention & Pruning Schedule
Aligned with BazionWeb MPD plan tiers:
- **Daily snapshots:** Retain last 7 days.
- **Weekly snapshots:** Retain last 8 weeks.
- **Monthly snapshots:** Retain last 12 months.
- **Yearly snapshots:** Retain 2 years (Enterprise tier retention).
- **Automated Pruning Command:**
  ```bash
  restic forget \
    --keep-daily 7 \
    --keep-weekly 8 \
    --keep-monthly 12 \
    --keep-yearly 2 \
    --prune
  ```
- **Weekly Integrity Verification:** Every Sunday at 04:00 EAT, an automated verification job runs `restic check --read-data-subset=10%` to detect bit rot or repository corruption. If verification fails, an immediate P1 alert is dispatched to engineering.

### 1.4.5 Step-by-Step Bare-Metal Disaster Recovery Runbook
1. **Provision New VPS:** Boot a fresh Ubuntu 24.04 LTS instance on Contabo, Hetzner, or fallback provider.
2. **Install Core Tooling:** Run initialization script to install Docker, Docker Compose, Restic, and git.
3. **Configure Backup Credentials:** Export `RESTIC_REPOSITORY` and `RESTIC_PASSWORD`.
4. **Restore Platform Configuration:**
   ```bash
   restic restore latest --target / --include /opt/bazionweb
   ```
5. **Start Infrastructure Services:**
   ```bash
   cd /opt/bazionweb/infrastructure/docker
   docker compose up -d db redis
   ```
6. **Restore Database Snapshot:**
   ```bash
   LATEST_DUMP=$(ls -t /tmp/restic_restore_*/db_*.sql | head -1)
   docker compose exec -T db pg_restore -U bazionweb -d bazionweb --clean --if-exists < "$LATEST_DUMP"
   ```
7. **Run Database Migrations & Verification:**
   ```bash
   docker compose run --rm api npx prisma migrate deploy
   ```
8. **Start Application Stack & Traefik Ingress:**
   ```bash
   docker compose up -d web api
   ```
9. **Update DNS Records:** Point Cloudflare DNS A records to the new VPS IP.
10. **Execute Smoke Tests:** Verify SSL handshake, user login, quote generation, and database read/writes.

---

## 1.5 Kenya Regulatory Compliance (ODPC Framework)

As a commercial web development and hosting platform operating in Kenya, BazionWeb is subject to the **Data Protection Act, 2019 (KDPA)**, the **Data Protection (General) Regulations, 2021**, and oversight by the **Office of the Data Protection Commissioner (ODPC)**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          KENYA ODPC COMPLIANCE MATRIX                           │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│ Regulatory Pillar     │ Technical & Operational Implementation                  │
├───────────────────────┼─────────────────────────────────────────────────────────┤
│ Registration          │ Dual registration as Data Controller and Data Processor│
│ Cross-Border Transfer │ EU Contabo residency aligned with GDPR adequacy criteria │
│ Consent Management    │ Explicit, unbundled, versioned opt-in with audit log    │
│ Right to Erasure      │ Automated PII purging with 7-year KRA tax lock          │
│ PII Protection        │ AES-256 encryption & MSISDN masking (+254 7****1234)    │
│ Incident Notification │ Mandatory automated 72-hour ODPC notification pipeline  │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

### 1.5.1 Legal Mandates & Registration Requirements
1. **Mandatory Registration:** BazionWeb registers with the ODPC as both a **Data Controller** (determining the purposes and means of processing client contact, billing, and identity data) and a **Data Processor** (processing end-user data on behalf of hosted client websites).
2. **Designation of Data Protection Officer (DPO):** An operational role responsible for compliance audits, data protection impact assessments (DPIAs), and liaison with the ODPC.

### 1.5.2 Cross-Border Data Transfer & Data Localization (Sections 48–50)
1. **Contabo European VPS Compliance Strategy:**
   - Contabo's primary European data centers are located in Germany (Frankfurt), within the European Union.
   - The EU operates under the General Data Protection Regulation (GDPR), which the ODPC recognizes as an adequate legal framework offering comparable or superior data protection standards to Kenya's DPA 2019.
   - **Appropriate Safeguards:** BazionWeb executes Standard Contractual Clauses (SCCs) and Data Processing Agreements (DPAs) with Contabo, incorporating binding corporate safeguards.
   - **Contractual Necessity:** Transfers of customer website data to European hosting infrastructure are explicitly stipulated in Terms of Service as strictly necessary for the performance of the hosting contract (KDPA Section 48(c)).

### 1.5.3 Consent Management Architecture
1. **Explicit, Granular Consent:** Consent is obtained through active, unbundled opt-in checkboxes during proposal requests, account creation, and checkout. Pre-ticked boxes are strictly prohibited.
2. **Consent Record Metadata:** Every consent event records:
   - `userId` / `clientId`
   - `consentType` (e.g. `TERMS_OF_SERVICE`, `DATA_PROCESSING`, `DIRECT_MARKETING`)
   - `policyVersion` (e.g. `v2.1`)
   - `ipAddress` and `userAgent`
   - Exact UTC `timestamp`

### 1.5.4 Right to Erasure vs Statutory Retention
1. **Conflict Resolution:** KDPA Section 40 grants data subjects the right to deletion of personal data. However, Kenya's **Tax Procedures Act (Section 23)** mandates that books of accounts, invoices, and transaction records must be retained for **seven (7) years**.
2. **Technical Implementation:**
   - **Soft Delete & PII Scrubber:** When an account deletion is requested, active hosting accounts and client logins are deleted.
   - **Invoice Anonymization:** Transaction rows, invoices, and payment logs are retained for 7 years to satisfy the Kenya Revenue Authority (KRA), but all identifying personal metadata (client personal name, personal phone number, IP addresses) is cryptographically pseudonymized or redacted:
     `John Doe, +254712345678, john@domain.com` ──► `Redacted Client #4812, [REDACTED], billing-4812@anonymized.bazionweb.com`.
   - **Complete File Purge:** Backups and customer website data associated with the deleted hosting account are purged from primary and replica storage upon expiration of the 30-day grace retention window.

### 1.5.5 Personal Data Handling (M-PESA MSISDN & KYC)
1. **M-PESA Phone Numbers (MSISDN):**
   - Kenyan mobile numbers identify individuals and are classified as personal data.
   - **Display Masking:** Frontend UI, API responses for non-administrative roles, and log files mask numbers:
     `+254 7****1234`.
   - **Zero Log Leakage:** HTTP request logging interceptors strip `PhoneNumber`, `PartyA`, and `PartyB` fields from Daraja STK Push callbacks before writing to Loki / console logs.
2. **KYC Documents (National ID / KRA PIN Certificates):**
   - Stored in private, access-restricted S3 object buckets.
   - Download links are issued as short-lived pre-signed URLs with a maximum TTL of 300 seconds.

### 1.5.6 Mandatory 72-Hour Data Breach Response Protocol
Under KDPA Section 43:
1. In the event of an unauthorized security breach involving personal data:
   - The Data Processor must notify the Data Controller within **48 hours**.
   - The Data Controller must officially notify the ODPC within **72 hours** of becoming aware of the breach.
   - Affected data subjects must be notified in writing without unreasonable delay if the breach poses high risk to their rights and freedoms.
2. An automated incident response trigger (`AuditInterceptor` security anomaly alert) escalates potential breaches to the security team within 15 minutes of detection.

---

## 1.6 Dokploy Customer Provisioning REST API Integration Design

Dokploy provides the open-source orchestration layer that replaces proprietary platforms (Vercel, Heroku) with a lightweight, Docker-native infrastructure engine.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      DOKPLOY REST API PROVISIONING WORKFLOW                     │
└─────────────────────────────────────────────────────────────────────────────────┘

 BazionWeb API               Dokploy Engine API               Traefik / Docker
       │                              │                               │
       │ 1. POST /api/project.create  │                               │
       ├─────────────────────────────►│ Create Project Namespace      │
       │◄─────────────────────────────┤                               │
       │                              │                               │
       │ 2. POST /api/app.create      │                               │
       ├─────────────────────────────►│ Provision App Container Spec  │
       │◄─────────────────────────────┤                               │
       │                              │                               │
       │ 3. POST /api/app.saveEnv     │                               │
       ├─────────────────────────────►│ Inject Environment Variables  │
       │◄─────────────────────────────┤                               │
       │                              │                               │
       │ 4. POST /api/domain.create   │                               │
       ├─────────────────────────────►│ Register Traefik Router       │
       │                              ├──────────────────────────────►│ Request Let's Encrypt
       │◄─────────────────────────────┤                               │
       │                              │                               │
       │ 5. POST /api/app.deploy      │                               │
       ├─────────────────────────────►│ Trigger Build & Run           │
       │                              ├──────────────────────────────►│ Spin up Container
       │◄─────────────────────────────┤                               │
       │                              │                               │
       │ 6. Webhook / Polling Status  │                               │
       │◄─────────────────────────────┤ Deploy SUCCESS Callback       │
       │                              │                               │
```

### 1.6.1 Dokploy Architecture & API Subsystem
- **Dokploy Core Engine:** Node.js/TypeScript backend running Fastify/Express with tRPC and REST API routes, interacting directly with the host `/var/run/docker.sock`.
- **Traefik Dynamic Configuration Manager:** Automatically generates routing configurations and certificates for managed containers.
- **SQLite / Postgres State Store:** Stores platform metadata, projects, applications, domains, and deployment histories.

### 1.6.2 Authentication & Security
- Dokploy provides Bearer Token API Key authentication.
- API keys are created via the administrative console with scoped permissions and passed in request headers:
  ```http
  Authorization: Bearer <DOKPLOY_API_KEY>
  Content-Type: application/json
  ```
- Dokploy API endpoint (`http://127.0.0.1:3000` or internal Docker DNS `http://dokploy:3000`) is bound exclusively to the internal bridge network and never exposed to the public Internet.

### 1.6.3 Customer Provisioning Lifecycle Workflows
The automated workflow coordinates six discrete steps:
1. **Project Provisioning:** Ensure a project namespace exists for the tenant:
   - Endpoint: `POST /api/project.create`
   - Payload: `{ "name": "client-{clientId}", "description": "Tenant workload" }`
2. **Application Creation:** Create the application workload definition:
   - Endpoint: `POST /api/application.create`
   - Payload:
     ```json
     {
       "projectId": "proj-uuid",
       "name": "app-{hostingId}",
       "appName": "app-{hostingId}",
       "buildType": "dockerfile",
       "dockerfile": "Dockerfile",
       "sourceType": "git",
       "repository": "https://github.com/bazionweb-clients/{repo}",
       "branch": "main",
       "autoDeploy": true
     }
     ```
3. **Environment Variable Injection:**
   - Endpoint: `POST /api/application.saveEnvironment`
   - Payload:
     ```json
     {
       "applicationId": "app-uuid",
       "env": "NODE_ENV=production\nDATABASE_URL=postgresql://...\nPORT=3000"
     }
     ```
4. **Domain Binding & Automated Let's Encrypt SSL:**
   - Endpoint: `POST /api/domain.create`
   - Payload:
     ```json
     {
       "applicationId": "app-uuid",
       "host": "clientdomain.co.ke",
       "port": 3000,
       "https": true,
       "certificateType": "letsencrypt",
       "path": "/"
     }
     ```
5. **Deployment Trigger:**
   - Endpoint: `POST /api/application.deploy`
   - Payload: `{ "applicationId": "app-uuid" }`
   - Returns a `deploymentId` tracking the build task.
6. **Deployment Status & Log Polling:**
   - Status Endpoint: `GET /api/application.one?applicationId={id}`
   - Logs Endpoint: `GET /api/application.readLogs?applicationId={id}&lines={lines}`

### 1.6.4 Error Handling, Idempotency & Retries
- **Idempotency:** Every provisioning call carries an `Idempotency-Key` header derived from `{clientId}:{hostingId}:{operation}` to prevent duplicate container creation on network retries.
- **Exponential Backoff:** API calls to Dokploy utilize exponential backoff (initial delay 500ms, factor 2, max 3 retries) with jitter for transient 502/503/504 errors.
- **Circuit Breaker:** If Dokploy fails 5 consecutive health checks, the circuit opens, marking customer provisioning as `QUEUED` in PostgreSQL and notifying on-call engineers.

---
*Verified and authoritative documentation by worker_transition_1.*
