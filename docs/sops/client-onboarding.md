# SOP: Client Onboarding

**Owner:** Account Manager / Lead Engineer  
**Target duration:** 3 business days from contract signing to "fully live"  
**Applies to:** All new clients regardless of plan

---

## Day 0 — Contract signed

- [ ] Create client account in admin portal (Admin → Clients → Add Client)
  - Business name, contact name, email, phone, plan tier
  - Status: `TRIAL` initially
- [ ] Send welcome email (template: `emails/welcome-new-client.md`)
- [ ] Create onboarding Zammad ticket assigned to Account Manager
- [ ] Request credentials/access from client:
  - Current hosting provider login
  - Domain registrar login (or DNS delegation)
  - CMS admin credentials
  - Google Search Console / Analytics access (view)

---

## Day 1 — Technical assessment

### DNS and hosting audit

```bash
# Check current DNS setup
dig <client-domain> +short
whois <client-domain> | grep "Registrar\|Name Server"

# Check current server / hosting provider
curl -I https://<client-domain> | grep "Server\|X-Powered-By"

# Test SSL
echo | openssl s_client -connect <client-domain>:443 -servername <client-domain> 2>/dev/null \
  | openssl x509 -noout -dates -subject

# Lighthouse baseline score
lighthouse https://<client-domain> --output=json \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['categories']; [print(f'{k}: {v[\"score\"]*100:.0f}') for k,v in d.items()]"
```

### Document findings

Create `clients/<client-id>/assessment.md` with:
- Current hosting provider and plan
- DNS provider and TTL settings
- CMS version and plugins installed
- Baseline Lighthouse scores (before/after comparison later)
- Known issues discovered

---

## Day 2 — Infrastructure provisioning

### Create hosting account

```bash
# Add to admin portal: Hosting → Create Account
# Fields: domain, server assignment, plan

# Provision server (Hetzner/Oracle)
# → Follow infrastructure/runbooks/provision-server.md

# Configure Nginx vhost
cp infrastructure/nginx/vhost-template.conf /etc/nginx/sites-available/<client-domain>.conf
# Edit: server_name, SSL paths, upstream proxy
nginx -t && systemctl reload nginx
```

### SSL setup

```bash
# Obtain Let's Encrypt certificate
certbot certonly --nginx -d <client-domain> -d www.<client-domain>

# Verify auto-renewal
certbot renew --dry-run
```

### Cloudflare setup

1. Add domain to Cloudflare account
2. Set DNS records (A, CNAME, MX)
3. Enable proxy (orange cloud) on main records
4. Set SSL/TLS mode to **Full (Strict)**
5. Enable **Auto Minify** (HTML, CSS, JS)
6. Create **Page Rules** for cache control
7. Enable **Firewall Rules** for basic WAF

### Backup configuration

```bash
# Add client domain to backup cron
echo "0 2 * * * /opt/bazionweb/infrastructure/backups/daily-db-backup.sh >> /var/log/backups/<client-domain>.log 2>&1" \
  | crontab -l -u deploy | sort -u | crontab -u deploy -
```

### Uptime Kuma monitor

1. Login to Uptime Kuma at `status.bazionweb.com/admin`
2. Add HTTP(s) monitor for `https://<client-domain>`
3. Check interval: 60 seconds
4. Set notification to on-call Slack + client email

---

## Day 3 — Migration and go-live

### Migration (if applicable)

```bash
# Download from old host
rsync -avz --progress <old-host>:/var/www/<client-domain>/ /var/www/<client-domain>/

# Database dump from old host
ssh <old-host> "mysqldump -u root -p <db-name> | gzip" > /tmp/<client-domain>-migration.sql.gz
# Restore to new PostgreSQL / MySQL instance
```

### DNS cutover

1. Lower TTL to 300s at least 24h before cutover
2. Update A record to new server IP
3. Monitor propagation: `watch -n 30 'dig <client-domain> +short'`
4. Verify SSL works after propagation
5. Run smoke tests (homepage, contact form, CMS login)

### Go-live checklist

- [ ] Site loads correctly on new server
- [ ] SSL green, no mixed content warnings
- [ ] Contact form sends email (check MailHog logs in staging, SMTP logs in production)
- [ ] Google Search Console verified
- [ ] Uptime Kuma showing "Up"
- [ ] First backup triggered and verified
- [ ] Client portal account activated (status → `ACTIVE`)
- [ ] Client notified of go-live

---

## Post-onboarding (Day 5–7)

- [ ] Send "You're live!" email with portal login instructions
- [ ] Schedule 30-day check-in call
- [ ] Confirm first monthly report date
- [ ] Add to monthly maintenance schedule

---

## Notes

**Common blockers:**
- Client can't find domain registrar login → help them recover via email
- Old hosting provider doesn't allow SSH access → download via FTP/cPanel
- DNS TTL is 24h → plan migration at least 2 days in advance
- Client email forwarders → test carefully before cutover, SMTP config must be updated
