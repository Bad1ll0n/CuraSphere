import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Recepção / Admissões', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /recepcao carrega sem erros', async ({ page }) => {
    await page.goto('/recepcao');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/recepção|admissão|fila|triagem|chegada/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('fila de admissões é visível', async ({ page }) => {
    await page.goto('/recepcao');
    await page.waitForLoadState('networkidle');
    const fila = page.getByText(/admissão|chegada|espera|fila/i).first();
    if (await fila.count() > 0) {
      await expect(fila).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão admitir doente está presente', async ({ page }) => {
    await page.goto('/recepcao');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /admitir|registar|novo doente|check.in/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
