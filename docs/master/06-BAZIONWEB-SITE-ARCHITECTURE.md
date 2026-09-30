# BazionWeb Site Architecture & Information Architecture (IA)
## URL Taxonomy, Global Navigation, Breadcrumbs & Canonical Hierarchy

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Target Platform:** Next.js 14 App Router (`apps/web/src/app`)  

---

## 1. Global Navigation Hierarchy

The primary navigation balances clarity with deep commercial pathways without overwhelming the visitor:

```
HOME (/)
├── SERVICES (/services)
│   ├── Websites (/services/websites)
│   ├── E-Commerce (/services/ecommerce)
│   ├── Custom Systems (/services/custom-systems)
│   ├── Managed Technology (/services/managed-technology)
│   └── Specialized Services (/services/specialized-services)
├── SOLUTIONS (/solutions)
│   ├── Small & Medium Businesses (/solutions/smes)
│   ├── Churches & Ministries (/solutions/churches)
│   ├── Schools & Education (/solutions/education)
│   ├── NGOs & Non-Profits (/solutions/ngos)
│   ├── Startups & Product MVPs (/solutions/startups)
│   └── Professional Services (/solutions/professional-services)
├── PRICING (/pricing)
│   ├── Website Packages (/pricing/websites)
│   ├── E-Commerce Packages (/pricing/ecommerce)
│   ├── Custom Systems Guide (/pricing/custom)
│   ├── Care Retainers & SLA (/pricing/care)
│   └── Add-On Price Card (/pricing/addons)
├── WORK (/case-studies)
│   ├── Case Studies (/case-studies)
│   └── Live Portfolio (/portfolio)
├── RESOURCES (/resources)
│   ├── Engineering Blog (/blog)
│   ├── Frequently Asked Questions (/faq)
│   └── Technical Knowledgebase (/resources/guides)
├── COMPANY
│   ├── About Us (/about)
│   ├── Our Process (/process)
│   ├── Security & Compliance (/security)
│   └── Contact (/contact)
└── CLIENT PORTAL (/portal) [Button / Lockup]
```

**Primary Floating CTA in Header:** `Get a Free Assessment` (`/quote`)

---

## 2. Complete URL Directory & Route Inventory

