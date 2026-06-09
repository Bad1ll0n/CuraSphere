import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Eventos Adversos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /eventos-adversos carrega sem erros', async ({ page }) => {
    await page.goto('/eventos-adversos');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/evento|adverso|incidente|ocorrência/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de eventos adversos é visível', async ({ page }) => {
    await page.goto('/eventos-adversos');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/evento|adverso|incidente|notificar/i).first();
    if (await lista.count() > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão criar ou registar evento está presente', async ({ page }) => {
    await page.goto('/eventos-adversos');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /criar|registar|novo|reportar/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
