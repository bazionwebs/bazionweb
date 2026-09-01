# SOP: Monthly Website Maintenance

**Owner:** Support Engineer  
**Frequency:** Monthly, by the 5th of each month  
**Applies to:** All active clients on Growth, Business, Enterprise plans  
**Tools required:** Client portal admin, staging server SSH access, CMS credentials

---

## Pre-task checklist

- [ ] Confirm staging environment is accessible for the client
- [ ] Verify last backup completed successfully (check Uptime Kuma + DB backup logs)
- [ ] Open the client's monthly maintenance ticket in Zammad
- [ ] Note: never apply updates directly to production — staging first, always

---

## Step 1 — CMS and plugin updates (30 min)

```bash
# SSH into staging
ssh deploy@staging.<client-domain> -i ~/.ssh/bazionweb_prod

# WordPress: update core + plugins
cd /var/www/staging.<client-domain>
wp core update --allow-root
wp plugin update --all --allow-root
wp theme update --all --allow-root

# Verify site still loads
curl -I http://staging.<client-domain>
```

**Check after update:**
- [ ] Homepage loads (no fatal errors)
- [ ] Admin dashboard accessible
- [ ] Contact form submits successfully (test with real submission)
- [ ] All navigation links work
- [ ] Mobile render looks correct (BrowserStack or Chrome DevTools)

If staging passes → deploy to production. If not → revert and investigate.

```bash
# Apply to production after staging passes
ssh deploy@<client-domain> -i ~/.ssh/bazionweb_prod
cd /var/www/<client-domain>
wp core update --allow-root
wp plugin update --all --allow-root
wp theme update --all --allow-root
```

---

## Step 2 — Security scan (10 min)

```bash
# Run malware scan
cd /var/www/<client-domain>
wp malware-scan run --output=table --allow-root 2>/dev/null || \
  clamscan -r . --infected --log=/tmp/scan-$(date +%Y%m%d).log

# Check WAF blocked requests (last 7 days)
grep "blocked" /var/log/nginx/access.log | wc -l

# Review failed login attempts
wp login-log list --limit=50 --allow-root 2>/dev/null || \
  grep "wp-login.php" /var/log/nginx/access.log | grep " 403 " | wc -l
```

**Document:**
- Number of malware scan results (target: 0)
- WAF blocks in period
- Any suspicious IP patterns → add to Fail2Ban blocklist if needed

---

## Step 3 — Content updates (15 min)

Review the client's pending content requests from their portal ticket.

**Common minor updates:**
- [ ] Text edits applied
- [ ] New images uploaded and optimized (convert to WebP if not already)
- [ ] Team member changes reflected
- [ ] New blog post published (if CMS content provided)
- [ ] Contact details verified current

**For each image added:**
```bash
# Optimize images before upload
cwebp input.jpg -o output.webp -q 82
# Or use ImageMagick for batch
mogrify -format webp -quality 82 *.jpg
```

---

## Step 4 — Broken link audit (10 min)

```bash
# Run broken link checker
wget --spider --recursive --no-verbose --output-file=/tmp/wget-links.log \
  https://<client-domain> 2>&1
grep -i "broken link\|404\|error" /tmp/wget-links.log | head -20
```

Fix any 404s found — update internal links, redirect old URLs via Nginx, or update content.

---

## Step 5 — Performance check (5 min)

```bash
# Run Lighthouse (requires lighthouse CLI)
lighthouse https://<client-domain> --output=json --output-path=/tmp/lh-$(date +%Y%m).json \
  --chrome-flags="--headless"

# Extract scores
cat /tmp/lh-$(date +%Y%m).json | python3 -c "
import json,sys
d=json.load(sys.stdin)['categories']
for k,v in d.items(): print(f'{k}: {v[\"score\"]*100:.0f}')
"
```

**Target scores:** Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90

If any score dropped >5 points vs last month → investigate cause and add to report.

---

## Step 6 — Backup verification (5 min)

```bash
# Confirm last 7 daily backups completed
aws s3 ls s3://bazionweb-backups/database/ \
  --endpoint-url https://s3.us-west-004.backblazeb2.com \
  | tail -7

# Check backup sizes are non-zero
aws s3 ls s3://bazionweb-backups/database/ \
  --endpoint-url https://s3.us-west-004.backblazeb2.com \
  | awk '$3 == 0 {print "EMPTY BACKUP: "$4}'
```

---

## Step 7 — Generate monthly report

Collate all findings into the monthly report template and:

1. Enter data into the client portal admin → Reports tab → Generate
2. Review auto-generated PDF before sending
3. Email to client contact by the **5th of the month**

**Report must include:**
- [ ] Uptime % for the period
- [ ] CMS/plugin updates applied (list)
- [ ] Malware scan results
- [ ] Broken links found and fixed
- [ ] Lighthouse score (current vs previous)
- [ ] Backup status
- [ ] Open/resolved tickets for the period
- [ ] Recommendations for next month

---

## Completion

- [ ] Close Zammad maintenance ticket with summary
- [ ] Update client's maintenance log in admin portal
- [ ] Confirm next maintenance window is scheduled

**Time budget:** 75 minutes per site. If a site requires more than 2 hours → escalate to Lead Engineer and create a separate scoped task.
