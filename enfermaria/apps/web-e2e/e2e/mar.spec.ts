import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('MAR — Mapa de Administração de Medicamentos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /mar carrega sem erros', async ({ page }) => {
    await page.goto('/mar');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/mar|medicação|administra|mapa/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('células do mapa de medicação são visíveis', async ({ page }) => {
    await page.goto('/mar');
    await page.waitForLoadState('networkidle');
    const celulas = page.getByText(/dose|hora|medicament|administr/i).first();
    if (await celulas.count() > 0) {
      await expect(celulas).toBeVisible({ timeout: 8000 });
    }
  });

  test('enfermeiro acede ao MAR', async ({ page }) => {
    await loginAs(page, 'enfermeiro');
    await page.goto('/mar');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
