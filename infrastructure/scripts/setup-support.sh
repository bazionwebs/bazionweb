#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Support Portal (Zammad) Setup Script
# Run this on the VPS (Oracle Cloud / Hetzner) as a user with Docker access.
#
# What it does:
#   1. Pre-flight checks (Docker, DNS for support.bazionweb.com)
#   2. Starts the Zammad stack (9 containers, see docker-compose.yml)
#   3. Waits for the app to become healthy
#   4. Prints the Cloudflare DNS record + Nginx Proxy Manager proxy host steps
#
# First boot is slow: zammad-init creates the `zammad_production` database and
# runs migrations, Elasticsearch builds the initial index. Allow 5–10 minutes.
#
# Usage:
#   chmod +x setup-support.sh
#   ./setup-support.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/../docker/docker-compose.yml"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 1. Pre-flight checks ──────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker not found. Install Docker first."
command -v docker compose >/dev/null 2>&1 || error "Docker Compose not found."

# Elasticsearch needs a generous vm.max_map_count — same requirement as
# Elasticsearch's own docs. Idempotent, may require a root shell.
if [[ "$(cat /proc/sys/vm/max_map_count)" -lt 262144 ]]; then
    warn "vm.max_map_count is $(cat /proc/sys/vm/max_map_count) — Elasticsearch needs >= 262144."
    warn "Run this once (persist across reboots via /etc/sysctl.d):"
    warn "  sudo sysctl -w vm.max_map_count=262144"
    warn "  echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/99-elasticsearch.conf"
    echo ""
    read -p "Continue anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

info "Checking DNS resolution for support.bazionweb.com..."
if ! host support.bazionweb.com >/dev/null 2>&1; then
    warn "DNS for support.bazionweb.com not yet resolving (this is why the site shows NXDOMAIN)."
    warn "Add an A record in Cloudflare pointing 'support' → this VPS IP after setup."
    warn "Your VPS public IP is: $(curl -s ifconfig.me)"
    echo ""
    read -p "Continue anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

# ── 2. Start the Zammad stack ─────────────────────────────────────────────────
info "Starting Zammad stack..."
docker compose -f "$COMPOSE_FILE" up -d \
    zammad-elasticsearch zammad-memcached zammad-redis \
    zammad-init zammad-railsserver zammad-websocket zammad-scheduler \
    zammad-nginx zammad-backup

info "Waiting for Zammad to become healthy (first boot: 5–10 min)..."
timeout 600 bash -c 'until docker inspect --format="{{.State.Health.Status}}" bazionweb-support-rails 2>/dev/null | grep -q "healthy"; do sleep 5; done' \
    && info "Zammad is healthy ✓" \
    || error "Zammad did not become healthy within 10 minutes. Check: docker compose logs zammad-init zammad-railsserver"

# ── 3. Summary / manual steps ────────────────────────────────────────────────
VPS_IP=$(curl -s ifconfig.me)
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BazionWeb Support Portal (Zammad) Setup Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  ─── Cloudflare DNS — add this record ───────────────────────"
echo "  Type: A   Name: support   Content: ${VPS_IP}   Proxy: ON"
echo ""
echo "  ─── Nginx Proxy Manager — add one Proxy Host ──────────────"
echo "  Domain:       support.bazionweb.com"
echo "  Forward to:   zammad-nginx  port 8080"
echo "  WebSockets:   ✅ ENABLED (required for live ticket updates)"
echo "  SSL:          Let's Encrypt (Force HTTPS + HSTS)"
echo ""
echo "  ─── First run (after DNS + SSL propagate) ──────────────────"
echo "  1. Open https://support.bazionweb.com"
echo "  2. Create the admin account (first signup becomes admin)"
echo "     NOTE: first signup is open — do this immediately"
echo "  3. Admin → Email → connect SMTP/IMAP so tickets can"
echo "     flow between support@bazionweb.com and the ticket queue"
echo ""
echo "  ─── Uptime Kuma monitor to add ─────────────────────────────"
echo "  Support:      https://support.bazionweb.com        (HTTP, 60s)"
echo "════════════════════════════════════════════════════════════════"
