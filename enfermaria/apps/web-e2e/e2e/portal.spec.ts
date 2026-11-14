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
    // QA-23: fazia skip sem as variáveis de ambiente — a seed de teste já cria esta conta
    // (seed-test-users.ts: doente de teste, com consentimento do portal registado).
    const email = process.env['PORTAL_TEST_EMAIL'] ?? 'doente.teste@curasphere.local';
    const password = process.env['PORTAL_TEST_PASSWORD'] ?? 'Teste1234!';

    await page.goto('/portal/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /entrar|aceder/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login/);
    // SEC-19: o doente vê e gere os seus consentimentos.
    await page.goto('/portal/consentimentos');
    await expect(page.getByRole('heading', { name: 'Os Meus Consentimentos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Conta no portal')).toBeVisible();
  });

  test('rota /portal/exportar existe e requer autenticação', async ({ page }) => {
    await page.goto('/portal/exportar');
    // Should redirect to portal login (not authenticated)
    await expect(page).toHaveURL(/\/portal\/login|\/login/, { timeout: 8000 });
  });
});
