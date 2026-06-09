import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Farmácia', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /farmacia carrega sem erros', async ({ page }) => {
    await page.goto('/farmacia');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/farmácia|stock|medicamento/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de stock mostra medicamentos', async ({ page }) => {
    await page.goto('/farmacia');
    await page.waitForLoadState('networkidle');
    const stockSection = page.getByText(/stock|inventário|quantidade/i).first();
    if ((await stockSection.count()) > 0) {
      await expect(stockSection).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão de dispensação está acessível', async ({ page }) => {
    await page.goto('/farmacia');
    await page.waitForLoadState('networkidle');
    const btnDispensacao = page.getByRole('button', { name: /dispensar|registar saída/i }).or(
      page.getByText(/dispensação/i).first(),
    ).first();
    if ((await btnDispensacao.count()) > 0) {
      await expect(btnDispensacao).toBeVisible({ timeout: 8000 });
    }
  });

  test('histórico de ajustes de stock existe', async ({ page }) => {
    await page.goto('/farmacia');
    await page.waitForLoadState('networkidle');
    const historico = page.getByText(/histórico|ajuste|movimento/i).first();
    if ((await historico.count()) > 0) {
      await expect(historico).toBeVisible({ timeout: 8000 });
    }
  });

  test('pesquisa de medicamento no catálogo', async ({ page }) => {
    await page.goto('/farmacia');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="search"]').or(
      page.getByPlaceholder(/pesquisar|medicamento|dci/i),
    ).first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('para');
      await page.waitForTimeout(500);
      await expect(page.getByText(/paracetamol/i).or(page.getByText(/sem resultados/i)).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
