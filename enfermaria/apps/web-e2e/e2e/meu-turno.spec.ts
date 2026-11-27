import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// UX-30 / UX-09 — "O meu turno" é a casa da enfermagem: destino depois do login e 1.º item do menu.
test.describe('O meu turno', () => {
  test('o enfermeiro começa no seu turno; o menu segue a ordem do papel e tem modos de trabalho', async ({ page }) => {
    await loginAs(page, '00003');
    await expect(page).toHaveURL(/\/meu-turno$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'O meu turno', level: 1 })).toBeVisible();
    await expect(page.getByText(/Não tem doentes atribuídos|toma\(s\) por fazer/).first()).toBeVisible({ timeout: 10000 });

    const menu = page.getByRole('complementary', { name: /navega/i });
    const trabalho = menu.getByRole('link');
    const nomes = await trabalho.allInnerTexts();
    const iMeu = nomes.findIndex((n) => /O meu turno/.test(n));
    const iMar = nomes.findIndex((n) => /^MAR$/.test(n.trim()));
    expect(iMeu).toBeGreaterThanOrEqual(0);
    expect(iMar).toBeGreaterThan(iMeu);

    // Modo cabeceira: letra base maior e barra lateral escondida.
    await page.getByLabel('Modo cabeceira').check();
    await expect(page.locator('html')).toHaveClass(/cabeceira/);
    await expect(page.locator('#sidebar-nav')).toBeHidden();
    await page.getByLabel('Modo cabeceira').uncheck();
    await expect(page.locator('html')).not.toHaveClass(/cabeceira/);
  });
});
