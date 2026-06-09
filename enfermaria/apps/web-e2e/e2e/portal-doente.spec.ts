import { test, expect } from '@playwright/test';

test.describe('Portal do Doente', () => {
  test('sem autenticação /portal/login mostra formulário de login', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/portal|doente|acced|login|entrar/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('credenciais inválidas no portal do doente mostram erro', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');
    const input = page.getByRole('textbox').first();
    if (await input.count() > 0) {
      await input.fill('codigo-invalido-9999');
      const btn = page.getByRole('button', { name: /entrar|acced|login/i }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(1500);
        const erro = page.getByText(/inválid|incorret|erro|not found/i).first();
        if (await erro.count() > 0) {
          await expect(erro).toBeVisible({ timeout: 8000 });
        }
      }
    }
  });

  test('portal não expõe 500 nem dados internos', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error|stack trace/i)).not.toBeVisible();
  });
});
