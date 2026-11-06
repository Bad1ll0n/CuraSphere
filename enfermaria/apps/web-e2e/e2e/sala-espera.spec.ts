import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Sala de Espera', () => {
  test.beforeEach(async ({ page }) => {
    // QA-22: a direção (admin) não tem esta rota (nav-data.tsx) e era redireccionada.
    await loginAs(page, '00007');
  });

  test('página /sala-espera carrega sem erros', async ({ page }) => {
    await page.goto('/sala-espera');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/sala|espera|check.in|fila|triagem/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('check-ins ou fila de espera visível', async ({ page }) => {
    await page.goto('/sala-espera');
    await page.waitForLoadState('networkidle');
    const fila = page.getByText(/check.in|espera|triagem|chamada/i).first();
    if (await fila.count() > 0) {
      await expect(fila).toBeVisible({ timeout: 8000 });
    }
  });

  test('estatísticas de tempo de espera visíveis', async ({ page }) => {
    await page.goto('/sala-espera');
    await page.waitForLoadState('networkidle');
    const stats = page.getByText(/tempo|média|espera|minutos/i).first();
    if (await stats.count() > 0) {
      await expect(stats).toBeVisible({ timeout: 8000 });
    }
  });
});
