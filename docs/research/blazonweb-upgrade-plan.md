# BlazonWeb.com Research → BazionWeb Upgrade Plan

> **Purpose:** distill the style and features of the reference site
> `https://blazonweb.com/` (fetched 2026-09-23: homepage, `/our-process/`,
> `/faq/`) into concrete, phased upgrades for **this** repo (`apps/web`,
> Next.js 14 + Tailwind). Nothing here copies their branding, copy, or
> assets — it adapts proven *patterns* to our stack, our brand, and our
> global (non-regional) positioning.
>
> **Standing constraints respected throughout:** global audience (no
> regional references), white permanent navbar + official logo lockups,
> Render + Neon free-tier hosting (mind bundle size and build minutes).

---

## 1. Reference site profile

| Aspect | Finding |
|---|---|
| Stack | WordPress (theme `Artificial-Reason-WP`), jQuery-era sliders, PHP backend. Assets dated 2015 (`pre.png`, `mac2.png`, iPhone mockups). |
| IA | Deep service taxonomy: Website Design (Business/CMS/E-Commerce/Benefits/Compare) × Website Management (What-is/Unlimited/Programming/Marketing/Maintenance/Benefits/Compare) + Why Choose Us, Portfolio, How We Work, FAQ, About cluster, Quote. |
| Header | Slim utility bar (My Account login, CPanel link, Facebook, toll-free phone) above a sticky nav with hover mega-dropdowns + `Get Quote` CTA. |
| Hero | 3-slide rotating slider: H1 + 3 checkmark bullets + `Watch Video` button per slide. |
| Homepage body | 4-skill icon grid → device/responsive section → **"12 Reasons to Hire"** numbered long-form list → Featured Clients screenshot grid → **voice (audio) testimonial carousel** → image strip → footer (About / Services / Contact + DMCA badge). |
| Process page | 6 anchored phases (Planning → Creation → Building → Testing → Launch → Management), each with exit criteria ("phase complete when…"), anchor-jump nav, breadcrumbs (`Home / Our Process`). |
| FAQ page | ~32-question accordion, grouped implicitly; contact/business-hours block beside it; heavy internal linking to compare-plans pages. |
| Trust devices | Toll-free number in header, client screenshots, named audio testimonials with company/city, DMCA badge, SOC3 report link, since-2002 messaging. |

**Honest assessment:** their *content machine* (depth of service pages, FAQ, process transparency, proof assets) is the thing to learn from. Their *visual tech* (2015 WP theme, stock device mockups, PHP messaging) is a decade behind our Next.js 14 stack — we adopt patterns, never the look.

---

## 2. Style audit — borrow vs. avoid

### Borrow
- **Utility micro-bar concept** (account + support + phone above the nav) — but only if it stays minimal; our white navbar must remain the hero.
- **Exit-criteria process writing** ("phase complete when YOU approve…") — high-trust copy pattern.
- **Numbered long-form persuasion** ("12 reasons") — excellent for SEO dwell time and sales enablement.
- **Proof density**: screenshots, named testimonials, badges, business-hours transparency.
- **Breadcrumbs on every content page** (SEO + orientation).

