import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

// UX-22 — uma só passagem de turno, por doente, em ISBAR.
test.describe('Passagem de Turno (ISBAR)', () => {
  test('página /passagem-turno carrega e a antiga /turno/passagem redirecciona para ela', async ({ page }) => {
    await loginAs(page, 'enfermeiro');
    await page.goto('/turno/passagem');
    await expect(page).toHaveURL(/\/passagem-turno$/);
    await expect(page.getByRole('heading', { name: 'Passagem de Turno', level: 1 })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/ISBAR por doente/)).toBeVisible();
    // Só há uma entrada no menu.
    await expect(page.getByRole('link', { name: /Passagem Turno Pro/ })).toHaveCount(0);
  });

  test('enfermeiro prepara a passagem ISBAR pré-preenchida e entrega-a', async ({ page }) => {
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const h = { 'x-csrf-token': (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
    const marca = Date.now().toString().slice(-6);
    const cama = await adm.post('/v1/camas', { data: { numero: `PT-${marca}`, quarto: `PT${marca}`, servico: `ISBAR-${marca}` }, headers: h });
    const doente = await adm.post('/v1/doentes/admitir', {
      data: { nome: `Doente ISBAR ${marca}`, dataNascimento: '1949-02-02', diagnosticoPrincipal: 'Insuficiência cardíaca', camaId: (await cama.json()).id },
      headers: h,
    });
    expect(doente.status()).toBe(201);
    const doenteId = (await doente.json()).id;
    await adm.dispose();

    // 00014 (enfermeiro): o 00003 é usado por regressao-persona para provar o 403 sem break-glass.
    await loginAs(page, '00014');
    // Sem atribuição a este doente: acesso de emergência justificado (pela API).
    await page.goto('/passagem-turno');
    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value ?? '';
    const bg = await page.request.post(`${API}/v1/break-glass`, {
      data: { doenteId, motivo: 'Validação E2E da passagem de turno ISBAR' }, headers: { 'x-csrf-token': csrf },
    });
    expect(bg.ok()).toBeTruthy();

    await page.getByLabel('Serviço').selectOption(`ISBAR-${marca}`);
    const cartao = page.getByRole('listitem').filter({ hasText: `Doente ISBAR ${marca}` });
    await expect(cartao).toBeVisible({ timeout: 10000 });
    await cartao.getByRole('button', { name: 'Preparar ISBAR' }).click();
    const identificacao = cartao.getByLabel('Identificação');
    await expect(identificacao).toHaveValue(/processo/, { timeout: 10000 });
    await expect(cartao.getByLabel('Situação')).toHaveValue(/Insuficiência cardíaca/);
    await cartao.getByLabel('Recomendações').fill('Vigiar diurese e peso diário. Reavaliar dispneia.');
    await cartao.getByRole('button', { name: 'Entregar passagem' }).click();
    await expect(cartao.getByText('Entregue', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
