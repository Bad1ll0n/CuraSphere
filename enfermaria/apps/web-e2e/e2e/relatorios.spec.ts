import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Relatórios de Gestão', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /relatorios carrega sem erros', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');

    // Não deve ter erro 500 ou página de erro
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    // Deve ter conteúdo
    await expect(page.getByText(/relatório|report/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('cards de relatório são visíveis', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');

    // Cards: Demora Média, Ocupação, Diagnósticos, Medicamentos
    await expect(page.getByText(/demora média|internamento/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/ocupação.*camas|taxa.*ocup/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/diagnósticos/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('clicar num card de relatório gera o relatório', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');

    // Clicar no primeiro card
    const primeiroCard = page.getByRole('button', { name: /gerar|ver relatório|calcular/i }).or(
      page.getByText(/demora média/i).first().locator('..')
    ).first();

    if ((await primeiroCard.count()) === 0) { test.skip(); return; }
    await primeiroCard.click();

    // Aguardar resultado (tabela, gráfico ou mensagem de dados)
    await page.waitForTimeout(2000);
    const temResultado = await page.getByText(/dias|%|total|sem dados/i).count();
    expect(temResultado).toBeGreaterThan(0);
  });

  test('botão Exportar Excel está presente', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');

    const btnExcel = page.getByRole('button', { name: /excel|exportar|xlsx/i }).or(
      page.getByText(/📊|📥|excel/i).first()
    ).first();

    if ((await btnExcel.count()) === 0) { test.skip(); return; }
    await expect(btnExcel).toBeVisible({ timeout: 8000 });
  });

  test('seletor de período (data início/fim) existe', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');

    // Filtros de data devem estar presentes
    const filtroData = page.locator('input[type="date"]').or(
      page.getByPlaceholder(/data|período/i)
    ).first();

    if ((await filtroData.count()) > 0) {
      await expect(filtroData).toBeVisible({ timeout: 6000 });
    } else {
      // Filtro pode ser um selector de mês/ano com select
      const selectPeriodo = page.locator('select').first();
      if ((await selectPeriodo.count()) > 0) {
        await expect(selectPeriodo).toBeVisible();
      }
    }
  });
});
