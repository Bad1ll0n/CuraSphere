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
  test('pedido de cama: a gestão de camas reserva uma cama e dá entrada; a ficha mostra o internamento (PROD-02/03)', async ({ page }) => {
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const token = (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '';
    const h = { 'x-csrf-token': token };
    const marca = Date.now().toString().slice(-6);
    const nome = `Doente Pedido Cama ${marca}`;
    const admitido = await adm.post('/v1/doentes/admitir', { data: { nome, dataNascimento: '1955-05-05', diagnosticoPrincipal: 'Celulite' }, headers: h });
    expect(admitido.status()).toBe(201);
    const doenteId = (await admitido.json()).id;
    const cama = await adm.post('/v1/camas', { data: { numero: `PC-${marca}`, quarto: `PC${marca}`, servico: `E2E-${marca}` }, headers: h });
    expect(cama.status()).toBe(201);
    const camaId = (await cama.json()).id;
    const pedido = await adm.post('/v1/pedidos-cama', { data: { doenteId, origem: 'consulta', servicoDestino: `E2E-${marca}` }, headers: h });
    expect(pedido.status()).toBe(201);
    await adm.dispose();

    await loginAs(page, '00015'); // enfermagem: gere camas
    await page.goto('/camas');
    const linha = page.getByRole('listitem').filter({ hasText: nome });
    await expect(linha).toBeVisible({ timeout: 10000 });
    await linha.getByRole('combobox').selectOption(camaId);
    await linha.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(linha.getByText(`PC${marca}/PC-${marca}`)).toBeVisible({ timeout: 10000 });
    await linha.getByRole('button', { name: 'Dar entrada' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: nome })).toHaveCount(0, { timeout: 10000 });

    // A ficha mostra o episódio em curso no serviço da cama. A enfermeira-chefe não está
    // atribuída a este doente: acesso de emergência (break-glass) justificado, pela API.
    const bg = await page.request.post(`${API}/v1/break-glass`, {
      data: { doenteId, motivo: 'Validação E2E do internamento por pedido de cama' },
      headers: { 'x-csrf-token': await csrf(page) },
    });
    expect(bg.ok()).toBeTruthy();
    await page.goto(`/doentes/${doenteId}`);
    const painel = page.getByRole('region', { name: 'Internamentos' });
    await expect(painel).toBeVisible({ timeout: 15000 });
    await expect(painel.getByText(`Episódio n.º 1 — em curso · E2E-${marca}`)).toBeVisible();
  });
  test('alta: o modal mostra o que falta (nota de enfermagem) e só sai com justificação (PROD-12)', async ({ page }) => {
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const h = { 'x-csrf-token': (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
    const marca = Date.now().toString().slice(-6);
    const cama = await adm.post('/v1/camas', { data: { numero: `AL-${marca}`, quarto: `AL${marca}`, servico: `ALTA-${marca}` }, headers: h });
    const admitido = await adm.post('/v1/doentes/admitir', {
      data: { nome: `Doente Alta ${marca}`, dataNascimento: '1952-03-03', diagnosticoPrincipal: 'Pielonefrite', camaId: (await cama.json()).id },
      headers: h,
    });
    expect(admitido.status()).toBe(201);
    const doenteId = (await admitido.json()).id;
    await adm.dispose();

    await loginAs(page, '00012');
    await page.goto('/dashboard');
    const bg = await page.request.post(`${API}/v1/break-glass`, {
      data: { doenteId, motivo: 'Validação E2E do fluxo de alta estruturada' }, headers: { 'x-csrf-token': await csrf(page) },
    });
    expect(bg.ok()).toBeTruthy();
    await page.goto(`/doentes/${doenteId}`);
    await page.getByRole('button', { name: 'Dar Alta' }).click();
    await expect(page.getByRole('list', { name: 'Requisitos da alta' })).toContainText('Nota de alta de enfermagem', { timeout: 10000 });
    const resumo = page.getByPlaceholder(/Descreva o internamento|A gerar resumo/);
    await expect(resumo).toBeEnabled({ timeout: 20000 });
    await resumo.fill('Pielonefrite tratada, apirético há 72 h, alta para o domicílio.');
    await page.getByRole('button', { name: 'Confirmar Alta' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Falta para a alta' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel(/Para dar alta sem estes requisitos/).fill('Nota de enfermagem enviada em papel ao centro de saúde');
    await page.getByRole('button', { name: 'Confirmar Alta' }).click();
    await expect(page).toHaveURL(/\/doentes$/, { timeout: 15000 });
  });
});
