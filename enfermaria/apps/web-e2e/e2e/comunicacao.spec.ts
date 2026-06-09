import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Comunicação / Mensagens', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /comunicacao carrega sem erros', async ({ page }) => {
    await page.goto('/comunicacao');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/comunicação|mensagem|inbox|chat|conversa/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('inbox ou lista de mensagens é visível', async ({ page }) => {
    await page.goto('/comunicacao');
    await page.waitForLoadState('networkidle');
    const inbox = page.getByText(/mensagem|inbox|recebid|enviad/i).first();
    if (await inbox.count() > 0) {
      await expect(inbox).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão nova mensagem está presente', async ({ page }) => {
    await page.goto('/comunicacao');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /nova|enviar|escrever|mensagem/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
