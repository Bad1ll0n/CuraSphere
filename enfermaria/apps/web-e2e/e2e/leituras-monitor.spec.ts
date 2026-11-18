import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

/**
 * PROD-15 — a leitura de um monitor ligado à cama não entra direto nos sinais vitais: aparece
 * "por validar" na ficha, e o enfermeiro valida-a (passa à tabela, em seu nome) ou rejeita-a
 * como artefacto. A verificação fina (vias de ingestão, acesso, autoria) está na integração.
 */
test.describe('Leituras do monitor por validar', () => {
  test('o monitor envia, o enfermeiro valida uma e rejeita outra', async ({ page }) => {
    await loginAs(page, '00014'); // enfermeiro
    const doenteId = await prepararDoenteClinico(page);

    // Um monitor ligado ao doente (registado pela direção) envia duas leituras. O seed E2E não tem
    // doentes em cama; a ligação pela cama (o doente é quem a ocupa) está na integração.
    const dir = await pwRequest.newContext({ baseURL: API });
    await dir.post('/v1/auth/login', { data: { numeroFuncionario: '00001', password: process.env['TEST_PASSWORD'] ?? 'Teste1234!' } });
    const csrf = (await (await dir.get('/v1/csrf-token')).json()).token;
    const responsavel = (await (await dir.get('/v1/auth/me')).json()).id;
    const disp = await dir.post('/v1/monitorizacao/dispositivos', {
      data: { nome: `Monitor E2E ${Date.now()}`, responsavelId: responsavel, doenteId }, headers: { 'x-csrf-token': csrf },
    });
    expect(disp.ok(), await disp.text()).toBeTruthy();
    const { apiKey } = await disp.json();
    await dir.dispose();

    const monitor = await pwRequest.newContext({ baseURL: API });
    const agora = Date.now();
    for (const [pulso, minutos] of [[77, 2], [181, 1]] as const) {
      const r = await monitor.post('/v1/monitorizacao/ingerir', {
        data: { pulso, medidoEm: new Date(agora - minutos * 60_000).toISOString() }, headers: { 'x-device-key': apiKey },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
    }
    await monitor.dispose();

    await page.goto(`/doentes/${doenteId}#vitais`);
    const painel = page.getByRole('region', { name: 'Leituras do monitor por validar' });
    await expect(painel).toBeVisible({ timeout: 15000 });
    const leitura77 = painel.getByRole('listitem').filter({ hasText: 'FC 77' }).last();
    const leitura181 = painel.getByRole('listitem').filter({ hasText: 'FC 181' }).last();
    await expect(leitura181).toContainText('crítica');

    // A de 181 bpm era o doente a mexer-se: rejeitar como artefacto.
    await leitura181.getByRole('checkbox').check();
    await painel.getByRole('button', { name: 'Rejeitar como artefacto' }).click();
    await painel.getByLabel('Motivo da rejeição').fill('Doente a mexer-se, elétrodo solto');
    await painel.getByRole('button', { name: 'Confirmar rejeição' }).click();
    await expect(painel.getByRole('listitem').filter({ hasText: 'FC 181' })).toHaveCount(0, { timeout: 10000 });

    // A de 77 bpm é verdadeira: validar — passa à tabela dos sinais vitais, como "monitor".
    await leitura77.getByRole('checkbox').check();
    await painel.getByRole('button', { name: /^Validar/ }).click();
    await expect(page.getByText(/leitura validada/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('row').filter({ hasText: '77' }).filter({ hasText: 'monitor' }).first()).toBeVisible({ timeout: 10000 });
  });
});
