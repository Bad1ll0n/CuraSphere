import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * PROD-18 — a página de indicadores de enfermagem (chefia/qualidade): os 7 indicadores com a
 * definição versionada e o drill-down. Os valores exatos estão verificados na integração.
 */
test.describe('Indicadores de enfermagem', () => {
  test('mostra os indicadores, a definição e os casos', async ({ page }) => {
    await loginAs(page, '00015'); // chefe de enfermagem
    await page.goto('/dashboard-qualidade');
    await page.getByRole('link', { name: /Indicadores de enfermagem/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard-qualidade\/indicadores/);

    const tabela = page.getByRole('region', { name: 'Indicadores de enfermagem' });
    await expect(tabela).toBeVisible({ timeout: 15000 });
    for (const nome of ['Quedas por 1000 dias de internamento', 'Reinternamentos a 30 dias', 'Tempo da urgência até à cama (mediana)']) {
      await expect(tabela.getByText(nome)).toBeVisible();
    }
    const linha = tabela.getByRole('row').filter({ hasText: 'Quedas por 1000 dias de internamento' });
    await linha.getByText('Definição (versão 1)').click();
    await expect(linha.getByText(/Eventos adversos do tipo "queda"/)).toBeVisible();

    await linha.getByRole('button', { name: 'Ver casos' }).click();
    await expect(page.getByRole('region', { name: 'Casos' }).or(page.getByRole('heading', { name: 'Quedas por 1000 dias de internamento' }))).toBeVisible({ timeout: 10000 });
  });
});
