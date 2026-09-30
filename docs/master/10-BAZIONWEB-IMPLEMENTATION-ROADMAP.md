# BazionWeb Implementation Roadmap: 8-Release Master Execution Plan
## Translation of the 30 Roadmap Phases into Phased Production Releases

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Execution Strategy:** Iterative, Non-Destructive Refactoring & Platform Modernization  
**Monorepo Path:** `bazionweb/apps/web` & `bazionweb/apps/api`  

---

## 1. Master Release Overview

To execute the upgrade with speed and zero disruption to active business operations, the 30 implementation phases are structured into **8 Strategic Production Releases**:

```
┌────────────┬──────────────────────────────────────────┬───────────┬──────────────┐
│ Release    │ Focus Area & Deliverables                │ Priority  │ Target Window│
├────────────┼──────────────────────────────────────────┼───────────┼──────────────┤
│ Release R1 │ Commercial Architecture & Service Master │ 🔴 Critical│ Sprint 1     │
│ Release R2 │ Pricing System, Add-On Engine & SLA      │ 🔴 Critical│ Sprint 1–2   │
│ Release R3 │ Navigation, Layout & Homepage Redesign   │ 🔴 Critical│ Sprint 2     │
│ Release R4 │ Service Categories & Industry Solutions  │ 🔴 Critical│ Sprint 3     │
│ Release R5 │ Digital Configurator & Discovery Engine  │ 🟠 High   │ Sprint 3–4   │
│ Release R6 │ Security, Performance (CWV) & Telemetry  │ 🟠 High   │ Sprint 4     │
│ Release R7 │ Client Onboarding & Portal Foundation    │ 🟡 Next   │ Sprint 5     │
│ Release R8 │ Staging QA, Production & 30-Day Monitor  │ 🟢 Launch │ Sprint 5–6   │
└────────────┴──────────────────────────────────────────┴───────────┴──────────────┘
```

---

## 2. Release R1: Commercial Architecture & Service Catalogue Foundation
* **Roadmap Phases Covered:** Phase 0 (Baseline), Phase 1 (Commercial Architecture), Phase 2 (Build → Manage → Grow Model), Phase 3 (Rebuild Service Catalogue).
* **Core Tasks:**
  1. Freeze baseline code and backup production database/assets.
  2. Inventory existing routes, broken links, and metadata.
  3. Formulate the Five Service Families (Websites, E-Commerce, Custom Systems, Managed Tech, Specialized Services).
  4. Write and publish master architectural blueprints (`01-BAZIONWEB-SERVICE-ARCHITECTURE.md`).
* **Deliverables:**
  * Complete inventory audit sheet.
  * Canonical service definitions in codebase library (`apps/web/src/lib/servicesData.ts`).

---

## 3. Release R2: Pricing System, Add-Ons & SLA Framework
* **Roadmap Phases Covered:** Phase 4 (Pricing Architecture), Phase 5 (Add-On Catalogue), Phase 12 (Care Plans), Phase 13 (SLA Matrix), Phase 23 (Legal & Commercial Terms), Phase 24 (Dual Market KES/USD).
* **Core Tasks:**
  1. Implement dual-market preference context and hook (`useMarketPreference`).
  2. Codify the 2026 pricing tables for Kenya and International tiers (`lib/pricingData.ts`).
  3. Codify the centralized Add-On catalogue with pricing rules (`03-BAZIONWEB-ADDONS.md`).
  4. Implement the SLA matrix page and policy documents (`/legal/sla`, `/legal/ownership`).
* **Deliverables:**
  * Interactive pricing page (`/pricing`) with currency toggle.
  * Verified Add-On matrix and contractual ownership policy.

---

## 4. Release R3: Global Navigation & Master Homepage Redesign
* **Roadmap Phases Covered:** Phase 6 (Target Customers), Phase 7 (Information Architecture), Phase 8 (Homepage Redesign), Phase 22 (Content & Trust System).
* **Core Tasks:**
  1. Rebuild primary navbar with sticky backdrop blur, official logo lockup, and currency switcher pill.
  2. Implement the 9-section master homepage blueprint (`apps/web/src/app/(public)/page.tsx`):
     * Hero with high-contrast copy, dual CTAs, and verified trust badges.
     * The Triad: Build → Manage → Grow.
     * Service family cards with visual hierarchy.
     * Industry solutions selector.
     * Differentiators (Client Ownership, Transparent Pricing, Senior Tech).
     * 6-stage process stepper with exit criteria.
     * Case studies with Problem → Solution → Result anatomy.
     * Post-launch care plan highlight.
     * Master assessment CTA banner.
* **Deliverables:**
  * Production homepage with sub-2s initial paint and responsive navigation.

---

