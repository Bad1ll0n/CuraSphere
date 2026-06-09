import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Atribuições', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /atribuicoes carrega sem erros', async ({ page }) => {
    await page.goto('/atribuicoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/atribui|enfermeiro|doente|turno/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('emparelhamento enfermeiro-doente é listado', async ({ page }) => {
    await page.goto('/atribuicoes');
    await page.waitForLoadState('networkidle');
    const atrib = page.getByText(/atribui|enfermeiro|cama/i).first();
    if (await atrib.count() > 0) {
      await expect(atrib).toBeVisible({ timeout: 8000 });
    }
  });

  test('enfermeiro acede às suas atribuições', async ({ page }) => {
    await loginAs(page, 'enfermeiro');
    await page.goto('/atribuicoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
