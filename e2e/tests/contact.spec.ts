import { test, expect } from '@playwright/test';

test.describe('Contact page and form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
  });

  test('shows page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /let's talk/i })).toBeVisible();
  });

  test('form has all required fields', async ({ page }) => {
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel(/tell us about your website/i)).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
  });

  test('shows error for invalid email', async ({ page }) => {
    await page.getByLabel('Full name').fill('Test User');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
  });

  test('shows success state after valid submission', async ({ page }) => {
    await page.getByLabel('Full name').fill('Sarah Kamau');
    await page.getByLabel('Email address').fill('sarah@test.com');
    await page.getByLabel(/tell us about your website/i).fill(
      'We need managed hosting for our clinic website. Currently on a shared server that is very slow.',
    );
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for success state (simulated 1200ms delay)
    await expect(page.getByText('Message received!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/24 hours/i)).toBeVisible();
  });

  test('urgent flag checkbox is present', async ({ page }) => {
    const checkbox = page.getByRole('checkbox');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('plan and service selects are present', async ({ page }) => {
    await expect(page.getByLabel('Plan interest')).toBeVisible();
    await expect(page.getByLabel('Primary service needed')).toBeVisible();
  });

  test('contact sidebar shows email and phone', async ({ page }) => {
    await expect(page.getByText('hello@bazionweb.com')).toBeVisible();
    await expect(page.getByText('+254 721 287 053')).toBeVisible();
  });

  test('can reset form after success', async ({ page }) => {
    await page.getByLabel('Full name').fill('Sarah Kamau');
    await page.getByLabel('Email address').fill('sarah@test.com');
    await page.getByLabel(/tell us about your website/i).fill('Need help with hosting and maintenance for our business website');
    await page.getByRole('button', { name: /send message/i }).click();
    await page.getByText('Message received!').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /send another/i }).click();
    await expect(page.getByLabel('Full name')).toHaveValue('');
  });
});
