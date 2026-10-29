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
docker compose -f infrastructure/docker/docker-compose.yml ps

# If any service is "exited" — check its logs
docker compose -f infrastructure/docker/docker-compose.yml logs --tail=100 web
docker compose -f infrastructure/docker/docker-compose.yml logs --tail=100 api
docker compose -f infrastructure/docker/docker-compose.yml logs --tail=100 db
docker compose -f infrastructure/docker/docker-compose.yml logs --tail=100 nginx-proxy-manager
```

---

## 4. Common scenarios and fixes

### Scenario A: Web container crashed (OOM or unhandled error)

```bash
# Restart the web container
docker compose -f infrastructure/docker/docker-compose.yml restart web

# Verify health
docker compose -f infrastructure/docker/docker-compose.yml ps web
curl -f http://localhost:3000/api/health
```

### Scenario B: API container crashed

```bash
docker compose -f infrastructure/docker/docker-compose.yml restart api

# Wait for health check
sleep 30
curl -f http://localhost:4000/api/v1/health
```

### Scenario C: Database down

```bash
# Check disk space first — #1 cause of Postgres crashes
df -h

# If disk is full:
docker system prune -f   # Remove unused images/containers
journalctl --vacuum-size=500M

# Restart postgres
docker compose -f infrastructure/docker/docker-compose.yml restart db

# Verify connectivity
docker compose -f infrastructure/docker/docker-compose.yml exec db pg_isready -U bazionweb
```

### Scenario D: Nginx/NPM not routing

```bash
# Check NPM container
docker compose -f infrastructure/docker/docker-compose.yml logs nginx-proxy-manager | tail -50

# Restart NPM
docker compose -f infrastructure/docker/docker-compose.yml restart nginx-proxy-manager

# Check if port 80/443 is listening
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

# Trigger Let's Encrypt renewal (via NPM)
docker compose -f infrastructure/docker/docker-compose.yml exec nginx-proxy-manager \
  /bin/bash -c "certbot renew --force-renewal"
```

---

## 5. Rollback (if recent deploy caused the issue)

```bash
# Get previous image tag from Docker Hub
docker images | grep bazionweb-web

# Roll back to previous image
export IMAGE_TAG=<previous-sha>
docker compose -f infrastructure/docker/docker-compose.yml up -d --no-deps web api
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
