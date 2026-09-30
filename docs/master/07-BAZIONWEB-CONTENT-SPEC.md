# BazionWeb Content Specification & Page Blueprints
## Structural Wireframes, Copywriting Directives & Conversion Anatomy

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Audience:** Copywriters, Frontend Engineers, Content Editors  
**Voice & Tone:** Authoritative, Engineering-Led, Commercial, Transparent, No Marketing Fluff  

---

## 1. Editorial Voice & Tone Guidelines

1. **Say What It Is, Not What It Sounds Like:** We avoid generic agency clichés like *"digital alchemy"* or *"passionate about your success."* We say: *"We engineer secure, high-speed websites with sub-2-second load times and 100% client asset ownership."*
2. **Transparent Scope over Vague Promises:** Always itemize deliverables, revision boundaries, and support windows.
3. **No Unsubstantiated Guarantees:** Do not promise "#1 on Google in 7 days" or "100% bug-free software." Guarantee engineering processes, SLA response benchmarks, and testing rigor.
4. **Market-Defensible Framing:** Never describe Kenyan pricing as "cheap." Describe it as *"Accessible enterprise-grade engineering optimized for the local SME landscape."*

---

## 2. Archetype 1: Master Homepage Blueprint

The homepage does not attempt to explain every technical nuance. Its mission is to **Position → Build Trust → Diagnose Need → Present Solution → Prove Capability → Convert**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. HERO SECTION                                                             │
│ H1: "Build. Launch. Manage. Grow."                                          │
│ Sub: "Digital platforms, websites, and systems engineered for your business."│
│ CTAs: [Get a Free Assessment] (Primary) | [Explore Services] (Secondary)    │
│ Trust Badges: 100% Client Ownership · Sub-2s Load Times · SLA Support       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. WHAT BAZIONWEB DOES (The Triad)                                          │
│ Card 1: BUILD (Websites, Stores, Custom Systems)                            │
│ Card 2: MANAGE (Hosting, Security, Maintenance, Uptime)                     │
│ Card 3: GROW (SEO, Conversion Optimization, Integrations, Analytics)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. CORE SERVICE FAMILIES (5 Interactive Cards)                              │
│ Websites · E-Commerce · Custom Systems · Managed Cloud · Specialized Tech   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. INDUSTRY SOLUTIONS (Selector Tabs)                                       │
│ SMEs · Churches & Ministries · Schools & LMS · NGOs · Startups · Firms      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. WHY BAZIONWEB (Verifiable Differentiators)                               │
│ 100% Client Ownership · Transparent Pricing · Modern Tech · Active SLA      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. HOW WE WORK (The 6-Stage Process)                                        │
│ Discover ─► Plan ─► Build ─► Test ─► Launch ─► Manage                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. PROVEN RESULTS (Case Studies in Problem ─► Solution ─► Result)           │
│ Real metrics: +140% organic traffic, sub-second LCP, zero security breaches │
├─────────────────────────────────────────────────────────────────────────────┤
│ 8. BAZIONWEB CARE (Post-Launch Partnership)                                 │
│ "We don't disappear after launch." Retainers, Daily Backups, Proactive SLA  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 9. MASTER CONVERSION CTA                                                    │
│ "Let's Build Your Digital Platform." Instant Configurator or Direct Contact │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Archetype 2: Service Category Blueprint (e.g. `/services/websites`)

Every service category page conforms to an identical high-converting layout:

