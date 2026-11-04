# BazionWeb — Server Capacity Planning, Workload Modeling, and Unit Economics Specification

**Document ID:** BAZ-DOC-2026-CAP-01  
**Classification:** Technical Architecture Specification & Financial Model  
**Target File:** `docs/capacity_planning_and_unit_economics.md`  
**Reference Codebase:** `apps/api`, `apps/web`  
**Date:** November 2026  
**Status:** Approved Architectural Standard  

---

## 1. Executive Summary & Architectural Overview

This document defines the authoritative capacity models, container isolation parameters, client density thresholds, and unit economics for the BazionWeb managed hosting platform.

BazionWeb operates a decoupled infrastructure model:
1. **Control Plane (Virtarix Cloud VPS):** Houses the Dokploy management platform engine, central PostgreSQL database, Redis platform cache, NestJS API (`apps/api`), and background telemetry workers. The control plane hosts zero customer web containers, ensuring that tenant workloads cannot compromise platform management or billing availability.
2. **Worker Node Fleet (Leaseweb London Datacenter):** High-speed KVM virtual private servers dedicated exclusively to executing isolated customer containerized workloads, edge reverse proxying (Traefik v3), and managed multi-tenant data tiers (MariaDB/PostgreSQL 16 and Redis 7).

### Core Operational Objectives
- **Zero Noisy-Neighbor Saturation:** Linux Control Groups (cgroups v2) enforce strict CPU CFS quotas, hard memory limits, and zero-additional swap allocations across all containers.
- **Predictable High Margins:** Low server acquisition costs (£4.99/mo baseline) yield gross profit margins of **92.6% (Kenya)** to **95.1% (Global)** at recommended tenant densities.
- **Micro Break-Even Points:** Fully amortizes total annual operating expenses ($84/year) with just **2–3 Host Essential clients** or **1 Host Professional client**.

---

## 2. Hardware Topology & Physical Node Profiles

### 2.1 Hardware Specification Matrix

| Hardware Parameter | Virtarix Control Plane | Leaseweb London Worker (Baseline) | Leaseweb London Worker (Expansion) |
|---|---|---|---|
| **Role** | Management Plane & Platform DB | Client Container Workloads | High-Density Client Workloads |
| **vCPU Cores** | 4 Cores (Dedicated) | 4 vCPU (KVM Hypervisor) | 6 vCPU (KVM Hypervisor) |
| **Physical RAM** | 8 GB (8,192 MB) | 6 GB (6,144 MB) | 16 GB (16,384 MB) |
| **Storage Subsystem** | 160 GB NVMe (LUKS Encrypted) | 100 GB NVMe PCIe Gen4 | 200 GB NVMe PCIe Gen4 |
| **Network Uplink** | 1 Gbps Port | 10 Gbps Port / Unmetered | 10 Gbps Port / Unmetered |
| **Datacenter Location** | Frankfurt, Germany | London, United Kingdom (LD4/LD5)| London, United Kingdom (LD4/LD5)|
| **Monthly Cost** | Internal Platform Overhead | **£4.99 / month** (~$6.40 USD) | **£14.99 / month** (~$19.20 USD) |
| **Annual Server Cost** | Internal Platform Overhead | **$76.80 USD / year** (KSh 9,984) | **$230.40 USD / year** (KSh 29,950)|

### 2.2 Geographic Routing & Latency Optimization
- **European & North American Traffic:** Direct low-latency peering via London Internet Exchange (LINX) (< 20ms across Western Europe, ~75–85ms to US East).
- **East African Traffic (Kenya):** Physical round-trip time (RTT) from Nairobi to London over submarine fiber (SEACOM / TEAMS) is 120ms–140ms.
- **Edge Acceleration:** All BazionWeb hosting tiers include Cloudflare Edge DNS and global CDN caching. Static assets (images, CSS, JS, HTML edge caches) are served directly from Cloudflare's Nairobi (NBO) Point of Presence (PoP) with sub-10ms response times.

---

## 3. Workload Modeling & Usable Memory Budget

### 3.1 Baseline Worker Node (6,144 MB RAM)

