import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

/**
 * PERF-05 — a pesquisa de doentes vai ao servidor: a lista encontra quem não está na página que
 * o browser tem, e os seletores pesquisam em vez de mostrarem os primeiros 25.
 */
test.describe('Pesquisa de doentes no servidor', () => {
  let nome = '';

  test.beforeAll(async () => {
    // Um doente internado (com cama) a que ninguém está atribuído.
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const h = { 'x-csrf-token': (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
    const marca = Date.now().toString(36);
    nome = `Quiteria Pesquisa ${marca}`;
    const r = await adm.post('/v1/doentes/admitir', { data: { nome, dataNascimento: '1950-03-03', diagnosticoPrincipal: 'Observação' }, headers: h });
    expect(r.status()).toBe(201);
    const doenteId = (await r.json()).id;
    const cama = await adm.post('/v1/camas', { data: { numero: `PQ-${marca}`, quarto: `PQ${marca}`, servico: 'Medicina' }, headers: h });
    expect(cama.status()).toBe(201);
    const at = await adm.post(`/v1/doentes/${doenteId}/atribuir-cama`, { data: { camaId: (await cama.json()).id }, headers: h });
    expect(at.ok()).toBeTruthy();
    await adm.dispose();
  });

  test('o médico encontra pelo nome um doente que não é seu (só a identificação) e abre a ficha', async ({ page }) => {
    await loginAs(page, '00013');
    await page.goto('/doentes');
    const pedido = page.waitForResponse((r) => r.url().includes('/v1/doentes?') && r.url().includes('search='));
    await page.getByPlaceholder('Pesquisar por nome, processo ou cama...').fill(nome);
    const resposta = await (await pedido).json();
    const linha = (resposta.data as any[]).find((d) => d.nome === nome);
    expect(linha).toMatchObject({ atribuido: false });
    expect(linha).not.toHaveProperty('diagnosticoPrincipal');
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10000 });
  });

  test('o seletor dos eventos adversos encontra o doente pela pesquisa', async ({ page }) => {
    await loginAs(page, '00010'); // qualidade
    await page.goto('/eventos-adversos');
    await page.getByRole('button', { name: /Registar Evento/ }).click();
    const campo = page.getByRole('combobox', { name: 'Doente (opcional)' });
    await campo.fill(nome.split(' ').slice(0, 2).join(' '));
    const opcao = page.getByRole('option', { name: new RegExp(nome) });
    await expect(opcao).toBeVisible({ timeout: 10000 });
    await opcao.click();
    await expect(campo).toHaveValue(nome);
  });
});
