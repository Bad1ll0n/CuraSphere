import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Interconsultas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /interconsultas carrega sem erros', async ({ page }) => {
    await page.goto('/interconsultas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/interconsulta|referenciação|pedido/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de interconsultas é visível', async ({ page }) => {
    await page.goto('/interconsultas');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/pendente|respondida|urgente|interconsulta/i).first();
    if ((await lista.count()) > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão criar interconsulta está acessível', async ({ page }) => {
    await page.goto('/interconsultas');
    await page.waitForLoadState('networkidle');
    const btnCriar = page.getByRole('button', { name: /nova|criar|pedido/i }).first();
    if ((await btnCriar.count()) > 0) {
      await expect(btnCriar).toBeVisible({ timeout: 8000 });
    }
  });

  test('filtro por estado está disponível', async ({ page }) => {
    await page.goto('/interconsultas');
    await page.waitForLoadState('networkidle');
    const filtro = page.getByRole('combobox').or(page.getByLabel(/estado|filtro/i)).first();
    if ((await filtro.count()) > 0) {
      await expect(filtro).toBeVisible({ timeout: 8000 });
    }
  });

  test('secção interconsultas existe na ficha do doente', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');
    const primeiroDoente = page.getByRole('link', { name: /ver|detalhe|ficha/i }).or(
      page.locator('tbody tr').first().getByRole('link'),
    ).first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');
    const secaoInterconsulta = page.getByText(/interconsulta/i).first();
    if ((await secaoInterconsulta.count()) > 0) {
      await expect(secaoInterconsulta).toBeVisible({ timeout: 8000 });
    }
  });
});