To guarantee that the Linux kernel never triggers out-of-memory (OOM) panics or starves system daemons, memory is partitioned into three distinct tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOTAL PHYSICAL RAM: 6,144 MB (Leaseweb London Baseline Node)           │
├────────────────────────┬──────────────────────┬────────────────────────┤
│ Host OS & Platform     │ Kernel Safety Buffer │ Usable Tenant Pool     │
│ Daemons: 800 MB (13%)  │ 544 MB (8.8%)        │ 4,800 MB (78.2%)       │
└────────────────────────┴──────────────────────┴────────────────────────┘
```

1. **Host OS & Platform Overhead (800 MB):**
   - Ubuntu 24.04 LTS minimal kernel, systemd, journald, ufw, fail2ban: ~400 MB.
   - Docker daemon (`dockerd`, `containerd`, `containerd-shim-runc-v2` instances): ~250 MB.
   - Traefik v3 Ingress Reverse Proxy (TLS termination, Let's Encrypt ACME daemon, dynamic Docker socket router): ~150 MB.
2. **Safety Headroom & Dynamic Kernel Buffer (544 MB):**
   - Dedicated buffer for Linux slab allocators, page tables, TCP socket receive/transmit buffers under connection bursts, and filesystem dentry caches.
3. **Usable Tenant Workload Pool (4,800 MB):**
   - Available budget for client container soft memory reservations, multi-tenant MariaDB/PostgreSQL caches, and shared Redis caches.
   - Formula: $\text{Usable RAM} = 6,144\text{ MB} - (800\text{ MB} + 544\text{ MB}) = \mathbf{4,800\text{ MB}}$.

### 3.2 Expansion Worker Node (16,384 MB RAM)

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOTAL PHYSICAL RAM: 16,384 MB (Leaseweb London Expansion Node)         │
├────────────────────────┬──────────────────────┬────────────────────────┤
│ Host OS & Platform     │ Kernel Safety Buffer │ Usable Tenant Pool     │
│ Daemons: 900 MB (5.5%) │ 604 MB (3.7%)        │ 14,880 MB (90.8%)      │
└────────────────────────┴──────────────────────┴────────────────────────┘
```

- Formula: $\text{Usable RAM} = 16,384\text{ MB} - (900\text{ MB} + 604\text{ MB}) = \mathbf{14,880\text{ MB}}$.

---

## 4. Container Quota Calibration Across All 4 Tiers

Every tenant container provisioned via `DokployProvider` in `apps/api` must receive an explicit, immutable cgroups v2 configuration to ensure strict isolation:

| Resource Parameter | Host Essential (`host-essential`) | Host Business (`host-business`) | Host Professional (`host-professional` / `host-pro`) | Managed Cloud (`host-cloud`) |
|---|---|---|---|---|
| **Target Workload** | Low-traffic portfolio, small business landing pages | Growing business, corporate sites, lead generation | High-traffic e-commerce, membership sites, heavy CMS | Custom full-stack apps (Next.js + NestJS + DB) |
| **CPU Quota (`cpus`)** | **0.50 vCPU** (50,000 µs / 100ms) | **1.50 vCPU** (3x Essential) | **2.50 vCPU** (250,000 µs / 100ms) | **3.00–4.00 vCPU** |
| **Soft Memory Reservation (`memoryReservationMb`)** | **128 MB** | **256 MB** | **512 MB** | **1,024 MB** |
| **Hard Memory Limit (`memoryLimitMb`)** | **384 MB** (3x burst headroom) | **768 MB** (2x Essential limit) | **1,536 MB** (1.5 GB burst) | **2,048 MB** (2.0 GB burst) |
| **Memory Swap Limit (`memorySwapMb`)** | **384 MB** (0 MB extra swap) | **768 MB** (0 MB extra swap) | **1,536 MB** (0 MB extra swap) | **2,048 MB** (0 MB extra swap) |
| **Process Limit (`pidsLimit`)** | **100 PIDs** | **150 PIDs** | **250 PIDs** | **500 PIDs** |
| **Restart Policy** | `unless-stopped` | `unless-stopped` | `unless-stopped` | `unless-stopped` |
| **Storage Quota** | **5 GB** NVMe SSD | **15 GB** NVMe SSD | **30 GB** NVMe SSD | **50 GB** NVMe SSD |
| **Bandwidth Quota** | **100 GB** / month | **500 GB** / month | **1,000 GB** (1 TB) / month | **2,000 GB** (2 TB) / month |
| **Corporate Email Inboxes** | 0 (Transactional API only) | **Up to 5 inboxes** (External routing) | **Up to 10 inboxes** (External routing) | Unlimited external inboxes |
| **Database Architecture** | Shared DB (Isolated Schema/User)| Shared DB (Isolated Schema/User)| Shared DB (Elevated Conn Pool) | **Dedicated Standalone PostgreSQL** |
| **Cache Architecture** | Shared Redis (Key Prefix) | Shared Redis (Key Prefix) | Shared Redis (ACL User + Prefix)| **Dedicated Standalone Redis** |

