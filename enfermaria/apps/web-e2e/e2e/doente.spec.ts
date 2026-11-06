import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

test.describe('Gestão de Doentes', () => {
  test.beforeEach(async ({ page }) => {
    // QA-22: a direção (admin) não tem esta rota (nav-data.tsx) e era redireccionada. Usa-se o
    // enfermeiro supervisor (00014) e não o 00003: o break-glass abaixo daria acesso ao 00003, e
    // o regressao-persona.spec prova o 403 de "doente não atribuído" precisamente com o 00003.
    await loginAs(page, '00014');
  });

  test('dashboard carrega lista de doentes', async ({ page }) => {
    await page.goto('/doentes');
    // Should show the patients list page header
    await expect(page.getByRole('heading', { name: /doentes/i })).toBeVisible({ timeout: 10000 });
  });

  // QA-22/QA-23: clicava "no primeiro link" da lista e fazia skip quando não havia — o
  // enfermeiro só vê os doentes atribuídos. Abre-se um doente real (break-glass).
  test('página de detalhe de doente carrega painéis principais', async ({ page }) => {
    const doenteId = await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/erro ao carregar doente/i)).not.toBeVisible();
    await expect(page.getByText(/sinais vitais/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Notas Clínicas SOAP')).toBeVisible();
  });

  test('navegação de breadcrumb funciona', async ({ page }) => {
    await page.goto('/doentes');
    await expect(page).toHaveURL(/\/doentes/);
    // Main nav accessible
    await expect(page.getByRole('navigation').or(page.locator('nav')).first()).toBeVisible();
  });
});
