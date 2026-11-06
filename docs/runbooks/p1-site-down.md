# Runbook: P1 — Site Down

**Severity:** P1 — Critical  
**Owner:** On-call Engineer  
**Last Updated:** June 2025  
**SLA:** Acknowledgement within 5–60 min (plan-dependent) · Resolution target: 4 hours

---

## 1. Immediate triage (first 5 minutes)

### Confirm the outage is real

```bash
# From your machine — check if DNS resolves
dig bazionweb.com +short

# Check HTTP response
curl -I --max-time 10 https://bazionweb.com

# Check Uptime Kuma status
open https://status.bazionweb.com
```

### Identify the scope
- Is it **one site** or **all sites**?
- Is it **DNS** (dig returns nothing), **server** (connection refused/timeout), or **application** (HTTP 5xx)?
- Is it affecting the **API** (`https://bazionweb.com/api/v1/health`) or just the **web app**?

---

## 2. SSH into the VPS

```bash
ssh deploy@<VPS_IP> -i ~/.ssh/bazionweb_prod
```

---

## 3. Check container status

```bash
cd /opt/bazionweb
# In Dokploy, the stack is managed via docker-compose.dokploy.yml
docker compose -f docker-compose.dokploy.yml ps

# If any service is "exited" — check its logs
docker compose -f docker-compose.dokploy.yml logs --tail=100 web
docker compose -f docker-compose.dokploy.yml logs --tail=100 api
docker compose -f docker-compose.dokploy.yml logs --tail=100 redis
# Inspect Traefik edge reverse proxy logs in Dokploy
docker logs --tail=100 dokploy-traefik
```

---

## 4. Common scenarios and fixes

### Scenario A: Web container crashed (OOM or unhandled error)

```bash
# Restart the web container
docker compose -f docker-compose.dokploy.yml restart web

# Verify health
docker compose -f docker-compose.dokploy.yml ps web
curl -f http://localhost:3000/api/health
```

### Scenario B: API container crashed

```bash
docker compose -f docker-compose.dokploy.yml restart api

# Wait for health check
sleep 30
curl -f http://localhost:4000/api/v1/health
```

### Scenario C: Database connectivity issue (Neon PostgreSQL)

```bash
# BazionWeb uses external managed Neon Serverless PostgreSQL.
# 1. Verify API database connection logs:
docker compose -f docker-compose.dokploy.yml logs --tail=100 api | grep -i -E "prisma|database|p1001|timeout"

# 2. Check Neon console status (https://console.neon.tech)
# 3. Test connectivity directly using psql or prisma with the Neon pooled connection string:
DATABASE_URL="<NEON_DATABASE_URL>" psql "$DATABASE_URL" -c "SELECT 1;"
```

### Scenario D: Dokploy / Traefik routing issues

```bash
# Check Traefik container status and routing logs
docker logs --tail=50 dokploy-traefik

# Restart Dokploy Traefik proxy if routing rules failed to register
docker restart dokploy-traefik

# Check if ports 80/443 are listening
ss -tlnp | grep -E '80|443'
```

### Scenario E: Cloudflare issue

```bash
# Bypass Cloudflare and hit origin directly
curl -H "Host: bazionweb.com" http://<VPS_IP>/

# If origin responds: Cloudflare issue
# Check https://www.cloudflarestatus.com/
# Temporarily pause Cloudflare proxy via CF dashboard if needed
```

### Scenario F: SSL certificate expired

```bash
# Check SSL expiry
echo | openssl s_client -connect bazionweb.com:443 -servername bazionweb.com 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## 5. Rollback (if recent deploy caused the issue)

```bash
# Get previous image tag from GHCR
docker images | grep bazionweb-web

# Roll back to previous image
export IMAGE_TAG=<previous-sha>
docker compose -f docker-compose.dokploy.yml up -d --no-deps web api
```

---

## 6. Escalation

| Time from alert | Action |
|-----------------|--------|
| 0–5 min  | On-call engineer acknowledges, starts triage |
| 15 min   | If unresolved: escalate to Lead Engineer |
| 30 min   | If unresolved: escalate to Founder |
| 60 min   | Client notified via email with status update |
| 4 hours  | Full incident report drafted |

---

## 7. Post-incident (within 48 hours)

1. Write Root Cause Analysis (RCA) using the template in `docs/runbooks/rca-template.md`
2. Update monitoring/alerting if the issue was silent before detection
3. Add a check to the post-deploy smoke tests to catch similar issues
4. Deliver RCA to affected clients via email

---

## Related runbooks
- [Database backup restore](./restore-db-backup.md)
- [Rollback deploy](./rollback-deploy.md)
- [SSL emergency renewal](./ssl-emergency.md)
- [DDoS response](./ddos-response.md)