### The Swap Elimination Principle
When Docker sets `--memory 384M` without setting `--memory-swap`, Docker defaults to allowing up to 384 MB of swap space on host disk. In a multi-tenant node with 20+ containers, if 5 containers experience memory pressure and swap to disk simultaneously, NVMe I/O queue depths spike, choking Traefik and database read/writes for all co-hosted clients.
**BazionWeb Standard:** `--memory-swap` is set equal to `--memory` (`memorySwapMb === memoryLimitMb`), forbidding container swap expansion and forcing the Linux kernel to reclaim page caches cleanly or invoke the localized cgroup OOM killer without affecting the host.

---

## 5. Client Density Modeling, Headroom & Overcommit Analysis

### 5.1 Baseline Node Capacity Model (23 Clients)

The standard recommended tenant portfolio on a single 4 vCPU / 6 GB RAM worker node:

| Tier | Tenant Count | Unit Soft Reservation | Total Reserved RAM | Unit Hard Limit | Total Hard Limits | Unit CPU Quota | Total CPU Quotas |
|---|---|---|---|---|---|---|---|
| **Host Essential** | 15 | 128 MB | 1,920 MB | 384 MB | 5,760 MB | 0.50 vCPU | 7.50 vCPU |
| **Host Business** | 6 | 256 MB | 1,536 MB | 768 MB | 4,608 MB | 1.50 vCPU | 9.00 vCPU |
| **Host Professional**| 2 | 512 MB | 1,024 MB | 1,536 MB | 3,072 MB | 2.50 vCPU | 5.00 vCPU |
| **TOTALS** | **23** | — | **4,480 MB** | — | **13,440 MB** | — | **21.50 vCPU** |

#### Headroom Metrics
- **Provisioning Pool Headroom:** $\text{Usable Pool (4,800 MB)} - \text{Committed Reservations (4,480 MB)} = \mathbf{320\text{ MB}}$ unallocated capacity buffer.
- **Absolute Free Physical Headroom:**
  $$\text{Free Physical RAM} = 6,144\text{ MB} - (4,480\text{ MB client reservations} + 500\text{ MB actual idle daemons}) = \mathbf{1,164\text{ MB}}$$
  This 1,164 MB of physical memory remains completely free for dynamic Linux page cache caching, disk read buffers, and traffic burst absorption.

#### Overcommit Ratios
- **Memory Overcommit Ratio:**
  $$\text{Overcommit} = \frac{\sum \text{Hard Limits}}{\text{Usable Tenant RAM}} = \frac{13,440\text{ MB}}{4,800\text{ MB}} = \mathbf{2.80\text{x}}$$
  Multi-tenant PHP/Node.js web workloads average 15%–30% memory utilization during standard operations. A 2.80x overcommit on hard burst limits is conservative and stable.
- **CPU Overcommit Ratio:**
  $$\text{CPU Overcommit} = \frac{\sum \text{CPU Limits}}{\text{Physical vCPUs}} = \frac{21.50\text{ vCPU}}{4\text{ Cores}} = \mathbf{5.38\text{x}}$$
  Web requests are ephemeral (sub-second execution). CFS quota scheduling prevents CPU starvation.

---

### 5.2 Expansion Node Capacity Model (61 Clients)

On a 6 vCPU / 16 GB RAM worker node:

