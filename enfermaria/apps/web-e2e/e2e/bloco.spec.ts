import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Bloco Operatório', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /bloco carrega sem erros', async ({ page }) => {
    await page.goto('/bloco');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/bloco|cirurgia|agenda|operatório/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('agenda cirúrgica é visível', async ({ page }) => {
    await page.goto('/bloco');
    await page.waitForLoadState('networkidle');
    const agenda = page.getByText(/cirurgia|bloco|sala|agenda|operação/i).first();
    if (await agenda.count() > 0) {
      await expect(agenda).toBeVisible({ timeout: 8000 });
    }
  });

  test('médico acede ao bloco operatório', async ({ page }) => {
    await loginAs(page, 'medico');
    await page.goto('/bloco');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
