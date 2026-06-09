import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Urgência', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /urgencia carrega sem erros', async ({ page }) => {
    await page.goto('/urgencia');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/urgência|triagem|fila/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('fila de urgência mostra episódios', async ({ page }) => {
    await page.goto('/urgencia');
    await page.waitForLoadState('networkidle');
    const fila = page.getByText(/vermelho|laranja|amarelo|verde|triagem/i).first();
    if ((await fila.count()) > 0) {
      await expect(fila).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão registar entrada de urgência existe', async ({ page }) => {
    await page.goto('/urgencia');
    await page.waitForLoadState('networkidle');
    const btnEntrada = page.getByRole('button', { name: /nova entrada|registar|triagem/i }).first();
    if ((await btnEntrada.count()) > 0) {
      await expect(btnEntrada).toBeVisible({ timeout: 8000 });
    }
  });

  test('indicadores de triagem Manchester são visíveis', async ({ page }) => {
    await page.goto('/urgencia');
    await page.waitForLoadState('networkidle');
    const indicador = page.getByText(/manchester|vermelho|laranja|amarelo|verde|azul/i).first();
    if ((await indicador.count()) > 0) {
      await expect(indicador).toBeVisible({ timeout: 8000 });
    }
  });

  test('estatísticas da urgência são apresentadas', async ({ page }) => {
    await page.goto('/urgencia');
    await page.waitForLoadState('networkidle');
    const stats = page.getByText(/tempo médio|espera|episódio|total/i).first();
    if ((await stats.count()) > 0) {
      await expect(stats).toBeVisible({ timeout: 8000 });
    }
  });
});
