# BazionWeb — Uptime Monitoring & Automated Backups Guide

**Document ID:** BW-GUIDE-OPS-001  
**Target Systems:** Better Stack, Uptime Kuma, Vercel, Docker VPS, PostgreSQL 16, Restic, Backblaze B2  
**Target SLAs:** 99.9% Uptime, P1 Incident Response ≤ 15m, RPO ≤ 24 Hours, RTO ≤ 2 Hours  
**Public Status Page:** `https://status.bazionweb.com`  
**Last Updated:** 2026-11-01  

---

## 1. Executive Summary & Reliability Benchmarks

This operational runbook provides beginner-friendly, step-by-step instructions to configure **Production Uptime Monitoring** and **Automated Backups & Disaster Recovery** for **BazionWeb**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION RELIABILITY ARCHITECTURE                   │
│                                                                             │
│  [Synthetic Monitoring] ──► Better Stack (Cloud) + Uptime Kuma (VPS)       │
│           │                                                                 │
│           ├── Multi-Tier Alerting: Telegram + Slack ──► SMS ──► Phone Call │
│           └── Public Status Dashboard: status.bazionweb.com                │
│                                                                             │
│  [Automated Backups]    ──► 3-2-1 Backup Strategy                           │
│           │                                                                 │
│           ├── Git / Code: Protected main branch + Vercel Instant Rollback   │
│           ├── DB Snapshot: pg_dump ──► Restic AES-256 ──► Backblaze B2      │
│           └── Retention: 7 Daily / 4 Weekly / 12 Monthly / 2 Yearly (GFS)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Operational Benchmarks:
- **Production Availability Target:** 99.9% Uptime (< 43.8 minutes downtime per month).
- **Incident Response SLA:** Critical P1 (site down) response in **under 15 minutes** (24/7/365).
- **RPO (Recovery Point Objective):** **≤ 24 Hours** (maximum theoretical data loss bounded by daily 02:00 EAT backup snapshot).
- **RTO (Recovery Time Objective):** **≤ 2 Hours** to complete database restoration and operational recovery.

---

## 2. Production Uptime Monitoring with Better Stack

**Better Stack** (formerly Better Uptime) provides multi-region cloud monitoring with deep string validation, phone voice escalation, and public status pages.

