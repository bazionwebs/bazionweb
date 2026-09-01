#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Restic Backup Script
# Aligned with: MPD v2.0, Section 9.4 (Backup Strategy — Restic)
#
# Restic advantages over raw aws s3 cp:
#   ✓ Content-addressable deduplication (only changed blocks uploaded)
#   ✓ AES-256 encryption built-in (no external openssl step)
#   ✓ Snapshot management with retention policies
#   ✓ Pruning and integrity verification built-in
#   ✓ Append-only mode for ransomware protection
#
# Schedule:
#   Daily incremental:   0 2 * * *   (02:00 EAT)
#   Weekly verification: 0 4 * * 0   (Sunday 04:00 EAT)
#
# Storage: Backblaze B2 via Restic native B2 backend
# Encryption: AES-256 via Restic (key in RESTIC_PASSWORD env var)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
export RESTIC_REPOSITORY="b2:${BACKBLAZE_BUCKET}:restic"
export RESTIC_PASSWORD="${RESTIC_PASSWORD:?RESTIC_PASSWORD not set}"
export B2_ACCOUNT_ID="${BACKBLAZE_KEY_ID:?BACKBLAZE_KEY_ID not set}"
export B2_ACCOUNT_KEY="${BACKBLAZE_APP_KEY:?BACKBLAZE_APP_KEY not set}"

DB_NAME="${DB_NAME:-bazionweb}"
DB_USER="${DB_USER:-bazionweb}"
BACKUP_PATHS="/opt/bazionweb/infrastructure /opt/bazionweb/.env"
DUMP_FILE="/tmp/bazionweb_db_$(date +%Y%m%d_%H%M%S).sql"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# Retention policy (aligned with MPD plan tiers — worst case = 365 days)
KEEP_DAILY=7
KEEP_WEEKLY=8
KEEP_MONTHLY=12
KEEP_YEARLY=2

log()  { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
notify() {
  local msg="$1"
  [[ -z "$SLACK_WEBHOOK" ]] && return 0
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$msg\"}" "$SLACK_WEBHOOK" || true
}

# ── Initialize repository (idempotent) ────────────────────────────────────────
if ! restic snapshots &>/dev/null 2>&1; then
  log "Initializing Restic repository..."
  restic init
  log "Repository initialized."
fi

# ── PostgreSQL dump ───────────────────────────────────────────────────────────
log "Dumping PostgreSQL database: ${DB_NAME}"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h db -U "${DB_USER}" -d "${DB_NAME}" \
  --format=plain --no-password \
  > "${DUMP_FILE}"

log "Dump size: $(du -sh "${DUMP_FILE}" | cut -f1)"

# ── Backup via Restic ─────────────────────────────────────────────────────────
log "Starting Restic backup..."
restic backup \
  "${DUMP_FILE}" \
  ${BACKUP_PATHS} \
  --tag "daily" \
  --tag "bazionweb" \
  --exclude "*.log" \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude "*.tmp" \
  --compression max

SNAPSHOT_ID=$(restic snapshots --json --last --tag daily | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['short_id'] if d else 'unknown')")
log "Backup complete. Snapshot: ${SNAPSHOT_ID}"

# ── Clean up dump file ────────────────────────────────────────────────────────
rm -f "${DUMP_FILE}"

# ── Apply retention policy ───────────────────────────────────────────────────
log "Applying retention policy..."
restic forget \
  --keep-daily   "${KEEP_DAILY}" \
  --keep-weekly  "${KEEP_WEEKLY}" \
  --keep-monthly "${KEEP_MONTHLY}" \
  --keep-yearly  "${KEEP_YEARLY}" \
  --prune

log "Retention policy applied."

# ── Integrity check (weekly — run on Sundays) ─────────────────────────────────
if [[ "$(date +%u)" == "7" ]]; then
  log "Sunday — running full integrity check (restic check)..."
  if restic check --read-data-subset=10%; then
    log "Integrity check passed."
    notify "✅ BazionWeb weekly backup integrity check PASSED — snapshot ${SNAPSHOT_ID}"
  else
    log "ERROR: Integrity check FAILED!"
    notify "🚨 BazionWeb backup integrity check FAILED — immediate investigation required"
    exit 1
  fi
fi

# ── Success notification ──────────────────────────────────────────────────────
STATS=$(restic stats --json 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(f\"{d.get('total_file_count','?')} files, {d.get('total_size',0)//1024//1024}MB total\")
except:
  print('stats unavailable')
" 2>/dev/null || echo "stats unavailable")

notify "✅ BazionWeb daily backup complete | Snapshot: ${SNAPSHOT_ID} | Repo: ${STATS}"
log "Backup script complete."
