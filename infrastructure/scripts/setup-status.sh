#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Status Page Setup Script
# Run this on the VPS (Oracle Cloud / Hetzner) as a user with Docker access.
#
# What it does:
#   1. Ensures Uptime Kuma container is running
#   2. Issues Let's Encrypt SSL certs for status.bazionweb.com and monitoring.bazionweb.com
#   3. Reloads Nginx Proxy Manager to pick up the new config
#   4. Prints the first-run URL so you can complete Uptime Kuma setup
#
# Usage:
#   chmod +x setup-status.sh
#   ./setup-status.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
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

info "Checking DNS resolution for status.bazionweb.com..."
if ! host status.bazionweb.com >/dev/null 2>&1; then
    warn "DNS for status.bazionweb.com not yet resolving."
    warn "Add an A record in Cloudflare pointing 'status' → this VPS IP before continuing."
    warn "Your VPS public IP is: $(curl -s ifconfig.me)"
    echo ""
    read -p "Continue anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

# ── 2. Start / restart Uptime Kuma ───────────────────────────────────────────
info "Starting uptime-kuma container..."
docker compose -f "$COMPOSE_FILE" up -d uptime-kuma

info "Waiting for Uptime Kuma to be healthy..."
timeout 60 bash -c 'until docker inspect --format="{{.State.Health.Status}}" bazionweb-uptime 2>/dev/null | grep -q "healthy"; do sleep 3; done' \
    && info "Uptime Kuma is healthy ✓" \
    || warn "Uptime Kuma health check timed out — it may still be starting up."

# ── 3. SSL certificates via Certbot (if not using NPM's built-in) ─────────────
# If you are using Nginx Proxy Manager (NPM) UI, skip this section and
# use the NPM dashboard at http://<VPS-IP>:81 to add the proxy hosts with
# Let's Encrypt SSL enabled.
#
# Only run this if you are using raw Nginx (not NPM):
#
# info "Issuing SSL certificate for status.bazionweb.com..."
# docker run --rm \
#   -v /etc/letsencrypt:/etc/letsencrypt \
#   -v /var/lib/letsencrypt:/var/lib/letsencrypt \
#   -p 80:80 \
#   certbot/certbot certonly \
#     --standalone \
#     --non-interactive \
#     --agree-tos \
#     --email admin@bazionweb.com \
#     -d status.bazionweb.com \
#     -d monitoring.bazionweb.com

# ── 4. Reload Nginx Proxy Manager ────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q "bazionweb-npm"; then
    info "Reloading Nginx Proxy Manager..."
    docker exec bazionweb-npm nginx -s reload 2>/dev/null || \
        warn "Could not reload NPM — restart it manually or via the NPM UI."
else
    warn "Nginx Proxy Manager not running. Start the full stack first:"
    warn "  docker compose -f $COMPOSE_FILE up -d"
fi

# ── 5. Summary ────────────────────────────────────────────────────────────────
VPS_IP=$(curl -s ifconfig.me)
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BazionWeb Status Page Setup Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Uptime Kuma UI:     http://${VPS_IP}:3001  (direct, no SSL)"
echo "  Status Page URL:    https://status.bazionweb.com  (after DNS+SSL)"
echo "  NPM Admin UI:       http://${VPS_IP}:81"
echo ""
echo "  ─── Cloudflare DNS — add these records ─────────────────────"
echo "  Type: A   Name: status       Content: ${VPS_IP}   Proxy: ON"
echo "  Type: A   Name: monitoring   Content: ${VPS_IP}   Proxy: ON"
echo ""
echo "  ─── Nginx Proxy Manager — add two Proxy Hosts ──────────────"
echo "  Domain:       status.bazionweb.com"
echo "  Forward to:   uptime-kuma  port 3001"
echo "  WebSockets:   ✅ ENABLED"
echo "  SSL:          Let's Encrypt (Force HTTPS + HSTS)"
echo ""
echo "  Domain:       monitoring.bazionweb.com"
echo "  Forward to:   grafana  port 3000"
echo "  WebSockets:   ✅ ENABLED"
echo "  SSL:          Let's Encrypt (Force HTTPS + HSTS)"
echo ""
echo "  ─── Uptime Kuma first-run monitors to add ───────────────────"
echo "  Main site:    https://bazionweb.com                (HTTP, 60s)"
echo "  API health:   https://api.bazionweb.com/api/v1/health (HTTP, 60s)"
echo "  Auth:         https://auth.bazionweb.com/health/ready (HTTP, 60s)"
echo "  Status self:  https://status.bazionweb.com         (HTTP, 60s)"
echo "  DB:           db:5432                              (TCP, 60s)"
echo "  Redis:        redis:6379                           (TCP, 60s)"
echo "════════════════════════════════════════════════════════════════"
