import { test, expect } from '@playwright/test';

test.describe('Marketing site — Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('homepage loads and shows correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/BazionWeb/);
  });

  test('hero headline is visible', async ({ page }) => {
    await expect(page.getByText(/completely managed/i)).toBeVisible();
  });

  test('Get Free Quote CTA is visible and links to contact', async ({ page }) => {
    const cta = page.getByRole('link', { name: /get free quote/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test('stats bar shows uptime guarantee', async ({ page }) => {
    await expect(page.getByText('99.95%')).toBeVisible();
  });

  test('services section shows all 6 services', async ({ page }) => {
    const serviceNames = [
      'Website Development',
      'Managed Cloud Hosting',
      'Website Maintenance',
      'Security Management',
      'Performance Optimization',
      '24/7 Technical Support',
    ];
    for (const name of serviceNames) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('pricing section shows 3 plans', async ({ page }) => {
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('Business')).toBeVisible();
  });

  test('testimonials section is visible', async ({ page }) => {
    await expect(page.getByText(/trusted by growing businesses/i)).toBeVisible();
  });

  test('footer has correct links', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sla/i })).toBeVisible();
  });

  test('cookie banner appears on first visit', async ({ page }) => {
    await page.waitForTimeout(1600); // banner has 1500ms delay
    const banner = page.getByRole('dialog', { name: /cookie consent/i });
    await expect(banner).toBeVisible();
  });

  test('cookie banner accept sets localStorage item', async ({ page }) => {
    await page.waitForTimeout(1600);
    await page.getByRole('button', { name: /accept all/i }).click();
    const consent = await page.evaluate(() => localStorage.getItem('bw_cookie_consent'));
    expect(consent).toBe('accepted');
    await expect(page.getByRole('dialog', { name: /cookie consent/i })).not.toBeVisible();
  });
});

test.describe('Marketing site — Navigation', () => {
  test('navbar shows on all pages', async ({ page }) => {
    for (const path of ['/', '/about', '/services', '/pricing', '/blog']) {
      await page.goto(path);
      await expect(page.getByRole('navigation')).toBeVisible();
    }
  });

  test('Services dropdown shows on hover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /services/i }).hover();
    await expect(page.getByText('Website Development').first()).toBeVisible();
    await expect(page.getByText('Managed Hosting').first()).toBeVisible();
  });

  test('mobile hamburger menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const hamburger = page.getByLabel('Toggle menu');
    await hamburger.click();
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await hamburger.click();
  });
});
