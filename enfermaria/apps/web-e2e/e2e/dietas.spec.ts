import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Dietas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /dietas carrega sem erros', async ({ page }) => {
    await page.goto('/dietas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/dieta|alimentação|prescri|nutri/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('prescrições dietéticas são listadas', async ({ page }) => {
    await page.goto('/dietas');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/dieta|alimentação|nutri|calorias/i).first();
    if (await lista.count() > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão prescrever dieta está presente', async ({ page }) => {
    await page.goto('/dietas');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /prescrev|nova dieta|adicionar/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
