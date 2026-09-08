import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Page title ──────────────────────────────────────────────
  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Talent Acquisition/i);
  });

  // ── Hero section ─────────────────────────────────────────────
  test('hero section is visible', async ({ page }) => {
    await expect(page.getByTestId('hero')).toBeVisible();
  });

  test('main heading contains brand name', async ({ page }) => {
    const heading = page.getByTestId('main-heading');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('AI Talent Acquisition');
  });

  test('subheading is visible', async ({ page }) => {
    await expect(page.getByTestId('subheading')).toBeVisible();
  });

  // ── CTA buttons ──────────────────────────────────────────────
  test('"Browse Jobs" button is visible and links to /jobs', async ({ page }) => {
    const btn = page.getByTestId('browse-jobs-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/jobs');
  });

  test('"Login" button is visible and links to /login', async ({ page }) => {
    const btn = page.getByTestId('login-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/login');
  });

  // ── Features section ─────────────────────────────────────────
  test('features section is visible', async ({ page }) => {
    await expect(page.getByTestId('features-section')).toBeVisible();
  });

  test('renders 3 feature cards', async ({ page }) => {
    const cards = page.getByTestId('feature-card');
    await expect(cards).toHaveCount(3);
  });

  // ── Footer ───────────────────────────────────────────────────
  test('footer is visible with copyright text', async ({ page }) => {
    const footer = page.getByTestId('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('AI Talent Acquisition');
  });

  // ── Responsive ───────────────────────────────────────────────
  test('page loads without errors on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByTestId('hero')).toBeVisible();
  });

});
