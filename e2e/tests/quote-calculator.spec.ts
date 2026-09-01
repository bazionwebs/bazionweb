import { test, expect } from '@playwright/test';

test.describe('Quote calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quote');
  });

  test('shows page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /instant price estimate/i })).toBeVisible();
  });

  test('Step 1 shows page type options', async ({ page }) => {
    await expect(page.getByText('Simple page')).toBeVisible();
    await expect(page.getByText('Standard page')).toBeVisible();
    await expect(page.getByText('Complex page')).toBeVisible();
  });

  test('live estimate panel updates when pages are incremented', async ({ page }) => {
    // Initial state: 2 simple + 2 standard + 1 complex = 2*150 + 2*250 + 1*450 = 1150
    // Then add one more complex page
    const plusButtons = page.getByRole('button', { name: '+' });
    await plusButtons.nth(2).click(); // complex page +
    // Build cost should increase by 450
    await expect(page.getByText('$1,600')).toBeVisible();
  });

  test('Next button advances to Step 2', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await expect(page.getByText('Any additional features?')).toBeVisible();
  });

  test('Step 2 shows all add-on options', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await expect(page.getByText('CMS Integration')).toBeVisible();
    await expect(page.getByText('E-commerce')).toBeVisible();
    await expect(page.getByText('Site Migration')).toBeVisible();
    await expect(page.getByText('Custom UI/UX Design')).toBeVisible();
  });

  test('toggling CMS add-on updates the estimate', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await page.getByText('CMS Integration').click();
    await expect(page.getByText('Strapi')).toBeVisible();
    // $300 CMS add-on should appear in estimate
    await expect(page.getByText('+$300')).toBeVisible();
  });

  test('Step 3 shows plan options', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await page.getByRole('button', { name: /next: choose plan/i }).click();
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('Business')).toBeVisible();
    await expect(page.getByText('Enterprise')).toBeVisible();
  });

  test('annual billing toggle shows savings', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await page.getByRole('button', { name: /next: choose plan/i }).click();
    await page.getByText(/Annual/).click();
    await expect(page.getByText(/save/i)).toBeVisible();
  });

  test('Get Official Quote button links to contact', async ({ page }) => {
    await page.getByRole('link', { name: /get official quote/i }).first().click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test('Back button returns to previous step', async ({ page }) => {
    await page.getByRole('button', { name: /next: add-ons/i }).click();
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page.getByText('How many pages do you need?')).toBeVisible();
  });
});
