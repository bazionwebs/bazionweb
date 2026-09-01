import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('shows blog listing page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /insights on managed web/i })).toBeVisible();
  });

  test('shows featured post', async ({ page }) => {
    await expect(page.getByText('Featured')).toBeVisible();
  });

  test('shows at least 3 blog post cards', async ({ page }) => {
    const cards = page.getByRole('link').filter({ hasText: /min read/ });
    await expect(cards).toHaveCount({ minimum: 3 } as any);
  });

  test('category filter buttons are visible', async ({ page }) => {
    await expect(page.getByText('All')).toBeVisible();
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByText('Performance')).toBeVisible();
  });

  test('clicking a post opens the detail page', async ({ page }) => {
    await page.getByRole('link', { name: /Why SMEs/i }).first().click();
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('newsletter section is visible', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/practical web insights/i)).toBeVisible();
  });
});

test.describe('Blog post detail', () => {
  test('shows full post content', async ({ page }) => {
    await page.goto('/blog/why-smes-need-managed-website-services');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/The hosting illusion/)).toBeVisible();
  });

  test('shows back to blog link', async ({ page }) => {
    await page.goto('/blog/why-smes-need-managed-website-services');
    const back = page.getByRole('link', { name: /back to blog/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL('/blog');
  });

  test('shows CTA card at bottom', async ({ page }) => {
    await page.goto('/blog/core-web-vitals-guide-2025');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/free assessment/i)).toBeVisible();
  });

  test('shows tags', async ({ page }) => {
    await page.goto('/blog/why-smes-need-managed-website-services');
    await expect(page.getByText('Managed Services')).toBeVisible();
  });

  test('returns 404 for unknown slug', async ({ page }) => {
    const res = await page.goto('/blog/this-post-does-not-exist');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Case studies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/case-studies');
  });

  test('shows listing heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /real clients/i })).toBeVisible();
  });

  test('shows at least 3 case study cards', async ({ page }) => {
    const cards = page.locator('.card').filter({ hasText: /Plan/ });
    await expect(cards).toHaveCount({ minimum: 3 } as any);
  });

  test('CTA links to contact', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('link', { name: /get your free assessment/i }).click();
    await expect(page).toHaveURL(/\/contact/);
  });
});

test.describe('Case study detail', () => {
  test('shows Acacia Healthcare case study', async ({ page }) => {
    await page.goto('/case-studies/acacia-healthcare');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Acacia Healthcare');
  });

  test('shows results grid', async ({ page }) => {
    await page.goto('/case-studies/acacia-healthcare');
    await expect(page.getByText('99.98%')).toBeVisible();
    await expect(page.getByText('30-day uptime (all 6 sites)')).toBeVisible();
  });

  test('shows approach steps', async ({ page }) => {
    await page.goto('/case-studies/acacia-healthcare');
    await expect(page.getByText('What we did')).toBeVisible();
  });

  test('shows client quote', async ({ page }) => {
    await page.goto('/case-studies/acacia-healthcare');
    await expect(page.getByText(/BazionWeb took complete ownership/)).toBeVisible();
  });

  test('back link returns to listing', async ({ page }) => {
    await page.goto('/case-studies/parkview-law');
    await page.getByRole('link', { name: /all case studies/i }).click();
    await expect(page).toHaveURL('/case-studies');
  });

  test('returns 404 for unknown slug', async ({ page }) => {
    const res = await page.goto('/case-studies/nonexistent-client');
    expect(res?.status()).toBe(404);
  });
});
