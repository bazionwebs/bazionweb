# BazionWeb Add-On Catalogue & Configuration Matrix
## Modular Service Extensions, Specifications & Pricing Rules

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**System Purpose:** Single Source of Truth for Quotation Configurator, Proposal Engine & Sales Operations  

---

## 1. Overview & Architectural Role

The BazionWeb Add-On Catalogue bridges standardized baseline packages with bespoke client requirements. Rather than treating scope expansions as unpredictable custom negotiations, every add-on is formalized with:
* Defined functional deliverables.
* Explicit technical implementation stack.
* Fixed unit pricing across domestic (KES) and international (USD) markets.
* Delivery timeline adjustments.
* Dependencies and prerequisite checks.

This document powers both the internal sales estimation engine and the public-facing **Digital Project Configurator** at `/quote`.

---

## 2. Category 1: Website Extensions

| ID | Add-On Name | Kenya (KES) | Intl (USD) | Timeline Delta | Prerequisites | Description & Technical Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ADDON-WEB-PAGE` | **Additional Page** | KSh 2,000 | $50 | +0.5 days | Base package | Design and development of 1 standard responsive page adhering to typography, color tokens, and layout guidelines. |
| `ADDON-WEB-BLOG` | **Dynamic Blog / News Engine** | KSh 7,500 | $150 | +1.5 days | CMS enabled | Headless CMS collection, taxonomy tags, categories, search, pagination, author profiles, and RSS feed generation. |
| `ADDON-WEB-FORM` | **Advanced Multi-Step Form** | KSh 5,000 | $100 | +1 day | Any website | Conditional logic, file attachments, server-side Zod validation, anti-bot protection (Turnstile/reCAPTCHA), and email dispatch. |
| `ADDON-WEB-LANG` | **Multilingual Architecture** | KSh 15,000 | $350 | +3 days | Base package | i18n routing (`/en`, `/sw`, `/fr`), locale switcher, RTL support where needed, and hreflang SEO tags. (Content translation provided by client). |
| `ADDON-WEB-NEWS` | **Newsletter Pipeline Sync** | KSh 5,000 | $100 | +0.5 days | Any website | Embedded subscription forms wired directly to Mailchimp, Brevo, or ConvertKit API with automated welcome autoresponder hook. |
| `ADDON-WEB-DOCS` | **Downloadable Document Hub** | KSh 6,000 | $120 | +1 day | Any website | Filterable PDF/document archive with file-type badges, download counters, and category categorization. |
| `ADDON-WEB-SRCH` | **Instant Live Search** | KSh 7,500 | $150 | +1.5 days | Base package | Client-side debounced search indexing across titles, excerpts, and tags with keyboard navigation shortcuts. |
| `ADDON-WEB-COPY` | **Professional Copywriting** | KSh 10,000 | $250 | +3 days | Base package | 5 pages of commercially persuasive, SEO-optimized copy drafted following brand tone of voice and customer interviews. |

---

## 3. Category 2: E-Commerce Extensions

| ID | Add-On Name | Kenya (KES) | Intl (USD) | Timeline Delta | Prerequisites | Description & Technical Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ADDON-ECO-MPESA`| **M-Pesa STK Push Gateway** | KSh 10,000 | — | +2 days | E-com base | Direct integration with Safaricom Daraja 2.0 / IntaSend API. Instant customer prompt, automated payment verification callback, and order confirmation. |
| `ADDON-ECO-CARD` | **International Card Gateway** | KSh 10,000 | $200 | +2 days | E-com base | Stripe or IntaSend Visa/Mastercard 3D-Secure payment flow with automated fraud scoring and multi-currency settlement. |
| `ADDON-ECO-SHIP` | **Tiered Shipping Matrix** | KSh 7,500 | $150 | +1 day | E-com base | Dynamic delivery fee calculation based on country, county/state, total weight, or free-shipping order thresholds. |
| `ADDON-ECO-INVO` | **Automated PDF Invoicing** | KSh 6,000 | $120 | +1 day | E-com base | Automatic PDF tax invoice generation attached to order confirmation emails with company KRA PIN / tax details. |
| `ADDON-ECO-COUP` | **Coupons & Discount Engine** | KSh 6,000 | $120 | +1 day | E-com base | Percentage, fixed amount, first-order discounts, expiration date rules, and usage frequency caps per customer. |
| `ADDON-ECO-SMS`  | **Branded SMS & Custom Sender ID** | KSh 18,500 | $220 | +3 days | Base / E-com | Safaricom/Airtel/CAK alphanumeric Sender ID registration (up to 11 chars), Africa's Talking / Twilio gateway integration, automated transactional triggers (M-Pesa payment receipts, booking reminders, order alerts) & 500 starter SMS units. |
| `ADDON-ECO-SYNC` | **Inventory & Stock Alerts** | KSh 12,000 | $250 | +2 days | E-com base | Low stock threshold email alerts, automatic out-of-stock badge triggering, and back-in-stock notification signups. |