### 2.1 Setting Up Synthetic HTTP Probes
Log in to [betterstack.com](https://betterstack.com) and navigate to **Monitors -> Create Monitor**:

#### Monitor 1: Public Web Application (Homepage)
- **URL to monitor:** `https://bazionweb.com`
- **Alert type:** `HTTP status code + Keyword check`
- **Check frequency:** `30 seconds`
- **Check locations:** Multi-region (US East, Frankfurt, Johannesburg, Singapore)
- **Expected HTTP status:** `200`
- **Keyword assertion:** `"BazionWeb"` (Ensures HTML is actually rendering and not returning a blank white page or error page)
- **Response time alert:** Alert if response exceeds `5000ms`.

#### Monitor 2: Next.js Health API Route
- **URL to monitor:** `https://bazionweb.com/api/health`
- **Check frequency:** `30 seconds`
- **Expected HTTP status:** `200`
- **Keyword assertion:** `"status":"ok"`
- **Request Headers:** `User-Agent: BetterUptime-Probe`

#### Monitor 3: NestJS Backend REST API Health
- **URL to monitor:** `https://api.bazionweb.com/api/v1/health`
- **Check frequency:** `30 seconds`
- **Expected HTTP status:** `200`
- **Keyword assertion:** `"status":"ok"`

#### Monitor 4: High-Value Conversion Pages
- **URLs to monitor:** `https://bazionweb.com/pricing` and `https://bazionweb.com/quote`
- **Check frequency:** `60 seconds`
- **Expected HTTP status:** `200`

#### Monitor 5: SSL / TLS Certificate Expiry
- **Target:** `bazionweb.com`
- **Thresholds:** Warn when cert expires in `14 days`, alert when `3 days`.

---

### 2.2 Multi-Tier Escalation Ladder
Configure in **Better Stack -> Integrations & Escalations**:

```
[00m - 05m] Tier 1: Telegram Bot + Slack #alerts-prod + alerts@bazionweb.com
       │
[05m - 15m] Tier 2: SMS to On-Duty Systems Engineer (+254 721 287 053)
       │
[15m - 30m] Tier 3: Automated Phone Voice Call to Technical Lead / Founder
```

1. **Telegram Channel Setup:**
   - In Telegram, invite `@BetterStackBot` into the private `#bazion-ops` team channel.
   - Enter your Chat ID into Better Stack integrations. All agents receive immediate push notifications with "Acknowledge" and "Resolve" buttons.
2. **Slack Integration:**
   - Connect the Better Stack Slack App to `#alerts-prod`.
3. **SMS and Voice Escalation:**
   - Enter primary on-call mobile number (`+254 721 287 053`).
   - If an outage is unacknowledged after 5 minutes, an SMS is sent.
   - If unacknowledged after 15 minutes, an automated voice phone call is initiated.

---

### 2.3 Public Status Page Setup (`status.bazionweb.com`)
A transparent status page builds client confidence during planned maintenance or unexpected incidents:
1. In Better Stack, navigate to **Status Pages -> Create Status Page**.
2. **Name:** `BazionWeb System Status`
3. **Custom Domain:** `status.bazionweb.com`
4. In Cloudflare DNS, add a `CNAME` for `status` pointing to `statuspage.betteruptime.com` (**Proxy: DNS Only / Grey Cloud**).
5. **Component Breakdown:**
   - **Customer Applications:** `Main Website (bazionweb.com)`, `Interactive Quote Builder`, `Client Portal`
   - **Core APIs & Services:** `REST API (api.bazionweb.com)`, `Keycloak Authentication`
   - **Integrations:** `Safaricom M-Pesa STK Push`, `Card Checkout (Paystack)`, `Transactional Email (Resend)`

---

## 3. Internal Infrastructure Monitoring (Uptime Kuma)

For self-hosted internal infrastructure monitoring without SaaS costs, Uptime Kuma can be deployed as an independent container service under Dokploy.

### 3.1 Dokploy Compose Service Reference
Example service configuration for Uptime Kuma under Dokploy:
```yaml
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: bazionweb-uptime
    restart: unless-stopped
    volumes:
      - uptime_kuma_data:/app/data
    networks:
      - bazionweb-internal
      - bazionweb-public
    expose:
      - "3001"
```

### 3.2 Nginx Reverse Proxy with Required WebSocket Support
Uptime Kuma uses Socket.io which strictly requires HTTP 1.1 upgrade headers. In `/etc/nginx/sites-available/status.bazionweb.com` (or Nginx Proxy Manager):
```nginx
server {
    listen 443 ssl http2;
    server_name status.bazionweb.com;

    ssl_certificate     /etc/letsencrypt/live/status.bazionweb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/status.bazionweb.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;

        # WebSocket support is strictly required for Uptime Kuma live dashboard
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";

        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        proxy_read_timeout    86400s;
        proxy_send_timeout    86400s;
    }
}
```

### 3.3 Adding Internal Probes in Uptime Kuma
Open `https://status.bazionweb.com` and log in:
1. Click **+ Add New Monitor**:
   - **Type:** `HTTP(s)` | **Name:** `Main Web Frontend` | **URL:** `https://bazionweb.com` | **Heartbeat:** `60s` | **Keyword:** `BazionWeb`
   - **Type:** `HTTP(s)` | **Name:** `Next.js Health API` | **URL:** `https://bazionweb.com/api/health` | **Heartbeat:** `30s` | **Keyword:** `"status":"ok"`
   - **Type:** `HTTP(s)` | **Name:** `REST API Health` | **URL:** `https://api.bazionweb.com/api/v1/health` | **Heartbeat:** `30s`
   - **Type:** `TCP Port` | **Name:** `Postgres Database` | **Hostname:** `db` | **Port:** `5432` | **Heartbeat:** `30s`
   - **Type:** `TCP Port` | **Name:** `Redis Cache` | **Hostname:** `redis` | **Port:** `6379` | **Heartbeat:** `30s`
2. **Notification Channels:** In **Settings -> Notifications**, configure Telegram, Discord/Slack webhooks, or Resend SMTP (`smtp.resend.com:587`).

---

## 4. Automated Production Backup Strategy (Restic + Backblaze B2)

BazionWeb implements the industry-standard **3-2-1 backup rule**:
- **3 copies** of data (Production database, local snapshot dump, off-site B2 bucket).
- **2 different storage media** (NVMe VPS storage + Backblaze Cloud Object Storage).
- **1 off-site copy** (Backblaze B2 S3 storage located in `us-west-004`).

### 4.1 Grandfather-Father-Son (GFS) Retention Policy
The backup automation enforces a strict retention pruning cycle:
- **7 Daily Snapshots:** Retained for Days 1 through 7.
- **4 Weekly Snapshots:** Retained for Weeks 1 through 4.
- **12 Monthly Snapshots:** Retained for Months 1 through 12.
- **2 Yearly Snapshots:** Retained for 2 years for accounting, audit, and tax compliance.

---

### 4.2 Automated Nightly Cron Job Setup
On the production VPS host:
1. Open the crontab editor:
   ```bash
   sudo crontab -e
   ```
2. Add the nightly execution at **02:00 EAT (23:00 UTC)**:
   ```cron
   0 23 * * * /opt/bazionweb/infrastructure/backups/restic-backup.sh >> /var/log/bazionweb-backup.log 2>&1
   ```

### 4.3 Production Backup Script Reference (`infrastructure/backups/restic-backup.sh`)
```bash
#!/bin/bash
set -euo pipefail

# 1. Environment & Credentials
export RESTIC_REPOSITORY="b2:${BACKBLAZE_BUCKET}:restic"
export RESTIC_PASSWORD="${RESTIC_PASSWORD}"
export B2_ACCOUNT_ID="${BACKBLAZE_KEY_ID}"
export B2_ACCOUNT_KEY="${BACKBLAZE_APP_KEY}"

DB_NAME="bazionweb"
DB_USER="bazionweb"
BACKUP_PATHS="/opt/bazionweb/infrastructure /opt/bazionweb/.env"
DUMP_FILE="/tmp/bazionweb_db_$(date +%Y%m%d_%H%M%S).sql"

echo "[$(date -u)] Starting atomic database dump..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h db -U "${DB_USER}" -d "${DB_NAME}" \
  --format=plain --no-password \
  > "${DUMP_FILE}"

echo "[$(date -u)] Encrypting and pushing snapshot to Backblaze B2 via Restic..."
restic backup \
  "${DUMP_FILE}" \
  ${BACKUP_PATHS} \
  --tag "daily" \
  --tag "bazionweb" \
  --compression max

rm -f "${DUMP_FILE}"

echo "[$(date -u)] Pruning expired snapshots according to GFS retention..."
restic forget \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 12 \
  --keep-yearly 2 \
  --prune

# Sunday Automated Cryptographic Integrity Audit:
if [[ "$(date +%u)" == "7" ]]; then
  echo "[$(date -u)] Performing Sunday cryptographic repository check..."
  restic check --read-data-subset=10%
fi

echo "[$(date -u)] Backup routine completed successfully!"
```

---

## 5. Disaster Recovery Runbook & Restoration Protocol

In the event of a catastrophic server hardware failure, database corruption, or ransomware incident:
- **Target RTO:** < 2 Hours
- **Target RPO:** < 24 Hours

```
[OUTAGE DETECTED]
       │
       ▼
[Step 1: Declare Incident & Update status.bazionweb.com]
       │
       ▼
[Step 2: Stop Ingestion] ──► docker compose stop api web
       │
       ▼
[Step 3: List & Fetch Snapshot] ──► restic restore latest --target /tmp/restore
       │
       ▼
[Step 4: Recreate Clean Database] ──► DROP DATABASE; CREATE DATABASE;
       │
       ▼
[Step 5: SQL Import] ──► psql bazionweb < /tmp/restore/tmp/*.sql
       │
       ▼
[Step 6: Schema Migration] ──► npx prisma migrate deploy
       │
       ▼
[Step 7: Stack Restart & Health Verification] ──► curl -f /api/health
       │
       ▼
[Step 8: Close Incident on Status Page]
```

### Detailed Command-by-Command Recovery Runbook:

#### Step 1: Declare Incident & Update Status Page
1. Log in to [betterstack.com](https://betterstack.com) or Uptime Kuma.
2. Publish incident on `status.bazionweb.com`:
   - **Title:** `Major Outage: Emergency Database Restoration Underway`
   - **Description:** `Our DevOps team is currently restoring production services from automated off-site snapshots. We anticipate full recovery within 60 minutes.`

#### Step 2: Stop Inbound Traffic & Ingestion
Prevents partial writes while restoration is in progress:
```bash
cd /opt/bazionweb
docker compose -f docker-compose.dokploy.yml stop api web
```

#### Step 3: List and Fetch Latest Healthy Snapshot from Backblaze B2
```bash
export RESTIC_REPOSITORY="b2:bazionweb-backups:restic"
export RESTIC_PASSWORD="<RESTIC_MASTER_PASSWORD>"
export B2_ACCOUNT_ID="<BACKBLAZE_KEY_ID>"
export B2_ACCOUNT_KEY="<BACKBLAZE_APP_KEY>"

# List all available snapshots:
restic snapshots

# Restore latest snapshot to temporary directory:
RESTORE_DIR="/tmp/restic_restore_$(date +%s)"
mkdir -p "${RESTORE_DIR}"
restic restore latest --target "${RESTORE_DIR}"
```

#### Step 4: Import Restored SQL Dump into Neon Database
BazionWeb operates on Neon Serverless PostgreSQL.
```bash
RESTORE_SQL=$(ls "${RESTORE_DIR}"/tmp/*.sql | head -n 1)

# Import into Neon using direct unpooled connection string:
psql "${DATABASE_URL_UNPOOLED}" < "${RESTORE_SQL}"
```

#### Step 5: Deploy Database Schema Migrations
```bash
DATABASE_URL="${DATABASE_URL}" npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

#### Step 6: Restart Application Stack & Verify
```bash
docker compose -f docker-compose.dokploy.yml start api web

# Verify health smoke tests:
curl -f https://bazionweb.com/api/health
curl -f https://bazionweb.com/api/v1/health
```

#### Step 8: Clean Up & Close Incident
```bash
rm -rf "${RESTORE_DIR}"
```
Update `status.bazionweb.com` to "All Systems Operational".
