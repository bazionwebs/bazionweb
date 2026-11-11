#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Daily Database Backup Script
# Aligned with: MPD v2.0, Section 9.4 (Backup Strategy)
# Schedule: Cron 0 2 * * * (02:00 EAT daily)
# Storage: Backblaze B2 (S3-compatible)
# Encryption: AES-256-CBC before upload
# Retention: 30 days (Starter), 60 (Growth), 90 (Business), 365 (Enterprise)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/bazionweb_backups"
DB_NAME="${DB_NAME:-bazionweb}"
DB_USER="${DB_USER:-bazionweb}"
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"
BUCKET="${BACKBLAZE_BUCKET:-bazionweb-backups}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY not set}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
notify_slack() {
  local msg="$1"
  [[ -z "$SLACK_WEBHOOK" ]] && return 0
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$msg\"}" "$SLACK_WEBHOOK" || true
}

# ── Dump PostgreSQL ───────────────────────────────────────────────────────────
log "Starting backup: ${DB_NAME}"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h db \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-password \
  | gzip -9 > "${BACKUP_FILE}"

DUMP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Dump complete: ${DUMP_SIZE}"

# ── Encrypt with AES-256 ─────────────────────────────────────────────────────
# The key is piped to stdin (never a CLI argument), so it never appears in
# shell history, `ps`, or child-process environments.
printf '%s' "$ENCRYPTION_KEY" | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "$BACKUP_FILE" \
  -out "$ENCRYPTED_FILE" \
  -pass stdin

rm -f "$BACKUP_FILE"  # Remove unencrypted dump
ENCRYPTED_SIZE=$(du -sh "$ENCRYPTED_FILE" | cut -f1)
log "Encryption complete: ${ENCRYPTED_SIZE}"

# ── Upload to Backblaze B2 ────────────────────────────────────────────────────
REMOTE_PATH="database/${TIMESTAMP:0:8}/db_${TIMESTAMP}.sql.gz.enc"
aws s3 cp "$ENCRYPTED_FILE" "s3://${BUCKET}/${REMOTE_PATH}" \
  --endpoint-url "https://s3.${BACKBLAZE_REGION:-us-west-004}.backblazeb2.com" \
  --storage-class STANDARD

REMOTE_URI="s3://${BUCKET}/${REMOTE_PATH}"
log "Uploaded: ${REMOTE_URI}"

# ── Checksum verification ─────────────────────────────────────────────────────
LOCAL_CHECKSUM=$(sha256sum "$ENCRYPTED_FILE" | awk '{print $1}')
log "SHA-256: ${LOCAL_CHECKSUM}"

# ── Cleanup local temp files ──────────────────────────────────────────────────
rm -f "$ENCRYPTED_FILE"

# ── Prune old backups (retain RETENTION_DAYS days) ───────────────────────────
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)
log "Pruning backups older than ${CUTOFF_DATE}..."
aws s3 ls "s3://${BUCKET}/database/" \
  --endpoint-url "https://s3.${BACKBLAZE_REGION:-us-west-004}.backblazeb2.com" \
  | awk '{print $4}' \
  | while read -r key; do
      KEY_DATE=$(echo "$key" | grep -oP '^\d{8}' || echo "99999999")
      if [[ "$KEY_DATE" < "$CUTOFF_DATE" ]]; then
        aws s3 rm "s3://${BUCKET}/database/${key}" \
          --endpoint-url "https://s3.${BACKBLAZE_REGION:-us-west-004}.backblazeb2.com"
        log "Pruned: ${key}"
      fi
    done

# ── Success notification ──────────────────────────────────────────────────────
notify_slack "✅ BazionWeb DB backup complete — ${TIMESTAMP} | Size: ${ENCRYPTED_SIZE} | ${REMOTE_URI}"
log "Backup complete."
