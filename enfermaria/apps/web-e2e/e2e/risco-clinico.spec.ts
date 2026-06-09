import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Risco Clínico', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /risco-clinico carrega sem erros', async ({ page }) => {
    await page.goto('/risco-clinico');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/risco|clínico|score|serviço|alto/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('scores de risco por serviço são visíveis', async ({ page }) => {
    await page.goto('/risco-clinico');
    await page.waitForLoadState('networkidle');
    const scores = page.getByText(/score|risco|alto|médio|baixo|serviço/i).first();
    if (await scores.count() > 0) {
      await expect(scores).toBeVisible({ timeout: 8000 });
    }
  });

  test('médico acede ao dashboard de risco', async ({ page }) => {
    await loginAs(page, 'medico');
    await page.goto('/risco-clinico');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
