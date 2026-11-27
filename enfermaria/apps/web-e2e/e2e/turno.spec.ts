import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// UX-22: /turno/passagem ("Passagem Turno Pro") foi unificada em /passagem-turno (ISBAR).
test.describe('Turno', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'enfermeiro');
  });

  test('o atalho antigo /turno/passagem leva à passagem única', async ({ page }) => {
    await page.goto('/turno/passagem');
    await expect(page).toHaveURL(/\/passagem-turno$/);
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });

  test('enfermeiro vê os seus doentes (ou o aviso de que não tem atribuídos)', async ({ page }) => {
    await page.goto('/passagem-turno');
    await expect(page.getByText(/Não tem doentes atribuídos|Processo/).first()).toBeVisible({ timeout: 10000 });
  });
});
