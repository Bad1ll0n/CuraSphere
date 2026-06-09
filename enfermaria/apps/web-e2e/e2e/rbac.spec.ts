import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('RBAC — Controlo de Acesso por Role', () => {
  test('rota protegida sem autenticação redireciona para /login', async ({ page }) => {
    // Não fazer login — aceder directamente a rota protegida
    await page.goto('/doentes');
    // Deve redirecionar para login
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('rota /dashboard redireciona sem sessão', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('rota /relatorios redireciona sem sessão', async ({ page }) => {
    await page.goto('/relatorios');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('rota /teleconsulta/[id] não expõe dados sem sessão', async ({ page }) => {
    await page.goto('/teleconsulta/00000000-test-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    // Não deve mostrar dados clínicos — deve ou redirecionar ou mostrar erro de acesso
    const temDadosClinico = await page.getByText(/nome do doente|videoRoomId|curasphere-/i).count();
    expect(temDadosClinico).toBe(0);
  });

  test.describe('utilizador autenticado', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page);
    });

    test('menu de navegação está visível após login', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const nav = page.getByRole('navigation').or(page.locator('nav')).first();
      await expect(nav).toBeVisible({ timeout: 8000 });
    });

    test('utilizador autenticado acede a /doentes', async ({ page }) => {
      await page.goto('/doentes');
      await page.waitForLoadState('networkidle');
      // Não deve redirecionar para login
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('utilizador autenticado acede a /consultas', async ({ page }) => {
      await page.goto('/consultas');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('utilizador autenticado acede a /relatorios', async ({ page }) => {
      await page.goto('/relatorios');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('API responde 401 em endpoint protegido sem token', async ({ page }) => {
      const response = await page.request.get('/v1/doentes');
      expect(response.status()).toBe(401);
    });

    test('API aceita token válido em endpoint protegido', async ({ page }) => {
      // Fazer login via API para obter token
      const loginResponse = await page.request.post('/v1/auth/login', {
        data: {
          numeroFuncionario: process.env['TEST_USER'] ?? '00001',
          password: process.env['TEST_PASSWORD'] ?? 'Admin1234!',
        },
      });
      expect(loginResponse.ok()).toBeTruthy();
      const { accessToken } = await loginResponse.json();

      // Usar token para aceder a endpoint protegido
      const doenteResponse = await page.request.get('/v1/doentes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect([200, 204]).toContain(doenteResponse.status());
    });
  });
});