| Tier | Tenant Count | Unit Soft Reservation | Total Reserved RAM | Unit Hard Limit | Total Hard Limits | Unit CPU Quota | Total CPU Quotas |
|---|---|---|---|---|---|---|---|
| **Host Essential** | 35 | 128 MB | 4,480 MB | 384 MB | 13,440 MB | 0.50 vCPU | 17.50 vCPU |
| **Host Business** | 18 | 256 MB | 4,608 MB | 768 MB | 13,824 MB | 1.50 vCPU | 27.00 vCPU |
| **Host Professional**| 6 | 512 MB | 3,072 MB | 1,536 MB | 9,216 MB | 2.50 vCPU | 15.00 vCPU |
| **Managed Cloud** | 2 | 1,024 MB | 2,048 MB | 2,048 MB | 4,096 MB | 3.00 vCPU | 6.00 vCPU |
| **TOTALS** | **61** | — | **14,208 MB** | — | **40,576 MB** | — | **65.50 vCPU** |

#### Headroom & Overcommit Metrics
- **Provisioning Pool Headroom:** $14,880\text{ MB} - 14,208\text{ MB} = \mathbf{672\text{ MB}}$.
- **Physical Unreserved Headroom:** $16,384\text{ MB} - 14,208\text{ MB} = \mathbf{2,176\text{ MB}}$.
- **Memory Overcommit Ratio:** $40,576 / 14,880 = \mathbf{2.73\text{x}}$.
- **CPU Overcommit Ratio:** $65.50 / 6 = \mathbf{10.92\text{x}}$.

---

## 6. Unit Economics & Break-Even Modeling

### 6.1 Annual Operating Cost Structure

Operating costs are strictly calculated based on verified wholesale supplier contracts:

1. **Leaseweb London Worker Node (Baseline):**
   - Monthly Server Fee: **£4.99 / month**
   - At benchmark exchange rate (1 GBP = $1.28 USD): **$6.40 USD / month**
   - Annual Server Cost: $6.40 \times 12 = \mathbf{\$76.80\text{ USD / year}}$ (KSh 9,984 / year).
2. **Offsite Automated Disaster Recovery Storage (Backblaze B2):**
   - Daily automated database dumps and compressed volume snapshots via Restic.
   - Storage volume: 100 GB.
   - Backblaze B2 pricing: **$0.006 / GB / month** ($6.00 / TB / month).
   - Monthly Storage Fee: $100 \times \$0.006 = \mathbf{\$0.60\text{ USD / month}}$.
   - Annual Storage Cost: $0.60 \times 12 = \mathbf{\$7.20\text{ USD / year}}$ (KSh 936 / year).
3. **Total Annual Operating Cost (Baseline Worker):**
   $$\text{Total Annual Cost} = \$76.80 + \$7.20 = \mathbf{\$84.00\text{ USD / year}}\quad (\mathbf{KSh\ 10,920\text{ / year}})$$

4. **Expansion Node Annual Operating Cost:**
   - Server: £14.99/mo ≈ $19.20/mo ($230.40/yr).
   - Backblaze B2 Backup (200 GB): $1.20/mo ($14.40/yr).
   - Total Expansion Annual Cost: **$244.80 USD / year** ($\approx \mathbf{\$250.00\text{ USD / year}}$ / KSh 32,500 / year).

---

### 6.2 Break-Even Thresholds on Baseline Node

How many clients are required to pay for the entire server fleet?

#### Kenya Market (KES) — Annual Cost = KSh 10,920

$$\text{Break-Even Count} = \frac{\text{Annual Operating Cost}}{\text{Plan Annual Price}}$$

- **Host Essential (KSh 4,500/year):**
  $$\text{Break-Even} = \frac{10,920}{4,500} = 2.43 \longrightarrow \mathbf{3\text{ Clients}}$$
  *(3 clients yield KSh 13,500, generating an immediate KSh 2,580 net surplus).*
- **Host Business (KSh 8,500/year):**
  $$\text{Break-Even} = \frac{10,920}{8,500} = 1.28 \longrightarrow \mathbf{2\text{ Clients}}$$
- **Host Professional (KSh 15,000/year):**
  $$\text{Break-Even} = \frac{10,920}{15,000} = 0.73 \longrightarrow \mathbf{1\text{ Client}}$$
  *(A single Host Professional client covers 137% of the annual server cost!)*

