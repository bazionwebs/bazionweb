# BazionWeb Design System Specification (v1.0)
## Design Tokens, Component Standards, Typography & Interactive Patterns

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Implementation:** Tailwind CSS 3.4 (`apps/web/tailwind.config.ts`), Next.js 14, Lucide Icons  
**Accessibility Target:** WCAG 2.1 AA Compliant  

---

## 1. Brand Aesthetics & Visual Principles

1. **Engineering Precision:** Clean lines, generous negative space, crisp typography, and restrained borders replace messy gradients or gimmicky animations.
2. **High-Contrast Clarity:** Deep slate and obsidian backgrounds (`#0F172A`) paired with vibrant primary teal (`#14B8A6`) and crisp white surfaces establish authority, readability, and modern tech sophistication.
3. **Responsive & Tactile:** Every interactive element has defined hover, focus-visible, and active states with subtle micro-transitions (150–200ms ease-out).

---

## 2. Design Tokens & Color Palette

### 2.1 Color Tokens

```css
/* Core Dark Palette (Heros, Footers, Accent Surfaces) */
--color-slate-950: #020617; /* Deep canvas */
--color-slate-900: #0F172A; /* Primary dark background */
--color-slate-800: #1E293B; /* Card & container dark */
--color-slate-700: #334155; /* Dark borders & dividers */

/* Core Light Surfaces */
--color-white:     #FFFFFF; /* Permanent navbar, light cards */
--color-slate-50:  #F8FAFC; /* Light page canvas */
--color-slate-100: #F1F5F9; /* Muted card background */
--color-slate-200: #E2E8F0; /* Light borders */
--color-slate-400: #94A3B8; /* Muted secondary text */
--color-slate-600: #475569; /* Body text on light */
--color-slate-900: #0F172A; /* High-contrast headings */

/* Brand & Interactive Accents */
--color-teal-600:  #0D9488; /* Primary brand accent (Light) */
--color-teal-500:  #14B8A6; /* Primary brand accent (Dark/Vibrant) */
--color-teal-400:  #2DD4BF; /* Hover / highlight */
--color-teal-50:   #F0FDFA; /* Soft badge background */

/* Accent / Secondary */
--color-indigo-600:#4F46E5; /* Tech / Enterprise accent */
--color-indigo-500:#6366F1; /* Dynamic highlight */

/* Semantic Status */
--color-success:   #10B981; /* Valid, online, active */
--color-warning:   #F59E0B; /* Attention, pending */
--color-danger:    #EF4444; /* Error, alert, P1 outage */
```

---

## 3. Typography Scale & Hierarchy

We pair **Inter** (for crisp, legible user interfaces, body copy, and data tables) with **Outfit** (for high-impact modern geometric headings).

| Token | Font Family | Size (px/rem) | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `text-display` | Outfit | 56px / 3.5rem | 1.1 | 800 (Extrabold) | Hero H1 on desktop |
| `text-h1` | Outfit | 40px / 2.5rem | 1.15 | 700 (Bold) | Major page titles |
| `text-h2` | Outfit | 30px / 1.875rem| 1.25 | 700 (Bold) | Section headings |
| `text-h3` | Inter | 22px / 1.375rem| 1.3 | 600 (Semibold)| Card & feature titles |
| `text-body-lg` | Inter | 18px / 1.125rem| 1.6 | 400 (Regular) | Hero lead paragraphs |
| `text-body` | Inter | 15px / 0.9375rem| 1.55 | 400 (Regular) | Standard body copy |
| `text-sm` | Inter | 13px / 0.8125rem| 1.5 | 500 (Medium) | Badges, metadata, labels |
| `text-xs` | Inter | 11px / 0.6875rem| 1.4 | 600 (Semibold)| Eyebrows, uppercase pills |

---

## 4. Master Component Specifications

### 4.1 Global Sticky Navigation Bar
* **Surface:** Permanent `#FFFFFF` with `backdrop-blur-md` on scroll and subtle lower border (`border-slate-200/80`).
* **Height:** Desktop `72px` (`h-[72px]`), Mobile `64px`.
* **Lockup:** Official BazionWeb logo with high-res icon and modern dark wordmark.
* **Navigation Links:** Slate-600 with hover transition to Teal-600. Active route highlighted with a subtle pill indicator.
* **Market Indicator Switcher:** Accessible pill toggle (🇰🇪 KES | 🌍 USD) with instant local state sync.
* **Primary Action:** Solid Teal Button (`bg-[#0D9488] hover:bg-[#0f766e] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all`).

### 4.2 Hero Section Anatomy
* **Background:** Deep Slate `#0F172A` with subtle radial gradient mesh.
* **Eyebrow Badge:** Pill container with soft teal border and dot indicator (`2026 Commercial Architecture`).
* **H1:** Bold white title with high legibility.
* **Lead Paragraph:** Light slate `#94A3B8` max-w-2xl.
* **CTA Cluster:** Solid primary button + Secondary outline button (`border border-slate-700 hover:border-slate-500 text-white`).
* **Proof Strip:** 3 trust assertions with Lucide icons (Client Ownership, Sub-2s Load Times, SLA Support).

### 4.3 Interactive Pricing Cards
* **Container:** Rounded-2xl card with 1px border (`border-slate-200` on light, `border-slate-800` on dark).
* **Hover State:** Elevates with `translate-y-[-4px]` and subtle colored shadow.
* **Popular Tier Accent:** Teal highlight border (`border-2 border-[#0D9488]`) and top badge ("Most Popular").
* **Pricing Display:** Formatted numeral with dynamic currency switch (`KSh 50,000` / `$1,250`).
* **Feature List:** Green checkmark icons with clear typography and hover tooltips for technical terms.

### 4.4 The Digital Project Configurator (`/quote`)
* **Layout:** Multi-step wizard with visual progress stepper (Steps 1 through 6).
* **Selection Cards:** Interactive grid of selectable option cards with active ring states (`ring-2 ring-[#0D9488] bg-teal-50/50`).
* **Sticky Summary Drawer:** Real-time tally on desktop sidebar displaying:
  * Selected base package.
  * Selected add-ons with unit prices.
  * Estimated project delivery timeline.
  * Total estimated investment in selected currency.
  * One-click "Request Formal Proposal" trigger.

### 4.5 Process Stepper with Exit Criteria
* **Layout:** Vertical or alternating horizontal timeline.
* **Step Header:** Step number pill (e.g. `PHASE 01 — DISCOVER`).
* **Deliverables List:** Concrete items produced during the phase.
* **Exit Criteria Badge:** High-trust checkmark pill:  
  * *"Phase complete when client formally signs off on UX wireframes and specification."*

### 4.6 Accessible Accordion FAQs
* **Semantics:** HTML `<button>` trigger with `aria-expanded` and matching content panel with `role="region"`.
* **Animation:** Smooth CSS grid or height transition on expand/collapse.
* **Keyboard Navigation:** Full Enter/Space toggle and tab order continuity.

---

## 5. Micro-Animations & Transitions

* **Duration:** Standard micro-interactions set to `200ms ease-out`.
* **Hover Lift:** `transform hover:-translate-y-1 transition duration-200 shadow-lg`.
* **Button Ripple/Press:** `active:scale-[0.98] transition-transform`.
* **Focus Ring:** Every interactive element has `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2`.
* **Reduced Motion:** All transitions wrapped in `@media (prefers-reduced-motion: reduce)` fallbacks.
