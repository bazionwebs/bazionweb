import { test, expect } from '@playwright/test';

const SERVICE_PAGES = [
  { path: '/services/development',  heading: /website development/i,  cta: /get a quote/i },
  { path: '/services/hosting',      heading: /managed cloud hosting/i, cta: /view plans/i  },
  { path: '/services/maintenance',  heading: /website maintenance/i,   cta: /get maintenance/i },
  { path: '/services/security',     heading: /security management/i,   cta: /secure your website/i },
  { path: '/services/performance',  heading: /performance optimization/i, cta: /speed up your site/i },
  { path: '/services/support',      heading: /24\/7 technical support/i,  cta: /talk to a human/i },
];

test.describe('Individual service pages', () => {
  for (const { path, heading, cta } of SERVICE_PAGES) {
    test.describe(path, () => {
      test('loads with correct heading', async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
      });

      test('has a primary CTA button', async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('link', { name: cta }).first()).toBeVisible();
      });

      test('has dark hero section', async ({ page }) => {
        await page.goto(path);
        // Dark background hero
        const hero = page.locator('section').first();
        await expect(hero).toBeVisible();
      });

      test('CTA links to contact or pricing page', async ({ page }) => {
        await page.goto(path);
        const ctaLink = page.getByRole('link', { name: cta }).first();
        const href = await ctaLink.getAttribute('href');
        expect(href).toMatch(/\/(contact|pricing)/);
      });
    });
  }
});

test.describe('Services overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
  });

  test('shows all 6 service sections', async ({ page }) => {
    const serviceNames = ['development', 'hosting', 'maintenance', 'security', 'performance', 'support'];
    for (const id of serviceNames) {
      const section = page.locator(`#${id}`);
      await expect(section).toBeVisible();
    }
  });

  test('each service has deliverables checklist', async ({ page }) => {
    const checkmarks = page.locator('ul li').filter({ hasText: /.+/ });
    const count = await checkmarks.count();
    expect(count).toBeGreaterThan(20);
  });

  test('CTA section at bottom links to pricing and contact', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('link', { name: /see plan options/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get free assessment/i })).toBeVisible();
  });
});

test.describe('Navbar service dropdown', () => {
  test('hovering Services shows dropdown with all 6 services', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Services' }).hover();
    const dropdown = page.locator('[class*="grid-cols-2"]').first();
    await expect(dropdown).toBeVisible({ timeout: 2000 });
    await expect(dropdown.getByText('Website Development')).toBeVisible();
    await expect(dropdown.getByText('Security Management')).toBeVisible();
  });

  test('clicking a service in dropdown navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Services' }).hover();
    await page.getByRole('link', { name: 'Website Development' }).first().click();
    await expect(page).toHaveURL('/services/development');
  });
});