## 5. Release R4: Service Category Pages & Industry Solution Verticals
* **Roadmap Phases Covered:** Phase 9 (Services Hub), Phase 10 (Individual Services), Phase 11 (Solutions Pages).
* **Core Tasks:**
  1. Build standardized Service Category layouts (`/services/websites`, `/services/ecommerce`, `/services/custom-systems`, `/services/managed-technology`, `/services/specialized-services`).
  2. Create deep high-intent problem pages (`/services/website-maintenance`, `/services/website-security`, `/services/performance-optimization`).
  3. Build dedicated Industry Solution pages:
     * `/solutions/smes` (Growing businesses).
     * `/solutions/churches` (M-Pesa giving & media platforms).
     * `/solutions/education` (Student information & portals).
     * `/solutions/ngos` (Donor transparency platforms).
     * `/solutions/startups` (MVP engineering).
     * `/solutions/professional-services` (Consultancies & clinics).
* **Deliverables:**
  * Full cluster of indexed service and industry landing pages with breadcrumbs and structured data.

---

## 6. Release R5: Interactive Quote Configurator & Discovery Engine
* **Roadmap Phases Covered:** Phase 14 (Quote Configurator), Phase 15 (Discovery Engine).
* **Core Tasks:**
  1. Build the multi-step Digital Project Configurator at `/quote`:
     * Step 1: Project Objective (Website, Store, Custom System, Maintenance, Migration).
     * Step 2: Organization Profile (SME, Church, School, NGO, Startup, Corporate).
     * Step 3: Core Package Tier.
     * Step 4: Modular Add-On selection with live subtotal tally.
     * Step 5: Management & Retainer selection.
     * Step 6: Contact Information & Submission.
  2. Wire client form state to NestJS API endpoint `/api/v1/quotes` with email notification hooks.
  3. Build the Custom System Discovery Intake at `/discovery`.
* **Deliverables:**
  * High-converting interactive estimation engine with lead generation pipeline.

---

## 7. Release R6: Security, Performance, SEO & Telemetry
* **Roadmap Phases Covered:** Phase 18 (Security), Phase 19 (Performance Engineering), Phase 20 (SEO Architecture), Phase 21 (Analytics & Telemetry).
* **Core Tasks:**
  1. Inject HTTP security headers (CSP, HSTS, X-Frame-Options) in Next.js config.
  2. Configure Redis sliding-window API rate limiters.
  3. Optimize Core Web Vitals: image lazy-loading, WebP/AVIF formats, font preloading, zero CLS.
  4. Generate dynamic XML sitemap (`/sitemap.xml`) and JSON-LD Rich Snippets (BreadcrumbList, FAQPage, Organization, Offer).
  5. Deploy privacy-compliant telemetry event tracking.
* **Deliverables:**
  * Green Lighthouse scores (Performance ≥ 90, Accessibility ≥ 95, SEO = 100).
  * Validated Google Rich Results schema.

---

## 8. Release R7: Client Onboarding Workflow & Portal Foundation
* **Roadmap Phases Covered:** Phase 16 (Onboarding System), Phase 17 (Portal Foundation).
* **Core Tasks:**
  1. Prepare the Next.js `/portal` authenticated workspace structure:
     * Dashboard: Project status, milestones, hosting health, quick actions.
     * Projects: Milestone deliverables, design preview links, sign-off buttons.
     * Tickets: Zammad-integrated support desk with SLA timer tracking.
     * Invoices: IntaSend / Stripe billing history and active retainer status.
  2. Integrate automated client welcome email sequences following proposal signature.
* **Deliverables:**
  * Functional client portal scaffold establishing BazionWeb as a digital platform.

---

## 9. Release R8: Staging QA, Production Deployment & 30-Day Monitoring
* **Roadmap Phases Covered:** Phase 25 (Technical QA), Phase 26 (Conversion QA), Phase 27 (Staging Launch), Phase 28 (Production Launch), Phase 29 (First 30 Days), Phase 30 (Continuous Optimization).
* **Execution Checklist:**
  * [ ] Cross-browser testing on Chrome, Edge, Firefox, Safari (macOS & iOS).
  * [ ] Mobile responsiveness testing on Android and iPhone devices.
  * [ ] Form submission, honeypot spam filtering, and email dispatch testing.
  * [ ] Canonical 301 redirect map verification.
  * [ ] Staging environment smoke tests.
  * [ ] Production zero-downtime deployment via Docker / Render.
  * [ ] Post-launch week-by-week monitoring:
    * Week 1: Error logs, form completions, uptime telemetry.
    * Week 2: User engagement, configurator funnel drop-offs.
    * Week 3: Google Search Console indexation and query rankings.
    * Week 4: First Monthly Platform Performance Report.
