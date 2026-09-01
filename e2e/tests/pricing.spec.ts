import { test, expect } from '@playwright/test';

test.describe('Pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('shows page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Pricing/);
  });

  test('shows all 4 plan cards', async ({ page }) => {
    for (const plan of ['Starter', 'Growth', 'Business', 'Enterprise']) {
      await expect(page.getByText(plan).first()).toBeVisible();
    }
  });

  test('shows correct pricing', async ({ page }) => {
    await expect(page.getByText('$49')).toBeVisible();
    await expect(page.getByText('$99')).toBeVisible();
    await expect(page.getByText('$199')).toBeVisible();
  });

  test('Growth plan is marked as Most Popular', async ({ page }) => {
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('feature comparison table is visible', async ({ page }) => {
    await expect(page.getByText('Full feature comparison')).toBeVisible();
    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Starter' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Enterprise' })).toBeVisible();
  });

  test('Get Started buttons link to contact', async ({ page }) => {
    const btn = page.getByRole('link', { name: 'Get Started' }).first();
    await btn.click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test('FAQ section is visible', async ({ page }) => {
    await expect(page.getByText('Frequently asked questions')).toBeVisible();
    await expect(page.getByText(/setup fees/i)).toBeVisible();
  });

  test('add-ons section is visible', async ({ page }) => {
    await expect(page.getByText('One-time add-ons')).toBeVisible();
    await expect(page.getByText('Website Build')).toBeVisible();
    await expect(page.getByText('Site Migration')).toBeVisible();
  });
});
