import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

/**
 * QA-23 — jornadas clínicas de ponta a ponta, pela interface. A verificação fina (5 certos,
 * acesso, cifra, auditoria) está nos testes de integração da API (QA-20); aqui prova-se que o
 * enfermeiro e o médico conseguem de facto fazer o percurso no ecrã.
 */
const API = process.env['API_URL'] ?? 'http://localhost:3333';

async function csrf(page: import('@playwright/test').Page): Promise<string> {
  return (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value ?? '';
}

test.describe('Jornadas clínicas', () => {
  test('sinais vitais críticos → NEWS2 calculado e assinalado na ficha', async ({ page }) => {
    await loginAs(page, '00015'); // enfermeira chefe
    const doenteId = await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}`);
    await page.getByRole('button', { name: 'Registar sinais vitais' }).click();
    await expect(page.getByRole('heading', { name: 'Registar Sinais Vitais' })).toBeVisible();
    // Doente a deteriorar: hipotenso, taquicárdico, febril, dessaturado e taquipneico.
    for (const [ph, valor] of [['120', '88'], ['80', '50'], ['72', '128'], ['36.5', '39.3'], ['98', '89'], ['16', '28']]) {
      await page.getByPlaceholder(ph, { exact: true }).fill(valor);
    }
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/NEWS2 CRÍTICO — Score \d+/)).toBeVisible({ timeout: 10000 });
  });

  test('alergia registada bloqueia a prescrição de uma marca com a mesma substância', async ({ page }) => {
    await loginAs(page, '00012');
    const doenteId = await prepararDoenteClinico(page);
    const r = await page.request.post(`${API}/v1/alergias/${doenteId}`, {
      data: { alergenio: 'Paracetamol', tipo: 'medicamento', severidade: 'anafilaxia' },
      headers: { 'x-csrf-token': await csrf(page) },
    });
    expect([201, 409]).toContain(r.status()); // 409 se já registada numa corrida anterior

    await page.goto(`/doentes/${doenteId}`);
    await page.getByRole('button', { name: 'Prescrever medicação' }).click();
    await expect(page.getByRole('heading', { name: 'Prescrever Medicação' })).toBeVisible();
    await page.getByPlaceholder('Ex: Paracetamol').fill('Ben-u-ron');
    await page.getByPlaceholder('Ex: 500mg').first().fill('1 g');
    await page.locator('#fmedicaca-2').selectOption('oral');
    await page.locator('#fmedicaca-3').selectOption('3x/dia');
    await page.getByRole('button', { name: 'Prescrever', exact: true }).click();
    // O servidor recusa (409) e o formulário explica porquê, pedindo justificação para avançar.
    await expect(page.getByText(/paracetamol/i).last()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Prescrever com justificação' })).toBeVisible();
  });

  test('break-glass: médico sem atribuição justifica o acesso e a ficha abre', async ({ page }) => {
    // Doente novo (admitido pelo administrativo): ninguém da equipa lhe está atribuído.
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const token = (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '';
    const nome = `Doente Break-glass ${Date.now()}`;
    const admitido = await adm.post('/v1/doentes/admitir', {
      data: { nome, dataNascimento: '1970-01-01', diagnosticoPrincipal: 'Observação' },
      headers: { 'x-csrf-token': token },
    });
    expect(admitido.status()).toBe(201);
    const doenteId = (await admitido.json()).id;
    await adm.dispose();

    await loginAs(page, '00013');
    page.once('dialog', (d) => d.accept('Emergência: paragem cardíaca, médico de serviço sem atribuição'));
    await page.goto(`/doentes/${doenteId}`);
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/erro ao carregar doente/i)).not.toBeVisible();
  });
});
