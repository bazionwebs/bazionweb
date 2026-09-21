# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ Active |
| `staging` | ✅ Active |
| Older releases | ❌ Not supported |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub Issue for security vulnerabilities.**

To report a security vulnerability, use one of the following channels:

### Option 1 — GitHub Private Security Advisory (Preferred)

Use GitHub's built-in security reporting:

👉 [Report a vulnerability](https://github.com/bazionwebs/bazionweb/security/advisories/new)

This creates a private draft advisory visible only to maintainers.

### Option 2 — Email

Send details to: **security@bazionweb.com**

Encrypt your email using our PGP key (available on request).

---

## What to Include

Please provide as much detail as possible:

- **Description** — what is the vulnerability and where is it?
- **Impact** — what data or functionality is affected?
- **Steps to reproduce** — a minimal, reliable reproduction
- **Proof of Concept** — code snippet or screenshot if available
- **Severity assessment** — your estimate (Critical / High / Medium / Low)

---

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement | Within **48 hours** |
| Severity assessment | Within **5 business days** |
| Fix / patch | Within **30 days** for Critical/High; **90 days** for Medium/Low |
| Public disclosure | After patch is deployed and affected parties notified |

We follow **responsible disclosure**. We will coordinate with you on the disclosure timeline.

---

## Scope

**In Scope:**
- Authentication and authorization bypasses
- SQL injection, XSS, CSRF vulnerabilities
- Payment/billing logic vulnerabilities
- Privilege escalation
- Sensitive data exposure (credentials, PII, payment data)
- Server-Side Request Forgery (SSRF)
- Remote code execution

**Out of Scope:**
- Denial-of-service attacks requiring significant infrastructure
- Social engineering of staff
- Vulnerabilities in third-party services (report directly to them)
- Issues in unmaintained or end-of-life dependencies with no viable patch

---

## Safe Harbour

BazionWeb will not pursue legal action against researchers who:
- Report vulnerabilities in good faith using the channels above
- Avoid accessing, modifying, or deleting data beyond what is needed to prove the vulnerability
- Do not disclose the vulnerability publicly before we have had a reasonable opportunity to address it

---

## Hall of Fame

We thank the following researchers for responsible disclosures:

*(No entries yet — be the first!)*