#### Global / International Market (USD) — Annual Cost = $84.00

- **Host Essential ($49/year):**
  $$\text{Break-Even} = \frac{84}{49} = 1.71 \longrightarrow \mathbf{2\text{ Clients}}$$
- **Host Business ($99/year):**
  $$\text{Break-Even} = \frac{84}{99} = 0.85 \longrightarrow \mathbf{1\text{ Client}}$$
  *(1 client covers 118% of the annual server cost!)*
- **Host Professional ($189/year):**
  $$\text{Break-Even} = \frac{84}{189} = 0.44 \longrightarrow \mathbf{1\text{ Client}}$$
  *(1 client covers 225% of the annual server cost!)*

---

### 6.3 Full Density Financial Performance & Gross Margins

#### Baseline Node: 23 Clients (15 Essential, 6 Business, 2 Professional)

| Metric | Kenya Market (KES) | Global Market (USD) |
|---|---|---|
| 15 x Host Essential Revenue | KSh 67,500 | $735.00 |
| 6 x Host Business Revenue | KSh 51,000 | $594.00 |
| 2 x Host Professional Revenue | KSh 30,000 | $378.00 |
| **Gross Annual Revenue** | **KSh 148,500** (~$1,142.30 USD) | **$1,707.00 USD** |
| **Annual Operating Costs** | **KSh 10,920** ($84.00 USD) | **$84.00 USD** |
| **Net Gross Profit** | **KSh 137,580** (~$1,058.30 USD) | **$1,623.00 USD** |
| **Gross Profit Margin (%)** | **92.6%** | **95.1%** |

$$\text{Gross Margin (Kenya)} = \frac{148,500 - 10,920}{148,500} = \mathbf{92.64\%}$$
$$\text{Gross Margin (Global)} = \frac{1,707 - 84}{1,707} = \mathbf{95.08\%}$$

---

#### Expansion Node: 61 Clients (35 Essential, 18 Business, 6 Professional, 2 Cloud)

| Metric | Kenya Market (KES) | Global Market (USD) |
|---|---|---|
| 35 x Host Essential Revenue | KSh 157,500 | $1,715.00 |
| 18 x Host Business Revenue | KSh 153,000 | $1,782.00 |
| 6 x Host Professional Revenue | KSh 90,000 | $1,134.00 |
| 2 x Managed Cloud Revenue | KSh 60,000 | $580.00 |
| **Gross Annual Revenue** | **KSh 460,500** (~$3,542.30 USD) | **$5,211.00 USD** |
| **Annual Operating Costs** | **KSh 32,500** ($250.00 USD) | **$250.00 USD** |
| **Net Gross Profit** | **KSh 428,000** (~$3,292.30 USD) | **$4,961.00 USD** |
| **Gross Profit Margin (%)** | **92.94%** ($\approx \mathbf{93.0\%}$) | **95.20%** |

---

## 7. Operational Tenancy & Guardrail Architecture

To translate these models into real-world guarantees, `apps/api` implements five core runtime guardrails:

### 7.1 Server Boundary Guardrail
In `HostingService.create()`, before dispatching workload creation:
1. Query active accounts on the target node.
2. Sum existing soft memory reservations: $\sum \text{memoryReservationMb}$.
3. Verify that $\sum \text{allocated} + \text{tierProfile.memoryReservationMb} \le \text{node.usableMemoryMb}$.
4. If the reservation exceeds the usable ceiling or the tenant count reaches the density ceiling (23 for baseline, 61 for expansion), the request is rejected with `400 Bad Request` (`Server capacity boundary reached`).

### 7.2 Strict Container Limits Guardrail
In `DokployProvider.createWorkload()`:
- Workloads missing explicit resource limits are rejected with `BadRequestException` (`Unconstrained container allocation rejected`).
- Memory swap is hard-locked (`memorySwap = memoryLimitMb`).
- Restart policy is set to `'unless-stopped'`.

