import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// O MAR é usado por enfermeiros/médicos — testar com o role certo (enfermeiro). Um único login
// por ficheiro (evita o duplo login → colisão de anti-replay do TOTP).
test.describe('MAR — Mapa de Administração de Medicamentos', () => {
  test('MAR carrega e renderiza para o enfermeiro', async ({ page }) => {
    await loginAs(page, '00003'); // enfermeiro
    await page.goto('/mar');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/mar|medicação|administra|mapa/i).first()).toBeVisible({ timeout: 10000 });
  });
});
