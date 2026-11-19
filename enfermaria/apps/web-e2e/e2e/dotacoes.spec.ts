import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

/**
 * PROD-17 — o painel de dotação segura na página de horários (chefia): por serviço, as horas de
 * cuidados necessárias vs disponíveis, com semáforo, e o detalhe com histórico e parâmetros.
 * O cálculo, a escala por serviço e as regras laborais estão verificados na integração.
 */
test.describe('Dotação segura (chefia)', () => {
  test('mostra a dotação do serviço e o detalhe com parâmetros', async ({ page }) => {
    await loginAs(page, '00015'); // chefe de enfermagem
    // Um serviço com uma cama (o seed E2E não tem camas com serviço).
    const servico = `E2E Dotação ${Date.now()}`;
    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value ?? '';
    const cama = await page.request.post(`${API}/v1/camas`, { data: { numero: `D${Date.now()}`, quarto: 'E2E', servico }, headers: { 'x-csrf-token': csrf } });
    expect(cama.ok(), await cama.text()).toBeTruthy();

    await page.goto('/horarios');
    const painel = page.getByRole('region', { name: 'Dotação segura (turno em curso)' });
    await expect(painel).toBeVisible({ timeout: 15000 });
    const linha = painel.getByRole('row').filter({ hasText: servico });
    await expect(linha).toContainText('Sem doentes');
    await expect(linha).toContainText('valores de referência');

    await linha.getByRole('button', { name: 'Detalhe' }).click();
    await expect(painel.getByText('Parâmetros do serviço')).toBeVisible();
    await expect(painel.getByText(`Histórico — ${servico} (14 dias)`)).toBeVisible();
  });
});
