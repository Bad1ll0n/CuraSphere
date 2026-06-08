import { test, expect } from '@playwright/test';

test.describe('Portal do Doente', () => {
  test('página de login do portal está acessível', async ({ page }) => {
    await page.goto('/portal/login');
    await expect(page.getByRole('heading', { name: /portal|aceder/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
  });

  test('login do portal com credenciais inválidas mostra erro', async ({ page }) => {
    await page.goto('/portal/login');
    await page.getByPlaceholder(/email/i).fill('naoexiste@exemplo.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: /entrar|aceder/i }).click();

    await expect(page.getByText(/erro|inválid|incorrect/i)).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test('portal login redireciona para dashboard do portal após autenticação', async ({ page }) => {
    // This test requires a test portal patient account
    const email = process.env['PORTAL_TEST_EMAIL'];
    const password = process.env['PORTAL_TEST_PASSWORD'];

    if (!email || !password) {
      // Skip when env vars not set in CI — documented requirement
      test.skip();
      return;
    }

    await page.goto('/portal/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /entrar|aceder/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('rota /portal/exportar existe e requer autenticação', async ({ page }) => {
    await page.goto('/portal/exportar');
    // Should redirect to portal login (not authenticated)
    await expect(page).toHaveURL(/\/portal\/login|\/login/, { timeout: 8000 });
  });
});
