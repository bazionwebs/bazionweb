# Runbook: Disaster Recovery — Database Restore

**Owner:** Senior Engineer  
**Last Updated:** June 2025  
**RPO:** 24 hours (daily backups)  
**RTO:** 2 hours (target)

---

## When to use this runbook

- Database server is unrecoverable (disk failure, accidental deletion)
- Restore requested after data corruption event
- DR drill (run quarterly)

---

## 1. Verify backup availability

```bash
# List recent backups in Backblaze B2
aws s3 ls s3://bazionweb-backups/database/ \
  --endpoint-url https://s3.us-west-004.backblazeb2.com \
  --recursive \
  | sort | tail -10
```

---

## 2. Download the backup

```bash
BACKUP_KEY="database/20250601/db_20250601_020005.sql.gz.enc"
aws s3 cp "s3://bazionweb-backups/${BACKUP_KEY}" /tmp/restore.sql.gz.enc \
  --endpoint-url https://s3.us-west-004.backblazeb2.com
```

---

## 3. Decrypt the backup

```bash
# BACKUP_ENCRYPTION_KEY must be retrieved from the secret manager
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in  /tmp/restore.sql.gz.enc \
  -out /tmp/restore.sql.gz \
  -k "${BACKUP_ENCRYPTION_KEY}"
```

---

## 4. Restore to PostgreSQL

```bash
# Stop the API to prevent writes during restore
docker compose -f infrastructure/docker/docker-compose.yml stop api

# Decompress
gunzip -c /tmp/restore.sql.gz > /tmp/restore.sql

# Drop and recreate database
docker compose -f infrastructure/docker/docker-compose.yml exec db psql \
  -U bazionweb -c "DROP DATABASE IF EXISTS bazionweb; CREATE DATABASE bazionweb;"

# Restore
docker compose -f infrastructure/docker/docker-compose.yml exec -T db psql \
  -U bazionweb bazionweb < /tmp/restore.sql

# Run any pending migrations
docker compose -f infrastructure/docker/docker-compose.yml run --rm api \
  npx prisma migrate deploy
```

---

## 5. Verify and restart

```bash
# Verify row counts
docker compose -f infrastructure/docker/docker-compose.yml exec db psql -U bazionweb bazionweb \
  -c "SELECT 'users' AS tbl, COUNT(*) FROM users UNION ALL SELECT 'clients', COUNT(*) FROM clients UNION ALL SELECT 'tickets', COUNT(*) FROM tickets;"

# Restart API
docker compose -f infrastructure/docker/docker-compose.yml start api

# Verify API health
curl -f https://www.bazionwebs.com/api/v1/health

# Clean up
rm -f /tmp/restore.sql.gz.enc /tmp/restore.sql.gz /tmp/restore.sql
```

---

## 6. Post-restore steps

1. Notify affected clients of the data recovery window
2. Review audit logs to identify any transactions in the gap period
3. File incident report within 48 hours
4. Update DR test log with results and timing
