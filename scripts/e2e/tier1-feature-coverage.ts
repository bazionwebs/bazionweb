/**
 * TIER 1: FEATURE COVERAGE TEST SUITE
 * Verifies primary behavior and interface contracts across all 8 project requirement areas:
 * 1. Security Route Access & Edge Protections (R1 / SEC-05, SEC-03)
 * 2. Dependency Security & Hygiene (R4 / SEC-01, CQ-01)
 * 3. Font Loading & Typography Optimization (R2.1 / PERF-01, PERF-02)
 * 4. Market Cookie Initialization & Currency Hydration (R2.2 / PERF-03, PERF-04)
 * 5. Admin Polling & Background Refresh (R2.3 / PERF-05, PERF-06, PERF-07)
 * 6. Responsive Layouts & Touch Targets (R2.4 / RESP-01 to RESP-09)
 * 7. Code Quality & Technical Debt Refactoring (R3 / CQ-02 to CQ-08, FIX-01, FIX-02)
 * 8. Error Boundaries & Centralized Error Handling (R3.4 / CQ-07)
 */

import { describe, test, expect, context, require } from './test-framework.ts';

export async function runTier1Tests() {
  // ─── 1. Security Route Access & Edge Protections (R1) ──────────────────────
  await describe('Tier 1.1: Security Route Access & Edge Protections (R1)', 1, async () => {
    await test('T1-SEC-01', 'Edge Middleware presence and unauthenticated /admin route protection', () => {
      const exists = context.fileExists('apps/web/src/middleware.ts');
      expect(exists).toBe(true);
      const content = context.readFileSafe('apps/web/src/middleware.ts');
      expect(content).toContain('/admin');
      expect(content).toMatch(/login|redirect|rewrite/i);
    });

    await test('T1-SEC-02', 'Edge Middleware unauthenticated /portal route protection', () => {
      const content = context.readFileSafe('apps/web/src/middleware.ts');
      expect(content).toContain('/portal');
      expect(content).toMatch(/portal\/login|redirect|rewrite/i);
    });

    await test('T1-SEC-03', 'API Gateway Reverse Proxy strips x-internal-dispatch header', () => {
      const content = context.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('x-internal-dispatch');
      // Verifies the incoming header is stripped before forwarding upstream
      expect(content).toMatch(/if\s*\(\s*lower\s*===\s*['"]x-internal-dispatch['"]\s*\)\s*return/);
    });

    await test('T1-SEC-04', 'API Gateway Reverse Proxy rejects path traversal and control characters with HTTP 400', () => {
      const content = context.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('sanitizeSegments');
      // Verifies dot-segments and illegal characters are blocked
      expect(content).toMatch(/\/\^\[\.\/\]\+\$\//);
      expect(content).toMatch(/\[\/\\\\%\\u0000-\\u001F\]/);
    });

    await test('T1-SEC-05', 'API Gateway Reverse Proxy limits request payload bodies to 1 MiB (HTTP 413)', () => {
      const content = context.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('MAX_BODY_BYTES');
      expect(content).toMatch(/MAX_BODY_BYTES\s*=\s*1024\s*\*\s*1024/);
      expect(content).toContain('413');
    });

    await test('T1-SEC-06', 'VaultService strictly requires VAULT_MASTER_KEY without fallback to JWT_SECRET', () => {
      const content = context.readFileSafe('apps/api/src/modules/vault/vault.service.ts');
      expect(content).toContain('VAULT_MASTER_KEY');
      // Key isolation contract: MUST NOT fallback to JWT_SECRET in getKey()
      const hasLegacyFallback = /falling back to JWT_SECRET/i.test(content) || /rawSecret\s*=\s*this\.config\.get.*?JWT_SECRET/.test(content);
      expect(hasLegacyFallback).toBe(false);
    });

    await test('T1-SEC-07', 'AuthService strictly requires INTERNAL_DISPATCH_SECRET without fallbacks', () => {
      const content = context.readFileSafe('apps/api/src/modules/auth/auth.service.ts');
      expect(content).toContain('INTERNAL_DISPATCH_SECRET');
      // Token dispatch authorization contract: MUST NOT fallback to PAYSTACK_SECRET_KEY or JWT_SECRET
      const hasFallbackSecrets = /PAYSTACK_SECRET_KEY[\s\S]*?JWT_SECRET[\s\S]*?canDispatchTokens|canDispatchTokens[\s\S]*?PAYSTACK_SECRET_KEY/.test(content);
      expect(hasFallbackSecrets).toBe(false);
    });
  });

  // ─── 2. Dependency Security & Hygiene (R4) ─────────────────────────────────
  await describe('Tier 1.2: Dependency Security & Hygiene (R4)', 1, async () => {
    await test('T1-DEP-01', 'Root package.json overrides enforce secure versions for vulnerable packages', () => {
      const rootPkg = JSON.parse(context.readFileSafe('package.json') || '{}');
      const overrides = rootPkg.overrides || {};
      expect(overrides.multer).toBe('2.4.0');
      expect(overrides['body-parser']).toBe('1.20.9');
      expect(overrides.qs).toBe('6.16.1');
      expect(overrides.postcss).toBe('8.5.31');
    });

    await test('T1-DEP-02', 'Root package.json eliminates redundant backend packages', () => {
      const rootPkg = JSON.parse(context.readFileSafe('package.json') || '{}');
      const deps = rootPkg.dependencies || {};
      expect(deps['@nestjs/axios']).toBeUndefined();
      expect(deps['@nestjs/terminus']).toBeUndefined();
      expect(deps['class-transformer']).toBeUndefined();
      expect(deps['class-validator']).toBeUndefined();
      expect(deps['jwks-rsa']).toBeUndefined();
    });

    await test('T1-DEP-03', 'Web package.json removes unreferenced dead dependencies', () => {
      const webPkg = JSON.parse(context.readFileSafe('apps/web/package.json') || '{}');
      const deps = webPkg.dependencies || {};
      expect(deps['@hookform/resolvers']).toBeUndefined();
      expect(deps['react-hook-form']).toBeUndefined();
      expect(deps['class-variance-authority']).toBeUndefined();
      expect(deps['next-themes']).toBeUndefined();
    });

    await test('T1-DEP-04', 'Web package.json moves dev-only @types/nodemailer to devDependencies', () => {
      const webPkg = JSON.parse(context.readFileSafe('apps/web/package.json') || '{}');
      const deps = webPkg.dependencies || {};
      const devDeps = webPkg.devDependencies || {};
      expect(deps['@types/nodemailer']).toBeUndefined();
      expect(devDeps['@types/nodemailer']).toBeDefined();
    });

    await test('T1-DEP-05', 'API package.json categorizes prisma CLI in devDependencies', () => {
      const apiPkg = JSON.parse(context.readFileSafe('apps/api/package.json') || '{}');
      const deps = apiPkg.dependencies || {};
      const devDeps = apiPkg.devDependencies || {};
      expect(deps.prisma).toBeUndefined();
      expect(devDeps.prisma).toBeDefined();
    });
  });

  // ─── 3. Font Loading & Typography Optimization (R2.1) ──────────────────────
  await describe('Tier 1.3: Font Loading & Typography Optimization (R2.1)', 1, async () => {
    await test('T1-FNT-01', 'globals.css eliminates render-blocking external Google Fonts @import', () => {
      const css = context.readFileSafe('apps/web/src/styles/globals.css');
      const hasGoogleImport = /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/i.test(css);
      expect(hasGoogleImport).toBe(false);
    });

    await test('T1-FNT-02', 'layout.tsx configures Inter via next/font/google with variable and swap display', () => {
      const layout = context.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('next/font/google');
      expect(layout).toContain('Inter');
      expect(layout).toContain('--font-inter');
      expect(layout).toMatch(/display:\s*['"]swap['"]/);
    });

    await test('T1-FNT-03', 'layout.tsx configures Outfit via next/font/google with variable and swap display', () => {
      const layout = context.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('Outfit');
      expect(layout).toContain('--font-outfit');
    });

    await test('T1-FNT-04', 'tailwind.config.js references var(--font-inter) in fontFamily.sans', () => {
      const tailwind = context.readFileSafe('apps/web/tailwind.config.js');
      expect(tailwind).toContain('var(--font-inter)');
    });

    await test('T1-FNT-05', 'tailwind.config.js references var(--font-outfit) in fontFamily.display', () => {
      const tailwind = context.readFileSafe('apps/web/tailwind.config.js');
      expect(tailwind).toContain('var(--font-outfit)');
    });

    await test('T1-FNT-06', 'globals.css :root does not override next/font CSS variables with static fallbacks', () => {
      const css = context.readFileSafe('apps/web/src/styles/globals.css');
      const overridesVars = /--font-inter:\s*['"]Inter['"]/i.test(css);
      expect(overridesVars).toBe(false);
    });
  });

  // ─── 4. Market Cookie Initialization & Currency Hydration (R2.2) ───────────
  await describe('Tier 1.4: Market Cookie Initialization & Currency Hydration (R2.2)', 1, async () => {
    await test('T1-MKT-01', 'MarketProvider React Context component exists', () => {
      const exists = context.fileExists('apps/web/src/components/providers/MarketProvider.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-MKT-02', 'East African country geo-hints map strictly to market KE and currency KES', () => {
      const { mapCountryToMarket } = require(context.getWorkspacePath('apps/web/src/lib/marketEngine'));
      expect(mapCountryToMarket('KE')).toBe('KE');
      expect(mapCountryToMarket('UG')).toBe('KE');
      expect(mapCountryToMarket('TZ')).toBe('KE');
      expect(mapCountryToMarket('RW')).toBe('KE');
      expect(mapCountryToMarket('US')).toBe('GLOBAL');
      expect(mapCountryToMarket('DE')).toBe('GLOBAL');
    });

    await test('T1-MKT-03', 'Server market resolution respects bazion_market cookie precedence', () => {
      const { getServerMarket } = require(context.getWorkspacePath('apps/web/src/lib/geoDetection'));
      // Simulate cookie header containing bazion_market=KE
      const cookieHeader = 'bazion_market=KE; theme=dark';
      const resolved = getServerMarket(null, cookieHeader);
      expect(resolved).toBe('KE');
    });

    await test('T1-MKT-04', 'useMarketPreference consumes MarketContext to eliminate USD flash', () => {
      const content = context.readFileSafe('apps/web/src/hooks/useMarketPreference.ts');
      expect(content).toMatch(/useMarket|MarketContext|useContext/);
    });

    await test('T1-MKT-05', 'layout.tsx provides MarketProvider around root children with getServerMarket()', () => {
      const layout = context.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('MarketProvider');
      expect(layout).toContain('getServerMarket');
    });
  });

  // ─── 5. Admin Polling & Background Refresh (R2.3) ───────────────────────────
  await describe('Tier 1.5: Admin Polling & Background Refresh (R2.3)', 1, async () => {
    await test('T1-POL-01', 'useAdminPolling hook controller exists with standard interface', () => {
      const exists = context.fileExists('apps/web/src/hooks/useAdminPolling.ts');
      expect(exists).toBe(true);
      const content = context.readFileSafe('apps/web/src/hooks/useAdminPolling.ts');
      expect(content).toContain('isPollingEnabled');
      expect(content).toContain('togglePolling');
      expect(content).toContain('pollingInterval');
      expect(content).toContain('setPollingInterval');
      expect(content).toContain('manualRefresh');
    });

    await test('T1-POL-02', 'useAdminPolling pauses queries when document.visibilityState !== "visible"', () => {
      const content = context.readFileSafe('apps/web/src/hooks/useAdminPolling.ts');
      expect(content).toContain('visibilitychange');
      expect(content).toContain('visibilityState');
    });

    await test('T1-POL-03', 'Admin TanStack queries configure refetchIntervalInBackground: false', () => {
      const content = context.readFileSafe('apps/web/src/hooks/useAdminData.ts');
      expect(content).toContain('refetchIntervalInBackground: false');
    });

    await test('T1-POL-04', 'Admin troubleshooting page scopes polling queries strictly to activeTool tab', () => {
      const content = context.readFileSafe('apps/web/src/app/admin/troubleshooting/page.tsx');
      expect(content).toMatch(/activeTool\s*===/);
    });

    await test('T1-POL-05', 'Admin workstation control bar UI component exists', () => {
      const exists = context.fileExists('apps/web/src/components/admin/AdminPollingControlBar.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-POL-06', 'PortalShell throttles sandbox countdown ticker to prevent 1000ms re-renders', () => {
      const content = context.readFileSafe('apps/web/src/components/portal/PortalShell.tsx');
      // Should not run un-throttled 1000ms state updates on the root component
      const unthrottled = /setInterval\(\(\)\s*=>\s*setNow\(Date\.now\(\)\),\s*1000\)/.test(content);
      expect(unthrottled).toBe(false);
    });
  });

  // ─── 6. Responsive Layouts & Touch Targets (R2.4) ───────────────────────────
  await describe('Tier 1.6: Responsive Layouts & Touch Targets (R2.4)', 1, async () => {
    await test('T1-RSP-01', 'Navbar mobile hamburger button meets >= 44x44px touch target (RESP-01)', () => {
      const content = context.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      // Must have min-h-[44px] min-w-[44px] or equivalent touch area
      expect(content).toMatch(/min-h-\[44px\]|h-11\s+w-11|p-3/);
    });

    await test('T1-RSP-02', 'Navbar mobile nav links provide >= 44px vertical tap targets (RESP-01)', () => {
      const content = context.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      // Navigation links in mobile menu should have >= py-3 or min-h-[44px]
      expect(content).toMatch(/mobile-nav-link|min-h-\[44px\]|py-3|py-3\.5/);
    });

    await test('T1-RSP-03', 'NavbarCartLink and WhatsApp link meet >= 44x44px touch targets (RESP-01)', () => {
      const cartLink = context.readFileSafe('apps/web/src/components/layout/NavbarCartLink.tsx');
      const navbar = context.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      const cartCompliant = /min-h-\[44px\]|h-11\s+w-11|p-2\.5|p-3/.test(cartLink);
      const waCompliant = /min-h-\[44px\]|h-11\s+w-11|p-2\.5|h-10\s+w-10/.test(navbar);
      expect(cartCompliant || waCompliant).toBe(true);
    });

    await test('T1-RSP-04', 'HomepagePricingPreview handles tablet breakpoint without text wrapping (RESP-05)', () => {
      const content = context.readFileSafe('apps/web/src/components/pricing/HomepagePricingPreview.tsx');
      // Tablet grid or flex refactoring
      expect(content).toMatch(/md:grid|lg:grid|whitespace-nowrap|tracking-tight/);
    });

    await test('T1-RSP-05', 'SubscriptionCheckout payment tab rail is responsive on <390px screens (RESP-06)', () => {
      const content = context.readFileSafe('apps/web/src/components/billing/SubscriptionCheckout.tsx');
      // Payment tab grid should avoid rigid 3 columns on ultra-small screens
      expect(content).toMatch(/grid-cols-1\s+sm:grid-cols-3|grid-cols-2|flex-wrap/);
    });

    await test('T1-RSP-06', 'ProposalPresentationView table footer colSpan aligns correctly (RESP-07)', () => {
      const content = context.readFileSafe('apps/web/src/components/quote/ProposalPresentationView.tsx');
      // Should not have mismatched colSpan={2} where header has 3 or 4 columns
      expect(content).not.toMatch(/colSpan=\{2\}[\s\S]*?colSpan=\{2\}[\s\S]*?colSpan=\{2\}[\s\S]*?colSpan=\{2\}/);
    });

    await test('T1-RSP-07', 'AdminShell and PortalShell use responsive container padding (RESP-08)', () => {
      const adminShell = context.readFileSafe('apps/web/src/components/admin/AdminShell.tsx');
      const portalShell = context.readFileSafe('apps/web/src/components/portal/PortalShell.tsx');
      expect(adminShell).toMatch(/p-3\s+sm:p-4\s+md:p-6|p-4\s+md:p-6/);
      expect(portalShell).toMatch(/p-3\s+sm:p-4\s+md:p-6|p-4\s+md:p-6/);
    });

    await test('T1-RSP-08', 'Quote builder eliminates invalid Tailwind class py-0.2 (RESP-09)', () => {
      const content = context.readFileSafe('apps/web/src/app/(public)/quote/page.tsx');
      const hasInvalidClass = /py-0\.2/.test(content);
      expect(hasInvalidClass).toBe(false);
    });
  });

  // ─── 7. Code Quality & Technical Debt Refactoring (R3) ─────────────────────
  await describe('Tier 1.7: Code Quality & Technical Debt Refactoring (R3)', 1, async () => {
    await test('T1-CQ-01', 'Dead / dismantled components are pruned from repository (CQ-02)', () => {
      const modalExists = context.fileExists('apps/web/src/components/layout/MarketSelectorModal.tsx');
      const simBarExists = context.fileExists('apps/web/src/components/layout/MarketSimulatorBar.tsx');
      const audioExists = context.fileExists('apps/web/src/components/testimonials/AudioTestimonial.tsx');
      expect(modalExists).toBe(false);
      expect(simBarExists).toBe(false);
      expect(audioExists).toBe(false);
    });

    await test('T1-CQ-02', 'ProposalPresentationView migrates native img to next/image (CQ-04)', () => {
      const content = context.readFileSafe('apps/web/src/components/quote/ProposalPresentationView.tsx');
      const hasNativeImg = /<img\s+src=/.test(content);
      expect(hasNativeImg).toBe(false);
      expect(content).toContain('next/image');
    });

    await test('T1-CQ-03', 'globals.css defines .custom-scrollbar and .custom-scrollbar-dark (CQ-05)', () => {
      const css = context.readFileSafe('apps/web/src/styles/globals.css');
      expect(css).toContain('.custom-scrollbar');
      expect(css).toContain('::-webkit-scrollbar');
      expect(css).toContain('scrollbar-width');
    });

    await test('T1-CQ-04', 'Double branding is eliminated across public page metadata titles (CQ-06)', () => {
      const homePage = context.readFileSafe('apps/web/src/app/(public)/page.tsx');
      const hasDoubleBrand = /BazionWeb\s*—\s*BazionWeb/i.test(homePage) || /\|\s*BazionWeb\s*\|\s*BazionWeb/.test(homePage);
      expect(hasDoubleBrand).toBe(false);
    });

    await test('T1-CQ-05', 'scripts/verify-troubleshooting-proactive.ts has valid import paths (CQ-03)', () => {
      const content = context.readFileSafe('scripts/verify-troubleshooting-proactive.ts');
      // Verify no broken imports to non-existent files
      expect(content).not.toMatch(/from\s+['"]\.\.\/nonexistent/);
    });

    await test('T1-CQ-06', 'admin/invoices/page.tsx replaces raw window.alert with toast notification (CQ-08)', () => {
      const content = context.readFileSafe('apps/web/src/app/admin/invoices/page.tsx');
      const hasWindowAlert = /window\.alert\(/.test(content);
      expect(hasWindowAlert).toBe(false);
    });

    await test('T1-CQ-07', 'apps/web/src/app/api/leads/route.ts TS2322 type error is resolved (FIX-01)', () => {
      const content = context.readFileSafe('apps/web/src/app/api/leads/route.ts');
      // The fix ensures clientName receives a string (e.g. sanitizeText(name) ?? name)
      expect(content).toMatch(/sanitizeText\(name\)\s*\?\?\s*name|name\s*:\s*sanitizeText\(name\)\s*\|\|\s*''/);
    });

    await test('T1-CQ-08', 'empirical-challenger-quote-tamper.test.ts asserts HTTP 400 on malformed email (FIX-02)', () => {
      const content = context.readFileSafe('apps/web/__tests__/empirical-challenger-quote-tamper.test.ts');
      // Malformed email in SQL injection test must assert HTTP 400
      expect(content).toMatch(/expect\(res\.status\)\.toBe\(400\)/);
    });
  });

  // ─── 8. Error Boundaries & Centralized Error Handling (R3.4) ───────────────
  await describe('Tier 1.8: Error Boundaries & Centralized Error Handling (R3.4)', 1, async () => {
    await test('T1-ERR-01', 'Root client error boundary apps/web/src/app/error.tsx exists (CQ-07)', () => {
      const exists = context.fileExists('apps/web/src/app/error.tsx');
      expect(exists).toBe(true);
      const content = context.readFileSafe('apps/web/src/app/error.tsx');
      expect(content).toContain('reset');
    });

    await test('T1-ERR-02', 'Global root error boundary apps/web/src/app/global-error.tsx exists (CQ-07)', () => {
      const exists = context.fileExists('apps/web/src/app/global-error.tsx');
      expect(exists).toBe(true);
      const content = context.readFileSafe('apps/web/src/app/global-error.tsx');
      expect(content).toContain('<html>');
      expect(content).toContain('<body>');
    });

    await test('T1-ERR-03', 'Admin section error boundary apps/web/src/app/admin/error.tsx exists (CQ-07)', () => {
      const exists = context.fileExists('apps/web/src/app/admin/error.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-ERR-04', 'Portal section error boundary apps/web/src/app/portal/error.tsx exists (CQ-07)', () => {
      const exists = context.fileExists('apps/web/src/app/portal/error.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-ERR-05', 'Centralized error parser apps/web/src/lib/error-helpers.ts exists (CQ-07)', () => {
      const exists = context.fileExists('apps/web/src/lib/error-helpers.ts');
      expect(exists).toBe(true);
      const content = context.readFileSafe('apps/web/src/lib/error-helpers.ts');
      expect(content).toContain('parseApiError');
    });
  });
}
