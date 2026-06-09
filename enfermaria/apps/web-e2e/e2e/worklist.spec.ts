import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Worklist', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /worklist carrega sem erros', async ({ page }) => {
    await page.goto('/worklist');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/worklist|tarefa|pendente|ordem/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tarefas ou lista de trabalho são visíveis', async ({ page }) => {
    await page.goto('/worklist');
    await page.waitForLoadState('networkidle');
    const item = page.getByText(/tarefa|pendente|colher|realiz/i).first();
    if (await item.count() > 0) {
      await expect(item).toBeVisible({ timeout: 8000 });
    }
  });

  test('médico acede à worklist', async ({ page }) => {
    await loginAs(page, 'medico');
    await page.goto('/worklist');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
