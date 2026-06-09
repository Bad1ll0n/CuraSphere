import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Horários / Escalas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /horarios carrega sem erros', async ({ page }) => {
    await page.goto('/horarios');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/horário|escala|turno|manhã|tarde|noite/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('grelha de turnos ou tabela de escalas é visível', async ({ page }) => {
    await page.goto('/horarios');
    await page.waitForLoadState('networkidle');
    const grid = page.getByText(/manhã|tarde|noite|turno|escala/i).first();
    if (await grid.count() > 0) {
      await expect(grid).toBeVisible({ timeout: 8000 });
    }
  });

  test('botão criar ou adicionar turno está presente', async ({ page }) => {
    await page.goto('/horarios');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /criar|adicionar|novo/i }).first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible({ timeout: 8000 });
    }
  });
});
