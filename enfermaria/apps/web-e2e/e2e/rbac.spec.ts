import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';
const PASS = process.env['TEST_PASSWORD'] ?? 'Teste1234!';

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

    test('API responde 401 em endpoint protegido sem sessão', async () => {
      // Contexto limpo (sem cookies do login da suite) directamente contra a API.
      const anon = await pwRequest.newContext({ baseURL: API });
      const response = await anon.get('/v1/doentes');
      expect(response.status()).toBe(401);
      await anon.dispose();
    });

    test('API aceita uma sessão válida (cookie) em endpoint protegido', async () => {
      // A app é cookie-based: o login (direção 00001, sem MFA) grava o cookie de sessão no
      // contexto; a mesma instância acede depois ao endpoint protegido.
      const ctx = await pwRequest.newContext({ baseURL: API });
      const loginResponse = await ctx.post('/v1/auth/login', {
        data: { numeroFuncionario: process.env['TEST_USER'] ?? '00001', password: PASS },
      });
      expect(loginResponse.ok(), `login: ${loginResponse.status()}`).toBeTruthy();

      const doenteResponse = await ctx.get('/v1/doentes');
      expect([200, 204]).toContain(doenteResponse.status());
      await ctx.dispose();
    });
  });
});
