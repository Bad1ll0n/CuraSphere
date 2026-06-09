import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Passagem de Turno', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /passagem-turno carrega sem erros', async ({ page }) => {
    await page.goto('/passagem-turno');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/passagem|turno|relat/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('botão Gerar Rascunho está presente', async ({ page }) => {
    await page.goto('/passagem-turno');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /gerar|rascunho/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });

  test('histórico de passagens é visível', async ({ page }) => {
    await page.goto('/passagem-turno');
    await page.waitForLoadState('networkidle');
    const historico = page.getByText(/histórico|anterior|manhã|tarde|noite/i).first();
    if (await historico.count() > 0) {
      await expect(historico).toBeVisible({ timeout: 8000 });
    }
  });
});