1. **Breadcrumb Bar:** Schema-backed navigational trail (`Home / Services / Websites`).
2. **Hero Block:** Focused H1 (*"Professional Websites Engineered for Growing Businesses"*), commercial summary paragraph, and primary CTA (*"Configure Your Website Quote"*).
3. **Who It's For:** 3 audience segments with specific operational qualifiers.
4. **What We Build:** 4 cards depicting Launch, Business, Professional, and Corporate solutions.
5. **Interactive Packages Grid:** Transparent pricing cards featuring Kenya (KES) / International (USD) toggle switch, itemized deliverables, revision policies, and delivery timelines.
6. **Detailed Feature Breakdown:** Deep dive into responsiveness, CMS capabilities, SEO architecture, and analytics instrumentation.
7. **Our Delivery Process:** Step-by-step roadmap from initial wireframes to production deployment.
8. **Modular Add-Ons:** Up-sell cards (extra pages, multilingual, custom forms, payment gateway).
9. **Explicit Exclusions:** Clear statement of out-of-scope boundaries to manage expectations.
10. **Frequently Asked Questions:** 6–8 expandable accordion questions with `FAQPage` JSON-LD schema.
11. **Bottom Conversion Block:** Dual CTA (*"Get an Instant Quote"* | *"Book a 15-Minute Technical Call"*).

---

## 4. Archetype 3: Solution Vertical Blueprint (e.g. `/solutions/churches`)

Solution pages address organizational pain points rather than technical code constructs:

1. **Vertical Hero:** *"Digital Platforms Engineered for Modern Ministries & Churches."*
2. **The Sector Problem:** Highlight friction points (e.g. lost tithes, disconnected members, unorganized WhatsApp broadcasts, outdated sermon audio archives).
3. **The BazionWeb Solution Stack:**
   * M-Pesa STK Push instant giving with automated SMS confirmation.
   * Centralized member registry and ministry department permissions.
   * On-demand sermon audio/video library with podcast feed generation.
   * Clean, dignified public web presence with interactive event calendar.
4. **Recommended Solution Bundle:** Business Website + M-Pesa Giving Gateway + Care Business Retainer.
5. **Customer Proof & Testimonial:** Quote from a church administrator with verified impact metrics.
6. **Specific Vertical FAQ:** Questions regarding church financial data privacy, diaspora credit card donations, and staff administrative training.
7. **Solution CTA:** *"Request a Church Digital Assessment."*

---

## 5. Archetype 4: Master Pricing Blueprint (`/pricing`)

1. **Market Preference Switcher:** Persistent toggle between 🇰🇪 Kenya (KES) and 🌍 International (USD).
2. **Service Category Tabs:** Websites, E-Commerce, Custom Systems, Care Retainers, Add-On Catalogue.
3. **Tiered Comparison Cards:** Clear highlight on the "Most Popular" tier (e.g. Business Website at KSh 50,000 / $1,250).
4. **Detailed Feature Checklists:** Explicit checkmarks showing included features and deliverables.
5. **Interactive Add-On Matrix:** Transparent unit pricing for incremental scope.
6. **Contractual Guarantees Section:**
   * 100% Client Ownership Guarantee.
   * Fixed-Scope Pricing Guarantee (no surprise billing).
   * Documented Post-Launch Warranty Period.
7. **Interactive Link to Configurator:** *"Want a tailored price? Build your project with our 2-minute Configurator →"*

---

## 6. Archetype 5: Mandatory Legal & Commercial Governance Copy

### 6.1 The Client Ownership Clause (Terms of Service)
> *"Unless expressly governed by a separate proprietary software license, the Client shall retain sole, exclusive, and unencumbered ownership of their registered domain name, all delivered website frontend and backend source code, database schemas, uploaded digital assets, proprietary business data, and customer records upon settlement of the final project invoice. BazionWeb shall never hold a Client's domain name, codebase, or hosting credentials hostage."*

### 6.2 The Third-Party Services & Pass-Through Costs Clause
> *"All third-party recurring subscriptions, including but not limited to domain registrar fees, specialized cloud compute resources, paid transactional SMS credits (e.g., Africa's Talking), payment processing fees (e.g., Safaricom M-Pesa, IntaSend, Stripe), commercial software licenses, and stock photography, represent pass-through expenses borne directly by the Client unless explicitly bundled within a written project agreement."*

### 6.3 The Change Request Policy
> *"An agreed revision sprint refines or corrects deliverables specified within the approved project brief. Any request for new functional modules, additional custom pages, supplementary database relationships, or integrations introduced after design or architecture sign-off shall be classified as a Formal Change Request and costed separately prior to commencement of engineering."*
