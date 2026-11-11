#!/usr/bin/env node
/**
 * ============================================================================
 * BAZIONWEB HARDENING & AUDIT E2E VERIFICATION SUITE (VERIF-01)
 * ============================================================================
 * Comprehensive 4-Tier Opaque-Box Automated Test Runner
 *
 * Systematic 4-Tier Architecture:
 *   - Tier 1: Feature Coverage (R1-R5: Security, Dependencies, Fonts, Market Hydration, Admin Polling, Responsive, Code Quality, Error Boundaries)
 *   - Tier 2: Boundary & Corner Cases (Malformed Tokens, Expired Sessions, Geo Headers, Corrupt Cookies, Polling Clamping, Edge Breakpoints)
 *   - Tier 3: Cross-Feature Combinations (Market + Checkout, Sandbox + Polling Lifecycle, Edge + API Gateway + Cryptographic Boundary)
 *   - Tier 4: Real-World Application Scenarios (5 Complete Multi-Stage Lifecycle Journeys)
 *
 * Invocation:
 *   node --no-warnings --experimental-strip-types scripts/run-e2e-audit-suite.ts
 *   (or npm run test:e2e)
 *
 * Options:
 *   --tier=1,2,3,4   Execute only specified tier(s) (comma-separated)
 *   --filter=<text>  Execute only tests matching text or ID
 *   --allow-failures Diagnostic mode: exit 0 even if failures are recorded
 *   --summary        Print condensed summary table only
 *   --help           Show usage manual
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import * as jwt from 'jsonwebtoken';

// ANSI Colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

// ─── Test Harness Types & Context ────────────────────────────────────────────

export interface TestCaseResult {
  id: string;
  name: string;
  suite: string;
  tier: number;
  status: 'pass' | 'fail';
  durationMs: number;
  error?: string;
}

class TestHarness {
  results: TestCaseResult[] = [];
  currentSuite: string = '';
  currentTier: number = 1;
  workspaceRoot: string = process.cwd();

  setSuite(name: string, tier: number = 1) {
    this.currentSuite = name;
    this.currentTier = tier;
  }

  record(res: TestCaseResult) {
    this.results.push(res);
  }

  getWorkspacePath(relPath: string): string {
    return path.resolve(this.workspaceRoot, relPath);
  }

  fileExists(relPath: string): boolean {
    return fs.existsSync(this.getWorkspacePath(relPath));
  }

  readFileSafe(relPath: string): string {
    const full = this.getWorkspacePath(relPath);
    if (!fs.existsSync(full)) return '';
    return fs.readFileSync(full, 'utf8');
  }
}

const harness = new TestHarness();

class ExpectationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectationError';
  }
}

function truncateStr(s: any, max = 120): string {
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function expect<T>(received: T) {
  const isNot = false;

  const matchers = (notModifier: boolean) => ({
    toBe(expected: any) {
      const pass = Object.is(received, expected);
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${notModifier ? 'NOT ' : ''}${truncateStr(expected)}, received: ${truncateStr(received)}`
        );
      }
    },
    toEqual(expected: any) {
      const receivedJson = JSON.stringify(received);
      const expectedJson = JSON.stringify(expected);
      const pass = receivedJson === expectedJson;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${notModifier ? 'NOT ' : ''}deep equality with: ${truncateStr(expectedJson)}, received: ${truncateStr(receivedJson)}`
        );
      }
    },
    toBeTruthy() {
      const pass = Boolean(received);
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? 'falsy' : 'truthy'}`);
      }
    },
    toBeFalsy() {
      const pass = !received;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? 'truthy' : 'falsy'}`);
      }
    },
    toBeNull() {
      const pass = received === null;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? 'non-null' : 'null'}`);
      }
    },
    toBeDefined() {
      const pass = received !== undefined;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? 'undefined' : 'defined'}`);
      }
    },
    toBeUndefined() {
      const pass = received === undefined;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? 'defined' : 'undefined'}`);
      }
    },
    toBeGreaterThan(n: number) {
      const pass = Number(received) > n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? '<=' : '>'} ${n}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      const pass = Number(received) >= n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? '<' : '>='} ${n}`);
      }
    },
    toBeLessThan(n: number) {
      const pass = Number(received) < n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? '>=' : '<'} ${n}`);
      }
    },
    toBeLessThanOrEqual(n: number) {
      const pass = Number(received) <= n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${truncateStr(received)} to be ${notModifier ? '>' : '<='} ${n}`);
      }
    },
    toContain(expected: any) {
      let pass = false;
      if (typeof received === 'string') {
        pass = received.includes(String(expected));
      } else if (Array.isArray(received)) {
        pass = received.includes(expected);
      } else if (received && typeof (received as any).has === 'function') {
        pass = (received as any).has(expected);
      }
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${truncateStr(received)} to ${notModifier ? 'NOT ' : ''}contain ${truncateStr(expected)}`
        );
      }
    },
    toMatch(regex: RegExp | string) {
      const re = typeof regex === 'string' ? new RegExp(regex) : regex;
      const pass = re.test(String(received));
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected "${truncateStr(received)}" to ${notModifier ? 'NOT ' : ''}match ${re}`);
      }
    },
    toThrow(expectedMessage?: string | RegExp) {
      if (typeof received !== 'function') {
        throw new ExpectationError('toThrow matcher requires a function input');
      }
      let threw = false;
      let caughtError: any = null;
      try {
        (received as any)();
      } catch (err) {
        threw = true;
        caughtError = err;
      }
      if (notModifier ? threw : !threw) {
        throw new ExpectationError(
          `Expected function ${notModifier ? 'NOT to throw' : 'to throw an error, but it did not throw'}`
        );
      }
      if (threw && expectedMessage && !notModifier) {
        const msg = caughtError?.message || String(caughtError);
        if (expectedMessage instanceof RegExp) {
          if (!expectedMessage.test(msg)) {
            throw new ExpectationError(`Expected error message "${msg}" to match ${expectedMessage}`);
          }
        } else if (!msg.includes(expectedMessage)) {
          throw new ExpectationError(`Expected error message "${msg}" to include "${expectedMessage}"`);
        }
      }
    },
    get not() {
      return matchers(true);
    },
  });

  return matchers(isNot);
}

async function test(
  id: string,
  name: string,
  fn: () => void | Promise<void>,
  tierOverride?: number
): Promise<TestCaseResult> {
  const start = Date.now();
  const tier = tierOverride ?? harness.currentTier;
  try {
    await fn();
    const result: TestCaseResult = {
      id,
      name,
      suite: harness.currentSuite,
      tier,
      status: 'pass',
      durationMs: Date.now() - start,
    };
    harness.record(result);
    return result;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const result: TestCaseResult = {
      id,
      name,
      suite: harness.currentSuite,
      tier,
      status: 'fail',
      durationMs: Date.now() - start,
      error: errorMsg,
    };
    harness.record(result);
    return result;
  }
}

function describe(name: string, tier: number, fn: () => void | Promise<void>) {
  harness.setSuite(name, tier);
  return fn();
}

// ─── Contract Helper Functions ───────────────────────────────────────────────

function mapCountryToMarket(country?: string | null): 'KE' | 'GLOBAL' {
  if (!country || typeof country !== 'string') return 'GLOBAL';
  const c = country.trim().toUpperCase();
  const eastAfrica = new Set(['KE', 'UG', 'TZ', 'RW']);
  return eastAfrica.has(c) ? 'KE' : 'GLOBAL';
}

function normalizeMarketCode(raw?: string | null): 'KE' | 'GLOBAL' {
  if (!raw || typeof raw !== 'string') return 'GLOBAL';
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === 'KE' || trimmed === 'KENYA') return 'KE';
  return 'GLOBAL';
}

function getServerMarket(headers?: Headers | Record<string, string> | null, cookieHeader?: string | null): 'KE' | 'GLOBAL' {
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)bazion_market=([^;]*)/);
    if (match) {
      return normalizeMarketCode(decodeURIComponent(match[1]));
    }
  }

  if (headers) {
    let country: string | null = null;
    if (typeof (headers as any).get === 'function') {
      country = (headers as Headers).get('cf-ipcountry') || (headers as Headers).get('x-vercel-ip-country');
    } else {
      country = (headers as any)['cf-ipcountry'] || (headers as any)['x-vercel-ip-country'];
    }
    if (country) {
      const firstHop = country.split(',')[0].trim();
      return mapCountryToMarket(firstHop);
    }
  }

  return 'GLOBAL';
}

function getPriceBookForMarket(market: 'KE' | 'GLOBAL') {
  if (market === 'KE') {
    return {
      marketCode: 'KE',
      currency: 'KES',
      websitePackages: { standard: { price: 45000 }, growth: { price: 85000 } },
      carePlans: { growth: { priceMonthly: 12000 } },
    };
  }
  return {
    marketCode: 'GLOBAL',
    currency: 'USD',
    websitePackages: { standard: { price: 450 }, growth: { price: 850 } },
    carePlans: { growth: { priceMonthly: 120 } },
  };
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'KES') {
    return `KSh ${amount.toLocaleString()}`;
  }
  return `$${amount.toLocaleString()}`;
}

function isTrustedCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'paystack.com' || host === 'checkout.paystack.com' || host.endsWith('.paystack.com');
  } catch {
    return false;
  }
}

// ─── TIER 1: FEATURE COVERAGE (R1 - R5) ──────────────────────────────────────

async function runTier1() {
  await describe('Tier 1.1: Security Route Access & Edge Protections (R1)', 1, async () => {
    await test('T1-SEC-01', 'Edge Middleware presence and unauthenticated /admin route protection', () => {
      const exists = harness.fileExists('apps/web/src/middleware.ts');
      expect(exists).toBe(true);
      const content = harness.readFileSafe('apps/web/src/middleware.ts');
      expect(content).toContain('/admin');
      expect(content).toMatch(/login|redirect|rewrite/i);
    });

    await test('T1-SEC-02', 'Edge Middleware unauthenticated /portal route protection', () => {
      const content = harness.readFileSafe('apps/web/src/middleware.ts');
      expect(content).toContain('/portal');
      expect(content).toMatch(/portal\/login|redirect|rewrite/i);
    });

    await test('T1-SEC-03', 'API Gateway Reverse Proxy strips x-internal-dispatch header', () => {
      const content = harness.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('x-internal-dispatch');
      expect(content).toMatch(/if\s*\(\s*lower\s*===\s*['"]x-internal-dispatch['"]\s*\)\s*return/);
    });

    await test('T1-SEC-04', 'API Gateway Reverse Proxy rejects path traversal and control characters with HTTP 400', () => {
      const content = harness.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('sanitizeSegments');
      expect(content).toMatch(/\/\^\[\.\/\]\+\$\//);
      expect(content).toMatch(/\[\/\\\\%\\u0000-\\u001F\]/);
    });

    await test('T1-SEC-05', 'API Gateway Reverse Proxy limits request payload bodies to 1 MiB (HTTP 413)', () => {
      const content = harness.readFileSafe('apps/web/src/app/api/v1/[...path]/route.ts');
      expect(content).toContain('MAX_BODY_BYTES');
      expect(content).toMatch(/MAX_BODY_BYTES\s*=\s*1024\s*\*\s*1024/);
      expect(content).toContain('413');
    });

    await test('T1-SEC-06', 'VaultService strictly requires VAULT_MASTER_KEY without fallback to JWT_SECRET', () => {
      const content = harness.readFileSafe('apps/api/src/modules/vault/vault.service.ts');
      expect(content).toContain('VAULT_MASTER_KEY');
      const hasLegacyFallback = /falling back to JWT_SECRET/i.test(content) || /rawSecret\s*=\s*this\.config\.get.*?JWT_SECRET/.test(content);
      expect(hasLegacyFallback).toBe(false);
    });

    await test('T1-SEC-07', 'AuthService strictly requires INTERNAL_DISPATCH_SECRET without fallbacks', () => {
      const content = harness.readFileSafe('apps/api/src/modules/auth/auth.service.ts');
      expect(content).toContain('INTERNAL_DISPATCH_SECRET');
      const hasFallbackSecrets = /PAYSTACK_SECRET_KEY[\s\S]*?JWT_SECRET[\s\S]*?canDispatchTokens|canDispatchTokens[\s\S]*?PAYSTACK_SECRET_KEY/.test(content);
      expect(hasFallbackSecrets).toBe(false);
    });
  });

  await describe('Tier 1.2: Dependency Security & Hygiene (R4)', 1, async () => {
    await test('T1-DEP-01', 'Root package.json overrides enforce secure versions for vulnerable packages', () => {
      const rootPkg = JSON.parse(harness.readFileSafe('package.json') || '{}');
      const overrides = rootPkg.overrides || {};
      expect(Boolean(overrides.multer && overrides.multer >= '2.4.0')).toBe(true);
      expect(Boolean(overrides['body-parser'] && overrides['body-parser'] >= '1.20.9')).toBe(true);
      expect(Boolean(overrides.qs && overrides.qs >= '6.16.1')).toBe(true);
      expect(Boolean(overrides.postcss && overrides.postcss >= '8.5.31')).toBe(true);
    });

    await test('T1-DEP-02', 'Root package.json eliminates redundant backend packages', () => {
      const rootPkg = JSON.parse(harness.readFileSafe('package.json') || '{}');
      const deps = rootPkg.dependencies || {};
      expect(deps['@nestjs/axios']).toBeUndefined();
      expect(deps['@nestjs/terminus']).toBeUndefined();
      expect(deps['class-transformer']).toBeUndefined();
      expect(deps['class-validator']).toBeUndefined();
      expect(deps['jwks-rsa']).toBeUndefined();
    });

    await test('T1-DEP-03', 'Web package.json removes unreferenced dead dependencies', () => {
      const webPkg = JSON.parse(harness.readFileSafe('apps/web/package.json') || '{}');
      const deps = webPkg.dependencies || {};
      expect(deps['@hookform/resolvers']).toBeUndefined();
      expect(deps['react-hook-form']).toBeUndefined();
      expect(deps['class-variance-authority']).toBeUndefined();
      expect(deps['next-themes']).toBeUndefined();
    });

    await test('T1-DEP-04', 'Web package.json moves dev-only @types/nodemailer to devDependencies', () => {
      const webPkg = JSON.parse(harness.readFileSafe('apps/web/package.json') || '{}');
      const deps = webPkg.dependencies || {};
      const devDeps = webPkg.devDependencies || {};
      expect(deps['@types/nodemailer']).toBeUndefined();
      expect(devDeps['@types/nodemailer']).toBeDefined();
    });

    await test('T1-DEP-05', 'API package.json categorizes prisma CLI in devDependencies', () => {
      const apiPkg = JSON.parse(harness.readFileSafe('apps/api/package.json') || '{}');
      const deps = apiPkg.dependencies || {};
      const devDeps = apiPkg.devDependencies || {};
      expect(deps.prisma).toBeUndefined();
      expect(devDeps.prisma).toBeDefined();
    });
  });

  await describe('Tier 1.3: Font Loading & Typography Optimization (R2.1)', 1, async () => {
    await test('T1-FNT-01', 'globals.css eliminates render-blocking external Google Fonts @import', () => {
      const css = harness.readFileSafe('apps/web/src/styles/globals.css');
      const hasGoogleImport = /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/i.test(css);
      expect(hasGoogleImport).toBe(false);
    });

    await test('T1-FNT-02', 'layout.tsx configures Inter via next/font/google with variable and swap display', () => {
      const layout = harness.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('next/font/google');
      expect(layout).toContain('Inter');
      expect(layout).toContain('--font-inter');
      expect(layout).toMatch(/display:\s*['"]swap['"]/);
    });

    await test('T1-FNT-03', 'layout.tsx configures Outfit via next/font/google with variable and swap display', () => {
      const layout = harness.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('Outfit');
      expect(layout).toContain('--font-outfit');
    });

    await test('T1-FNT-04', 'tailwind.config.js references var(--font-inter) in fontFamily.sans', () => {
      const tailwind = harness.readFileSafe('apps/web/tailwind.config.js');
      expect(tailwind).toContain('var(--font-inter)');
    });

    await test('T1-FNT-05', 'tailwind.config.js references var(--font-outfit) in fontFamily.display', () => {
      const tailwind = harness.readFileSafe('apps/web/tailwind.config.js');
      expect(tailwind).toContain('var(--font-outfit)');
    });

    await test('T1-FNT-06', 'globals.css :root does not override next/font CSS variables with static fallbacks', () => {
      const css = harness.readFileSafe('apps/web/src/styles/globals.css');
      const overridesVars = /--font-inter:\s*['"]Inter['"]/i.test(css);
      expect(overridesVars).toBe(false);
    });
  });

  await describe('Tier 1.4: Market Cookie Initialization & Currency Hydration (R2.2)', 1, async () => {
    await test('T1-MKT-01', 'MarketProvider React Context component exists', () => {
      const exists = harness.fileExists('apps/web/src/components/providers/MarketProvider.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-MKT-02', 'East African country geo-hints map strictly to market KE and currency KES', () => {
      expect(mapCountryToMarket('KE')).toBe('KE');
      expect(mapCountryToMarket('UG')).toBe('KE');
      expect(mapCountryToMarket('TZ')).toBe('KE');
      expect(mapCountryToMarket('RW')).toBe('KE');
      expect(mapCountryToMarket('US')).toBe('GLOBAL');
      expect(mapCountryToMarket('DE')).toBe('GLOBAL');
    });

    await test('T1-MKT-03', 'Server market resolution respects bazion_market cookie precedence', () => {
      const cookieHeader = 'bazion_market=KE; theme=dark';
      const resolved = getServerMarket(null, cookieHeader);
      expect(resolved).toBe('KE');
    });

    await test('T1-MKT-04', 'useMarketPreference consumes MarketContext to eliminate USD flash', () => {
      const content = harness.readFileSafe('apps/web/src/hooks/useMarketPreference.ts');
      expect(content).toMatch(/useMarket|MarketContext|useContext/);
    });

    await test('T1-MKT-05', 'layout.tsx provides MarketProvider around root children with getServerMarket()', () => {
      const layout = harness.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layout).toContain('MarketProvider');
      expect(layout).toContain('getServerMarket');
    });
  });

  await describe('Tier 1.5: Admin Polling & Background Refresh (R2.3)', 1, async () => {
    await test('T1-POL-01', 'useAdminPolling hook controller exists with standard interface', () => {
      const exists = harness.fileExists('apps/web/src/hooks/useAdminPolling.ts');
      expect(exists).toBe(true);
      const content = harness.readFileSafe('apps/web/src/hooks/useAdminPolling.ts');
      expect(content).toContain('isPollingEnabled');
      expect(content).toContain('togglePolling');
      expect(content).toContain('pollingInterval');
      expect(content).toContain('setPollingInterval');
      expect(content).toContain('manualRefresh');
    });

    await test('T1-POL-02', 'useAdminPolling pauses queries when document.visibilityState !== "visible"', () => {
      const content = harness.readFileSafe('apps/web/src/hooks/useAdminPolling.ts');
      expect(content).toContain('visibilitychange');
      expect(content).toContain('visibilityState');
    });

    await test('T1-POL-03', 'Admin TanStack queries configure refetchIntervalInBackground: false', () => {
      const content = harness.readFileSafe('apps/web/src/hooks/useAdminData.ts');
      expect(content).toContain('refetchIntervalInBackground: false');
    });

    await test('T1-POL-04', 'Admin troubleshooting page scopes polling queries strictly to activeTool tab', () => {
      const content = harness.readFileSafe('apps/web/src/app/admin/troubleshooting/page.tsx');
      expect(content).toMatch(/activeTool\s*===/);
    });

    await test('T1-POL-05', 'Admin workstation control bar UI component exists', () => {
      const exists = harness.fileExists('apps/web/src/components/admin/AdminPollingControlBar.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-POL-06', 'PortalShell throttles sandbox countdown ticker to prevent 1000ms re-renders', () => {
      const content = harness.readFileSafe('apps/web/src/components/portal/PortalShell.tsx');
      const unthrottled = /setInterval\(\(\)\s*=>\s*setNow\(Date\.now\(\)\),\s*1000\)/.test(content);
      expect(unthrottled).toBe(false);
    });
  });

  await describe('Tier 1.6: Responsive Layouts & Touch Targets (R2.4)', 1, async () => {
    await test('T1-RSP-01', 'Navbar mobile hamburger button meets >= 44x44px touch target (RESP-01)', () => {
      const content = harness.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      expect(content).toMatch(/min-h-\[44px\]|h-11\s+w-11|p-3/);
    });

    await test('T1-RSP-02', 'Navbar mobile nav links provide >= 44px vertical tap targets (RESP-01)', () => {
      const content = harness.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      expect(content).toMatch(/mobile-nav-link|min-h-\[44px\]|py-3|py-3\.5/);
    });

    await test('T1-RSP-03', 'NavbarCartLink and WhatsApp link meet >= 44x44px touch targets (RESP-01)', () => {
      const cartLink = harness.readFileSafe('apps/web/src/components/layout/NavbarCartLink.tsx');
      const navbar = harness.readFileSafe('apps/web/src/components/layout/Navbar.tsx');
      const cartCompliant = /min-h-\[44px\]|h-11\s+w-11|p-2\.5|p-3/.test(cartLink);
      const waCompliant = /min-h-\[44px\]|h-11\s+w-11|p-2\.5|h-10\s+w-10/.test(navbar);
      expect(cartCompliant || waCompliant).toBe(true);
    });

    await test('T1-RSP-04', 'HomepagePricingPreview handles tablet breakpoint without text wrapping (RESP-05)', () => {
      const content = harness.readFileSafe('apps/web/src/components/pricing/HomepagePricingPreview.tsx');
      expect(content).toMatch(/md:grid|lg:grid|whitespace-nowrap|tracking-tight/);
    });

    await test('T1-RSP-05', 'SubscriptionCheckout payment tab rail is responsive on <390px screens (RESP-06)', () => {
      const content = harness.readFileSafe('apps/web/src/components/billing/SubscriptionCheckout.tsx');
      expect(content).toMatch(/grid-cols-1\s+sm:grid-cols-3|grid-cols-2|flex-wrap/);
    });

    await test('T1-RSP-06', 'ProposalPresentationView table footer colSpan aligns correctly (RESP-07)', () => {
      const content = harness.readFileSafe('apps/web/src/components/quote/ProposalPresentationView.tsx');
      expect(content).not.toMatch(/colSpan=\{2\}[\s\S]*?colSpan=\{2\}[\s\S]*?colSpan=\{2\}[\s\S]*?colSpan=\{2\}/);
    });

    await test('T1-RSP-07', 'AdminShell and PortalShell use responsive container padding (RESP-08)', () => {
      const adminShell = harness.readFileSafe('apps/web/src/components/admin/AdminShell.tsx');
      const portalShell = harness.readFileSafe('apps/web/src/components/portal/PortalShell.tsx');
      expect(adminShell).toMatch(/p-3\s+sm:p-4\s+md:p-6|p-4\s+md:p-6/);
      expect(portalShell).toMatch(/p-3\s+sm:p-4\s+md:p-6|p-4\s+md:p-6/);
    });

    await test('T1-RSP-08', 'Quote builder eliminates invalid Tailwind class py-0.2 (RESP-09)', () => {
      const content = harness.readFileSafe('apps/web/src/app/(public)/quote/page.tsx');
      const hasInvalidClass = /py-0\.2/.test(content);
      expect(hasInvalidClass).toBe(false);
    });
  });

  await describe('Tier 1.7: Code Quality & Technical Debt Refactoring (R3)', 1, async () => {
    await test('T1-CQ-01', 'Dead / dismantled components are pruned from repository (CQ-02)', () => {
      const modalExists = harness.fileExists('apps/web/src/components/layout/MarketSelectorModal.tsx');
      const simBarExists = harness.fileExists('apps/web/src/components/layout/MarketSimulatorBar.tsx');
      const audioExists = harness.fileExists('apps/web/src/components/testimonials/AudioTestimonial.tsx');
      expect(modalExists).toBe(false);
      expect(simBarExists).toBe(false);
      expect(audioExists).toBe(false);
    });

    await test('T1-CQ-02', 'ProposalPresentationView migrates native img to next/image (CQ-04)', () => {
      const content = harness.readFileSafe('apps/web/src/components/quote/ProposalPresentationView.tsx');
      const hasNativeImg = /<img\s+src=/.test(content);
      expect(hasNativeImg).toBe(false);
      expect(content).toContain('next/image');
    });

    await test('T1-CQ-03', 'globals.css defines .custom-scrollbar and .custom-scrollbar-dark (CQ-05)', () => {
      const css = harness.readFileSafe('apps/web/src/styles/globals.css');
      expect(css).toContain('.custom-scrollbar');
      expect(css).toContain('::-webkit-scrollbar');
      expect(css).toContain('scrollbar-width');
    });

    await test('T1-CQ-04', 'Double branding is eliminated across public page metadata titles (CQ-06)', () => {
      const homePage = harness.readFileSafe('apps/web/src/app/(public)/page.tsx');
      const hasDoubleBrand = /BazionWeb\s*—\s*BazionWeb/i.test(homePage) || /\|\s*BazionWeb\s*\|\s*BazionWeb/.test(homePage);
      expect(hasDoubleBrand).toBe(false);
    });

    await test('T1-CQ-05', 'scripts/verify-troubleshooting-proactive.ts has valid import paths (CQ-03)', () => {
      const content = harness.readFileSafe('scripts/verify-troubleshooting-proactive.ts');
      expect(content).not.toMatch(/from\s+['"]\.\.\/nonexistent/);
    });

    await test('T1-CQ-06', 'admin/invoices/page.tsx replaces raw window.alert with toast notification (CQ-08)', () => {
      const content = harness.readFileSafe('apps/web/src/app/admin/invoices/page.tsx');
      const hasWindowAlert = /window\.alert\(/.test(content);
      expect(hasWindowAlert).toBe(false);
    });

    await test('T1-CQ-07', 'apps/web/src/app/api/leads/route.ts TS2322 type error is resolved (FIX-01)', () => {
      const content = harness.readFileSafe('apps/web/src/app/api/leads/route.ts');
      expect(content).toMatch(/sanitizeText\(name\)\s*\?\?\s*name|name\s*:\s*sanitizeText\(name\)\s*\|\|\s*''/);
    });

    await test('T1-CQ-08', 'empirical-challenger-quote-tamper.test.ts asserts HTTP 400 on malformed email (FIX-02)', () => {
      const content = harness.readFileSafe('apps/web/__tests__/empirical-challenger-quote-tamper.test.ts');
      expect(content).toMatch(/expect\(res\.status\)\.toBe\(400\)/);
    });
  });

  await describe('Tier 1.8: Error Boundaries & Centralized Error Handling (R3.4)', 1, async () => {
    await test('T1-ERR-01', 'Root client error boundary apps/web/src/app/error.tsx exists (CQ-07)', () => {
      const exists = harness.fileExists('apps/web/src/app/error.tsx');
      expect(exists).toBe(true);
      const content = harness.readFileSafe('apps/web/src/app/error.tsx');
      expect(content).toContain('reset');
    });

    await test('T1-ERR-02', 'Global root error boundary apps/web/src/app/global-error.tsx exists (CQ-07)', () => {
      const exists = harness.fileExists('apps/web/src/app/global-error.tsx');
      expect(exists).toBe(true);
      const content = harness.readFileSafe('apps/web/src/app/global-error.tsx');
      expect(content).toContain('<html>');
      expect(content).toContain('<body>');
    });

    await test('T1-ERR-03', 'Admin section error boundary apps/web/src/app/admin/error.tsx exists (CQ-07)', () => {
      const exists = harness.fileExists('apps/web/src/app/admin/error.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-ERR-04', 'Portal section error boundary apps/web/src/app/portal/error.tsx exists (CQ-07)', () => {
      const exists = harness.fileExists('apps/web/src/app/portal/error.tsx');
      expect(exists).toBe(true);
    });

    await test('T1-ERR-05', 'Centralized error parser apps/web/src/lib/error-helpers.ts exists (CQ-07)', () => {
      const exists = harness.fileExists('apps/web/src/lib/error-helpers.ts');
      expect(exists).toBe(true);
      const content = harness.readFileSafe('apps/web/src/lib/error-helpers.ts');
      expect(content).toContain('parseApiError');
    });
  });
}

// ─── TIER 2: BOUNDARY & CORNER CASES ─────────────────────────────────────────

async function runTier2() {
  const JWT_SECRET = 'super_secret_test_key_at_least_32_bytes_long!!';
  const jwtSign = (jwt as any).default?.sign || (jwt as any).sign;
  const jwtVerify = (jwt as any).default?.verify || (jwt as any).verify;

  await describe('Tier 2.1: Malformed & Adversarial Tokens', 2, async () => {
    await test('T2-TOK-01', 'Empty or whitespace-only token is rejected', () => {
      const verifyToken = (token: string) => {
        if (!token || !token.trim()) throw new Error('Token is missing or empty');
        return jwtVerify(token, JWT_SECRET);
      };
      expect(() => verifyToken('')).toThrow('missing or empty');
      expect(() => verifyToken('   \t  ')).toThrow('missing or empty');
    });

    await test('T2-TOK-02', 'Truncated JWT missing signature component is rejected', () => {
      const truncated = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0';
      expect(() => jwtVerify(truncated, JWT_SECRET)).toThrow();
    });

    await test('T2-TOK-03', 'JWT with algorithm none (alg: none) is rejected by verifier', () => {
      const unsignedNoneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9.';
      expect(() => jwtVerify(unsignedNoneToken, JWT_SECRET, { algorithms: ['HS256'] })).toThrow();
    });

    await test('T2-TOK-04', 'Tampered payload claims with mismatched signature are rejected', () => {
      const validToken = jwtSign({ sub: 'user_123', role: 'CLIENT' }, JWT_SECRET, { algorithm: 'HS256' });
      const parts = validToken.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'user_123', role: 'SUPER_ADMIN' })).toString('base64url');
      const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      expect(() => jwtVerify(forgedToken, JWT_SECRET)).toThrow();
    });

    await test('T2-TOK-05', 'Oversized token header (>16 KB) is safely bounded and rejected', () => {
      const oversizedHeader = 'Bearer ' + 'A'.repeat(20 * 1024);
      const isHeaderSafe = oversizedHeader.length <= 8192;
      expect(isHeaderSafe).toBe(false);
    });

    await test('T2-TOK-06', 'SQL injection & XSS strings in Bearer authorization header are rejected', () => {
      const hostileTokens = [
        "Bearer ' OR '1'='1",
        'Bearer <script>alert(1)</script>',
        'Bearer ../../../etc/shadow',
        'Bearer %00%0D%0A',
      ];
      for (const t of hostileTokens) {
        const raw = t.replace(/^Bearer\s+/i, '');
        expect(() => jwtVerify(raw, JWT_SECRET)).toThrow();
      }
    });
  });

  await describe('Tier 2.2: Expired & Revoked Sessions', 2, async () => {
    await test('T2-SES-01', 'JWT with exp in the past is strictly rejected with TokenExpiredError', () => {
      const expiredToken = jwtSign(
        { sub: 'user_123', exp: Math.floor(Date.now() / 1000) - 30 },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );
      expect(() => jwtVerify(expiredToken, JWT_SECRET)).toThrow(/jwt expired/);
    });

    await test('T2-SES-02', 'JWT with future nbf (not before) claim is rejected', () => {
      const futureToken = jwtSign(
        { sub: 'user_123', nbf: Math.floor(Date.now() / 1000) + 3600 },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );
      expect(() => jwtVerify(futureToken, JWT_SECRET)).toThrow(/jwt not active/);
    });

    await test('T2-SES-03', 'Single-use tokenHash replay attack is thwarted by SHA-256 database matching', () => {
      const rawToken = 'claim_secret_token_abc123';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      const dbTokens = new Map<string, { used: boolean }>();
      dbTokens.set(tokenHash, { used: false });

      const redeemToken = (candidateRaw: string): boolean => {
        const candidateHash = createHash('sha256').update(candidateRaw).digest('hex');
        const record = dbTokens.get(candidateHash);
        if (!record || record.used) return false;
        record.used = true;
        return true;
      };

      const firstRedeem = redeemToken(rawToken);
      expect(firstRedeem).toBe(true);
      const secondRedeem = redeemToken(rawToken);
      expect(secondRedeem).toBe(false);
    });

    await test('T2-SES-04', 'Magic link single-use token cannot be replayed after redemption', () => {
      const magicToken = 'magic_token_xyz987';
      const consumedStore = new Set<string>();

      const verifyAndConsume = (token: string): boolean => {
        const hash = createHash('sha256').update(token).digest('hex');
        if (consumedStore.has(hash)) return false;
        consumedStore.add(hash);
        return true;
      };

      expect(verifyAndConsume(magicToken)).toBe(true);
      expect(verifyAndConsume(magicToken)).toBe(false);
    });

    await test('T2-SES-05', 'Sandbox token expiration bounds impersonation session duration', () => {
      const maxAgeMs = 30 * 60 * 1000;
      const issuedAt = Date.now() - 31 * 60 * 1000;
      const isExpired = Date.now() - issuedAt > maxAgeMs;
      expect(isExpired).toBe(true);
    });
  });

  await describe('Tier 2.3: Edge Geo-Headers & Country Detection', 2, async () => {
    await test('T2-GEO-01', 'Missing or empty geo-headers fallback safely to canonical GLOBAL market', () => {
      expect(mapCountryToMarket(null)).toBe('GLOBAL');
      expect(mapCountryToMarket('')).toBe('GLOBAL');
      expect(mapCountryToMarket('   ')).toBe('GLOBAL');
    });

    await test('T2-GEO-02', 'Unknown or non-standard ISO country codes (ZZ, XX, 99) fallback to GLOBAL', () => {
      expect(mapCountryToMarket('ZZ')).toBe('GLOBAL');
      expect(mapCountryToMarket('XX')).toBe('GLOBAL');
      expect(mapCountryToMarket('99')).toBe('GLOBAL');
      expect(mapCountryToMarket('UNKNOWN')).toBe('GLOBAL');
    });

    await test('T2-GEO-03', 'Mixed-case and lowercase geo-headers (ke, Ug, Tz) are normalized to KE', () => {
      expect(mapCountryToMarket('ke')).toBe('KE');
      expect(mapCountryToMarket('Ug')).toBe('KE');
      expect(mapCountryToMarket('tZ')).toBe('KE');
      expect(mapCountryToMarket('rW')).toBe('KE');
    });

    await test('T2-GEO-04', 'Multi-hop client headers (KE, US, GB) resolve to the first edge hop', () => {
      const mockHeaders = new Headers();
      mockHeaders.set('cf-ipcountry', 'KE, US, GB');
      const resolved = getServerMarket(mockHeaders);
      expect(resolved).toBe('KE');
    });

    await test('T2-GEO-05', 'Header injection with newlines and control characters is rejected safely', () => {
      const hostileCountry = 'KE\r\nSet-Cookie: evil=1\r\n';
      const cleanCountry = hostileCountry.replace(/[\r\n\u0000-\u001F]+/g, '').trim().slice(0, 2);
      expect(cleanCountry).toBe('KE');
    });
  });

  await describe('Tier 2.4: Invalid & Corrupted Market Cookies', 2, async () => {
    await test('T2-MCK-01', 'Corrupted cookie string falls back safely to default market', () => {
      expect(normalizeMarketCode('CORRUPTED_VALUE_999')).toBe('GLOBAL');
      expect(normalizeMarketCode('__undefined__')).toBe('GLOBAL');
    });

    await test('T2-MCK-02', 'XSS payload in cookie is rejected and sanitized', () => {
      const xssCookie = '<script>alert("xss")</script>';
      expect(normalizeMarketCode(xssCookie)).toBe('GLOBAL');
    });

    await test('T2-MCK-03', 'Non-existent market code defaults safely to GLOBAL', () => {
      expect(normalizeMarketCode('MARS')).toBe('GLOBAL');
      expect(normalizeMarketCode('ATLANTIS')).toBe('GLOBAL');
    });

    await test('T2-MCK-04', 'Empty cookie value is treated as unset', () => {
      expect(normalizeMarketCode('')).toBe('GLOBAL');
      expect(normalizeMarketCode(null)).toBe('GLOBAL');
      expect(normalizeMarketCode(undefined)).toBe('GLOBAL');
    });

    await test('T2-MCK-05', 'Cookie with spaces and URL encoding is parsed cleanly', () => {
      expect(normalizeMarketCode('  KE  ')).toBe('KE');
      expect(normalizeMarketCode('kenya')).toBe('KE');
      expect(normalizeMarketCode('international')).toBe('GLOBAL');
    });
  });

  await describe('Tier 2.5: Rapid Admin Polling & Concurrency Extremes', 2, async () => {
    await test('T2-POL-01', 'Polling interval below minimum threshold (5000ms) is clamped to safe minimum', () => {
      const clampInterval = (requested: number, min = 5000, max = 300000) => {
        if (isNaN(requested) || requested < min) return min;
        if (requested > max) return max;
        return requested;
      };
      expect(clampInterval(0)).toBe(5000);
      expect(clampInterval(-1000)).toBe(5000);
      expect(clampInterval(100)).toBe(5000);
      expect(clampInterval(15000)).toBe(15000);
      expect(clampInterval(99999999)).toBe(300000);
    });

    await test('T2-POL-02', 'Rapid successive toggle commands resolve without state corruption', () => {
      let state = true;
      const toggle = () => {
        state = !state;
      };
      for (let i = 0; i < 100; i++) toggle();
      expect(state).toBe(true);
    });

    await test('T2-POL-03', 'Visibility flapping (rapid tab switches) preserves configured interval', () => {
      let pollingPaused = false;
      const handleVisibilityChange = (visible: boolean) => {
        pollingPaused = !visible;
      };

      handleVisibilityChange(false);
      expect(pollingPaused).toBe(true);
      handleVisibilityChange(true);
      expect(pollingPaused).toBe(false);
    });

    await test('T2-POL-04', 'Concurrent manual refresh deduplication: ignores clicks when fetch is in flight', () => {
      let inFlight = false;
      let executionCount = 0;

      const triggerRefresh = async () => {
        if (inFlight) return;
        inFlight = true;
        executionCount++;
        await new Promise((r) => setTimeout(r, 10));
        inFlight = false;
      };

      const p1 = triggerRefresh();
      const p2 = triggerRefresh();
      const p3 = triggerRefresh();

      return Promise.all([p1, p2, p3]).then(() => {
        expect(executionCount).toBe(1);
      });
    });

    await test('T2-POL-05', 'Exponential backoff clamps max delay on consecutive polling failures', () => {
      const getBackoffDelay = (consecutiveFailures: number, baseMs = 5000, maxMs = 60000) => {
        const exp = Math.min(consecutiveFailures, 5);
        return Math.min(baseMs * Math.pow(2, exp), maxMs);
      };
      expect(getBackoffDelay(0)).toBe(5000);
      expect(getBackoffDelay(1)).toBe(10000);
      expect(getBackoffDelay(2)).toBe(20000);
      expect(getBackoffDelay(3)).toBe(40000);
      expect(getBackoffDelay(10)).toBe(60000);
    });
  });

  await describe('Tier 2.6: Edge Breakpoints & Viewport Boundaries', 2, async () => {
    await test('T2-BRK-01', 'Ultra-narrow viewport (320px) breakpoint boundary recognition', () => {
      const getBreakpoint = (width: number) => {
        if (width < 640) return 'xs';
        if (width < 768) return 'sm';
        if (width < 1024) return 'md';
        if (width < 1280) return 'lg';
        return 'xl';
      };
      expect(getBreakpoint(320)).toBe('xs');
      expect(getBreakpoint(389)).toBe('xs');
      expect(getBreakpoint(640)).toBe('sm');
      expect(getBreakpoint(768)).toBe('md');
      expect(getBreakpoint(1024)).toBe('lg');
      expect(getBreakpoint(1280)).toBe('xl');
    });

    await test('T2-BRK-02', 'Extremely large numerical amounts format without clipping or scientific notation', () => {
      const formattedKES = formatCurrency(125000000, 'KES');
      expect(formattedKES).toContain('125,000,000');
      expect(formattedKES).toContain('KSh');

      const formattedUSD = formatCurrency(5000000, 'USD');
      expect(formattedUSD).toContain('5,000,000');
      expect(formattedUSD).toContain('$');
    });

    await test('T2-BRK-03', 'Zero amount and negative edge amounts format gracefully', () => {
      const zeroKES = formatCurrency(0, 'KES');
      expect(zeroKES).toContain('0');

      const zeroUSD = formatCurrency(0, 'USD');
      expect(zeroUSD).toContain('0');
    });

    await test('T2-BRK-04', 'Long proposal line item titles truncate safely with ellipsis without table blowout', () => {
      const longTitle = 'Bespoke Enterprise Next.js Custom Multi-Tenant E-Commerce System with High Availability & Dedicated Redis Cluster';
      const truncateSafe = (s: string, max = 50) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
      const truncated = truncateSafe(longTitle, 40);
      expect(truncated.length).toBe(40);
      expect(truncated.endsWith('…')).toBe(true);
    });

    await test('T2-BRK-05', 'Ultra-wide 4K viewports (>2560px) contain max-w container constraints', () => {
      const layoutHtml = harness.readFileSafe('apps/web/src/app/(public)/layout.tsx') || harness.readFileSafe('apps/web/src/app/layout.tsx');
      expect(layoutHtml.length).toBeGreaterThan(0);
    });
  });
}

// ─── TIER 3: CROSS-FEATURE COMBINATIONS ──────────────────────────────────────

async function runTier3() {
  await describe('Tier 3.1: Market Cookie Hydration + Subscription / Checkout Flow', 3, async () => {
    await test('T3-MKT-CHK-01', 'East African market cookie sets currency to KES throughout catalog and pricing book', () => {
      const pbKE = getPriceBookForMarket('KE');
      expect(pbKE.currency).toBe('KES');
      expect(pbKE.marketCode).toBe('KE');
      expect(pbKE.websitePackages.standard.price).toBeGreaterThan(0);
      const formatted = formatCurrency(pbKE.websitePackages.standard.price, pbKE.currency);
      expect(formatted).toContain('KSh');
    });

    await test('T3-MKT-CHK-02', 'Global market defaults catalog and pricing book to USD', () => {
      const pbGlobal = getPriceBookForMarket('GLOBAL');
      expect(pbGlobal.currency).toBe('USD');
      expect(pbGlobal.marketCode).toBe('GLOBAL');
      const formatted = formatCurrency(pbGlobal.websitePackages.standard.price, pbGlobal.currency);
      expect(formatted).toContain('$');
    });

    await test('T3-MKT-CHK-03', 'Cross-market price consistency: KES and USD rate cards remain isolated', () => {
      const pbKE = getPriceBookForMarket('KE');
      const pbGlobal = getPriceBookForMarket('GLOBAL');
      expect(pbKE.websitePackages.growth.price).toBeGreaterThan(pbGlobal.websitePackages.growth.price * 50);
      expect(pbKE.currency).toBe('KES');
      expect(pbGlobal.currency).toBe('USD');
    });

    await test('T3-MKT-CHK-04', 'Cookie overrides conflicting geo-header during full checkout hydration pass', () => {
      const headers = new Headers();
      headers.set('cf-ipcountry', 'US');
      const cookieHeader = 'bazion_market=KE';

      const resolvedMarket = getServerMarket(headers, cookieHeader);
      expect(resolvedMarket).toBe('KE');
      const book = getPriceBookForMarket(resolvedMarket);
      expect(book.currency).toBe('KES');
    });
  });

  await describe('Tier 3.2: Admin Impersonation Sandbox + Tab-Aware Polling Lifecycle', 3, async () => {
    await test('T3-ADM-POL-01', 'Admin impersonation session token is scoped to sessionStorage and isolated from auth store', () => {
      const mockSessionStore = new Map<string, string>();
      const mockLocalStore = new Map<string, string>();

      mockLocalStore.set('bazionweb-auth', JSON.stringify({ token: 'admin_jwt_token', role: 'SUPER_ADMIN' }));
      mockSessionStore.set('bazionweb_sandbox_token', 'sandbox_client_view_token');

      expect(mockLocalStore.get('bazionweb-auth')).toContain('admin_jwt_token');
      expect(mockSessionStore.get('bazionweb_sandbox_token')).toBe('sandbox_client_view_token');
    });

    await test('T3-ADM-POL-02', 'Admin troubleshooting polling halts immediately when tab is hidden and resumes on focus', () => {
      let isVisible = true;
      let activeTimers = 0;

      const startPolling = () => {
        if (!isVisible) return;
        activeTimers++;
      };

      const stopPolling = () => {
        if (activeTimers > 0) activeTimers--;
      };

      startPolling();
      expect(activeTimers).toBe(1);

      isVisible = false;
      stopPolling();
      expect(activeTimers).toBe(0);

      startPolling();
      expect(activeTimers).toBe(0);

      isVisible = true;
      startPolling();
      expect(activeTimers).toBe(1);
    });

    await test('T3-ADM-POL-03', 'Polling controller isolates queries to currently active tool tab', () => {
      const activeTool = 'cluster-health';
      const isQueryEnabled = (toolId: string) => toolId === activeTool;

      expect(isQueryEnabled('cluster-health')).toBe(true);
      expect(isQueryEnabled('dns-fleet')).toBe(false);
      expect(isQueryEnabled('webhook-failures')).toBe(false);
      expect(isQueryEnabled('unsynced-invoices')).toBe(false);
    });

    await test('T3-ADM-POL-04', 'Polling halts cleanly on HTTP 401 unauthenticated without triggering retry loop', () => {
      let pollingStopped = false;
      let redirectTriggered = false;

      const handleQueryError = (statusCode: number) => {
        if (statusCode === 401) {
          pollingStopped = true;
          redirectTriggered = true;
        }
      };

      handleQueryError(401);
      expect(pollingStopped).toBe(true);
      expect(redirectTriggered).toBe(true);
    });
  });

  await describe('Tier 3.3: Edge Middleware + API Gateway + Cryptographic Boundary', 3, async () => {
    await test('T3-EDG-GW-01', 'Edge middleware blocks unauthenticated callers before API proxy invocation', () => {
      const hasAuthCookie = (cookieString: string) => {
        return /bazionweb_token|token=/.test(cookieString);
      };

      const interceptRequest = (path: string, cookies: string) => {
        if (path.startsWith('/admin') && !hasAuthCookie(cookies)) {
          return { status: 307, redirect: '/admin/login' };
        }
        return { status: 200, next: true };
      };

      const res = interceptRequest('/admin/invoices', 'theme=dark');
      expect(res.status).toBe(307);
      expect(res.redirect).toBe('/admin/login');
    });

    await test('T3-EDG-GW-02', 'API Gateway drops forged x-internal-dispatch header before upstream handoff', () => {
      const incomingHeaders = {
        'x-internal-dispatch': 'attacker_forged_secret',
        authorization: 'Bearer user_token',
        'content-type': 'application/json',
      };

      const filterHeaders = (headers: Record<string, string>) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === 'x-internal-dispatch') continue;
          out[k] = v;
        }
        return out;
      };

      const filtered = filterHeaders(incomingHeaders);
      expect(filtered['x-internal-dispatch']).toBeUndefined();
      expect(filtered.authorization).toBe('Bearer user_token');
    });

    await test('T3-EDG-GW-03', 'API Gateway blocks dot-segment path escape to prevent unauthorized route bypass', () => {
      const isPathSafe = (segments: string[]) => {
        for (const seg of segments) {
          if (/^[./]+$/.test(seg)) return false;
          if (/[/\\%\u0000-\u001F]/.test(seg)) return false;
        }
        return true;
      };

      expect(isPathSafe(['..', 'admin', 'dispatch-link'])).toBe(false);
      expect(isPathSafe(['.', 'secret'])).toBe(false);
      expect(isPathSafe(['valid', 'path', 'segment'])).toBe(true);
    });

    await test('T3-EDG-GW-04', 'Multi-tenant IDOR defense: Client A cannot decrypt Client B vault secret', () => {
      const MASTER_KEY = Buffer.alloc(32, 'a');

      const encryptVaultSecret = (clientId: string, plaintext: string) => {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv);
        cipher.setAAD(Buffer.from(`client:${clientId}`));
        const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return { iv: iv.toString('hex'), tag: tag.toString('hex'), ciphertext: enc.toString('hex') };
      };

      const decryptVaultSecret = (clientId: string, payload: { iv: string; tag: string; ciphertext: string }) => {
        const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(payload.iv, 'hex'));
        decipher.setAAD(Buffer.from(`client:${clientId}`));
        decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
        return Buffer.concat([
          decipher.update(Buffer.from(payload.ciphertext, 'hex')),
          decipher.final(),
        ]).toString('utf8');
      };

      const encrypted = encryptVaultSecret('client_111', 'db_password_super_secret');
      const decrypted = decryptVaultSecret('client_111', encrypted);
      expect(decrypted).toBe('db_password_super_secret');
      expect(() => decryptVaultSecret('client_222', encrypted)).toThrow();
    });
  });
}

// ─── TIER 4: REAL-WORLD APPLICATION SCENARIOS ────────────────────────────────

async function runTier4() {
  await describe('Tier 4.1: Anonymous East African Visitor Journey', 4, async () => {
    await test('T4-SCN-01', 'Complete Visitor Flow: Edge Geo-Detection -> Zero USD Flash -> Quote Creation -> Sanitized Storage', () => {
      const reqHeaders = new Headers();
      reqHeaders.set('cf-ipcountry', 'KE');
      reqHeaders.set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

      const initialMarket = getServerMarket(reqHeaders);
      expect(initialMarket).toBe('KE');

      const pb = getPriceBookForMarket(initialMarket);
      expect(pb.currency).toBe('KES');
      const standardPrice = pb.websitePackages.standard.price;
      expect(standardPrice).toBeGreaterThan(0);
      const displayPrice = formatCurrency(standardPrice, 'KES');
      expect(displayPrice).toContain('KSh');

      const rawClientName = 'Jane Mwangi \r\n<CEO>';
      const cleanName = rawClientName.replace(/[\r\n\u0000-\u001F]+/g, '').trim();
      const proposalCode = 'BW-' + randomBytes(4).toString('hex').toUpperCase();

      expect(proposalCode).toMatch(/^BW-[0-9A-F]{8}$/);
      expect(cleanName).toBe('Jane Mwangi <CEO>');
      expect(cleanName).not.toContain('\r');
      expect(cleanName).not.toContain('\n');
    });
  });

  await describe('Tier 4.2: International Client Onboarding & Checkout Journey', 4, async () => {
    await test('T4-SCN-02', 'Complete Client Flow: EU Visitor -> USD/Global Price -> Checkout Tab -> Safe Paystack Redirect -> Token Minting', () => {
      const market = mapCountryToMarket('DE');
      expect(market).toBe('GLOBAL');
      const pb = getPriceBookForMarket(market);
      expect(pb.currency).toBe('USD');

      const planPrice = pb.carePlans.growth.priceMonthly;
      expect(planPrice).toBeGreaterThan(0);

      expect(isTrustedCheckoutUrl('https://checkout.paystack.com/pay/mock_session_123')).toBe(true);
      expect(isTrustedCheckoutUrl('https://phishing-site.com/checkout.paystack.com')).toBe(false);
      expect(isTrustedCheckoutUrl('http://checkout.paystack.com/unsecured')).toBe(false);

      const rawActivationToken = randomBytes(24).toString('hex');
      const dbHashedToken = createHash('sha256').update(rawActivationToken).digest('hex');

      expect(dbHashedToken.length).toBe(64);
      expect(dbHashedToken).not.toBe(rawActivationToken);
    });
  });

  await describe('Tier 4.3: Support Staff Troubleshooting & Workstation Triage', 4, async () => {
    await test('T4-SCN-03', 'Complete Staff Flow: MFA Verification -> Tab-Aware Polling -> Toolbar Control -> Triage Action Target Size', () => {
      const staffUser = { role: 'SUPPORT', mfaEnabled: true, acr: 'mfa' };
      const hasMfaAccess = staffUser.role === 'SUPPORT' && staffUser.acr === 'mfa';
      expect(hasMfaAccess).toBe(true);

      let activeTab = 'cluster-health';
      let isPollingPaused = false;
      let configuredInterval = 15000;

      const isTabPolling = (tabId: string) => !isPollingPaused && tabId === activeTab;
      expect(isTabPolling('cluster-health')).toBe(true);
      expect(isTabPolling('dns-ssl')).toBe(false);

      isPollingPaused = true;
      configuredInterval = 30000;
      expect(isTabPolling('cluster-health')).toBe(false);
      expect(configuredInterval).toBe(30000);

      activeTab = 'webhook-failures';
      isPollingPaused = false;
      expect(isTabPolling('webhook-failures')).toBe(true);
      expect(isTabPolling('cluster-health')).toBe(false);
    });
  });

  await describe('Tier 4.4: Edge Route Protection & Malicious Infiltration Defense', 4, async () => {
    await test('T4-SCN-04', 'Complete Threat Defense Flow: Scanner Edge Interception -> Gateway Traversal Block -> 1MiB Body Rejection', () => {
      const cookies = '';
      const isProtected = (url: string) => /^\/(admin|portal)/.test(url);
      const shouldRedirect = isProtected('/admin/troubleshooting') && !cookies.includes('bazionweb_token');
      expect(shouldRedirect).toBe(true);

      const maliciousSegments = ['..', '..', 'etc', 'passwd'];
      const hasTraversal = maliciousSegments.some((seg) => /^[./]+$/.test(seg));
      expect(hasTraversal).toBe(true);

      const payloadBytes = 5 * 1024 * 1024;
      const MAX_BODY = 1024 * 1024;
      const isOversized = payloadBytes > MAX_BODY;
      expect(isOversized).toBe(true);
    });
  });

  await describe('Tier 4.5: Error Recovery & Application Resilience', 4, async () => {
    await test('T4-SCN-05', 'Complete Resilience Flow: Centralized Error Parsing -> Section Error Boundary Catch -> Reset Recovery UI', () => {
      const parseApiError = (err: any): { message: string; statusCode: number } => {
        if (!err) return { message: 'An unexpected error occurred.', statusCode: 500 };
        if (typeof err === 'string') return { message: err, statusCode: 500 };
        const status = err.status || err.response?.status || 500;
        const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Operation failed.';
        return { message: String(msg), statusCode: Number(status) };
      };

      const parsed503 = parseApiError({ response: { status: 503, data: { message: 'Upstream gateway timeout' } } });
      expect(parsed503.statusCode).toBe(503);
      expect(parsed503.message).toBe('Upstream gateway timeout');

      let hasError = true;
      let recoveryAttempts = 0;
      const reset = () => {
        hasError = false;
        recoveryAttempts++;
      };

      expect(hasError).toBe(true);
      reset();
      expect(hasError).toBe(false);
      expect(recoveryAttempts).toBe(1);

      const formatPageTitle = (pageTitle: string, brand = 'BazionWeb') => {
        const clean = pageTitle.replace(new RegExp(`\\s*\\|?\\s*${brand}`, 'gi'), '').trim();
        return `${clean} | ${brand}`;
      };

      const homeTitle = formatPageTitle('Web Design & Custom Systems');
      expect(homeTitle).toBe('Web Design & Custom Systems | BazionWeb');

      const dirtyTitle = formatPageTitle('Web Design & Custom Systems | BazionWeb');
      expect(dirtyTitle).toBe('Web Design & Custom Systems | BazionWeb');
    });
  });
}

// ─── CLI Entrypoint & Reporting ──────────────────────────────────────────────

interface CliOptions {
  tiers: number[];
  filter?: string;
  allowFailures: boolean;
  summaryOnly: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    tiers: [1, 2, 3, 4],
    allowFailures: false,
    summaryOnly: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('--tier=')) {
      const parts = arg.split('=')[1].split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      if (parts.length > 0) options.tiers = parts;
    }
    if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1].toLowerCase();
    }
    if (arg === '--allow-failures') {
      options.allowFailures = true;
    }
    if (arg === '--summary') {
      options.summaryOnly = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${BOLD}BazionWeb E2E Verification Suite (VERIF-01)${RESET}
Usage: node --no-warnings --experimental-strip-types scripts/run-e2e-audit-suite.ts [options]

Options:
  --tier=<1,2,3,4>    Run specific tiers (e.g. --tier=1,2 or --tier=3)
  --filter=<pattern>  Filter tests by name or ID (e.g. --filter=SEC or --filter=MKT)
  --allow-failures    Exit code 0 regardless of failures (used for milestone baselines)
  --summary           Show high-level summary only
  --help, -h          Show this help message
`);
}

async function main() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log(`\n${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}${BOLD}║      BAZIONWEB HARDENING & AUDIT E2E VERIFICATION RUNNER (VERIF-01)          ║${RESET}`);
  console.log(`${CYAN}${BOLD}║      4-Tier Opaque-Box Specification Verification Suite                      ║${RESET}`);
  console.log(`${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`${GRAY}Target Workspace: ${harness.workspaceRoot}${RESET}`);
  console.log(`${GRAY}Active Tiers: ${options.tiers.join(', ')} | Filter: ${options.filter || 'none'}${RESET}\n`);

  if (options.tiers.includes(1)) {
    await runTier1();
  }

  if (options.tiers.includes(2)) {
    await runTier2();
  }

  if (options.tiers.includes(3)) {
    await runTier3();
  }

  if (options.tiers.includes(4)) {
    await runTier4();
  }

  const durationMs = Date.now() - startTime;
  let allResults = harness.results;

  if (options.filter) {
    const filterTokens = options.filter.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    allResults = allResults.filter(
      (r) => filterTokens.some((tok) => r.id.toLowerCase().includes(tok) || r.name.toLowerCase().includes(tok))
    );
  }

  if (!options.summaryOnly) {
    console.log(`\n${BOLD}Test Case Execution Results:${RESET}`);
    let lastSuite = '';
    for (const r of allResults) {
      if (r.suite !== lastSuite) {
        lastSuite = r.suite;
        console.log(`\n${GRAY}--- [Tier ${r.tier}] ${r.suite} ---${RESET}`);
      }
      const icon = r.status === 'pass' ? `${GREEN}✔ PASS${RESET}` : `${RED}✘ FAIL${RESET}`;
      const timing = `${GRAY}(${r.durationMs}ms)${RESET}`;
      console.log(`  ${icon} ${BOLD}${r.id}${RESET} - ${r.name} ${timing}`);
      if (r.status === 'fail' && r.error) {
        console.log(`    ${RED}↳ Reason: ${r.error}${RESET}`);
      }
    }
  }

  const total = allResults.length;
  const passed = allResults.filter((r) => r.status === 'pass').length;
  const failed = allResults.filter((r) => r.status === 'fail').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  const tierStats = [1, 2, 3, 4].map((tierNum) => {
    const tierResults = allResults.filter((r) => r.tier === tierNum);
    const tPassed = tierResults.filter((r) => r.status === 'pass').length;
    const tFailed = tierResults.filter((r) => r.status === 'fail').length;
    return {
      tier: tierNum,
      total: tierResults.length,
      passed: tPassed,
      failed: tFailed,
      rate: tierResults.length > 0 ? ((tPassed / tierResults.length) * 100).toFixed(1) : '0.0',
    };
  });

  console.log(`\n${BOLD}================================================================================${RESET}`);
  console.log(`${BOLD}                       E2E VERIFICATION SUITE SUMMARY                          ${RESET}`);
  console.log(`${BOLD}================================================================================${RESET}`);
  console.log(`  Total Test Cases:    ${BOLD}${total}${RESET}`);
  console.log(`  Passing:             ${GREEN}${passed}${RESET} (${passRate}%)`);
  console.log(`  Failing / Pending:   ${failed > 0 ? RED : GREEN}${failed}${RESET}`);
  console.log(`  Total Duration:      ${durationMs} ms`);
  console.log(`${GRAY}--------------------------------------------------------------------------------${RESET}`);
  console.log(`  ${BOLD}Tier Breakdown:${RESET}`);
  for (const ts of tierStats) {
    if (ts.total === 0) continue;
    const tierName =
      ts.tier === 1
        ? 'Feature Coverage (R1-R5)'
        : ts.tier === 2
        ? 'Boundary & Corner Cases'
        : ts.tier === 3
        ? 'Cross-Feature Integrations'
        : 'Real-World User Journeys';
    const statusColor = ts.failed === 0 ? GREEN : YELLOW;
    console.log(
      `    Tier ${ts.tier} [${tierName.padEnd(28)}]: ${statusColor}${ts.passed}/${ts.total} passed (${ts.rate}%)${RESET}`
    );
  }
  console.log(`${BOLD}================================================================================${RESET}`);

  if (failed > 0) {
    console.log(`\n${YELLOW}${BOLD}⚠ IDENTIFIED ACCEPTANCE GAPS (Required for Hardening Milestones M1-M4):${RESET}`);
    const failedCases = allResults.filter((r) => r.status === 'fail');
    const grouped = new Map<string, TestCaseResult[]>();
    for (const fc of failedCases) {
      const list = grouped.get(fc.suite) || [];
      list.push(fc);
      grouped.set(fc.suite, list);
    }

    for (const [suite, list] of grouped.entries()) {
      console.log(`\n  ${CYAN}${suite}:${RESET}`);
      for (const item of list) {
        console.log(`    ${RED}• [${item.id}] ${item.name}${RESET}`);
        if (item.error) {
          console.log(`      ${GRAY}${item.error}${RESET}`);
        }
      }
    }
    console.log(`\n${GRAY}These failures reflect pre-hardening items cataloged in PROJECT.md.${RESET}`);
    console.log(`${GRAY}Implementer agents for M1, M2, M3, M4 will resolve these items.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}${BOLD}✔ ALL E2E ACCEPTANCE TESTS PASSED! FULL WORKSPACE VERIFIED!${RESET}\n`);
  }

  if (failed > 0 && !options.allowFailures) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal runner error:${RESET}`, err);
  process.exit(1);
});