### 7.3 Corporate Email Zero-RAM Strategy
- Host Business promises "5 Corporate Email Inboxes".
- Local mail daemons (Postfix/Dovecot/SpamAssassin) consume 1.5 GB–2.5 GB of RAM and risk IP blacklisting on cloud VPS IP ranges.
- **Architectural Solution:** Client corporate mail is completely decoupled from the worker node and routed through managed external providers (Cloudflare Email Routing, Zoho Mail, MXroute).
- `EmailRoutingHelper` generates deterministic MX, SPF, DKIM, and DMARC DNS records for customer domains, incurring **0 MB RAM overhead** on the worker node.

### 7.4 Multi-Tenant Database & Redis Tenancy
- **Host Essential, Business, and Professional:** Co-located on a shared, highly optimized MariaDB/PostgreSQL 16 container and a shared Redis 7 container:
  - Logical Database: Dedicated database name `db_<domainSlug>_<shortHex>`.
  - Dedicated User: Dedicated username `usr_<domainSlug>_<shortHex>` with permissions restricted strictly to their schema.
  - Redis Isolation: Tenant key prefix `app:<domainSlug>:` and Redis ACL user credentials.
- **Managed Cloud:** Standalone dedicated PostgreSQL and Redis containers with dedicated volumes and custom cgroup allocations.

---

## 8. Documentation & Codebase Consistency Verification Checklist

This checklist guarantees complete alignment across application code, pricing engines, and documentation:

| Component | Target Location in Repository | Authoritative Specification Value | Status |
|---|---|---|---|
| **Tier Identifier** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | `'host-essential'`, `'host-business'`, `'host-professional'`, `'host-cloud'` | Required in M1 |
| **Tier Aliases** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | `'host-pro'` maps to `'host-professional'` | Required in M1 |
| **Essential cgroups** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | CPU: 0.5, Limit: 384M, Res: 128M, Swap: 384M, PID: 100 | Required in M1 |
| **Business cgroups** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | CPU: 1.5, Limit: 768M, Res: 256M, Swap: 768M, PID: 150 | Required in M1 |
| **Pro cgroups** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | CPU: 2.0, Limit: 1536M, Res: 512M, Swap: 1536M, PID: 250 | Required in M1 |
| **Cloud cgroups** | `apps/api/src/modules/hosting/constants/hosting-tiers.config.ts` | CPU: 4.0, Limit: 2048M, Res: 1024M, Swap: 2048M, PID: 500 | Required in M1 |
| **Baseline Node** | `apps/api/src/modules/hosting/constants/server-topologies.config.ts` | 4 vCPU, 6144M total, 1344M reserved, 4800M usable, max 23 tenants | Required in M1 |
| **Expansion Node** | `apps/api/src/modules/hosting/constants/server-topologies.config.ts` | 6 vCPU, 16384M total, 1504M reserved, 14880M usable, max 61 tenants | Required in M1 |
| **Control Plane** | `apps/api/src/modules/hosting/constants/server-topologies.config.ts` | 4 vCPU, 8192M total, 8192M reserved, 0M usable (tenant workloads forbidden) | Required in M1 |
| **Kenya Pricing** | `apps/web/src/lib/pricingData.ts` & `priceBooks.ts` | KSh 4,500 (Essential), KSh 8,500 (Business), KSh 15,000 (Pro), From KSh 30,000 (Cloud) | Aligned in code |
| **Global Pricing** | `apps/web/src/lib/pricingData.ts` & `priceBooks.ts` | $49 (Essential), $99 (Business), $189 (Pro), From $290 (Cloud) | Aligned in code |
| **Price Books Sync**| `apps/web/src/lib/priceBooks.ts` | Add `'host-cloud'` to KE and Global price books | Required in M2 |
| **Store Sync** | `apps/web/src/components/store/StoreView.tsx` | Add `'host-cloud'` marketing card | Required in M2 |
| **Catalog Sync** | `apps/web/src/lib/servicesFamilyData.ts` | Include `'host-professional'` and `'host-cloud'` in `managed-technology` | Required in M2 |
| **Legacy Docs Sync**| `docs/master/02-BAZIONWEB-PRICING-BOOK.md` | Update legacy prices ($60, $120, $240, $300) to runtime ($49, $99, $189, $290) | Required in M2 |
| **Automated Tests** | `apps/api/src/modules/hosting/__tests__/` & `apps/web/__tests__/` | Unit tests for tier mapping, boundary checks, and price book consistency | Required in M3 |