| Route Path | Page Title | Primary Intent | SEO Keywords | OpenGraph Type |
| :--- | :--- | :--- | :--- | :--- |
| `/` | BazionWeb — Websites, Digital Systems & Managed Technology | Positioning & Trust | web development Kenya, digital systems | website |
| `/services` | Comprehensive Digital Engineering Services | Service Discovery | software engineering services, web agency | website |
| `/services/websites` | Professional Website Design & Engineering | Commercial / Purchase | business website design Kenya, responsive site | article |
| `/services/ecommerce` | E-Commerce Development & M-Pesa Integration | Commercial / Purchase | e-commerce website Kenya, M-Pesa online store | article |
| `/services/custom-systems` | Custom Software, Web Applications & Portals | Discovery / Inquiry | custom software development Nairobi, web portal | article |
| `/services/managed-technology`| Managed Cloud Hosting, Maintenance & Care | Recurring Conversion | managed website hosting, website maintenance Kenya | article |
| `/services/specialized-services`| Platform Migration, Security Audits & Recovery | High-intent Problem | website security audit, hack recovery Kenya | article |
| `/services/website-maintenance`| Proactive Website Care & Maintenance Retainers| Recurring Conversion | website care plans, monthly web support | article |
| `/services/website-security` | Website Security Hardening & Malware Defense | Problem Solving | website security services, clean hacked site | article |
| `/services/performance-optimization`| Speed Tuning & Core Web Vitals Optimization | Problem Solving | speed up website, Core Web Vitals audit | article |
| `/services/managed-hosting` | High-Availability Managed Cloud Hosting | Recurring Conversion | reliable web hosting Kenya, Docker cloud hosting | article |
| `/services/seo` | Technical SEO & Search Authority Engineering | Organic Growth | technical SEO services Kenya, search rankings | article |
| `/services/website-migration` | Zero-Downtime Website & Database Migration | Migration Support | migrate website to fast host, cPanel migration | article |
| `/services/emergency-recovery`| Emergency Website Rescue & Incident Response | Urgent Assistance | website down help, hacked WordPress fix | article |
| `/solutions` | Tailored Digital Solutions by Industry | Sector Discovery | digital solutions by industry Kenya | website |
| `/solutions/smes` | Digital Systems for Growing Small & Medium Businesses | Conversion | SME website Kenya, business digital growth | article |
| `/solutions/churches` | Digital Giving & Church Management Systems (ChMS) | Conversion | church website design Kenya, M-Pesa giving | article |
| `/solutions/education` | Student Portals & School Management Systems (SIS) | Conversion | school management system Kenya, student portal | article |
| `/solutions/ngos` | High-Trust Digital Platforms for NGOs & Charities | Conversion | NGO website design, donor reporting platform | article |
| `/solutions/startups` | MVP Engineering & Scalable Web Architectures | Product Launch | startup MVP development Kenya, Next.js build | article |
| `/solutions/professional-services`| Authority Digital Presence for Law, Medical & Consulting | Conversion | law firm website Kenya, medical clinic website | article |
| `/pricing` | Transparent 2026 Commercial Pricing Architecture | Price Transparency | website design price list Kenya, web development cost | website |
| `/quote` | Digital Project Configurator & Instant Estimation | Lead Generation | website cost calculator, quote configurator | website |
| `/process` | The 6-Stage Engineering & Delivery Process | Trust & Rigor | web development process, project delivery | website |
| `/security` | Enterprise Security Standards & Data Sovereignty | Trust & Compliance | data protection Kenya, secure website engineering | website |
| `/case-studies` | Proven Engineering Results & Case Studies | Social Proof | web development portfolio, client case studies | website |
| `/faq` | Frequently Asked Questions & Operational Clarity | Objection Handling | web design FAQ Kenya, domain ownership questions | website |
| `/contact` | Consult with a BazionWeb Solutions Engineer | Direct Inbound | contact web developers Nairobi, book assessment | website |
| `/legal/terms` | Master Terms of Service & Engagement | Legal Governance | terms of service, engagement contract | website |
| `/legal/privacy` | Privacy Policy & Data Protection Compliance | Legal Governance | privacy policy, Kenya Data Protection Act 2019 | website |
| `/legal/sla` | Service Level Agreement & Operational Uptime Terms | Contractual Proof | SLA terms, uptime guarantee, response times | website |
| `/legal/ownership` | 100% Client Ownership Guarantee Policy | Differentiator | client domain ownership, source code rights | website |
| `/portal` | BazionWeb Client Operations Portal (Secure Login) | Client Management | client login, support tickets, billing | website |

---

## 3. SEO Hierarchy & Breadcrumbs Specification

Every internal page implements structured JSON-LD `BreadcrumbList` markup adhering to Google's Rich Result standard.

### Breadcrumb Trail Examples:
* **Service Page:** `Home (/)` → `Services (/services)` → `Websites (/services/websites)`
* **Solution Page:** `Home (/)` → `Solutions (/solutions)` → `Churches & Ministries (/solutions/churches)`
* **Pricing Subpage:** `Home (/)` → `Pricing (/pricing)` → `Care Retainers (/pricing/care)`
* **Case Study Detail:** `Home (/)` → `Case Studies (/case-studies)` → `Global Mission Center Impact`

---

## 4. 301 Redirect Rules for Legacy URL Migration

To preserve existing search rankings and prevent broken bookmarks from previous site versions, the Next.js `middleware.ts` / `next.config.mjs` executes canonical 301 permanent redirects:

```typescript
// next.config.mjs redirects definition
module.exports = {
  async redirects() {
    return [
      { source: '/web-design', destination: '/services/websites', permanent: true },
      { source: '/web-development', destination: '/services/websites', permanent: true },
      { source: '/online-store', destination: '/services/ecommerce', permanent: true },
      { source: '/plans', destination: '/pricing', permanent: true },
      { source: '/our-process', destination: '/process', permanent: true },
      { source: '/why-us', destination: '/about', permanent: true },
      { source: '/maintenance', destination: '/services/website-maintenance', permanent: true },
      { source: '/calculator', destination: '/quote', permanent: true },
      { source: '/estimate', destination: '/quote', permanent: true },
      { source: '/support-terms', destination: '/legal/sla', permanent: true },
    ];
  },
};
```
