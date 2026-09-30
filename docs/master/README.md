# BazionWeb Master Architecture & Platform Documentation
## The 10 Master Artifacts for the BazionWeb Business-Platform Upgrade

**Document Suite Version:** 1.0.0  
**Effective Date:** October 2026  
**Operating Model:** Build → Manage → Grow  
**Status:** Canonical Reference for Engineering, Sales, and Operations  

---

## 1. Overview of the Master Documentation Suite

This directory contains the authoritative blueprint for transforming BazionWeb from a standard website describing services into a full digital engineering platform.

Before undertaking UI updates, all engineering, design, and content activities reference these 10 canonical documents:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BAZIONWEB MASTER ARTIFACT SUITE                       │
├────┬──────────────────────────────────────────┬─────────────────────────────┤
│ #  │ Master Artifact                          │ Strategic Purpose           │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 01 │ 01-BAZIONWEB-SERVICE-ARCHITECTURE.md     │ Defines all 5 service       │
│    │                                          │ families & lifecycle models │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 02 │ 02-BAZIONWEB-PRICING-BOOK.md             │ Kenya (KES) & International │
│    │                                          │ (USD) commercial pricing    │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 03 │ 03-BAZIONWEB-ADDONS.md                   │ Modular add-ons, technical  │
│    │                                          │ specs & configurator rules  │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 04 │ 04-BAZIONWEB-SLA.md                      │ Support severities (P1–P4), │
│    │                                          │ contractual response times  │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 05 │ 05-BAZIONWEB-CUSTOMER-JOURNEYS.md        │ 6 vertical customer journeys│
│    │                                          │ (SME, Church, School, NGO)  │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 06 │ 06-BAZIONWEB-SITE-ARCHITECTURE.md        │ Global navigation, URL      │
│    │                                          │ taxonomy & canonical sitemap│
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 07 │ 07-BAZIONWEB-CONTENT-SPEC.md             │ Page wireframes, copy       │
│    │                                          │ blueprints & legal clauses  │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 08 │ 08-BAZIONWEB-DESIGN-SYSTEM.md            │ UI tokens, typography scale,│
│    │                                          │ component specifications    │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 09 │ 09-BAZIONWEB-TECHNICAL-SPEC.md           │ Monorepo stack, security,   │
│    │                                          │ performance CWV & telemetry │
├────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 10 │ 10-BAZIONWEB-IMPLEMENTATION-ROADMAP.md   │ 8-Release rollout plan      │
│    │                                          │ translating 30 phases       │
└────┴──────────────────────────────────────────┴─────────────────────────────┘
```

---

## 2. Quick Links to Master Documents

1. [01-BAZIONWEB-SERVICE-ARCHITECTURE.md](file:///d:/bazionweb/docs/master/01-BAZIONWEB-SERVICE-ARCHITECTURE.md): Service families (Websites, E-Commerce, Custom Systems, Managed Tech, Specialized Services) and standardized service templates.
2. [02-BAZIONWEB-PRICING-BOOK.md](file:///d:/bazionweb/docs/master/02-BAZIONWEB-PRICING-BOOK.md): Dual-market price lists, milestone payment schedules, client ownership guarantee, and rush rates.
3. [03-BAZIONWEB-ADDONS.md](file:///d:/bazionweb/docs/master/03-BAZIONWEB-ADDONS.md): Centralized add-on catalogue with technical definitions and TypeScript schema for the configurator.
4. [04-BAZIONWEB-SLA.md](file:///d:/bazionweb/docs/master/04-BAZIONWEB-SLA.md): Incident classifications (P1 to P4), response vs resolution benchmarks, runbooks, and uptime credits.
5. [05-BAZIONWEB-CUSTOMER-JOURNEYS.md](file:///d:/bazionweb/docs/master/05-BAZIONWEB-CUSTOMER-JOURNEYS.md): Pain point maps, solution packages, and end-to-end buying playbooks for SMEs, churches, schools, NGOs, startups, and professional services.
6. [06-BAZIONWEB-SITE-ARCHITECTURE.md](file:///d:/bazionweb/docs/master/06-BAZIONWEB-SITE-ARCHITECTURE.md): Complete route index, header/footer IA, breadcrumb hierarchy, and 301 redirect mapping.
7. [07-BAZIONWEB-CONTENT-SPEC.md](file:///d:/bazionweb/docs/master/07-BAZIONWEB-CONTENT-SPEC.md): 9-section homepage anatomy, service category blueprints, industry solution blueprints, and governance copy.
8. [08-BAZIONWEB-DESIGN-SYSTEM.md](file:///d:/bazionweb/docs/master/08-BAZIONWEB-DESIGN-SYSTEM.md): Tailwind tokens, color palette (`#0F172A`, `#0D9488`, `#14B8A6`), Inter/Outfit typography, and accessible UI patterns.
9. [09-BAZIONWEB-TECHNICAL-SPEC.md](file:///d:/bazionweb/docs/master/09-BAZIONWEB-TECHNICAL-SPEC.md): Full-stack monorepo (`apps/web`, `apps/api`), Docker topology, Keycloak OIDC, Edge caching, CSP headers, and telemetry taxonomy.
10. [10-BAZIONWEB-IMPLEMENTATION-ROADMAP.md](file:///d:/bazionweb/docs/master/10-BAZIONWEB-IMPLEMENTATION-ROADMAP.md): 8 release sprints converting the 30 implementation phases into structured production tasks.
