import { test, expect } from '@playwright/test';

const MARKETING_PAGES = [
  { path: '/',              title: /BazionWeb/ },
  { path: '/about',        title: /About/ },
  { path: '/services',     title: /Services/ },
  { path: '/pricing',      title: /Pricing/ },
  { path: '/contact',      title: /Contact/ },
  { path: '/blog',         title: /Blog/ },
  { path: '/case-studies', title: /Case Studies/ },
  { path: '/careers',      title: /Careers/ },
  { path: '/quote',        title: /Quote/ },
  { path: '/legal/terms',  title: /Terms/ },
  { path: '/legal/privacy',title: /Privacy/ },
  { path: '/legal/sla',    title: /SLA/ },
  { path: '/services/development', title: /Development/ },
  { path: '/services/hosting',     title: /Hosting/ },
  { path: '/services/maintenance', title: /Maintenance/ },
  { path: '/services/security',    title: /Security/ },
  { path: '/services/performance', title: /Performance/ },
  { path: '/services/support',     title: /Support/ },
];

test.describe('SEO — All marketing pages', () => {
  for (const { path, title } of MARKETING_PAGES) {
    test(`${path} — loads with correct title`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(title);
    });
  }
});

test.describe('SEO — Meta tags', () => {
  test('homepage has OG title', async ({ page }) => {
    await page.goto('/');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toMatch(/BazionWeb/);
  });

  test('homepage has description meta tag', async ({ page }) => {
    await page.goto('/');
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(50);
  });

  test('pricing page has meta description', async ({ page }) => {
    await page.goto('/pricing');
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()['content-type'];
    expect(contentType).toMatch(/xml/);
  });

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
    const body = await response?.text();
    expect(body).toContain('Disallow: /portal');
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('sitemap.xml');
  });
});

test.describe('Accessibility — Basic smoke tests', () => {
  test('homepage has main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('all pages have a level-1 heading', async ({ page }) => {
    for (const { path } of MARKETING_PAGES.slice(0, 6)) {
      await page.goto(path);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
    }
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('focus styles are visible on interactive elements', async ({ page }) => {
    await page.goto('/');
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});

test.describe('404 handling', () => {
  test('non-existent page shows 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });

  test('404 page has link back to homepage', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await page.getByRole('link', { name: /back to home/i }).click();
    await expect(page).toHaveURL('/');
  });
});
