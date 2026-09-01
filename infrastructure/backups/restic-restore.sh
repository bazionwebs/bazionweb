#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Restic Restore Script
# Usage: ./restic-restore.sh [snapshot-id]
#   snapshot-id: optional, defaults to "latest"
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

export RESTIC_REPOSITORY="b2:${BACKBLAZE_BUCKET}:restic"
export RESTIC_PASSWORD="${RESTIC_PASSWORD:?RESTIC_PASSWORD not set}"
export B2_ACCOUNT_ID="${BACKBLAZE_KEY_ID:?BACKBLAZE_KEY_ID not set}"
export B2_ACCOUNT_KEY="${BACKBLAZE_APP_KEY:?BACKBLAZE_APP_KEY not set}"

SNAPSHOT="${1:-latest}"
RESTORE_DIR="/tmp/restic_restore_$(date +%Y%m%d_%H%M%S)"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# ── List available snapshots ──────────────────────────────────────────────────
if [[ "${SNAPSHOT}" == "list" ]]; then
  restic snapshots
  exit 0
fi

# ── Restore ───────────────────────────────────────────────────────────────────
log "Restoring snapshot: ${SNAPSHOT} to ${RESTORE_DIR}"
mkdir -p "${RESTORE_DIR}"

restic restore "${SNAPSHOT}" --target "${RESTORE_DIR}"

log "Restore complete. Files at: ${RESTORE_DIR}"
log ""
log "To restore the database:"
log "  1. Find the SQL dump: ls ${RESTORE_DIR}/tmp/"
log "  2. docker compose exec db psql -U bazionweb -c 'DROP DATABASE bazionweb; CREATE DATABASE bazionweb;'"
log "  3. docker compose exec -T db psql -U bazionweb bazionweb < <dump_file>"
log "  4. docker compose run --rm api npx prisma migrate deploy"
log ""
log "Full restore procedure: docs/runbooks/restore-db-backup.md"
