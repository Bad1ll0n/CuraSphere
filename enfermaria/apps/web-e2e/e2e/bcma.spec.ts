import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

/**
 * UX-08 — leitura à cabeceira (BCMA). A verificação fina (pulseira de outro doente bloqueia,
 * etiqueta assinada confere) está nos testes de integração da API; aqui prova-se que a pulseira
 * imprimível existe e abre a partir da ficha.
 */
test.describe('BCMA — pulseira do doente', () => {
  test('"Imprimir pulseira" abre a pulseira com QR (processo + data de nascimento)', async ({ page }) => {
    await loginAs(page, '00012'); // médico
    const doenteId = await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}`);
    await page.getByRole('button', { name: /Mais ações/ }).click();
    const [pulseira] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('menuitem', { name: 'Imprimir pulseira' }).click(),
    ]);
    await pulseira.evaluate(() => { window.print = () => undefined; });
    const etiqueta = pulseira.getByTestId('pulseira');
    await expect(etiqueta).toBeVisible({ timeout: 15000 });
    await expect(etiqueta.getByText(/Processo/)).toBeVisible();
    await expect(etiqueta.locator('svg')).toBeVisible(); // o QR
  });
});