### Avoid
- Slider hero (hurts LCP/CLS; our static hero already outperforms it).
- Stock device mockups and 2015-era gradients/shadows.
- CPanel/account duplication (our Client Portal already covers this — don't add a second login).
- Regional anchoring (their "Nixa, Missouri / USA-based" is their moat; ours is global delivery — mirror the *technique*, never the geography).
- DMCA badge until/unless we hold a DMCA account (a dead badge link destroys trust).

---

## 3. Feature inventory → adoption verdict

| # | Reference feature | Our status | Verdict |
|---|---|---|---|
| 1 | FAQ accordion page (~32 Qs) | **Missing** — no `/faq` route | **ADOPT (Phase 1)** — biggest SEO gap (FAQ rich results) |
| 2 | Breadcrumbs + breadcrumb JSON-LD | **Missing** | **ADOPT (Phase 1)** — cheap, site-wide SEO win |
| 3 | "Why choose us" persuasion block | Partial (values on About only) | **ADOPT (Phase 1)** — homepage reasons section |
| 4 | 6-phase process page with exit criteria | **Missing** (`/process`) | **ADOPT (Phase 2)** |
| 5 | Click-to-call phone in header/mobile | Partial (footer only) | **ADOPT (Phase 1)** — mobile conversion |
| 6 | Back-to-top button | **Missing** | **ADOPT (Phase 1)** — 10-line win |
| 7 | Portfolio screenshots on case studies | Text-only case studies | **ADOPT (Phase 3)** — needs screenshot assets |
| 8 | Audio/video testimonials | Text quotes only | **ADOPT (Phase 3)** — needs client assets + consent |
| 9 | Hero explainer video modal | **Missing** | **ADOPT (Phase 3)** — needs video asset |
| 10 | Compare-plans tables | **Covered** (pricing comparison table) | Keep; extend with plan FAQ cross-links (Phase 2) |
| 11 | Multi-step quote calculator | **Covered** (`/quote`) | Keep |
| 12 | Client portal + ticket system | **Covered** (portal, superior to CPanel link) | Keep; do NOT duplicate |
| 13 | Utility topbar (account/phone/support) | Partial (portal link in nav) | **OPTIONAL (Phase 4)** — weigh against minimal navbar |
| 14 | DMCA / SOC3 trust badges | **Missing** | **SKIP** until accounts exist |
| 15 | "Benefits of…" SEO article cluster | Partial (2 blog posts) | Content task, not code — feed blog backlog |

---

## 4. Phased implementation plan

### Phase 1 — SEO + conversion quick wins (code only, ~1 session)

**Goal:** close the highest-ROI gaps with zero content dependencies.

1. **New `/faq` route** — `src/app/(public)/faq/page.tsx`
   - Client accordion (reuse card styles; one open at a time, `aria-expanded`,
     keyboard accessible). Seed 12–16 questions from real sales objections
     (timelines, ownership, hidden costs, SEO guarantees, cancellation).
   - Page `metadata`: title `FAQ`, description, **canonical**
     `https://bazionweb.com/faq`.
   - Emit **FAQPage JSON-LD** (see `JsonLd` helper below) — eligible for
     Google rich results.
   - Add `/faq` to `src/app/sitemap.ts` (priority 0.7, weekly).
   - Acceptance: route renders, accordion toggles, JSON-LD validates in
     Rich Results Test, sitemap includes it.
2. **Shared `JsonLd` helper** — `src/components/seo/JsonLd.tsx`
   - Props: `data: Record<string, unknown>`; renders
     `<script type="application/ld+json">` via `JSON.stringify`.
   - Acceptance: no hydration warnings, valid JSON in page source.
3. **Breadcrumbs** — `src/components/seo/Breadcrumbs.tsx`
   - Props: `trail: { name: string; href?: string }[]`; renders nav with
     `aria-label="Breadcrumb"` + matching **BreadcrumbList JSON-LD**.
   - Mount on: services index + all service pages, blog index + posts,
     case-studies index + detail, pricing, about, contact, faq, legal pages.
   - Acceptance: visible trail on desktop + mobile (truncate middle items),
     JSON-LD validates.
4. **Back-to-top button** — `src/components/ui/BackToTop.tsx`
   - Appears after 600px scroll, `aria-label`, smooth scroll, respects
     `prefers-reduced-motion` (global CSS already handles this).
5. **Click-to-call** — add `tel:` link in mobile menu + footer contact block
   (uses the canonical support number already in Footer).
6. **Canonicals sweep** — add `alternates: { canonical }` to homepage,
   about, services (+6 subpages), pricing, contact, quote, blog index,
   case-studies index, careers, faq. (Slugs already carry per-post metadata;
   extend both `generateMetadata` functions with canonical + OG article tags.)

### Phase 2 — Process transparency (code only, ~1 session)

**Goal:** mirror their highest-trust page type with our voice.

1. **New `/process` route** — `src/app/(public)/process/page.tsx`
   - 6 phases adapted to our delivery (Discovery → Design mockup → Build →
     Testing & SEO → Launch → Ongoing management), each with explicit
     **exit criteria** ("this phase is done when…") and anchor ids.
   - Sticky anchor-jump nav (reuse About timeline styling), breadcrumbs,
     canonical, sitemap entry (priority 0.7, monthly).
   - CTA each 2 phases → `/quote` (their Quote CTA converts; ours should too).
2. **Pricing cross-links** — add "Compare plans in detail" anchors from
   pricing FAQ/notes to the existing comparison table; add plan-level
   `makesOffer` microcopy hooks for future Product JSON-LD.

### Phase 3 — Proof assets (needs content, stage behind flags)

**Goal:** match their proof density. **Do not start without the assets.**

1. Case-study screenshots (desktop+mobile) → card art on
   `/case-studies` + detail heroes (`next/image`, blur placeholders).
2. Audio testimonials → accessible `<audio>` player block + transcript
   (transcript doubles as indexable text).
3. Homepage explainer video modal (defer with `next/dynamic`; poster image;
   never autoplay).
4. Content dependencies to request from the business: 4–6 client
   screenshots, 2–3 audio clips + written consent, 60–90s script/video file.

### Phase 4 — Header/footer polish (optional, weigh carefully)

1. Slim utility bar (phone · Client Portal · Support) above navbar —
   **only if** it doesn't dilute the minimal white header; A/B by eye.
2. DMCA/SOC badges — only with live accounts behind them.

### Phase 5 — Verify and lock in

1. `npm run build` green; `tsc`, `lint`, Jest pass.
2. Lighthouse CI (already in pipeline): assert no regression on
   `/`, `/pricing`, `/services` (their stock sliders score poorly; our
   static pages must stay ≥90).
3. Search Console after deploy: submit sitemap, monitor FAQ/Breadcrumb
   enhancements coverage, fix flagged issues within a week.

---

## 5. Global-audience guardrails (apply to every phase)

- No city/country anchoring in new copy (their "Nixa, Missouri" pattern
  becomes our "remote-first, worldwide" pattern).
- Testimonials carry company + role, never city-as-proof.
- Phone/hours blocks always carry an explicit timezone.
- No badges, certifications, or "since XXXX" claims without paperwork.

## 6. Risks and non-goals

- **No cloning**: structure and UX patterns only — all copy, brand, and
  visuals remain BazionWeb originals.
- **Performance budget**: every addition must keep First Load JS ≈ current
  (~87 kB shared) and Lighthouse ≥90; video/audio behind dynamic imports.
- **Free-tier hosting**: new routes are static-first (SSG) — no new
  server load on Render/Neon.
