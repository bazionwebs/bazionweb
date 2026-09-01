import { test, expect } from '@playwright/test';

test.describe('Portal authentication gate', () => {
  test('unauthenticated user visiting /portal is redirected to login', async ({ page }) => {
    await page.goto('/portal');
    // Should redirect to login page
    await expect(page).toHaveURL(/\/portal\/login/, { timeout: 5000 });
  });

  test('unauthenticated user visiting /admin is redirected to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/portal\/login/, { timeout: 5000 });
  });

  test('login page has correct heading', async ({ page }) => {
    await page.goto('/portal/login');
    await expect(page.getByRole('heading', { name: /sign in to your portal/i })).toBeVisible();
  });

  test('login form has email and password fields', async ({ page }) => {
    await page.goto('/portal/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('submit button is disabled with empty fields', async ({ page }) => {
    await page.goto('/portal/login');
    const btn = page.getByRole('button', { name: /sign in/i });
    await expect(btn).toBeDisabled();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/portal/login');
    await page.getByLabel('Email address').fill('wrong@email.com');
    await page.getByLabel('Password').fill('WrongPassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/portal/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('forgot password link points to Keycloak', async ({ page }) => {
    await page.goto('/portal/login');
    const link = page.getByText(/forgot password/i);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /auth\.bazionweb\.com/);
  });

  test('BazionWeb logo links back to homepage', async ({ page }) => {
    await page.goto('/portal/login');
    await page.getByRole('link', { name: 'BazionWeb' }).click();
    await expect(page).toHaveURL('/');
  });
});

// Note: Full portal dashboard tests require authenticated session
// Run with: PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD environment variables
test.describe('Portal dashboard (authenticated)', () => {
  test.skip(
    !process.env.PORTAL_TEST_EMAIL,
    'Skipping authenticated tests — set PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD env vars',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/portal/login');
    await page.getByLabel('Email address').fill(process.env.PORTAL_TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.PORTAL_TEST_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/portal/, { timeout: 10_000 });
  });

  test('dashboard shows uptime stat', async ({ page }) => {
    await expect(page.getByText(/uptime/i).first()).toBeVisible();
  });

  test('tickets tab opens', async ({ page }) => {
    await page.getByRole('button', { name: 'Support' }).click();
    await expect(page.getByText('New Ticket')).toBeVisible();
  });

  test('can open new ticket modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Support' }).click();
    await page.getByRole('button', { name: 'New Ticket' }).click();
    await expect(page.getByText('Submit a support ticket')).toBeVisible();
  });

  test('invoices tab shows invoice list', async ({ page }) => {
    await page.getByRole('button', { name: 'Invoices' }).click();
    await expect(page.getByText('INV-')).toBeVisible();
  });

  test('website tab shows Lighthouse scores', async ({ page }) => {
    await page.getByRole('button', { name: 'My Website' }).click();
    await expect(page.getByText('Performance')).toBeVisible();
    await expect(page.getByText('Core Web Vitals')).toBeVisible();
  });

  test('settings tab shows account form', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Account details')).toBeVisible();
    await expect(page.getByText('Notification preferences')).toBeVisible();
    await expect(page.getByText('Security')).toBeVisible();
  });
});
