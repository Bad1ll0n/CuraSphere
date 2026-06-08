import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('Ex: 00001')).toBeVisible();

    await page.getByPlaceholder('Ex: 00001').fill(process.env['TEST_USER'] ?? '00001');
    await page.getByPlaceholder('••••••••').fill(process.env['TEST_PASSWORD'] ?? 'Admin1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // After login, should be redirected away from /login
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Ex: 00001').fill('99999');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/incorretos/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('página de login tem elementos de acessibilidade', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/número de funcionário/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
