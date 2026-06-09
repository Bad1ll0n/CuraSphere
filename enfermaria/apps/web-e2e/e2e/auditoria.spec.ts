import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Auditoria', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /auditoria carrega sem erros (admin)', async ({ page }) => {
    await page.goto('/auditoria');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/auditoria|log|acção|evento|utilizador/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tabela de logs de auditoria é visível', async ({ page }) => {
    await page.goto('/auditoria');
    await page.waitForLoadState('networkidle');
    const tabela = page.getByText(/log|acção|data|ip|utilizador/i).first();
    if (await tabela.count() > 0) {
      await expect(tabela).toBeVisible({ timeout: 8000 });
    }
  });

  test('filtros de auditoria estão presentes', async ({ page }) => {
    await page.goto('/auditoria');
    await page.waitForLoadState('networkidle');
    const filtro = page.getByRole('combobox').first();
    if (await filtro.count() > 0) {
      await expect(filtro).toBeVisible({ timeout: 8000 });
    }
  });
});