---

## 4. Category 3: Custom Software & Application Modules

| ID | Add-On Name | Kenya (KES) | Intl (USD) | Timeline Delta | Prerequisites | Description & Technical Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ADDON-SYS-RBAC` | **Enterprise RBAC Engine** | KSh 20,000 | $400 | +3 days | Custom App | Granular role-based permissions matrix (Admin, Manager, Staff, Viewer), row-level data segregation, and permission guards. |
| `ADDON-SYS-SSO`  | **SSO / Google / Microsoft** | KSh 15,000 | $300 | +2 days | Keycloak/Auth | OAuth2 / OpenID Connect single sign-on integration for Google Workspace, Microsoft 365, or corporate active directory. |
| `ADDON-SYS-AUDIT`| **Immutable Audit Logs** | KSh 15,000 | $300 | +2 days | PostgreSQL DB | Automated recording of all user actions (create, update, delete, login, export) with IP address, user agent, and timestamp. |
| `ADDON-SYS-PDF`  | **Complex PDF Report Engine** | KSh 18,000 | $350 | +3 days | Custom App | Server-side Chromium / Puppeteer PDF generation for formal certificates, financial ledgers, or transcripts with watermarks. |
| `ADDON-SYS-API`  | **External REST API Suite** | KSh 25,000 | $500 | +4 days | NestJS API | Versioned REST API endpoints (`/api/v1/`) with API key authentication, rate limiting, and OpenAPI / Swagger documentation. |
| `ADDON-SYS-HOOK` | **Webhook Dispatcher** | KSh 15,000 | $300 | +2 days | Custom App | Outbound webhook event triggers with HMAC signature verification, automatic retries, and delivery logging dashboard. |
| `ADDON-SYS-EXIM` | **Bulk Excel/CSV Import/Export**| KSh 12,000| $250 | +2 days | PostgreSQL DB | Asynchronous streaming import with schema validation, error row reporting, and one-click filtered CSV exports. |

---

## 5. Category 4: Managed Operations & Security Add-Ons

| ID | Add-On Name | Kenya (KES) | Intl (USD) | Frequency | Description & Technical Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ADDON-OPS-HOURS`| **Extra Developer Hours (Pack)** | KSh 15,000 | $220 | One-time | Block of 5 dedicated engineering hours (normally KSh 17,500 / $250) for custom feature work or design updates. |
| `ADDON-OPS-STAG` | **Dedicated Staging Server** | KSh 10,000 | $150 | Annual | Isolated clone of production site protected by HTTP basic auth for testing changes before live deployment. |
| `ADDON-OPS-SEOA` | **Deep Technical SEO Audit** | KSh 15,000 | $300 | One-time | Crawl analysis, 404 cleanup, canonical checks, semantic schema injection, Core Web Vitals remediation plan. |
| `ADDON-OPS-WAF`  | **Cloudflare WAF Custom Rules** | KSh 10,000 | $200 | One-time | Geo-blocking, rate limiting, OWASP top 10 firewall filters, and DDoS threshold tuning. |
| `ADDON-OPS-RUSH` | **Priority Rush Sprint** | +25% | +25% | Per project | Expedites delivery schedule by 30% via allocated priority engineering sprint blocks. |

---

## 6. Technical Data Schema for Digital Project Configurator

To ensure seamless integration between the quotation engine (`apps/web/src/components/pricing` and `/quote`) and backend processing (`apps/api`), all add-ons adhere to this canonical TypeScript interface:

```typescript
export interface AddonDefinition {
  id: string;
  category: 'website' | 'ecommerce' | 'custom_systems' | 'managed_ops';
  name: string;
  shortDescription: string;
  kenyaPrice: number;       // In KES (0 = custom quotation)
  intlPrice: number;        // In USD (0 = custom quotation)
  timelineDays: number;
  prerequisites: string[];  // e.g. ['WEBSITE-BUSINESS', 'WEBSITE-PRO']
  mutuallyExclusiveWith?: string[];
  requiresDiscovery: boolean;
  active: boolean;
}
```

This strict schema guarantees that when a user selects an add-on in the interactive configurator, the application instantly updates estimated costs, validates prerequisites, calculates the delivery timeline, and outputs an itemized proposal draft ready for submission.
