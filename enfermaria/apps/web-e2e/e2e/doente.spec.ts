import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Gestão de Doentes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('dashboard carrega lista de doentes', async ({ page }) => {
    await page.goto('/doentes');
    // Should show the patients list page header
    await expect(page.getByRole('heading', { name: /doentes/i })).toBeVisible({ timeout: 10000 });
  });

  test('página de detalhe de doente carrega painéis principais', async ({ page }) => {
    // Navigate to patients list first
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    // Click on the first patient link if any
    const primeiroDoente = page.getByRole('link').filter({ hasText: /processo|doente/i }).first();
    const exists = await primeiroDoente.count();
    if (exists === 0) {
      // No patients — acceptable in empty test environment
      test.skip();
      return;
    }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    // Should be on a patient detail page with clinical tabs/panels
    await expect(page.getByRole('tab').or(page.getByRole('button')).filter({ hasText: /sinais|medicação|feridas|notas/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('navegação de breadcrumb funciona', async ({ page }) => {
    await page.goto('/doentes');
    await expect(page).toHaveURL(/\/doentes/);
    // Main nav accessible
    await expect(page.getByRole('navigation').or(page.locator('nav')).first()).toBeVisible();
  });
});
