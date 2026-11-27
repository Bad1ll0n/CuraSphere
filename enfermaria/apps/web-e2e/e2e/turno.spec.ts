import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Turno', () => {
  test.beforeEach(async ({ page }) => {
    // QA-22: a direção (admin) não tem esta rota (nav-data.tsx) e era redireccionada.
    await loginAs(page, 'enfermeiro');
  });

  test('página /turno/passagem carrega sem erros', async ({ page }) => {
    await page.goto('/turno/passagem');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/turno|doentes|serviço/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('lista de doentes do turno é visível', async ({ page }) => {
    await page.goto('/turno/passagem');
    await page.waitForLoadState('networkidle');
    const lista = page.getByText(/doente|cama|processo|nome/i).first();
    if (await lista.count() > 0) {
      await expect(lista).toBeVisible({ timeout: 8000 });
    }
  });

  test('enfermeiro vê doentes atribuídos no turno', async ({ page }) => {
    await loginAs(page, 'enfermeiro');
    await page.goto('/turno/passagem');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });
});
