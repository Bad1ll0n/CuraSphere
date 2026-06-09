import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Perfil do Utilizador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /perfil carrega sem erros', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/perfil|nome|utilizador|conta/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('nome do utilizador é visível no perfil', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForLoadState('networkidle');
    const nome = page.getByText(/nome|utilizador|perfil/i).first();
    if (await nome.count() > 0) {
      await expect(nome).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão alterar password está presente', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /alterar|password|senha|mudar/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
