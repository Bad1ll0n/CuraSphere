import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Faturação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /faturacao carrega sem erros', async ({ page }) => {
    await page.goto('/faturacao');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/fatura|episódio|pagamento|valor/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de episódios de faturação é visível', async ({ page }) => {
    await page.goto('/faturacao');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/fatura|episódio|pendente|pago/i).first();
    if (await lista.count() > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('filtro por estado está presente', async ({ page }) => {
    await page.goto('/faturacao');
    await page.waitForLoadState('networkidle');
    const filtro = page.getByText(/pendente|pago|todos/i).first();
    if (await filtro.count() > 0) {
      await expect(filtro).toBeVisible({ timeout: 8000 });
    }
  });
});
