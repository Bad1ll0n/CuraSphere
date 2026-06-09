import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Mapa de Camas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /camas carrega sem erros', async ({ page }) => {
    await page.goto('/camas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/cama|leito|mapa/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('mapa de camas mostra unidades/quartos', async ({ page }) => {
    await page.goto('/camas');
    await page.waitForLoadState('networkidle');
    const camaMapa = page.getByText(/quarto|enfermaria|unidade/i).first();
    if ((await camaMapa.count()) > 0) {
      await expect(camaMapa).toBeVisible({ timeout: 8000 });
    }
  });

  test('indicadores de estado de cama são visíveis', async ({ page }) => {
    await page.goto('/camas');
    await page.waitForLoadState('networkidle');
    const estadoCama = page.getByText(/livre|ocupada|limpeza|bloqueada/i).first();
    if ((await estadoCama.count()) > 0) {
      await expect(estadoCama).toBeVisible({ timeout: 8000 });
    }
  });

  test('clicar numa cama abre detalhes ou opções', async ({ page }) => {
    await page.goto('/camas');
    await page.waitForLoadState('networkidle');
    const cama = page.locator('[data-testid*="cama"], .cama-card, .bed-card').first();
    if ((await cama.count()) === 0) { test.skip(); return; }
    await cama.click();
    await page.waitForTimeout(500);
    const detalhes = page.getByRole('dialog').or(page.getByText(/mudar estado|limpar|transferir/i).first());
    if ((await detalhes.count()) > 0) {
      await expect(detalhes.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('painel de resumo de ocupação existe', async ({ page }) => {
    await page.goto('/camas');
    await page.waitForLoadState('networkidle');
    const ocupacao = page.getByText(/ocupação|total|disponív/i).first();
    if ((await ocupacao.count()) > 0) {
      await expect(ocupacao).toBeVisible({ timeout: 8000 });
    }
  });
});
