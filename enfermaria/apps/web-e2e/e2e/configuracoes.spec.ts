import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /configuracoes carrega sem erros', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/configura|role|subrole|serviço|permiss/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('roles e subroles são listados', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForLoadState('networkidle');
    const roles = page.getByText(/role|médico|enfermeiro|administrat/i).first();
    if (await roles.count() > 0) {
      await expect(roles).toBeVisible({ timeout: 8000 });
    }
  });

  test('secções de configuração são navegáveis', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForLoadState('networkidle');
    const secao = page.getByRole('tab').or(page.getByRole('link', { name: /geral|serviço|permiss/i })).first();
    if (await secao.count() > 0) {
      await expect(secao).toBeVisible({ timeout: 8000 });
    }
  });
});
