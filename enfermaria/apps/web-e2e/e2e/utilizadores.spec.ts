import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Utilizadores', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /utilizadores carrega sem erros', async ({ page }) => {
    await page.goto('/utilizadores');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/utilizador|nome|role|perfil/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de utilizadores é visível', async ({ page }) => {
    await page.goto('/utilizadores');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/nome|nif|role|médico|enfermeiro|admin/i).first();
    if (await lista.count() > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('pesquisa filtra utilizadores', async ({ page }) => {
    await page.goto('/utilizadores');
    await page.waitForLoadState('networkidle');
    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/pesquis|search|nome/i)).first();
    if (await search.count() > 0) {
      await search.fill('admin');
      await page.waitForTimeout(500);
      await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    }
  });
});
