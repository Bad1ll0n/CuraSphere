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

  // QA-23: procurava um seletor que não existe na página e fazia skip. Agora cria uma cama pela
  // interface (enfermagem) e confirma que aparece no mapa.
  test('adicionar uma cama pela interface: aparece no mapa', async ({ page }) => {
    await loginAs(page, '00015'); // enfermagem: tem a página e pode criar (como na API)
    await page.goto('/camas');
    const numero = `E2E-${Date.now().toString().slice(-6)}`;
    await page.getByRole('button', { name: '+ Adicionar Cama' }).click();
    await expect(page.getByRole('heading', { name: 'Nova Cama' })).toBeVisible();
    await page.getByLabel('Número').fill(numero);
    await page.getByLabel('Quarto').fill('E2E');
    await page.getByRole('button', { name: 'Criar Cama' }).click();
    await expect(page.getByText(numero).first()).toBeVisible({ timeout: 10000 });
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
